import * as vscode from 'vscode';
import { StateManager, LoopModeState } from './stateManager';
import { BoundaryDetector } from './boundaryDetector';
import { NotificationManager } from './notificationManager';
import { CrossFileNavigator } from './crossFileNavigator';
import { SourceControlQuery } from './sourceControlQuery';
import { DiffNavigationCommands } from './diffNavigationCommands';
import { EditorModeDetector } from './editorModeDetector';
import { ConfigurationManager } from './configurationManager';

export class CommandHandler {
  private disposables: vscode.Disposable[] = [];
  private notificationMode: 'smart' | 'always' | 'never' = 'smart';
  private navigationStrategies: any;

  constructor(
    private stateManager: StateManager,
    private boundaryDetector: BoundaryDetector,
    private notificationManager: NotificationManager,
    private crossFileNavigator: CrossFileNavigator,
    private sourceControlQuery: SourceControlQuery,
    private configurationManager: ConfigurationManager
  ) {
    // Set editorTracker reference in stateManager for unified session management
    this.stateManager.setEditorTracker(this.crossFileNavigator.getEditorTracker());
    
    // Initialize navigation strategies
    this.navigationStrategies = {
      next: {
        // No-changes file navigation
        checkBoundary: async (editor: vscode.TextEditor) => {
          const result = await this.boundaryDetector.checkAndExecuteNext(editor);
          return result.isAtLast;
        },
        getPendingJump: (editorOrUri: vscode.TextEditor | vscode.Uri) => this.stateManager.getPendingNextFileJump(editorOrUri),
        setPendingJump: (editorOrUri: vscode.TextEditor | vscode.Uri) => this.stateManager.setPendingNextFileJump(editorOrUri, true, false),
        getTargetFile: (editor: vscode.TextEditor) => this.sourceControlQuery.getFirstModifiedFile(editor.document.uri),
        showBoundaryNotification: () => this.notificationManager.showReachedLastChange(),
        openTargetFile: (file: any, session: any) => 
          this.crossFileNavigator.openFileAndNavigateToFirstChange(file, true, session),
        
        // Has-changes file navigation
        getNextFile: (editor: vscode.TextEditor) => {
          const source = EditorModeDetector.getFileSource(editor, this.crossFileNavigator.getEditorTracker());
          return this.sourceControlQuery.getNextModifiedFile(editor.document.uri, source);
        },
        openFile: (file: any, sessionMode: boolean, session: any) => 
          this.crossFileNavigator.openFileAndNavigateToFirstChange(file, sessionMode, session)
      },
      previous: {
        // No-changes file navigation
        checkBoundary: async (editor: vscode.TextEditor) => {
          const result = await this.boundaryDetector.checkAndExecutePrevious(editor);
          return result.isAtFirst;
        },
        getPendingJump: (editorOrUri: vscode.TextEditor | vscode.Uri) => this.stateManager.getPendingPreviousFileJump(editorOrUri),
        setPendingJump: (editorOrUri: vscode.TextEditor | vscode.Uri) => this.stateManager.setPendingPreviousFileJump(editorOrUri, true, false),
        getTargetFile: (editor: vscode.TextEditor) => this.sourceControlQuery.getLastModifiedFile(editor.document.uri),
        showBoundaryNotification: () => this.notificationManager.showReachedFirstChange(),
        openTargetFile: (file: any, session: any) => 
          this.crossFileNavigator.openFileAndNavigateToLastChange(file, true, session),
        
        // Has-changes file navigation
        getNextFile: (editor: vscode.TextEditor) => {
          const source = EditorModeDetector.getFileSource(editor, this.crossFileNavigator.getEditorTracker());
          return this.sourceControlQuery.getPreviousModifiedFile(editor.document.uri, source);
        },
        openFile: (file: any, sessionMode: boolean, session: any) => 
          this.crossFileNavigator.openFileAndNavigateToLastChange(file, sessionMode, session)
      }
    };
  }

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

  private ignorePendingCheck(): boolean {
    const config = this.configurationManager.getConfig();
    return config.skipPendingCheck;
  }

  /**
   * Handle navigation in files with no changes
   * Offers to jump to first/last changed file when at boundary
   */
  private async handleNoChangesFileNavigation(
    editor: vscode.TextEditor, 
    direction: 'next' | 'previous'
  ): Promise<void> {
    const strategy = this.navigationStrategies[direction];
    const isAtBoundary = await strategy.checkBoundary(editor);
    
    if (!isAtBoundary) {
      // Not at boundary, reset pending
      this.stateManager.resetPendingStates(editor);
      return;
    }

    // At boundary - check if pending jump exists
    const pendingJump = this.ignorePendingCheck() || strategy.getPendingJump(editor);
    
    if (pendingJump) {
      // Second click - jump to first/last changed file
      await this.handleJumpToTargetFile(editor, direction, strategy);
    } else {
      // First click - show notification
      await this.handleFirstBoundaryClick(editor, strategy);
    }
  }

