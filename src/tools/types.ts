export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
}

export interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, any>): Promise<ToolResult>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface OllamaMessage {
  role: string;
  content: string;
}

export interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
}

export interface Config {
  ollamaUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}
