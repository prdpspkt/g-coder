# G-Coder

**AI-powered CLI coding assistant supporting Ollama, OpenAI, Claude, DeepSeek and more**

G-Coder is a command-line interface tool that brings AI-powered coding assistance to your terminal. Choose between local models (Ollama) for privacy or cloud providers (OpenAI, Anthropic, DeepSeek) for power. It provides intelligent code completion, refactoring, debugging, and much more.

## Features

- 🌐 **Multiple AI Providers**: Ollama (local), OpenAI, Anthropic Claude, DeepSeek
- 🤖 **AI-Powered Assistance**: Intelligent coding help from leading AI models
- 🛠️ **Rich Tool System**: Built-in tools for file operations, code search, and command execution
- 💬 **Interactive REPL**: Conversational interface with context management
- 🎨 **Beautiful UI**: Syntax highlighting and markdown rendering in the terminal
- ⚡ **Streaming Responses**: Real-time AI responses for better user experience
- 🔧 **Configurable**: Customize models, prompts, providers, and settings
- 🔒 **Secure**: API keys managed through environment variables
- 📦 **Scoped Package**: Published under `@prdpspkt` namespace

## Supported AI Providers

| Provider | Models | Cost | Privacy |
|----------|--------|------|---------|
| **Ollama** | CodeLlama, DeepSeek-Coder, Llama2, etc. | Free | 100% Local |
| **OpenAI** | GPT-4, GPT-3.5-Turbo | Paid | Cloud |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus | Paid | Cloud |
| **DeepSeek** | DeepSeek-Coder, DeepSeek-Chat | Paid | Cloud |

📚 **[Full Cloud Providers Guide →](CLOUD_PROVIDERS.md)**

## Available Tools

G-Coder includes these powerful tools:

### File Operations
- **Read**: Read file contents with line numbers
- **Write**: Create or overwrite files
- **Edit**: Perform exact string replacements in files

### Code Search
- **Glob**: Find files using glob patterns (e.g., `**/*.ts`)
- **Grep**: Search file contents using regex patterns

### Command Execution
- **Bash**: Execute shell commands and capture output

## Prerequisites

1. **Node.js** 16.0.0 or higher
2. **Ollama** installed and running

### Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### Pull a Model

```bash
# Recommended for coding tasks
ollama pull codellama
# or
ollama pull deepseek-coder
# or
ollama pull llama2
```

## Installation

### From npm (once published)

```bash
npm install -g @prdpspkt/g-coder
```

### From Source

```bash
# Clone or navigate to the project directory
cd g-coder

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link
```

## Usage

### Start G-Coder

```bash
# Start with default settings
g-coder

# Or use the alias
gc

# Start with specific model
g-coder start --model codellama

# Enable verbose logging
g-coder start --verbose
```

### Interactive Commands

Once inside G-Coder, you can use these commands:

```
/help       - Show help message
/clear      - Clear conversation context
/context    - Show context size
/tools      - List available tools
/model      - Show or change current model
/provider   - Show or change AI provider (ollama/openai/anthropic/deepseek)
/config     - Show current configuration
/export     - Export conversation context
exit/quit   - Exit the application
```

### Using Cloud Providers

```bash
# Set API key (one-time setup)
export OPENAI_API_KEY=sk-your-key-here
# or
export ANTHROPIC_API_KEY=sk-ant-your-key-here
# or
export DEEPSEEK_API_KEY=sk-your-key-here

# Start g-coder and switch provider
g-coder
> /provider openai
> /model gpt-4-turbo-preview
```

See **[CLOUD_PROVIDERS.md](CLOUD_PROVIDERS.md)** for detailed setup instructions.

### Configuration

```bash
# Show current configuration
g-coder config --show

# Set default model
g-coder config --model codellama

# Set Ollama URL
g-coder config --url http://localhost:11434

# Reset to defaults
g-coder config --reset
```

### List Available Models

```bash
g-coder models
```

### Test Connection

```bash
g-coder test
```

## Example Usage

### Read a File
```
> Read the package.json file
```

### Search for Code
```
> Find all TypeScript files in the src directory
```

### Search File Contents
```
> Search for the function "handleLogin" in all JavaScript files
```

### Create a File
```
> Create a new file called utils.ts with a function that validates email addresses
```

### Edit Code
```
> In the file index.ts, replace the old error handling with proper try-catch blocks
```

### Run Commands
```
> Run npm test and show me the results
```

