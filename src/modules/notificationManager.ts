import * as vscode from 'vscode';
import { I18nProvider } from './i18nProvider';

export class NotificationManager {
  private notificationDurationMs: number = 3000;
  private shouldShow: boolean = true;
  private currentProgressCancellation?: vscode.CancellationTokenSource;
  private reviewedNotificationCancellation?: vscode.CancellationTokenSource;

  constructor(
    private i18nProvider: I18nProvider,
    notificationDurationMs?: number
  ) {
    if (notificationDurationMs) {
      this.notificationDurationMs = notificationDurationMs;
    }
  }

  /**
   * Set whether notifications should be shown
   * Called by CommandHandler based on notificationMode
   */
  public setShouldShow(shouldShow: boolean): void {
    this.shouldShow = shouldShow;
  }

  /**
   * Close current progress notification if any
   */
  public closeCurrentProgress(): void {
    if (this.currentProgressCancellation) {
      this.currentProgressCancellation.cancel();
      this.currentProgressCancellation.dispose();
      this.currentProgressCancellation = undefined;
    }
  }

  /**
   * Close reviewed notification if any
   */
  public closeReviewedNotification(): void {
    if (this.reviewedNotificationCancellation) {
      this.reviewedNotificationCancellation.cancel();
      this.reviewedNotificationCancellation.dispose();
      this.reviewedNotificationCancellation = undefined;
    }
  }

  public async showReachedLastChange(): Promise<boolean> {
    if (!this.shouldShow) {
      return false;
    }
    const message = this.i18nProvider.getMessage('reachedLastChange');
    return await this.showProgressNotification(message);
  }

  public async showReachedFirstChange(): Promise<boolean> {
    if (!this.shouldShow) {
      return false;
    }
    const message = this.i18nProvider.getMessage('reachedFirstChange');
    return await this.showProgressNotification(message);
  }

  public async showNoModifiedFiles(): Promise<void> {
    const message = this.i18nProvider.getMessage('noModifiedFiles');
    await this.showNotification(message);
  }

  public async showNoChangesInFile(): Promise<void> {
    const message = this.i18nProvider.getMessage('noChangesInFile');
    await this.showNotification(message);
  }

  public async showAlreadyReviewed(): Promise<void> {
    const message = this.i18nProvider.getMessage('alreadyReviewed');
    
    // Close any existing reviewed notification
    this.closeReviewedNotification();
    
    // Create new cancellation token for this notification
    this.reviewedNotificationCancellation = new vscode.CancellationTokenSource();
    const cancellationToken = this.reviewedNotificationCancellation.token;
    
    await this.showProgressNotificationComplete(message, cancellationToken);
    
    // Clear the cancellation token after completion
    this.reviewedNotificationCancellation = undefined;
  }

  private async showNotification(message: string): Promise<void> {
    // Show information message - highly visible, can be dismissed by:
    // 1. Clicking X button
    // 2. Clicking outside the message
    // 3. Pressing ESC key
    vscode.window.showInformationMessage(message);
  }

  private async showProgressNotificationComplete(message: string, cancellationToken?: vscode.CancellationToken): Promise<void> {
    // Show progress notification at 100% completion
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: message,
        cancellable: false
      },
      async (progress) => {
        // Show 100% completion
        progress.report({ increment: 100 });
        
        // Wait for 5 seconds or cancellation
        if (cancellationToken) {
          await Promise.race([
            new Promise(resolve => setTimeout(resolve, 5000)),
            new Promise<void>((resolve) => {
              cancellationToken.onCancellationRequested(() => resolve());
            })
          ]);
        } else {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    );
  }

  private async showProgressNotification(message: string): Promise<boolean> {
    // Close previous progress notification if any
    this.closeCurrentProgress();

    // Create new cancellation token
    this.currentProgressCancellation = new vscode.CancellationTokenSource();
    const cancellationToken = this.currentProgressCancellation.token;

    return new Promise<boolean>((resolve) => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: message,
          cancellable: true
        },
        async (progress, token) => {
          // Show initial progress
          progress.report({ increment: 0 });

          // Handle cancellation from both sources
          const cancelPromise = new Promise<boolean>((resolveCancelled) => {
            token.onCancellationRequested(() => {
              resolveCancelled(true); // User clicked cancel
            });
            cancellationToken.onCancellationRequested(() => {
              resolveCancelled(true); // Programmatic cancellation
            });
          });

          // Wait for timeout or cancellation
          const cancelled = await Promise.race([
            cancelPromise,
            new Promise<boolean>(resolve => {
              setTimeout(() => resolve(false), this.notificationDurationMs);
            })
          ]);

          if (cancelled) {
            this.currentProgressCancellation = undefined;
            resolve(true); // Clear pending state
            return;
          }

          // Show 100% completion and auto-dismiss
          progress.report({ increment: 100 });
          await new Promise(r => setTimeout(r, 100));

          this.currentProgressCancellation = undefined;
          resolve(false); // Normal completion, don't clear state
        }
      );
    });
  }
}
