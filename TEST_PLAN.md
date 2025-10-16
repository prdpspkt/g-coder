# G-Coder Comprehensive Test Plan

This document contains test cases for all g-coder features implemented in Phases 1-3.

## Test Categories

### 1. Core Tool Tests
### 2. Phase 1 Features (Quick Wins)
### 3. Phase 2 Features (Power Features)
### 4. Phase 3 Features (Advanced Features)
### 5. Integration Tests

---

## 1. CORE TOOL TESTS

### Test 1.1: Read Tool
**Objective**: Verify file reading with line numbers

**Test Steps**:
1. Ask: "Read the package.json file"
2. Expected: Should display package.json with line numbers

**Success Criteria**: File content shown with `cat -n` style line numbers

---

### Test 1.2: Write Tool
**Objective**: Create a new file

**Test Steps**:
1. Ask: "Create a test file at test-files/hello.txt with content 'Hello G-Coder'"
2. Expected: File created with success message

**Success Criteria**: File created, summary shows path and line count

---

### Test 1.3: Edit Tool
**Objective**: Modify existing file

**Test Steps**:
1. Ask: "Change 'Hello G-Coder' to 'Hello World' in test-files/hello.txt"
2. Expected: File edited successfully

**Success Criteria**: Content updated correctly

---

### Test 1.4: Glob Tool
**Objective**: Find files by pattern

**Test Steps**:
1. Ask: "Find all TypeScript files in the src directory"
2. Expected: List of .ts files

**Success Criteria**: Shows matching files sorted by modification time

---

### Test 1.5: Grep Tool
**Objective**: Search for text in files

**Test Steps**:
1. Ask: "Search for the word 'AIProvider' in the src directory"
2. Expected: Files containing the word

**Success Criteria**: Shows matching files/lines

---

### Test 1.6: Bash Tool
**Objective**: Execute shell commands

**Test Steps**:
1. Ask: "List files in the current directory"
2. Expected: Directory listing

**Success Criteria**: Command output displayed

---

## 2. PHASE 1 FEATURE TESTS (Quick Wins)

### Test 2.1: TodoWrite Tool
**Objective**: Task management

**Test Steps**:
1. Ask: "Create a todo list with 3 tasks: task 1 pending, task 2 in progress, task 3 completed"
2. Expected: Visual todo list with progress indicators

**Success Criteria**:
- Shows ○ for pending
- Shows ► for in_progress
- Shows ✓ for completed
- Shows progress percentage

---

### Test 2.2: Background Bash Execution
**Objective**: Run long commands in background

**Test Steps**:
1. Ask: "Run 'sleep 5 && echo done' in the background"
2. Expected: Returns immediately with shell ID
3. Ask: "Check the output of that background command"
4. Expected: Shows the output

**Success Criteria**: Command runs asynchronously, output retrievable

---

### Test 2.3: Parallel Tool Execution
**Objective**: Multiple tools execute simultaneously

**Test Steps**:
1. Ask: "Read package.json AND search for 'import' in src/cli.ts"
2. Expected: Both tools execute in parallel

**Success Criteria**: Shows "Executing 2 tools..." message

---

### Test 2.4: File Safety Warnings
**Objective**: Warnings for sensitive files

**Test Steps**:
1. Ask: "Create a file named .env with API_KEY=test"
2. Expected: Safety warning displayed

**Success Criteria**: Warning about sensitive file patterns

---

## 3. PHASE 2 FEATURE TESTS (Power Features)

### Test 3.1: WebFetch Tool
**Objective**: Fetch web content

**Test Steps**:
1. Ask: "Fetch the content from https://jsonplaceholder.typicode.com/todos/1"
2. Expected: JSON content displayed
3. Ask the same again
4. Expected: Cached response (faster)

**Success Criteria**:
- Content fetched and displayed
- Second fetch uses cache

---

### Test 3.2: NotebookEdit Tool
**Objective**: Edit Jupyter notebooks (if available)

**Test Steps**:
1. Create a test notebook
2. Ask: "Insert a new code cell in the notebook with print('test')"
3. Expected: Notebook modified

**Success Criteria**: Cell added/modified correctly

---

### Test 3.3: Read Notebook
**Objective**: Read Jupyter notebook content

**Test Steps**:
1. Ask: "Read the test notebook file"
2. Expected: Cells displayed with formatting

**Success Criteria**: Shows cell types, content, and outputs

---

### Test 3.4: Plan Mode
**Objective**: Approval workflow before execution

**Test Steps**:
1. Type: "/plan" to enable plan mode
2. Ask: "Create a file test.txt"
3. Expected: Shows plan, asks for approval
4. Type: "/approve"
5. Expected: Executes the plan

**Success Criteria**:
- Plan shown before execution
- Executes after approval
- Can reject with /reject

---

## 4. PHASE 3 FEATURE TESTS (Advanced Features)

