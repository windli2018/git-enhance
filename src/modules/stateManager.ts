import * as vscode from 'vscode';
import { EditorTracker } from './editorTracker';

export interface EditorBoundaryState {
  pendingNextFileJump: boolean;
  pendingPreviousFileJump: boolean;
  lastLine: number;  // Track cursor line to detect manual movement
  lastInteractionTime: number;
  capturedIsInCompareMode?: boolean;  // Capture mode at first click
}

export interface LoopModeState {
  startFileUri: string;  // Starting file URI for review session
  direction: 'next' | 'previous';  // Navigation direction
  editorMode: 'compare' | 'normal';  // Editor mode captured at start
  hasReviewedStartFile: boolean;  // Whether start file reached boundary in current direction
  sessionId: string;  // Unique identifier for navigation session
}

export class StateManager {
  // Map editor URI to its boundary state
  private editorStates = new Map<string, EditorBoundaryState>();
  
  // Loop mode tracking - support multiple concurrent sessions
  private loopModeSessions = new Map<string, LoopModeState>();
  
  // Smart notification mode - track show count per VS Code session
  private boundaryNotificationCount: number = 0;
  private readonly SMART_MODE_MAX_COUNT = 3;
  
  // Reference to EditorTracker for unified session management
  private editorTracker?: EditorTracker;

  public setEditorTracker(editorTracker: EditorTracker): void {
    this.editorTracker = editorTracker;
  }

  private getEditorKey(editor: vscode.TextEditor | string): string {
    if (typeof editor === 'string') {
      return editor;
    }
    return editor.document.uri.toString();
  }

  private getOrCreateState(editorKey: string, currentLine: number): EditorBoundaryState {
    let state = this.editorStates.get(editorKey);
    if (!state) {
      state = {
        pendingNextFileJump: false,
        pendingPreviousFileJump: false,
        lastLine: currentLine,
        lastInteractionTime: Date.now()
      };
      this.editorStates.set(editorKey, state);
    }
    return state;
  }

  public setPendingNextFileJump(editor: vscode.TextEditor, value: boolean, capturedMode?: boolean): void {
    const editorKey = this.getEditorKey(editor);
    const currentLine = editor.selection.active.line;
    const state = this.getOrCreateState(editorKey, currentLine);
    
    state.pendingNextFileJump = value;
    state.lastLine = currentLine;
    state.lastInteractionTime = Date.now();
    
    if (value && capturedMode !== undefined) {
      state.capturedIsInCompareMode = capturedMode;
    }
  }

  public setPendingPreviousFileJump(editor: vscode.TextEditor, value: boolean, capturedMode?: boolean): void {
    const editorKey = this.getEditorKey(editor);
    const currentLine = editor.selection.active.line;
    const state = this.getOrCreateState(editorKey, currentLine);
    
    state.pendingPreviousFileJump = value;
    state.lastLine = currentLine;
    state.lastInteractionTime = Date.now();
    
    if (value && capturedMode !== undefined) {
      state.capturedIsInCompareMode = capturedMode;
    }
  }

  public getPendingNextFileJump(editor: vscode.TextEditor): boolean {
    const editorKey = this.getEditorKey(editor);
    const currentLine = editor.selection.active.line;
    const state = this.editorStates.get(editorKey);
    
    if (!state) {
      return false;
    }
    
    // If cursor moved to different line, reset pending state
    if (currentLine !== state.lastLine) {
      state.pendingNextFileJump = false;
      state.lastLine = currentLine;
      return false;
    }
    
    return state.pendingNextFileJump;
  }

  public getPendingPreviousFileJump(editor: vscode.TextEditor): boolean {
    const editorKey = this.getEditorKey(editor);
    const currentLine = editor.selection.active.line;
    const state = this.editorStates.get(editorKey);
    
    if (!state) {
      return false;
    }
    
    // If cursor moved to different line, reset pending state
    if (currentLine !== state.lastLine) {
      state.pendingPreviousFileJump = false;
      state.lastLine = currentLine;
      return false;
    }
    
    return state.pendingPreviousFileJump;
  }

  public getCapturedMode(editor: vscode.TextEditor): boolean | undefined {
    const editorKey = this.getEditorKey(editor);
    const state = this.editorStates.get(editorKey);
    return state?.capturedIsInCompareMode;
  }

  public resetPendingStates(editor: vscode.TextEditor): void {
    const editorKey = this.getEditorKey(editor);
    
    const state = this.editorStates.get(editorKey);
    if (state) {
      state.pendingNextFileJump = false;
      state.pendingPreviousFileJump = false;
      state.capturedIsInCompareMode = undefined;
    }
  }

  public dispose(): void {
    this.editorStates.clear();
    this.loopModeSessions.clear();
    this.boundaryNotificationCount = 0;
  }

  // Smart notification mode methods
  public shouldShowBoundaryNotification(mode: 'smart' | 'always' | 'never'): boolean {
    if (mode === 'never') {
      return false;
    }
    if (mode === 'always') {
      return true;
    }
    // Smart mode: show first 3 times per session
    return this.boundaryNotificationCount < this.SMART_MODE_MAX_COUNT;
  }

