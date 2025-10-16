import OpenAI from 'openai';
import { AIProvider, AIMessage } from './types';
import { logger } from '../utils/logger';

export class DeepSeekProvider implements AIProvider {
  name = 'DeepSeek';
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(
    apiKey: string,
    model: string = 'deepseek-coder',
    temperature: number = 0.7,
    maxTokens: number = 4096
  ) {
    // DeepSeek uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Test with a minimal request
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      logger.error('Failed to connect to DeepSeek:', error);
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    // DeepSeek has specific models
    return [
      'deepseek-coder',
      'deepseek-chat',
    ];
  }

  async chat(messages: AIMessage[], onChunk?: (chunk: string) => void): Promise<string> {
    try {
      const openaiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      if (onChunk) {
        return await this.streamChat(openaiMessages, onChunk);
      } else {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: openaiMessages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        });

        return response.choices[0]?.message?.content || '';
      }
    } catch (error: any) {
      logger.error('DeepSeek chat request failed:', error.message);
      throw error;
    }
  }

  private async streamChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    let fullResponse = '';

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    return fullResponse;
  }

  setModel(model: string): void {
    this.model = model;
  }
}
