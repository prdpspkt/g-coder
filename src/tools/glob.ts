import * as glob from 'fast-glob';
import * as path from 'path';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

export class GlobTool implements Tool {
  definition: ToolDefinition = {
    name: 'Glob',
    description: 'Finds files matching a glob pattern',
    parameters: [
      {
        name: 'pattern',
        type: 'string',
        description: 'The glob pattern to match (e.g., "**/*.ts", "src/**/*.js")',
        required: true,
      },
      {
        name: 'path',
        type: 'string',
        description: 'The directory to search in (defaults to current directory)',
        required: false,
      },
      {
        name: 'ignore',
        type: 'array',
        description: 'Patterns to ignore (e.g., ["node_modules/**", "dist/**"])',
        required: false,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { pattern, path: searchPath = process.cwd(), ignore } = params;

    try {
      if (!pattern) {
        return {
          success: false,
          error: 'pattern parameter is required',
        };
      }

      const resolvedPath = path.resolve(searchPath);

      const defaultIgnore = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
      ];

      const ignorePatterns = ignore
        ? [...defaultIgnore, ...ignore]
        : defaultIgnore;

      const files = await glob.glob(pattern, {
        cwd: resolvedPath,
        ignore: ignorePatterns,
        absolute: false,
        dot: true,
      });

      // Sort by modification time (most recent first) if possible
      const filesWithStats = await Promise.all(
        files.map(async (file: string) => {
          try {
            const fs = await import('fs');
            const fullPath = path.join(resolvedPath, file);
            const stats = fs.statSync(fullPath);
            return { file, mtime: stats.mtime.getTime() };
          } catch {
            return { file, mtime: 0 };
          }
        })
      );

      filesWithStats.sort((a: { file: string; mtime: number }, b: { file: string; mtime: number }) => b.mtime - a.mtime);
      const sortedFiles = filesWithStats.map((f: { file: string; mtime: number }) => f.file);

      logger.tool('Glob', `Found ${sortedFiles.length} files matching "${pattern}"`);

      return {
        success: true,
        output: sortedFiles.join('\n'),
        data: {
          files: sortedFiles,
          count: sortedFiles.length,
          pattern,
          searchPath: resolvedPath,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to search files: ${error.message}`,
      };
    }
  }
}
