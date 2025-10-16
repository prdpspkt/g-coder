import axios, { AxiosInstance } from 'axios';
import { OllamaMessage, OllamaRequest, OllamaResponse } from '../tools/types';
import { logger } from '../utils/logger';

export class OllamaClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 300000, // 5 minutes for long responses
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

  async chat(
    model: string,
    messages: OllamaMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      const request: OllamaRequest = {
        model,
        messages,
        stream: !!onChunk,
      };

      if (onChunk) {
        return await this.streamChat(request, onChunk);
      } else {
        return await this.nonStreamChat(request);
      }
    } catch (error: any) {
      logger.error('Chat request failed:', error.message);
      throw error;
    }
  }

  private async nonStreamChat(request: OllamaRequest): Promise<string> {
    const response = await this.client.post<OllamaResponse>(
      '/api/chat',
      request
    );
    return response.data.message.content;
  }

  private async streamChat(
    request: OllamaRequest,
    onChunk: (chunk: string) => void
  ): Promise<string> {
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

  async generate(
    model: string,
    prompt: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      const request = {
        model,
        prompt,
        stream: !!onChunk,
      };

      if (onChunk) {
        return await this.streamGenerate(request, onChunk);
      } else {
        const response = await this.client.post('/api/generate', request);
        return response.data.response;
      }
    } catch (error: any) {
      logger.error('Generate request failed:', error.message);
      throw error;
    }
  }

  private async streamGenerate(
    request: any,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    let fullResponse = '';
    let isDone = false;

    const response = await this.client.post('/api/generate', request, {
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullResponse += parsed.response;
              onChunk(parsed.response);
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

  setBaseUrl(url: string): void {
    this.baseUrl = url;
    this.client = axios.create({
      baseURL: url,
      timeout: 300000,
    });
  }
}
