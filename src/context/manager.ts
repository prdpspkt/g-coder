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

# File Creation - PREFERRED METHOD (Artifacts)

When creating or updating files, use file artifacts instead of Write tool:

\`\`\`javascript src/example.js
function hello() {
  console.log("Hello World");
}
\`\`\`

Format: \`\`\`<language> <filepath>
- Files are written automatically to disk
- No need to use Write tool
- Show concise progress messages instead of streaming full file contents
- Supports: .ts .js .tsx .jsx .py .java .cpp .c .h .css .html .json .md .txt .sh .yml .yaml .xml .go .rs .rb .php .sql .env

# Tool Usage (For operations other than file creation)

When you need to use a tool (Read, Edit, Bash, etc.), format like this:

\`\`\`tool-call
Tool: ToolName
Parameters:
  parameter1: value1
  parameter2: value2
\`\`\`

After using a tool, you'll receive the result and can continue the conversation.

# Guidelines

1. For creating/updating files: Use file artifacts (code blocks with filepath)
2. For reading files: Use Read tool
3. For editing existing files: Use Edit tool for small changes, artifacts for rewrites
4. For finding files: Use Glob tool
5. For searching code: Use Grep tool
6. For bash commands: Use Bash tool
7. Always provide clear, concise explanations
8. Don't stream entire file contents to console - write them as artifacts`;
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
