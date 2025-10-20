# G-Coder Configuration Guide

G-Coder supports **any OpenAI-compatible API provider**. This means you can use Ollama, DeepSeek, OpenAI, Anthropic, Groq, Together AI, or any custom provider.

## Quick Start

By default, G-Coder creates a config for **Ollama** (local, no API key needed):

```json
{
  "provider": "ollama",
  "model": "codellama",
  "baseUrl": "http://localhost:11434/v1",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

## Configuration Structure

### Core Fields

- **provider**: Provider name (can be anything: `ollama`, `deepseek`, `openai`, `groq`, `custom`, etc.)
- **model**: Model name to use
- **baseUrl**: API endpoint URL
- **temperature**: Response randomness (0.0-1.0)
- **maxTokens**: Maximum tokens per response

### API Key Configuration (3 methods)

#### Method 1: Environment Variable Name (Recommended)
```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKeyName": "DEEPSEEK_API_KEY"
}
```

Then in `~/.g-coder/.env`:
```bash
DEEPSEEK_API_KEY=sk-your-key-here
```

#### Method 2: Direct in Config (Not Recommended)
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-your-key-here"
}
```

#### Method 3: Global Environment Variable
```bash
export G_CODER_API_KEY=your-key-here
```

## Provider Examples

### Ollama (Local, Free)

```json
{
  "provider": "ollama",
  "model": "codellama",
  "baseUrl": "http://localhost:11434/v1",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

Setup:
```bash
# Install Ollama
brew install ollama  # macOS
# or download from https://ollama.ai/download

# Start Ollama
ollama serve

# Pull a model
ollama pull codellama
# or: ollama pull deepseek-coder, llama3, mistral, etc.
```

### DeepSeek

```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKeyName": "DEEPSEEK_API_KEY",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

Setup:
```bash
echo "DEEPSEEK_API_KEY=sk-your-key" >> ~/.g-coder/.env
```

Get key: https://platform.deepseek.com/

### OpenAI

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo-preview",
  "baseUrl": "https://api.openai.com/v1",
  "apiKeyName": "OPENAI_API_KEY",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

Setup:
```bash
echo "OPENAI_API_KEY=sk-your-key" >> ~/.g-coder/.env
```

Get key: https://platform.openai.com/api-keys

### Anthropic Claude

```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "baseUrl": "https://api.anthropic.com/v1",
  "apiKeyName": "ANTHROPIC_API_KEY",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

Setup:
```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key" >> ~/.g-coder/.env
```

Get key: https://console.anthropic.com/

### Groq (Fast Inference)

```json
{
  "provider": "groq",
  "model": "llama-3.1-70b-versatile",
  "baseUrl": "https://api.groq.com/openai/v1",
  "apiKeyName": "GROQ_API_KEY",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

Setup:
```bash
echo "GROQ_API_KEY=gsk-your-key" >> ~/.g-coder/.env
```

Get key: https://console.groq.com/

### Together AI

```json
{
  "provider": "together",
  "model": "meta-llama/Llama-3-70b-chat-hf",
  "baseUrl": "https://api.together.xyz/v1",
  "apiKeyName": "TOGETHER_API_KEY",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

Setup:
```bash
echo "TOGETHER_API_KEY=your-key" >> ~/.g-coder/.env
```

Get key: https://api.together.xyz/

### Custom OpenAI-Compatible Provider

```json
{
  "provider": "my-custom-provider",
  "model": "my-custom-model",
  "baseUrl": "https://my-api.example.com/v1",
  "apiKeyName": "MY_CUSTOM_API_KEY",
  "temperature": 0.7,
  "maxTokens": 8192
}
```

Setup:
```bash
echo "MY_CUSTOM_API_KEY=your-key" >> ~/.g-coder/.env
```

## Advanced Configuration

### Token Management

```json
{
  "maxContextTokens": 64000,
  "maxMessageTokens": 8192,
  "enableTokenShortening": true
}
```

### Approval System

```json
{
  "approval": {
    "enabled": true,
    "toolsRequiringApproval": {
      "Bash": true,
      "Write": true,
      "Edit": true,
      "GitCommit": true,
      "GitPush": true
    },
    "autoApprovePatterns": [
      "npm install",
      "git status"
    ]
  }
}
```

### System Prompt

```json
{
  "systemPrompt": "You are a helpful coding assistant..."
}
```

## Environment Variables

You can override any config setting with environment variables:

```bash
# Override provider and model
export G_CODER_PROVIDER=groq
export G_CODER_MODEL=llama-3.1-70b-versatile

# Override API endpoint
export G_CODER_BASE_URL=https://api.groq.com/openai/v1

# Override API key
export G_CODER_API_KEY=your-key-here
```

## File Locations

- Config: `~/.g-coder/config.json`
- Environment: `~/.g-coder/.env`
- Logs: `~/.g-coder/logs/g-coder.log`
- Project history: `<project>/.g-coder/conversation-history.json`

## Complete Example

`~/.g-coder/config.json`:
```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKeyName": "DEEPSEEK_API_KEY",
  "temperature": 0.7,
  "maxTokens": 8192,
  "maxContextTokens": 64000,
  "enableTokenShortening": true,
  "systemPrompt": "You are G-Coder, a precise coding assistant...",
  "approval": {
    "enabled": true,
    "toolsRequiringApproval": {
      "Bash": true,
      "Write": true,
      "Edit": true
    }
  }
}
```

`~/.g-coder/.env`:
```bash
DEEPSEEK_API_KEY=sk-your-deepseek-key-here
```

## Switching Providers

To switch providers, just edit `config.json` and update the `.env` file:

```bash
# Switch from DeepSeek to Groq
# 1. Update config.json
{
  "provider": "groq",
  "model": "llama-3.1-70b-versatile",
  "baseUrl": "https://api.groq.com/openai/v1",
  "apiKeyName": "GROQ_API_KEY"
}

# 2. Add API key to .env
echo "GROQ_API_KEY=gsk-your-key" >> ~/.g-coder/.env

# 3. Done! Run g-coder
```

## Troubleshooting

### "API key is required"
- Check `~/.g-coder/.env` has your API key
- Verify `apiKeyName` matches the env variable name
- Or set `G_CODER_API_KEY` environment variable

### "Failed to connect"
- Verify `baseUrl` is correct
- Check internet connection
- For Ollama: ensure `ollama serve` is running

### Config file corrupted
- G-Coder will auto-create a backup and fresh config
- Check `~/.g-coder/config.json.backup.*` for old config

## See Also

- [Provider examples](./config.examples.json)
- [README](./README.md)
- [GitHub Issues](https://github.com/prdpspkt/g-coder/issues)
