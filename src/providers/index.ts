import { AIProvider, ProviderType, ProviderConfig } from './types';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { DeepSeekProvider } from './deepseek';
import { logger } from '../utils/logger';

export class ProviderFactory {
  static create(config: ProviderConfig): AIProvider {
    switch (config.type) {
      case 'ollama':
        return new OllamaProvider(
          config.baseUrl || 'http://localhost:11434',
          config.model
        );

      case 'openai':
        if (!config.apiKey) {
          const envPath = require('path').join(require('os').homedir(), '.g-coder', '.env');
          throw new Error(
            `OpenAI API key is required.\n\n` +
            `Add your API key to: ${envPath}\n` +
            `Example: OPENAI_API_KEY=your-key-here\n\n` +
            `Or set environment variable:\n` +
            `export OPENAI_API_KEY=your-key-here`
          );
        }
        return new OpenAIProvider(
          config.apiKey,
          config.model,
          config.temperature,
          config.maxTokens
        );

      case 'anthropic':
        if (!config.apiKey) {
          const envPath = require('path').join(require('os').homedir(), '.g-coder', '.env');
          throw new Error(
            `Anthropic API key is required.\n\n` +
            `Add your API key to: ${envPath}\n` +
            `Example: ANTHROPIC_API_KEY=your-key-here\n\n` +
            `Or set environment variable:\n` +
            `export ANTHROPIC_API_KEY=your-key-here`
          );
        }
        return new AnthropicProvider(
          config.apiKey,
          config.model,
          config.temperature,
          config.maxTokens
        );

      case 'deepseek':
        if (!config.apiKey) {
          const envPath = require('path').join(require('os').homedir(), '.g-coder', '.env');
          throw new Error(
            `DeepSeek API key is required.\n\n` +
            `Add your API key to: ${envPath}\n` +
            `Example: DEEPSEEK_API_KEY=your-key-here\n\n` +
            `Or set environment variable:\n` +
            `export DEEPSEEK_API_KEY=your-key-here`
          );
        }
        return new DeepSeekProvider(
          config.apiKey,
          config.model,
          config.temperature,
          config.maxTokens
        );

      default:
        logger.error(`Unknown provider type: ${config.type}`);
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  static getDefaultModel(provider: ProviderType): string {
    switch (provider) {
      case 'ollama':
        return 'codellama';
      case 'openai':
        return 'gpt-4-turbo-preview';
      case 'anthropic':
        return 'claude-3-5-sonnet-20241022';
      case 'deepseek':
        return 'deepseek-coder';
      default:
        return 'codellama';
    }
  }

  static getSupportedProviders(): ProviderType[] {
    return ['ollama', 'openai', 'anthropic', 'deepseek'];
  }
}

export * from './types';
export { OllamaProvider } from './ollama';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { DeepSeekProvider } from './deepseek';
