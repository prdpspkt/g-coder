import * as readline from 'readline';
import {AIProvider, ProviderFactory} from './providers';
import {ContextManager} from './context/manager';
import {toolRegistry} from './tools';
import {renderer} from './ui/renderer';
import {configManager} from './utils/config';
import {logger} from './utils/logger';
import {commandManager} from './utils/commands';
import {hookManager} from './utils/hooks';
import {artifactParser} from './utils/artifact-parser';
import {sessionManager} from './utils/session';
import {toOpenAITools, toAnthropicTools} from './tools/converter';
import {ApprovalManager} from './utils/approval';
import {PlatformDetector} from './utils/platform';
import {ProjectScanner} from './utils/project-scanner';
import {ConversationHistoryManager} from './utils/history';
import {StreamingExecutor} from './utils/streaming-executor';
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
    private approvalManager: ApprovalManager;
    private currentTask: string = '';
    private statusInterval: NodeJS.Timeout | null = null;
    private projectScanned: boolean = false;
    private historyManager: ConversationHistoryManager;
    private multiLineBuffer: string[] = [];
    private isMultiLineMode: boolean = false;
    private codeBlockMarker: string = '';
    private bossMode: boolean = false;
    private shouldStopExecution: boolean = false;
    private streamingExecutor: StreamingExecutor;

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

        // Initialize approval manager with config
        const approvalConfig = configManager.getApprovalConfig();
        this.approvalManager = new ApprovalManager(approvalConfig);

        // Initialize conversation history manager
        this.historyManager = new ConversationHistoryManager();

        // Initialize streaming executor
        this.streamingExecutor = new StreamingExecutor(this.approvalManager);

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: renderer.renderPrompt(),
            terminal: true,
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
        await hookManager.trigger({event: 'session_start'});

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

        // Load and display conversation history context if available
        if (this.historyManager.hasHistory()) {
            const summary = this.historyManager.getContextSummary();
            console.log(chalk.cyan('\n📚 Previous Conversation Context:'));
            console.log(chalk.gray(summary));

            // Load recent history into context for AI awareness
            const recentHistory = this.historyManager.getRecentHistory(5);
            if (recentHistory.length > 0) {
                console.log(chalk.gray(`   Loaded ${recentHistory.length} previous interactions for context awareness`));

                // Add summarized history to AI context (as a user message with context information)
                const historySummary = `[CONTEXT: Previous conversation history from this project]\n` +
                    recentHistory.map(msg => `${msg.role}: ${msg.content.substring(0, 150)}...`).join('\n') +
                    `\n[END CONTEXT]`;

                this.context.addMessage('user', historySummary);
                this.context.addMessage('assistant', 'I understand the previous conversation context and will use it to provide more relevant assistance.');
            }
            console.log('');
        }

        console.log(renderer.renderInfo('Type "exit" to quit, "/help" for commands'));
        console.log(chalk.cyan('\n💡 Input Tips:'));
        console.log(chalk.gray('  • Just type or paste anything and press Enter - works for single or multi-line'));
        console.log(chalk.gray('  • Paste multi-line code/errors directly - detected automatically'));
        console.log(chalk.gray('  • Interrupt: Press Ctrl+C to cancel current operation\n'));

        this.setupHandlers();
        this.promptWithStatus();
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
        // Handle raw paste events (before readline processes them)
        let pendingPaste = '';

        // Listen to stdin for paste detection
        process.stdin.on('data', (chunk) => {
            const data = chunk.toString();
            // If data contains newlines, it's likely a paste
            if (data.includes('\n') && data.split('\n').length > 2) {
                pendingPaste = data;
            }
        });

        this.rl.on('line', async (input: string) => {
            // Check if we have pending pasted content
            if (pendingPaste) {
                const pastedText = pendingPaste.trim();
                pendingPaste = '';

                if (pastedText) {
                    console.log(chalk.cyan(`\n📋 Pasted ${pastedText.split('\n').length} lines - processing...\n`));
                    await this.processUserInput(pastedText);
                    this.promptWithStatus();
                    return;
                }
            }

            const trimmed = input.trim();

            // If in multi-line mode
            if (this.isMultiLineMode) {
                // Check for empty line to submit (double Enter)
                if (trimmed === '') {
                    // Show closing box
                    console.log(renderer.renderMultiLineEnd());

                    // Submit the buffered input
                    this.isMultiLineMode = false;
                    const multiLineInput = this.multiLineBuffer.join('\n');
                    this.multiLineBuffer = [];
                    this.rl.setPrompt(renderer.renderPrompt());

                    if (multiLineInput.trim()) {
                        console.log(chalk.cyan(`\n📝 Submitting ${multiLineInput.split('\n').length} lines...\n`));
                        await this.processUserInput(multiLineInput);
                    }
                    this.promptWithStatus();
                    return;
                }

                // Accumulate the line
                this.multiLineBuffer.push(input);
                this.rl.setPrompt(renderer.renderMultiLinePrompt());
                this.rl.prompt();
                return;
            }

            // If empty line when not in multi-line mode, just reprompt
            if (!trimmed) {
                this.promptWithStatus();
                return;
            }

            if (this.isProcessing) {
                // Input blocked during processing - show current task
                process.stdout.write('\r\x1b[K'); // Clear current line
                console.log(renderer.renderWarning(`Agent is busy: ${this.currentTask || 'Processing...'}`));
                this.showStatusLine();
                return; // Don't show prompt during processing
            }

            // Handle commands (single-line only)
            if (trimmed.startsWith('/')) {
                await this.handleCommand(trimmed);
                this.promptWithStatus();
                return;
            }

            // Handle exit
            if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
                console.log(renderer.renderInfo('Goodbye!'));
                process.exit(0);
            }

            // Process input immediately - paste detection handles multi-line automatically
            await this.processUserInput(trimmed);
            this.promptWithStatus();
        });

        this.rl.on('close', async () => {
            console.log(renderer.renderInfo('\nGoodbye!'));
            await hookManager.trigger({event: 'session_end'});
            process.exit(0);
        });

        // Handle Ctrl+C (SIGINT) - interrupt current operation
        let ctrlCCount = 0;
        let ctrlCTimeout: NodeJS.Timeout | null = null;

        process.on('SIGINT', async () => {
            if (this.isProcessing) {
                // If processing, cancel the current operation
                console.log(chalk.yellow('\n\n⚠️  Interrupted! Stopping current operation...'));
                this.isProcessing = false;
                this.shouldStopExecution = true;
                this.clearStatusLine();
                this.multiLineBuffer = [];
                this.isMultiLineMode = false;
                this.rl.setPrompt(renderer.renderPrompt());
                this.promptWithStatus();
            } else if (this.isMultiLineMode) {
                // If in multi-line mode, cancel it
                console.log(chalk.yellow('\n\nMulti-line input cancelled'));
                this.isMultiLineMode = false;
                this.multiLineBuffer = [];
                this.rl.setPrompt(renderer.renderPrompt());
                this.promptWithStatus();
            } else {
                // If idle, exit on second Ctrl+C within 2 seconds
                ctrlCCount++;

                if (ctrlCCount === 1) {
                    console.log(renderer.renderInfo('\nPress Ctrl+C again within 2 seconds to exit, or type "exit" to quit.'));
                    this.promptWithStatus();

                    // Reset counter after 2 seconds
                    ctrlCTimeout = setTimeout(() => {
                        ctrlCCount = 0;
                    }, 2000);
                } else if (ctrlCCount >= 2) {
                    // Second Ctrl+C - exit
                    if (ctrlCTimeout) clearTimeout(ctrlCTimeout);
                    console.log(renderer.renderInfo('\nGoodbye!'));
                    await hookManager.trigger({event: 'session_end'});
                    process.exit(0);
                }
            }
        });

        // Listen for readline SIGINT event (also triggered by Ctrl+C)
        this.rl.on('SIGINT', () => {
            // readline handles Ctrl+C, emit through process for consistency
            process.emit('SIGINT', 'SIGINT' as any);
        });
    }

    /**
     * Determine if input should trigger multi-line mode
     * Detects incomplete input like code blocks, error traces, unclosed brackets, etc.
     */
    private shouldEnterMultiLineMode(input: string): boolean {
        const trimmed = input.trim();

        // Code block start (``` with language)
        if (trimmed.startsWith('```')) {
            return true;
        }

        // Common error trace patterns
        const errorPatterns = [
            /^Error:/i,
            /^TypeError:/i,
            /^SyntaxError:/i,
            /^ReferenceError:/i,
            /^RangeError:/i,
            /Exception in thread/,
            /^\s*at\s+/,  // Stack trace lines
            /^\s*\^\s*$/,  // Caret pointing to error
            /Traceback \(most recent call last\):/,
        ];

        for (const pattern of errorPatterns) {
            if (pattern.test(input)) {
                return true;
            }
        }

        // Unclosed brackets/braces/parentheses
        const openBrackets = (input.match(/[\(\[\{]/g) || []).length;
        const closeBrackets = (input.match(/[\)\]\}]/g) || []).length;
        if (openBrackets > closeBrackets) {
            return true;
        }

        // Line ends with common continuation indicators
        const continuationPatterns = [
            /,\s*$/,       // Ends with comma
            /\{\s*$/,      // Ends with opening brace
            /\[\s*$/,      // Ends with opening bracket
            /\(\s*$/,      // Ends with opening paren
            /=\s*$/,       // Ends with assignment
            /:\s*$/,       // Ends with colon (Python, JS objects)
            /\\\s*$/,      // Ends with backslash continuation
            /&&\s*$/,      // Ends with AND
            /\|\|\s*$/,    // Ends with OR
            /\.\s*$/,      // Ends with dot (chaining)
        ];

        for (const pattern of continuationPatterns) {
            if (pattern.test(input)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Pause readline input during processing
     */
    private pauseInput(): void {
        this.rl.pause();
    }

    /**
     * Resume readline input after processing
     */
    private resumeInput(): void {
        this.rl.resume();
        this.promptWithStatus();
    }

    /**
     * Update the current task and display status
     */
    private updateStatus(task: string): void {
        this.currentTask = task;
        this.showStatusLine();
    }

    /**
     * Show status line above the prompt
     */
    private showStatusLine(): void {
        if (!this.currentTask) return;

        // Move cursor up, clear line, show status, move back
        const statusLine = chalk.bgBlue.white(` ⚙ ${this.currentTask} `);
        process.stdout.write(`\r\x1b[K${statusLine}\n`);
    }

    /**
     * Clear status line
     */
    private clearStatusLine(): void {
        this.currentTask = '';
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    }

    /**
     * Show status bar with model info and modes
     */
    private showStatusBar(): void {
        const config = configManager.get();
        const tokenCount = this.context.getTokenCount();
        const maxTokens = config.maxContextTokens || 8000;

        const statusBar = renderer.renderStatusBar({
            model: config.model,
            provider: config.provider,
            planMode: this.planMode,
            bossMode: this.bossMode,
            multiLineMode: this.isMultiLineMode,
            tokenCount: tokenCount > 0 ? tokenCount : undefined,
            maxTokens: tokenCount > 0 ? maxTokens : undefined,
        });

        console.log('\n' + statusBar);
    }

    /**
     * Show status bar and prompt for input
     */
    private promptWithStatus(): void {
        this.showStatusBar();
        this.rl.prompt();
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

        // Built-in commands list
        const builtInCommands = [
            'help', 'clear', 'context', 'compact', 'tools', 'commands', 'hooks',
            'reload', 'rescan', 'history', 'model', 'provider', 'config', 'export',
            'plan', 'approve', 'yes', 'y', 'reject', 'no', 'n',
            'save', 'load', 'session', 'sessions', 'delete-session',
            'approval', 'boss'
        ];

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

            case 'commands': {
                const customCmds = commandManager.getAllCommands();
                if (customCmds.length === 0) {
                    console.log(renderer.renderInfo('No custom commands found'));
                    console.log(renderer.renderInfo(`Add .md files to: ${commandManager.getCommandsDir()}`));
                } else {
                    console.log(renderer.renderHeader('Custom Commands'));
                    customCmds.forEach(cmd => {
                        console.log(chalk.yellow(`  /${cmd.name}`) + (cmd.description ? ` - ${chalk.gray(cmd.description)}` : ''));
                    });
                    console.log(chalk.gray(`\nCommands directory: ${commandManager.getCommandsDir()}`));
                }
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

            case 'rescan': {
                const scanSpinner = ora('Rescanning project...').start();
                try {
                    ProjectScanner.clearCache();
                    const projectInfo = await ProjectScanner.scan();
                    const projectContext = ProjectScanner.formatAsContext(projectInfo);

                    scanSpinner.succeed(`Project rescanned: ${projectInfo.name} (${projectInfo.type})`);
                    console.log(chalk.cyan('\nProject Information:'));
                    console.log(projectContext);
                } catch (error) {
                    scanSpinner.fail('Failed to rescan project');
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.log(renderer.renderError(errorMsg));
                }
            }
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
                const displayConfig = {...currentConfig};
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

            case 'session':
                if (args.length === 0) {
                    // Show current session and usage
                    console.log(renderer.renderHeader('Session Management'));

                    if (this.currentSessionId) {
                        const currentSession = sessionManager.listSessions().find(s => s.id === this.currentSessionId);
                        if (currentSession) {
                            console.log(chalk.cyan('Current Session:'));
                            console.log(`  ${chalk.yellow(currentSession.name)}`);
                            console.log(`  ${chalk.gray(`ID: ${currentSession.id}`)}`);
                            console.log(`  ${chalk.gray(`Messages: ${currentSession.metadata.messageCount}`)}`);
                            console.log('');
                        }
                    } else {
                        console.log(renderer.renderInfo('No active session'));
                        console.log('');
                    }

                    console.log(chalk.cyan('Usage:'));
                    console.log(chalk.gray('  /session list              - List all saved sessions'));
                    console.log(chalk.gray('  /session load <name/id>    - Load a session'));
                    console.log(chalk.gray('  /session save <name>       - Save current conversation'));
                    console.log(chalk.gray('  /session delete <name/id>  - Delete a session'));
                    console.log(chalk.gray('  /session clear             - Clear current session (keeps history)\n'));
                } else {
                    const subCmd = args[0].toLowerCase();
                    const subArgs = args.slice(1);

                    switch (subCmd) {
                        case 'list': {
                            const sessionList = sessionManager.listSessions();
                            if (sessionList.length === 0) {
                                console.log(renderer.renderInfo('No saved sessions found'));
                            } else {
                                console.log(renderer.renderHeader(`Saved Sessions (${sessionList.length})`));
                                sessionList.forEach((session, index) => {
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
                        }

                        case 'load': {
                            if (subArgs.length === 0) {
                                console.log(renderer.renderError('Please provide a session name or ID'));
                                console.log(renderer.renderInfo('Usage: /session load <session-name-or-id>'));
                            } else {
                                const identifier = subArgs.join(' ');
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
                        }

                        case 'save': {
                            if (subArgs.length === 0) {
                                console.log(renderer.renderError('Please provide a session name'));
                                console.log(renderer.renderInfo('Usage: /session save <session-name>'));
                            } else {
                                const sessionName = subArgs.join(' ');
                                const messages = this.context.getMessages();
                                const config = configManager.get();
                                const session = sessionManager.saveSession(sessionName, messages, config.provider, config.model);
                                this.currentSessionId = session.id;
                                console.log(renderer.renderSuccess(`Session saved: ${session.name}`));
                                console.log(renderer.renderInfo(`${session.metadata.messageCount} messages saved`));
                            }
                            break;
                        }

                        case 'delete': {
                            if (subArgs.length === 0) {
                                console.log(renderer.renderError('Please provide a session name or ID'));
                                console.log(renderer.renderInfo('Usage: /session delete <session-name-or-id>'));
                            } else {
                                const identifier = subArgs.join(' ');
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
                        }

                        case 'clear': {
                            console.log(renderer.renderWarning('Clearing current session context...'));
                            const contextSize = this.context.getContextSize();
                            this.context.clear();
                            this.currentSessionId = null;
                            console.log(renderer.renderSuccess(`Session cleared (${contextSize} messages removed)`));
                            console.log(renderer.renderInfo('Note: Conversation history in project files is preserved'));
                            console.log(renderer.renderInfo('Use /history clear to remove project history'));
                            break;
                        }

                        default:
                            console.log(renderer.renderError(`Unknown session subcommand: ${subCmd}`));
                            console.log(renderer.renderInfo('Use: list, load, save, delete, or clear'));
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

            case 'approval':
                if (args.length === 0) {
                    // Show approval status
                    const approvalConfig = this.approvalManager.getConfig();
                    const platformInfo = this.approvalManager.getPlatformInfo();

                    console.log(renderer.renderHeader('Execution Approval Settings'));
                    console.log(renderer.renderInfo(`Status: ${approvalConfig.enabled ? chalk.green('enabled') : chalk.red('disabled')}`));
                    console.log(renderer.renderInfo(`Platform: ${chalk.cyan(PlatformDetector.getDescription(platformInfo))}`));
                    console.log(chalk.gray(`  Detected ${platformInfo.dangerousPatterns.length} dangerous patterns for your OS`));

                    if (approvalConfig.enabled) {
                        console.log(chalk.cyan('\nTools requiring approval:'));
                        Object.entries(approvalConfig.toolsRequiringApproval).forEach(([tool, required]) => {
                            if (required) {
                                console.log(chalk.yellow(`  ✓ ${tool}`));
                            }
                        });

                        const stats = this.approvalManager.getStatistics();
                        if (stats.total > 0) {
                            console.log(chalk.cyan('\nApproval Statistics:'));
                            console.log(chalk.gray(`  Total requests: ${stats.total}`));
                            console.log(chalk.green(`  Approved: ${stats.approved}`));
                            console.log(chalk.red(`  Declined: ${stats.declined}`));
                        }
                    }

                    console.log(chalk.gray('\nUsage:'));
                    console.log(chalk.gray('  /approval on    - Enable execution approval'));
                    console.log(chalk.gray('  /approval off   - Disable execution approval'));
                    console.log(chalk.gray('  /approval reset - Reset auto-approve patterns'));
                    console.log(chalk.gray('  /approval stats - Show approval statistics'));
                } else {
                    const subCmd = args[0].toLowerCase();

                    switch (subCmd) {
                        case 'on':
                        case 'enable':
                            configManager.setApprovalEnabled(true);
                            this.approvalManager.updateConfig({enabled: true});
                            console.log(renderer.renderSuccess('Execution approval enabled'));
                            console.log(renderer.renderInfo('You will be prompted before dangerous operations'));
                            break;

                        case 'off':
                        case 'disable':
                            configManager.setApprovalEnabled(false);
                            this.approvalManager.updateConfig({enabled: false});
                            console.log(renderer.renderInfo('Execution approval disabled'));
                            console.log(renderer.renderWarning('Tools will execute without confirmation'));
                            break;

                        case 'reset':
                            this.approvalManager.resetAutoApprove();
                            console.log(renderer.renderSuccess('Auto-approve patterns cleared'));
                            break;

                        case 'stats':
                        case 'statistics':
                            const stats = this.approvalManager.getStatistics();
                            console.log(renderer.renderHeader('Approval Statistics'));
                            console.log(chalk.cyan(`Total requests: ${stats.total}`));
                            console.log(chalk.green(`Approved: ${stats.approved}`));
                            console.log(chalk.red(`Declined: ${stats.declined}`));

                            if (Object.keys(stats.byTool).length > 0) {
                                console.log(chalk.cyan('\nBy Tool:'));
                                Object.entries(stats.byTool).forEach(([tool, counts]) => {
                                    console.log(chalk.yellow(`  ${tool}:`));
                                    console.log(chalk.green(`    Approved: ${counts.approved}`));
                                    console.log(chalk.red(`    Declined: ${counts.declined}`));
                                });
                            }
                            break;

                        case 'clear':
                        case 'clear-history':
                            this.approvalManager.clearHistory();
                            console.log(renderer.renderSuccess('Approval history cleared'));
                            break;

                        default:
                            console.log(renderer.renderError(`Unknown approval subcommand: ${subCmd}`));
                            console.log(renderer.renderInfo('Use: on, off, reset, stats, or clear'));
                    }
                }
                break;

            case 'history':
                if (args.length === 0) {
                    // Show history summary
                    if (this.historyManager.hasHistory()) {
                        const summary = this.historyManager.getContextSummary();
                        console.log(renderer.renderHeader('Conversation History'));
                        console.log(summary);
                        console.log(chalk.gray(`\nHistory file: ${this.historyManager.getHistoryFilePath()}`));
                        console.log(chalk.gray('\nUsage:'));
                        console.log(chalk.gray('  /history         - Show history summary'));
                        console.log(chalk.gray('  /history clear   - Clear conversation history'));
                    } else {
                        console.log(renderer.renderInfo('No conversation history found'));
                        console.log(chalk.gray('History will be saved automatically as you interact with g-coder'));
                    }
                } else {
                    const subCmd = args[0].toLowerCase();
                    if (subCmd === 'clear') {
                        this.historyManager.clearHistory();
                        console.log(renderer.renderSuccess('Conversation history cleared'));
                    } else {
                        console.log(renderer.renderError(`Unknown history subcommand: ${subCmd}`));
                        console.log(renderer.renderInfo('Use: /history or /history clear'));
                    }
                }
                break;

            case 'boss':
                this.bossMode = !this.bossMode;
                this.streamingExecutor.setBossMode(this.bossMode);
                if (this.bossMode) {
                    console.log(chalk.bold.red('🔥 BOSS MODE ENABLED 🔥'));
                    console.log(chalk.yellow('All approval requirements bypassed'));
                    console.log(chalk.yellow('Tools will execute without confirmation (including parallel execution)'));
                    console.log(chalk.gray('Use with caution - type /boss again to disable'));
                } else {
                    console.log(chalk.green('✓ Boss mode disabled'));
                    console.log(renderer.renderInfo('Normal approval settings restored'));
                }
                break;

            case 'compact': {
                const keepRecent = args.length > 0 ? parseInt(args[0]) : 10;

                if (isNaN(keepRecent) || keepRecent < 1) {
                    console.log(renderer.renderError('Invalid number. Usage: /compact [number-of-recent-messages]'));
                    break;
                }

                const currentSize = this.context.getContextSize();
                if (currentSize <= keepRecent) {
                    console.log(renderer.renderInfo(`Not enough messages to compact. Current: ${currentSize}, Keep recent: ${keepRecent}`));
                    break;
                }

                const compactSpinner = ora('Compacting conversation history...').start();

                try {
                    const result = await this.context.compactConversation(this.provider, keepRecent);

                    if (result.success) {
                        compactSpinner.succeed('Conversation compacted successfully');
                        console.log(chalk.green(`\n✓ Compacted ${result.messagesBefore} messages into ${result.messagesAfter} messages`));
                        console.log(chalk.gray(`  Kept ${keepRecent} most recent messages`));
                        console.log(chalk.gray(`  Saved ~${result.messagesBefore - result.messagesAfter} messages worth of context`));

                        const newTokenCount = this.context.getTokenCount();
                        if (newTokenCount > 0) {
                            console.log(chalk.gray(`  Current tokens: ${newTokenCount}`));
                        }
                    } else {
                        compactSpinner.fail('Failed to compact conversation');
                        console.log(renderer.renderError('Not enough messages or compaction failed'));
                    }
                } catch (error) {
                    compactSpinner.fail('Error compacting conversation');
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.log(renderer.renderError(errorMsg));
                }
            }
                break;

            default: {
                console.log(renderer.renderError(`Unknown command: /${cmd}`));

                // Get all available commands (built-in + custom)
                const customCmdList = commandManager.getAllCommands().map(c => c.name);
                const allCommands = [...builtInCommands, ...customCmdList];

                // Find similar commands using simple string matching
                const suggestions = this.findSimilarCommands(cmd, allCommands);

                if (suggestions.length > 0) {
                    console.log(chalk.cyan('\n💡 Did you mean:'));
                    suggestions.slice(0, 5).forEach(suggestion => {
                        console.log(chalk.yellow(`  /${suggestion}`));
                    });
                    console.log('');
                } else {
                    console.log(chalk.gray('\nAvailable commands:'));
                    console.log(chalk.yellow('  Built-in: ') + builtInCommands.slice(0, 10).map(c => `/${c}`).join(', ') + '...');
                    if (customCmdList.length > 0) {
                        console.log(chalk.yellow('  Custom: ') + customCmdList.map(c => `/${c}`).join(', '));
                    }
                    console.log('');
                }

                console.log(renderer.renderInfo('Type /help for detailed command list'));
            }
        }
    }

    /**
     * Find similar commands using fuzzy matching
     */
    private findSimilarCommands(input: string, commands: string[]): string[] {
        const inputLower = input.toLowerCase();

        // Calculate similarity scores
        const scored = commands.map(cmd => ({
            cmd,
            score: this.calculateSimilarity(inputLower, cmd.toLowerCase())
        }));

        // Filter and sort by score
        return scored
            .filter(item => item.score > 0.3) // Threshold for suggestions
            .sort((a, b) => b.score - a.score)
            .map(item => item.cmd);
    }

    /**
     * Calculate similarity between two strings (0-1)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        // Exact match
        if (str1 === str2) return 1;

        // Starts with
        if (str2.startsWith(str1)) return 0.9;

        // Contains
        if (str2.includes(str1)) return 0.7;

        // Levenshtein distance-based similarity
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);

        if (maxLength === 0) return 1;

        return 1 - (distance / maxLength);
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        // Initialize matrix
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        // Fill matrix
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    private showHelp(): void {
        console.log(renderer.renderHeader('G-Coder Help'));
        console.log(`
${chalk.cyan.bold('Commands:')}
  ${chalk.yellow('/help')}       - Show this help message
  ${chalk.yellow('/clear')}      - Clear conversation context
  ${chalk.yellow('/context')}    - Show context size
  ${chalk.yellow('/compact')} [n] - Compact conversation (keep n recent messages, default 10)
  ${chalk.yellow('/tools')}      - List available tools
  ${chalk.yellow('/commands')}   - List custom slash commands
  ${chalk.yellow('/hooks')}      - Show configured hooks
  ${chalk.yellow('/reload')}     - Reload commands and hooks
  ${chalk.yellow('/rescan')}     - Rescan project structure and context
  ${chalk.yellow('/history')}    - View or clear project conversation history
  ${chalk.yellow('/model')}      - Show or change current model
  ${chalk.yellow('/provider')}   - Show or change AI provider
  ${chalk.yellow('/config')}     - Show current configuration
  ${chalk.yellow('/export')}     - Export conversation context
  ${chalk.yellow('/plan')}       - Toggle plan mode (requires approval before execution)
  ${chalk.yellow('/approve')} or ${chalk.yellow('/yes')} - Approve pending plan
  ${chalk.yellow('/reject')} or ${chalk.yellow('/no')}  - Reject pending plan
  ${chalk.yellow('/approval')}   - Manage execution approval settings (on/off/stats)
  ${chalk.yellow('/boss')}       - Toggle boss mode (bypass all approvals - use with caution!)
  ${chalk.yellow('exit')} or ${chalk.yellow('quit')} - Exit the application

${chalk.cyan.bold('Session Management:')}
  ${chalk.yellow('/session')}              - Show current session and management options
  ${chalk.yellow('/session list')}         - List all saved sessions
  ${chalk.yellow('/session load <name>')}  - Load a session
  ${chalk.yellow('/session save <name>')}  - Save current conversation
  ${chalk.yellow('/session delete <name>')} - Delete a session
  ${chalk.yellow('/session clear')}        - Clear current session (keeps history)

  ${chalk.gray('Legacy commands (still supported):')}
  ${chalk.yellow('/save <name>')}         - Save current conversation
  ${chalk.yellow('/load <name-or-id>')}   - Load a saved session
  ${chalk.yellow('/sessions')}            - List all saved sessions
  ${chalk.yellow('/delete-session <name-or-id>')} - Delete a session

${chalk.cyan.bold('Input Methods:')}
  ${chalk.green('Paste Detection:')} Automatically detects and handles pasted content
  - Paste multi-line code, error messages, or logs directly
  - Works with any text length - no special formatting needed

  ${chalk.green('Multi-line Mode:')} Triggered automatically for:
  - Code blocks starting with ${chalk.yellow('```')}
  - Error traces and stack traces
  - Code with unclosed brackets/braces
  - Lines ending with continuation characters (comma, colon, etc.)
  ${chalk.gray('Submit:')} Press ${chalk.yellow('Enter')} on empty line (double-Enter)

  ${chalk.green('Single-line:')} For short messages, just type and press ${chalk.yellow('Enter')}

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
        this.pauseInput();
        this.updateStatus('Processing your request...');

        try {
            // Scan project on first user input
            if (!this.projectScanned) {
                this.updateStatus('Scanning project...');
                const scanSpinner = ora('Analyzing project structure...').start();

                try {
                    const projectInfo = await ProjectScanner.scan();
                    const projectContext = ProjectScanner.formatAsContext(projectInfo);

                    // Add project context to the conversation
                    this.context.addMessage('user', `${projectContext}\n\nPlease keep this project context in mind for all future questions and responses.`);
                    this.context.addMessage('assistant', `I understand. I'm now working on the ${projectInfo.name} project (${projectInfo.type}). I'll use this context to provide more relevant assistance.`);

                    scanSpinner.succeed(`Project scanned: ${projectInfo.name} (${projectInfo.type})`);
                    this.projectScanned = true;
                } catch (error) {
                    scanSpinner.fail('Failed to scan project');
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    logger.warn('Project scan failed:', errorMsg);
                    this.projectScanned = true; // Don't try again
                }
            }

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

            // Add user message to context and history
            this.context.addMessage('user', input);
            this.historyManager.addMessage('user', input);

            // Track tool execution to prevent infinite loops
            const executedTools: string[] = [];
            const MAX_TOOL_ITERATIONS = 10;
            let iterationCount = 0;

            // Get messages for AI provider
            let messages = this.context.getAIMessages();

            console.log(''); // New line before response

            // Show spinner while AI is thinking
            this.updateStatus('AI is thinking...');
            const thinkingSpinner = ora('AI is processing your request...').start();

            // Reset streaming executor for new request
            this.streamingExecutor.reset();

            // Stream response from provider with real-time detection
            let fullResponse = '';
            let streamBuffer = '';
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
                    (chunk: string) => {
                        // Real-time streaming detection
                        const { detectedItems, updatedBuffer } = this.streamingExecutor.parseStreamingChunk(chunk, streamBuffer);
                        streamBuffer = updatedBuffer;

                        // Queue detected tasks for sequential execution
                        for (const task of detectedItems) {
                            this.streamingExecutor.queueTask(task);
                        }
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
                fullResponse = await this.provider.chat(messages, (chunk: string) => {
                    // Real-time streaming detection for non-native providers
                    const { detectedItems, updatedBuffer } = this.streamingExecutor.parseStreamingChunk(chunk, streamBuffer);
                    streamBuffer = updatedBuffer;

                    // Queue detected tasks for sequential execution
                    for (const task of detectedItems) {
                        this.streamingExecutor.queueTask(task);
                    }
                }) as string;

                // Parse tool calls from response text (final check)
                toolCalls = this.parseToolCalls(fullResponse);
            }

            thinkingSpinner.succeed('AI response received');

            // Wait for all queued tasks to complete
            await this.streamingExecutor.waitForAll();

            // Display execution summary
            if (this.streamingExecutor.getTasks().length > 0) {
                this.streamingExecutor.displayStatus();
            }

            // Log full response for debugging
            logger.debug('=== Full AI Response ===');
            logger.debug(fullResponse);
            logger.debug('=== End AI Response ===');

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
                this.clearStatusLine();
                this.resumeInput();
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

                // Execute tools sequentially (not in parallel) to avoid overlapping approval prompts
                this.updateStatus(`Executing ${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''}...`);
                console.log(chalk.cyan(`\nExecuting ${toolCalls.length} tool${toolCalls.length > 1 ? 's' : ''}...\n`));

                const toolResults: Array<{ toolCall: { name: string; params: Record<string, any> }; result: any }> = [];

                let userCancelled = false;

                for (const toolCall of toolCalls) {
                    // Don't show tool call details for Read tool - will show concise message instead
                    if (toolCall.name !== 'Read') {
                        console.log(renderer.renderToolCall(toolCall.name, toolCall.params));
                    }

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
                        toolResults.push({
                            toolCall,
                            result: {success: false, error: 'Blocked by hook'},
                        });
                        continue;
                    }

                    // Check if tool requires approval (skip if boss mode is enabled)
                    if (!this.bossMode && this.approvalManager.requiresApproval(toolCall.name)) {
                        const approvalResult = await this.approvalManager.promptForApproval({
                            toolName: toolCall.name,
                            params: toolCall.params,
                        });

                        if (!approvalResult.approved) {
                            console.log(chalk.yellow('Execution stopped. Please provide new instructions.'));
                            userCancelled = true;
                            break;
                        }
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

                    toolResults.push({
                        toolCall,
                        result,
                    });
                }

                // If user cancelled, stop all execution and return
                if (userCancelled) {
                    break;
                }

                // Collect all results for context
                const allResults = toolResults
                    .filter(({result}) => result.output)
                    .map(({toolCall, result}) => `Tool ${toolCall.name} result:\n${result.output}`)
                    .join('\n\n');

                if (allResults) {
                    this.context.addMessage('user', allResults);

                    // Get AI response to all tool results
                    const followUpMessages = this.context.getAIMessages();

                    this.updateStatus('AI analyzing tool results...');
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

            // Add assistant response to context and history
            this.context.addMessage('assistant', fullResponse);
            this.historyManager.addMessage('assistant', fullResponse);

            // Trigger assistant response hook
            await hookManager.trigger({
                event: 'assistant_response',
                assistantResponse: fullResponse,
            });

            // Check if token limit is exceeded and auto-continue
            await this.checkAndHandleTokenLimit();

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(renderer.renderError(errorMsg));
            logger.error('Error processing input:', error);
        } finally {
            this.isProcessing = false;
            this.clearStatusLine();
            this.resumeInput();
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

                    toolCalls.push({name: toolName, params});
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

        // Deduplicate tool calls (remove exact duplicates based on name and params)
        const uniqueToolCalls: Array<{ name: string; params: Record<string, any> }> = [];
        const seen = new Set<string>();

        for (const toolCall of toolCalls) {
            const signature = `${toolCall.name}:${JSON.stringify(toolCall.params)}`;
            if (!seen.has(signature)) {
                seen.add(signature);
                uniqueToolCalls.push(toolCall);
            } else {
            }
        }

        if (uniqueToolCalls.length < toolCalls.length) {
            console.log(renderer.renderWarning(`Removed ${toolCalls.length - uniqueToolCalls.length} duplicate tool call(s)`));
        }

        return uniqueToolCalls;
    }

    /**
     * Check if token limit is exceeded and handle auto-continuation
     */
    private async checkAndHandleTokenLimit(): Promise<void> {
        const config = configManager.get();

        // Check if approaching or exceeded token limit
        if (this.context.isTokenLimitExceeded()) {
            console.log(chalk.yellow.bold('\n⚠️  Token Limit Exceeded'));
            console.log(chalk.gray('─'.repeat(60)));
            console.log(chalk.cyan('The conversation has reached the maximum token limit.'));
            console.log(chalk.cyan('Automatically saving current conversation and starting fresh...\n'));

            // Auto-save current conversation
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const sessionName = `auto-save-${timestamp}`;
            const messages = this.context.getMessages();

            try {
                const session = sessionManager.saveSession(sessionName, messages, config.provider, config.model);
                console.log(chalk.green(`✓ Conversation saved: ${session.name}`));
                console.log(chalk.gray(`  Session ID: ${session.id}`));
                console.log(chalk.gray(`  Messages saved: ${session.metadata.messageCount}`));
                console.log(chalk.gray(`  You can load this session later with: /load ${session.id}\n`));
            } catch (error) {
                logger.error('Failed to auto-save session:', error);
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.log(chalk.red(`✗ Failed to auto-save session: ${errorMsg}\n`));
            }

            // Clear context to continue
            this.context.clear();
            console.log(chalk.green('✓ Context cleared - ready to continue with a fresh conversation'));
            console.log(chalk.gray('─'.repeat(60)));
            console.log(chalk.cyan('💡 Tip: Previous conversation history is still available in project history'));
            console.log(chalk.cyan('    and can be accessed with /history or /sessions commands.\n'));

        } else if (this.context.isApproachingTokenLimit()) {
            // Warn when approaching limit (90% threshold)
            const tokenCount = this.context.getTokenCount();
            const maxTokens = config.maxContextTokens || 8000;
            const percentage = Math.round((tokenCount / maxTokens) * 100);

            console.log(chalk.yellow(`\n⚠️  Approaching token limit: ${tokenCount} / ${maxTokens} tokens (${percentage}%)`));
            console.log(chalk.gray('   Conversation will auto-save and continue when limit is reached.\n'));
        }
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
