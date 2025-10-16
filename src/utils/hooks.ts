import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const execAsync = promisify(exec);

export type HookEvent =
  | 'tool_call'
  | 'tool_success'
  | 'tool_error'
  | 'user_prompt_submit'
  | 'assistant_response'
  | 'session_start'
  | 'session_end';

export interface HookConfig {
  [key: string]: string | string[]; // event name -> command(s)
}

export interface HookContext {
  event: HookEvent;
  toolName?: string;
  toolParams?: Record<string, any>;
  toolResult?: any;
  userInput?: string;
  assistantResponse?: string;
  error?: string;
}

export class HookManager {
  private hooks: Map<HookEvent, string[]> = new Map();
  private configPath: string;
  private enabled: boolean = true;

  constructor(baseDir: string = process.cwd()) {
    this.configPath = path.join(baseDir, '.g-coder', 'hooks.json');
    this.loadHooks();
  }

  private loadHooks(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        // Create default hooks config
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        const defaultHooks: HookConfig = {
          // Examples (commented out by default)
          // "tool_call": "echo 'Tool called: $TOOL_NAME'",
          // "tool_error": "notify-send 'G-Coder Error' '$ERROR'",
          // "user_prompt_submit": "echo '$(date): $USER_INPUT' >> .g-coder/history.log"
        };

        fs.writeFileSync(this.configPath, JSON.stringify(defaultHooks, null, 2));
        logger.info('Created hooks configuration file');
        return;
      }

      const config: HookConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));

      // Parse hooks config
      for (const [event, commands] of Object.entries(config)) {
        const eventType = event as HookEvent;
        const cmdArray = Array.isArray(commands) ? commands : [commands];
        this.hooks.set(eventType, cmdArray);
      }

      if (this.hooks.size > 0) {
        logger.debug(`Loaded ${this.hooks.size} hook(s)`);
      }
    } catch (error) {
      logger.warn('Failed to load hooks:', error);
    }
  }

  async trigger(context: HookContext): Promise<HookResult> {
    if (!this.enabled) {
      return { success: true, blocked: false };
    }

    const commands = this.hooks.get(context.event);
    if (!commands || commands.length === 0) {
      return { success: true, blocked: false };
    }

    logger.debug(`Triggering ${commands.length} hook(s) for event: ${context.event}`);

    const results: { command: string; success: boolean; output?: string; error?: string }[] = [];
    let blocked = false;

    for (const command of commands) {
      try {
        // Prepare environment variables for the hook
        const env = {
          ...process.env,
          GCODER_EVENT: context.event,
          GCODER_TOOL_NAME: context.toolName || '',
          GCODER_TOOL_PARAMS: context.toolParams ? JSON.stringify(context.toolParams) : '',
          GCODER_TOOL_RESULT: context.toolResult ? JSON.stringify(context.toolResult) : '',
          GCODER_USER_INPUT: context.userInput || '',
          GCODER_ASSISTANT_RESPONSE: context.assistantResponse || '',
          GCODER_ERROR: context.error || '',
        };

        // Execute hook command
        const { stdout, stderr } = await execAsync(command, {
          env,
          timeout: 30000, // 30 second timeout
        });

        const output = stdout + (stderr ? `\n${stderr}` : '');

        // Check if hook wants to block the action
        // If the command exits with non-zero status, it blocks the action
        results.push({
          command,
          success: true,
          output: output.trim(),
        });

        logger.debug(`Hook executed: ${command}`);
      } catch (error: any) {
        // Non-zero exit code means the hook wants to block
        if (error.code !== 0) {
          blocked = true;
          const message = error.stdout || error.stderr || error.message;

          results.push({
            command,
            success: false,
            error: message,
          });

          logger.warn(`Hook blocked action: ${command}`);

          // Stop executing remaining hooks if one blocks
          break;
        } else {
          // Timeout or other error
          results.push({
            command,
            success: false,
            error: error.message,
          });

          logger.error(`Hook failed: ${command}`, error);
        }
      }
    }

    return {
      success: !blocked,
      blocked,
      results,
    };
  }

  reload(): void {
    this.hooks.clear();
    this.loadHooks();
  }

  getHooks(): Map<HookEvent, string[]> {
    return new Map(this.hooks);
  }

  enable(): void {
    this.enabled = true;
    logger.info('Hooks enabled');
  }

  disable(): void {
    this.enabled = false;
    logger.info('Hooks disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}

export interface HookResult {
  success: boolean;
  blocked: boolean;
  results?: Array<{
    command: string;
    success: boolean;
    output?: string;
    error?: string;
  }>;
}

export const hookManager = new HookManager();
