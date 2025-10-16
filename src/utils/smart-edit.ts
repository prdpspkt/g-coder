import * as fs from 'fs';
import { logger } from './logger';

export interface EditResult {
  success: boolean;
  content?: string;
  linesChanged?: number;
  startLine?: number;
  endLine?: number;
  error?: string;
  strategy?: string;
}

/**
 * Smart editing utility that finds and modifies code intelligently
 */
export class SmartEdit {
  /**
   * Perform an intelligent edit on file content
   * Tries multiple strategies to find the best match
   */
  static edit(
    content: string,
    searchPattern: string,
    replacement: string,
    options: {
      replaceAll?: boolean;
      lineNumber?: number;
      contextLines?: number;
      fuzzyMatch?: boolean;
    } = {}
  ): EditResult {
    const lines = content.split('\n');

    // Strategy 1: Exact line number if provided
    if (options.lineNumber !== undefined) {
      return this.editByLineNumber(lines, options.lineNumber, searchPattern, replacement);
    }

    // Strategy 2: Exact match
    const exactResult = this.editByExactMatch(content, searchPattern, replacement, options.replaceAll);
    if (exactResult.success) {
      exactResult.strategy = 'exact-match';
      return exactResult;
    }

    // Strategy 3: Fuzzy line matching (most flexible)
    if (options.fuzzyMatch !== false) {
      const fuzzyResult = this.editByFuzzyMatch(lines, searchPattern, replacement);
      if (fuzzyResult.success) {
        fuzzyResult.strategy = 'fuzzy-match';
        return fuzzyResult;
      }
    }

    // Strategy 4: Context-based matching
    const contextResult = this.editByContext(lines, searchPattern, replacement, options.contextLines || 3);
    if (contextResult.success) {
      contextResult.strategy = 'context-match';
      return contextResult;
    }

    // Strategy 5: Partial line matching
    const partialResult = this.editByPartialMatch(lines, searchPattern, replacement);
    if (partialResult.success) {
      partialResult.strategy = 'partial-match';
      return partialResult;
    }

    return {
      success: false,
      error: 'Could not find a suitable match for editing. Try providing line numbers or more specific context.',
    };
  }

  /**
   * Strategy 1: Edit by specific line number
   */
  private static editByLineNumber(
    lines: string[],
    lineNumber: number,
    searchPattern: string,
    replacement: string
  ): EditResult {
    const lineIndex = lineNumber - 1; // Convert to 0-based index

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return {
        success: false,
        error: `Line number ${lineNumber} is out of range (file has ${lines.length} lines)`,
      };
    }

    const originalLine = lines[lineIndex];

    // If searchPattern is empty or matches, replace the whole line
    if (!searchPattern || originalLine.includes(searchPattern)) {
      lines[lineIndex] = replacement;

      return {
        success: true,
        content: lines.join('\n'),
        linesChanged: 1,
        startLine: lineNumber,
        endLine: lineNumber,
      };
    }

