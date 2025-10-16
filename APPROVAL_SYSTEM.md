# Execution Approval System

G-Coder now includes a powerful execution approval system that works exactly like Claude Code, providing interactive confirmation before executing potentially dangerous operations.

## Overview

The approval system intercepts tool executions and prompts you for confirmation before running potentially dangerous commands. This prevents accidental file modifications, destructive commands, or other risky operations.

## Features

### 🛡️ Risk Assessment

The system automatically assesses the risk level of each operation:

- **CRITICAL**: Operations like `rm -rf /`, force pushing to main/master, writing to `/dev/` devices
- **HIGH**: Dangerous operations like `rm -rf`, `sudo` commands, modifying `.ssh/` or `.aws/` files
- **MEDIUM**: Operations like `chmod 777`, staging all git changes, `eval()` commands
- **LOW**: Standard operations with no detected risks

### 📋 Approval Prompt

When a tool requires approval, you'll see:

```
⚠ Tool Execution Approval Required
────────────────────────────────────────────────────────
Tool: Bash
Risk Level: HIGH
Warnings:
  ⚠ Recursive force delete

Parameters:
  command: rm -rf ./temp
────────────────────────────────────────────────────────
Do you want to execute this tool?
  ❯ Yes, execute
    No, cancel
    Yes, and auto-approve similar operations
```

### 🎯 Intelligent Detection

The system detects dangerous patterns in:

**Bash Commands:**
- `rm -rf` (especially targeting root `/`)
- `dd if=`, `mkfs` (disk operations)
- `curl ... | bash`, `wget ... | sh` (piped downloads)
- `eval()`, `exec()`
- `chmod 777` (open permissions)
- `sudo` (elevated privileges)

**File Operations (Write/Edit):**
- `.env`, `.git/config` (configuration files)
- `.ssh/`, `.aws/credentials` (sensitive directories)
- Files containing "password", "secret", "credential", "token"
- `/etc/` (system configuration)
- Content with `rm -rf` or `<script>` tags

**Git Operations:**
- Force pushing to main/master
- Staging all changes (`add_all: true`)

### 🔄 Auto-Approve

If you trust a specific operation, choose "Yes, and auto-approve similar operations" to:
- Skip approval for similar commands in the future
- Speed up repetitive workflows
- Maintain safety for genuinely dangerous operations

