import * as vscode from 'vscode';

interface TrackedEditorInfo {
  editor: vscode.TextEditor;
  timestamp: number;
}

/**
 * Tracks editors opened by the extension to maintain session continuity
 * with timestamp-based LRU eviction
 */
export class EditorTracker {
  private trackedEditors = new Map<vscode.TextEditor, TrackedEditorInfo>();
  private currentSessionId: string | null = null;
  private maxTrackedEditors: number = 5;

  constructor(maxTrackedEditors: number = 5) {
    this.maxTrackedEditors = maxTrackedEditors;
  }

  /**
   * Mark an editor as opened by this extension in current session
   */
  public markEditor(editor: vscode.TextEditor): void {
    if (!this.currentSessionId) {
      this.currentSessionId = this.generateSessionId();
    }
    
    const info: TrackedEditorInfo = {
      editor,
      timestamp: Date.now()
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
   */
  public unmarkEditor(editor: vscode.TextEditor): void {
    const removed = this.trackedEditors.delete(editor);
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
   * Get session ID for an editor
   */
  public getEditorSessionId(editor: vscode.TextEditor): string | undefined {
    return this.trackedEditors.has(editor) ? this.currentSessionId || undefined : undefined;
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
   * Start a new tracking session
   */
  public startNewSession(): string {
    this.currentSessionId = this.generateSessionId();
    return this.currentSessionId;
  }

  /**
   * Get current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Reset tracking (clears session)
   */
  public reset(): void {
    this.trackedEditors.clear();
    this.currentSessionId = null;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
