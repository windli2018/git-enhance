import * as vscode from 'vscode';

/**
 * File with its source (workingTree or index or merge)
 */
export interface FileWithSource {
  uri: vscode.Uri;
  source: 'workingTree' | 'index' | 'merge';
  resourceState?: any;  // Original Resource State object from Git API
}

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

  /**
   * Merge workingTreeChanges, indexChanges, and mergeChanges from repository state
   * Following the same order as Git extension's getSCMResource:
   * workingTreeGroup -> indexGroup -> mergeGroup
   * 
   * Note: We use the public API (repo.state.workingTreeChanges) which returns Change[] (ApiChange[]).
   * Since git.openChange expects Resource instances (which we cannot construct),
   * we will pass URIs instead, and git.openChange will use getSCMResource to find the Resource.
   * 
   * DO NOT remove duplicates - same file can exist in multiple sources with different states
   */
  private mergeChangeLists(workingTreeChanges: any[], indexChanges: any[], mergeChanges: any[]): FileWithSource[] {
    const result: FileWithSource[] = [];

    // Step 1: Add all files from workingTreeChanges
    for (const change of workingTreeChanges) {
      if (change.uri) {
        result.push({
          uri: change.uri,
          source: 'workingTree',
          resourceState: change  // Keep Change object for reference
        });
      }
    }

    // Step 2: Add all files from indexChanges (NO deduplication)
    for (const change of indexChanges) {
      if (change.uri) {
        result.push({
          uri: change.uri,
          source: 'index',
          resourceState: change  // Keep Change object for reference
        });
      }
    }

    // Step 3: Add all files from mergeChanges (NO deduplication)
    for (const change of mergeChanges) {
      if (change.uri) {
        result.push({
          uri: change.uri,
          source: 'merge',
          resourceState: change  // Keep Change object for reference
        });
      }
    }

    return result;
  }

  /**
   * Get next modified file after current file
   * @param currentFile Current file URI
   * @param currentSource Source of current file ('workingTree' | 'index' | 'merge')
   */
  public async getNextModifiedFile(currentFile: vscode.Uri, currentSource: 'workingTree' | 'index' | 'merge'): Promise<FileWithSource | undefined> {
    const repo = await this.getRepositoryForFile(currentFile);
    if (!repo) {
      return undefined;
    }

    const mergedFiles = this.mergeChangeLists(
      repo.state.workingTreeChanges || [],
      repo.state.indexChanges || [],
      repo.state.mergeChanges || []
    );

    if (mergedFiles.length === 0) {
      return undefined;
    }

    // Find current file index by matching both fsPath and source
    const currentPath = currentFile.fsPath;
    const currentIndex = mergedFiles.findIndex(f => 
      f.uri.fsPath === currentPath && f.source === currentSource
    );

    if (currentIndex === -1) {
      // Current file not found, return first file
      return mergedFiles[0];
    }

    // Return next file, loop to first if at end
    const nextIndex = (currentIndex + 1) % mergedFiles.length;
    return mergedFiles[nextIndex];
  }

  /**
   * Get previous modified file before current file
   * @param currentFile Current file URI
   * @param currentSource Source of current file ('workingTree' | 'index' | 'merge')
   */
  public async getPreviousModifiedFile(currentFile: vscode.Uri, currentSource: 'workingTree' | 'index' | 'merge'): Promise<FileWithSource | undefined> {
    const repo = await this.getRepositoryForFile(currentFile);
    if (!repo) {
      return undefined;
    }

    const mergedFiles = this.mergeChangeLists(
      repo.state.workingTreeChanges || [],
      repo.state.indexChanges || [],
      repo.state.mergeChanges || []
    );

    if (mergedFiles.length === 0) {
      return undefined;
    }

    // Find current file index by matching both fsPath and source
    const currentPath = currentFile.fsPath;
    const currentIndex = mergedFiles.findIndex(f => 
      f.uri.fsPath === currentPath && f.source === currentSource
    );

    if (currentIndex === -1) {
      // Current file not found, return last file
      return mergedFiles[mergedFiles.length - 1];
    }

    // Return previous file, loop to last if at beginning
    const prevIndex = currentIndex === 0 ? mergedFiles.length - 1 : currentIndex - 1;
    return mergedFiles[prevIndex];
  }

  /**
   * Get first modified file
   */
  public async getFirstModifiedFile(fileUri: vscode.Uri): Promise<FileWithSource | undefined> {
    const repo = await this.getRepositoryForFile(fileUri);
    if (!repo) {
      return undefined;
    }

    const mergedFiles = this.mergeChangeLists(
      repo.state.workingTreeChanges || [],
      repo.state.indexChanges || [],
      repo.state.mergeChanges || []
    );

    return mergedFiles.length > 0 ? mergedFiles[0] : undefined;
  }

  /**
   * Get last modified file
   */
  public async getLastModifiedFile(fileUri: vscode.Uri): Promise<FileWithSource | undefined> {
    const repo = await this.getRepositoryForFile(fileUri);
    if (!repo) {
      return undefined;
    }

    const mergedFiles = this.mergeChangeLists(
      repo.state.workingTreeChanges || [],
      repo.state.indexChanges || [],
      repo.state.mergeChanges || []
    );

    return mergedFiles.length > 0 ? mergedFiles[mergedFiles.length - 1] : undefined;
  }

  /**
   * Get repository for a given file URI
   */
  public async getRepositoryForFile(fileUri: vscode.Uri): Promise<any | undefined> {
    await this.ensureGitExtension();

    if (!this.gitExtension) {
      return undefined;
    }

    const git = this.gitExtension.getAPI(1);
    if (!git || !git.repositories || git.repositories.length === 0) {
      return undefined;
    }

    // Find repository containing this file
    for (const repo of git.repositories) {
      const repoPath = repo.rootUri.fsPath;
      if (fileUri.fsPath.startsWith(repoPath)) {
        return repo;
      }
    }

    return undefined;
  }

  /**
   * Get modified files from the same repository as the given file
   */
  public async getModifiedFilesInSameRepo(fileUri: vscode.Uri): Promise<FileWithSource[]> {
    const repo = await this.getRepositoryForFile(fileUri);
    if (!repo) {
      return [];
    }

    return this.mergeChangeLists(
      repo.state.workingTreeChanges || [],
      repo.state.indexChanges || [],
      repo.state.mergeChanges || []
    );
  }

  /**
   * Check if file has actual diff changes
   */
  public async fileHasChanges(fileUri: vscode.Uri): Promise<boolean> {
    await this.ensureGitExtension();

    if (!this.gitExtension) {
      return false;
    }

    const git = this.gitExtension.getAPI(1);
    if (!git) {
      return false;
    }

    const repo = await this.getRepositoryForFile(fileUri);
    if (!repo) {
      return false;
    }

    // Use fsPath for comparison to avoid URI query parameter issues
    const filePath = fileUri.fsPath;
    
    // Check all change types: workingTree, index, and merge
    return (repo.state.workingTreeChanges || []).some((change: any) => change.uri && change.uri.fsPath === filePath) ||
           (repo.state.indexChanges || []).some((change: any) => change.uri && change.uri.fsPath === filePath) ||
           (repo.state.mergeChanges || []).some((change: any) => change.uri && change.uri.fsPath === filePath);
  }

}
