import * as vscode from 'vscode';
import { DiffNavigationCommands } from './diffNavigationCommands';

export class BoundaryDetector {
  /**
   * Check if at last change by executing next and checking if position changed
   * If at boundary, restore to original position
   * @returns {isAtLast: boolean, moved: boolean} - isAtLast=true if can't move forward
   */
  public async checkAndExecuteNext(editor: vscode.TextEditor): Promise<{isAtLast: boolean, moved: boolean}> {
    const positionBefore = new vscode.Position(editor.selection.active.line, editor.selection.active.character);
    const {isAtLast, moved} = await DiffNavigationCommands.executeNext(editor);
    
    // Restore position if at boundary
    if (isAtLast) {
      editor.selection = new vscode.Selection(positionBefore, positionBefore);
      editor.revealRange(new vscode.Range(positionBefore, positionBefore));
      return { isAtLast, moved: false }
    }
    
    return { isAtLast, moved };
  }

  /**
   * Check if at first change by executing previous and checking if position changed
   * If at boundary, restore to original position
   * @returns {isAtFirst: boolean, moved: boolean} - isAtFirst=true if can't move backward
   */
  public async checkAndExecutePrevious(editor: vscode.TextEditor): Promise<{isAtFirst: boolean, moved: boolean}> {
    const positionBefore = new vscode.Position(editor.selection.active.line, editor.selection.active.character);
    const {isAtFirst, moved} = await DiffNavigationCommands.executePrevious(editor);
    
    // Restore position if at boundary
    if (isAtFirst) {
      editor.selection = new vscode.Selection(positionBefore, positionBefore);
      editor.revealRange(new vscode.Range(positionBefore, positionBefore));
      return { isAtFirst, moved: false }
    }
    
    return { isAtFirst, moved };
  }

}
