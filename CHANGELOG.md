# Changelog

All notable changes to G-Coder will be documented in this file.

## [2.0.0] - 2025-10-15

### Added
- ✨ **Cloud AI Provider Support** - Major new feature!
  - OpenAI (ChatGPT, GPT-4, GPT-3.5)
  - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
  - DeepSeek (DeepSeek Coder, DeepSeek Chat)
- 🔐 **Secure API Key Management**
  - Environment variable support
  - `.env` file support in `~/.g-coder/.env`
  - API keys never stored in config files
- 🔄 **Provider Switching** - Switch between providers on the fly
  - `/provider` command to view/change provider
  - Runtime provider selection
  - Per-provider model selection
- 📚 **Comprehensive Cloud Documentation**
  - New `CLOUD_PROVIDERS.md` guide
  - Setup instructions for each provider
  - Cost comparison table
  - Security best practices

### Changed
- 🔧 **Configuration System** - Enhanced to support multiple providers
  - New config structure with provider field
  - API key management methods
  - Environment variable override system
- 💬 **CLI Interface** - Improved provider awareness
  - Shows current provider on startup
  - Provider-specific error messages
  - Better connection diagnostics
- 📦 **Dependencies** - Added cloud provider SDKs
  - `@anthropic-ai/sdk` ^0.30.1
  - `openai` ^4.77.0
  - `dotenv` ^16.4.5

### Technical
- 🏗️ **Provider Abstraction Layer** - Clean architecture
  - `AIProvider` interface
  - `ProviderFactory` for provider creation
  - Unified message format across providers
- 🔌 **Modular Providers** - Each provider in separate file
  - `OllamaProvider` - Local models
  - `OpenAIProvider` - OpenAI GPT models
  - `AnthropicProvider` - Claude models
  - `DeepSeekProvider` - DeepSeek API
- 📝 **Updated Types** - New type definitions for providers
  - `ProviderType` enum
  - `ProviderConfig` interface
  - `AIMessage` unified message type

## [1.0.0] - 2025-10-15

### Initial Release
- ⚡ **Ollama Integration** - Local AI model support
- 🛠️ **Rich Tool System**
  - Read - Read files with line numbers
  - Write - Create/overwrite files
  - Edit - String replacement in files
  - Glob - Find files by pattern
  - Grep - Search file contents
  - Bash - Execute shell commands
- 💬 **Interactive REPL** - Conversational interface
- 🎨 **Beautiful UI**
  - Syntax highlighting
  - Markdown rendering
  - Colored output
  - Streaming responses
- 🔧 **Configuration System**
  - User config in `~/.g-coder/config.json`
  - Model selection
  - Temperature and token settings
- 📖 **Comprehensive Documentation**
  - README.md
  - QUICKSTART.md
  - EXAMPLES.md
  - PROJECT_SUMMARY.md
- 🏗️ **Solid Architecture**
  - TypeScript for type safety
  - Modular tool system
  - Context management
  - Error handling

---

## Upgrade Guide

### From 1.x to 2.0

No breaking changes! G-Coder 2.0 is fully backward compatible.

**Existing users:**
- Your Ollama setup continues to work as before
- No configuration changes needed
- Cloud providers are opt-in

**To use cloud providers:**
```bash
# Update to 2.0
npm update -g @prdpspkt/g-coder

# Set API key (for chosen provider)
export OPENAI_API_KEY=sk-your-key-here

# Switch provider
g-coder
> /provider openai
> /model gpt-4-turbo-preview
```

## Migration Notes

### API Keys
- Never commit API keys to version control
- Use environment variables or `~/.g-coder/.env`
- Add `.env` to your `.gitignore`

### Provider Selection
- Default is still `ollama` (local, private, free)
- Cloud providers are optional
- Switch anytime with `/provider` command

## Future Roadmap

### Planned Features
- [ ] Support for more providers (Google Gemini, Cohere, etc.)
- [ ] Model-specific optimizations
- [ ] Cost tracking and budgets
- [ ] Provider fallback/rotation
- [ ] Custom provider plugins
- [ ] Conversation branching
- [ ] Code execution sandboxing
- [ ] Multi-file editing
- [ ] Git integration tools

### Under Consideration
- WebSocket support for faster streaming
- Local model fine-tuning
- Team collaboration features
- CI/CD integrations

---

For detailed information about cloud providers, see [CLOUD_PROVIDERS.md](CLOUD_PROVIDERS.md)
