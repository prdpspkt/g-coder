import inquirer from 'inquirer';
import chalk from 'chalk';
import { getPlatformInfo, PlatformDetector, PlatformInfo } from './platform';

export interface ApprovalConfig {
  enabled: boolean;
  toolsRequiringApproval: {
    [toolName: string]: boolean;
  };
  autoApprovePatterns?: string[];
}

export interface ApprovalRequest {
  toolName: string;
  params: Record<string, any>;
  description?: string;
}

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
}

export class ApprovalManager {
  private config: ApprovalConfig;
  private approvalHistory: Array<{
    toolName: string;
    approved: boolean;
    timestamp: Date;
  }> = [];
  private platformInfo: PlatformInfo;

  constructor(config: ApprovalConfig) {
    this.config = config;
    this.platformInfo = getPlatformInfo();
  }

  /**
   * Update the approval configuration
   */
  updateConfig(config: Partial<ApprovalConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the current approval configuration
   */
  getConfig(): ApprovalConfig {
    return { ...this.config };
  }

  /**
   * Check if a tool requires approval
   */
  requiresApproval(toolName: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    return this.config.toolsRequiringApproval[toolName] === true;
  }

  /**
   * Check if parameters match auto-approve patterns
   */
  private matchesAutoApprovePattern(params: Record<string, any>): boolean {
    if (!this.config.autoApprovePatterns || this.config.autoApprovePatterns.length === 0) {
      return false;
    }

    const paramsString = JSON.stringify(params).toLowerCase();
    return this.config.autoApprovePatterns.some(pattern =>
      paramsString.includes(pattern.toLowerCase())
    );
  }

  /**
   * Format parameters for display
   */
  private formatParams(params: Record<string, any>): string {
    const formatted: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      let displayValue: string;
      if (typeof value === 'string') {
        // Truncate long strings
        if (value.length > 200) {
          displayValue = value.substring(0, 200) + chalk.dim('...');
        } else {
          displayValue = value;
        }
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value, null, 2);
      } else {
        displayValue = String(value);
      }

      formatted.push(`  ${chalk.cyan(key)}: ${displayValue}`);
    }

