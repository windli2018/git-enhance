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
    
    const nextFile = await this.sourceControlQuery.getNextFile(currentUri, this.enableLoop);
    
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
    
    const previousFile = await this.sourceControlQuery.getPreviousFile(currentUri, this.enableLoop);
    
    if (!previousFile) {
      return false;
    }

    return await this.openFileAndNavigateToLastChange(previousFile, isInCompareMode);
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
      
      // Navigate to first change using centralized command
      const newEditor = vscode.window.activeTextEditor;
      
      if (newEditor) {
        // Mark editor as tracked by extension
        this.editorTracker.markEditor(newEditor);
        
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
      
      // Navigate to last change - for now, just go to first change using centralized command
      // TODO: Implement proper last change navigation
      const newEditor = vscode.window.activeTextEditor;
      if (newEditor) {
        // Mark editor as tracked by extension
        this.editorTracker.markEditor(newEditor);
        
        await DiffNavigationCommands.executeNext(newEditor);
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
