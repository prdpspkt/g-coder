# G-Coder Quick Start Guide

This guide will get you up and running with G-Coder in 5 minutes.

## Step 1: Install Ollama

First, you need Ollama installed and running on your machine.

### Install Ollama

**Windows:**
```bash
# Download and install from https://ollama.com/download
```

**macOS/Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Start Ollama

```bash
ollama serve
```

Leave this running in a terminal.

## Step 2: Pull a Model

In a new terminal, pull a coding model:

```bash
# Recommended: CodeLlama (best for coding tasks)
ollama pull codellama

# Alternative: DeepSeek Coder (also great for coding)
ollama pull deepseek-coder

# Alternative: Llama 2 (general purpose)
ollama pull llama2
```

**Note:** The first pull will download several GB. Be patient!

## Step 3: Install G-Coder

### From Source (Current)

```bash
# Navigate to the g-coder directory
cd g-coder

# Install dependencies (already done)
npm install

# Build the project (already done)
npm run build

# Link globally
npm link
```

### From npm (When Published)

```bash
npm install -g @prdpspkt/g-coder
```

## Step 4: Run G-Coder

```bash
# Start G-Coder
g-coder

# Or use the short alias
gc
```

You should see:
```
✓ Connected to Ollama
ℹ Available models: codellama, ...
ℹ Model: codellama
ℹ Type "exit" to quit, "/help" for commands

>
```

## Step 5: Try It Out!

### Example 1: Read a File

```
> Read the package.json file
```

G-Coder will read and display the file with syntax highlighting.

### Example 2: Find Files

```
> Find all TypeScript files in this project
```

### Example 3: Search Code

```
> Search for the word "ollama" in all TypeScript files
```

### Example 4: Create a File

```
> Create a hello.js file with a simple hello world function
```

### Example 5: Run a Command

```
> Show me what version of Node.js is installed
```

## Commands

Type these commands inside G-Coder:

- `/help` - Show all available commands
- `/tools` - List all available tools
- `/clear` - Clear conversation history
- `/model codellama` - Change the AI model
- `exit` or `quit` - Exit G-Coder

## Configuration

### View Config

```bash
g-coder config --show
```

### Change Default Model

```bash
g-coder config --model deepseek-coder
```

### Change Ollama URL

```bash
g-coder config --url http://localhost:11434
```

## Troubleshooting

### "Failed to connect to Ollama"

Make sure Ollama is running:
```bash
ollama serve
```

### "Model not found"

Pull the model first:
```bash
ollama pull codellama
```

Then set it in G-Coder:
```bash
g-coder config --model codellama
```

### Check Connection

```bash
g-coder test
```

### List Available Models

```bash
ollama list
# or
g-coder models
```

## Next Steps

1. Read the full [README.md](README.md) for detailed documentation
2. Check out [EXAMPLES.md](EXAMPLES.md) for more usage examples
3. Customize your configuration in `~/.g-coder/config.json`

## Tips

1. **Be specific** in your requests: "Read the index.ts file" is better than "show me the code"
2. **Use natural language**: G-Coder understands conversational requests
3. **Chain tasks**: "Find all test files, then read the first one"
4. **Clear context** when switching topics: `/clear`
5. **Use the right model**: CodeLlama or DeepSeek-Coder for coding tasks

## Example Session

```
> g-coder

✓ Connected to Ollama
ℹ Model: codellama

> Find all TypeScript files in the src directory

[G-Coder lists files]

> Read the cli.ts file

[G-Coder displays the file with line numbers]

> What does the processUserInput function do?

[G-Coder explains the function]

> Find all TODO comments in the codebase

[G-Coder searches and shows results]

> exit

ℹ Goodbye!
```

---

**That's it!** You're now ready to use G-Coder. Happy coding! 🚀

For more help, type `/help` inside G-Coder or read the [full documentation](README.md).
