import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

export class ReadTool implements Tool {
  definition: ToolDefinition = {
    name: 'Read',
    description: 'Reads the contents of a FILE from the filesystem. For directories, use Glob (find files) or Bash (list contents).',
    parameters: [
      {
        name: 'file_path',
        type: 'string',
        description: 'The path to the file to read (must be a file, not a directory)',
        required: true,
      },
      {
        name: 'offset',
        type: 'number',
        description: 'Line number to start reading from (1-indexed)',
        required: false,
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Number of lines to read',
        required: false,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { file_path, offset, limit } = params;

    try {
      if (!file_path) {
        return {
          success: false,
          error: 'file_path parameter is required',
        };
      }

      const resolvedPath = path.resolve(file_path);

      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `File not found: ${resolvedPath}`,
        };
      }

      const stats = fs.statSync(resolvedPath);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: `Path is a directory, not a file: ${resolvedPath}\n\nTo work with directories, use:\n  • Glob tool - to find files matching patterns (e.g., "*.css", "**/*.ts")\n  • Bash tool - to list directory contents (e.g., "ls ${resolvedPath}" or "dir ${resolvedPath}")`,
        };
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');

      // Special handling for Jupyter notebooks
      if (resolvedPath.endsWith('.ipynb')) {
        return this.readNotebook(resolvedPath, content, offset, limit);
      }

      const lines = content.split('\n');

      let outputLines = lines;
      if (offset !== undefined || limit !== undefined) {
        const start = offset ? offset - 1 : 0;
        const end = limit ? start + limit : lines.length;
        outputLines = lines.slice(start, end);
      }

      // Add line numbers (cat -n format)
      const numberedContent = outputLines
        .map((line, idx) => {
          const lineNum = (offset || 1) + idx;
          return `${lineNum.toString().padStart(6)}  ${line}`;
        })
        .join('\n');

      logger.tool('Read', `Read ${outputLines.length} lines from ${file_path}`);

      return {
        success: true,
        output: numberedContent,
        data: {
          path: resolvedPath,
          totalLines: lines.length,
          readLines: outputLines.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to read file: ${error.message}`,
      };
    }
  }

  private readNotebook(
    resolvedPath: string,
    content: string,
    offset?: number,
    limit?: number
  ): ToolResult {
    try {
      const notebook = JSON.parse(content);

      if (!notebook.cells || !Array.isArray(notebook.cells)) {
        return {
          success: false,
          error: 'Invalid notebook structure',
        };
      }

      let cells = notebook.cells;

      // Apply offset and limit to cells
      if (offset !== undefined || limit !== undefined) {
        const start = offset ? offset - 1 : 0;
        const end = limit ? start + limit : cells.length;
        cells = cells.slice(start, end);
      }

      // Format notebook cells
      const output = cells
        .map((cell: any, idx: number) => {
          const cellNum = (offset || 1) + idx;
          const cellType = cell.cell_type || 'unknown';
          const source = Array.isArray(cell.source)
            ? cell.source.join('')
            : cell.source || '';

          let cellOutput = `\n[Cell ${cellNum}] Type: ${cellType}\n`;
          cellOutput += '─'.repeat(60) + '\n';
          cellOutput += source;

          if (cell.outputs && cell.outputs.length > 0) {
            cellOutput += '\n\nOutputs:\n';
            cell.outputs.forEach((output: any, outIdx: number) => {
              if (output.text) {
                const text = Array.isArray(output.text)
                  ? output.text.join('')
                  : output.text;
                cellOutput += `Output ${outIdx + 1}:\n${text}\n`;
              } else if (output.data) {
                cellOutput += `Output ${outIdx + 1}: [Data output]\n`;
              }
            });
          }

          return cellOutput;
        })
        .join('\n');

      logger.tool('Read', `Read ${cells.length} cells from notebook ${path.basename(resolvedPath)}`);

      return {
        success: true,
        output,
        data: {
          path: resolvedPath,
          totalCells: notebook.cells.length,
          readCells: cells.length,
          isNotebook: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to parse notebook: ${error.message}`,
      };
    }
  }
}
