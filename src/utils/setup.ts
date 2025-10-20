import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { ProviderType } from '../providers/types';
import { configManager } from './config';
import { logger } from './logger';

const CONFIG_DIR = path.join(os.homedir(), '.g-coder');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

interface SetupResult {
  success: boolean;
  provider?: ProviderType;
  message?: string;
}

export class InteractiveSetup {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async run(): Promise<SetupResult> {
    console.log(chalk.cyan('\n🔧 G-Coder First-Time Setup\n'));
    console.log(chalk.gray('Let\'s get you started with AI-powered coding assistance!\n'));

    try {
      // Show provider options
      console.log(chalk.yellow('Select your AI provider:\n'));
      console.log('  1. DeepSeek (Recommended - Fast and affordable)');
      console.log('     Get API key: https://platform.deepseek.com/');
      console.log('');
      console.log('  2. OpenAI (GPT-4, GPT-3.5)');
      console.log('     Get API key: https://platform.openai.com/api-keys');
      console.log('');
      console.log('  3. Anthropic (Claude)');
      console.log('     Get API key: https://console.anthropic.com/');
      console.log('');
      console.log('  4. Ollama (Free, runs locally - no API key needed)');
      console.log('     Install: https://ollama.ai/download');
      console.log('');

      const choice = await this.question(chalk.cyan('Enter your choice (1-4): '));

      let provider: ProviderType;
      let keyName: string;
      let model: string;
      let needsApiKey = true;

      switch (choice.trim()) {
        case '1':
          provider = 'deepseek';
          keyName = 'DEEPSEEK_API_KEY';
          model = 'deepseek-chat';
          break;

        case '2':
          provider = 'openai';
          keyName = 'OPENAI_API_KEY';
          model = 'gpt-4-turbo-preview';
          break;

        case '3':
          provider = 'anthropic';
          keyName = 'ANTHROPIC_API_KEY';
          model = 'claude-3-5-sonnet-20241022';
          break;

        case '4':
          provider = 'ollama';
          keyName = '';
          model = 'codellama';
          needsApiKey = false;
          break;

        default:
          console.log(chalk.red('\n❌ Invalid choice\n'));
          this.rl.close();
          return { success: false, message: 'Invalid provider choice' };
      }

      // Get API key if needed
      let apiKey = '';
      if (needsApiKey) {
        console.log('');
        apiKey = await this.question(chalk.cyan(`Enter your ${provider} API key: `));

        if (!apiKey || apiKey.trim().length === 0) {
          console.log(chalk.red('\n❌ No API key provided\n'));
          this.rl.close();
          return { success: false, message: 'No API key provided' };
        }

        // Save API key to .env file
        this.saveApiKey(keyName, apiKey.trim());
        console.log(chalk.green(`\n✓ API key saved to ${ENV_FILE}`));
      } else {
        console.log(chalk.yellow('\n⚠️  Make sure Ollama is installed and running:'));
        console.log(chalk.gray('   ollama serve'));
        console.log(chalk.gray('   ollama pull codellama\n'));
      }

      // Update config
      try {
        const config = configManager.get();
        config.provider = provider;
        config.model = model;
        configManager.update(config);
        console.log(chalk.green(`✓ Configuration updated (provider: ${provider}, model: ${model})`));
      } catch (error) {
        logger.error('Failed to update config:', error);
      }

      console.log(chalk.green('\n✅ Setup complete! You can now run "g-coder" to start coding.\n'));

      this.rl.close();
      return { success: true, provider };
    } catch (error) {
      logger.error('Setup failed:', error);
      this.rl.close();
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private saveApiKey(keyName: string, apiKey: string): void {
    // Ensure directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(ENV_FILE)) {
      envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    }

    // Update or add the key
    const lines = envContent.split('\n');
    const keyIndex = lines.findIndex(line => line.startsWith(`${keyName}=`));

    if (keyIndex >= 0) {
      lines[keyIndex] = `${keyName}=${apiKey}`;
    } else {
      lines.push(`${keyName}=${apiKey}`);
    }

    // Write back to file
    fs.writeFileSync(ENV_FILE, lines.filter(l => l.trim()).join('\n') + '\n');
  }

  close(): void {
    this.rl.close();
  }
}

/**
 * Check if setup is needed (no provider configured or no API key for non-Ollama providers)
 */
export function needsSetup(): boolean {
  try {
    const config = configManager.get();

    // Check if provider is configured
    if (!config.provider) {
      return true;
    }

    // Ollama doesn't need API key
    if (config.provider === 'ollama') {
      return false;
    }

    // Check if API key exists for the configured provider
    const apiKey = configManager.getApiKey(config.provider as 'openai' | 'anthropic' | 'deepseek');
    if (!apiKey || apiKey.trim().length === 0) {
      return true;
    }

    return false;
  } catch (error) {
    // If config loading fails, we need setup
    return true;
  }
}
