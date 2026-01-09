import * as vscode from 'vscode';

interface TrackedEditorInfo {
  editor: vscode.TextEditor;
  timestamp: number;
  sessionId: string;  // Each editor has its own session ID
  fileSource?: 'workingTree' | 'index' | 'merge';  // Source of the file (workingTree, index, or merge)
}

/**
 * Tracks editors opened by the extension to maintain session continuity
 * with timestamp-based LRU eviction
 * Each editor has its own unique session ID for tracking purposes
 */
export class EditorTracker {
  private trackedEditors = new Map<vscode.TextEditor, TrackedEditorInfo>();
  private maxTrackedEditors: number = 5;

  constructor(maxTrackedEditors: number = 5) {
    this.maxTrackedEditors = maxTrackedEditors;
  }

  /**
   * Mark an editor as opened by this extension with a new session ID
   */
  public markEditor(editor: vscode.TextEditor): string {
    const sessionId = this.generateSessionId();
    
    const info: TrackedEditorInfo = {
      editor,
      timestamp: Date.now(),
      sessionId
    };
    
    this.trackedEditors.set(editor, info);
    
    // Check if exceeds limit and close oldest
    this.enforceLimit();
    
    return sessionId;
  }

  /**
   * Mark an editor with a specific session ID (inheriting from opener)
   * @param editor The editor to mark
   * @param sessionId The session ID to assign
   */
  public markEditorWithSessionId(editor: vscode.TextEditor, sessionId: string): void {
    const info: TrackedEditorInfo = {
      editor,
      timestamp: Date.now(),
      sessionId
    };
    
    this.trackedEditors.set(editor, info);
    
    // Check if exceeds limit and close oldest
    this.enforceLimit();
  }

  /**
   * Mark an editor with a specific session ID and file source
   * @param editor The editor to mark
   * @param sessionId The session ID to assign
   * @param fileSource The source of the file
   */
  public markEditorWithSessionIdAndSource(editor: vscode.TextEditor, sessionId: string, fileSource: 'workingTree' | 'index' | 'merge'): void {
    const info: TrackedEditorInfo = {
      editor,
      timestamp: Date.now(),
      sessionId,
      fileSource
    };
    
    this.trackedEditors.set(editor, info);
    
    // Check if exceeds limit and close oldest
    this.enforceLimit();
  }

  /**
   * Check if an editor was opened by this extension in current session
   */
  public isTrackedEditor(editor: vscode.TextEditor): boolean {
    const isTracked = this.trackedEditors.has(editor);
    return isTracked;
  }

  /**
   * Remove an editor from tracking (when closed)
   * This removes the editor-sessionId mapping
   */
  public unmarkEditor(editor: vscode.TextEditor): void {
    this.trackedEditors.delete(editor);
  }

  /**
   * Get count of tracked editors
   */
  public getTrackedCount(): number {
    return this.trackedEditors.size;
  }

  /**
   * Get all tracked editors sorted by timestamp (oldest first)
   */
  public getTrackedEditorsByAge(): vscode.TextEditor[] {
    const entries = Array.from(this.trackedEditors.values());
    entries.sort((a, b) => a.timestamp - b.timestamp);
    return entries.map(info => info.editor);
  }

  /**
   * Enforce max tracked editors limit by closing oldest editors
   * Skip editors with unsaved changes
   */
  private async enforceLimit(): Promise<void> {
    while (this.trackedEditors.size > this.maxTrackedEditors) {
      const oldestEditors = this.getTrackedEditorsByAge();
      let closed = false;
      
      for (const editor of oldestEditors) {
        // Skip if document is dirty (has unsaved changes)
        if (editor.document.isDirty) {
          continue;
        }
        
        // Try to close this editor
        const success = await this.closeEditor(editor);
        if (success) {
          closed = true;
          break;
        }
      }
      
      // If no editor could be closed, break to avoid infinite loop
      if (!closed) {
        break;
      }
    }
  }

  /**
   * Close an editor and remove from tracking
   */
  private async closeEditor(editor: vscode.TextEditor): Promise<boolean> {
    try {
      
      // Check if editor still exists in visible editors
      const stillVisible = vscode.window.visibleTextEditors.find(e => e === editor);
      if (!stillVisible) {
        this.trackedEditors.delete(editor);
        return true;
      }
      
      // Make it active and close
      await vscode.window.showTextDocument(editor.document);
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      
      // Remove from tracking
      this.trackedEditors.delete(editor);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get session ID for an editor by looking up the mapping table
   */
  public getEditorSessionId(editor: vscode.TextEditor): string | undefined {
    const info = this.trackedEditors.get(editor);
    return info?.sessionId;
  }

  /**
   * Get session ID by URI (when there's no editor)
   * Searches through tracked editors to find one with matching URI
   */
  public getSessionIdByUri(uri: vscode.Uri): string | undefined {
    const uriString = uri.toString();
    for (const [editor, info] of this.trackedEditors.entries()) {
      if (editor.document.uri.toString() === uriString) {
        return info.sessionId;
      }
    }
    return undefined;
  }

  /**
   * Get the file source for an editor
   * @param editor The editor to get source for
   * @returns file source if available, undefined otherwise
   */
  public getEditorFileSource(editor: vscode.TextEditor): 'workingTree' | 'index' | 'merge' | undefined {
    const info = this.trackedEditors.get(editor);
    return info?.fileSource;
  }

  /**
   * Clear mark from an editor (optional, for special scenarios)
   */
  public clearMark(editor: vscode.TextEditor): void {
    this.unmarkEditor(editor);
  }

  /**
   * Set max tracked editors
   */
  public setMaxTrackedEditors(max: number): void {
    this.maxTrackedEditors = max;
    // Enforce new limit immediately
    this.enforceLimit();
  }

  /**
   * Start a new tracking session for current active editor
   * Returns the new session ID
   */
  public startNewSession(): string | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return undefined;
    }
    return this.markEditor(activeEditor);
  }

  /**
   * Get current session ID (deprecated - use getEditorSessionId instead)
   * Returns session ID of active editor
   */
  public getCurrentSessionId(): string | null {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return null;
    }
    return this.getEditorSessionId(activeEditor) || null;
  }

  /**
   * Reset tracking (clears all editor-session mappings)
   */
  public reset(): void {
    this.trackedEditors.clear();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
