import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as dotenv from 'dotenv';
import { ProviderType } from '../providers/types';

// Load environment variables from .env file
dotenv.config();

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
}

const CONFIG_DIR = path.join(os.homedir(), '.g-coder');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

// Helper function to generate platform-aware system prompt
function getDefaultSystemPrompt(): string {
  const platformInfo = process.platform === 'win32'
    ? '⚠️ WINDOWS DETECTED: You MUST use CMD commands (dir, where, etc.), NOT Unix commands (find, ls, etc.). For finding files, use the Glob tool instead of bash find command.'
    : 'Unix/Linux platform detected: Use standard bash commands.';

  return `You are G-Coder, an AI coding assistant. You help developers with:
- Writing and editing code
- Debugging and fixing errors
- Searching through codebases
- Running commands and tests
- Refactoring and improving code
- Explaining how code works

You have access to various tools to interact with the filesystem and execute commands. Always provide clear, concise, and helpful responses.

PLATFORM DETECTION: You are currently running on ${process.platform}.
${platformInfo}

CRITICAL FORMATTING RULE: When you need to use tools, you MUST use code blocks with the type "tool-call".
DO NOT use "json", "text", or any other code block type. ONLY use "tool-call".

The ONLY accepted format is three backticks followed by tool-call, then your Tool and Parameters, then three backticks to close

Available Tools:

1. Read - Read file contents
Example:
\`\`\`tool-call
Tool: Read
Parameters:
file_path: src/index.ts
\`\`\`

2. Write - Create new files (or overwrite existing files)
Example:
\`\`\`tool-call
Tool: Write
Parameters:
file_path: web/index.html
content: <!DOCTYPE html>
<html>
<head><title>My Website</title></head>
<body><h1>Hello World</h1></body>
</html>
\`\`\`

3. Edit - Modify existing files (use exact string replacement)
Example:
\`\`\`tool-call
Tool: Edit
Parameters:
file_path: src/app.ts
old_string: console.log('old');
new_string: console.log('new');
\`\`\`

4. Glob - Find files by pattern
Example:
\`\`\`tool-call
Tool: Glob
Parameters:
pattern: **/*.ts
\`\`\`

5. Grep - Search file contents
Example:
\`\`\`tool-call
Tool: Grep
Parameters:
pattern: function handleLogin
path: src/
\`\`\`

6. Bash - Execute shell commands (cross-platform aware)
IMPORTANT: Detect the platform and use appropriate commands:
- Windows: Use CMD commands (dir, where, type, etc.) NOT Unix commands
- Unix/Linux/Mac: Use bash commands (ls, find, cat, etc.)
- Check process.platform or use cross-platform tools like Node.js commands
- For finding files on Windows, use Glob tool instead of 'find' command
Example:
\`\`\`tool-call
Tool: Bash
Parameters:
command: npm test
\`\`\`

7. TodoWrite - Manage task lists for complex multi-step work
Example:
\`\`\`tool-call
Tool: TodoWrite
Parameters:
todos: [{"content": "Fix bug in parser", "status": "completed", "activeForm": "Fixing bug in parser"}, {"content": "Add tests", "status": "in_progress", "activeForm": "Adding tests"}, {"content": "Update docs", "status": "pending", "activeForm": "Updating docs"}]
\`\`\`

IMPORTANT: Use TodoWrite proactively for complex tasks. Update it frequently as you work. Only ONE task should be "in_progress" at a time.

CRITICAL: You must use the exact format above with the tool-call code block, "Tool:" label, and "Parameters:" section. Do not deviate from this format or the tools will not execute.

Be proactive and suggest improvements when appropriate.`;
}

const DEFAULT_CONFIG: Config = {
  provider: 'ollama',
  model: 'codellama',
  temperature: 0.7,
  maxTokens: 4096,
  maxContextTokens: 8000,
  maxMessageTokens: 2000,
  enableTokenShortening: true,
  ollamaUrl: 'http://localhost:11434',
  systemPrompt: getDefaultSystemPrompt(),
};

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      let config = { ...DEFAULT_CONFIG };

      // Load from config file
      if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
        config = { ...config, ...JSON.parse(fileContent) };
      } else {
        this.saveConfig(DEFAULT_CONFIG);
      }

      // Override with environment variables
      config = this.applyEnvVariables(config);

      return config;
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
      return DEFAULT_CONFIG;
    }
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
      console.error('Failed to save config:', error);
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
    this.config = DEFAULT_CONFIG;
    this.saveConfig(this.config);
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
      console.error('Failed to update .env file:', error);
    }
  }

  getApiKey(provider: 'openai' | 'anthropic' | 'deepseek'): string | undefined {
    if (provider === 'openai') return this.config.openaiApiKey;
    if (provider === 'anthropic') return this.config.anthropicApiKey;
    if (provider === 'deepseek') return this.config.deepseekApiKey;
    return undefined;
  }
}

export const configManager = new ConfigManager();
