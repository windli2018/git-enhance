import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { I18nMessages } from '../types/i18n';

export class I18nProvider {
  private messages: I18nMessages;
  private readonly defaultLocale = 'en';

  constructor(private context: vscode.ExtensionContext) {
    this.messages = this.loadMessages();
  }

  private loadMessages(): I18nMessages {
    const locale = this.getCurrentLocale();
    const i18nPath = path.join(this.context.extensionPath, 'i18n', `${locale}.json`);
    
    try {
      if (fs.existsSync(i18nPath)) {
        const content = fs.readFileSync(i18nPath, 'utf-8');
        return JSON.parse(content) as I18nMessages;
      }
    } catch (error) {
    }

    // Fallback to default locale
    const defaultPath = path.join(this.context.extensionPath, 'i18n', `${this.defaultLocale}.json`);
    try {
      const content = fs.readFileSync(defaultPath, 'utf-8');
      return JSON.parse(content) as I18nMessages;
    } catch (error) {
      // Return empty messages as last resort
      return {
        reachedLastChange: 'Reached last change',
        reachedFirstChange: 'Reached first change',
        noModifiedFiles: 'No modified files',
        noChangesInFile: 'No changes',
        alreadyReviewed: 'Already reviewed'
      };
    }
  }

  private getCurrentLocale(): string {
    const vscodeLocale = vscode.env.language;
    
    // Map VS Code locale to our supported locales
    if (vscodeLocale.startsWith('zh-cn') || vscodeLocale.startsWith('zh-CN')) {
      return 'zh-cn';
    } else if (vscodeLocale.startsWith('zh-tw') || vscodeLocale.startsWith('zh-TW')) {
      return 'zh-tw';
    }
    
    return this.defaultLocale;
  }

  public getMessage(key: keyof I18nMessages): string {
    return this.messages[key] || key;
  }

  public getAllMessages(): I18nMessages {
    return { ...this.messages };
  }
}
