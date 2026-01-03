import * as vscode from 'vscode';

export class SourceControlQuery {
  private gitExtension: any;

  private async ensureGitExtension(): Promise<void> {
    if (this.gitExtension) {
      return;
    }

    // Try to get the Git extension
    const extension = vscode.extensions.getExtension('vscode.git');
    if (extension) {
      if (!extension.isActive) {
        await extension.activate();
      }
      this.gitExtension = extension.exports;
    }
  }

  public async getModifiedFiles(): Promise<vscode.Uri[]> {
    const modifiedFiles: vscode.Uri[] = [];

    await this.ensureGitExtension();

    if (!this.gitExtension) {
      return modifiedFiles;
    }

    const git = this.gitExtension.getAPI(1);
    if (!git || !git.repositories || git.repositories.length === 0) {
      return modifiedFiles;
    }


    // Get changes from all repositories
    for (const repo of git.repositories) {
      const changes = repo.state.workingTreeChanges || [];
      const indexChanges = repo.state.indexChanges || [];
      
      // Combine working tree and index changes
      const allChanges = [...changes, ...indexChanges];
      
      for (const change of allChanges) {
        if (change.uri) {
          modifiedFiles.push(change.uri);
        }
      }
    }

    // Remove duplicates and sort by path
    const uniqueFiles = Array.from(new Set(modifiedFiles.map(uri => uri.toString())))
      .map(uriString => vscode.Uri.parse(uriString))
      .sort((a, b) => a.fsPath.localeCompare(b.fsPath));

    return uniqueFiles;
  }

  public async getFileIndex(currentFile: vscode.Uri): Promise<number> {
    const modifiedFiles = await this.getModifiedFiles();
    return modifiedFiles.findIndex(uri => uri.toString() === currentFile.toString());
  }

  public async getNextFile(currentFile: vscode.Uri, enableLoop: boolean): Promise<vscode.Uri | undefined> {
    const modifiedFiles = await this.getModifiedFiles();
    if (modifiedFiles.length === 0) {
      return undefined;
    }

    const currentIndex = modifiedFiles.findIndex(uri => uri.toString() === currentFile.toString());
    
    if (currentIndex === -1) {
      // Current file not found, return first file
      return modifiedFiles[0];
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < modifiedFiles.length) {
      return modifiedFiles[nextIndex];
    }

    // At last file, loop if enabled
    if (enableLoop && modifiedFiles.length > 0) {
      return modifiedFiles[0];
    }

    return undefined;
  }

  public async getPreviousFile(currentFile: vscode.Uri, enableLoop: boolean): Promise<vscode.Uri | undefined> {
    const modifiedFiles = await this.getModifiedFiles();
    if (modifiedFiles.length === 0) {
      return undefined;
    }

    const currentIndex = modifiedFiles.findIndex(uri => uri.toString() === currentFile.toString());
    
    if (currentIndex === -1) {
      // Current file not found, return last file
      return modifiedFiles[modifiedFiles.length - 1];
    }

    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      return modifiedFiles[prevIndex];
    }

    // At first file, loop if enabled
    if (enableLoop && modifiedFiles.length > 0) {
      return modifiedFiles[modifiedFiles.length - 1];
    }

    return undefined;
  }
}
