import * as readline from 'readline';
import { AIProvider, ProviderFactory } from './providers';
import { ContextManager } from './context/manager';
import { toolRegistry } from './tools';
import { renderer } from './ui/renderer';
import { configManager } from './utils/config';
import { logger } from './utils/logger';
import { commandManager } from './utils/commands';
import { hookManager } from './utils/hooks';
import { artifactParser } from './utils/artifact-parser';
import { sessionManager } from './utils/session';
import { toOpenAITools, toAnthropicTools } from './tools/converter';
import chalk from 'chalk';
import ora from 'ora';

export class CLI {
  private provider: AIProvider;
  private context: ContextManager;
  private rl: readline.Interface;
  private isProcessing: boolean = false;
  private planMode: boolean = false;
  private pendingPlan: string | null = null;
  private currentSessionId: string | null = null;

  constructor() {
    const config = configManager.get();

    // Create provider based on config
    this.provider = ProviderFactory.create({
      type: config.provider,
      model: config.model,
      apiKey: this.getApiKeyForProvider(config.provider),
      baseUrl: config.ollamaUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    this.context = new ContextManager(config.systemPrompt, 20, {
      maxContextTokens: config.maxContextTokens,
      maxMessageTokens: config.maxMessageTokens,
      enableTokenShortening: config.enableTokenShortening,
      modelName: config.model,
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: renderer.renderPrompt(),
    });
  }

  private getApiKeyForProvider(provider: string): string | undefined {
    switch (provider) {
      case 'openai':
        return configManager.getApiKey('openai');
      case 'anthropic':
        return configManager.getApiKey('anthropic');
      case 'deepseek':
        return configManager.getApiKey('deepseek');
      default:
        return undefined;
    }
  }

  async start(): Promise<void> {
    const config = configManager.get();

    // Trigger session start hook
    await hookManager.trigger({ event: 'session_start' });

    // Check connection
    const spinner = ora(`Connecting to ${this.provider.name}...`).start();
    const connected = await this.provider.checkConnection();

    if (!connected) {
      spinner.fail(`Failed to connect to ${this.provider.name}`);
      this.showConnectionHelp();
      process.exit(1);
    }

    spinner.succeed(`Connected to ${this.provider.name}`);

    // Display Sanskrit blessing at the top
    const blessing = `
                      श्री गणेशाय नम:

           मङ्गलम् भगवान विष्णुः, मङ्गलम् गरुणध्वजः।
           मङ्गलम् पुण्डरी काक्षः, मङ्गलाय तनो हरिः॥
`;
    console.log(chalk.bold.hex('#FFA500')(blessing));

    // Show available models if supported
    if (this.provider.listModels) {
      const models = await this.provider.listModels();
      if (models.length > 0) {
        console.log(renderer.renderInfo(`Available models: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`));
      }
    }

    console.log(renderer.renderHeader('G-Coder - AI Coding Assistant'));
    console.log(renderer.renderInfo(`Provider: ${this.provider.name}`));
    console.log(renderer.renderInfo(`Model: ${config.model}`));
    console.log(renderer.renderInfo('Type "exit" to quit, "/help" for commands\n'));

    this.setupHandlers();
    this.rl.prompt();
  }

  private showConnectionHelp(): void {
    const config = configManager.get();

    switch (config.provider) {
      case 'ollama':
        console.log(renderer.renderError(`Make sure Ollama is running at ${config.ollamaUrl}`));
        console.log(renderer.renderInfo('Start Ollama with: ollama serve'));
        break;
      case 'openai':
        console.log(renderer.renderError('OpenAI API key not found or invalid'));
        console.log(renderer.renderInfo('Set your API key: export OPENAI_API_KEY=your-key'));
        console.log(renderer.renderInfo('Or use: g-coder config --set-key openai'));
        break;
      case 'anthropic':
        console.log(renderer.renderError('Anthropic API key not found or invalid'));
        console.log(renderer.renderInfo('Set your API key: export ANTHROPIC_API_KEY=your-key'));
        console.log(renderer.renderInfo('Or use: g-coder config --set-key anthropic'));
        break;
      case 'deepseek':
        console.log(renderer.renderError('DeepSeek API key not found or invalid'));
        console.log(renderer.renderInfo('Set your API key: export DEEPSEEK_API_KEY=your-key'));
        console.log(renderer.renderInfo('Or use: g-coder config --set-key deepseek'));
        break;
    }
  }

  private setupHandlers(): void {
    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();

      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      if (this.isProcessing) {
        console.log(renderer.renderWarning('Please wait for the current request to complete'));
        this.rl.prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        await this.handleCommand(trimmed);
        this.rl.prompt();
        return;
      }

      // Handle exit
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log(renderer.renderInfo('Goodbye!'));
        process.exit(0);
      }

      await this.processUserInput(trimmed);
      this.rl.prompt();
    });

