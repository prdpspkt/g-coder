# Cloud AI Providers Guide

G-Coder v2.0+ supports multiple AI providers, giving you the flexibility to choose between local and cloud-based models.

## Supported Providers

- **Ollama** - Local, privacy-first (default)
- **OpenAI** - ChatGPT, GPT-4, GPT-3.5
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus
- **DeepSeek** - DeepSeek Coder, DeepSeek Chat

## Quick Start

### 1. Using Ollama (Local - Default)

```bash
# Start Ollama
ollama serve

# Pull a model
ollama pull codellama

# Run g-coder (uses Ollama by default)
g-coder
```

### 2. Using OpenAI

```bash
# Set your API key
export OPENAI_API_KEY=sk-your-key-here

# Switch provider
g-coder
> /provider openai
> /model gpt-4-turbo-preview

# Or set as default
echo "OPENAI_API_KEY=sk-your-key-here" >> ~/.g-coder/.env
```

### 3. Using Anthropic Claude

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Switch provider
g-coder
> /provider anthropic
> /model claude-3-5-sonnet-20241022

# Or set as default
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> ~/.g-coder/.env
```

### 4. Using DeepSeek

```bash
# Set your API key
export DEEPSEEK_API_KEY=sk-your-key-here

# Switch provider
g-coder
> /provider deepseek
> /model deepseek-coder

# Or set as default
echo "DEEPSEEK_API_KEY=sk-your-key-here" >> ~/.g-coder/.env
```

## Configuration Methods

### Method 1: Environment Variables (Recommended)

Create or edit `~/.g-coder/.env`:

```bash
# Choose your provider
G_CODER_PROVIDER=openai
G_CODER_MODEL=gpt-4-turbo-preview

# API Keys
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
DEEPSEEK_API_KEY=sk-your-key-here

# Ollama URL (if using Ollama)
OLLAMA_URL=http://localhost:11434
```

### Method 2: Interactive Commands

```bash
# Inside g-coder
> /provider openai
> /model gpt-4-turbo-preview
```

### Method 3: Configuration File

Edit `~/.g-coder/config.json`:

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7,
  "maxTokens": 4096
}
```

**Note:** Never put API keys in config.json - use environment variables or .env file!

## Provider Details

### Ollama (Local)

**Advantages:**
- ✅ Free
- ✅ 100% private
- ✅ No internet required
- ✅ No API costs

**Requirements:**
- Ollama installed
- Model downloaded locally
- Sufficient RAM/VRAM

**Recommended Models:**
- `codellama` - Meta's code-specialized model
- `deepseek-coder` - Excellent coding model
- `llama2` - General purpose

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start server
ollama serve

# Pull a model
ollama pull codellama

# Use with g-coder
g-coder
```

### OpenAI

**Advantages:**
- ✅ Most powerful models (GPT-4)
- ✅ Fast response times
- ✅ Large context windows

**Requirements:**
- OpenAI API key
- Internet connection
- Pay-per-use

**Recommended Models:**
- `gpt-4-turbo-preview` - Best for complex coding
- `gpt-4` - High quality
- `gpt-3.5-turbo` - Fast and economical

**Pricing (as of 2024):**
- GPT-4 Turbo: ~$0.01/1K tokens
- GPT-3.5 Turbo: ~$0.001/1K tokens

**Setup:**
```bash
# Get API key from https://platform.openai.com/api-keys

# Set environment variable
export OPENAI_API_KEY=sk-your-key-here

# Or add to ~/.g-coder/.env
echo "OPENAI_API_KEY=sk-your-key-here" >> ~/.g-coder/.env
echo "G_CODER_PROVIDER=openai" >> ~/.g-coder/.env
echo "G_CODER_MODEL=gpt-4-turbo-preview" >> ~/.g-coder/.env
```

### Anthropic Claude

**Advantages:**
- ✅ Excellent reasoning
- ✅ Large context (200K tokens)
- ✅ Strong safety features

**Requirements:**
- Anthropic API key
- Internet connection
- Pay-per-use

**Recommended Models:**
- `claude-3-5-sonnet-20241022` - Latest, best performance
- `claude-3-opus-20240229` - Highest intelligence
- `claude-3-sonnet-20240229` - Balanced

**Pricing (as of 2024):**
- Claude 3.5 Sonnet: ~$0.003/1K input tokens
- Claude 3 Opus: ~$0.015/1K input tokens

**Setup:**
```bash
# Get API key from https://console.anthropic.com/

# Set environment variable
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Or add to ~/.g-coder/.env
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> ~/.g-coder/.env
echo "G_CODER_PROVIDER=anthropic" >> ~/.g-coder/.env
echo "G_CODER_MODEL=claude-3-5-sonnet-20241022" >> ~/.g-coder/.env
```

### DeepSeek

**Advantages:**
- ✅ Specialized for coding
- ✅ Cost-effective
- ✅ Good performance

**Requirements:**
- DeepSeek API key
- Internet connection
- Pay-per-use

**Recommended Models:**
- `deepseek-coder` - Optimized for coding
- `deepseek-chat` - General purpose

**Pricing:**
- Very competitive pricing
- Check https://platform.deepseek.com/

**Setup:**
```bash
# Get API key from https://platform.deepseek.com/