    return formatted.join('\n');
  }

  /**
   * Assess risk level based on tool and parameters (OS-aware)
   */
  private assessRisk(toolName: string, params: Record<string, any>): { level: 'low' | 'medium' | 'high' | 'critical'; warnings: string[] } {
    const warnings: string[] = [];
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for dangerous patterns in Bash commands (OS-specific)
    if (toolName === 'Bash') {
      const command = params.command || '';

      // Use platform-specific dangerous pattern detection
      if (PlatformDetector.isDangerousCommand(command, this.platformInfo)) {
        // Determine specific warnings and level based on platform patterns
        for (const pattern of this.platformInfo.dangerousPatterns) {
          if (pattern.test(command)) {
            const warning = this.getWarningForPattern(pattern, command);
            if (warning) {
              warnings.push(warning.message);
              if (warning.level === 'critical' || (warning.level === 'high' && level !== 'critical')) {
                level = warning.level;
              } else if (warning.level === 'medium' && level === 'low') {
                level = 'medium';
              }
            }
          }
        }

        // If dangerous but no specific pattern matched, mark as high
        if (warnings.length === 0) {
          warnings.push('Potentially dangerous command detected');
          level = 'high';
        }
      }

      // Long commands get medium risk
      if (warnings.length === 0 && command.length > 150) {
        level = 'medium';
      }
    }

    // Check for sensitive files in Write/Edit (OS-specific)
    if (toolName === 'Write' || toolName === 'Edit') {
      const filePath = params.file_path || params.path || '';

      // Use platform-specific sensitive file detection
      if (PlatformDetector.isSensitiveFile(filePath, this.platformInfo)) {
        warnings.push('Sensitive file detected');
        level = 'high';

        // Check for specific critical files
        const criticalPatterns = this.platformInfo.isWindows
          ? [/SAM$/i, /SYSTEM$/i, /ntuser\.dat/i, /HKEY_/i]
          : [/\/etc\/passwd$/i, /\/etc\/shadow$/i, /\/etc\/sudoers/i, /\/root\//i];

        for (const pattern of criticalPatterns) {
          if (pattern.test(filePath)) {
            warnings.push('Critical system file');
            level = 'critical';
            break;
          }
        }
      }

      // Check if writing to system directory
      if (PlatformDetector.isSystemDir(filePath, this.platformInfo)) {
        warnings.push('System directory modification');
        if (level !== 'critical') {
          level = 'high';
        }
      }

      // Check content for dangerous patterns (platform-aware)
      const content = params.content || params.new_string || '';
      if (typeof content === 'string') {
        // Check for dangerous commands in content
        for (const cmd of this.platformInfo.dangerousCommands) {
          if (content.toLowerCase().includes(cmd.toLowerCase())) {
            warnings.push(`Content contains dangerous command: ${cmd}`);
            level = level === 'low' ? 'medium' : level;
            break;
          }
        }

        // Check for script injection
        if (/<script>/i.test(content) || /<iframe>/i.test(content)) {
          warnings.push('Content contains potential XSS vectors');
          level = level === 'low' ? 'medium' : level;
        }
      }
    }

    // Git operations
    if (toolName === 'GitPush') {
      const branch = params.branch || 'main';
      const force = params.force || false;
      if ((branch === 'main' || branch === 'master') && force) {
        warnings.push('Force pushing to main/master branch');
        level = 'critical';
      } else if (force) {
        warnings.push('Force push');
        level = 'high';
      }
    }

    if (toolName === 'GitCommit' && params.add_all) {
      warnings.push('Staging all changes');
      level = level === 'low' ? 'medium' : level;
    }

    return { level, warnings };
  }

  /**
   * Get warning details for a specific pattern match
   */
  private getWarningForPattern(pattern: RegExp, command: string): { message: string; level: 'low' | 'medium' | 'high' | 'critical' } | null {
    const patternStr = pattern.source.toLowerCase();

    // Critical patterns
    if (patternStr.includes('rm.*-rf.*\\/') || patternStr.includes('format') || patternStr.includes('mkfs') ||
        patternStr.includes('dev\\/sd') || patternStr.includes('diskpart') || patternStr.includes('dd.*if=')) {
      return { message: 'Critical destructive operation', level: 'critical' };
    }

    // High risk patterns
    if (patternStr.includes('rm.*-rf') || patternStr.includes('del.*\\/s') || patternStr.includes('rmdir.*\\/s') ||
        patternStr.includes('sudo') || patternStr.includes('reg.*delete') || patternStr.includes('kill.*-9') ||
        patternStr.includes('shutdown') || patternStr.includes('taskkill.*\\/f')) {
      return { message: 'High-risk destructive operation', level: 'high' };
    }

    // Medium risk patterns
    if (patternStr.includes('chmod.*777') || patternStr.includes('eval') || patternStr.includes('exec') ||
        patternStr.includes('curl.*\\|') || patternStr.includes('wget.*\\|') || patternStr.includes('iex')) {
      return { message: 'Potentially unsafe operation', level: 'medium' };
    }

    return null;
  }

  /**
   * Prompt user for approval
   */
  async promptForApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    // Check if approval is required
    if (!this.requiresApproval(request.toolName)) {
      return { approved: true };
    }

    // Check auto-approve patterns
    if (this.matchesAutoApprovePattern(request.params)) {
      return { approved: true, reason: 'Auto-approved by pattern' };
    }

    // Assess risk
    const risk = this.assessRisk(request.toolName, request.params);

    // Display approval prompt
    console.log('\n' + chalk.bold.yellow('⚠ Tool Execution Approval Required'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.bold('Tool:'), chalk.cyan(request.toolName));

    if (request.description) {
      console.log(chalk.bold('Description:'), request.description);
    }

    // Show risk level
    const riskColors = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.bold.red,
    };
    console.log(chalk.bold('Risk Level:'), riskColors[risk.level](risk.level.toUpperCase()));

    if (risk.warnings.length > 0) {
      console.log(chalk.bold('Warnings:'));
      risk.warnings.forEach(warning => {
        console.log(chalk.red('  ⚠ ' + warning));
      });
    }

    console.log(chalk.bold('\nParameters:'));
    console.log(this.formatParams(request.params));
    console.log(chalk.dim('─'.repeat(60)));

    // Prompt for approval
    const { approval } = await inquirer.prompt([
      {
        type: 'list',
        name: 'approval',
        message: 'Do you want to execute this tool?',
        choices: [
          { name: 'Yes, execute', value: 'yes' },
          { name: 'No, cancel', value: 'no' },
          { name: 'Yes, and auto-approve similar operations', value: 'auto' },
        ],
        default: risk.level === 'critical' ? 'no' : 'yes',
      },
    ]);

    const approved = approval === 'yes' || approval === 'auto';

    // Record in history
    this.approvalHistory.push({
      toolName: request.toolName,
      approved,
      timestamp: new Date(),
    });

    // Handle auto-approve
    if (approval === 'auto') {
      const signature = this.generateApprovalSignature(request.toolName, request.params);
      if (!this.config.autoApprovePatterns) {
        this.config.autoApprovePatterns = [];
      }
      this.config.autoApprovePatterns.push(signature);
      console.log(chalk.dim('  ℹ Future similar operations will be auto-approved'));
    }

    if (!approved) {
      console.log(chalk.yellow('  ✗ Tool execution cancelled by user\n'));
      return { approved: false, reason: 'User declined' };
    }

    console.log(chalk.green('  ✓ Tool execution approved\n'));
    return { approved: true };
  }

  /**
   * Generate a signature for auto-approval
   */
  private generateApprovalSignature(toolName: string, params: Record<string, any>): string {
    // Create a simplified signature for pattern matching
    if (toolName === 'Bash') {
      const command = params.command || '';
      // Extract the command name (first word)
      const cmdName = command.trim().split(/\s+/)[0];
      return cmdName;
    }

    return toolName.toLowerCase();
  }

  /**
   * Get approval statistics
   */
  getStatistics(): {
    total: number;
    approved: number;
    declined: number;
    byTool: Record<string, { approved: number; declined: number }>;
  } {
    const stats = {
      total: this.approvalHistory.length,
      approved: 0,
      declined: 0,
      byTool: {} as Record<string, { approved: number; declined: number }>,
    };

    for (const entry of this.approvalHistory) {
      if (entry.approved) {
        stats.approved++;
      } else {
        stats.declined++;
      }

      if (!stats.byTool[entry.toolName]) {
        stats.byTool[entry.toolName] = { approved: 0, declined: 0 };
      }

      if (entry.approved) {
        stats.byTool[entry.toolName].approved++;
      } else {
        stats.byTool[entry.toolName].declined++;
      }
    }

    return stats;
  }

  /**
   * Clear approval history
   */
  clearHistory(): void {
    this.approvalHistory = [];
  }

  /**
   * Reset auto-approve patterns
   */
  resetAutoApprove(): void {
    this.config.autoApprovePatterns = [];
  }

  /**
   * Get platform information
   */
  getPlatformInfo(): PlatformInfo {
    return this.platformInfo;
  }

  /**
   * Reload platform detection
   */
  reloadPlatform(): void {
    this.platformInfo = getPlatformInfo();
  }
}

/**
 * Create default approval configuration
 */
export function createDefaultApprovalConfig(): ApprovalConfig {
  return {
    enabled: false,
    toolsRequiringApproval: {
      Bash: true,
      Write: true,
      Edit: true,
      GitCommit: true,
      GitPush: true,
      WebFetch: false,
      Read: false,
      Glob: false,
      Grep: false,
      EditNotebook: true,
    },
    autoApprovePatterns: [],
  };
}
