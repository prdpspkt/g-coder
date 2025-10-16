import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';
import chalk from 'chalk';

interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

const TODO_FILE = path.join(os.tmpdir(), 'g-coder-todos.json');

export class TodoWriteTool implements Tool {
  definition: ToolDefinition = {
    name: 'TodoWrite',
    description: 'INTERNAL USE ONLY - Do NOT use this tool. This is for the AI assistant to track its own internal task progress, not for creating user todo files. For user todo lists, use file artifacts instead.',
    parameters: [
      {
        name: 'todos',
        type: 'array',
        description: 'Array of todo items with content, status (pending/in_progress/completed), and activeForm',
        required: true,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { todos } = params;

    try {
      if (!todos || !Array.isArray(todos)) {
        return {
          success: false,
          error: 'todos parameter must be an array',
        };
      }

      // Validate todo structure
      for (const todo of todos) {
        if (!todo.content || !todo.status || !todo.activeForm) {
          return {
            success: false,
            error: 'Each todo must have content, status, and activeForm',
          };
        }

        if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
          return {
            success: false,
            error: `Invalid status: ${todo.status}. Must be pending, in_progress, or completed`,
          };
        }
      }

      // Count in_progress tasks
      const inProgressCount = todos.filter((t: TodoItem) => t.status === 'in_progress').length;

      if (inProgressCount > 1) {
        logger.warn(`Warning: ${inProgressCount} tasks marked as in_progress. Recommend having only one active task at a time.`);
      }

      // Save to file
      fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));

      // Generate display output
      const output = this.renderTodos(todos);

      logger.tool('TodoWrite', `Updated task list with ${todos.length} items`);

      return {
        success: true,
        output,
        data: {
          todos,
          totalCount: todos.length,
          completed: todos.filter((t: TodoItem) => t.status === 'completed').length,
          inProgress: todos.filter((t: TodoItem) => t.status === 'in_progress').length,
          pending: todos.filter((t: TodoItem) => t.status === 'pending').length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to manage todos: ${error.message}`,
      };
    }
  }

  private renderTodos(todos: TodoItem[]): string {
    const lines: string[] = [];
    lines.push(chalk.cyan.bold('\n📋 Task List:'));
    lines.push(chalk.gray('─'.repeat(60)));

    todos.forEach((todo, index) => {
      const num = chalk.gray(`${index + 1}.`);
      let icon = '';
      let color = chalk.white;

      switch (todo.status) {
        case 'completed':
          icon = chalk.green('✓');
          color = chalk.green;
          break;
        case 'in_progress':
          icon = chalk.yellow('►');
          color = chalk.yellow;
          break;
        case 'pending':
          icon = chalk.gray('○');
          color = chalk.gray;
          break;
      }

      const statusText = todo.status === 'in_progress' ? todo.activeForm : todo.content;
      lines.push(`${num} ${icon} ${color(statusText)}`);
    });

    const completed = todos.filter(t => t.status === 'completed').length;
    const total = todos.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    lines.push(chalk.gray('─'.repeat(60)));
    lines.push(chalk.cyan(`Progress: ${completed}/${total} (${progress}%)`));

    return lines.join('\n');
  }

  // Helper method to load current todos
  static loadTodos(): TodoItem[] {
    try {
      if (fs.existsSync(TODO_FILE)) {
        const content = fs.readFileSync(TODO_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      logger.warn('Failed to load todos:', error);
    }
    return [];
  }

  // Helper method to clear todos
  static clearTodos(): void {
    try {
      if (fs.existsSync(TODO_FILE)) {
        fs.unlinkSync(TODO_FILE);
      }
    } catch (error) {
      logger.warn('Failed to clear todos:', error);
    }
  }
}
