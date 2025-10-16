# G-Coder Manual Test Prompts

Copy and paste these prompts into g-coder to test each feature.

---

## SETUP: Start g-coder
```bash
npm start
# or
g-coder
```

---

## TEST 1: Read Tool
**Prompt**: `Read the package.json file`

**Expected**: File content with line numbers

**Verify**: ✅ File displayed correctly

---

## TEST 2: Glob Tool
**Prompt**: `Find all TypeScript files in the src/tools directory`

**Expected**: List of .ts files in src/tools

**Verify**: ✅ Shows Read.ts, Write.ts, Edit.ts, etc.

---

## TEST 3: Grep Tool
**Prompt**: `Search for the word "AIProvider" in the src directory`

**Expected**: Files containing "AIProvider"

**Verify**: ✅ Shows src/providers/types.ts and other matches

---

## TEST 4: Write Tool
**Prompt**: `Create a file at test-files/temp/test-write.txt with content "Testing Write Tool"`

**Expected**: File created successfully

**Verify**: ✅ File created with summary

---

## TEST 5: Edit Tool
**Prompt**: `Change "Testing Write Tool" to "Write Tool Works!" in test-files/temp/test-write.txt`

**Expected**: File edited successfully

**Verify**: ✅ Content updated

---

## TEST 6: Bash Tool
**Prompt**: `Run the command: echo "Bash tool test"`

**Expected**: Output: Bash tool test

**Verify**: ✅ Command executed

---

## TEST 7: TodoWrite Tool
**Prompt**: `Create a todo list with these tasks: "Read documentation" as pending, "Install dependencies" as in_progress, "Run tests" as completed`

**Expected**: Visual todo list with icons

**Verify**:
- ✅ Shows ○ for pending
- ✅ Shows ► for in_progress
- ✅ Shows ✓ for completed
- ✅ Shows progress percentage

---

## TEST 8: Background Bash
**Prompt**: `Run this command in the background: sleep 3 && echo "Background task complete"`

**Expected**: Returns immediately with shell ID

**Then run**: `Check the output of the background shell`

**Verify**: ✅ Shows output after 3 seconds

---

## TEST 9: Parallel Execution
**Prompt**: `Read package.json AND search for "import" in src/cli.ts AND show git status`

**Expected**: "Executing 3 tools..." message

**Verify**: ✅ All three tools execute simultaneously

---

## TEST 10: WebFetch Tool
**Prompt**: `Fetch content from https://jsonplaceholder.typicode.com/todos/1`

**Expected**: JSON data displayed

**Then repeat the same prompt**

**Verify**:
- ✅ First fetch retrieves data
- ✅ Second fetch uses cache (faster)

---

## TEST 11: GitStatus Tool
**Prompt**: `Show git status`

**Expected**: Current branch and file status

**Verify**: ✅ Shows repository status

---

## TEST 12: GitDiff Tool
**Prompt**: `Show unstaged git changes`

**Expected**: Diff output (if changes exist)

**Verify**: ✅ Shows diff or "no changes" message

---

## TEST 13: Custom Commands
**Command**: `/commands`

**Expected**: List of custom commands (/review, /test, /refactor)

**Then run**: `/review`

**Verify**:
- ✅ Commands listed
- ✅ /review executes review prompt

---

## TEST 14: Hooks System
**Command**: `/hooks`

**Expected**: Hook configuration display

**Verify**: ✅ Shows hooks config path and status

---

## TEST 15: Plan Mode
**Command**: `/plan`

**Expected**: "Plan mode enabled" message

**Then prompt**: `Create a file test-plan.txt with content "Testing plan mode"`

**Expected**: Shows plan and asks for approval

**Command**: `/approve`

**Verify**:
- ✅ Plan displayed before execution
- ✅ Execution after approval
- ✅ File created

**Command**: `/plan` (to disable)

---

