import { Tool, ToolDefinition } from './types';

/**
 * Converts tool definitions to OpenAI function calling format
 */
export function toOpenAITools(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.definition.name,
      description: tool.definition.description,
      parameters: {
        type: 'object',
        properties: toOpenAIProperties(tool.definition.parameters),
        required: tool.definition.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    },
  }));
}

function toOpenAIProperties(params: ToolDefinition['parameters']): Record<string, any> {
  const properties: Record<string, any> = {};

  for (const param of params) {
    properties[param.name] = {
      type: mapTypeToOpenAI(param.type),
      description: param.description,
    };

    if (param.default !== undefined) {
      properties[param.name].default = param.default;
    }

    // Handle array types
    if (param.type === 'array') {
      properties[param.name].items = { type: 'string' };
    }
  }

  return properties;
}

function mapTypeToOpenAI(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
  };

  return typeMap[type] || 'string';
}

/**
 * Converts tool definitions to Anthropic tool format
 */
export function toAnthropicTools(tools: Tool[]): any[] {
  return tools.map((tool) => ({
    name: tool.definition.name,
    description: tool.definition.description,
    input_schema: {
      type: 'object',
      properties: toAnthropicProperties(tool.definition.parameters),
      required: tool.definition.parameters
        .filter((p) => p.required)
        .map((p) => p.name),
    },
  }));
}

function toAnthropicProperties(params: ToolDefinition['parameters']): Record<string, any> {
  const properties: Record<string, any> = {};

  for (const param of params) {
    properties[param.name] = {
      type: mapTypeToAnthropic(param.type),
      description: param.description,
    };

    if (param.default !== undefined) {
      properties[param.name].default = param.default;
    }

    // Handle array types
    if (param.type === 'array') {
      properties[param.name].items = { type: 'string' };
    }
  }

  return properties;
}

function mapTypeToAnthropic(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
  };

  return typeMap[type] || 'string';
}

/**
 * Parse OpenAI tool calls from response
 */
export function parseOpenAIToolCalls(toolCalls: any[]): Array<{ name: string; params: Record<string, any> }> {
  return toolCalls.map((tc) => ({
    name: tc.function.name,
    params: JSON.parse(tc.function.arguments),
  }));
}

/**
 * Parse Anthropic tool use blocks from response
 */
export function parseAnthropicToolUse(content: any[]): Array<{ name: string; params: Record<string, any>; id: string }> {
  return content
    .filter((block) => block.type === 'tool_use')
    .map((block) => ({
      id: block.id,
      name: block.name,
      params: block.input,
    }));
}