### Debug Code
```
> I'm getting a TypeError in app.ts line 42. Can you help me fix it?
```

## Configuration File

G-Coder stores its configuration in `~/.g-coder/config.json`:

### Basic Configuration

```json
{
  "ollamaUrl": "http://localhost:11434",
  "model": "codellama",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are an expert coding assistant."
}
```

### Advanced Configuration Examples

**Using OpenAI GPT-4:**
```json
{
  "provider": "openai",
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7,
  "maxTokens": 8000,
  "openaiApiKey": "sk-...",
  "systemPrompt": "You are an expert coding assistant specializing in TypeScript and React."
}
```

**Using Anthropic Claude:**
```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.7,
  "maxTokens": 4096,
  "anthropicApiKey": "sk-ant-...",
  "systemPrompt": "You are an expert coding assistant."
}
```

**Using DeepSeek:**
```json
{
  "provider": "deepseek",
  "model": "deepseek-coder",
  "temperature": 0.7,
  "maxTokens": 4096,
  "deepseekApiKey": "sk-...",
  "systemPrompt": "You are an expert coding assistant."
}
```

**Using Local Ollama with Custom Settings:**
```json
{
  "provider": "ollama",
  "ollamaUrl": "http://localhost:11434",
  "model": "deepseek-coder:33b",
  "temperature": 0.5,
  "maxTokens": 8192,
  "systemPrompt": "You are an expert coding assistant with deep knowledge of system design and algorithms."
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | string | `"ollama"` | AI provider: `ollama`, `openai`, `anthropic`, or `deepseek` |
| `model` | string | `"codellama"` | Model name to use |
| `temperature` | number | `0.7` | Creativity level (0.0-1.0) |
| `maxTokens` | number | `4096` | Maximum response length |
| `ollamaUrl` | string | `"http://localhost:11434"` | Ollama server URL |
| `openaiApiKey` | string | - | OpenAI API key (or use env: `OPENAI_API_KEY`) |
| `anthropicApiKey` | string | - | Anthropic API key (or use env: `ANTHROPIC_API_KEY`) |
| `deepseekApiKey` | string | - | DeepSeek API key (or use env: `DEEPSEEK_API_KEY`) |
| `systemPrompt` | string | - | Custom system prompt for the AI |

## How It Works

1. **User Input**: You type your coding request in natural language
2. **AI Processing**: G-Coder sends your request to Ollama along with context
3. **Tool Selection**: The AI determines which tools to use (Read, Write, Grep, etc.)
4. **Tool Execution**: G-Coder executes the selected tools
5. **Response Generation**: Results are sent back to the AI for final response
6. **Output**: You receive formatted, helpful output with syntax highlighting

## Architecture

```
g-coder/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli.ts                # Main REPL and orchestration
│   ├── ollama/
│   │   └── client.ts         # Ollama API client with streaming
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── read.ts           # File reading
│   │   ├── write.ts          # File writing
│   │   ├── edit.ts           # File editing
│   │   ├── glob.ts           # File pattern matching
│   │   ├── grep.ts           # Content search
│   │   └── bash.ts           # Command execution
│   ├── context/
│   │   └── manager.ts        # Conversation context management
│   ├── ui/
│   │   └── renderer.ts       # Markdown and syntax highlighting
│   └── utils/
│       ├── config.ts         # Configuration management
│       └── logger.ts         # Logging utilities
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Watch mode
npm run watch
```

## Publishing

```bash
# Build the project
npm run build

# Publish to npm
npm publish --access public
```

## Troubleshooting

### Ollama Connection Issues

```bash
# Check if Ollama is running
ollama list

# Start Ollama server
ollama serve

# Test connection
g-coder test
```

### Model Not Found

```bash
# List available models
ollama list

# Pull a model
ollama pull codellama
```

### Permission Issues

```bash
# Make sure the binary is executable (Linux/macOS)
chmod +x dist/index.js
```

## Tips for Best Results

1. **Use Specific Models**: For coding tasks, use `codellama`, `deepseek-coder`, or similar code-specialized models
2. **Be Specific**: Provide clear, detailed requests for better results
3. **Context Matters**: The AI remembers previous conversation context
4. **Tool Awareness**: The AI knows what tools are available and will use them appropriately
5. **Clear Context**: Use `/clear` when starting a new, unrelated task

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Author

**prdpspkt**

---

**Note**: G-Coder requires a running Ollama instance. All processing happens locally on your machine for maximum privacy and control.
