import * as vscode from 'vscode';
import { StateManager } from './stateManager';
import { BoundaryDetector } from './boundaryDetector';
import { NotificationManager } from './notificationManager';
import { CrossFileNavigator } from './crossFileNavigator';
import { SourceControlQuery } from './sourceControlQuery';
import { DiffNavigationCommands } from './diffNavigationCommands';
import { EditorModeDetector } from './editorModeDetector';

export class CommandHandler {
  private disposables: vscode.Disposable[] = [];
  private notificationMode: 'smart' | 'always' | 'never' = 'smart';

  constructor(
    private stateManager: StateManager,
    private boundaryDetector: BoundaryDetector,
    private notificationManager: NotificationManager,
    private crossFileNavigator: CrossFileNavigator,
    private sourceControlQuery: SourceControlQuery
  ) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    // Register custom commands that override default behavior
    this.disposables.push(
      vscode.commands.registerCommand('gitEnhance.nextChange', () => {
        return this.handleNextChange();
      })
    );
    
    this.disposables.push(
      vscode.commands.registerCommand('gitEnhance.previousChange', () => {
        return this.handlePreviousChange();
      })
    );
  }

  public setNotificationMode(mode: 'smart' | 'always' | 'never'): void {
    this.notificationMode = mode;
  }

  private async handleNextChange(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      return;
    }

    // Close any reviewed notification when user navigates
    this.notificationManager.closeReviewedNotification();

    const fileUri = editor.document.uri.toString();
    const editorTracker = this.crossFileNavigator.getEditorTracker();
    
    // Check if this is a tracked editor (opened by extension)
    const isTrackedEditor = editorTracker.isTrackedEditor(editor);
    
    let sessionId: string;
    
    if (!isTrackedEditor) {
      // Check if file has actual changes before starting session
      const hasChanges = await this.sourceControlQuery.fileHasChanges(editor.document.uri);
      
      if (hasChanges) {
        // File has changes - start new session
        sessionId = editorTracker.startNewSession();
        editorTracker.markEditor(editor);
        const editorMode = EditorModeDetector.isInCompareMode(editor) ? 'compare' : 'normal';
        this.stateManager.startLoopSession(sessionId, fileUri, 'next', editorMode);
      } else {
        // File has no changes - check boundary and offer to jump to first changed file
        const result = await this.boundaryDetector.checkAndExecuteNext(editor);
        
        if (result.isAtLast) {
          // At boundary - offer to jump to first changed file in repo
          const pendingJump = this.stateManager.getPendingNextFileJump(editor);
          
          if (pendingJump) {
            // Second click - jump to first changed file
            this.notificationManager.closeCurrentProgress();
            this.stateManager.resetPendingStates(editor);
            
            const modifiedFiles = await this.sourceControlQuery.getModifiedFilesInSameRepo(editor.document.uri);
            if (modifiedFiles.length === 0) {
              await this.notificationManager.showNoModifiedFiles();
              return;
            }
            
            // Jump to first file in compare mode
            const firstFile = modifiedFiles[0];
            await this.crossFileNavigator.jumpToNextFile(firstFile, true);
          } else {
            // First click - show notification
            this.stateManager.setPendingNextFileJump(editor, true, false);
            
            const shouldShow = this.stateManager.shouldShowBoundaryNotification(this.notificationMode);
            this.notificationManager.setShouldShow(shouldShow);
            const cancelled = await this.notificationManager.showReachedLastChange();
            
            if (cancelled) {
              this.stateManager.resetPendingStates(editor);
            }
            
            if (this.notificationMode === 'smart' && shouldShow) {
              this.stateManager.incrementNotificationCount();
            }
          }
        } else {
          // Not at boundary, reset pending
          this.stateManager.resetPendingStates(editor);
        }
        return;
      }
    } else {
      // Get session ID from tracked editor
      sessionId = editorTracker.getEditorSessionId(editor)!;
      const session = this.stateManager.getSessionById(sessionId);
      
      if (!session) {
        // Session was reset but editor still tracked - should not happen after proper cleanup
        // Treat as untracked and start fresh
        editorTracker.clearMark(editor);
        sessionId = editorTracker.startNewSession();
        editorTracker.markEditor(editor);
        const editorMode = EditorModeDetector.isInCompareMode(editor) ? 'compare' : 'normal';
        this.stateManager.startLoopSession(sessionId, fileUri, 'next', editorMode);
      } else {
        // Check for direction change at start file
        if (this.stateManager.isStartFile(sessionId, fileUri) && session.direction === 'previous') {
          // Direction changed at start file - will handle at boundary check
        }
      }
    }

    // Execute and check boundary in one operation (no flickering)
    const result = await this.boundaryDetector.checkAndExecuteNext(editor);
    
    if (result.isAtLast) {
      // At boundary - check if this is start file and mark it reviewed
      if (this.stateManager.isStartFile(sessionId, fileUri)) {
        const session = this.stateManager.getSessionById(sessionId);
        if (session) {
          const currentDirection = session.direction;
          if (currentDirection === 'next') {
            this.stateManager.markStartFileReviewed(sessionId);
          } else if (currentDirection === 'previous') {
            // Direction changed and reached boundary at start file - update session direction
            this.stateManager.updateSessionDirection(sessionId, 'next');
            this.stateManager.markStartFileReviewed(sessionId);
          }
        }
      }

      // Check pending state - this will also validate cursor position hasn't changed
      const pendingJump = this.stateManager.getPendingNextFileJump(editor);
      
      if (pendingJump) {
        // Second click at boundary - jump to next file
        // Close previous progress notification
        this.notificationManager.closeCurrentProgress();
        
        // Use session's editor mode to maintain consistency throughout the session
        const session = this.stateManager.getSessionById(sessionId);
        const sessionMode = session?.editorMode === 'compare';
        this.stateManager.resetPendingStates(editor);
        
        const modifiedFiles = await this.sourceControlQuery.getModifiedFilesInSameRepo(editor.document.uri);
        if (modifiedFiles.length === 0) {
          await this.notificationManager.showNoModifiedFiles();
          return;
        }

        await this.crossFileNavigator.jumpToNextFile(editor.document.uri, sessionMode);
        
        // After jumping, check if we completed a loop
        const newEditor = vscode.window.activeTextEditor;
        if (newEditor) {
          const newFileUri = newEditor.document.uri.toString();
          const newSessionId = editorTracker.getEditorSessionId(newEditor);
          if (newSessionId) {
            const newSession = this.stateManager.getSessionById(newSessionId);
            // Loop complete only if: returned to start file AND direction matches AND start file was reviewed
            if (newSession && 
                this.stateManager.isStartFile(newSessionId, newFileUri) && 
                newSession.direction === 'next' &&
                this.stateManager.hasReviewedStartFile(newSessionId)) {
              await this.notificationManager.showAlreadyReviewed();
              // Clean up: reset session and clear editor tracking
              this.stateManager.resetLoopSession(newSessionId);
              editorTracker.clearMark(newEditor);
            }
          }
        }
      } else {
        // First click at boundary - show notification and set pending state
        // No need to capture mode - we'll use session mode when jumping
        this.stateManager.setPendingNextFileJump(editor, true, false);
        
        // Check if should show notification based on mode
        const shouldShow = this.stateManager.shouldShowBoundaryNotification(this.notificationMode);
        this.notificationManager.setShouldShow(shouldShow);
        const cancelled = await this.notificationManager.showReachedLastChange();
        
        // If user cancelled, clear pending state
        if (cancelled) {
          this.stateManager.resetPendingStates(editor);
        }
        
        // Increment counter for smart mode
        if (this.notificationMode === 'smart' && shouldShow) {
          this.stateManager.incrementNotificationCount();
        }
      }
    } else {
      // Successfully moved to next change, reset pending state
      this.stateManager.resetPendingStates(editor);
    }
  }

  private async handlePreviousChange(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      return;
    }

    // Close any reviewed notification when user navigates
    this.notificationManager.closeReviewedNotification();

    const fileUri = editor.document.uri.toString();
    const editorTracker = this.crossFileNavigator.getEditorTracker();
    
    // Check if this is a tracked editor (opened by extension)
    const isTrackedEditor = editorTracker.isTrackedEditor(editor);
    
    let sessionId: string;
    
    if (!isTrackedEditor) {
      // Check if file has actual changes before starting session
      const hasChanges = await this.sourceControlQuery.fileHasChanges(editor.document.uri);
      
      if (hasChanges) {
        // File has changes - start new session
        sessionId = editorTracker.startNewSession();
        editorTracker.markEditor(editor);
        const editorMode = EditorModeDetector.isInCompareMode(editor) ? 'compare' : 'normal';
        this.stateManager.startLoopSession(sessionId, fileUri, 'previous', editorMode);
      } else {
        // File has no changes - check boundary and offer to jump to last changed file
        const result = await this.boundaryDetector.checkAndExecutePrevious(editor);
        
        if (result.isAtFirst) {
          // At boundary - offer to jump to last changed file in repo
          const pendingJump = this.stateManager.getPendingPreviousFileJump(editor);
          
          if (pendingJump) {
            // Second click - jump to last changed file
            this.notificationManager.closeCurrentProgress();
            this.stateManager.resetPendingStates(editor);
            
            const modifiedFiles = await this.sourceControlQuery.getModifiedFilesInSameRepo(editor.document.uri);
            if (modifiedFiles.length === 0) {
              await this.notificationManager.showNoModifiedFiles();
              return;
            }
            
            // Jump to last file in compare mode
            const lastFile = modifiedFiles[modifiedFiles.length - 1];
            await this.crossFileNavigator.jumpToPreviousFile(lastFile, true);
          } else {
            // First click - show notification
            this.stateManager.setPendingPreviousFileJump(editor, true, false);
            
            const shouldShow = this.stateManager.shouldShowBoundaryNotification(this.notificationMode);
            this.notificationManager.setShouldShow(shouldShow);
            const cancelled = await this.notificationManager.showReachedFirstChange();
            
            if (cancelled) {
              this.stateManager.resetPendingStates(editor);
            }
            
            if (this.notificationMode === 'smart' && shouldShow) {
              this.stateManager.incrementNotificationCount();
            }
          }
        } else {
          // Not at boundary, reset pending
          this.stateManager.resetPendingStates(editor);
        }
        return;
      }
    } else {
      // Get session ID from tracked editor
      sessionId = editorTracker.getEditorSessionId(editor)!;
      const session = this.stateManager.getSessionById(sessionId);
      
      if (!session) {
        // Session was reset but editor still tracked - should not happen after proper cleanup
        // Treat as untracked and start fresh
        editorTracker.clearMark(editor);
        sessionId = editorTracker.startNewSession();
        editorTracker.markEditor(editor);
        const editorMode = EditorModeDetector.isInCompareMode(editor) ? 'compare' : 'normal';
        this.stateManager.startLoopSession(sessionId, fileUri, 'previous', editorMode);
      } else {
        // Check for direction change at start file
        if (this.stateManager.isStartFile(sessionId, fileUri) && session.direction === 'next') {
          // Direction changed at start file - will handle at boundary check
        }
      }
    }

    // Execute and check boundary in one operation (no flickering)
    const result = await this.boundaryDetector.checkAndExecutePrevious(editor);
    
    if (result.isAtFirst) {
      // At boundary - check if this is start file and mark it reviewed
      if (this.stateManager.isStartFile(sessionId, fileUri)) {
        const session = this.stateManager.getSessionById(sessionId);
        if (session) {
          const currentDirection = session.direction;
          if (currentDirection === 'previous') {
            this.stateManager.markStartFileReviewed(sessionId);
          } else if (currentDirection === 'next') {
            // Direction changed and reached boundary at start file - update session direction
            this.stateManager.updateSessionDirection(sessionId, 'previous');
            this.stateManager.markStartFileReviewed(sessionId);
          }
        }
      }

      // Check pending state - this will also validate cursor position hasn't changed
      const pendingJump = this.stateManager.getPendingPreviousFileJump(editor);
      
      if (pendingJump) {
        // Second click at boundary - jump to previous file
        // Close previous progress notification
        this.notificationManager.closeCurrentProgress();
        
        // Use session's editor mode to maintain consistency throughout the session
        const session = this.stateManager.getSessionById(sessionId);
        const sessionMode = session?.editorMode === 'compare';
        this.stateManager.resetPendingStates(editor);
        
        const modifiedFiles = await this.sourceControlQuery.getModifiedFilesInSameRepo(editor.document.uri);
        if (modifiedFiles.length === 0) {
          await this.notificationManager.showNoModifiedFiles();
          return;
        }

        await this.crossFileNavigator.jumpToPreviousFile(editor.document.uri, sessionMode);
        
        // After jumping, check if we completed a loop
        const newEditor = vscode.window.activeTextEditor;
        if (newEditor) {
          const newFileUri = newEditor.document.uri.toString();
          const newSessionId = editorTracker.getEditorSessionId(newEditor);
          if (newSessionId) {
            const newSession = this.stateManager.getSessionById(newSessionId);
            // Loop complete only if: returned to start file AND direction matches AND start file was reviewed
            if (newSession && 
                this.stateManager.isStartFile(newSessionId, newFileUri) && 
                newSession.direction === 'previous' &&
                this.stateManager.hasReviewedStartFile(newSessionId)) {
              await this.notificationManager.showAlreadyReviewed();
              // Clean up: reset session and clear editor tracking
              this.stateManager.resetLoopSession(newSessionId);
              editorTracker.clearMark(newEditor);
            }
          }
        }
      } else {
        // First click at boundary - show notification and set pending state
        // No need to capture mode - we'll use session mode when jumping
        this.stateManager.setPendingPreviousFileJump(editor, true, false);
        
        // Check if should show notification based on mode
        const shouldShow = this.stateManager.shouldShowBoundaryNotification(this.notificationMode);
        this.notificationManager.setShouldShow(shouldShow);
        const cancelled = await this.notificationManager.showReachedFirstChange();
        
        // If user cancelled, clear pending state
        if (cancelled) {
          this.stateManager.resetPendingStates(editor);
        }
        
        // Increment counter for smart mode
        if (this.notificationMode === 'smart' && shouldShow) {
          this.stateManager.incrementNotificationCount();
        }
      }
    } else {
      // Successfully moved to previous change, reset pending state
      this.stateManager.resetPendingStates(editor);
    }
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
