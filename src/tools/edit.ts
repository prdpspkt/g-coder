import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

export class EditTool implements Tool {
  definition: ToolDefinition = {
    name: 'Edit',
    description: 'Performs exact string replacements in a file',
    parameters: [
      {
        name: 'file_path',
        type: 'string',
        description: 'The path to the file to edit',
        required: true,
      },
      {
        name: 'old_string',
        type: 'string',
        description: 'The exact string to replace',
        required: true,
      },
      {
        name: 'new_string',
        type: 'string',
        description: 'The string to replace it with',
        required: true,
      },
      {
        name: 'replace_all',
        type: 'boolean',
        description: 'Replace all occurrences (default: false)',
        required: false,
        default: false,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { file_path, old_string, new_string, replace_all = false } = params;

    try {
      if (!file_path) {
        return {
          success: false,
          error: 'file_path parameter is required',
        };
      }

      if (old_string === undefined) {
        return {
          success: false,
          error: 'old_string parameter is required',
        };
      }

      if (new_string === undefined) {
        return {
          success: false,
          error: 'new_string parameter is required',
        };
      }

      const resolvedPath = path.resolve(file_path);

      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `File not found: ${resolvedPath}`,
        };
      }

      let content = fs.readFileSync(resolvedPath, 'utf-8');

      // Check if old_string exists
      if (!content.includes(old_string)) {
        return {
          success: false,
          error: `String not found in file: "${old_string.substring(0, 50)}${old_string.length > 50 ? '...' : ''}"`,
        };
      }

      // Count occurrences
      const occurrences = (content.match(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

      if (occurrences > 1 && !replace_all) {
        return {
          success: false,
          error: `String appears ${occurrences} times in file. Use replace_all: true to replace all occurrences, or provide a more specific string.`,
        };
      }

      // Perform replacement
      if (replace_all) {
        content = content.split(old_string).join(new_string);
      } else {
        content = content.replace(old_string, new_string);
      }

      // Safety warnings
      const warnings: string[] = [];
      const fileName = path.basename(resolvedPath);

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
        warnings.push(`⚠️  Modifying potentially sensitive file: ${fileName}`);
      }

      fs.writeFileSync(resolvedPath, content, 'utf-8');

      const replacedCount = replace_all ? occurrences : 1;
      logger.tool('Edit', `Replaced ${replacedCount} occurrence(s) in ${file_path}`);

      let output = `Successfully replaced ${replacedCount} occurrence(s) in ${resolvedPath}`;
      if (warnings.length > 0) {
        output += '\n' + warnings.join('\n');
      }

      return {
        success: true,
        output,
        data: {
          path: resolvedPath,
          replacedCount,
          warnings: warnings.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to edit file: ${error.message}`,
      };
    }
  }
}
