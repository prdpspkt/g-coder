import axios, { AxiosInstance } from 'axios';
import { AIProvider, AIMessage } from './types';
import { logger } from '../utils/logger';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private client: AxiosInstance;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'codellama') {
    this.baseUrl = baseUrl;
    this.model = model;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 300000, // 5 minutes
    });
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.get('/api/tags');
      return true;
    } catch (error) {
      logger.error('Failed to connect to Ollama:', error);
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models.map((model: any) => model.name);
    } catch (error) {
      logger.error('Failed to list models:', error);
      return [];
    }
  }

  async chat(messages: AIMessage[], onChunk?: (chunk: string) => void): Promise<string> {
    try {
      const ollamaMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const request = {
        model: this.model,
        messages: ollamaMessages,
        stream: !!onChunk,
      };

      if (onChunk) {
        return await this.streamChat(request, onChunk);
      } else {
        const response = await this.client.post('/api/chat', request);
        return response.data.message.content;
      }
    } catch (error: any) {
      logger.error('Chat request failed:', error.message);
      throw error;
    }
  }

  private async streamChat(request: any, onChunk: (chunk: string) => void): Promise<string> {
    let fullResponse = '';
    let isDone = false;

    const response = await this.client.post('/api/chat', request, {
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              const content = parsed.message.content;
              fullResponse += content;
              onChunk(content);
            }

            if (parsed.done) {
              isDone = true;
              resolve(fullResponse);
            }
          } catch (error) {
            // Skip invalid JSON lines
          }
        }
      });

      response.data.on('error', (error: Error) => {
        reject(error);
      });

      response.data.on('end', () => {
        // Only resolve if we haven't received the done signal
        // This handles cases where the stream ends without a done flag
        if (!isDone) {
          logger.warn('Stream ended without done signal, resolving with partial response');
          resolve(fullResponse);
        }
      });
    });
  }

  setModel(model: string): void {
    this.model = model;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
    this.client = axios.create({
      baseURL: url,
      timeout: 300000,
    });
  }
}
