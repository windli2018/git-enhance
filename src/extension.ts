import * as vscode from 'vscode';
import { I18nProvider } from './modules/i18nProvider';
import { StateManager } from './modules/stateManager';
import { BoundaryDetector } from './modules/boundaryDetector';
import { NotificationManager } from './modules/notificationManager';
import { SourceControlQuery } from './modules/sourceControlQuery';
import { CrossFileNavigator } from './modules/crossFileNavigator';
import { CommandHandler } from './modules/commandHandler';
import { ConfigurationManager } from './modules/configurationManager';

let commandHandler: CommandHandler | undefined;
let stateManager: StateManager | undefined;
let configurationManager: ConfigurationManager;
let configDisposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {

  // Initialize configuration manager
  configurationManager = new ConfigurationManager();
  const initialConfig = configurationManager.getConfig();

  // Initialize feature based on configuration
  initializeFeature(context);

  // Listen for configuration changes
  configDisposable = configurationManager.onConfigChange((config) => {
    if (config.enabled) {
      // Feature enabled - initialize if not already
      if (!commandHandler) {
        initializeFeature(context);
      } else {
        // Update existing instances with new config
        updateFeatureConfig(config);
      }
    } else {
      // Feature disabled - clean up
      deactivateFeature();
    }
  });

  context.subscriptions.push(new vscode.Disposable(() => {
    deactivateFeature();
    if (configDisposable) {
      configDisposable.dispose();
    }
  }));

}

function initializeFeature(context: vscode.ExtensionContext): void {
  const config = configurationManager.getConfig();


  if (!config.enabled) {
    return;
  }


  // Initialize all modules
  const i18nProvider = new I18nProvider(context);
  stateManager = new StateManager(config.stateResetTimeout);
  const boundaryDetector = new BoundaryDetector();
  const notificationManager = new NotificationManager(i18nProvider, config.notificationDuration);
  const sourceControlQuery = new SourceControlQuery();
  
  const crossFileNavigator = new CrossFileNavigator(sourceControlQuery, config.enableLoopAcrossAllFiles, config.maxOpenEditors);

  // Initialize command handler
  commandHandler = new CommandHandler(
    stateManager,
    boundaryDetector,
    notificationManager,
    crossFileNavigator,
    sourceControlQuery
  );

  // Set notification mode
  commandHandler.setNotificationMode(config.notificationMode);

  // Register commands
  commandHandler.registerCommands(context);

  // Hide original diff navigation buttons via menus contribution
  // The buttons are hidden through package.json menus configuration

}

function updateFeatureConfig(config: any): void {
  // Update configuration in existing instances
  if (commandHandler) {
    commandHandler.setNotificationMode(config.notificationMode);
  }
}

function deactivateFeature(): void {

  if (commandHandler) {
    commandHandler.dispose();
    commandHandler = undefined;
  }

  if (stateManager) {
    stateManager.dispose();
    stateManager = undefined;
  }
}

export function deactivate() {
  deactivateFeature();
  if (configDisposable) {
    configDisposable.dispose();
  }
}