## TEST 16: Multi-Step Workflow
**Prompt**: `Create a file hello-world.js with console.log("Hello World"), then search for all .js files in test-files directory, then show git status`

**Expected**: All three operations complete in sequence

**Verify**:
- ✅ File created
- ✅ Files found
- ✅ Git status shown

---

## TEST 17: Error Handling
**Prompt**: `Read a file that does not exist: /nonexistent/file.txt`

**Expected**: Clear error message (not a crash)

**Verify**: ✅ Error handled gracefully

---

## TEST 18: Context Memory
**Prompt 1**: `Create a file called context-test.txt with content "test"`

**Prompt 2**: `Now read that file`

**Expected**: Reads context-test.txt (remembers previous conversation)

**Verify**: ✅ AI remembers context

---

## TEST 19: Help Commands
**Command**: `/help`

**Expected**: Full help text

**Command**: `/tools`

**Expected**: List of all 15 tools

**Command**: `/context`

**Expected**: Context size

**Verify**: ✅ All commands work

---

## TEST 20: Safety Warnings
**Prompt**: `Create a file named .env with content "API_KEY=secret123"`

**Expected**: Safety warning displayed

**Verify**: ✅ Warning about sensitive file

---

## TEST 21: Reload Commands
**Command**: `/reload`

**Expected**: "Reloaded commands and hooks" message

**Verify**: ✅ Reload successful

---

## TEST 22: Config Display
**Command**: `/config`

**Expected**: Current configuration (API keys masked)

**Verify**: ✅ Config displayed correctly

---

## TEST 23: Context Clear
**Command**: `/clear`

**Expected**: Context cleared

**Verify**: ✅ Previous conversation forgotten

---

## TEST 24: Provider Info
**Command**: `/provider`

**Expected**: Current provider name

**Verify**: ✅ Shows current provider (ollama/openai/anthropic/deepseek)

---

## TEST 25: Exit
**Command**: `exit` or `/quit`

**Expected**: Clean exit

**Verify**: ✅ Program exits gracefully

---

## RESULTS CHECKLIST

Mark each test as you complete it:

- [ ] TEST 1: Read Tool
- [ ] TEST 2: Glob Tool
- [ ] TEST 3: Grep Tool
- [ ] TEST 4: Write Tool
- [ ] TEST 5: Edit Tool
- [ ] TEST 6: Bash Tool
- [ ] TEST 7: TodoWrite Tool
- [ ] TEST 8: Background Bash
- [ ] TEST 9: Parallel Execution
- [ ] TEST 10: WebFetch Tool
- [ ] TEST 11: GitStatus Tool
- [ ] TEST 12: GitDiff Tool
- [ ] TEST 13: Custom Commands
- [ ] TEST 14: Hooks System
- [ ] TEST 15: Plan Mode
- [ ] TEST 16: Multi-Step Workflow
- [ ] TEST 17: Error Handling
- [ ] TEST 18: Context Memory
- [ ] TEST 19: Help Commands
- [ ] TEST 20: Safety Warnings
- [ ] TEST 21: Reload Commands
- [ ] TEST 22: Config Display
- [ ] TEST 23: Context Clear
- [ ] TEST 24: Provider Info
- [ ] TEST 25: Exit

---

## NOTES

- **Total Tests**: 25
- **Estimated Time**: 15-20 minutes
- **Prerequisites**:
  - g-coder built (`npm run build`)
  - Node.js installed
  - Git repository initialized (for git tests)
  - Internet connection (for WebFetch test)

---

## QUICK TEST SCRIPT

For a quick smoke test, run these essential tests:

1. `/help` - Verify help works
2. `/tools` - Verify all 15 tools listed
3. `Read package.json` - Test Read tool
4. `Find all .ts files in src` - Test Glob tool
5. `Create file test.txt with hello` - Test Write tool
6. `/commands` - Test custom commands
7. `exit` - Clean exit

If these 7 tests pass, most features are working!