Auto-approve patterns are command-specific (e.g., approving `npm test` won't auto-approve `npm run build`).

## Usage

### Enabling Approval

```bash
/approval on
```

This enables execution approval for dangerous tools (Bash, Write, Edit, GitCommit, GitPush).

### Disabling Approval

```bash
/approval off
```

Tools will execute without confirmation (not recommended).

### Viewing Status

```bash
/approval
```

Shows:
- Current status (enabled/disabled)
- List of tools requiring approval
- Approval statistics

### Viewing Statistics

```bash
/approval stats
```

Displays:
- Total approval requests
- Number of approved operations
- Number of declined operations
- Breakdown by tool

### Resetting Auto-Approve Patterns

```bash
/approval reset
```

Clears all auto-approve patterns, requiring approval again for all operations.

### Clearing History

```bash
/approval clear-history
```

Resets approval statistics.

## Configuration

The approval system is configured in `~/.g-coder/config.json`:

```json
{
  "approval": {
    "enabled": false,
    "toolsRequiringApproval": {
      "Bash": true,
      "Write": true,
      "Edit": true,
      "GitCommit": true,
      "GitPush": true,
      "WebFetch": false,
      "Read": false,
      "Glob": false,
      "Grep": false,
      "EditNotebook": true
    },
    "autoApprovePatterns": []
  }
}
```

### Configuration Options

- **enabled**: Master toggle for the approval system
- **toolsRequiringApproval**: Per-tool approval settings
- **autoApprovePatterns**: Commands/patterns that are auto-approved

You can manually edit this file to customize which tools require approval.

## Architecture

### Components

1. **ApprovalManager** (`src/utils/approval.ts`)
   - Manages approval configuration
   - Assesses risk levels
   - Prompts for user confirmation
   - Tracks approval history

2. **Config Integration** (`src/utils/config.ts`)
   - Stores approval settings in config file
   - Provides methods to update approval config

3. **CLI Integration** (`src/cli.ts`)
   - Intercepts tool execution
   - Calls ApprovalManager before executing tools
   - Implements `/approval` command

### Execution Flow

```
AI wants to execute tool
        ↓
Check if tool requires approval
        ↓
    [Approval needed?]
    /              \
  Yes               No
   ↓                 ↓
Display risk    Execute tool
assessment           ↓
   ↓              Show result
Prompt user
   ↓
[User decision]
   /    |    \
 Yes   No   Auto
  ↓     ↓     ↓
Exec Cancel Save pattern
       ↓    & Execute
    Return
    error
```

## Examples

### Example 1: Dangerous Command

```
User: "Delete all .log files in the project"
AI: Wants to execute: rm -rf **/*.log

⚠ Tool Execution Approval Required
────────────────────────────────────────────────────────
Tool: Bash
Risk Level: HIGH
Warnings:
  ⚠ Recursive force delete

Parameters:
  command: rm -rf **/*.log
────────────────────────────────────────────────────────
Do you want to execute this tool?
```

You can review the exact command and decide whether to proceed.

### Example 2: Sensitive File

```
User: "Update my .env file with the new API key"
AI: Wants to use Write tool on .env

⚠ Tool Execution Approval Required
────────────────────────────────────────────────────────
Tool: Write
Risk Level: HIGH
Warnings:
  ⚠ Environment file

Parameters:
  file_path: .env
  content: API_KEY=sk-...
────────────────────────────────────────────────────────
Do you want to execute this tool?
```

### Example 3: Git Force Push

```
User: "Force push my changes to main"
AI: Wants to execute: git push --force origin main

⚠ Tool Execution Approval Required
────────────────────────────────────────────────────────
Tool: GitPush
Risk Level: CRITICAL
Warnings:
  ⚠ Force pushing to main/master branch

Parameters:
  branch: main
  force: true
────────────────────────────────────────────────────────
Do you want to execute this tool?
```

The system warns you about the critical operation before it executes.

## Comparison with Plan Mode

G-Coder has two approval systems:

### Plan Mode (`/plan`)
- Shows tool NAMES and COUNT before execution
- All-or-nothing approval for entire operation
- No parameter visibility
- No risk assessment
- Manual toggle required

### Execution Approval (`/approval on`)
- Shows FULL parameters before each tool execution
- Per-tool approval with risk assessment
- Automatic pattern detection
- Always active when enabled
- Can auto-approve trusted operations

**Recommendation**: Use Execution Approval for fine-grained control with risk assessment. Use Plan Mode for high-level operation review.

## Safety Best Practices

1. **Keep approval enabled** when working in production environments
2. **Review parameters carefully** before approving
3. **Use auto-approve sparingly** - only for commands you fully trust
4. **Reset auto-approve patterns** periodically to review changes
5. **Check approval stats** to understand AI behavior patterns
6. **Combine with hooks** for additional safety (e.g., pre-commit hooks)

## Troubleshooting

### Approval prompt not showing

- Check if approval is enabled: `/approval`
- Verify the tool is in the approval list
- Ensure config file is not corrupted

### Auto-approve not working

- Check auto-approve patterns: `/approval`
- Reset patterns if needed: `/approval reset`
- Verify the command matches the saved pattern

### False positives (safe commands flagged as dangerous)

- Use auto-approve for that specific command
- Edit `~/.g-coder/config.json` to adjust tool approval settings
- Report patterns that should be whitelisted

## Contributing

To extend the approval system:

1. Add new risk patterns in `src/utils/approval.ts` → `assessRisk()`
2. Update tool approval list in `createDefaultApprovalConfig()`
3. Add custom approval logic for new tools

## License

MIT - Same as G-Coder project
