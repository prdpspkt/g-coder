import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';
import { SmartEdit } from '../utils/smart-edit';

export class EditTool implements Tool {
  definition: ToolDefinition = {
    name: 'Edit',
    description: 'Intelligently finds and modifies code in a file. Supports multiple matching strategies: exact match, fuzzy matching, line numbers, and context-based matching.',
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
        description: 'The code/text to find and replace. Can be a partial match, full line, or multi-line block.',
        required: true,
      },
      {
        name: 'new_string',
        type: 'string',
        description: 'The replacement code/text',
        required: true,
      },
      {
        name: 'line_number',
        type: 'number',
        description: 'Optional: Specific line number to edit (1-based index)',
        required: false,
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
    const { file_path, old_string, new_string, line_number, replace_all = false } = params;

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

      const originalContent = fs.readFileSync(resolvedPath, 'utf-8');

      // Use SmartEdit to find and replace intelligently
      const editResult = SmartEdit.edit(originalContent, old_string, new_string, {
        replaceAll: replace_all,
        lineNumber: line_number,
        fuzzyMatch: true,
        contextLines: 3,
      });

      if (!editResult.success) {
        return {
          success: false,
          error: editResult.error || 'Failed to edit file',
        };
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

      // Write the edited content
      fs.writeFileSync(resolvedPath, editResult.content!, 'utf-8');

      const linesChanged = editResult.linesChanged || 1;
      const strategyUsed = editResult.strategy || 'unknown';

      logger.tool('Edit', `Modified ${linesChanged} line(s) in ${file_path} using ${strategyUsed} strategy`);

      // Build detailed output message
      let output = `Successfully edited ${resolvedPath}\n`;
      output += `Strategy: ${strategyUsed}\n`;
      output += `Lines modified: ${linesChanged}`;

      if (editResult.startLine && editResult.endLine) {
        output += `\nLine range: ${editResult.startLine}-${editResult.endLine}`;

        // Show preview of the changes
        const preview = SmartEdit.getLinePreview(
          editResult.content!,
          editResult.startLine,
          editResult.endLine,
          2
        );
        output += '\n\nPreview:\n' + preview;
      }

      if (warnings.length > 0) {
        output += '\n\n' + warnings.join('\n');
      }

      return {
        success: true,
        output,
        data: {
          path: resolvedPath,
          linesChanged,
          startLine: editResult.startLine,
          endLine: editResult.endLine,
          strategy: strategyUsed,
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