    this.rl.on('close', async () => {
      console.log(renderer.renderInfo('\nGoodbye!'));
      await hookManager.trigger({ event: 'session_end' });
      process.exit(0);
    });
  }

  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');

    // Check for custom slash commands first
    if (commandManager.hasCommand(cmd)) {
      const customCmd = commandManager.getCommand(cmd);
      if (customCmd) {
        console.log(chalk.cyan(`\nRunning custom command: /${cmd}\n`));
        if (customCmd.description) {
          console.log(chalk.gray(customCmd.description));
        }
        await this.processUserInput(customCmd.prompt);
        return;
      }
    }

    switch (cmd) {
      case 'help':
        this.showHelp();
        break;

      case 'clear':
        console.clear();
        this.context.clear();
        console.log(renderer.renderSuccess('Context cleared'));
        break;

      case 'context':
        const tokenCount = this.context.getTokenCount();
        const contextConfig = configManager.get();
        console.log(renderer.renderInfo(`Context size: ${this.context.getContextSize()} messages`));
        if (tokenCount > 0) {
          const maxTokens = contextConfig.maxContextTokens || 8000;
          const percentage = Math.round((tokenCount / maxTokens) * 100);
          console.log(renderer.renderInfo(`Token count: ${tokenCount} / ${maxTokens} (${percentage}%)`));
        }
        break;

      case 'tools':
        console.log(renderer.renderHeader('Available Tools'));
        console.log(toolRegistry.getDefinitions());
        break;

      case 'commands':
        const customCommands = commandManager.getAllCommands();
        if (customCommands.length === 0) {
          console.log(renderer.renderInfo('No custom commands found'));
          console.log(renderer.renderInfo(`Add .md files to: ${commandManager.getCommandsDir()}`));
        } else {
          console.log(renderer.renderHeader('Custom Commands'));
          customCommands.forEach(cmd => {
            console.log(chalk.yellow(`  /${cmd.name}`) + (cmd.description ? ` - ${chalk.gray(cmd.description)}` : ''));
          });
          console.log(chalk.gray(`\nCommands directory: ${commandManager.getCommandsDir()}`));
        }
        break;

      case 'hooks':
        console.log(renderer.renderHeader('Hook System'));
        const hooks = hookManager.getHooks();
        if (hooks.size === 0) {
          console.log(renderer.renderInfo('No hooks configured'));
        } else {
          console.log(chalk.cyan('Configured hooks:'));
          hooks.forEach((commands, event) => {
            console.log(chalk.yellow(`\n  ${event}:`));
            commands.forEach(cmd => {
              console.log(chalk.gray(`    - ${cmd}`));
            });
          });
        }
        console.log(chalk.gray(`\nHook config: ${hookManager.getConfigPath()}`));
        console.log(chalk.gray(`Status: ${hookManager.isEnabled() ? chalk.green('enabled') : chalk.red('disabled')}`));
        break;

      case 'reload':
        commandManager.reload();
        hookManager.reload();
        console.log(renderer.renderSuccess('Reloaded commands and hooks'));
        break;

      case 'model':
        if (args.length > 0) {
          const newModel = args.join(' ');
          configManager.set('model', newModel);
          console.log(renderer.renderSuccess(`Model changed to: ${newModel}`));
        } else {
          console.log(renderer.renderInfo(`Current model: ${configManager.get().model}`));
        }
        break;

      case 'provider':
        if (args.length > 0) {
          const newProvider = args[0] as any;
          if (['ollama', 'openai', 'anthropic', 'deepseek'].includes(newProvider)) {
            configManager.set('provider', newProvider);
            console.log(renderer.renderSuccess(`Provider changed to: ${newProvider}`));
            console.log(renderer.renderWarning('Please restart g-coder for changes to take effect'));
          } else {
            console.log(renderer.renderError('Invalid provider. Choose from: ollama, openai, anthropic, deepseek'));
          }
        } else {
          console.log(renderer.renderInfo(`Current provider: ${configManager.get().provider}`));
        }
        break;

      case 'config':
        console.log(renderer.renderHeader('Configuration'));
        const currentConfig = configManager.get();
        // Hide API keys in output
        const displayConfig = { ...currentConfig };
        if (displayConfig.openaiApiKey) displayConfig.openaiApiKey = '***';
        if (displayConfig.anthropicApiKey) displayConfig.anthropicApiKey = '***';
        if (displayConfig.deepseekApiKey) displayConfig.deepseekApiKey = '***';
        console.log(JSON.stringify(displayConfig, null, 2));
        break;

      case 'export':
        const exported = this.context.exportContext();
        console.log(renderer.renderSuccess('Context exported:'));
        console.log(exported);
        break;

      case 'plan':
        this.planMode = !this.planMode;
        if (this.planMode) {
          console.log(renderer.renderSuccess('Plan mode enabled - AI will present plans for approval before executing'));
        } else {
          console.log(renderer.renderInfo('Plan mode disabled - AI will execute directly'));
        }
        break;

      case 'approve':
      case 'yes':
      case 'y':
        if (this.pendingPlan) {
          console.log(renderer.renderSuccess('Plan approved! Executing...'));
          this.planMode = false; // Temporarily disable for execution
          await this.processUserInput(this.pendingPlan);
          this.planMode = true; // Re-enable
          this.pendingPlan = null;
        } else {
          console.log(renderer.renderWarning('No pending plan to approve'));
        }
        break;

      case 'reject':
      case 'no':
      case 'n':
        if (this.pendingPlan) {
          console.log(renderer.renderInfo('Plan rejected'));
          this.pendingPlan = null;
        } else {
          console.log(renderer.renderWarning('No pending plan to reject'));
        }
        break;

      case 'save':
        if (args.length === 0) {
          console.log(renderer.renderError('Please provide a session name'));
          console.log(renderer.renderInfo('Usage: /save <session-name>'));
        } else {
          const sessionName = args.join(' ');
          const messages = this.context.getMessages();
          const config = configManager.get();
          const session = sessionManager.saveSession(sessionName, messages, config.provider, config.model);
          this.currentSessionId = session.id;
          console.log(renderer.renderSuccess(`Session saved: ${session.name}`));
          console.log(renderer.renderInfo(`${session.metadata.messageCount} messages saved`));
        }
        break;

      case 'load':
        if (args.length === 0) {
          console.log(renderer.renderError('Please provide a session name or ID'));
          console.log(renderer.renderInfo('Usage: /load <session-name-or-id>'));
        } else {
          const identifier = args.join(' ');
          const session = sessionManager.loadSession(identifier);
          if (session) {
            this.context.clear();
            session.messages.forEach(msg => {
              this.context.addMessage(msg.role as 'user' | 'assistant', msg.content);
            });
            this.currentSessionId = session.id;
            console.log(renderer.renderSuccess(`Session loaded: ${session.name}`));
            console.log(renderer.renderInfo(`${session.metadata.messageCount} messages restored`));
            if (session.metadata.provider) {
              console.log(renderer.renderInfo(`Provider: ${session.metadata.provider}, Model: ${session.metadata.model}`));
            }
          } else {
            console.log(renderer.renderError(`Session not found: ${identifier}`));
          }
        }
        break;

      case 'sessions':
        const sessions = sessionManager.listSessions();
        if (sessions.length === 0) {
          console.log(renderer.renderInfo('No saved sessions found'));
        } else {
          console.log(renderer.renderHeader(`Saved Sessions (${sessions.length})`));
          sessions.forEach((session, index) => {
            const current = session.id === this.currentSessionId ? chalk.green(' (current)') : '';
            const date = new Date(session.updatedAt).toLocaleString();
            console.log(`${chalk.yellow(`${index + 1}.`)} ${chalk.cyan(session.name)}${current}`);
            console.log(`   ${chalk.gray(`ID: ${session.id}`)}`);
            console.log(`   ${chalk.gray(`Messages: ${session.metadata.messageCount} | Updated: ${date}`)}`);
            if (session.metadata.provider) {
              console.log(`   ${chalk.gray(`Provider: ${session.metadata.provider} | Model: ${session.metadata.model}`)}`);
            }
            console.log('');
          });
        }
        break;

      case 'delete-session':
        if (args.length === 0) {
          console.log(renderer.renderError('Please provide a session name or ID'));
          console.log(renderer.renderInfo('Usage: /delete-session <session-name-or-id>'));
        } else {
          const identifier = args.join(' ');
          if (sessionManager.deleteSession(identifier)) {
            console.log(renderer.renderSuccess(`Session deleted: ${identifier}`));
            if (this.currentSessionId === identifier) {
              this.currentSessionId = null;
            }
          } else {
            console.log(renderer.renderError(`Session not found: ${identifier}`));
          }
        }
        break;

      default:
        console.log(renderer.renderError(`Unknown command: ${cmd}`));
        console.log(renderer.renderInfo('Type /help for available commands'));
    }
  }

  private showHelp(): void {
    console.log(renderer.renderHeader('G-Coder Help'));
    console.log(`
${chalk.cyan.bold('Commands:')}
  ${chalk.yellow('/help')}       - Show this help message
  ${chalk.yellow('/clear')}      - Clear conversation context
  ${chalk.yellow('/context')}    - Show context size
  ${chalk.yellow('/tools')}      - List available tools
  ${chalk.yellow('/commands')}   - List custom slash commands
  ${chalk.yellow('/hooks')}      - Show configured hooks
  ${chalk.yellow('/reload')}     - Reload commands and hooks
  ${chalk.yellow('/model')}      - Show or change current model
  ${chalk.yellow('/provider')}   - Show or change AI provider
  ${chalk.yellow('/config')}     - Show current configuration
  ${chalk.yellow('/export')}     - Export conversation context
  ${chalk.yellow('/plan')}       - Toggle plan mode (requires approval before execution)
  ${chalk.yellow('/approve')} or ${chalk.yellow('/yes')} - Approve pending plan
  ${chalk.yellow('/reject')} or ${chalk.yellow('/no')}  - Reject pending plan
  ${chalk.yellow('exit')} or ${chalk.yellow('quit')} - Exit the application

${chalk.cyan.bold('Session Management:')}
  ${chalk.yellow('/save <name>')}         - Save current conversation
  ${chalk.yellow('/load <name-or-id>')}   - Load a saved session
  ${chalk.yellow('/sessions')}            - List all saved sessions
  ${chalk.yellow('/delete-session <name-or-id>')} - Delete a session

${chalk.cyan.bold('Providers:')}
  ${chalk.green('ollama')}       - Local Ollama models (default)
  ${chalk.green('openai')}       - OpenAI GPT models
  ${chalk.green('anthropic')}    - Anthropic Claude models
  ${chalk.green('deepseek')}     - DeepSeek API models

${chalk.cyan.bold('Usage:')}
  Just type your request and press Enter. G-Coder will:
  - Understand your coding needs
  - Use appropriate tools to help you
  - Provide clear explanations and code

${chalk.cyan.bold('Examples:')}
  "Read the package.json file"
  "Find all TypeScript files in the src directory"
  "Search for the function handleLogin in the codebase"
  "Create a new file called utils.ts with helper functions"
  "Fix the syntax error in index.ts"
`);
  }

  private async processUserInput(input: string): Promise<void> {
    this.isProcessing = true;

    try {
      // Trigger user prompt submit hook
      const hookResult = await hookManager.trigger({
        event: 'user_prompt_submit',
        userInput: input,
      });

      if (hookResult.blocked) {
        console.log(renderer.renderWarning('Input blocked by hook'));
        if (hookResult.results && hookResult.results.length > 0) {
          const blockedResult = hookResult.results.find(r => !r.success);
          if (blockedResult?.error) {
            console.log(renderer.renderInfo(`Hook message: ${blockedResult.error}`));
          }
        }
        return;
      }

      // Add user message to context
      this.context.addMessage('user', input);

      // Track tool execution to prevent infinite loops
      const executedTools: string[] = [];
      const MAX_TOOL_ITERATIONS = 10;
      let iterationCount = 0;

      // Get messages for AI provider
      let messages = this.context.getAIMessages();

      console.log(''); // New line before response

      // Show spinner while AI is thinking
      const thinkingSpinner = ora('AI is processing your request...').start();

      // Stream response from provider (silent, no console output)
      let fullResponse = '';
      let toolCalls: Array<{ name: string; params: Record<string, any> }> = [];

      // Check if provider supports native tool calling
      if (this.provider.supportsNativeTools) {
        // Get public tools for provider (excludes internal tools like TodoWrite)
        const allTools = toolRegistry.getPublicTools();
        let providerTools: any[] = [];

        if (configManager.get().provider === 'openai' || configManager.get().provider === 'deepseek') {
          providerTools = toOpenAITools(allTools);
        } else if (configManager.get().provider === 'anthropic') {
          providerTools = toAnthropicTools(allTools);
        }

        const response = await this.provider.chat(
          messages,
          () => {
            // Silent - no streaming output
          },
          providerTools
        );

        if (typeof response === 'string') {
          fullResponse = response;
        } else {
          fullResponse = response.content;
          toolCalls = response.toolCalls || [];
        }
      } else {
        // Fallback to regex parsing for providers without native support (like Ollama)
        fullResponse = await this.provider.chat(messages, () => {
          // Silent - no streaming output
        }) as string;

        // Parse tool calls from response text
        toolCalls = this.parseToolCalls(fullResponse);
      }

      thinkingSpinner.succeed('AI response received');

      // Log full response for debugging
      logger.debug('=== Full AI Response ===');
      logger.debug(fullResponse);
      logger.debug('=== End AI Response ===');

      // FIRST: Detect and write file artifacts from AI response
      const artifacts = artifactParser.parseArtifacts(fullResponse);
      if (artifacts.length > 0) {
        console.log(chalk.cyan(`\n📦 Detected ${artifacts.length} file artifact(s), writing to disk...\n`));
        const artifactResult = await artifactParser.writeArtifacts(artifacts);

        if (artifactResult.written > 0) {
          // Add summary to context so AI knows files were created
          const artifactSummary = `Created ${artifactResult.written} file(s): ${artifacts.map(a => a.filePath).join(', ')}`;
          logger.info(artifactSummary);
        }

        if (artifactResult.errors.length > 0) {
          console.log(renderer.renderWarning(`${artifactResult.errors.length} file(s) failed to write`));
        }
      }

      // Plan mode: if tools detected and plan mode is on, ask for approval
      if (this.planMode && toolCalls.length > 0) {
        console.log(chalk.yellow.bold('\n📋 Plan Mode: Execution requires approval'));
        console.log(chalk.gray(`AI wants to execute ${toolCalls.length} tool(s):`));
        toolCalls.forEach((tc, i) => {
          console.log(chalk.gray(`  ${i + 1}. ${tc.name} with ${Object.keys(tc.params).length} parameter(s)`));
        });
        console.log(chalk.cyan('\nType /approve or /yes to proceed, /reject or /no to cancel'));
        this.pendingPlan = input;
        this.isProcessing = false;
        return;
      }

      // Tool execution loop with safeguards
      while (toolCalls.length > 0 && iterationCount < MAX_TOOL_ITERATIONS) {
        iterationCount++;

        // Check for repeated tool calls (potential infinite loop)
        const toolSignatures = toolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.params)}`);
        const repeatedTools = toolSignatures.filter(sig => executedTools.includes(sig));

        if (repeatedTools.length > 0) {
          console.log(renderer.renderWarning(`\n⚠️  Detected repeated tool execution - stopping to prevent infinite loop`));
          console.log(renderer.renderInfo(`The AI tried to execute the same tool(s) multiple times with identical parameters.`));
          break;
        }

        // Execute tools in parallel
        console.log(chalk.cyan(`\nExecuting ${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''}...\n`));

        const toolPromises = toolCalls.map(async (toolCall) => {
          console.log(renderer.renderToolCall(toolCall.name, toolCall.params));

          // Track this tool execution
          executedTools.push(`${toolCall.name}:${JSON.stringify(toolCall.params)}`);

          // Trigger tool_call hook
          const callHook = await hookManager.trigger({
            event: 'tool_call',
            toolName: toolCall.name,
            toolParams: toolCall.params,
          });

          if (callHook.blocked) {
            console.log(renderer.renderWarning(`Tool ${toolCall.name} blocked by hook`));
            if (callHook.results && callHook.results.length > 0) {
              const blockedResult = callHook.results.find(r => !r.success);
              if (blockedResult?.error) {
                console.log(renderer.renderInfo(`Hook message: ${blockedResult.error}`));
              }
            }
            return {
              toolCall,
              result: { success: false, error: 'Blocked by hook' },
            };
          }

          const result = await toolRegistry.executeTool(toolCall.name, toolCall.params);

          // Trigger success or error hook
          if (result.success) {
            await hookManager.trigger({
              event: 'tool_success',
              toolName: toolCall.name,
              toolParams: toolCall.params,
              toolResult: result,
            });
          } else {
            await hookManager.trigger({
              event: 'tool_error',
              toolName: toolCall.name,
              toolParams: toolCall.params,
              error: result.error,
            });
          }

          console.log(renderer.renderToolResult(toolCall.name, result.success, result.output, result.error, result.data));
          console.log('');

          return {
            toolCall,
            result,
          };
        });

        // Wait for all tools to complete
        const toolResults = await Promise.all(toolPromises);

        // Collect all results for context
        const allResults = toolResults
          .filter(({ result }) => result.output)
          .map(({ toolCall, result }) => `Tool ${toolCall.name} result:\n${result.output}`)
          .join('\n\n');

        if (allResults) {
          this.context.addMessage('user', allResults);

          // Get AI response to all tool results
          const followUpMessages = this.context.getAIMessages();

          const followUpSpinner = ora('AI analyzing tool results...').start();

          let followUpResponse: string;
          if (this.provider.supportsNativeTools) {
            const response = await this.provider.chat(followUpMessages, () => {
              // Silent - no streaming output
            });

            if (typeof response === 'string') {
              followUpResponse = response;
              toolCalls = []; // No more tool calls
            } else {
              followUpResponse = response.content;
              toolCalls = response.toolCalls || [];
            }
          } else {
            followUpResponse = await this.provider.chat(followUpMessages, () => {
              // Silent - no streaming output
            }) as string;

            // Check for more tool calls in the follow-up response
            toolCalls = this.parseToolCalls(followUpResponse);
          }

          followUpSpinner.succeed('Follow-up analysis complete');
          fullResponse += '\n' + followUpResponse;
        } else {
          // No results to process, stop the loop
          toolCalls = [];
        }
      }

      // Warn if we hit the iteration limit
      if (iterationCount >= MAX_TOOL_ITERATIONS) {
        console.log(renderer.renderWarning(`\n⚠️  Reached maximum tool execution iterations (${MAX_TOOL_ITERATIONS}) - stopping`));
        console.log(renderer.renderInfo(`This prevents infinite loops. The AI may not have completed all intended actions.`));
      }

      // Display AI summary (extract text without artifact code blocks)
      const summaryText = artifactParser.extractTextWithoutArtifacts(fullResponse);
      if (summaryText.trim()) {
        console.log(chalk.cyan('\n📝 Summary:'));
        console.log(summaryText.trim());
        console.log('');
      }

      // Add assistant response to context
      this.context.addMessage('assistant', fullResponse);

      // Trigger assistant response hook
      await hookManager.trigger({
        event: 'assistant_response',
        assistantResponse: fullResponse,
      });

    } catch (error: any) {
      console.log(renderer.renderError(error.message));
      logger.error('Error processing input:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private parseToolCalls(response: string): Array<{ name: string; params: Record<string, any> }> {
    const toolCalls: Array<{ name: string; params: Record<string, any> }> = [];

    // First, try to auto-correct common mistakes by replacing ```json or other types with ```tool-call
    // if they contain Tool: and Parameters:
    let correctedResponse = response;
    const autoCorrectRegex = /```(json|text|markdown|)\s+([\s\S]*?)```/g;
    correctedResponse = correctedResponse.replace(autoCorrectRegex, (match, blockType, content) => {
      if (content.includes('Tool:') && content.includes('Parameters:')) {
        logger.info(`Auto-correcting code block from \`\`\`${blockType || 'plain'} to \`\`\`tool-call`);
        console.log(renderer.renderWarning(`Auto-correcting format: \`\`\`${blockType || 'plain'} → \`\`\`tool-call`));
        return '```tool-call\n' + content + '```';
      }
      return match;
    });

    // Match tool-call blocks
    const regex = /```tool-call\s+([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(correctedResponse)) !== null) {
      try {
        const block = match[1];
        const lines = block.split('\n').filter(line => line.trim());

        let toolName = '';
        const params: Record<string, any> = {};
        let inParams = false;
        let currentKey = '';
        let currentValue = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();

          if (trimmedLine.startsWith('Tool:')) {
            toolName = trimmedLine.replace('Tool:', '').trim();
          } else if (trimmedLine.startsWith('Parameters:')) {
            inParams = true;
          } else if (inParams && trimmedLine) {
            // Handle multi-line parameter values
            // Check if this line contains a parameter (has colon and doesn't look like continuation)
            const colonIndex = trimmedLine.indexOf(':');

            if (colonIndex > 0 && colonIndex < trimmedLine.length - 1) {
              // This looks like a new parameter
              // Save previous parameter if exists
              if (currentKey) {
                params[currentKey] = this.parseValue(currentValue.trim());
              }

              // Start new parameter
              currentKey = trimmedLine.substring(0, colonIndex).trim();
              currentValue = trimmedLine.substring(colonIndex + 1).trim();
            } else if (currentKey) {
              // Continuation of previous parameter value
              currentValue += '\n' + trimmedLine;
            }
          }
        }

        // Save last parameter
        if (currentKey) {
          params[currentKey] = this.parseValue(currentValue.trim());
        }

        if (toolName) {
          logger.tool('Parser', `Parsed tool call: ${toolName} with ${Object.keys(params).length} parameters`);
          logger.debug('Parsed parameters:', JSON.stringify(params, null, 2));

          if (Object.keys(params).length === 0) {
            console.log(renderer.renderWarning(`Tool "${toolName}" found but no parameters were parsed. Block content:`));
            console.log(chalk.gray(block.substring(0, 200) + (block.length > 200 ? '...' : '')));
          }

          toolCalls.push({ name: toolName, params });
        } else {
          logger.warn('Found tool-call block but no tool name specified');
          console.log(renderer.renderWarning('Found a tool-call block but could not identify the tool name. Make sure to use "Tool: <ToolName>" format.'));
        }
      } catch (error) {
        logger.warn('Failed to parse tool call block:', error);
        console.log(renderer.renderWarning('Failed to parse a tool-call block. Check the format matches the expected syntax.'));
      }
    }

    if (toolCalls.length === 0 && response.includes('```')) {
      // Check if there are code blocks that might be misformatted tool calls
      const codeBlockRegex = /```(\w+)?\s+([\s\S]*?)```/g;
      let codeMatch;
      const wrongFormats: string[] = [];

      while ((codeMatch = codeBlockRegex.exec(response)) !== null) {
        const blockType = codeMatch[1] || 'plain';
        const blockContent = codeMatch[2];

        if (blockContent.includes('Tool:') || blockContent.includes('Parameters:')) {
          if (blockType !== 'tool-call') {
            wrongFormats.push(blockType);
            logger.warn(`Found code block with type '${blockType}' that looks like a tool call`);
          }
        }
      }

      if (wrongFormats.length > 0) {
        const uniqueFormats = [...new Set(wrongFormats)];
        console.log(renderer.renderError(`Tool calls detected but using WRONG format: \`\`\`${uniqueFormats.join(', ```')}`));
        console.log(renderer.renderWarning(`You MUST use \`\`\`tool-call (not \`\`\`json or any other type)`));
        console.log(renderer.renderInfo('Example of CORRECT format:'));
        console.log(chalk.gray('```tool-call'));
        console.log(chalk.gray('Tool: Write'));
        console.log(chalk.gray('Parameters:'));
        console.log(chalk.gray('file_path: example.txt'));
        console.log(chalk.gray('content: Hello World'));
        console.log(chalk.gray('```'));
      }
    }

    return toolCalls;
  }

  private parseValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Return as string
      return value;
    }
  }
}
