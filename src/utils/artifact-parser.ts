import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { renderer } from '../ui/renderer';

export interface FileArtifact {
  filePath: string;
  content: string;
  language?: string;
  action: 'create' | 'update';
}

export class ArtifactParser {
  /**
   * Parse AI response for file artifacts in code blocks
   * Format: ```filepath:path/to/file.ext or ```language filepath:path/to/file.ext
   */
  parseArtifacts(response: string): FileArtifact[] {
    const artifacts: FileArtifact[] = [];

    // Match code blocks with file paths
    // Supports: ```filepath:... or ```javascript filepath:... or ```js path/to/file.js
    const artifactRegex = /```(?:(\w+)\s+)?(?:filepath:)?([^\n]+?\.(ts|js|tsx|jsx|py|java|cpp|c|h|css|html|json|md|txt|sh|yml|yaml|xml|go|rs|rb|php|sql|env))\n([\s\S]*?)```/gi;

    let match;
    while ((match = artifactRegex.exec(response)) !== null) {
      const language = match[1];
      const filePath = match[2].trim();
      const content = match[4];

      // Skip if it looks like a tool-call block
      if (content.includes('Tool:') && content.includes('Parameters:')) {
        continue;
      }

      // Determine if file exists
      const resolvedPath = path.resolve(filePath);
      const action = fs.existsSync(resolvedPath) ? 'update' : 'create';

      artifacts.push({
        filePath,
        content,
        language,
        action,
      });
    }

    return artifacts;
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
