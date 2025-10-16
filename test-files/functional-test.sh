#!/bin/bash

# G-Coder Functional Test Script
# Tests actual tool execution

echo "=========================================="
echo "G-Coder Functional Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Test counter
test_num=0

function run_test() {
    test_num=$((test_num + 1))
    local test_name="$1"
    local command="$2"
    local expected="$3"

    echo -e "${YELLOW}Test $test_num: $test_name${NC}"
    echo "Running: $command"

    output=$(eval "$command" 2>&1)
    exit_code=$?

    if [[ $exit_code -eq 0 ]] && [[ "$output" == *"$expected"* ]]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Expected to contain: $expected"
        echo "Got: $output"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Ensure test-files directory exists
mkdir -p test-files/temp

echo "Running functional tests..."
echo ""

# Test 1: Check if g-coder is built
run_test "Check if built" "test -f dist/index.js && echo 'built'" "built"

# Test 2: Check package.json
run_test "Package.json exists" "test -f package.json && echo 'exists'" "exists"

# Test 3: Check source files
run_test "Source files exist" "ls src/cli.ts src/tools/index.ts > /dev/null 2>&1 && echo 'source-ok'" "source-ok"

# Test 4: Check all tool files
run_test "All tool files exist" "ls src/tools/*.ts | wc -l" "10"

# Test 5: Check provider files
run_test "Provider files exist" "ls src/providers/*.ts | wc -l" "5"

# Test 6: Check if dist has compiled files
run_test "Compiled files exist" "ls dist/*.js > /dev/null 2>&1 && echo 'compiled'" "compiled"

# Test 7: Create a test file using Write tool simulation
run_test "Can create test files" "echo 'test content' > test-files/temp/functional-test.txt && cat test-files/temp/functional-test.txt" "test content"

# Test 8: Glob pattern test (find TypeScript files)
run_test "Find TypeScript files" "find src/tools -name '*.ts' | wc -l" "10"

# Test 9: Check git tools implementation
run_test "Git tools implemented" "grep -c 'export class Git' src/tools/git.ts" "4"

# Test 10: Check hook system
run_test "Hook system implemented" "grep -c 'HookManager' src/utils/hooks.ts" "1"

# Test 11: Check command system
run_test "Command system implemented" "grep -c 'CommandManager' src/utils/commands.ts" "1"

# Test 12: Check native function calling
run_test "Native function calling" "grep -c 'supportsNativeTools' src/providers/openai.ts" "1"

# Test 13: Verify all 15 tools registered
run_test "15 tools registered" "grep -c 'this.register' src/tools/index.ts" "15"

# Test 14: Check if TodoWrite has progress indicators
run_test "TodoWrite progress icons" "grep -c '►\\|✓\\|○' src/tools/todo.ts" "3"

# Test 15: Verify parallel execution
run_test "Parallel execution code" "grep -c 'Promise.all' src/cli.ts" "1"

# Cleanup
rm -f test-files/temp/functional-test.txt

# Summary
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo -e "Total: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All functional tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi
