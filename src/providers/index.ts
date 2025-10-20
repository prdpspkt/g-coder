import { AIProvider, ProviderType, ProviderConfig } from './types';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { DeepSeekProvider } from './deepseek';
import { logger } from '../utils/logger';

export class ProviderFactory {
  static create(config: ProviderConfig): AIProvider {
    // Ollama uses its own provider (no API key needed)
    if (config.type === 'ollama') {
      return new OllamaProvider(
        config.baseUrl || 'http://localhost:11434',
        config.model
      );
    }

    // Anthropic uses its own API format (not OpenAI-compatible)
    if (config.type === 'anthropic') {
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
    }

    // All other providers use OpenAI-compatible API
    // (OpenAI, DeepSeek, Groq, Together, custom providers, etc.)
    if (!config.apiKey) {
      const envPath = require('path').join(require('os').homedir(), '.g-coder', '.env');
      throw new Error(
        `API key is required for provider "${config.type}".\n\n` +
        `Add your API key to: ${envPath}\n` +
        `Example: ${config.type.toUpperCase()}_API_KEY=your-key-here\n\n` +
        `Or set in config.json:\n` +
        `  "apiKeyName": "${config.type.toUpperCase()}_API_KEY"\n\n` +
        `Or set environment variable:\n` +
        `export G_CODER_API_KEY=your-key-here`
      );
    }

    // Use OpenAI provider for all OpenAI-compatible APIs
    return new OpenAIProvider(
      config.apiKey,
      config.model,
      config.temperature,
      config.maxTokens,
      config.baseUrl  // Pass custom baseUrl
    );
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
