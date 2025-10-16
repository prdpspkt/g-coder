# Platform-Aware Approval System

The execution approval system now includes intelligent OS detection that adapts dangerous command patterns based on your operating system (Windows, Linux, macOS).

## Overview

On first run, G-Coder automatically detects your operating system and configures appropriate dangerous command patterns, sensitive file patterns, and system directory checks. This ensures accurate risk assessment regardless of which platform you're using.

## Supported Platforms

### Windows
- **Shell Types**: CMD, PowerShell
- **Dangerous Commands**: `del`, `format`, `diskpart`, `reg delete`, `shutdown`, `taskkill`, etc.
- **Sensitive Files**: Registry files, SAM, SYSTEM, `C:\Windows\`, `C:\Program Files\`
- **System Directories**: `C:\Windows\`, `C:\System32\`, `C:\ProgramData\`

### Linux/Unix
- **Shell Types**: bash, sh, zsh
- **Dangerous Commands**: `rm -rf`, `dd`, `mkfs`, `sudo`, `chmod 777`, `kill -9`, etc.
- **Sensitive Files**: `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`, `~/.ssh/`
- **System Directories**: `/etc/`, `/boot/`, `/sys/`, `/proc/`, `/dev/`

### macOS
- **Shell Types**: zsh, bash
- **Dangerous Commands**: Same as Linux/Unix plus macOS-specific patterns
- **Sensitive Files**: Linux patterns plus `/Library/`, `/System/`
- **System Directories**: Linux patterns plus macOS system folders

## Automatic Detection

Platform detection happens automatically when:

1. **First Run**: On initial startup, G-Coder detects your OS
2. **Cached**: Platform info is cached in `~/.g-coder/platform.json`
3. **Persistent**: Detection runs once and persists across sessions

### Detection Process

```
Start G-Coder
     ↓
Check for cached platform.json
     ↓
  [Cached?]
   /     \
 Yes      No
  ↓       ↓
Load   Detect OS
cache    ↓
  ↓    Save to
  ↓    platform.json
  ↓       ↓
  └───────┘
      ↓
Use platform-specific
 patterns for approval
```

## Platform-Specific Examples

### Windows Examples

#### Example 1: Deleting Files with `del`
```
User: "Delete all log files recursively"
AI: del /s /q *.log

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Bash
Platform: Windows (CMD)
Risk Level: HIGH
Warnings:
  ⚠ High-risk destructive operation

Parameters:
  command: del /s /q *.log
────────────────────────────────────────
```

The system recognizes `del /s /q` as a Windows-specific dangerous pattern.

#### Example 2: Registry Modification
```
User: "Delete a registry key"
AI: reg delete HKEY_CURRENT_USER\Software\Test /f

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Bash
Platform: Windows (POWERSHELL)
Risk Level: HIGH
Warnings:
  ⚠ High-risk destructive operation

Parameters:
  command: reg delete HKEY_CURRENT_USER\Software\Test /f
────────────────────────────────────────
```

Recognizes Windows registry operations.

#### Example 3: System File Modification
```
User: "Edit the boot.ini file"
AI: Write tool on C:\boot.ini

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Write
Platform: Windows (CMD)
Risk Level: CRITICAL
Warnings:
  ⚠ Sensitive file detected
  ⚠ Critical system file

Parameters:
  file_path: C:\boot.ini
  content: [boot loader]...
