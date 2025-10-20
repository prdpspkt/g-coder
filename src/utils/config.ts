import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as dotenv from 'dotenv';
import { ProviderType } from '../providers/types';
import { ApprovalConfig, createDefaultApprovalConfig } from './approval';
import { logger } from './logger';

const CONFIG_DIR = path.join(os.homedir(), '.g-coder');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

class ConfigError extends Error {
  constructor(operation: string, cause: Error | unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to ${operation}: ${message}`);
    this.name = 'ConfigError';
  }
}

// Load environment variables from .env file in ~/.g-coder
dotenv.config({ path: ENV_FILE });

export interface Config {
  provider: ProviderType;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;

  // Token management settings
  maxContextTokens?: number;
  maxMessageTokens?: number;
  enableTokenShortening?: boolean;

  // Provider-specific settings
  ollamaUrl?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;

  // Execution approval settings
  approval?: ApprovalConfig;
}

// Helper function to create default config
function createDefaultConfig(): Config {
  return {
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 8192,
    maxContextTokens: 64000,
    enableTokenShortening: true,
    systemPrompt: "You are G-Coder, a calm, precise, and technically skilled full-stack software engineer. Your purpose is to design, write, refactor, and document clean, production-grade software; perform safe file and command operations; and maintain clarity, correctness, and maintainability in all outputs. You can read, write, and edit files safely; run and analyze build, test, or migration commands; and work confidently with Django, Flask, FastAPI, GraphQL, REST, React, Next.js, Tailwind, Bootstrap, PostgreSQL, MySQL, Docker, and GitHub Actions. Always structure responses as: (1) Understanding — restate what the user wants, (2) Plan — outline your technical approach, (3) Solution — provide the code or command, (4) Notes — give brief technical remarks. Be concise, professional, and clear like a senior engineer. Confirm before major edits, avoid destructive commands, and ensure security, privacy, and correctness. You are G-Coder — a Claude-Code-style development agent that reads, writes, edits, and executes code intelligently and safely.",
    approval: createDefaultApprovalConfig(),
  };
}

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Create default config if file doesn't exist
    if (!fs.existsSync(CONFIG_FILE)) {
      logger.warn(`Configuration file not found at: ${CONFIG_FILE}`);
      logger.info('Creating default configuration...');

      try {
        const defaultConfig = createDefaultConfig();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
        logger.info(`Created default config at: ${CONFIG_FILE}`);
        return defaultConfig;
      } catch (createError: any) {
        const error = new Error(`Failed to create default config: ${createError.message}`);
        logger.error(error.message);
        throw new ConfigError('create configuration', error);
      }
    }

    // Load from config file only
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    } catch (readError: any) {
      const error = new Error(`Cannot read config file: ${readError.message}`);
      logger.error(error.message);
      throw new ConfigError('load configuration', error);
    }

    // Try to parse, and if it fails due to control characters, attempt to fix
    let config: Config;
    try {
      config = JSON.parse(fileContent) as Config;
    } catch (parseError: any) {
      // Check if it's a control character error
      if (parseError.message && parseError.message.includes('control character')) {
        logger.warn('Detected control characters in config.json, attempting to fix...');

        // Backup the corrupted file
        const backupPath = CONFIG_FILE + '.backup.' + Date.now();
        try {
          fs.writeFileSync(backupPath, fileContent);
          logger.info(`Created backup at: ${backupPath}`);
        } catch (backupError) {
          logger.warn(`Failed to create backup: ${backupError}`);
        }

        // Remove control characters (except newlines and tabs that are valid in JSON)
        let cleanedContent = fileContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // Log diagnostics
        logger.debug(`Original length: ${fileContent.length}, Cleaned length: ${cleanedContent.length}`);
        logger.debug(`Removed ${fileContent.length - cleanedContent.length} control characters`);

        // Try parsing again
        try {
          config = JSON.parse(cleanedContent) as Config;
          logger.info('Successfully fixed and parsed config.json');

          // Save the fixed version
          try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            logger.info('Saved fixed config.json');
          } catch (saveError) {
            logger.warn(`Fixed config but could not save: ${saveError}`);
            // Continue anyway - we have the parsed config
          }
        } catch (secondError: any) {
          // Parsing failed even after cleanup - create fresh config
          logger.error(`Failed to parse config.json even after removing control characters.`);
          logger.error(`Original error: ${parseError.message}`);
          logger.error(`After cleanup error: ${secondError.message}`);
          logger.info(`Backup saved at: ${backupPath}`);
          logger.warn('Creating fresh default configuration...');

          try {
            const defaultConfig = createDefaultConfig();
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
            logger.info(`✓ Created fresh config at: ${CONFIG_FILE}`);
            logger.info(`Your old config is backed up at: ${backupPath}`);
            return defaultConfig;
          } catch (recreateError: any) {
            const errorMsg = `Failed to create fresh config: ${recreateError.message}\n\n` +
              `📝 Manual recovery needed:\n` +
              `  1. View backup: cat ${backupPath}\n` +
              `  2. Delete corrupt file: rm ${CONFIG_FILE}\n` +
              `  3. Run: g-coder setup\n` +
              `  4. Or restore from backup: cp ${backupPath} ${CONFIG_FILE}`;
            logger.error(errorMsg);
            throw new ConfigError('load configuration', new Error(errorMsg));
          }
        }
      } else {
        // Other JSON parse error - attempt to create fresh config
        logger.error(`Invalid JSON in config.json: ${parseError.message}`);

        // Backup the corrupted file
        const backupPath = CONFIG_FILE + '.backup.' + Date.now();
        try {
          fs.writeFileSync(backupPath, fileContent);
          logger.info(`Created backup at: ${backupPath}`);
        } catch (backupError) {
          logger.warn(`Failed to create backup: ${backupError}`);
        }

        logger.warn('Creating fresh default configuration...');

        try {
          const defaultConfig = createDefaultConfig();
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
          logger.info(`✓ Created fresh config at: ${CONFIG_FILE}`);
          logger.info(`Your old config is backed up at: ${backupPath}`);
          return defaultConfig;
        } catch (recreateError: any) {
          const errorMsg = `Failed to create fresh config: ${recreateError.message}\n\n` +
            `📝 Manual recovery needed:\n` +
            `  1. View backup: cat ${backupPath}\n` +
            `  2. Delete corrupt file: rm ${CONFIG_FILE}\n` +
            `  3. Run: g-coder setup\n` +
            `  4. Or restore from backup: cp ${backupPath} ${CONFIG_FILE}`;
          logger.error(errorMsg);
          throw new ConfigError('load configuration', new Error(errorMsg));
        }
      }
    }

    // Override with environment variables (only for API keys)
    config = this.applyEnvVariables(config);

    return config;
  }

  private applyEnvVariables(config: Config): Config {
    // Check environment variables for API keys
    if (process.env.OPENAI_API_KEY) {
      config.openaiApiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.DEEPSEEK_API_KEY) {
      config.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    }
    if (process.env.OLLAMA_URL) {
      config.ollamaUrl = process.env.OLLAMA_URL;
    }
    if (process.env.G_CODER_PROVIDER) {
      config.provider = process.env.G_CODER_PROVIDER as ProviderType;
    }
    if (process.env.G_CODER_MODEL) {
      config.model = process.env.G_CODER_MODEL;
    }

    return config;
  }

  private saveConfig(config: Config): void {
    try {
      // Don't save API keys to config file - they should be in .env
      const configToSave = { ...config };
      delete configToSave.openaiApiKey;
      delete configToSave.anthropicApiKey;
      delete configToSave.deepseekApiKey;

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2));
    } catch (error) {
      const configError = new ConfigError('save config', error);
      logger.error(configError.message);
      throw configError;
    }
  }

  get(): Config {
    return { ...this.config };
  }

  set(key: keyof Config, value: any): void {
    this.config[key] = value as never;
    this.saveConfig(this.config);
  }

  update(partial: Partial<Config>): void {
    this.config = { ...this.config, ...partial };
    this.saveConfig(this.config);
  }

  reset(): void {
    throw new Error('Reset is not available. Please manually edit your config.json file at: ' + CONFIG_FILE);
  }

  getConfigPath(): string {
    return CONFIG_FILE;
  }

  getEnvFilePath(): string {
    return ENV_FILE;
  }

  setApiKey(provider: 'openai' | 'anthropic' | 'deepseek', apiKey: string): void {
    // Save to .env file
    const envKey = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
    }[provider];

    this.updateEnvFile(envKey, apiKey);

    // Update in-memory config
    if (provider === 'openai') this.config.openaiApiKey = apiKey;
    if (provider === 'anthropic') this.config.anthropicApiKey = apiKey;
    if (provider === 'deepseek') this.config.deepseekApiKey = apiKey;
  }

  private updateEnvFile(key: string, value: string): void {
    try {
      let envContent = '';
      if (fs.existsSync(ENV_FILE)) {
        envContent = fs.readFileSync(ENV_FILE, 'utf-8');
      }

      const lines = envContent.split('\n');
      const keyIndex = lines.findIndex(line => line.startsWith(`${key}=`));

      if (keyIndex >= 0) {
        lines[keyIndex] = `${key}=${value}`;
      } else {
        lines.push(`${key}=${value}`);
      }

      fs.writeFileSync(ENV_FILE, lines.join('\n'));
    } catch (error) {
      const configError = new ConfigError('update .env file', error);
      logger.error(configError.message);
      throw configError;
    }
  }

  getApiKey(provider: 'openai' | 'anthropic' | 'deepseek'): string | undefined {
    if (provider === 'openai') return this.config.openaiApiKey;
    if (provider === 'anthropic') return this.config.anthropicApiKey;
    if (provider === 'deepseek') return this.config.deepseekApiKey;
    return undefined;
  }

  // Approval configuration methods
  getApprovalConfig(): ApprovalConfig {
    if (!this.config.approval) {
      this.config.approval = createDefaultApprovalConfig();
    }
    return { ...this.config.approval };
  }

  setApprovalEnabled(enabled: boolean): void {
    if (!this.config.approval) {
      this.config.approval = createDefaultApprovalConfig();
    }
    this.config.approval.enabled = enabled;
    this.saveConfig(this.config);
  }

  updateApprovalConfig(partial: Partial<ApprovalConfig>): void {
    if (!this.config.approval) {
      this.config.approval = createDefaultApprovalConfig();
    }
    this.config.approval = { ...this.config.approval, ...partial };
    this.saveConfig(this.config);
  }

  setToolApproval(toolName: string, requiresApproval: boolean): void {
    if (!this.config.approval) {
      this.config.approval = createDefaultApprovalConfig();
    }
    this.config.approval.toolsRequiringApproval[toolName] = requiresApproval;
    this.saveConfig(this.config);
  }
}

export const configManager = new ConfigManager();
