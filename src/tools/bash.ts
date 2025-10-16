import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export class BashTool implements Tool {
  definition: ToolDefinition = {
    name: 'Bash',
    description: 'Executes shell commands and returns their output',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'The shell command to execute',
        required: true,
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'The working directory for the command',
        required: false,
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
        required: false,
        default: 30000,
      },
      {
        name: 'background',
        type: 'boolean',
        description: 'Run command in background (returns immediately, use BashOutput to check status)',
        required: false,
        default: false,
      },
    ],
  };

  private backgroundProcesses: Map<string, any> = new Map();

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { command, cwd = process.cwd(), timeout = 30000, background = false } = params;

    try {
      if (!command) {
        return {
          success: false,
          error: 'command parameter is required',
        };
      }

      // If background mode, start process and return immediately
      if (background) {
        const shellId = this.generateShellId();
        const proc = spawn(
          process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
          process.platform === 'win32' ? ['/c', command] : ['-c', command],
          { cwd, shell: true }
        );

        const processInfo = {
          id: shellId,
          command,
          cwd,
          process: proc,
          stdout: '',
          stderr: '',
          startTime: Date.now(),
          running: true,
        };

        proc.stdout?.on('data', (data) => {
          processInfo.stdout += data.toString();
        });

        proc.stderr?.on('data', (data) => {
          processInfo.stderr += data.toString();
        });

        proc.on('close', (code) => {
          processInfo.running = false;
          (processInfo as any).exitCode = code;
        });

        this.backgroundProcesses.set(shellId, processInfo);

        logger.tool('Bash', `Started background process ${shellId}: ${command}`);

        return {
          success: true,
          output: `Background process started with ID: ${shellId}\nUse BashOutput tool with bash_id: ${shellId} to check status`,
          data: {
            command,
            cwd,
            shellId,
            background: true,
          },
        };
      }

      // Regular synchronous execution
      logger.tool('Bash', `Executing: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      });

      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');

      return {
        success: true,
        output: output.trim(),
        data: {
          command,
          cwd,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        },
      };
    } catch (error: any) {
      // Command failed but we still want to show output
      const output = error.stdout || error.stderr || error.message;

      return {
        success: false,
        error: `Command failed with exit code ${error.code || 'unknown'}`,
        output: output.trim(),
        data: {
          command,
          exitCode: error.code,
          stdout: error.stdout?.trim() || '',
          stderr: error.stderr?.trim() || '',
        },
      };
    }
  }

  private generateShellId(): string {
    return `shell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get output from background process
  getProcessOutput(shellId: string): any {
    return this.backgroundProcesses.get(shellId);
  }

  // List all background processes
  listProcesses(): any[] {
    return Array.from(this.backgroundProcesses.values()).map(p => ({
      id: p.id,
      command: p.command,
      running: p.running,
      startTime: p.startTime,
    }));
  }

  // Kill a background process
  killProcess(shellId: string): boolean {
    const proc = this.backgroundProcesses.get(shellId);
    if (proc && proc.running) {
      proc.process.kill();
      return true;
    }
    return false;
  }

  // Interactive command execution (for long-running processes)
  async executeInteractive(
    command: string,
    cwd: string = process.cwd(),
    onOutput?: (data: string) => void
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      logger.tool('Bash', `Executing (interactive): ${command}`);

      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      const child = spawn(shell, args, {
        cwd,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (onOutput) onOutput(text);
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (onOutput) onOutput(text);
      });

      child.on('close', (code) => {
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');

        if (code === 0) {
          resolve({
            success: true,
            output: output.trim(),
            data: {
              command,
              exitCode: code,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
            },
          });
        } else {
          resolve({
            success: false,
            error: `Command failed with exit code ${code}`,
            output: output.trim(),
            data: {
              command,
              exitCode: code,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
            },
          });
        }
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to execute command: ${error.message}`,
        });
      });
    });
  }
}
