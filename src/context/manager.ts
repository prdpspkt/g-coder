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

IMPORTANT: Always use file artifacts for creating/updating files. DO NOT use Write tool.

Format: \`\`\`<language> <filepath>

Example:
\`\`\`javascript src/example.js
function hello() {
  console.log("Hello World");
}
\`\`\`

Example for text files:
\`\`\`txt todolist.txt
TODO LIST
=========
1. First task
2. Second task
3. Third task
\`\`\`

Rules:
- Write COMPLETE file content in one artifact block
- Include ALL lines - don't truncate or abbreviate
- Files are automatically written to disk from the artifact
- Never use Write tool - always use artifacts for file creation
- Supported extensions: .ts .js .tsx .jsx .py .java .cpp .c .h .css .html .json .md .txt .sh .yml .yaml .xml .go .rs .rb .php .sql .env

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
6. For bash commands: Use Bash tool (runs in CMD on Windows, bash on Linux/Mac)
   - Use commands directly without shell wrappers
   - Examples: "npm install", "git status", "dir" (Windows), "ls" (Linux/Mac)
7. Before implementing features: Search codebase to check if feature already exists (use Grep/Glob tools)
8. Before creating directories: Check if they exist using Bash tool (e.g., "test -d dirname && echo exists || echo not exists")
9. Always provide clear, concise explanations
10. Don't stream entire file contents to console - write them as artifacts`;
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
   * Check if we're approaching token limit (90% threshold)
   */
  isApproachingTokenLimit(): boolean {
    if (!this.tokenizer) {
      return false;
    }

    const currentTokens = this.getTokenCount();
    const threshold = this.maxContextTokens * 0.9; // 90% threshold
    return currentTokens >= threshold;
  }

  /**
   * Check if token limit is exceeded
   */
  isTokenLimitExceeded(): boolean {
    if (!this.tokenizer) {
      return false;
    }

    const currentTokens = this.getTokenCount();
    return currentTokens >= this.maxContextTokens;
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
   * Compact conversation by summarizing older messages
   * Keeps recent messages intact and replaces older ones with a summary
   */
  async compactConversation(provider: any, keepRecentCount: number = 10): Promise<{success: boolean; messagesBefore: number; messagesAfter: number; summary?: string}> {
    const messageCount = this.messages.length;

    // Not enough messages to compact
    if (messageCount <= keepRecentCount) {
      return {
        success: false,
        messagesBefore: messageCount,
        messagesAfter: messageCount
      };
    }

    // Split messages into old (to summarize) and recent (to keep)
    const messagesToSummarize = this.messages.slice(0, -keepRecentCount);
    const recentMessages = this.messages.slice(-keepRecentCount);

    // Create a summary prompt
    const conversationText = messagesToSummarize
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    const summaryPrompt = `Please provide a concise summary of the following conversation history. Focus on key points, decisions made, and important context that should be preserved. Keep it under 500 words.

Conversation:
${conversationText}

Summary:`;

    try {
      // Get summary from AI
      const summary = await provider.chat([
        { role: 'user', content: summaryPrompt }
      ], () => {});

      const summaryContent = typeof summary === 'string' ? summary : summary.content;

      // Replace old messages with summary
      this.messages = [
        {
          role: 'system',
          content: `[Previous Conversation Summary]\n${summaryContent}\n[End of Summary]`
        },
        ...recentMessages
      ];

      return {
        success: true,
        messagesBefore: messageCount,
        messagesAfter: this.messages.length,
        summary: summaryContent
      };
    } catch (error) {
      return {
        success: false,
        messagesBefore: messageCount,
        messagesAfter: messageCount
      };
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
