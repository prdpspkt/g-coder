import { AIMessage } from '../providers/types';
import { toolRegistry } from '../tools';
import { Tokenizer } from '../utils/tokenizer';

export class ContextManager {
  private messages: AIMessage[] = [];
  private systemPrompt: string;
  private maxContextLength: number;
  private tokenizer: Tokenizer | null = null;
  private maxContextTokens: number;
  private maxMessageTokens: number;
  private enableTokenShortening: boolean;

  constructor(
    systemPrompt: string,
    maxContextLength: number = 20,
    options: {
      maxContextTokens?: number;
      maxMessageTokens?: number;
      enableTokenShortening?: boolean;
      modelName?: string;
    } = {}
  ) {
    this.systemPrompt = systemPrompt;
    this.maxContextLength = maxContextLength;
    this.maxContextTokens = options.maxContextTokens || 8000; // Default: 8k tokens
    this.maxMessageTokens = options.maxMessageTokens || 2000; // Default: 2k tokens per message
    this.enableTokenShortening = options.enableTokenShortening ?? true; // Default: enabled

    // Initialize tokenizer if shortening is enabled
    if (this.enableTokenShortening) {
      this.tokenizer = new Tokenizer(options.modelName || 'gpt-4');
    }
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content });
    this.trimContext();
  }

  addSystemMessage(content: string): void {
    this.messages.push({ role: 'system', content });
  }

  getMessages(): AIMessage[] {
    return this.messages;
  }

  getAIMessages(): AIMessage[] {
    const systemMessage: AIMessage = {
      role: 'system',
      content: this.buildSystemPrompt(),
    };

    const allMessages = [systemMessage, ...this.messages];

    // Apply token-based shortening if enabled
    if (this.enableTokenShortening && this.tokenizer) {
      return this.tokenizer.shortenMessages(
        allMessages,
        this.maxContextTokens,
        this.maxMessageTokens
      );
    }

    return allMessages;
  }

  private buildSystemPrompt(): string {
    const toolsDescription = toolRegistry.getDefinitions();

    return `${this.systemPrompt}

# Available Tools

You have access to the following tools to help with coding tasks:

${toolsDescription}

# Tool Usage

When you need to use a tool, format your response like this:

\`\`\`tool-call
Tool: ToolName
Parameters:
  parameter1: value1
  parameter2: value2
\`\`\`

After using a tool, you'll receive the result and can continue the conversation.

# Guidelines

1. Always read files before editing them
2. Use Glob to find files, then Read to examine them
3. Use Grep to search for specific patterns in code
4. Provide clear explanations of what you're doing
5. Suggest improvements when appropriate
6. Be concise but thorough in your responses`;
  }

  private trimContext(): void {
    // Keep system message and trim old messages if exceeding max length
    if (this.messages.length > this.maxContextLength) {
      this.messages = this.messages.slice(-this.maxContextLength);
    }
  }

  clear(): void {
    this.messages = [];
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getContextSize(): number {
    return this.messages.length;
  }

  /**
   * Get the estimated token count for the current context
   */
  getTokenCount(): number {
    if (!this.tokenizer) {
      return 0;
    }

    const allMessages = this.getAIMessages();
    return this.tokenizer.countMessagesTokens(allMessages);
  }

  /**
   * Update token shortening settings
   */
  setTokenLimits(maxContextTokens: number, maxMessageTokens?: number): void {
    this.maxContextTokens = maxContextTokens;
    if (maxMessageTokens !== undefined) {
      this.maxMessageTokens = maxMessageTokens;
    }
  }

  /**
   * Enable or disable token-based shortening
   */
  setTokenShortening(enabled: boolean, modelName?: string): void {
    this.enableTokenShortening = enabled;

    if (enabled && !this.tokenizer) {
      this.tokenizer = new Tokenizer(modelName || 'gpt-4');
    } else if (!enabled && this.tokenizer) {
      this.tokenizer.free();
      this.tokenizer = null;
    }
  }

  exportContext(): string {
    return JSON.stringify({
      systemPrompt: this.systemPrompt,
      messages: this.messages,
    }, null, 2);
  }

  importContext(context: string): void {
    try {
      const data = JSON.parse(context);
      this.systemPrompt = data.systemPrompt || this.systemPrompt;
      this.messages = data.messages || [];
    } catch (error) {
      throw new Error('Failed to import context: invalid format');
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.tokenizer) {
      this.tokenizer.free();
      this.tokenizer = null;
    }
  }
}
