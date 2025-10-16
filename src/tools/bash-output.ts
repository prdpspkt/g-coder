import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';
import { toolRegistry } from './index';
import { BashTool } from './bash';

export class BashOutputTool implements Tool {
  definition: ToolDefinition = {
    name: 'BashOutput',
    description: 'Retrieve output from a background bash process',
    parameters: [
      {
        name: 'bash_id',
        type: 'string',
        description: 'The ID of the background shell to retrieve output from',
        required: true,
      },
      {
        name: 'filter',
        type: 'string',
        description: 'Optional regex to filter output lines',
        required: false,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { bash_id, filter } = params;

    try {
      if (!bash_id) {
        return {
          success: false,
          error: 'bash_id parameter is required',
        };
      }

      // Get the Bash tool from registry
      const bashTool = toolRegistry.get('Bash') as BashTool;
      if (!bashTool) {
        return {
          success: false,
          error: 'Bash tool not available',
        };
      }

      const processInfo = bashTool.getProcessOutput(bash_id);

      if (!processInfo) {
        return {
          success: false,
          error: `No background process found with ID: ${bash_id}`,
        };
      }

      let output = processInfo.stdout;
      if (processInfo.stderr) {
        output += '\nSTDERR:\n' + processInfo.stderr;
      }

      // Apply filter if provided
      if (filter) {
        try {
          const regex = new RegExp(filter);
          output = output
            .split('\n')
            .filter((line: string) => regex.test(line))
            .join('\n');
        } catch (error: any) {
          logger.warn(`Invalid filter regex: ${error.message}`);
        }
      }

      const status = processInfo.running ? 'running' : 'completed';
      const runtime = Date.now() - processInfo.startTime;

      logger.tool('BashOutput', `Retrieved output from ${bash_id} (${status})`);

      return {
        success: true,
        output,
        data: {
          shellId: bash_id,
          command: processInfo.command,
          status,
          runtime,
          exitCode: processInfo.exitCode,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get bash output: ${error.message}`,
      };
    }
  }
}

export class KillShellTool implements Tool {
  definition: ToolDefinition = {
    name: 'KillShell',
    description: 'Kill a running background bash process',
    parameters: [
      {
        name: 'shell_id',
        type: 'string',
        description: 'The ID of the background shell to kill',
        required: true,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { shell_id } = params;

    try {
      if (!shell_id) {
        return {
          success: false,
          error: 'shell_id parameter is required',
        };
      }

      // Get the Bash tool from registry
      const bashTool = toolRegistry.get('Bash') as BashTool;
      if (!bashTool) {
        return {
          success: false,
          error: 'Bash tool not available',
        };
      }

      const killed = bashTool.killProcess(shell_id);

      if (killed) {
        logger.tool('KillShell', `Killed process ${shell_id}`);
        return {
          success: true,
          output: `Successfully killed process: ${shell_id}`,
          data: {
            shellId: shell_id,
          },
        };
      } else {
        return {
          success: false,
          error: `Process ${shell_id} not found or already stopped`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to kill process: ${error.message}`,
      };
    }
  }
}
