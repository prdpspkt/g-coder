import chalk from 'chalk';
import { toolRegistry } from '../tools';
import { artifactParser } from './artifact-parser';
import { renderer } from '../ui/renderer';
import { logger } from './logger';
import { hookManager } from './hooks';
import { ApprovalManager } from './approval';

export interface StreamingTask {
    id: string;
    type: 'tool' | 'artifact';
    status: 'detected' | 'executing' | 'completed' | 'failed';
    name: string;
    data: any;
    result?: any;
    error?: string;
    startTime?: number;
    endTime?: number;
}

export class StreamingExecutor {
    private tasks: Map<string, StreamingTask> = new Map();
    private taskQueue: StreamingTask[] = [];
    private isExecuting: boolean = false;
    private taskCounter = 0;
    private statusUpdateCallback?: (tasks: StreamingTask[]) => void;
    private bossMode: boolean = false;
    private approvalManager?: ApprovalManager;
    private executionPromise: Promise<void> | null = null;

    constructor(approvalManager?: ApprovalManager) {
        this.approvalManager = approvalManager;
    }

    setBossMode(enabled: boolean): void {
        this.bossMode = enabled;
    }

    setStatusUpdateCallback(callback: (tasks: StreamingTask[]) => void): void {
        this.statusUpdateCallback = callback;
    }

    /**
     * Start the execution queue processor
     */
    private async processQueue(): Promise<void> {
        if (this.isExecuting) return;

        this.isExecuting = true;

        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            if (!task) break;

            await this.executeTaskInternal(task);
        }