  /**
   * Handle jumping to target file (second click at boundary)
   */
  private async handleJumpToTargetFile(
    editor: vscode.TextEditor,
    direction: 'next' | 'previous',
    strategy: any
  ): Promise<void> {
    this.notificationManager.closeCurrentProgress();
    this.stateManager.resetPendingStates(editor);
    
    const targetFile = await strategy.getTargetFile(editor);
    if (!targetFile) {
      await this.notificationManager.showNoModifiedFiles();
      return;
    }
    
    // Create session first with the new file URI
    // Use compare mode for jumping from no-changes file
    const newSession = this.stateManager.getOrCreateSession(
      editor, 
      direction, 
      'compare'
    );
    
    if (!newSession) {
      return;
    }
    
    // Open the file and pass session to inherit
    await strategy.openTargetFile(targetFile, newSession);
  }

  /**
   * Handle first click at boundary (show notification)
   */
  private async handleFirstBoundaryClick(
    editor: vscode.TextEditor,
    strategy: any
  ): Promise<void> {
    strategy.setPendingJump(editor);
    
    const shouldShow = this.stateManager.shouldShowBoundaryNotification(this.notificationMode);
    this.notificationManager.setShouldShow(shouldShow);
    
    const cancelled = await strategy.showBoundaryNotification();
    
    if (cancelled) {
      this.stateManager.resetPendingStates(editor);
    }
    
    if (this.notificationMode === 'smart' && shouldShow) {
      this.stateManager.incrementNotificationCount();
    }
  }

  private async handleNextChange(): Promise<void> {
    await this.handleChangeNavigation('next');
  }

  private async handlePreviousChange(): Promise<void> {
    await this.handleChangeNavigation('previous');
  }

  /**
   * Handle navigation when there's no active editor
   * Try to open the first/last available file with changes
   * @param direction Navigation direction
   * @param currentUri Optional URI of the current active tab (if available)
   */
  private async handleNoEditorNavigation(direction: 'next' | 'previous', currentUri?: vscode.Uri): Promise<void> {
    const strategy = this.navigationStrategies[direction];
    
    // If we have a current URI, try to get next/previous file relative to it
    if (currentUri) {
      // Check if there's a pending jump for this URI
      const pendingJump = this.ignorePendingCheck() || strategy.getPendingJump(currentUri);
      
      if (pendingJump) {
        // Second navigation - jump to next/previous file
        this.stateManager.resetPendingStates(currentUri);
        
        // Detect source from URI and active tab
        const source = EditorModeDetector.getFileSourceFromUri(currentUri);
        const nextFile = direction === 'next' 
          ? await this.sourceControlQuery.getNextModifiedFile(currentUri, source)
          : await this.sourceControlQuery.getPreviousModifiedFile(currentUri, source);
        
        if (nextFile) {
          await strategy.openFile(nextFile, true, null);
          return;
        }
        // If no next/previous file found, show no files notification
        await this.notificationManager.showNoModifiedFiles();
      } else {
        // First navigation - set pending and show notification
        strategy.setPendingJump(currentUri);
        const shouldShow = this.stateManager.shouldShowBoundaryNotification(this.notificationMode);
        this.notificationManager.setShouldShow(shouldShow);
        await strategy.showBoundaryNotification();
        
        if (this.notificationMode === 'smart' && shouldShow) {
          this.stateManager.incrementNotificationCount();
        }
      }
    } 
  }

  /**
   * Unified handler for change navigation (next/previous)
   */
  private async handleChangeNavigation(direction: 'next' | 'previous'): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      // No active text editor - try to get URI from active tab
      const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
      const tabUri = activeTab?.input instanceof Object && 'uri' in activeTab.input 
        ? (activeTab.input as any).uri 
        : undefined;
      
