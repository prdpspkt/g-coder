import { marked } from 'marked';
import markedTerminal from 'marked-terminal';
import hljs from 'highlight.js';
import chalk from 'chalk';

// Configure marked with terminal renderer
marked.use(markedTerminal as any);

export class Renderer {
  constructor() {
    // Configure highlight.js
    hljs.configure({
      ignoreUnescapedHTML: true,
    });
  }

  renderMarkdown(text: string): string {
    try {
      return marked(text) as string;
    } catch (error) {
      return text;
    }
  }

  highlightCode(code: string, language?: string): string {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch (error) {
      return code;
    }
  }

  renderCodeBlock(code: string, language: string = ''): string {
    const highlighted = this.highlightCode(code, language);
    const lines = highlighted.split('\n');
    const lineCount = lines.length;
    const padding = lineCount.toString().length;

    const numberedLines = lines
      .map((line, idx) => {
        const lineNum = (idx + 1).toString().padStart(padding, ' ');
        return chalk.gray(`${lineNum} │ `) + line;
      })
      .join('\n');

    const header = chalk.gray(`┌─ ${language || 'code'}`);
    const footer = chalk.gray(`└${'─'.repeat(50)}`);

    return `${header}\n${numberedLines}\n${footer}`;
  }

  renderToolCall(toolName: string, params: Record<string, any>): string {
    const header = chalk.cyan.bold(`\n🔧 Tool: ${toolName}`);
    const paramsStr = Object.entries(params)
      .map(([key, value]) => {
        const displayValue = typeof value === 'string' && value.length > 100
          ? value.substring(0, 100) + '...'
          : value;
        return `  ${chalk.yellow(key)}: ${JSON.stringify(displayValue)}`;
      })
      .join('\n');

    return `${header}\n${paramsStr}`;
  }

  renderToolResult(toolName: string, success: boolean, output?: string, error?: string, data?: any): string {
    if (success) {
      const icon = chalk.green('✓');

      // Create concise summary based on tool type
      let summary = '';

      switch (toolName) {
        case 'Write':
          summary = data?.path
            ? `Created/Updated: ${chalk.cyan(data.path)} (${data.lines || 0} lines)`
            : 'File written successfully';
          break;

        case 'Read':
          // For Read tool, show concise message with filename
          const fileName = data?.path ? data.path.split(/[/\\]/).pop() : 'file';
          return chalk.green('✓') + ` File ${chalk.cyan(fileName)} read successfully`;
          break;

        case 'Edit':
          summary = data?.path
            ? `Modified: ${chalk.cyan(data.path)} (${data.replacedCount || 1} replacement${(data.replacedCount || 1) > 1 ? 's' : ''})`
            : 'File edited successfully';
          break;

        case 'Glob':
          const fileCount = data?.files?.length || 0;
          summary = `Found ${chalk.yellow(fileCount)} file${fileCount !== 1 ? 's' : ''}`;
          if (fileCount > 0 && fileCount <= 5) {
            summary += `:\n  ${data.files.map((f: string) => chalk.cyan(f)).join('\n  ')}`;
          } else if (fileCount > 5) {
            summary += ` (showing first 5):\n  ${data.files.slice(0, 5).map((f: string) => chalk.cyan(f)).join('\n  ')}\n  ...`;
          }
          break;

        case 'Grep':
          const matchCount = data?.matches || 0;
          summary = `Found ${chalk.yellow(matchCount)} match${matchCount !== 1 ? 'es' : ''}`;
          if (data?.files) {
            summary += ` in ${data.files.length} file${data.files.length !== 1 ? 's' : ''}`;
          }
          break;

        case 'Bash':
          summary = data?.command
            ? `Executed: ${chalk.cyan(data.command)}`
            : 'Command executed successfully';
          // Show output summary for bash commands
          if (output) {
            const lines = output.split('\n');
            if (lines.length <= 10) {
              summary += `\n${chalk.gray(output)}`;
            } else {
              summary += `\n${chalk.gray(lines.slice(0, 10).join('\n'))}\n${chalk.gray(`... (${lines.length - 10} more lines)`)}`;
            }
          }
          break;

        case 'TodoWrite':
          summary = data?.totalCount
            ? `Updated task list: ${chalk.yellow(data.completed)}/${data.totalCount} completed`
            : 'Task list updated';
          // TodoWrite already formats its own output, so include it
          if (output) {
            summary += `\n${output}`;
          }
          break;

        case 'WebFetch':
          summary = data?.url
            ? `Fetched: ${chalk.cyan(data.url)} (${data.length} chars${data.cached ? ', cached' : ''})`
            : 'Content fetched successfully';
          break;

        default:
          summary = output || 'Success';
          if (typeof summary === 'string' && summary.length > 200) {
            summary = summary.substring(0, 200) + '...';
          }
      }

      return `${icon} ${chalk.green('Success')}: ${summary}`;
    } else {
      const icon = chalk.red('✗');
      const message = chalk.red('Error');
      const errorMsg = error ? `\n${chalk.red(error)}` : '';
      return `${icon} ${message}${errorMsg}`;
    }
  }

  renderThinking(text: string): string {
    return chalk.gray.italic(`💭 ${text}`);
  }

  renderError(error: string): string {
    return chalk.red(`❌ Error: ${error}`);
  }

  renderWarning(warning: string): string {
    return chalk.yellow(`⚠️  Warning: ${warning}`);
  }

  renderInfo(info: string): string {
    return chalk.blue(`ℹ️  ${info}`);
  }

  renderSuccess(message: string): string {
    return chalk.green(`✅ ${message}`);
  }

  renderHeader(text: string): string {
    const line = '═'.repeat(60);
    return chalk.bold.cyan(`\n${line}\n${text}\n${line}\n`);
  }

  renderPrompt(): string {
    return chalk.green.bold('> ');
  }

  renderStatusBar(options: {
    model: string;
    provider: string;
    planMode?: boolean;
    bossMode?: boolean;
    multiLineMode?: boolean;
    tokenCount?: number;
    maxTokens?: number;
  }): string {
    const parts: string[] = [];

    // Model and provider
    parts.push(chalk.cyan(`${options.provider}:${options.model}`));

    // Token usage if available
    if (options.tokenCount !== undefined && options.maxTokens) {
      const percentage = Math.round((options.tokenCount / options.maxTokens) * 100);
      const color = percentage > 90 ? chalk.red : percentage > 70 ? chalk.yellow : chalk.gray;
      parts.push(color(`${options.tokenCount}/${options.maxTokens} tokens (${percentage}%)`));
    }

    // Mode indicators
    const modes: string[] = [];
    if (options.bossMode) {
      modes.push(chalk.bold.red('BOSS'));
    }
    if (options.planMode) {
      modes.push(chalk.yellow('PLAN'));
    }
    if (options.multiLineMode) {
      modes.push(chalk.blue('MULTI-LINE'));
    }

    if (modes.length > 0) {
      parts.push(`[${modes.join(' ')}]`);
    }

    // Join all parts with separator
    const statusLine = parts.join(chalk.gray(' │ '));

    // Return with proper formatting
    return chalk.gray('─'.repeat(80)) + '\n' + statusLine;
  }

  renderStreaming(partial: string): void {
    process.stdout.write(partial);
  }

  clearLine(): void {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
  }

  newLine(): void {
    process.stdout.write('\n');
  }
}

export const renderer = new Renderer();
