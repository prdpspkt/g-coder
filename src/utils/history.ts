import * as fs from 'fs';
import * as path from 'path';
import { AIMessage } from '../providers/types';
import { logger } from './logger';

interface ConversationEntry {
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ProjectContext {
  projectPath: string;
  lastAccessed: number;
  conversationHistory: ConversationEntry[];
}

export class ConversationHistoryManager {
  private projectDir: string;
  private historyDir: string;
  private historyFile: string;
  private context: ProjectContext;
  private maxHistoryEntries: number = 50; // Keep last 50 interactions
  private maxContextAge: number = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(projectPath: string = process.cwd()) {
    this.projectDir = projectPath;
    this.historyDir = path.join(projectPath, '.g-coder');
    this.historyFile = path.join(this.historyDir, 'conversation-history.json');

    this.context = {
      projectPath,
      lastAccessed: Date.now(),
      conversationHistory: [],
    };

    this.ensureHistoryDir();
    this.loadHistory();
  }

  private ensureHistoryDir(): void {
    try {
      if (!fs.existsSync(this.historyDir)) {
        fs.mkdirSync(this.historyDir, { recursive: true });
        logger.debug(`Created .g-coder directory at: ${this.historyDir}`);
      }
    } catch (error) {
      logger.error('Failed to create .g-coder directory:', error);
    }
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        const loaded: ProjectContext = JSON.parse(data);

        // Only load history if it's recent (within maxContextAge)
        const age = Date.now() - loaded.lastAccessed;
        if (age < this.maxContextAge) {
          this.context = loaded;
          this.context.lastAccessed = Date.now();
          logger.debug(`Loaded ${this.context.conversationHistory.length} historical messages`);
        } else {
          logger.debug('History too old, starting fresh');
          this.clearHistory();
        }
      }
    } catch (error) {
      logger.error('Failed to load conversation history:', error);
      this.context.conversationHistory = [];
    }
  }

  private saveHistory(): void {
    try {
      this.context.lastAccessed = Date.now();

      // Trim history if it exceeds max entries
      if (this.context.conversationHistory.length > this.maxHistoryEntries) {
        // Keep system messages and recent interactions
        const systemMessages = this.context.conversationHistory.filter(e => e.role === 'system');
        const recentMessages = this.context.conversationHistory
          .filter(e => e.role !== 'system')
          .slice(-this.maxHistoryEntries);

        this.context.conversationHistory = [...systemMessages, ...recentMessages];
      }

      fs.writeFileSync(
        this.historyFile,
        JSON.stringify(this.context, null, 2),
        'utf8'
      );
      logger.debug('Conversation history saved');
    } catch (error) {
      logger.error('Failed to save conversation history:', error);
    }
  }

  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    // Skip empty messages
    if (!content || content.trim().length === 0) {
      return;
    }

    // Skip duplicate consecutive messages
    const lastMessage = this.context.conversationHistory[this.context.conversationHistory.length - 1];
    if (lastMessage && lastMessage.role === role && lastMessage.content === content) {
      return;
    }

    this.context.conversationHistory.push({
      timestamp: Date.now(),
      role,
      content,
    });

    this.saveHistory();
  }

  getRecentHistory(count: number = 10): AIMessage[] {
    // Get recent non-system messages for context
    const recentMessages = this.context.conversationHistory
      .filter(e => e.role !== 'system')
      .slice(-count)
      .map(entry => ({
        role: entry.role,
        content: entry.content,
      }));

    return recentMessages;
  }

  getContextSummary(): string {
    if (this.context.conversationHistory.length === 0) {
      return '';
    }

    const totalMessages = this.context.conversationHistory.length;
    const userMessages = this.context.conversationHistory.filter(e => e.role === 'user');
    const recentTopics = userMessages
      .slice(-5)
      .map(e => {
        // Extract first meaningful line or sentence
        const firstLine = e.content.split('\n')[0].substring(0, 100);
        return firstLine;
      });

    const lastAccessed = new Date(this.context.lastAccessed);
    const summary = [
      `Previous session: ${lastAccessed.toLocaleString()}`,
      `Total interactions: ${totalMessages} messages`,
      recentTopics.length > 0 ? `Recent topics: ${recentTopics.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    return summary;
  }

  getAllHistory(): ConversationEntry[] {
    return this.context.conversationHistory;
  }

  clearHistory(): void {
    this.context.conversationHistory = [];
    this.saveHistory();
    logger.debug('Conversation history cleared');
  }

  hasHistory(): boolean {
    return this.context.conversationHistory.length > 0;
  }

  getHistoryFilePath(): string {
    return this.historyFile;
  }
}