      // Try to jump to next/previous file directly
      await this.handleNoEditorNavigation(direction, tabUri);
      return;
    }

    // Close any reviewed notification when user navigates
    this.notificationManager.closeReviewedNotification();

    const fileUri = editor.document.uri.toString();
    
    // Check if file has actual changes
    const hasChanges = await this.sourceControlQuery.fileHasChanges(editor.document.uri);
    
    if (!hasChanges) {
      // File has no changes - handle separately
      await this.handleNoChangesFileNavigation(editor, direction);
      return;
    }

    // File has changes - get or create session
    const editorMode = EditorModeDetector.isInCompareMode(editor) ? 'compare' : 'normal';
    const session = this.stateManager.getOrCreateSession(editor, direction, editorMode);
    
    if (!session) {
      return;
    }

    const strategy = this.navigationStrategies[direction];
    const isAtBoundary = await strategy.checkBoundary(editor);
    
    if (!isAtBoundary) {
      // Successfully moved to change, reset pending state
      this.stateManager.resetPendingStates(editor);
      return;
    }

    // At boundary - check if this is start file and mark it reviewed
    await this.handleStartFileReview(session, fileUri, direction);

    // Check pending state
    const pendingJump = this.ignorePendingCheck() || strategy.getPendingJump(editor);
    
    if (pendingJump) {
      // Second click at boundary - jump to next/previous file
      await this.handleJumpToNextFile(editor, session, direction, strategy);
    } else {
      // First click at boundary - show notification
      await this.handleFirstBoundaryNotification(editor, strategy);
    }
  }

  /**
   * Handle start file review marking
   */
  private async handleStartFileReview(
    session: any,
    fileUri: string,
    direction: 'next' | 'previous'
  ): Promise<void> {
    if (!this.stateManager.isStartFile(session.sessionId, fileUri)) {
      return;
    }

    const currentDirection = session.direction;
    if (currentDirection === direction) {
      this.stateManager.markStartFileReviewed(session.sessionId);
    } else {
      // Direction changed and reached boundary at start file - update session direction
      this.stateManager.updateSessionDirection(session.sessionId, direction);
      this.stateManager.markStartFileReviewed(session.sessionId);
    }
  }

  /**
   * Handle jumping to next/previous file (second click at boundary)
   */
  private async handleJumpToNextFile(
    editor: vscode.TextEditor,
    session: any,
    direction: 'next' | 'previous',
    strategy: any
  ): Promise<void> {
    // Close previous progress notification
    this.notificationManager.closeCurrentProgress();
    
    // Use session's editor mode to maintain consistency throughout the session
    const sessionMode = session.editorMode === 'compare';
    this.stateManager.resetPendingStates(editor);
    
    const nextFile = await strategy.getNextFile(editor);
    if (!nextFile) {
      await this.notificationManager.showNoModifiedFiles();
      return;
    }

    // Pass session to inherit it in the newly opened file
    await strategy.openFile(nextFile, sessionMode, session);
    
    // After jumping, check if we completed a loop
    await this.checkLoopCompletion(direction);
  }

  /**
   * Check if navigation completed a loop
   */
  private async checkLoopCompletion(direction: 'next' | 'previous'): Promise<void> {
    const newEditor = vscode.window.activeTextEditor;
    const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
    let newFileUri: string;
    let newSession: LoopModeState | null;
    
    if (newEditor) {
      // Has editor - use it directly
      newFileUri = newEditor.document.uri.toString();
      newSession = this.stateManager.getSessionForEditor(newEditor);
    } else {
      // No editor - try to get from active tab
      const tabUri = activeTab?.input instanceof Object && 'uri' in activeTab.input 
        ? (activeTab.input as any).uri 
        : undefined;
      
      if (!tabUri) {
        return;
      }
      
      newFileUri = tabUri.toString();
      newSession = this.stateManager.getSessionForUri(tabUri);
    }
    
    // Loop complete only if: returned to start file AND direction matches AND start file was reviewed
    if (newSession && 
        this.stateManager.isStartFile(newSession.sessionId, newFileUri) && 
        newSession.direction === direction &&
        this.stateManager.hasReviewedStartFile(newSession.sessionId)) {
      await this.notificationManager.showAlreadyReviewed();
      // Clean up: clear session and editor tracking
      if (newEditor) {
        this.stateManager.clearSession(newEditor);
      } else if (activeTab?.input instanceof Object && 'uri' in activeTab.input) {
        const tabUri = (activeTab.input as any).uri;
        this.stateManager.clearSession(tabUri);
      }
    }
  }

  /**
   * Handle first click at boundary (show notification)
   */
  private async handleFirstBoundaryNotification(
    editor: vscode.TextEditor,
    strategy: any
  ): Promise<void> {
    // Set pending state
    strategy.setPendingJump(editor);
    
    // Check if should show notification based on mode
    const shouldShow = this.stateManager.shouldShowBoundaryNotification(this.notificationMode);
    this.notificationManager.setShouldShow(shouldShow);
    const cancelled = await strategy.showBoundaryNotification();
    
    // If user cancelled, clear pending state
    if (cancelled) {
      this.stateManager.resetPendingStates(editor);
    }
    
    // Increment counter for smart mode
    if (this.notificationMode === 'smart' && shouldShow) {
      this.stateManager.incrementNotificationCount();
    }
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
