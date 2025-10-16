import { Tool, ToolResult } from './types';
import { ReadTool } from './read';
import { WriteTool } from './write';
import { EditTool } from './edit';
import { GlobTool } from './glob';
import { GrepTool } from './grep';
import { BashTool } from './bash';
import { TodoWriteTool } from './todo';
import { BashOutputTool, KillShellTool } from './bash-output';
import { WebFetchTool } from './webfetch';
import { NotebookEditTool } from './notebook';
import { GitCommitTool, GitPushTool, GitStatusTool, GitDiffTool } from './git';
import { logger } from '../utils/logger';

export class ToolRegistry {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.register(new ReadTool());
    this.register(new WriteTool());
    this.register(new EditTool());
    this.register(new GlobTool());
    this.register(new GrepTool());
    this.register(new BashTool());
    this.register(new TodoWriteTool());
    this.register(new BashOutputTool());
    this.register(new KillShellTool());
    this.register(new WebFetchTool());
    this.register(new NotebookEditTool());
    this.register(new GitCommitTool());
    this.register(new GitPushTool());
    this.register(new GitStatusTool());
    this.register(new GitDiffTool());
  }

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): string {
    const tools = this.getAll();
    return tools
      .map((tool) => {
        const params = tool.definition.parameters
          .map((p) => {
            const required = p.required ? ' (required)' : ' (optional)';
            const defaultVal = p.default !== undefined ? ` [default: ${p.default}]` : '';
            return `  - ${p.name}: ${p.type}${required}${defaultVal}\n    ${p.description}`;
          })
          .join('\n');

        return `## ${tool.definition.name}\n${tool.definition.description}\n\nParameters:\n${params}`;
      })
      .join('\n\n');
  }

  async executeTool(name: string, params: Record<string, any>): Promise<ToolResult> {
    const tool = this.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${name}`,
      };
    }

    try {
      return await tool.execute(params);
    } catch (error: any) {
      logger.error(`Tool ${name} failed:`, error);
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();

export * from './types';
export * from './read';
export * from './write';
export * from './edit';
export * from './glob';
export * from './grep';
export * from './bash';
export * from './todo';
