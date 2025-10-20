import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { renderer } from '../ui/renderer';

export interface FileArtifact {
  filePath: string;
  content: string;
  language?: string;
  action: 'create' | 'update';
  complete?: boolean; // Whether the code block is closed
  contentHash?: string; // Hash to detect changes
}

export class ArtifactParser {
  /**
   * Parse AI response for file artifacts in code blocks
   * Format: ```language path/to/file.ext
   */
  parseArtifacts(response: string): FileArtifact[] {
    const artifacts: FileArtifact[] = [];

    // Use debug instead of info to reduce noise during streaming
    logger.debug('Parsing response for artifacts...');
    logger.debug(`Response length: ${response.length} chars`);

    // Split response by ``` markers to properly handle nested backticks
    const blocks = this.extractCodeBlocks(response);

    logger.debug(`Found ${blocks.length} code block(s)`);

    for (const block of blocks) {
      // Check if block header contains a file path
      const headerMatch = block.header.match(/^(\w+)?\s*([^\s]+\.(ts|js|tsx|jsx|py|java|cpp|c|h|css|html|json|md|txt|sh|yml|yaml|xml|go|rs|rb|php|sql|env))$/i);

      if (headerMatch) {
        const language = headerMatch[1];
        const filePath = headerMatch[2].trim();
        const content = block.content;

        // Skip if it looks like a tool-call block
        if (content.includes('Tool:') && content.includes('Parameters:')) {
          logger.debug(`Skipping tool-call block: ${filePath}`);
          continue;
        }

        // Determine if file exists
        const resolvedPath = path.resolve(filePath);
        const action = fs.existsSync(resolvedPath) ? 'update' : 'create';

        // Create a simple hash based on file path and content length
        const contentHash = `${filePath}:${content.length}`;

        // Use debug for all artifact detection - streaming executor will log when queued
        logger.debug(`Found ${block.complete ? 'complete' : 'incomplete'} artifact: ${filePath} (${content.length} chars)`);

        artifacts.push({
          filePath,
          content,
          language,
          action,
          complete: block.complete,
          contentHash,
        });
      }
    }

    // Debug logging only
    const completeCount = artifacts.filter(a => a.complete).length;
    logger.debug(`Parsed ${artifacts.length} artifact(s) (${completeCount} complete)`);
    return artifacts;
  }

  /**
   * Extract code blocks from response by properly handling ``` markers
   */
  private extractCodeBlocks(response: string): Array<{ header: string; content: string; complete: boolean }> {
    const blocks: Array<{ header: string; content: string; complete: boolean }> = [];
    const lines = response.split('\n');

    let inBlock = false;
    let currentHeader = '';
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (!inBlock) {
          // Opening block
          inBlock = true;
          currentHeader = line.substring(3).trim();
          currentContent = [];
        } else {
          // Closing block
          inBlock = false;
          blocks.push({
            header: currentHeader,
            content: currentContent.join('\n'),
            complete: true, // Block is closed
          });
          currentHeader = '';
          currentContent = [];
        }
      } else if (inBlock) {
        currentContent.push(line);
      }
    }

    // Handle unclosed block - mark as incomplete
    if (inBlock && currentContent.length > 0) {
      // Use debug instead of warn to reduce noise during streaming
      logger.debug('Found unclosed code block - streaming in progress');
      blocks.push({
        header: currentHeader,
        content: currentContent.join('\n'),
        complete: false, // Block is still open
      });
    }

    return blocks;
  }

  /**
   * Write artifacts to disk
   */
  async writeArtifacts(artifacts: FileArtifact[]): Promise<{ success: boolean; written: number; errors: string[] }> {
    const errors: string[] = [];
    let written = 0;

    for (const artifact of artifacts) {
      try {
        const resolvedPath = path.resolve(artifact.filePath);
        const dir = path.dirname(resolvedPath);

        // Create directory if needed
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          logger.info(`Created directory: ${dir}`);
        }

        // Write file
        fs.writeFileSync(resolvedPath, artifact.content, 'utf-8');

        const lines = artifact.content.split('\n').length;
        const sizeKB = (Buffer.byteLength(artifact.content, 'utf-8') / 1024).toFixed(2);

        console.log(renderer.renderSuccess(
          `${artifact.action === 'create' ? '📄 Created' : '✏️  Updated'} ${artifact.filePath} (${lines} lines, ${sizeKB} KB)`
        ));

        logger.tool('ArtifactParser', `Wrote ${artifact.filePath}`);
        written++;
      } catch (error: any) {
        const errorMsg = `Failed to write ${artifact.filePath}: ${error.message}`;
        errors.push(errorMsg);
        console.log(renderer.renderError(errorMsg));
        logger.error('ArtifactParser', errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      written,
      errors,
    };
  }

  /**
   * Stream-based artifact detection
   * Call this incrementally as response chunks come in
   */
  detectPartialArtifacts(partialResponse: string): {
    hasArtifacts: boolean;
    incompleteBlock: boolean;
  } {
    // Check if there are code blocks with file paths
    const hasFileBlock = /```(?:\w+\s+)?(?:filepath:)?[^\n]+?\.(ts|js|tsx|jsx|py|java|cpp|c|h|css|html|json|md|txt|sh|yml|yaml|xml|go|rs|rb|php|sql|env)/i.test(partialResponse);

    // Check if the last code block is incomplete (no closing ```)
    const openBlocks = (partialResponse.match(/```/g) || []).length;
    const incompleteBlock = openBlocks % 2 !== 0;

    return {
      hasArtifacts: hasFileBlock,
      incompleteBlock,
    };
  }

  /**
   * Extract text without artifacts (for display)
   */
  extractTextWithoutArtifacts(response: string): string {
    // Remove file artifact blocks but keep other text and code blocks
    return response.replace(
      /```(?:\w+\s+)?(?:filepath:)?([^\n]+?\.(ts|js|tsx|jsx|py|java|cpp|c|h|css|html|json|md|txt|sh|yml|yaml|xml|go|rs|rb|php|sql|env))\n([\s\S]*?)```/gi,
      (match, filepath) => {
        // Replace with a placeholder
        return `[File: ${filepath}]`;
      }
    );
  }
}

export const artifactParser = new ArtifactParser();
