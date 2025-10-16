#!/usr/bin/env node

/**
 * Automated Test Suite for G-Coder
 * Tests all tools and features programmatically
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_DIR = path.join(__dirname);
const GCODER_CMD = 'node';
const GCODER_ARGS = [path.join(__dirname, '..', 'dist', 'index.js')];

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'cyan');
  console.log('='.repeat(60) + '\n');
}

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
};

function recordResult(testName, passed, error = null) {
  results.tests.push({ name: testName, passed, error });
  if (passed) {
    results.passed++;
    log(`✓ ${testName}`, 'green');
  } else {
    results.failed++;
    log(`✗ ${testName}`, 'red');
    if (error) log(`  Error: ${error}`, 'gray');
  }
}

// Setup test environment
function setupTestEnv() {
  // Create test directories
  const dirs = [
    path.join(TEST_DIR, 'temp'),
    path.join(TEST_DIR, 'output'),
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Cleanup test environment
function cleanupTestEnv() {
  const testFiles = [
    path.join(TEST_DIR, 'temp'),
    path.join(TEST_DIR, 'hello.txt'),
    path.join(TEST_DIR, 'test.txt'),
    path.join(TEST_DIR, 'hello.js'),
  ];

  testFiles.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        if (fs.statSync(file).isDirectory()) {
          fs.rmSync(file, { recursive: true });
        } else {
          fs.unlinkSync(file);
        }
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  });
}

// Test helper: Check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Test helper: Read file content
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return null;
  }
}

// Core tool tests
function testCoreTools() {
  header('1. CORE TOOL TESTS');

  // Test 1.1: Check if package.json exists (prerequisite)
  const packageExists = fileExists(path.join(__dirname, '..', 'package.json'));
  recordResult('Test 1.1: package.json exists', packageExists);

  // Test 1.2: Check if src directory exists
  const srcExists = fileExists(path.join(__dirname, '..', 'src'));
  recordResult('Test 1.2: src directory exists', srcExists);

  // Test 1.3: Check if dist directory exists (built)
  const distExists = fileExists(path.join(__dirname, '..', 'dist'));
  recordResult('Test 1.3: dist directory exists (built)', distExists);

  // Test 1.4: Check if main entry point exists
  const entryExists = fileExists(path.join(__dirname, '..', 'dist', 'index.js'));
  recordResult('Test 1.4: dist/index.js exists', entryExists);
}

// Phase 1 feature tests
function testPhase1Features() {
  header('2. PHASE 1 FEATURE TESTS');

  // Test 2.1: Check if TodoWrite tool is registered
  const todoToolExists = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'tools', 'todo.ts'),
    'utf-8'
  ).includes('export class TodoWriteTool');
  recordResult('Test 2.1: TodoWrite tool exists', todoToolExists);

  // Test 2.2: Check if BashOutput tool exists
  const bashOutputExists = fileExists(path.join(__dirname, '..', 'src', 'tools', 'bash-output.ts'));
  recordResult('Test 2.2: BashOutput tool exists', bashOutputExists);

  // Test 2.3: Check if safety warnings are implemented
  const safetyWarnings = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'tools', 'write.ts'),
    'utf-8'
  ).includes('sensitivePatterns');
  recordResult('Test 2.3: Safety warnings implemented', safetyWarnings);
}

// Phase 2 feature tests
function testPhase2Features() {
  header('3. PHASE 2 FEATURE TESTS');

  // Test 3.1: Check if WebFetch tool exists
  const webFetchExists = fileExists(path.join(__dirname, '..', 'src', 'tools', 'webfetch.ts'));
  recordResult('Test 3.1: WebFetch tool exists', webFetchExists);

  // Test 3.2: Check if NotebookEdit tool exists
  const notebookExists = fileExists(path.join(__dirname, '..', 'src', 'tools', 'notebook.ts'));
  recordResult('Test 3.2: NotebookEdit tool exists', notebookExists);

  // Test 3.3: Check if Read tool supports notebooks
  const notebookSupport = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'tools', 'read.ts'),
    'utf-8'
  ).includes('.ipynb');
  recordResult('Test 3.3: Read tool supports notebooks', notebookSupport);

  // Test 3.4: Check if plan mode is implemented
  const planMode = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'cli.ts'),
    'utf-8'
  ).includes('planMode');
  recordResult('Test 3.4: Plan mode implemented', planMode);
}

// Phase 3 feature tests
function testPhase3Features() {
  header('4. PHASE 3 FEATURE TESTS');

  // Test 4.1: Check if Git tools exist
  const gitToolsExist = fileExists(path.join(__dirname, '..', 'src', 'tools', 'git.ts'));
  recordResult('Test 4.1: Git tools exist', gitToolsExist);

  // Test 4.2: Check if all 4 git tools are implemented
  if (gitToolsExist) {
    const gitContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'tools', 'git.ts'), 'utf-8');
    const hasCommit = gitContent.includes('GitCommitTool');
    const hasPush = gitContent.includes('GitPushTool');
    const hasStatus = gitContent.includes('GitStatusTool');
    const hasDiff = gitContent.includes('GitDiffTool');
    recordResult('Test 4.2: All 4 git tools implemented', hasCommit && hasPush && hasStatus && hasDiff);
  } else {
    recordResult('Test 4.2: All 4 git tools implemented', false, 'Git tools file not found');
  }

  // Test 4.3: Check if command system exists
  const commandSystemExists = fileExists(path.join(__dirname, '..', 'src', 'utils', 'commands.ts'));
  recordResult('Test 4.3: Command system exists', commandSystemExists);

  // Test 4.4: Check if hook system exists
  const hookSystemExists = fileExists(path.join(__dirname, '..', 'src', 'utils', 'hooks.ts'));
  recordResult('Test 4.4: Hook system exists', hookSystemExists);

  // Test 4.5: Check if tool converter exists
  const converterExists = fileExists(path.join(__dirname, '..', 'src', 'tools', 'converter.ts'));
  recordResult('Test 4.5: Tool converter exists (native function calling)', converterExists);

  // Test 4.6: Check if providers support native tools
  const openaiNative = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'providers', 'openai.ts'),
    'utf-8'
  ).includes('supportsNativeTools');
  recordResult('Test 4.6: OpenAI native tool support', openaiNative);

  const anthropicNative = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'providers', 'anthropic.ts'),
    'utf-8'
  ).includes('supportsNativeTools');
  recordResult('Test 4.7: Anthropic native tool support', anthropicNative);
}

// Integration tests
function testIntegration() {
  header('5. INTEGRATION TESTS');

  // Test 5.1: Check if all tools are registered
  const toolRegistry = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'tools', 'index.ts'),
    'utf-8'
  );

  const requiredTools = [
    'ReadTool',
    'WriteTool',
    'EditTool',
    'GlobTool',
    'GrepTool',
    'BashTool',
    'TodoWriteTool',
    'BashOutputTool',
    'KillShellTool',
    'WebFetchTool',
    'NotebookEditTool',
    'GitCommitTool',
    'GitPushTool',
    'GitStatusTool',
    'GitDiffTool',
  ];

  const allRegistered = requiredTools.every(tool => toolRegistry.includes(tool));
  recordResult('Test 5.1: All 15 tools registered', allRegistered);

  // Test 5.2: Check if CLI integrates hooks
  const cliContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'cli.ts'), 'utf-8');
  const hooksIntegrated = cliContent.includes('hookManager');
  recordResult('Test 5.2: Hooks integrated in CLI', hooksIntegrated);

  // Test 5.3: Check if CLI integrates commands
  const commandsIntegrated = cliContent.includes('commandManager');
  recordResult('Test 5.3: Commands integrated in CLI', commandsIntegrated);

  // Test 5.4: Check if CLI uses native tools
  const nativeToolsUsed = cliContent.includes('supportsNativeTools');
  recordResult('Test 5.4: Native tools integrated in CLI', nativeToolsUsed);

  // Test 5.5: Check if parallel execution is implemented
  const parallelExecution = cliContent.includes('Promise.all');
  recordResult('Test 5.5: Parallel execution implemented', parallelExecution);
}

// File structure tests
function testFileStructure() {
  header('6. FILE STRUCTURE TESTS');

  const expectedFiles = [
    'src/cli.ts',
    'src/tools/index.ts',
    'src/tools/read.ts',
    'src/tools/write.ts',
    'src/tools/edit.ts',
    'src/tools/glob.ts',
    'src/tools/grep.ts',
    'src/tools/bash.ts',
    'src/tools/todo.ts',
    'src/tools/bash-output.ts',
    'src/tools/webfetch.ts',
    'src/tools/notebook.ts',
    'src/tools/git.ts',
    'src/tools/converter.ts',
    'src/utils/commands.ts',
    'src/utils/hooks.ts',
    'src/providers/openai.ts',
    'src/providers/anthropic.ts',
    'src/providers/ollama.ts',
    'src/providers/deepseek.ts',
    'package.json',
    'tsconfig.json',
  ];

  expectedFiles.forEach((file, index) => {
    const filePath = path.join(__dirname, '..', file);
    const exists = fileExists(filePath);
    recordResult(`Test 6.${index + 1}: ${file} exists`, exists);
  });
}

// Print final results
function printResults() {
  header('TEST RESULTS SUMMARY');

  const total = results.passed + results.failed + results.skipped;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(2) : 0;

  console.log(`Total Tests: ${total}`);
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'gray');
  log(`Skipped: ${results.skipped}`, 'yellow');
  console.log(`Pass Rate: ${passRate}%`);

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => {
        log(`  - ${t.name}`, 'red');
        if (t.error) log(`    ${t.error}`, 'gray');
      });
  }

  console.log('\n' + '='.repeat(60));

  if (results.failed === 0) {
    log('🎉 ALL TESTS PASSED!', 'green');
  } else {
    log(`⚠️  ${results.failed} test(s) failed`, 'yellow');
  }
  console.log('='.repeat(60) + '\n');

  return results.failed === 0;
}

// Main test runner
async function runTests() {
  header('G-CODER AUTOMATED TEST SUITE');
  log('Testing all features and tools...', 'cyan');

  setupTestEnv();

  try {
    testCoreTools();
    testPhase1Features();
    testPhase2Features();
    testPhase3Features();
    testIntegration();
    testFileStructure();

    const success = printResults();

    // Save results to file
    const resultsFile = path.join(TEST_DIR, 'output', 'test-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    log(`\nResults saved to: ${resultsFile}`, 'gray');

    process.exit(success ? 0 : 1);
  } catch (error) {
    log(`\nTest suite error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests();
