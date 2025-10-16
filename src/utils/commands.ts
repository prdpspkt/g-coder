import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface CustomCommand {
  name: string;
  prompt: string;
  description?: string;
}

export class CommandManager {
  private commandsDir: string;
  private commands: Map<string, CustomCommand> = new Map();

  constructor(baseDir: string = process.cwd()) {
    this.commandsDir = path.join(baseDir, '.g-coder', 'commands');
    this.loadCommands();
  }

  private loadCommands(): void {
    try {
      // Create commands directory if it doesn't exist
      if (!fs.existsSync(this.commandsDir)) {
        fs.mkdirSync(this.commandsDir, { recursive: true });
        this.createExampleCommands();
      }

      // Load all .md files from commands directory
      const files = fs.readdirSync(this.commandsDir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const commandName = path.basename(file, '.md');
        const filePath = path.join(this.commandsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Extract description from first line if it starts with #
        let description: string | undefined;
        let prompt = content;

        const lines = content.split('\n');
        if (lines[0].startsWith('# ')) {
          description = lines[0].substring(2).trim();
          prompt = lines.slice(1).join('\n').trim();
        }

        this.commands.set(commandName, {
          name: commandName,
          prompt,
          description,
        });

        logger.debug(`Loaded command: /${commandName}`);
      }

      if (this.commands.size > 0) {
        logger.info(`Loaded ${this.commands.size} custom command(s)`);
      }
    } catch (error) {
      logger.warn('Failed to load commands:', error);
    }
  }

  private createExampleCommands(): void {
    // Create example command files
    const examples = [
      {
        name: 'review',
        content: `# Review code for best practices and potential issues

Review the code in this project for:
- Code quality and best practices
- Potential bugs or errors
- Performance improvements
- Security vulnerabilities
- Documentation gaps

Provide specific suggestions with file:line references.`,
      },
      {
        name: 'test',
        content: `# Generate tests for the code

Create comprehensive unit tests for the code with:
- Test coverage for all major functions
- Edge cases and error handling
- Mock data where needed
- Clear test descriptions

Use the project's existing test framework.`,
      },
      {
        name: 'refactor',
        content: `# Suggest refactoring improvements

Analyze the code and suggest refactoring improvements:
- Code duplication removal
- Better naming conventions
- Simplified logic
- Design pattern applications
- Separation of concerns

Explain the benefits of each suggestion.`,
      },
    ];

    examples.forEach(({ name, content }) => {
      const filePath = path.join(this.commandsDir, `${name}.md`);
      fs.writeFileSync(filePath, content);
      logger.info(`Created example command: /${name}`);
    });
  }

  getCommand(name: string): CustomCommand | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): CustomCommand[] {
    return Array.from(this.commands.values());
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  reload(): void {
    this.commands.clear();
    this.loadCommands();
  }

  getCommandsDir(): string {
    return this.commandsDir;
  }
}

export const commandManager = new CommandManager();
