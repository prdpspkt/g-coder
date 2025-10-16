import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

interface NotebookCell {
  cell_type: 'code' | 'markdown';
  source: string | string[];
  metadata?: any;
  outputs?: any[];
  execution_count?: number | null;
}

interface Notebook {
  cells: NotebookCell[];
  metadata: any;
  nbformat: number;
  nbformat_minor: number;
}

export class NotebookEditTool implements Tool {
  definition: ToolDefinition = {
    name: 'NotebookEdit',
    description: 'Edit Jupyter notebook (.ipynb) files by replacing, inserting, or deleting cells',
    parameters: [
      {
        name: 'notebook_path',
        type: 'string',
        description: 'Path to the .ipynb file',
        required: true,
      },
      {
        name: 'new_source',
        type: 'string',
        description: 'New source code/markdown for the cell',
        required: true,
      },
      {
        name: 'cell_id',
        type: 'string',
        description: 'The ID of the cell to edit (optional, will use cell_number if not provided)',
        required: false,
      },
      {
        name: 'cell_number',
        type: 'number',
        description: 'The 0-indexed cell number to edit (optional)',
        required: false,
      },
      {
        name: 'cell_type',
        type: 'string',
        description: 'Type of cell: "code" or "markdown" (default: code)',
        required: false,
        default: 'code',
      },
      {
        name: 'edit_mode',
        type: 'string',
        description: 'Edit mode: "replace" (default), "insert", or "delete"',
        required: false,
        default: 'replace',
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const {
      notebook_path,
      new_source,
      cell_id,
      cell_number,
      cell_type = 'code',
      edit_mode = 'replace',
    } = params;

    try {
      if (!notebook_path) {
        return {
          success: false,
          error: 'notebook_path parameter is required',
        };
      }

      const resolvedPath = path.resolve(notebook_path);

      // Check if file exists and is a notebook
      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `Notebook not found: ${resolvedPath}`,
        };
      }

      if (!resolvedPath.endsWith('.ipynb')) {
        return {
          success: false,
          error: 'File must be a Jupyter notebook (.ipynb)',
        };
      }

      // Read notebook
      const notebookContent = fs.readFileSync(resolvedPath, 'utf-8');
      let notebook: Notebook;

      try {
        notebook = JSON.parse(notebookContent);
      } catch (error: any) {
        return {
          success: false,
          error: `Invalid notebook JSON: ${error.message}`,
        };
      }

      // Validate notebook structure
      if (!notebook.cells || !Array.isArray(notebook.cells)) {
        return {
          success: false,
          error: 'Invalid notebook structure: missing cells array',
        };
      }

      const originalCellCount = notebook.cells.length;
      let targetIndex: number;

      // Determine target cell
      if (cell_number !== undefined) {
        targetIndex = cell_number;
      } else if (cell_id) {
        // Find cell by ID (if notebooks have IDs in metadata)
        targetIndex = notebook.cells.findIndex(
          (cell: any) => cell.id === cell_id || cell.metadata?.id === cell_id
        );
        if (targetIndex === -1) {
          return {
            success: false,
            error: `Cell with ID "${cell_id}" not found`,
          };
        }
      } else if (edit_mode === 'insert') {
        // Insert at end if no position specified
        targetIndex = notebook.cells.length;
      } else {
        return {
          success: false,
          error: 'Either cell_id or cell_number must be provided',
        };
      }

      // Validate index
      if (edit_mode !== 'insert' && (targetIndex < 0 || targetIndex >= notebook.cells.length)) {
        return {
          success: false,
          error: `Cell index ${targetIndex} is out of range (0-${notebook.cells.length - 1})`,
        };
      }

      // Perform edit
      let action = '';

      switch (edit_mode) {
        case 'delete':
          if (targetIndex < notebook.cells.length) {
            notebook.cells.splice(targetIndex, 1);
            action = `Deleted cell at index ${targetIndex}`;
          }
          break;

        case 'insert':
          const newCell: NotebookCell = {
            cell_type: cell_type as 'code' | 'markdown',
            source: new_source.split('\n'),
            metadata: {},
          };

          if (cell_type === 'code') {
            newCell.execution_count = null;
            newCell.outputs = [];
          }

          notebook.cells.splice(targetIndex, 0, newCell);
          action = `Inserted ${cell_type} cell at index ${targetIndex}`;
          break;

        case 'replace':
        default:
          if (targetIndex < notebook.cells.length) {
            notebook.cells[targetIndex].source = new_source.split('\n');
            if (cell_type) {
              notebook.cells[targetIndex].cell_type = cell_type as 'code' | 'markdown';
            }
            action = `Replaced cell at index ${targetIndex}`;
          }
          break;
      }

      // Write back to file
      fs.writeFileSync(resolvedPath, JSON.stringify(notebook, null, 2), 'utf-8');

      logger.tool('NotebookEdit', `${action} in ${notebook_path}`);

      return {
        success: true,
        output: `${action}\nTotal cells: ${notebook.cells.length} (was ${originalCellCount})`,
        data: {
          path: resolvedPath,
          action: edit_mode,
          cellIndex: targetIndex,
          cellType: cell_type,
          totalCells: notebook.cells.length,
          originalCellCount,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to edit notebook: ${error.message}`,
      };
    }
  }
}
