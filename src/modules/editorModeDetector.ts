import * as vscode from 'vscode';

/**
 * Centralized editor mode detection
 */
export class EditorModeDetector {
  /**
   * Detect if the current editor is in compare/diff mode
   * Checks if the active tab is a diff editor with git scheme
   * @param editor The editor to check
   * @returns true if in compare mode, false if in normal edit mode
   */
  public static isInCompareMode(editor: vscode.TextEditor | undefined): boolean {
    if (!editor) {
      return false;
    }

    const scheme = editor.document.uri.scheme;
    
    // If current editor is git scheme, it's definitely compare mode
    if (scheme === 'git' || scheme === 'vscode-scm') {
      return true;
    }
    
    // Check if the active tab is a diff editor
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input instanceof vscode.TabInputTextDiff ||
      activeTab?.input instanceof vscode.TabInputNotebookDiff ) {
      const modifiedUri = activeTab.input.modified;
      const originalUri = activeTab.input.original;
      
      // Check if either side has git scheme
      const isGitDiff = modifiedUri.scheme === 'git' || originalUri.scheme === 'git' ||
                        modifiedUri.scheme === 'vscode-scm' || originalUri.scheme === 'vscode-scm';
      
      return isGitDiff;
    }
    
    return false;
  }

  /**
   * Get editor mode as string for logging
   */
  public static getEditorMode(editor: vscode.TextEditor | undefined): string {
    return this.isInCompareMode(editor) ? 'compare' : 'normal';
  }

  /**
   * Detect the source of the current file (workingTree, index, or merge)
   * This helps determine which git change list the current file belongs to
   * @param editor The editor to check
   * @param editorTracker Optional editor tracker to get pre-marked source
   * @returns 'index' if comparing staged changes, 'merge' if in merge conflict, 'workingTree' otherwise
   */
  public static getFileSource(editor: vscode.TextEditor | undefined, editorTracker?: any): 'workingTree' | 'index' | 'merge' {
    if (!editor) {
      return 'workingTree';
    }

    // If editor tracker is provided, check for pre-marked source first
    if (editorTracker && typeof editorTracker.getEditorFileSource === 'function') {
      const premarkedSource = editorTracker.getEditorFileSource(editor);
      if (premarkedSource) {
        return premarkedSource;
      }
    }

    // Check if the active tab is a diff editor
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input instanceof vscode.TabInputTextDiff ||
      activeTab?.input instanceof vscode.TabInputNotebookDiff 
    ) {
      const modifiedUri = activeTab.input.modified;
      const originalUri = activeTab.input.original;
      
      // Check for merge conflicts (both sides are git scheme with merge-base)
      const query = new URLSearchParams(originalUri.query);
      if (query.has('mergeBase')) {
        return 'merge';
      }
      
      // Staged changes: both sides are git scheme (index vs HEAD)
      if (originalUri.scheme === 'git' && modifiedUri.scheme === 'git') {
        return 'index';
      }
      
      // Unstaged changes: file scheme (working) vs git scheme (index/HEAD)
      if (modifiedUri.scheme === 'file' && originalUri.scheme === 'git') {
        return 'workingTree';
      }
    } else if (editor.document.uri.scheme === 'git' || editor.document.uri.scheme === 'vscode-scm') {
      //new file in stage
      return 'index';
    }
    
    // Default to working tree
    return 'workingTree';
  }

  /**
   * Detect the source from URI and active tab when there's no editor
   * @param uri The URI to check
   * @returns 'index' if comparing staged changes, 'merge' if in merge conflict, 'workingTree' otherwise
   */
  public static getFileSourceFromUri(uri: vscode.Uri): 'workingTree' | 'index' | 'merge' {
    // Check URI scheme first
    if (uri.scheme === 'git' || uri.scheme === 'vscode-scm') {
      return 'index';
    }

    // Check if the active tab is a diff editor with this URI
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input instanceof vscode.TabInputTextDiff ||
      activeTab?.input instanceof vscode.TabInputNotebookDiff
    ) {
      const modifiedUri = activeTab.input.modified;
      const originalUri = activeTab.input.original;
      
      // Check if this URI matches the modified side
      if (modifiedUri.toString() === uri.toString() || originalUri.toString() === uri.toString()) {
        // Check for merge conflicts (both sides are git scheme with merge-base)
        const query = new URLSearchParams(originalUri.query);
        if (query.has('mergeBase')) {
          return 'merge';
        }
        
        // Staged changes: both sides are git scheme (index vs HEAD)
        if (originalUri.scheme === 'git' && modifiedUri.scheme === 'git') {
          return 'index';
        }
        
        // Unstaged changes: file scheme (working) vs git scheme (index/HEAD)
        if (modifiedUri.scheme === 'file' && originalUri.scheme === 'git') {
          return 'workingTree';
        }
      }
    }
    
    // Default to working tree
    return 'workingTree';
  }
}
