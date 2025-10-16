# G-Coder 🚀

**AI-powered CLI coding assistant supporting multiple providers: Ollama, OpenAI, Claude, DeepSeek and more!**

[![npm version](https://img.shields.io/npm/v/@prdpspkt/g-coder.svg)](https://www.npmjs.com/package/@prdpspkt/g-coder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

## 🌟 Key Features

- 🤖 **Multi-Provider Support** - Ollama (local), OpenAI, Anthropic Claude, DeepSeek
- 💰 **Free Local Models** - Use Ollama for completely free AI assistance
- 🧠 **Project Intelligence** - Persistent conversation history per project
- ♾️ **Auto-Continuation** - Automatic token limit handling with seamless continuation
- 🔒 **Advanced Security** - OS-aware approval system with risk assessment
- 📊 **Smart Session Management** - Auto-save, restore, and organize conversations
- 🎨 **Highly Customizable** - Custom commands, hooks, and configurations
- 🌍 **Cross-Platform** - Windows, Linux, macOS with platform-specific security

---

## 📦 Installation

### Prerequisites

- **Node.js** >= 16.0.0
- **npm** or **yarn**

### Install via npm (Recommended)

```bash
npm install -g @prdpspkt/g-coder
```

### Install from source

```bash
git clone https://github.com/prdpspkt/g-coder.git
cd g-coder
npm install
npm run build
npm link
```

---

## 🚀 Quick Start

### 1. First Run

```bash
g-coder start
```

On first run, g-coder will create a configuration file at `~/.g-coder/config.json`.

### 2. Choose Your Provider

G-coder supports multiple AI providers. Choose based on your needs:

#### Option A: **Ollama (Free, Local)** 🆓

1. Install Ollama: https://ollama.ai/download
2. Pull a model:
   ```bash
   ollama pull codellama
   # or
   ollama pull deepseek-coder
   ```
3. Configure g-coder:
   ```bash
   g-coder config
   ```
   Set provider to `ollama` and model to your chosen model.

#### Option B: **DeepSeek (Affordable, Fast)** 💨

1. Get API key from https://platform.deepseek.com/
2. Create `.env` file in `~/.g-coder/`:
   ```bash
   DEEPSEEK_API_KEY=your_api_key_here
   ```
3. Configure:
   ```bash
   g-coder config
   ```
   Set provider to `deepseek` and model to `deepseek-chat` or `deepseek-reasoner`.

#### Option C: **OpenAI (GPT-4, GPT-3.5)** 🧠

1. Get API key from https://platform.openai.com/
2. Create `.env` file in `~/.g-coder/`:
   ```bash
   OPENAI_API_KEY=your_api_key_here
   ```
3. Configure provider to `openai` and model to `gpt-4` or `gpt-3.5-turbo`.

#### Option D: **Anthropic Claude** 🎯

1. Get API key from https://console.anthropic.com/
2. Create `.env` file in `~/.g-coder/`:
   ```bash
   ANTHROPIC_API_KEY=your_api_key_here
   ```
3. Configure provider to `anthropic` and model to `claude-3-5-sonnet-20241022`.

---

## ⚙️ Configuration

### Configuration File Location

- **Global config**: `~/.g-coder/config.json`
- **Environment variables**: `~/.g-coder/.env`
- **Project history**: `<project>/.g-coder/conversation-history.json`

### Full Configuration Example

Create or edit `~/.g-coder/config.json`:

```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "temperature": 0.7,
  "maxTokens": 8192,
  "maxContextTokens": 8000,
  "maxMessageTokens": 2000,
  "enableTokenShortening": true,
  "ollamaUrl": "http://localhost:11434",
  "systemPrompt": "You are G-Coder, an AI coding assistant...",
  "approval": {
    "enabled": true,
    "toolsRequiringApproval": {
      "Bash": true,
      "Write": true,
      "Edit": true,
      "GitCommit": true,
      "GitPush": true,
      "WebFetch": true,
      "NotebookEdit": true,
      "KillShell": true,
      "Read": false,
      "Glob": false,
      "Grep": false,
      "GitStatus": false,
      "GitDiff": false,
      "BashOutput": false,
      "TodoWrite": false
    },
    "autoApprovePatterns": []
  }
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `provider` | AI provider: `ollama`, `openai`, `anthropic`, `deepseek` | `deepseek` |
| `model` | Model name (provider-specific) | `deepseek-chat` |
| `temperature` | Response randomness (0.0-1.0) | `0.7` |
| `maxTokens` | Max tokens per response | `8192` |
| `maxContextTokens` | Max tokens in conversation context | `8000` |
| `maxMessageTokens` | Max tokens per message | `2000` |
| `enableTokenShortening` | Enable token-based message trimming | `true` |
| `ollamaUrl` | Ollama server URL | `http://localhost:11434` |
| `approval.enabled` | Enable execution approval system | `true` |

### Environment Variables

Create `~/.g-coder/.env`:

```bash
# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...

# Ollama Configuration (optional)
OLLAMA_URL=http://localhost:11434
```

---

## 📚 Usage

### Basic Commands

```bash
# Start interactive session
g-coder start

# Start with specific model
g-coder start -m deepseek-reasoner

# Enable verbose logging
g-coder start -v

# Show configuration
g-coder config --show

# Change model
g-coder config -m gpt-4

# Change provider
g-coder config --set provider deepseek

# List available models (Ollama)
g-coder models

# Test connection
g-coder test
```

### Interactive Commands

Once inside g-coder:

#### Basic Commands
- `/help` - Show help message
- `/clear` - Clear conversation context
- `/context` - Show context size and token count
- `/tools` - List available tools
- `/exit` or `quit` - Exit application

#### Project & History
- `/rescan` - Rescan project structure
- `/history` - View conversation history summary
- `/history clear` - Clear project history

#### Session Management
- `/save <name>` - Save current conversation
- `/load <name-or-id>` - Load saved session
- `/sessions` - List all saved sessions
- `/delete-session <id>` - Delete a session

#### Configuration
- `/model` - Show or change model
- `/provider` - Show or change provider
- `/config` - Show current configuration
- `/approval` - Manage approval settings
- `/approval on/off` - Enable/disable approvals
- `/approval stats` - Show approval statistics

#### Advanced
- `/plan` - Toggle plan mode (preview before execution)
- `/commands` - List custom slash commands
- `/hooks` - Show configured hooks
- `/reload` - Reload commands and hooks

---

## 🛠️ Available Tools

G-coder provides these tools to interact with your codebase:

### File Operations
- **Read** - Read file contents (no approval required)
- **Write** - Create or overwrite files (requires approval)
- **Edit** - Modify existing files with smart matching (requires approval)
- **NotebookEdit** - Edit Jupyter notebooks (requires approval)

### Search & Navigation
- **Glob** - Find files by pattern (no approval required)
- **Grep** - Search file contents with regex (no approval required)

### Shell & Process
- **Bash** - Execute shell commands (requires approval)
- **BashOutput** - Read background process output (no approval required)
- **KillShell** - Terminate background processes (requires approval)

### Git Operations
- **GitStatus** - Show repository status (no approval required)
- **GitDiff** - Show changes (no approval required)
- **GitCommit** - Create commits (requires approval)
- **GitPush** - Push to remote (requires approval)

### Web & External
- **WebFetch** - Fetch web content (requires approval)

---

## 🎯 Example Workflows

### 1. Reading and Understanding Code

```
You: Read the package.json file

AI: [Reads file and explains dependencies]

You: Find all TypeScript files in src/

AI: [Uses Glob to find files]

You: Search for the function "handleLogin"

AI: [Uses Grep to locate function]
```

### 2. Creating New Features

```
You: Create a new authentication module in src/auth/

AI: [Scans project, creates files with proper structure]
    - Creates src/auth/index.ts
    - Creates src/auth/login.ts
    - Creates src/auth/types.ts
```

### 3. Debugging and Fixing

```
You: The login function is throwing an error

AI: [Reads relevant files, identifies issue]
    [Uses Edit tool to fix the bug]
    [Runs tests with Bash tool]
```

### 4. Git Workflow

```
You: Commit these changes

AI: [Checks git status]
    [Shows diff]
    [Creates descriptive commit message]
    [Asks for approval before committing]
```

---

## 🔒 Security & Approval System

### Risk-Based Approval

G-coder categorizes operations by risk level:

- **No Approval** (Green): Read, Glob, Grep, GitStatus, GitDiff
- **Medium Risk** (Yellow): Write, Edit, WebFetch
- **High Risk** (Orange): Bash commands, GitCommit
- **Critical Risk** (Red): GitPush, destructive operations

### OS-Aware Security

Automatically detects dangerous patterns based on your OS:

**Windows:**
- `del /s`, `rmdir /s`, `format`, `diskpart`
- Registry modifications
- System file access

**Linux/Mac:**
- `rm -rf /`, `sudo rm`, `chmod 777`
- `/etc/passwd`, `/etc/shadow` modifications
- Root directory operations

### Auto-Approve Patterns

When you approve an operation, you can choose "auto-approve similar operations" to skip future prompts for the same tool/command.

```
⚠ Tool Execution Approval Required
────────────────────────────────────────────────────────────
Tool: Bash
Risk Level: HIGH
Parameters:
  command: npm install

? Do you want to execute this tool?
  > Yes, execute
    No, cancel
    Yes, and auto-approve similar operations
```

---

## 🧠 Project Intelligence

### Automatic Project Detection

G-coder automatically detects and understands your project:

- **Project Type**: Node.js, Python, Go, Rust, Java, etc.
- **Dependencies**: package.json, requirements.txt, go.mod, Cargo.toml
- **Structure**: Entry points, test directories, build configurations
- **Languages**: Detects primary and secondary languages

### Persistent Conversation History

Each project maintains its own conversation history in `.g-coder/conversation-history.json`:

- **Last 50 interactions** saved
- **7-day retention** period
- **Automatic context loading** on startup
- **Recent topics** displayed when starting

### Project Context on Startup

```
📚 Previous Conversation Context:
   Previous session: 2025-01-15 10:30:45
   Total interactions: 42 messages
   Recent topics: Implemented authentication; Fixed database connection; Added user routes
   Loaded 5 previous interactions for context awareness
```

---

## ♾️ Automatic Token Management

### Token Limit Handling

G-coder automatically manages token limits:

#### 90% Warning
```
⚠️  Approaching token limit: 7200 / 8000 tokens (90%)
   Conversation will auto-save and continue when limit is reached.
```

#### 100% Auto-Save & Continue
```
⚠️  Token Limit Exceeded
────────────────────────────────────────────────────────────
The conversation has reached the maximum token limit.
Automatically saving current conversation and starting fresh...

✓ Conversation saved: auto-save-2025-01-15T10-30-45
  Session ID: abc123xyz
  Messages saved: 45
  You can load this session later with: /load abc123xyz

✓ Context cleared - ready to continue with a fresh conversation
────────────────────────────────────────────────────────────
💡 Tip: Previous conversation history is still available
    Use /history or /sessions to access saved conversations
```

**No manual intervention needed!** Continue working seamlessly.

---

## 🎨 Customization

### Custom Slash Commands

Create custom commands in `~/.g-coder/commands/`:

**Example: `.g-coder/commands/review.md`**
```markdown
---
description: Review code for best practices
---

Please review the code in this project and provide feedback on:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance improvements
4. Security concerns
```

Usage:
```
/review
```

### Event Hooks

Create hooks in `~/.g-coder/hooks.json`:

```json
{
  "enabled": true,
  "hooks": {
    "session_start": [
      "git fetch"
    ],
    "tool_call": [
      "echo 'Tool executed: $TOOL_NAME'"
    ],
    "session_end": [
      "git status"
    ]
  }
}
```

Available events:
- `session_start` - When g-coder starts
- `session_end` - When g-coder exits
- `user_prompt_submit` - Before processing user input
- `tool_call` - Before executing a tool
- `tool_success` - After successful tool execution
- `tool_error` - After failed tool execution
- `assistant_response` - After AI responds

---

## 📊 G-Coder vs Claude Code

| Feature | G-Coder | Claude Code |
|---------|---------|-------------|
| **AI Providers** | 🏆 Multi-provider (Ollama, OpenAI, Claude, DeepSeek) | ❌ Claude only |
| **Cost** | 🏆 Free with Ollama, flexible pricing | ❌ Claude API required |
| **Project History** | 🏆 Persistent per-project | ❌ Session-based only |
| **Token Management** | 🏆 Auto-save & continue | ❌ Manual management |
| **Security** | 🏆 OS-aware risk assessment | ⚠️ Basic approval |
| **Session Management** | 🏆 Auto-save, named sessions | ⚠️ Basic sessions |
| **Customization** | 🏆 Commands, hooks, configs | ❌ Limited options |
| **Platform Detection** | 🏆 OS-specific security | ❌ Generic |
| **Smart Editing** | 🏆 Fuzzy match, multi-strategy | ⚠️ Basic edit |
| **Local Models** | 🏆 Full Ollama support | ❌ No local support |

**Overall Winner: G-Coder** 🏆

### Key Advantages of G-Coder

1. **🎯 Multi-Provider Flexibility**
   - Use free local models (Ollama)
   - Switch providers based on task
   - No vendor lock-in

2. **💰 Cost Effective**
   - Completely free with Ollama
   - Choose cheapest API provider
   - Control your costs

3. **🧠 Project Intelligence**
   - Persistent conversation history per project
   - Automatic project detection and scanning
   - Context restoration on startup

4. **♾️ Automatic Continuation**
   - Never worry about token limits
   - Auto-saves and continues seamlessly
   - No manual intervention needed

5. **🔒 Advanced Security**
   - OS-aware dangerous pattern detection
   - Risk-based approval system
   - Granular tool-level control

6. **🎨 Highly Customizable**
   - Custom slash commands
   - Event hooks system
   - Fully configurable

### When to Use Claude Code

- You're already paying for Claude API
- You prefer official Anthropic support
- You only use Claude models
- You want tighter Anthropic integration

### When to Use G-Coder

- ✅ You want multi-provider flexibility
- ✅ You want to use local models (free)
- ✅ You need project-specific history
- ✅ You want automatic token limit handling
- ✅ You need advanced security features
- ✅ You want customization options
- ✅ You're building on a budget
- ✅ You want community-driven development

---

## 🐛 Troubleshooting

### Connection Issues

**Ollama not connecting:**
```bash
# Check if Ollama is running
ollama list

# Start Ollama service
ollama serve

# Test connection
g-coder test
```

**API key not found:**
```bash
# Check .env file exists
ls ~/.g-coder/.env

# Verify API key is set
cat ~/.g-coder/.env

# Reload configuration
g-coder config --show
```

### Token Counting Issues

If token counting doesn't work:
```json
{
  "enableTokenShortening": false
}
```

### Permission Errors

If approval prompts don't appear:
```json
{
  "approval": {
    "enabled": true
  }
}
```

Check approval settings:
```bash
/approval
```

---

## 📖 Documentation

- [Platform Detection](./PLATFORM_DETECTION.md) - OS-aware security system
- [Smart Editing](./SMART_EDITING.md) - Intelligent code editing
- [Approval System](./APPROVAL_SYSTEM.md) - Security and approval details

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

```bash
git clone https://github.com/prdpspkt/g-coder.git
cd g-coder
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Inspired by Claude Code from Anthropic
- Built with ❤️ by [@prdpspkt](https://github.com/prdpspkt)
- Community contributors and testers

---

## 📬 Contact & Support

- **Issues**: https://github.com/prdpspkt/g-coder/issues
- **Discussions**: https://github.com/prdpspkt/g-coder/discussions
- **NPM**: https://www.npmjs.com/package/@prdpspkt/g-coder

---

## ⭐ Star History

If you find G-Coder useful, please consider giving it a star on GitHub!

[![Star History Chart](https://api.star-history.com/svg?repos=prdpspkt/g-coder&type=Date)](https://star-history.com/#prdpspkt/g-coder&Date)

---

**Made with 🚀 by developers, for developers**

श्री गणेशाय नम:
