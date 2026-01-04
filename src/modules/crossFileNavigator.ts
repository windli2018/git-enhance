import * as vscode from 'vscode';
import { SourceControlQuery, FileWithSource } from './sourceControlQuery';
import { DiffNavigationCommands } from './diffNavigationCommands';
import { EditorTracker } from './editorTracker';
import { LoopModeState } from './stateManager';

export class CrossFileNavigator {
  private editorTracker: EditorTracker;

  constructor(
    private sourceControlQuery: SourceControlQuery,
    private enableLoop: boolean = true,
    maxOpenEditors: number = 5
  ) {
    this.editorTracker = new EditorTracker(maxOpenEditors);
  }

  /**
   * Open a file in the specified mode
   */
  private async openFile(fileWithSource: FileWithSource, isInCompareMode: boolean): Promise<void> {
    if (isInCompareMode) {
      // Open in compare/diff mode using git extension
      // git.openChange accepts URI and will use getSCMResource to find the Resource
      console.log('Opening file in compare mode:', fileWithSource.uri);
      await vscode.commands.executeCommand('git.openChange', fileWithSource.uri);
    } else {
      console.log('Opening file in normal mode:', fileWithSource.uri);
      // Open in normal edit mode
      const doc = await vscode.workspace.openTextDocument(fileWithSource.uri);
      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Active
      });
    }
  }

  /**
   * Navigate to a specific position and then execute diff navigation
   * @param position The position to navigate to
   * @param navigateCommand The navigation command to execute
   * @param inheritSession Optional session to inherit from the opener editor
   */
  private async navigateToChange(position: vscode.Position, navigateCommand: 'next' | 'previous', inheritSession?: LoopModeState, fileWithSource?: FileWithSource): Promise<void> {
    const newEditor = vscode.window.activeTextEditor;
    if (newEditor) {
      // Move cursor to the specified position
      newEditor.selection = new vscode.Selection(position, position);
      
      // Mark editor as tracked by extension ONLY if inheritSession is provided
      // If no session, the editor should already be tracked or will be tracked by caller
      if (inheritSession) {
        // Inherit session from opener editor
        if (fileWithSource) {
          // Mark the editor with both session ID and file source
          this.editorTracker.markEditorWithSessionIdAndSource(newEditor, inheritSession.sessionId, fileWithSource.source);
        } else {
          this.editorTracker.markEditorWithSessionId(newEditor, inheritSession.sessionId);
        }
      } else if (fileWithSource) {
        // If no inheritSession but we have fileWithSource, just mark the source
        const newSessionId = this.editorTracker.markEditor(newEditor);
        this.editorTracker.markEditorWithSessionIdAndSource(newEditor, newSessionId, fileWithSource.source);
      }
      // Note: If no inheritSession and no fileWithSource, we don't mark the editor here
      // The caller (commandHandler) should handle session creation
      
      // Execute navigation command
      if (navigateCommand === 'next') {
        await DiffNavigationCommands.executeNext(newEditor);
      } else {
        await DiffNavigationCommands.executePrevious(newEditor);
      }
    }
  }

  /**
   * Open a file and navigate to its first change
   * @param fileWithSource The file to open
   * @param isInCompareMode Whether to open in compare mode
   * @param inheritSession Optional session to inherit from the opener editor
   */
  public async openFileAndNavigateToFirstChange(fileWithSource: FileWithSource, isInCompareMode: boolean, inheritSession?: LoopModeState): Promise<boolean> {
    try {
      await this.openFile(fileWithSource, isInCompareMode);
      await this.delay(150);
      
      // Navigate to first change: move to end then execute next
      const newEditor = vscode.window.activeTextEditor;
      if (newEditor) {
        const lastLine = newEditor.document.lineCount - 1;
        const lastChar = newEditor.document.lineAt(lastLine).text.length;
        const endPosition = new vscode.Position(lastLine, lastChar);
        await this.navigateToChange(endPosition, 'next', inheritSession, fileWithSource);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Open a file and navigate to its last change
   * @param fileWithSource The file to open
   * @param isInCompareMode Whether to open in compare mode
   * @param inheritSession Optional session to inherit from the opener editor
   */
  public async openFileAndNavigateToLastChange(fileWithSource: FileWithSource, isInCompareMode: boolean, inheritSession?: LoopModeState): Promise<boolean> {
    try {
      await this.openFile(fileWithSource, isInCompareMode);
      await this.delay(150);
      
      // Navigate to last change: move to start then execute previous
      const newEditor = vscode.window.activeTextEditor;
      if (newEditor) {
        const startPosition = new vscode.Position(0, 0);
        await this.navigateToChange(startPosition, 'previous', inheritSession, fileWithSource);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public setEnableLoop(enable: boolean): void {
    this.enableLoop = enable;
  }

  public setMaxOpenEditors(max: number): void {
    this.editorTracker.setMaxTrackedEditors(max);
  }

  public getEditorTracker(): EditorTracker {
    return this.editorTracker;
  }
}