────────────────────────────────────────
```

### Linux/Unix Examples

#### Example 1: Recursive Delete with `rm -rf`
```
User: "Clean up the temp directory"
AI: rm -rf /tmp/*

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Bash
Platform: Linux/Unix (BASH)
Risk Level: HIGH
Warnings:
  ⚠ High-risk destructive operation

Parameters:
  command: rm -rf /tmp/*
────────────────────────────────────────
```

Recognizes `rm -rf` as a dangerous Unix pattern.

#### Example 2: Elevated Privileges
```
User: "Install a package system-wide"
AI: sudo apt install package

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Bash
Platform: Linux/Unix (BASH)
Risk Level: HIGH
Warnings:
  ⚠ High-risk destructive operation

Parameters:
  command: sudo apt install package
────────────────────────────────────────
```

Detects `sudo` usage.

#### Example 3: System Configuration File
```
User: "Update the sudoers file"
AI: Edit tool on /etc/sudoers

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Edit
Platform: Linux/Unix (BASH)
Risk Level: CRITICAL
Warnings:
  ⚠ Sensitive file detected
  ⚠ Critical system file

Parameters:
  file_path: /etc/sudoers
  old_string: ...
  new_string: ...
────────────────────────────────────────
```

### macOS Examples

#### Example 1: System Folder Modification
```
User: "Edit a file in /Library"
AI: Write tool on /Library/LaunchDaemons/custom.plist

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Write
Platform: macOS (ZSH)
Risk Level: HIGH
Warnings:
  ⚠ Sensitive file detected
  ⚠ System directory modification

Parameters:
  file_path: /Library/LaunchDaemons/custom.plist
  content: <?xml...>
────────────────────────────────────────
```

Recognizes macOS-specific `/Library/` as a system directory.

#### Example 2: Homebrew with `sudo`
```
User: "Install Homebrew package with sudo"
AI: sudo brew install package

⚠ Tool Execution Approval Required
────────────────────────────────────────
Tool: Bash
Platform: macOS (ZSH)
Risk Level: HIGH
Warnings:
  ⚠ High-risk destructive operation

Parameters:
  command: sudo brew install package
────────────────────────────────────────
```

## Platform Detection Details

### Detected Information

When you run `/approval`, you'll see:

```
═══════════════════════════════════════
  Execution Approval Settings
═══════════════════════════════════════
ℹ Status: enabled
ℹ Platform: Windows (CMD)
  Detected 35 dangerous patterns for your OS

Tools requiring approval:
  ✓ Bash
  ✓ Write
  ✓ Edit
  ✓ GitCommit
  ✓ GitPush
  ✓ EditNotebook
```

### Cached Platform File

Location: `~/.g-coder/platform.json`

Example content:
```json
{
  "type": "windows",
  "isWindows": true,
  "isUnix": false,
  "isMacOS": false,
  "shellType": "cmd",
  "dangerousCommands": ["del", "format", "diskpart", ...],
  "dangerousPatterns": ["del\\s+\\/[sS]\\s+\\/[qQ]", ...],
  "sensitiveFiles": ["\\\\Windows\\\\", "\\\\.ssh\\\\", ...],
  "systemDirs": ["^[a-zA-Z]:\\\\Windows\\\\", ...]
}
```

## Dangerous Patterns by Platform

### Windows Patterns (35+)

**Critical**:
- `format C:` - Format disk
- `diskpart` - Disk partitioning
- `del /s /q C:\` - Recursive delete from C:
- Writing to system registry

**High**:
- `del /s /q` - Recursive quiet delete
- `rmdir /s /q` - Recursive directory removal
- `reg delete` - Registry deletion
- `shutdown /s` or `/r` - System shutdown/restart
- `taskkill /f` - Force kill process

**Medium**:
- `netsh` commands - Network configuration
- PowerShell `-EncodedCommand` - Hidden commands
- `Invoke-Expression` (iex) - Dynamic execution

### Linux/Unix Patterns (40+)

**Critical**:
- `rm -rf /` - Delete root directory
- `dd if=/dev/zero of=/dev/sda` - Overwrite disk
- `mkfs.*` - Format filesystem
- `> /dev/sd*` - Write to disk device

**High**:
- `rm -rf` - Recursive force delete
- `sudo rm` - Elevated deletion
- `chmod -R 777` - Recursive open permissions
- `kill -9 -1` - Kill all processes
- `shutdown` / `reboot` / `halt` - System power

**Medium**:
- `curl ... | bash` - Pipe download to shell
- `eval()` - Dynamic evaluation
- `chmod 777` - Open permissions

### macOS Additional Patterns

All Linux/Unix patterns plus:
- `/Library/` modifications - System library folder
- `/System/` modifications - System folder
- macOS-specific LaunchDaemons/LaunchAgents

## Technical Architecture

### Platform Detector

**File**: `src/utils/platform.ts`

```typescript
export class PlatformDetector {
  static detect(): PlatformInfo
  static isDangerousCommand(command: string, info: PlatformInfo): boolean
  static isSensitiveFile(filePath: string, info: PlatformInfo): boolean
  static isSystemDir(filePath: string, info: PlatformInfo): boolean
  static redetect(): PlatformInfo // Force re-detection
}
```

### Integration Points

1. **ApprovalManager** (src/utils/approval.ts:35)
   - Initializes with platform info
   - Uses platform-specific patterns in `assessRisk()`

2. **CLI Display** (src/cli.ts:422)
   - Shows detected platform in `/approval` command
   - Displays pattern count

## Benefits

### 1. **Accurate Risk Assessment**
- Windows: Detects `del /s /q` as dangerous
- Linux: Detects `rm -rf` as dangerous
- No false positives from cross-platform confusion

### 2. **Cross-Platform Compatibility**
- Works seamlessly on Windows, Linux, macOS
- No manual configuration needed
- Automatically uses correct commands for your OS

### 3. **Comprehensive Coverage**
- 35+ Windows-specific patterns
- 40+ Linux/Unix patterns
- macOS-specific additions
- Covers shell commands, file operations, system modifications

### 4. **Performance**
- Detection runs once on first startup
- Cached for subsequent sessions
- No performance impact during normal operation

## Manual Platform Re-Detection

If you need to force platform re-detection (e.g., after OS change or WSL switch):

```bash
# Delete the cached platform file
rm ~/.g-coder/platform.json

# Restart G-Coder
g-coder

# Platform will be re-detected automatically
```

## Troubleshooting

### Issue: Wrong Platform Detected

**Solution**: Delete `~/.g-coder/platform.json` and restart G-Coder

### Issue: Missing Dangerous Pattern

**Symptom**: A dangerous command isn't being flagged

**Solution**: The pattern may not be in the default list. You can:
1. Report it as an issue for inclusion
2. Use hooks to add custom blocking

### Issue: False Positive on Safe Command

**Solution**: Use auto-approve for that specific command when prompted

## Comparison: Platform-Specific vs Generic

### Generic Approach (Old)
```
User: "Delete files"
Windows AI: rm -rf files    ❌ Wrong command for Windows
Linux AI: del files         ❌ Wrong command for Linux
```

### Platform-Specific Approach (New)
```
User: "Delete files"
Windows AI: del /q files    ✓ Correct Windows command, properly assessed
Linux AI: rm -rf files      ✓ Correct Linux command, properly assessed
```

## Future Enhancements

Planned improvements:
- Shell-specific patterns (bash vs zsh vs PowerShell)
- Container/VM detection (Docker, WSL)
- Custom pattern addition via config
- Platform-specific auto-approve suggestions

## Contributing

To add new dangerous patterns:

1. Edit `src/utils/platform.ts`
2. Add pattern to `getDangerousPatterns()` for your platform
3. Add to `getDangerousCommands()` if it's a command name
4. Test with `npm run build`
5. Submit a pull request

## License

MIT - Same as G-Coder project
