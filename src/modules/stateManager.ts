import * as vscode from 'vscode';

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
  private stateResetTimeoutMs: number = 5000;
  private resetTimeouts = new Map<string, NodeJS.Timeout>();
  
  // Loop mode tracking - support multiple concurrent sessions
  private loopModeSessions = new Map<string, LoopModeState>();
  
  // Smart notification mode - track show count per VS Code session
  private boundaryNotificationCount: number = 0;
  private readonly SMART_MODE_MAX_COUNT = 3;

  constructor(stateResetTimeoutMs?: number) {
    if (stateResetTimeoutMs) {
      this.stateResetTimeoutMs = stateResetTimeoutMs;
    }
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
    
    if (value) {
      this.scheduleStateReset(editorKey);
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
    
    if (value) {
      this.scheduleStateReset(editorKey);
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
    
    this.clearResetTimeout(editorKey);
  }

  private scheduleStateReset(editorKey: string): void {
    this.clearResetTimeout(editorKey);
    
    const timeout = setTimeout(() => {
      const state = this.editorStates.get(editorKey);
      if (state) {
        state.pendingNextFileJump = false;
        state.pendingPreviousFileJump = false;
      }
      this.resetTimeouts.delete(editorKey);
    }, this.stateResetTimeoutMs);
    
    this.resetTimeouts.set(editorKey, timeout);
  }

  private clearResetTimeout(editorKey: string): void {
    const timeout = this.resetTimeouts.get(editorKey);
    if (timeout) {
      clearTimeout(timeout);
      this.resetTimeouts.delete(editorKey);
    }
  }

  public dispose(): void {
    // Clear all timeouts
    for (const timeout of this.resetTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.resetTimeouts.clear();
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