  public incrementNotificationCount(): void {
    this.boundaryNotificationCount++;
  }

  public getNotificationCount(): number {
    return this.boundaryNotificationCount;
  }

  // Loop mode methods - support multiple concurrent sessions based on editor tracking
  
  /**
   * Get or create a session for the given editor
   * If editor has changes, create/reuse session; otherwise return null
   * @param editor The editor to get/create session for
   * @param direction Navigation direction
   * @param editorMode Editor mode (compare or normal)
   * @param overrideFileUri Optional file URI to use as start file (overrides editor.document.uri)
   * @returns session if exists/created, null otherwise
   */
  public getOrCreateSession(
    editor: vscode.TextEditor,
    direction: 'next' | 'previous',
    editorMode: 'compare' | 'normal',
    overrideFileUri?: string
  ): LoopModeState | null {
    if (!this.editorTracker) {
      throw new Error('EditorTracker not set. Call setEditorTracker first.');
    }

    const fileUri = overrideFileUri || editor.document.uri.toString();
    
    // Check if editor is already tracked
    const existingSessionId = this.editorTracker.getEditorSessionId(editor);
    if (existingSessionId) {
      const session = this.getSessionById(existingSessionId);
      if (session) {
        // Session exists, return it
        return session;
      } else {
        // Editor tracked but session lost - clean up and recreate
        this.editorTracker.clearMark(editor);
      }
    }
    
    // Create new session
    const newSessionId = this.editorTracker.markEditor(editor);
    this.startLoopSession(newSessionId, fileUri, direction, editorMode);
    return this.getSessionById(newSessionId);
  }
  
  /**
   * Inherit session to a new editor (when jumping to another file)
   * @param newEditor The new editor to inherit session
   * @param session The session to inherit
   */
  public inheritSession(newEditor: vscode.TextEditor, session: LoopModeState): void {
    if (!this.editorTracker) {
      throw new Error('EditorTracker not set. Call setEditorTracker first.');
    }
    
    this.editorTracker.markEditorWithSessionId(newEditor, session.sessionId);
  }
  
  /**
   * Get session for an editor
   * @param editor The editor to get session for
   * @returns session if exists, null otherwise
   */
  public getSessionForEditor(editor: vscode.TextEditor): LoopModeState | null {
    if (!this.editorTracker) {
      return null;
    }
    
    const sessionId = this.editorTracker.getEditorSessionId(editor);
    if (!sessionId) {
      return null;
    }
    
    return this.getSessionById(sessionId);
  }

  /**
   * Clear session and editor tracking
   * @param editor The editor to clear
   */
  public clearSession(editor: vscode.TextEditor): void {
    if (!this.editorTracker) {
      return;
    }
    
    const sessionId = this.editorTracker.getEditorSessionId(editor);
    if (sessionId) {
      this.resetLoopSession(sessionId);
      this.editorTracker.clearMark(editor);
    }
  }

  public startLoopSession(sessionId: string, startFileUri: string, direction: 'next' | 'previous', editorMode: 'compare' | 'normal'): void {
    const session: LoopModeState = {
      startFileUri,
      direction,
      editorMode,
      hasReviewedStartFile: false,
      sessionId
    };
    this.loopModeSessions.set(sessionId, session);
  }

  public markStartFileReviewed(sessionId: string): void {
    const session = this.loopModeSessions.get(sessionId);
    if (session) {
      session.hasReviewedStartFile = true;
    }
  }

  public updateSessionDirection(sessionId: string, newDirection: 'next' | 'previous'): void {
    const session = this.loopModeSessions.get(sessionId);
    if (session) {
      session.direction = newDirection;
      session.hasReviewedStartFile = false; // Reset review status when direction changes
    }
  }

  public isStartFile(sessionId: string, fileUri: string): boolean {
    const session = this.loopModeSessions.get(sessionId);
    return session?.startFileUri === fileUri;
  }

  public getSessionById(sessionId: string): LoopModeState | null {
    return this.loopModeSessions.get(sessionId) ?? null;
  }

  public hasReviewedStartFile(sessionId: string): boolean {
    const session = this.loopModeSessions.get(sessionId);
    return session?.hasReviewedStartFile ?? false;
  }

  public getLoopDirection(sessionId: string): 'next' | 'previous' | null {
    const session = this.loopModeSessions.get(sessionId);
    return session?.direction ?? null;
  }

  public getLoopEditorMode(sessionId: string): 'compare' | 'normal' | null {
    const session = this.loopModeSessions.get(sessionId);
    return session?.editorMode ?? null;
  }

  public getLoopModeState(sessionId: string): LoopModeState | null {
    return this.loopModeSessions.get(sessionId) ?? null;
  }

  public resetLoopSession(sessionId: string): void {
    const deleted = this.loopModeSessions.delete(sessionId);
  }

  public isLoopSessionActive(sessionId?: string): boolean {
    if (sessionId) {
      return this.loopModeSessions.has(sessionId);
    }
    return this.loopModeSessions.size > 0;
  }
}
