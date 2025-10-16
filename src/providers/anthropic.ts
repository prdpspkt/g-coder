import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIMessage, ChatResponse } from './types';
import { logger } from '../utils/logger';
import { parseAnthropicToolUse } from '../tools/converter';

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic';
  supportsNativeTools = true;
  private client: Anthropic;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(
    apiKey: string,
    model: string = 'claude-3-5-sonnet-20241022',
    temperature: number = 0.7,
    maxTokens: number = 4096
  ) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Test with a minimal request
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      logger.error('Failed to connect to Anthropic:', error);
      return false;
    }
  }

  async chat(
    messages: AIMessage[],
    onChunk?: (chunk: string) => void,
    tools?: any[]
  ): Promise<string | ChatResponse> {
    try {
      // Separate system message from conversation
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages
        .filter(m => m.role !== 'system')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

      const hasTools = tools && tools.length > 0;

      if (onChunk) {
        return await this.streamChat(conversationMessages, systemMessage?.content, onChunk, tools);
      } else {
        const params: any = {
          model: this.model,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          system: systemMessage?.content,
          messages: conversationMessages,
        };

        if (hasTools) {
          params.tools = tools;
        }

        const response = await this.client.messages.create(params);

        const textContent = response.content.find(c => c.type === 'text');
        const text = textContent && 'text' in textContent ? textContent.text : '';

        // Check for tool use
        const toolUse = parseAnthropicToolUse(response.content);
        if (hasTools && toolUse.length > 0) {
          return {
            content: text,
            toolCalls: toolUse.map(tu => ({
              name: tu.name,
              params: tu.params,
              id: tu.id,
            })),
          };
        }

        return text;
      }
    } catch (error: any) {
      logger.error('Anthropic chat request failed:', error.message);
      throw error;
    }
  }

  private async streamChat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void,
    tools?: any[]
  ): Promise<string | ChatResponse> {
    let fullResponse = '';
    const toolUseBlocks: any[] = [];

    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemPrompt,
      messages,
      stream: true,
      ...(tools && tools.length > 0 ? { tools } : {}),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        toolUseBlocks.push({
          id: event.content_block.id,
          name: event.content_block.name,
          input: {},
        });
      }

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          const content = event.delta.text;
          fullResponse += content;
          onChunk(content);
        } else if (event.delta.type === 'input_json_delta') {
          // Accumulate tool input
          const lastTool = toolUseBlocks[toolUseBlocks.length - 1];
          if (lastTool) {
            if (!lastTool.inputJson) {
              lastTool.inputJson = '';
            }
            lastTool.inputJson += event.delta.partial_json;
          }
        }
      }
    }

    // Parse tool use blocks
    const parsedTools = toolUseBlocks.map(block => {
      let input = {};
      if (block.inputJson) {
        try {
          input = JSON.parse(block.inputJson);
        } catch (e) {
          logger.warn('Failed to parse tool input JSON:', e);
        }
      }
      return {
        id: block.id,
        name: block.name,
        params: input,
      };
    });

    if (parsedTools.length > 0) {
      return {
        content: fullResponse,
        toolCalls: parsedTools,
      };
    }

    return fullResponse;
  }

  setModel(model: string): void {
    this.model = model;
  }
}