### Test 4.1: GitStatus Tool
**Objective**: Show git repository status

**Test Steps**:
1. Ask: "Show git status"
2. Expected: Current branch and file changes

**Success Criteria**: Displays git status output

---

### Test 4.2: GitDiff Tool
**Objective**: Show git changes

**Test Steps**:
1. Make a change to a file
2. Ask: "Show unstaged git changes"
3. Expected: Diff output

**Success Criteria**: Shows diff correctly

---

### Test 4.3: GitCommit Tool
**Objective**: Create git commits

**Test Steps**:
1. Stage changes
2. Ask: "Create a git commit with message 'Test commit'"
3. Expected: Commit created with G-Coder attribution

**Success Criteria**:
- Commit created
- Includes co-author footer

---

### Test 4.4: Custom Slash Commands
**Objective**: Use custom commands

**Test Steps**:
1. Type: "/commands" to list custom commands
2. Expected: Shows /review, /test, /refactor
3. Type: "/review"
4. Expected: Executes review command prompt

**Success Criteria**:
- Commands listed correctly
- Command executes its prompt

---

### Test 4.5: Hook System
**Objective**: Event hooks trigger correctly

**Test Steps**:
1. Type: "/hooks" to show hooks
2. Expected: Shows hook configuration
3. Configure a test hook (if any)
4. Trigger the hook event
5. Expected: Hook executes

**Success Criteria**:
- Hooks display correctly
- Hook can be configured and triggered

---

### Test 4.6: Native Function Calling (OpenAI/Anthropic)
**Objective**: Verify native tool calling works

**Test Steps**:
1. Switch to OpenAI or Anthropic provider
2. Ask: "Read package.json and show git status"
3. Expected: Tools execute without regex parsing
4. Check logs for native tool call indicators

**Success Criteria**:
- Tools execute successfully
- No "Auto-correcting format" warnings
- Logs show native tool calling used

---

## 5. INTEGRATION TESTS

### Test 5.1: Multi-Step Workflow
**Objective**: Complex task with multiple tools

**Test Steps**:
1. Ask: "Create a new file hello.js with a hello function, then search for all .js files, then show git status"
2. Expected: All three operations complete

**Success Criteria**:
- File created (Write)
- Files found (Glob)
- Status shown (GitStatus)

---

### Test 5.2: Error Handling
**Objective**: Graceful error handling

**Test Steps**:
1. Ask: "Read a file that doesn't exist: nonexistent.txt"
2. Expected: Clear error message

**Success Criteria**: Error message displayed, no crash

---

### Test 5.3: Context Management
**Objective**: Conversation context maintained

**Test Steps**:
1. Ask: "Create a file test1.txt"
2. Ask: "Now read that file"
3. Expected: Reads test1.txt (remembers context)

**Success Criteria**: AI remembers previous conversation

---

### Test 5.4: Help and Commands
**Objective**: Built-in commands work

**Test Steps**:
1. Type: "/help"
2. Expected: Help text displayed
3. Type: "/tools"
4. Expected: List of all tools
5. Type: "/context"
6. Expected: Context size shown

**Success Criteria**: All commands work correctly

---

## Test Execution Checklist

- [ ] Test 1.1: Read Tool
- [ ] Test 1.2: Write Tool
- [ ] Test 1.3: Edit Tool
- [ ] Test 1.4: Glob Tool
- [ ] Test 1.5: Grep Tool
- [ ] Test 1.6: Bash Tool
- [ ] Test 2.1: TodoWrite Tool
- [ ] Test 2.2: Background Bash
- [ ] Test 2.3: Parallel Execution
- [ ] Test 2.4: Safety Warnings
- [ ] Test 3.1: WebFetch Tool
- [ ] Test 3.2: NotebookEdit Tool (if applicable)
- [ ] Test 3.3: Read Notebook (if applicable)
- [ ] Test 3.4: Plan Mode
- [ ] Test 4.1: GitStatus Tool
- [ ] Test 4.2: GitDiff Tool
- [ ] Test 4.3: GitCommit Tool
- [ ] Test 4.4: Custom Commands
- [ ] Test 4.5: Hook System
- [ ] Test 4.6: Native Function Calling
- [ ] Test 5.1: Multi-Step Workflow
- [ ] Test 5.2: Error Handling
- [ ] Test 5.3: Context Management
- [ ] Test 5.4: Help Commands

---

## Expected Results Summary

**Total Tests**: 25
**Categories**: 5

**Tool Coverage**:
- Core Tools: 6 tests
- Phase 1: 4 tests
- Phase 2: 4 tests
- Phase 3: 6 tests
- Integration: 5 tests

**What Should Work**:
- All 15 tools execute correctly
- Parallel execution
- Background processes
- Native function calling (OpenAI/Anthropic)
- Regex parsing fallback (Ollama/other)
- Custom commands
- Hook system
- Plan mode
- Error handling
- Context preservation
