/**
 * Path comparison utilities for natural sorting
 * Inspired by VS Code's sorting behavior for SCM resources
 */

/**
 * Collator instance for efficient natural numeric sorting
 * Reused across multiple comparisons for better performance
 */
const numericCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

/**
 * Detect the path separator used in a given path
 * @param path File path string
 * @returns The separator character ('\\' for Windows, '/' for Unix)
 */
function getPathSeparator(path: string): string {
  return path.includes('\\') ? '\\' : '/';
}

/**
 * Compare two path components (directory or file names)
 * Performs case-insensitive lexicographic comparison
 * 
 * @param first First path component
 * @param second Second path component
 * @returns -1 if first < second, 1 if first > second, 0 if equal
 */
function comparePathSegments(first: string, second: string): number {
  const firstLower = first.toLowerCase();
  const secondLower = second.toLowerCase();
  
  if (firstLower === secondLower) {
    return 0;
  }
  
  return firstLower < secondLower ? -1 : 1;
}

/**
 * Compare two file names with natural numeric sorting
 * Examples: file1.txt < file2.txt < file10.txt (not file1 < file10 < file2)
 * 
 * @param first First filename
 * @param second Second filename
 * @returns -1 if first < second, 1 if first > second, 0 if equal
 */
function compareFileNames(first: string, second: string): number {
  const a = first || '';
  const b = second || '';
  
  const comparisonResult = numericCollator.compare(a, b);
  
  // Handle edge case: numeric collation may treat "foo1" and "foo01" as equal
  // In this case, prefer the shorter string
  if (comparisonResult === 0 && a !== b) {
    return a.length < b.length ? -1 : 1;
  }
  
  return comparisonResult;
}

/**
 * Compare two file paths hierarchically
 * Compares each path segment from root to leaf:
 * - Directory names are compared case-insensitively
 * - File names use natural numeric sorting
 * - Shorter paths (parents) sort before longer paths (children)
 * 
 * @param firstPath First file path
 * @param secondPath Second file path
 * @returns -1 if firstPath < secondPath, 1 if firstPath > secondPath, 0 if equal
 * 
 * @example
 * ```typescript
 * comparePaths('folder/file1.txt', 'folder/file2.txt')  // -1
 * comparePaths('folder/file2.txt', 'folder/file10.txt') // -1 (natural sort)
 * comparePaths('folder', 'folder/subfolder')            // -1 (parent before child)
 * ```
 */
export function comparePaths(firstPath: string, secondPath: string): number {
  // Determine path separator and split into segments
  const separator = getPathSeparator(firstPath);
  const firstSegments = firstPath.split(separator);
  const secondSegments = secondPath.split(separator);
  
  const firstLastIndex = firstSegments.length - 1;
  const secondLastIndex = secondSegments.length - 1;
  
  // Compare segment by segment
  for (let index = 0; ; index++) {
    const firstAtEnd = firstLastIndex === index;
    const secondAtEnd = secondLastIndex === index;
    
    // Both paths at their final segment (filename)
    if (firstAtEnd && secondAtEnd) {
      return compareFileNames(firstSegments[index], secondSegments[index]);
    }
    
    // First path is shorter (parent directory)
    if (firstAtEnd) {
      return -1;
    }
    
    // Second path is shorter (parent directory)
    if (secondAtEnd) {
      return 1;
    }
    
    // Compare current directory segments
    const segmentComparison = comparePathSegments(
      firstSegments[index],
      secondSegments[index]
    );
    
    if (segmentComparison !== 0) {
      return segmentComparison;
    }
    
    // Segments are equal, continue to next level
  }
}

/**
 * Create a comparator function for sorting file URIs
 * Useful for Array.sort() on VS Code URI objects
 * 
 * @returns Comparator function that accepts two URIs
 * 
 * @example
 * ```typescript
 * import * as vscode from 'vscode';
 * import { createUriComparator } from './pathComparers';
 * 
 * const files: vscode.Uri[] = [...];
 * files.sort(createUriComparator());
 * ```
 */
export function createUriComparator() {
  return (firstUri: { fsPath: string }, secondUri: { fsPath: string }): number => {
    return comparePaths(firstUri.fsPath, secondUri.fsPath);
  };
}
