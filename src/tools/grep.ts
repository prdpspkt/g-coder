import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'fast-glob';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

export class GrepTool implements Tool {
  definition: ToolDefinition = {
    name: 'Grep',
    description: 'Searches for patterns in file contents using regex',
    parameters: [
      {
        name: 'pattern',
        type: 'string',
        description: 'The regex pattern to search for',
        required: true,
      },
      {
        name: 'path',
        type: 'string',
        description: 'File or directory to search in (defaults to current directory)',
        required: false,
      },
      {
        name: 'file_pattern',
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.js")',
        required: false,
      },
      {
        name: 'case_insensitive',
        type: 'boolean',
        description: 'Perform case-insensitive search',
        required: false,
        default: false,
      },
      {
        name: 'context_lines',
        type: 'number',
        description: 'Number of lines of context to show around matches',
        required: false,
        default: 0,
      },
      {
        name: 'max_results',
        type: 'number',
        description: 'Maximum number of results to return',
        required: false,
        default: 100,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const {
      pattern,
      path: searchPath = process.cwd(),
      file_pattern = '**/*',
      case_insensitive = false,
      context_lines = 0,
      max_results = 100,
    } = params;

    try {
      if (!pattern) {
        return {
          success: false,
          error: 'pattern parameter is required',
        };
      }

      const resolvedPath = path.resolve(searchPath);
      const stats = fs.statSync(resolvedPath);

      let filesToSearch: string[] = [];

      if (stats.isFile()) {
        filesToSearch = [resolvedPath];
      } else if (stats.isDirectory()) {
        const files = await glob.glob(file_pattern, {
          cwd: resolvedPath,
          ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
          ],
          absolute: true,
          dot: false,
        });
        filesToSearch = files.filter((file: string) => {
          try {
            return fs.statSync(file).isFile();
          } catch {
            return false;
          }
        });
      }

      const flags = case_insensitive ? 'gi' : 'g';
      const regex = new RegExp(pattern, flags);
      const results: string[] = [];
      let totalMatches = 0;

      for (const file of filesToSearch) {
        if (totalMatches >= max_results) break;

        try {
          const content = fs.readFileSync(file, 'utf-8');
          const lines = content.split('\n');
          const matches: number[] = [];

          lines.forEach((line, idx) => {
            if (regex.test(line)) {
              matches.push(idx);
            }
          });

          if (matches.length > 0) {
            const relativePath = path.relative(process.cwd(), file);
            results.push(`\n${relativePath}:`);

            for (const matchIdx of matches) {
              if (totalMatches >= max_results) break;

              const start = Math.max(0, matchIdx - context_lines);
              const end = Math.min(lines.length, matchIdx + context_lines + 1);

              for (let i = start; i < end; i++) {
                const lineNum = i + 1;
                const prefix = i === matchIdx ? '→' : ' ';
                results.push(`  ${prefix} ${lineNum.toString().padStart(4)}: ${lines[i]}`);
              }

              if (context_lines > 0) {
                results.push('  ---');
              }

              totalMatches++;
            }
          }
        } catch (error) {
          // Skip files that can't be read (binary, permissions, etc.)
        }
      }

      logger.tool('Grep', `Found ${totalMatches} matches for "${pattern}"`);

      return {
        success: true,
        output: results.length > 0 ? results.join('\n') : 'No matches found',
        data: {
          pattern,
          matches: totalMatches,
          filesSearched: filesToSearch.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to search: ${error.message}`,
      };
    }
  }
}
