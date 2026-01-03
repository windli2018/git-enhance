import * as vscode from 'vscode';
import { SourceControlQuery } from './sourceControlQuery';
import { DiffNavigationCommands } from './diffNavigationCommands';
import { EditorModeDetector } from './editorModeDetector';
import { EditorTracker } from './editorTracker';

export class CrossFileNavigator {
  private editorTracker: EditorTracker;

  constructor(
    private sourceControlQuery: SourceControlQuery,
    private enableLoop: boolean = true,
    maxOpenEditors: number = 5
  ) {
    this.editorTracker = new EditorTracker(maxOpenEditors);
  }

  public async jumpToNextFile(currentUri: vscode.Uri, capturedMode?: boolean): Promise<boolean> {
    
    // Use captured mode if provided, otherwise detect current mode
    let isInCompareMode: boolean;
    if (capturedMode !== undefined) {
      isInCompareMode = capturedMode;
    } else {
      const currentEditor = vscode.window.activeTextEditor;
      isInCompareMode = EditorModeDetector.isInCompareMode(currentEditor);
    }
    
    // Get next file from same repository
    const nextFile = await this.getNextFileInSameRepo(currentUri);
    
    if (!nextFile) {
      return false;
    }
    

    return await this.openFileAndNavigateToFirstChange(nextFile, isInCompareMode);
  }

  public async jumpToPreviousFile(currentUri: vscode.Uri, capturedMode?: boolean): Promise<boolean> {
    
    // Use captured mode if provided, otherwise detect current mode
    let isInCompareMode: boolean;
    if (capturedMode !== undefined) {
      isInCompareMode = capturedMode;
    } else {
      const currentEditor = vscode.window.activeTextEditor;
      isInCompareMode = EditorModeDetector.isInCompareMode(currentEditor);
    }
    
    // Get previous file from same repository
    const previousFile = await this.getPreviousFileInSameRepo(currentUri);
    
    if (!previousFile) {
      return false;
    }

    return await this.openFileAndNavigateToLastChange(previousFile, isInCompareMode);
  }

  private async getNextFileInSameRepo(currentUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const modifiedFiles = await this.sourceControlQuery.getModifiedFilesInSameRepo(currentUri);
    if (modifiedFiles.length === 0) {
      return undefined;
    }

    const currentIndex = modifiedFiles.findIndex(uri => uri.path === currentUri.path);
    
    if (currentIndex === -1) {
      // Current file not found, return first file
      return modifiedFiles[0];
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < modifiedFiles.length) {
      return modifiedFiles[nextIndex];
    }

    // At last file, loop if enabled
    if (this.enableLoop && modifiedFiles.length > 0) {
      return modifiedFiles[0];
    }

    return undefined;
  }

  private async getPreviousFileInSameRepo(currentUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const modifiedFiles = await this.sourceControlQuery.getModifiedFilesInSameRepo(currentUri);
    if (modifiedFiles.length === 0) {
      return undefined;
    }

    const currentIndex = modifiedFiles.findIndex(uri => uri.toString() === currentUri.toString());
    
    if (currentIndex === -1) {
      // Current file not found, return last file
      return modifiedFiles[modifiedFiles.length - 1];
    }

    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      return modifiedFiles[prevIndex];
    }

    // At first file, loop if enabled
    if (this.enableLoop && modifiedFiles.length > 0) {
      return modifiedFiles[modifiedFiles.length - 1];
    }

    return undefined;
  }

  private async openFileAndNavigateToFirstChange(fileUri: vscode.Uri, isInCompareMode: boolean): Promise<boolean> {
    try {
      
      if (isInCompareMode) {
        // Open in compare/diff mode using git extension
        // Use preserveFocus and viewColumn to open in new editor group
        await vscode.commands.executeCommand('git.openChange', fileUri, {
          preview: false,
          viewColumn: vscode.ViewColumn.Active
        });
      } else {
        // Open in normal edit mode
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Active
        });
      }
      
      
      // Wait a bit for the editor to be ready
      await this.delay(150);
      
      // Navigate to first change: move to end then execute next
      const newEditor = vscode.window.activeTextEditor;
      
      if (newEditor) {
        // Move cursor to end of file
        const lastLine = newEditor.document.lineCount - 1;
        const lastChar = newEditor.document.lineAt(lastLine).text.length;
        const endPosition = new vscode.Position(lastLine, lastChar);
        newEditor.selection = new vscode.Selection(endPosition, endPosition);
        
        // Mark editor as tracked by extension
        this.editorTracker.markEditor(newEditor);
        
        // Execute next to jump to first change
        await DiffNavigationCommands.executeNext(newEditor);
      } else {
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private async openFileAndNavigateToLastChange(fileUri: vscode.Uri, isInCompareMode: boolean): Promise<boolean> {
    try {
      
      if (isInCompareMode) {
        // Open in compare/diff mode using git extension
        await vscode.commands.executeCommand('git.openChange', fileUri, {
          preview: false,
          viewColumn: vscode.ViewColumn.Active
        });
      } else {
        // Open in normal edit mode
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);
      }
      
      // Wait a bit for the editor to be ready
      await this.delay(150);
      
      // Navigate to last change: move to start then execute previous
      const newEditor = vscode.window.activeTextEditor;
      if (newEditor) {
        // Move cursor to start of file
        const startPosition = new vscode.Position(0, 0);
        newEditor.selection = new vscode.Selection(startPosition, startPosition);
        
        // Mark editor as tracked by extension
        this.editorTracker.markEditor(newEditor);
        
        // Execute previous to jump to last change
        await DiffNavigationCommands.executePrevious(newEditor);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private async openFileDiff(fileUri: vscode.Uri): Promise<void> {
    // Try to open the file through SCM diff view
    // This will open the file in comparison with HEAD
    await vscode.commands.executeCommand('vscode.open', fileUri);
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
