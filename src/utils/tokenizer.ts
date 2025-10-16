import { Tiktoken, encodingForModel } from 'js-tiktoken';
import { AIMessage } from '../providers/types';

/**
 * Tokenizer utility for counting and managing tokens in messages
 * Supports multiple model encodings (GPT-4, GPT-3.5, Claude)
 */
export class Tokenizer {
  private encoder: Tiktoken;
  private modelName: string;

  constructor(modelName: string = 'gpt-4') {
    this.modelName = modelName;
    // Map model names to tiktoken encodings
    const encoding = this.getEncodingForModel(modelName);
    this.encoder = encodingForModel(encoding);
  }

  /**
   * Map various model names to their appropriate encoding
   */
  private getEncodingForModel(model: string): 'gpt-4' | 'gpt-3.5-turbo' | 'text-davinci-003' {
    const lowerModel = model.toLowerCase();

    // Claude and DeepSeek models use similar tokenization to GPT-4
    if (lowerModel.includes('claude') || lowerModel.includes('deepseek')) {
      return 'gpt-4';
    }

    // GPT-4 and newer models
    if (lowerModel.includes('gpt-4') || lowerModel.includes('gpt4')) {
      return 'gpt-4';
    }

    // GPT-3.5 models
    if (lowerModel.includes('gpt-3.5') || lowerModel.includes('turbo')) {
      return 'gpt-3.5-turbo';
    }

    // Default to GPT-4 encoding for unknown models (Ollama, etc.)
    return 'gpt-4';
  }

  /**
   * Count tokens in a single text string
   */
  countTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch (error) {
      // Fallback to rough estimation if encoding fails
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Count tokens in a message including role overhead
   * Different APIs have different message formatting overhead
   */
  countMessageTokens(message: AIMessage): number {
    // Base tokens for the message content
    let tokens = this.countTokens(message.content);

    // Add overhead for message formatting
    // Based on OpenAI's token counting: https://platform.openai.com/docs/guides/chat/managing-tokens
    tokens += 4; // Every message follows <|start|>{role}\n{content}<|end|>\n
    tokens += this.countTokens(message.role); // Role name tokens

    return tokens;
  }

  /**
   * Count total tokens in an array of messages
   */
  countMessagesTokens(messages: AIMessage[]): number {
    let total = 0;

    for (const message of messages) {
      total += this.countMessageTokens(message);
    }

    // Add overhead for message array formatting
    total += 3; // Every reply is primed with <|start|>assistant<|message|>

    return total;
  }

  /**
   * Estimate tokens without encoding (faster but less accurate)
   * Uses the common approximation: 1 token ≈ 4 characters for English text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Shorten a single message to fit within token limit
   * Preserves the beginning and end, removing from the middle
   */
  shortenMessage(content: string, maxTokens: number): string {
    const currentTokens = this.countTokens(content);

    if (currentTokens <= maxTokens) {
      return content;
    }

    // Reserve tokens for the truncation indicator
    const indicatorText = '\n\n[... content truncated to fit token limit ...]\n\n';
    const indicatorTokens = this.countTokens(indicatorText);
    const availableTokens = maxTokens - indicatorTokens;

    if (availableTokens <= 0) {
      return indicatorText;
    }

    // Keep 60% from the beginning, 40% from the end
    const beginningTokens = Math.floor(availableTokens * 0.6);
    const endTokens = availableTokens - beginningTokens;

    const beginning = this.getFirstNTokens(content, beginningTokens);
    const end = this.getLastNTokens(content, endTokens);

    return beginning + indicatorText + end;
  }

  /**
   * Get the first N tokens from text
   */
  private getFirstNTokens(text: string, n: number): string {
    try {
      const tokens = this.encoder.encode(text);
      const sliced = tokens.slice(0, n);
      return this.encoder.decode(sliced);
    } catch (error) {
      // Fallback: estimate character count
      const chars = n * 4;
      return text.substring(0, chars);
    }
  }

  /**
   * Get the last N tokens from text
   */
  private getLastNTokens(text: string, n: number): string {
    try {
      const tokens = this.encoder.encode(text);
      const sliced = tokens.slice(-n);
      return this.encoder.decode(sliced);
    } catch (error) {
      // Fallback: estimate character count
      const chars = n * 4;
      return text.substring(text.length - chars);
    }
  }

  /**
   * Shorten messages array to fit within total token limit
   * Strategy:
   * 1. Always preserve the system message (first message)
   * 2. Keep the most recent messages (they have the most context)
   * 3. Remove messages from the middle of the conversation
   * 4. If individual messages are too large, truncate them
   */
  shortenMessages(
    messages: AIMessage[],
    maxTotalTokens: number,
    maxMessageTokens: number = 2000
  ): AIMessage[] {
    if (messages.length === 0) {
      return messages;
    }

    // Separate system message from conversation messages
    const systemMessage = messages[0].role === 'system' ? messages[0] : null;
    const conversationMessages = systemMessage ? messages.slice(1) : messages;

    // Calculate system message tokens
    const systemTokens = systemMessage ? this.countMessageTokens(systemMessage) : 0;
    const availableTokens = maxTotalTokens - systemTokens;

    if (availableTokens <= 0) {
      // If system message exceeds limit, truncate it
      if (systemMessage) {
        return [{
          ...systemMessage,
          content: this.shortenMessage(systemMessage.content, maxTotalTokens)
        }];
      }
      return [];
    }

    // First pass: truncate individual messages that are too long
    const truncatedMessages = conversationMessages.map(msg => {
      const tokens = this.countTokens(msg.content);
      if (tokens > maxMessageTokens) {
        return {
          ...msg,
          content: this.shortenMessage(msg.content, maxMessageTokens)
        };
      }
      return msg;
    });

    // Second pass: remove old messages until we fit in the token limit
    // Keep messages from the end (most recent)
    const result: AIMessage[] = [];
    let currentTokens = 0;

    for (let i = truncatedMessages.length - 1; i >= 0; i--) {
      const msgTokens = this.countMessageTokens(truncatedMessages[i]);

      if (currentTokens + msgTokens <= availableTokens) {
        result.unshift(truncatedMessages[i]);
        currentTokens += msgTokens;
      } else {
        // We've run out of space, stop adding messages
        break;
      }
    }

    // Add system message back at the beginning
    if (systemMessage) {
      return [systemMessage, ...result];
    }

    return result;
  }

  /**
   * Clean up resources
   */
  free(): void {
    // js-tiktoken encoders are automatically garbage collected
    // No explicit free() method needed
  }
}

/**
 * Create a tokenizer instance for a specific model
 */
export function createTokenizer(modelName: string = 'gpt-4'): Tokenizer {
  return new Tokenizer(modelName);
}

/**
 * Quick utility to count tokens without creating a tokenizer instance
 */
export function quickCountTokens(text: string, modelName: string = 'gpt-4'): number {
  const tokenizer = createTokenizer(modelName);
  const count = tokenizer.countTokens(text);
  // No need to call free(), tokenizer will be garbage collected
  return count;
}
