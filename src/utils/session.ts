import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';
import { AIMessage } from '../providers/types';

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: AIMessage[];
  metadata: {
    provider?: string;
    model?: string;
    messageCount: number;
  };
}

export class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(os.homedir(), '.g-coder', 'sessions');
    this.ensureSessionsDir();
  }

  private ensureSessionsDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
      logger.info(`Created sessions directory: ${this.sessionsDir}`);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session file path
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Save a session
   */
  saveSession(name: string, messages: AIMessage[], provider?: string, model?: string): Session {
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();

    const session: Session = {
      id: sessionId,
      name,
      createdAt: now,
      updatedAt: now,
      messages,
      metadata: {
        provider,
        model,
        messageCount: messages.length,
      },
    };

    const sessionPath = this.getSessionPath(sessionId);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');

    logger.info(`Saved session: ${name} (${sessionId})`);
    return session;
  }

  /**
   * Update an existing session
   */
  updateSession(sessionId: string, messages: AIMessage[]): Session | null {
    const sessionPath = this.getSessionPath(sessionId);

    if (!fs.existsSync(sessionPath)) {
      logger.warn(`Session not found: ${sessionId}`);
      return null;
    }

    try {
      const session: Session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      session.messages = messages;
      session.updatedAt = new Date().toISOString();
      session.metadata.messageCount = messages.length;

      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
      logger.info(`Updated session: ${session.name} (${sessionId})`);

      return session;
    } catch (error) {
      logger.error(`Failed to update session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Load a session by ID or name
   */
  loadSession(identifier: string): Session | null {
    // Try loading by ID first
    let sessionPath = this.getSessionPath(identifier);

    if (!fs.existsSync(sessionPath)) {
      // Try finding by name
      const sessions = this.listSessions();
      const session = sessions.find(s => s.name.toLowerCase() === identifier.toLowerCase());

      if (session) {
        sessionPath = this.getSessionPath(session.id);
      } else {
        logger.warn(`Session not found: ${identifier}`);
        return null;
      }
    }

    try {
      const session: Session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      logger.info(`Loaded session: ${session.name} (${session.id})`);
      return session;
    } catch (error) {
      logger.error(`Failed to load session ${identifier}:`, error);
      return null;
    }
  }

  /**
   * List all sessions
   */
  listSessions(): Session[] {
    const sessions: Session[] = [];

    try {
      const files = fs.readdirSync(this.sessionsDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const sessionPath = path.join(this.sessionsDir, file);
            const session: Session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
            sessions.push(session);
          } catch (error) {
            logger.warn(`Failed to read session file ${file}:`, error);
          }
        }
      }

      // Sort by updatedAt descending
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      logger.error('Failed to list sessions:', error);
    }

    return sessions;
  }

  /**
   * Delete a session
   */
  deleteSession(identifier: string): boolean {
    const session = this.loadSession(identifier);

    if (!session) {
      return false;
    }

    try {
      const sessionPath = this.getSessionPath(session.id);
      fs.unlinkSync(sessionPath);
      logger.info(`Deleted session: ${session.name} (${session.id})`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete session ${identifier}:`, error);
      return false;
    }
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): number {
    const sessions = this.listSessions();
    let deleted = 0;

    for (const session of sessions) {
      if (this.deleteSession(session.id)) {
        deleted++;
      }
    }

    logger.info(`Cleared ${deleted} session(s)`);
    return deleted;
  }

  /**
   * Get sessions directory path
   */
  getSessionsDir(): string {
    return this.sessionsDir;
  }
}

export const sessionManager = new SessionManager();
