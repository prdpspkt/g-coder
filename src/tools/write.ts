import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

export class WriteTool implements Tool {
  definition: ToolDefinition = {
    name: 'Write',
    description: 'Writes content to a file, creating it if it doesn\'t exist or overwriting if it does',
    parameters: [
      {
        name: 'file_path',
        type: 'string',
        description: 'The path to the file to write',
        required: true,
      },
      {
        name: 'content',
        type: 'string',
        description: 'The content to write to the file',
        required: true,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { file_path, content } = params;

    try {
      if (!file_path) {
        return {
          success: false,
          error: 'file_path parameter is required',
        };
      }

      if (content === undefined) {
        return {
          success: false,
          error: 'content parameter is required',
        };
      }

      const resolvedPath = path.resolve(file_path);
      const dir = path.dirname(resolvedPath);

      // Safety checks
      const fileName = path.basename(resolvedPath);
      const warnings: string[] = [];

      // Check for sensitive files
      const sensitivePatterns = [
        /\.env$/i,
        /\.git\/config$/i,
        /\.ssh\//i,
        /\.aws\/credentials$/i,
        /config\.json$/i,
        /credentials/i,
        /secret/i,
        /password/i,
      ];

      if (sensitivePatterns.some(pattern => pattern.test(resolvedPath))) {
        warnings.push(`⚠️  Writing to potentially sensitive file: ${fileName}`);
      }

      // Check if overwriting existing file
      const existed = fs.existsSync(resolvedPath);
      if (existed) {
        const stats = fs.statSync(resolvedPath);
        const fileSizeKB = (stats.size / 1024).toFixed(2);
        warnings.push(`⚠️  Overwriting existing file (${fileSizeKB} KB)`);
      }

      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Check for potentially dangerous content
      const dangerousPatterns = [
        /rm\s+-rf/i,
        /eval\s*\(/i,
        /exec\s*\(/i,
        /<script>/i,
      ];

      if (dangerousPatterns.some(pattern => pattern.test(content))) {
        warnings.push(`⚠️  Content contains potentially dangerous patterns`);
      }

      fs.writeFileSync(resolvedPath, content, 'utf-8');

      const lines = content.split('\n').length;
      const action = existed ? 'Overwrote' : 'Created';

      logger.tool('Write', `${action} file ${file_path} (${lines} lines)`);

      let output = `${action} file: ${resolvedPath}`;
      if (warnings.length > 0) {
        output += '\n' + warnings.join('\n');
      }

      return {
        success: true,
        output,
        data: {
          path: resolvedPath,
          lines,
          action,
          warnings: warnings.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to write file: ${error.message}`,
      };
    }
  }
}
