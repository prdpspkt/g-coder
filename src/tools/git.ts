import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export class GitCommitTool implements Tool {
  definition: ToolDefinition = {
    name: 'GitCommit',
    description: 'Create a git commit with the staged changes. Analyzes changes and creates a descriptive commit message.',
    parameters: [
      {
        name: 'message',
        type: 'string',
        description: 'Commit message (will be auto-generated if not provided)',
        required: false,
      },
      {
        name: 'add_all',
        type: 'boolean',
        description: 'Stage all changes before committing (git add .)',
        required: false,
        default: false,
      },
      {
        name: 'files',
        type: 'array',
        description: 'Specific files to stage (if add_all is false)',
        required: false,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { message, add_all = false, files = [] } = params;

    try {
      // Check if we're in a git repo
      try {
        await execAsync('git rev-parse --git-dir');
      } catch {
        return {
          success: false,
          error: 'Not a git repository. Initialize with: git init',
        };
      }

      // Get current status
      const { stdout: statusOut } = await execAsync('git status --porcelain');

      if (!statusOut && !add_all && files.length === 0) {
        return {
          success: false,
          error: 'No changes to commit. Working tree is clean.',
        };
      }

      // Stage files
      if (add_all) {
        await execAsync('git add .');
        logger.info('Staged all changes');
      } else if (files.length > 0) {
        for (const file of files) {
          await execAsync(`git add "${file}"`);
        }
        logger.info(`Staged ${files.length} file(s)`);
      }

      // Get staged changes
      const { stdout: diffOut } = await execAsync('git diff --cached --stat');

      if (!diffOut) {
        return {
          success: false,
          error: 'No staged changes to commit. Use add_all: true or specify files.',
        };
      }

      // Generate commit message if not provided
      let commitMessage = message;
      if (!commitMessage) {
        const { stdout: diffSummary } = await execAsync('git diff --cached --shortstat');
        commitMessage = `Update files\n\n${diffSummary.trim()}\n\n🤖 Generated with G-Coder\n\nCo-Authored-By: G-Coder <noreply@g-coder.dev>`;
      } else {
        // Add co-author footer
        commitMessage += '\n\n🤖 Generated with G-Coder\n\nCo-Authored-By: G-Coder <noreply@g-coder.dev>';
      }

      // Create commit using heredoc-style message
      const escapedMessage = commitMessage.replace(/'/g, "'\\''");
      await execAsync(`git commit -m '${escapedMessage}'`);

      // Get commit hash
      const { stdout: commitHash } = await execAsync('git rev-parse --short HEAD');

      // Get commit info
      const { stdout: commitInfo } = await execAsync('git log -1 --oneline');

      logger.tool('GitCommit', `Created commit: ${commitHash.trim()}`);

      return {
        success: true,
        output: `✓ Created commit: ${commitInfo.trim()}\n\nChanges:\n${diffOut}`,
        data: {
          commitHash: commitHash.trim(),
          message: message || 'Auto-generated',
          filesChanged: diffOut.split('\n').length - 1,
        },
      };
    } catch (error: any) {
      // Check if it's a pre-commit hook failure
      if (error.message.includes('hook')) {
        return {
          success: false,
          error: `Pre-commit hook failed: ${error.message}`,
          output: error.stdout || error.stderr,
        };
      }

      return {
        success: false,
        error: `Git commit failed: ${error.message}`,
        output: error.stdout || error.stderr,
      };
    }
  }
}

export class GitPushTool implements Tool {
  definition: ToolDefinition = {
    name: 'GitPush',
    description: 'Push commits to remote repository. NEVER force push to main/master without explicit user request.',
    parameters: [
      {
        name: 'remote',
        type: 'string',
        description: 'Remote name (default: origin)',
        required: false,
        default: 'origin',
      },
      {
        name: 'branch',
        type: 'string',
        description: 'Branch name (uses current branch if not specified)',
        required: false,
      },
      {
        name: 'set_upstream',
        type: 'boolean',
        description: 'Set upstream branch (git push -u)',
        required: false,
        default: false,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { remote = 'origin', branch, set_upstream = false } = params;

    try {
      // Get current branch if not specified
      let targetBranch = branch;
      if (!targetBranch) {
        const { stdout } = await execAsync('git branch --show-current');
        targetBranch = stdout.trim();
      }

      // Safety check: warn about main/master
      if (['main', 'master'].includes(targetBranch)) {
        logger.warn(`Pushing to ${targetBranch} branch`);
      }

      // Build push command
      let pushCmd = `git push ${remote} ${targetBranch}`;
      if (set_upstream) {
        pushCmd = `git push -u ${remote} ${targetBranch}`;
      }

      // Execute push
      const { stdout, stderr } = await execAsync(pushCmd);
      const output = stdout + (stderr ? `\n${stderr}` : '');

      logger.tool('GitPush', `Pushed to ${remote}/${targetBranch}`);

      return {
        success: true,
        output: `✓ Pushed to ${remote}/${targetBranch}\n\n${output}`,
        data: {
          remote,
          branch: targetBranch,
          setUpstream: set_upstream,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Git push failed: ${error.message}`,
        output: error.stdout || error.stderr,
      };
    }
  }
}

export class GitStatusTool implements Tool {
  definition: ToolDefinition = {
    name: 'GitStatus',
    description: 'Show git repository status including staged, unstaged, and untracked files',
    parameters: [],
  };

  async execute(): Promise<ToolResult> {
    try {
      const { stdout: status } = await execAsync('git status');
      const { stdout: branch } = await execAsync('git branch --show-current');
      const { stdout: remoteStat } = await execAsync('git status -sb').catch(() => ({ stdout: '' }));

      logger.tool('GitStatus', 'Retrieved git status');

      return {
        success: true,
        output: status,
        data: {
          branch: branch.trim(),
          status: remoteStat.trim(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Git status failed: ${error.message}`,
      };
    }
  }
}

export class GitDiffTool implements Tool {
  definition: ToolDefinition = {
    name: 'GitDiff',
    description: 'Show git diff of changes (staged or unstaged)',
    parameters: [
      {
        name: 'staged',
        type: 'boolean',
        description: 'Show staged changes (git diff --cached)',
        required: false,
        default: false,
      },
      {
        name: 'file',
        type: 'string',
        description: 'Show diff for specific file only',
        required: false,
      },
    ],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { staged = false, file } = params;

    try {
      let cmd = 'git diff';
      if (staged) {
        cmd += ' --cached';
      }
      if (file) {
        cmd += ` "${file}"`;
      }

      const { stdout } = await execAsync(cmd);

      if (!stdout) {
        return {
          success: true,
          output: staged ? 'No staged changes' : 'No unstaged changes',
          data: { hasChanges: false },
        };
      }

      logger.tool('GitDiff', `Retrieved ${staged ? 'staged' : 'unstaged'} diff`);

      return {
        success: true,
        output: stdout,
        data: {
          staged,
          file: file || null,
          hasChanges: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Git diff failed: ${error.message}`,
      };
    }
  }
}
