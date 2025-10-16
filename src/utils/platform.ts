import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export type PlatformType = 'windows' | 'unix' | 'macos';

export interface PlatformInfo {
  type: PlatformType;
  isWindows: boolean;
  isUnix: boolean;
  isMacOS: boolean;
  shellType: 'cmd' | 'powershell' | 'bash' | 'zsh' | 'sh';
  dangerousCommands: string[];
  dangerousPatterns: RegExp[];
  sensitiveFiles: RegExp[];
  systemDirs: RegExp[];
}

export class PlatformDetector {
  private static instance: PlatformInfo | null = null;
  private static configPath: string = path.join(os.homedir(), '.g-coder', 'platform.json');

  /**
   * Detect the current platform and cache the result
   */
  static detect(): PlatformInfo {
    if (this.instance) {
      return this.instance;
    }

    // Try to load cached platform info
    const cached = this.loadCached();
    if (cached) {
      this.instance = cached;
      return cached;
    }

    // Detect platform
    const platform = os.platform();
    let type: PlatformType;
    let shellType: PlatformInfo['shellType'];

    if (platform === 'win32') {
      type = 'windows';
      // Check if PowerShell is available
      shellType = process.env.PSModulePath ? 'powershell' : 'cmd';
    } else if (platform === 'darwin') {
      type = 'macos';
      // macOS typically uses zsh or bash
      shellType = process.env.SHELL?.includes('zsh') ? 'zsh' : 'bash';
    } else {
      type = 'unix';
      // Linux/Unix - check shell
      const shell = process.env.SHELL || '/bin/bash';
      if (shell.includes('zsh')) {
        shellType = 'zsh';
      } else if (shell.includes('bash')) {
        shellType = 'bash';
      } else {
        shellType = 'sh';
      }
    }

    const info: PlatformInfo = {
      type,
      isWindows: type === 'windows',
      isUnix: type === 'unix',
      isMacOS: type === 'macos',
      shellType,
      dangerousCommands: this.getDangerousCommands(type),
      dangerousPatterns: this.getDangerousPatterns(type),
      sensitiveFiles: this.getSensitiveFiles(type),
      systemDirs: this.getSystemDirs(type),
    };

    this.instance = info;
    this.saveCached(info);

    return info;
  }

  /**
   * Get dangerous commands for the platform
   */
  private static getDangerousCommands(type: PlatformType): string[] {
    const common = ['eval', 'exec'];

    if (type === 'windows') {
      return [
        ...common,
        'del',
        'deltree',
        'rmdir',
        'format',
        'diskpart',
        'rd',
        'erase',
        'reg delete',
        'reg add',
        'shutdown',
        'restart',
        'taskkill',
        'netsh',
        'sc delete',
        'wmic',
        'powershell -encodedcommand',
        'cmd /c',
        'start /b',
      ];
    } else {
      // Unix/Linux/macOS
      return [
        ...common,
        'rm',
        'rmdir',
        'dd',
        'mkfs',
        'fdisk',
        'parted',
        'shred',
        'wipefs',
        'kill',
        'killall',
        'pkill',
        'shutdown',
        'reboot',
        'halt',
        'init',
        'systemctl',
        'service',
        'chown',
        'chmod',
        'chgrp',
        'sudo',
        'su',
        'doas',
      ];
    }
  }