    return {
      success: false,
      error: `Line ${lineNumber} does not contain the search pattern`,
    };
  }

  /**
   * Strategy 2: Exact string match
   */
  private static editByExactMatch(
    content: string,
    searchPattern: string,
    replacement: string,
    replaceAll: boolean = false
  ): EditResult {
    if (!content.includes(searchPattern)) {
      return { success: false, error: 'Exact match not found' };
    }

    const occurrences = (content.match(new RegExp(this.escapeRegex(searchPattern), 'g')) || []).length;

    if (occurrences > 1 && !replaceAll) {
      return {
        success: false,
        error: `Found ${occurrences} occurrences. Set replaceAll to true or provide more specific context.`,
      };
    }

    const newContent = replaceAll
      ? content.split(searchPattern).join(replacement)
      : content.replace(searchPattern, replacement);

    return {
      success: true,
      content: newContent,
      linesChanged: occurrences,
    };
  }

  /**
   * Strategy 3: Fuzzy matching - finds similar lines
   */
  private static editByFuzzyMatch(
    lines: string[],
    searchPattern: string,
    replacement: string
  ): EditResult {
    const searchLines = searchPattern.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (searchLines.length === 0) {
      return { success: false, error: 'Empty search pattern' };
    }

    // Find best matching sequence
    let bestMatch: { index: number; score: number } | null = null;

    for (let i = 0; i <= lines.length - searchLines.length; i++) {
      const score = this.calculateMatchScore(
        lines.slice(i, i + searchLines.length),
        searchLines
      );

      if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { index: i, score };
      }
    }

    if (!bestMatch) {
      return { success: false, error: 'No fuzzy match found' };
    }

    // Replace the matched lines
    const replacementLines = replacement.split('\n');
    const startLine = bestMatch.index + 1;
    const endLine = bestMatch.index + searchLines.length;

    lines.splice(bestMatch.index, searchLines.length, ...replacementLines);

    return {
      success: true,
      content: lines.join('\n'),
      linesChanged: searchLines.length,
      startLine,
      endLine,
    };
  }

  /**
   * Strategy 4: Context-based matching
   * Looks for the pattern within a certain number of lines of unique context
   */
  private static editByContext(
    lines: string[],
    searchPattern: string,
    replacement: string,
    contextLines: number
  ): EditResult {
    const searchLines = searchPattern.split('\n');
    const targetLine = searchLines[Math.floor(searchLines.length / 2)]; // Middle line as target

    // Find all lines that match the target
    const matchingIndices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (this.similarity(lines[i].trim(), targetLine.trim()) > 0.8) {
        matchingIndices.push(i);
      }
    }

    if (matchingIndices.length === 0) {
      return { success: false, error: 'No context match found' };
    }

    // If only one match, use it
    if (matchingIndices.length === 1) {
      const index = matchingIndices[0];
      lines[index] = replacement;

      return {
        success: true,
        content: lines.join('\n'),
        linesChanged: 1,
        startLine: index + 1,
        endLine: index + 1,
      };
    }

    // Multiple matches - try to use context to disambiguate
    // For now, return error asking for more context
    return {
      success: false,
      error: `Found ${matchingIndices.length} potential matches. Provide more specific context or use line numbers.`,
    };
  }

  /**
   * Strategy 5: Partial line matching
   * Finds lines containing the search pattern and replaces just that part
   */
  private static editByPartialMatch(
    lines: string[],
    searchPattern: string,
    replacement: string
  ): EditResult {
    const matches: number[] = [];

    // Find all lines containing the pattern
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchPattern)) {
        matches.push(i);
      }
    }

    if (matches.length === 0) {
      return { success: false, error: 'No partial match found' };
    }

    if (matches.length > 1) {
      return {
        success: false,
        error: `Found ${matches.length} lines containing the pattern. Be more specific or use replaceAll.`,
      };
    }

    // Replace the pattern in the single matching line
    const index = matches[0];
    lines[index] = lines[index].replace(searchPattern, replacement);

    return {
      success: true,
      content: lines.join('\n'),
      linesChanged: 1,
      startLine: index + 1,
      endLine: index + 1,
    };
  }

  /**
   * Calculate similarity score between two sequences of lines
   */
  private static calculateMatchScore(actualLines: string[], searchLines: string[]): number {
    if (actualLines.length !== searchLines.length) {
      return 0;
    }

    let totalScore = 0;
    for (let i = 0; i < actualLines.length; i++) {
      totalScore += this.similarity(actualLines[i].trim(), searchLines[i].trim());
    }

    return totalScore / actualLines.length;
  }

  /**
   * Calculate similarity between two strings (0 to 1)
   * Uses a simple character-based similarity metric
   */
  private static similarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Levenshtein distance based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Escape special regex characters
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract line numbers from content for display
   */
  static getLinePreview(content: string, startLine: number, endLine: number, contextLines: number = 2): string {
    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1 - contextLines);
    const end = Math.min(lines.length, endLine + contextLines);

    const preview: string[] = [];
    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const marker = lineNum >= startLine && lineNum <= endLine ? '>' : ' ';
      preview.push(`${marker} ${lineNum.toString().padStart(4)} | ${lines[i]}`);
    }

    return preview.join('\n');
  }
}
