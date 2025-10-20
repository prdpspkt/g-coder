import OpenAI from 'openai';
import { AIProvider, AIMessage, ChatResponse } from './types';
import { logger } from '../utils/logger';
import { parseOpenAIToolCalls } from '../tools/converter';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  supportsNativeTools = true;
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(
    apiKey: string,
    model: string = 'gpt-4-turbo-preview',
    temperature: number = 0.7,
    maxTokens: number = 4096,
    baseURL?: string  // Support custom OpenAI-compatible endpoints
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL,  // Will use default if undefined
      timeout: 600000, // 10 minutes for large file generation
      maxRetries: 2,
    });
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    logger.debug(`Initialized OpenAI provider with baseURL: ${baseURL || 'default (https://api.openai.com/v1)'}`);
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('Failed to connect to OpenAI:', error);
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(m => m.id.includes('gpt'))
        .map(m => m.id)
        .sort();
    } catch (error) {
      logger.error('Failed to list OpenAI models:', error);
      return [];
    }
  }

  async chat(
    messages: AIMessage[],
    onChunk?: (chunk: string) => void,
    tools?: any[]
  ): Promise<string | ChatResponse> {
    try {
      const openaiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      const hasTools = tools && tools.length > 0;

      if (onChunk) {
        return await this.streamChat(openaiMessages, onChunk, tools);
      } else {
        const params: any = {
          model: this.model,
          messages: openaiMessages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        };

        if (hasTools) {
          params.tools = tools;
          params.tool_choice = 'auto';
        }

        const response = await this.client.chat.completions.create(params);

        const message = response.choices[0]?.message;
        const content = message?.content || '';

        // Check for tool calls
        if (hasTools && message?.tool_calls && message.tool_calls.length > 0) {
          return {
            content,
            toolCalls: parseOpenAIToolCalls(message.tool_calls),
          };
        }

        return content;
      }
    } catch (error: any) {
      logger.error('OpenAI chat request failed:', error.message);
      throw error;
    }
  }

  private async streamChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onChunk: (chunk: string) => void,
    tools?: any[]
  ): Promise<string | ChatResponse> {
    let fullResponse = '';
    const toolCalls: any[] = [];

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: true,
      ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {}),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullResponse += delta.content;
        onChunk(delta.content);
      }

      // Collect tool calls if streaming with tools
      if (delta?.tool_calls) {
        delta.tool_calls.forEach((tc: any) => {
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = {
              id: tc.id || '',
              type: 'function',
              function: { name: '', arguments: '' },
            };
          }

          if (tc.function?.name) {
            toolCalls[tc.index].function.name = tc.function.name;
          }

          if (tc.function?.arguments) {
            toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        });
      }
    }

    // Return with tool calls if present
    if (toolCalls.length > 0) {
      return {
        content: fullResponse,
        toolCalls: parseOpenAIToolCalls(toolCalls),
      };
    }

    return fullResponse;
  }

  setModel(model: string): void {
    this.model = model;
  }
}
