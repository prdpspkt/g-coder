# G-Coder Tools Reference

Complete reference for all available tools in G-Coder.

## File System Tools

### Read
Reads file contents with line numbers (cat -n format).

**Parameters:**
- `file_path` (string, required) — Path to the file to read
- `offset` (number, optional) — Line number to start from (1-indexed)
- `limit` (number, optional) — Number of lines to read

**Example:**
```tool-call
Tool: Read
Parameters:
  file_path: src/index.ts
  offset: 10
  limit: 50
```

### Write
Creates a new file or overwrites existing file.

**Parameters:**
- `file_path` (string, required) — Path where file will be created
- `content` (string, required) — File content to write

**Example:**
```tool-call
Tool: Write
Parameters:
  file_path: src/config.ts
  content: export const API_URL = 'https://api.example.com';
```

### Edit
Modifies existing files using exact string replacement.

**Parameters:**
- `file_path` (string, required) — Path to file to edit
- `old_string` (string, required) — Exact text to find (must be unique)
- `new_string` (string, required) — Replacement text
- `replace_all` (boolean, optional) — Replace all occurrences [default: false]

**Example:**
```tool-call
Tool: Edit
Parameters:
  file_path: src/index.ts
  old_string: const PORT = 3000;
  new_string: const PORT = 8080;
```

### Glob
Finds files matching glob patterns.

**Parameters:**
- `pattern` (string, required) — Glob pattern (e.g., `*.ts`, `**/*.css`)
- `path` (string, optional) — Directory to search in [default: current working directory]

**Examples:**
```tool-call
Tool: Glob
Parameters:
  pattern: **/*.ts
```

```tool-call
Tool: Glob
Parameters:
  pattern: src/**/*.test.ts
  path: ./
```

### Grep
Searches file contents using regex patterns (powered by ripgrep).

**Parameters:**
- `pattern` (string, required) — Regex pattern to search for
- `path` (string, optional) — File or directory to search [default: current directory]
- `glob` (string, optional) — Filter by file pattern (e.g., `*.js`)
- `type` (string, optional) — Filter by file type (js, py, rust, etc.)
- `output_mode` (string, optional) — Output format: `content`, `files_with_matches`, `count` [default: files_with_matches]
- `-i` (boolean, optional) — Case insensitive search
- `-n` (boolean, optional) — Show line numbers
- `-A` (number, optional) — Lines of context after match
- `-B` (number, optional) — Lines of context before match
- `-C` (number, optional) — Lines of context around match
- `multiline` (boolean, optional) — Enable multiline mode [default: false]

**Examples:**
```tool-call
Tool: Grep
Parameters:
  pattern: function.*export
  glob: **/*.ts
  output_mode: content
  -n: true
```

```tool-call
Tool: Grep
Parameters:
  pattern: TODO|FIXME
  type: js
  -i: true
```

## Execution Tools

### Bash
Executes shell commands.

**Parameters:**
- `command` (string, required) — Shell command to execute
- `description` (string, optional) — Brief description of what command does
- `timeout` (number, optional) — Timeout in milliseconds [default: 120000]
- `run_in_background` (boolean, optional) — Run in background [default: false]

**Examples:**
```tool-call
Tool: Bash
Parameters:
  command: npm install
  description: Install dependencies
```

```tool-call
Tool: Bash
Parameters:
  command: npm test
  timeout: 300000
```

```tool-call
Tool: Bash
Parameters:
  command: npm run dev
  run_in_background: true
```

### BashOutput
Reads output from background bash shells.

**Parameters:**
- `bash_id` (string, required) — ID of the background shell
- `filter` (string, optional) — Regex to filter output lines

**Example:**
```tool-call
Tool: BashOutput
Parameters:
  bash_id: shell-1
```

### KillShell
Terminates a running background shell.

**Parameters:**
- `shell_id` (string, required) — ID of shell to terminate

**Example:**
```tool-call
Tool: KillShell
Parameters:
  shell_id: shell-1
```

## Git Tools

### GitStatus
Shows git working tree status.

**Parameters:** None

**Example:**
```tool-call
Tool: GitStatus
Parameters:
```

### GitDiff
Shows git diff.

**Parameters:**
- `file_path` (string, optional) — Specific file to diff
- `staged` (boolean, optional) — Show staged changes [default: false]

**Examples:**
```tool-call
Tool: GitDiff
Parameters:
```

```tool-call
Tool: GitDiff
Parameters:
  file_path: src/index.ts
  staged: true
```

### GitCommit
Creates a git commit.

**Parameters:**
- `message` (string, required) — Commit message
- `files` (array, optional) — Specific files to commit [default: all staged]

**Example:**
```tool-call
Tool: GitCommit
Parameters:
  message: Fix authentication bug in login flow
  files: ["src/auth.ts", "src/login.ts"]
```

### GitPush
Pushes commits to remote repository.

**Parameters:**
- `remote` (string, optional) — Remote name [default: origin]
- `branch` (string, optional) — Branch name [default: current branch]
- `force` (boolean, optional) — Force push [default: false]

**Example:**
```tool-call
Tool: GitPush
Parameters:
  remote: origin
  branch: main
```

## Web & Notebook Tools

### WebFetch
Fetches and processes web content (with 15-minute cache).

**Parameters:**
- `url` (string, required) — URL to fetch
- `prompt` (string, required) — Instructions for processing the content

**Example:**
```tool-call
Tool: WebFetch
Parameters:
  url: https://docs.example.com/api
  prompt: Extract all API endpoint URLs and their descriptions
```

### NotebookEdit
Edits Jupyter notebook cells.

**Parameters:**
- `notebook_path` (string, required) — Path to .ipynb file
- `cell_id` (string, optional) — ID of cell to edit
- `new_source` (string, required) — New cell content
- `cell_type` (string, optional) — Cell type: `code` or `markdown`
- `edit_mode` (string, optional) — Edit mode: `replace`, `insert`, `delete` [default: replace]

**Example:**
```tool-call
Tool: NotebookEdit
Parameters:
  notebook_path: analysis.ipynb
  cell_id: abc123
  new_source: import pandas as pd\ndf = pd.read_csv('data.csv')
  cell_type: code
```

## Artifact-Based File Creation

Instead of using Write tool, you can create files using code block artifacts:

```typescript src/utils/helper.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

```css styles/button.css
.btn {
  padding: 10px 20px;
  border-radius: 4px;
  background: #007bff;
  color: white;
}
```

Artifacts are automatically detected and written to disk when the code block is complete.

## Approval System

Tools can require user approval before execution. Configure in `~/.g-coder/config.json`:

```json
{
  "approval": {
    "enabled": true,
    "toolsRequiringApproval": {
      "Bash": true,
      "Write": true,
      "Edit": true,
      "GitCommit": true,
      "GitPush": true,
      "Read": false,
      "Glob": false,
      "Grep": false
    },
    "autoApprovePatterns": [
      "npm install",
      "git status"
    ]
  }
}
```

Use `/boss` command to toggle approval mode during session.

## Configuration Location

- Config file: `~/.g-coder/config.json`
- Environment file: `~/.g-coder/.env`
- Log file: `~/.g-coder/logs/g-coder.log`