  /**
   * Get dangerous command patterns for the platform
   */
  private static getDangerousPatterns(type: PlatformType): RegExp[] {
    const common = [
      /eval\s*\(/i,
      /exec\s*\(/i,
      /<script>/i,
      /`[^`]+`/,  // Backtick execution
      /\$\([^)]+\)/,  // Command substitution
    ];

    if (type === 'windows') {
      return [
        ...common,
        // Windows dangerous patterns
        /del\s+\/[sS]\s+\/[qQ]/i,  // del /s /q (recursive quiet delete)
        /rmdir\s+\/[sS]\s+\/[qQ]/i,  // rmdir /s /q
        /rd\s+\/[sS]\s+\/[qQ]/i,  // rd /s /q
        /format\s+[a-zA-Z]:/i,  // format C:
        /diskpart/i,  // Disk partitioning
        /reg\s+delete/i,  // Registry deletion
        /reg\s+add.*\/f/i,  // Force registry add
        /shutdown\s+\/[sS]/i,  // System shutdown
        /shutdown\s+\/[rR]/i,  // System restart
        /taskkill\s+\/[fF]/i,  // Force kill process
        /netsh.*delete/i,  // Network config deletion
        /sc\s+delete/i,  // Service deletion
        /wmic.*delete/i,  // WMI deletion
        /powershell.*-encodedcommand/i,  // Encoded PowerShell command
        /iex\s*\(/i,  // Invoke-Expression
        /invoke-expression/i,
        /\|\s*powershell/i,  // Piping to PowerShell
        /\|\s*cmd/i,  // Piping to cmd
        />\s*[a-zA-Z]:\\(?:Windows|System32|Program Files)/i,  // Writing to system dirs
      ];
    } else {
      // Unix/Linux/macOS
      return [
        ...common,
        // Unix dangerous patterns
        /rm\s+-rf\s+\//,  // rm -rf / (root deletion)
        /rm\s+-rf\s+\*/,  // rm -rf * (everything)
        /rm\s+-rf\s+~\//,  // rm -rf ~/ (home dir)
        /rm\s+-[a-zA-Z]*r[a-zA-Z]*f/,  // rm with -r and -f flags
        /dd\s+if=/i,  // Direct disk operations
        /dd\s+of=/i,
        /mkfs\./i,  // Filesystem creation
        /fdisk/i,  // Disk partitioning
        /parted/i,
        />\s*\/dev\/sd[a-z]/i,  // Writing to disk devices
        />\s*\/dev\/nvme/i,
        /curl.*\|\s*bash/i,  // Piping download to shell
        /curl.*\|\s*sh/i,
        /wget.*\|\s*bash/i,
        /wget.*\|\s*sh/i,
        /chmod\s+777/i,  // Open permissions
        /chmod\s+-R\s+777/i,
        /chown\s+-R/i,  // Recursive ownership change
        /kill\s+-9\s+-1/i,  // Kill all processes
        /killall\s+-9/i,  // Force kill all
        /:\(\)\{\s*:\|\:&\s*\};:/,  // Fork bomb
        /sudo\s+rm/i,  // Sudo with rm
        /sudo\s+dd/i,  // Sudo with dd
        /systemctl.*stop/i,  // Stopping services
        /systemctl.*disable/i,  // Disabling services
        /service.*stop/i,
        /init\s+0/i,  // System halt
        /init\s+6/i,  // System reboot
        /shutdown\s+-h/i,  // Shutdown
        /shutdown\s+-r/i,  // Reboot
        /reboot/i,
        /halt/i,
        />\s*\/etc\//i,  // Writing to /etc/
        />\s*\/boot\//i,  // Writing to /boot/
        />\s*\/sys\//i,  // Writing to /sys/
      ];
    }
  }

  /**
   * Get sensitive file patterns for the platform
   */
  private static getSensitiveFiles(type: PlatformType): RegExp[] {
    const common = [
      /\.env$/i,
      /\.env\./i,
      /password/i,
      /secret/i,
      /credential/i,
      /token/i,
      /api[_-]?key/i,
      /private[_-]?key/i,
      /\.pem$/i,
      /\.key$/i,
      /\.crt$/i,
      /\.p12$/i,
      /\.pfx$/i,
    ];

    if (type === 'windows') {
      return [
        ...common,
        /\\\.ssh\\/i,
        /\\\.aws\\/i,
        /\\\.azure\\/i,
        /\\AppData\\Roaming/i,
        /\\AppData\\Local/i,
        /HKEY_/i,  // Registry keys
        /\.reg$/i,
        /SAM$/i,
        /SYSTEM$/i,
        /\\Windows\\System32\\config\\/i,
        /\\boot\.ini$/i,
        /\\ntuser\.dat/i,
      ];
    } else {
      // Unix/Linux/macOS
      return [
        ...common,
        /\/\.ssh\//i,
        /\/\.aws\//i,
        /\/\.kube\//i,
        /\/\.docker\//i,
        /\/\.gnupg\//i,
        /\/\.config\/gcloud\//i,
        /\/etc\/passwd$/i,
        /\/etc\/shadow$/i,
        /\/etc\/sudoers/i,
        /\/etc\/ssh\/sshd_config$/i,
        /\/etc\/ssl\//i,
        /\/root\//i,
        /\/var\/log\/auth/i,
        /\/var\/log\/secure/i,
        /\.bash_history$/i,
        /\.zsh_history$/i,
      ];
    }
  }

  /**
   * Get system directory patterns for the platform
   */
  private static getSystemDirs(type: PlatformType): RegExp[] {
    if (type === 'windows') {
      return [
        /^[a-zA-Z]:\\Windows\\/i,
        /^[a-zA-Z]:\\Program Files/i,
        /^[a-zA-Z]:\\System32/i,
        /^[a-zA-Z]:\\Windows\\System32/i,
        /^[a-zA-Z]:\\ProgramData/i,
      ];
    } else {
      // Unix/Linux/macOS
      return [
        /^\/bin\//,
        /^\/sbin\//,
        /^\/usr\/bin\//,
        /^\/usr\/sbin\//,
        /^\/etc\//,
        /^\/boot\//,
        /^\/sys\//,
        /^\/proc\//,
        /^\/dev\//,
        /^\/root\//,
        /^\/var\/log\//,
        /^\/Library\//,  // macOS
        /^\/System\//,   // macOS
      ];
    }
  }

  /**
   * Load cached platform info
   */
  private static loadCached(): PlatformInfo | null {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);

        // Convert string patterns back to RegExp
        parsed.dangerousPatterns = parsed.dangerousPatterns.map((p: string) => new RegExp(p));
        parsed.sensitiveFiles = parsed.sensitiveFiles.map((p: string) => new RegExp(p));
        parsed.systemDirs = parsed.systemDirs.map((p: string) => new RegExp(p));

        return parsed;
      }
    } catch (error) {
      // Ignore errors, will detect fresh
    }
    return null;
  }

  /**
   * Save platform info to cache
   */
  private static saveCached(info: PlatformInfo): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert RegExp to strings for JSON serialization
      const toSave = {
        ...info,
        dangerousPatterns: info.dangerousPatterns.map(p => p.source),
        sensitiveFiles: info.sensitiveFiles.map(p => p.source),
        systemDirs: info.systemDirs.map(p => p.source),
      };

      fs.writeFileSync(this.configPath, JSON.stringify(toSave, null, 2));
    } catch (error) {
      // Ignore save errors
    }
  }

  /**
   * Force re-detection of platform
   */
  static redetect(): PlatformInfo {
    this.instance = null;
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
    } catch (error) {
      // Ignore
    }
    return this.detect();
  }

  /**
   * Get human-readable platform description
   */
  static getDescription(info: PlatformInfo): string {
    const shellName = info.shellType.toUpperCase();

    if (info.isWindows) {
      return `Windows (${shellName})`;
    } else if (info.isMacOS) {
      return `macOS (${shellName})`;
    } else {
      return `Linux/Unix (${shellName})`;
    }
  }

  /**
   * Check if a command is dangerous on this platform
   */
  static isDangerousCommand(command: string, info: PlatformInfo): boolean {
    const lowerCmd = command.toLowerCase().trim();

    // Check exact command matches
    if (info.dangerousCommands.some(cmd => lowerCmd.startsWith(cmd.toLowerCase()))) {
      return true;
    }

    // Check pattern matches
    return info.dangerousPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Check if a file path is sensitive on this platform
   */
  static isSensitiveFile(filePath: string, info: PlatformInfo): boolean {
    return info.sensitiveFiles.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if a path is in a system directory
   */
  static isSystemDir(filePath: string, info: PlatformInfo): boolean {
    return info.systemDirs.some(pattern => pattern.test(filePath));
  }
}

// Export singleton instance getter
export function getPlatformInfo(): PlatformInfo {
  return PlatformDetector.detect();
}

export function redetectPlatform(): PlatformInfo {
  return PlatformDetector.redetect();
}
