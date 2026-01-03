import * as vscode from 'vscode';

export interface FeatureConfig {
  enabled: boolean;
  notificationDuration: number;
  enableLoopAcrossAllFiles: boolean;
  maxOpenEditors: number;
  notificationMode: 'smart' | 'always' | 'never';
}

export class ConfigurationManager {
  private static readonly CONFIG_SECTION = 'gitEnhance.crossFileNavigation';
  private configChangeListeners: ((config: FeatureConfig) => void)[] = [];

  constructor() {
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
        this.notifyConfigChange();
      }
    });
  }

  public getConfig(): FeatureConfig {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
    
    return {
      enabled: config.get<boolean>('enabled', true),
      notificationDuration: config.get<number>('notificationDuration', 4000),
      enableLoopAcrossAllFiles: config.get<boolean>('enableLoopAcrossAllFiles', true),
      maxOpenEditors: config.get<number>('maxOpenEditors', 5),
      notificationMode: config.get<'smart' | 'always' | 'never'>('notificationMode', 'smart')
    };
  }

  public onConfigChange(listener: (config: FeatureConfig) => void): vscode.Disposable {
    this.configChangeListeners.push(listener);
    
    return new vscode.Disposable(() => {
      const index = this.configChangeListeners.indexOf(listener);
      if (index !== -1) {
        this.configChangeListeners.splice(index, 1);
      }
    });
  }

  private notifyConfigChange(): void {
    const config = this.getConfig();
    this.configChangeListeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
      }
    });
  }

  public isFeatureEnabled(): boolean {
    return this.getConfig().enabled;
  }
}