        this.isExecuting = false;
    }

    /**
     * Parse streaming chunk and detect complete tools/artifacts
     */
    parseStreamingChunk(chunk: string, buffer: string): { detectedItems: StreamingTask[], updatedBuffer: string } {
        const fullText = buffer + chunk;
        const detectedItems: StreamingTask[] = [];

        // Detect complete tool calls (```tool-call ... ```)
        const toolCallRegex = /```tool-call\s+([\s\S]*?)```/g;
        let match;
        let lastIndex = 0;

        while ((match = toolCallRegex.exec(fullText)) !== null) {
            try {
                const block = match[1];
                const toolCall = this.parseToolBlock(block);

                if (toolCall) {
                    const taskId = `tool-${++this.taskCounter}`;
                    const task: StreamingTask = {
                        id: taskId,
                        type: 'tool',
                        status: 'detected',
                        name: toolCall.name,
                        data: toolCall.params,
                    };

                    this.tasks.set(taskId, task);
                    detectedItems.push(task);
                    logger.info(`Detected complete tool call: ${toolCall.name}`);
                }

                lastIndex = match.index + match[0].length;
            } catch (error) {
                logger.warn('Failed to parse tool call during streaming:', error);
            }
        }

        // Detect complete artifacts (code blocks with file paths)
        const artifacts = artifactParser.parseArtifacts(fullText);
        for (const artifact of artifacts) {
            // Only process complete artifacts (closed code blocks)
            if (!artifact.complete) {
                logger.debug(`Skipping incomplete artifact: ${artifact.filePath}`);
                continue;
            }

            // Check if we've already detected this exact artifact using contentHash
            const existingArtifact = Array.from(this.tasks.values()).find(
                t => t.type === 'artifact' && t.data.contentHash === artifact.contentHash
            );

            if (!existingArtifact) {
                const taskId = `artifact-${++this.taskCounter}`;
                const task: StreamingTask = {
                    id: taskId,
                    type: 'artifact',
                    status: 'detected',
                    name: `Write ${artifact.filePath}`,
                    data: artifact,
                };

                this.tasks.set(taskId, task);
                detectedItems.push(task);
                logger.info(`Detected complete artifact: ${artifact.filePath} (${artifact.content.length} chars)`);
            } else {
                logger.debug(`Artifact already detected: ${artifact.filePath}`);
            }
        }

        // Return remaining buffer (text after last complete match)
        const remainingBuffer = lastIndex > 0 ? fullText.substring(lastIndex) : fullText;

        return { detectedItems, updatedBuffer: remainingBuffer };
    }

    /**
     * Parse a tool-call block into structured data
     */
    private parseToolBlock(block: string): { name: string; params: Record<string, any> } | null {
        const lines = block.split('\n').filter(line => line.trim());

        let toolName = '';
        const params: Record<string, any> = {};
        let inParams = false;
        let currentKey = '';
        let currentValue = '';

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('Tool:')) {
                toolName = trimmedLine.replace('Tool:', '').trim();
            } else if (trimmedLine.startsWith('Parameters:')) {
                inParams = true;
            } else if (inParams && trimmedLine) {
                const colonIndex = trimmedLine.indexOf(':');

                if (colonIndex > 0 && colonIndex < trimmedLine.length - 1) {
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

        if (toolName && Object.keys(params).length > 0) {
            return { name: toolName, params };
        }

        return null;
    }

    private parseValue(value: string): any {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    /**
     * Queue task for execution (will be executed in order)
     */
    queueTask(task: StreamingTask): void {
        if (task.status !== 'detected') return;

        this.taskQueue.push(task);
        console.log(chalk.blue(`\n📋 Queued: ${task.type === 'tool' ? '🔧' : '📄'} ${task.name} (position ${this.taskQueue.length})`));
        this.notifyStatusUpdate();

        // Start processing queue if not already running
        if (!this.isExecuting && !this.executionPromise) {
            this.executionPromise = this.processQueue().then(() => {
                this.executionPromise = null;
            });
        }
    }

    /**
     * Execute task internally (called by queue processor)
     */
    private async executeTaskInternal(task: StreamingTask): Promise<void> {
        if (task.status !== 'detected') return;

        task.status = 'executing';
        task.startTime = Date.now();
        this.notifyStatusUpdate();

        console.log(chalk.cyan(`\n⚡ Executing: ${task.type === 'tool' ? '🔧' : '📄'} ${task.name}`));

        try {
            if (task.type === 'tool') {
                await this.executeTool(task);
            } else if (task.type === 'artifact') {
                await this.executeArtifact(task);
            }
        } catch (error) {
            task.status = 'failed';
            task.error = error instanceof Error ? error.message : String(error);
            task.endTime = Date.now();
            console.log(renderer.renderError(`Failed to execute ${task.name}: ${task.error}`));
            this.notifyStatusUpdate();
        }
    }

    private async executeTool(task: StreamingTask): Promise<void> {
        // Trigger tool_call hook
        const callHook = await hookManager.trigger({
            event: 'tool_call',
            toolName: task.name,
            toolParams: task.data,
        });

        if (callHook.blocked) {
            task.status = 'failed';
            task.error = 'Blocked by hook';
            task.endTime = Date.now();
            console.log(renderer.renderWarning(`Tool ${task.name} blocked by hook`));
            this.notifyStatusUpdate();
            return;
        }

        // Check if tool requires approval (skip if boss mode is enabled)
        if (!this.bossMode && this.approvalManager && this.approvalManager.requiresApproval(task.name)) {
            const approvalResult = await this.approvalManager.promptForApproval({
                toolName: task.name,
                params: task.data,
            });

            if (!approvalResult.approved) {
                task.status = 'failed';
                task.error = 'User declined execution';
                task.endTime = Date.now();
                console.log(chalk.yellow(`Execution of ${task.name} declined by user`));
                this.notifyStatusUpdate();
                return;
            }
        }

        // Execute the tool
        const result = await toolRegistry.executeTool(task.name, task.data);

        if (result.success) {
            task.status = 'completed';
            task.result = result;
            task.endTime = Date.now();

            await hookManager.trigger({
                event: 'tool_success',
                toolName: task.name,
                toolParams: task.data,
                toolResult: result,
            });

            const duration = task.endTime - (task.startTime || 0);
            console.log(renderer.renderToolResult(task.name, true, result.output, undefined, result.data));
            console.log(chalk.gray(`  ⏱️  Completed in ${duration}ms\n`));
        } else {
            task.status = 'failed';
            task.error = result.error;
            task.endTime = Date.now();

            await hookManager.trigger({
                event: 'tool_error',
                toolName: task.name,
                toolParams: task.data,
                error: result.error,
            });

            console.log(renderer.renderToolResult(task.name, false, undefined, result.error));
        }

        this.notifyStatusUpdate();
    }

    private async executeArtifact(task: StreamingTask): Promise<void> {
        const artifact = task.data;

        try {
            const result = await artifactParser.writeArtifacts([artifact]);

            if (result.written > 0) {
                task.status = 'completed';
                task.result = result;
                task.endTime = Date.now();

                const duration = task.endTime - (task.startTime || 0);
                console.log(chalk.green(`✓ File written: ${chalk.cyan(artifact.filePath)} (${artifact.content.split('\n').length} lines)`));
                console.log(chalk.gray(`  ⏱️  Completed in ${duration}ms\n`));
            } else {
                task.status = 'failed';
                task.error = result.errors[0] || 'Unknown error';
                task.endTime = Date.now();
                console.log(renderer.renderError(`Failed to write ${artifact.filePath}: ${task.error}`));
            }
        } catch (error) {
            task.status = 'failed';
            task.error = error instanceof Error ? error.message : String(error);
            task.endTime = Date.now();
            console.log(renderer.renderError(`Failed to write ${artifact.filePath}: ${task.error}`));
        }

        this.notifyStatusUpdate();
    }

    /**
     * Wait for all queued tasks to complete
     */
    async waitForAll(): Promise<void> {
        const totalTasks = this.tasks.size;

        if (totalTasks > 0) {
            console.log(chalk.cyan(`\n⏳ Waiting for ${this.taskQueue.length} queued task(s) to complete...\n`));

            // Wait for current execution to finish
            if (this.executionPromise) {
                await this.executionPromise;
            }

            console.log(chalk.green('✓ All queued tasks completed\n'));
        }
    }

    /**
     * Get current queue status
     */
    getQueueStatus(): { queued: number; executing: number; completed: number; failed: number } {
        const tasks = Array.from(this.tasks.values());
        return {
            queued: this.taskQueue.length,
            executing: tasks.filter(t => t.status === 'executing').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
        };
    }

    /**
     * Get execution summary
     */
    getSummary(): { total: number; completed: number; failed: number; executing: number } {
        const tasks = Array.from(this.tasks.values());
        return {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            executing: tasks.filter(t => t.status === 'executing').length,
        };
    }

    /**
     * Get all tasks
     */
    getTasks(): StreamingTask[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Clear all tasks and reset state
     */
    reset(): void {
        this.tasks.clear();
        this.taskQueue = [];
        this.isExecuting = false;
        this.executionPromise = null;
        this.taskCounter = 0;
    }

    private notifyStatusUpdate(): void {
        if (this.statusUpdateCallback) {
            this.statusUpdateCallback(this.getTasks());
        }
    }

    /**
     * Display live status of all tasks
     */
    displayStatus(): void {
        const tasks = this.getTasks();
        if (tasks.length === 0) return;

        console.log(chalk.cyan('\n📊 Sequential Execution Status:'));
        console.log(chalk.gray('─'.repeat(60)));

        for (const task of tasks) {
            const icon = task.status === 'completed' ? chalk.green('✓') :
                        task.status === 'failed' ? chalk.red('✗') :
                        task.status === 'executing' ? chalk.yellow('⚡') :
                        chalk.blue('📋');

            const statusText = task.status === 'completed' ? chalk.green(task.status) :
                              task.status === 'failed' ? chalk.red(task.status) :
                              task.status === 'executing' ? chalk.yellow(task.status) :
                              chalk.blue('queued');

            console.log(`${icon} ${chalk.cyan(task.name)} - ${statusText}`);

            if (task.error) {
                console.log(chalk.red(`  └─ Error: ${task.error}`));
            }

            if (task.endTime && task.startTime) {
                const duration = task.endTime - task.startTime;
                console.log(chalk.gray(`  └─ Duration: ${duration}ms`));
            }
        }

        console.log(chalk.gray('─'.repeat(60)));
        const queueStatus = this.getQueueStatus();
        console.log(chalk.blue(`Queued: ${queueStatus.queued} | `) +
                   chalk.yellow(`Executing: ${queueStatus.executing} | `) +
                   chalk.green(`Completed: ${queueStatus.completed} | `) +
                   chalk.red(`Failed: ${queueStatus.failed}\n`));
    }
}