# Set environment variable
export DEEPSEEK_API_KEY=sk-your-key-here

# Or add to ~/.g-coder/.env
echo "DEEPSEEK_API_KEY=sk-your-key-here" >> ~/.g-coder/.env
echo "G_CODER_PROVIDER=deepseek" >> ~/.g-coder/.env
echo "G_CODER_MODEL=deepseek-coder" >> ~/.g-coder/.env
```

## Switching Providers

### During Runtime

```bash
g-coder

# Check current provider
> /provider
Current provider: ollama

# Switch to OpenAI
> /provider openai
Provider changed to: openai
Please restart g-coder for changes to take effect

# Exit and restart
> exit

# Start again (now using OpenAI)
g-coder
```

### Before Starting

```bash
# Set environment variable
export G_CODER_PROVIDER=anthropic
export G_CODER_MODEL=claude-3-5-sonnet-20241022

# Start g-coder
g-coder
```

## Model Selection

### List Available Models

```bash
# For Ollama
ollama list

# For OpenAI/Anthropic/DeepSeek
# Models are predefined, check provider documentation
```

### Change Model

```bash
# Inside g-coder
> /model gpt-4-turbo-preview
Model changed to: gpt-4-turbo-preview
```

## Cost Comparison

| Provider | Model | Input (1K tokens) | Output (1K tokens) | Speed |
|----------|-------|-------------------|-------------------|-------|
| Ollama | codellama | Free | Free | Medium |
| OpenAI | gpt-4-turbo | $0.01 | $0.03 | Fast |
| OpenAI | gpt-3.5-turbo | $0.0005 | $0.0015 | Very Fast |
| Anthropic | claude-3.5-sonnet | $0.003 | $0.015 | Fast |
| DeepSeek | deepseek-coder | ~$0.001 | ~$0.002 | Fast |

## Security Best Practices

### API Key Storage

**✅ DO:**
- Store keys in `~/.g-coder/.env`
- Use environment variables
- Add `.env` to `.gitignore`
- Use key rotation
- Set usage limits on provider dashboards

**❌ DON'T:**
- Commit keys to git
- Share keys in code
- Store in config.json
- Use keys in public repos

### Example .gitignore

```
.g-coder/.env
.env
*.key
```

## Troubleshooting

### "Failed to connect to [Provider]"

**Ollama:**
```bash
# Check if running
ollama list

# Start if not running
ollama serve
```

**OpenAI/Anthropic/DeepSeek:**
```bash
# Check API key is set
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
echo $DEEPSEEK_API_KEY

# Verify key is valid (test with curl)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### "API key not found"

```bash
# Set environment variable
export OPENAI_API_KEY=sk-your-key-here

# Or add to .env file
echo "OPENAI_API_KEY=sk-your-key-here" >> ~/.g-coder/.env

# Restart g-coder
```

### "Rate limit exceeded"

- Wait and try again
- Upgrade your API plan
- Switch to different provider
- Use Ollama for unlimited local usage

### "Model not found"

```bash
# Check available models
> /provider
> /model

# Update to valid model name
> /model gpt-4-turbo-preview
```

## FAQ

### Which provider should I choose?

- **For privacy**: Ollama
- **For power**: OpenAI GPT-4 or Anthropic Claude
- **For cost**: DeepSeek or Ollama
- **For coding**: DeepSeek Coder, CodeLlama, or GPT-4

### Can I use multiple providers?

Yes! Switch between them:
```bash
> /provider ollama    # For local tasks
> /provider openai    # For complex tasks
```

### Do I need all API keys?

No, only for providers you want to use. Ollama works out of the box.

### How much will it cost?

Depends on usage. Example:
- 100K tokens/day with GPT-3.5: ~$0.15/day
- 100K tokens/day with Ollama: $0.00

### Is my code sent to the cloud?

- **Ollama**: No, everything stays local
- **OpenAI/Anthropic/DeepSeek**: Yes, check their privacy policies

### Can I self-host cloud models?

Not directly, but you can use Ollama to run similar open-source models locally.

## Advanced Configuration

### Custom Temperature

```bash
# Edit ~/.g-coder/config.json
{
  "temperature": 0.7,  // 0.0 = deterministic, 1.0 = creative
  "maxTokens": 4096
}
```

### Custom System Prompts

Edit `~/.g-coder/config.json` to customize how the AI behaves.

### Multiple Configurations

```bash
# Production (paid API)
G_CODER_PROVIDER=openai g-coder

# Development (free local)
G_CODER_PROVIDER=ollama g-coder
```

## Resources

- **OpenAI**: https://platform.openai.com/docs
- **Anthropic**: https://docs.anthropic.com/claude/docs
- **DeepSeek**: https://platform.deepseek.com/docs
- **Ollama**: https://ollama.com/library

---

For more information, see the main [README.md](README.md)
