export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  name: string;
  params: Record<string, any>;
  id?: string;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export interface AIProvider {
  name: string;
  supportsNativeTools?: boolean;
  checkConnection(): Promise<boolean>;
  chat(
    messages: AIMessage[],
    onChunk?: (chunk: string) => void,
    tools?: any[]
  ): Promise<string | ChatResponse>;
  listModels?(): Promise<string[]>;
}

// Provider type can be any string now (ollama, openai, deepseek, groq, custom, etc.)
export type ProviderType = string;

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}
