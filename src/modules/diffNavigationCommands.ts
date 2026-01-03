import * as vscode from 'vscode';
import { EditorModeDetector } from './editorModeDetector';

/**
 * Centralized diff navigation command executor
 * Tries multiple commands to find one that works
 * Caches working commands per editor type for performance
 */
export class DiffNavigationCommands {
  private static nextCommands = [
    'editor.action.dirtydiff.next',
    'workbench.action.compareEditor.nextChange',
    'editor.action.marker.nextInFiles'
  ];

  private static previousCommands = [
    'editor.action.dirtydiff.previous',
    'workbench.action.compareEditor.previousChange',
    'editor.action.marker.prevInFiles'
  ];

  private static workingNextCommandMap = new Map<string, string>();
  private static workingPreviousCommandMap = new Map<string, string>();

  public static getEditorType(editor: vscode.TextEditor): 'git' | 'compare' | 'file' {
    // Use centralized mode detector
    if (EditorModeDetector.isInCompareMode(editor)) {
      const scheme = editor.document.uri.scheme;
      return scheme === 'git' ? 'git' : 'compare';
    }
    return 'file';
  }

  /**
   * Execute next change command
   * @returns {isAtLast: boolean, moved: boolean} - isAtLast=true if at last change, moved=true if position changed
   */
  public static async executeNext(editor: vscode.TextEditor): Promise<{isAtLast: boolean, moved: boolean}> {
    const positionBefore = new vscode.Position(editor.selection.active.line, editor.selection.active.character);
    const editorType = this.getEditorType(editor);

    // Try cached working command first
    const cachedCommand = this.workingNextCommandMap.get(editorType);
    if (cachedCommand) {
      try {
        await vscode.commands.executeCommand(cachedCommand);
        const positionAfter = editor.selection.active;
        const moved = positionAfter.line !== positionBefore.line;
        const isAtLast = positionAfter.line <= positionBefore.line;
        return {isAtLast, moved};
      } catch (e) {
        this.workingNextCommandMap.delete(editorType);
      }
    }

    // Try all commands to find one that works
    for (const cmd of this.nextCommands) {
      try {
        await vscode.commands.executeCommand(cmd);
        const positionAfter = editor.selection.active;
        const moved = positionAfter.line !== positionBefore.line;
        const isAtLast = positionAfter.line <= positionBefore.line;
        
        // Cache the working command
        if (moved) {
          this.workingNextCommandMap.set(editorType, cmd);
          return {isAtLast, moved};
        }
      } catch (e) {
        // Command failed, try next
      }
    }

    return {isAtLast: true, moved: false};
  }

  /**
   * Execute previous change command
   * @returns {isAtFirst: boolean, moved: boolean} - isAtFirst=true if at first change, moved=true if position changed
   */
  public static async executePrevious(editor: vscode.TextEditor): Promise<{isAtFirst: boolean, moved: boolean}> {
    const positionBefore = new vscode.Position(editor.selection.active.line, editor.selection.active.character);
    const editorType = this.getEditorType(editor);

    // Try cached working command first
    const cachedCommand = this.workingPreviousCommandMap.get(editorType);
    if (cachedCommand) {
      try {
        await vscode.commands.executeCommand(cachedCommand);
        const positionAfter = editor.selection.active;
        const moved = positionAfter.line !== positionBefore.line;
        const isAtFirst = positionAfter.line >= positionBefore.line;
        return {isAtFirst, moved};
      } catch (e) {
        this.workingPreviousCommandMap.delete(editorType);
      }
    }

    // Try all commands to find one that works
    for (const cmd of this.previousCommands) {
      try {
        await vscode.commands.executeCommand(cmd);
        const positionAfter = editor.selection.active;
        const moved = positionAfter.line !== positionBefore.line;
        const isAtFirst = positionAfter.line >= positionBefore.line;
        
        // Cache the working command
        if (moved) {
          this.workingPreviousCommandMap.set(editorType, cmd);
          return {isAtFirst, moved};
        }
      } catch (e) {
        // Command failed, try next
      }
    }

    return {isAtFirst: true, moved: false};
  }
}
