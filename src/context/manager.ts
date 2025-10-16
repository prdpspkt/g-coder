import { AIMessage } from '../providers/types';
import { toolRegistry } from '../tools';

export class ContextManager {
  private messages: AIMessage[] = [];
  private systemPrompt: string;
  private maxContextLength: number;

  constructor(systemPrompt: string, maxContextLength: number = 20) {
    this.systemPrompt = systemPrompt;
    this.maxContextLength = maxContextLength;
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

    return [systemMessage, ...this.messages];
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
}
