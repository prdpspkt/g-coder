# G-Coder Usage Examples

This document provides practical examples of how to use G-Coder for various coding tasks.

## Getting Started

```bash
# Start G-Coder
g-coder

# Or with a specific model
g-coder start --model codellama
```

## Basic File Operations

### Reading Files

```
> Read the package.json file

> Show me the contents of src/index.ts

> Read the README.md file from line 50 to line 100
```

### Creating Files

```
> Create a new file called hello.js with a simple hello world function

> Create a TypeScript interface file for a User model with name, email, and id fields

> Write a .gitignore file with standard Node.js exclusions
```

### Editing Files

```
> In index.ts, replace console.log with logger.info

> Update the version number in package.json from 1.0.0 to 1.1.0

> Fix the typo "fucntion" to "function" in all TypeScript files
```

## Code Search

### Finding Files

```
> Find all JavaScript files in the project

> List all .ts files in the src directory

> Show me all test files

> Find all configuration files (json, yaml, toml)
```

### Searching Code

```
> Search for the function "calculateTotal" in the codebase

> Find all occurrences of "TODO" in the project

> Search for import statements from "react" in all files

> Find all files that use the Express framework
```

## Running Commands

### Package Management

```
> Run npm install

> Show me the output of npm test

> Execute npm run build and tell me if there are any errors

> Run yarn install and check if all dependencies are resolved
```

### Git Operations

```
> Show me the git status

> What files have been modified? (git diff)

> Show me the last 5 git commits

> Run git branch to see all branches
```

### Development Tasks

```
> Start the development server

> Run the linter on all TypeScript files

> Execute the test suite and show me any failures

> Build the project for production
```

## Debugging and Problem Solving

### Finding Errors

```
> I'm getting a TypeError in app.ts. Can you read the file and help me find the issue?

> Search for all console.error statements in the project

> Find where the function "fetchUserData" is defined

> Show me all files that import from "./database"
```

### Code Analysis

```
> Read the auth.ts file and explain what it does

> Analyze the database.js file for potential security issues

> Review the API routes in server.ts

> Check if there are any unused imports in index.ts
```

### Refactoring

```
> In utils.ts, extract the validation logic into a separate function

> Refactor the error handling in api.ts to use a centralized error handler

> Convert all var declarations to const or let in legacy.js

> Split the large App.tsx component into smaller components
```

## Project Setup

### Initialize New Project

```
> Create a package.json for a new Express API project

> Set up a basic TypeScript configuration file

> Create a .eslintrc.json with recommended rules for Node.js

> Write a basic Express server in index.js with a hello world route
```

### Adding Features

```
> Create a middleware function for JWT authentication

> Write a database connection module using MongoDB

> Add a logging utility using Winston

> Create a validation schema using Joi for user registration
```

## Code Generation

### Functions

```
> Write a function to validate email addresses

> Create a debounce function in TypeScript

> Generate a function that converts CSV to JSON

> Write a recursive function to flatten nested arrays
```

### Classes and Modules

```
> Create a TypeScript class for a User model with CRUD methods

> Write a service class for handling HTTP requests

> Generate a utility module for date formatting

> Create a React component for a login form
```

### Tests

```
> Write Jest tests for the calculateTotal function in utils.ts

> Create unit tests for the User model

> Generate integration tests for the API endpoints

> Write a test suite for the authentication middleware
```

## Documentation

```
> Add JSDoc comments to all functions in utils.ts

> Generate API documentation for the routes in server.ts

> Create inline comments explaining the algorithm in sort.ts

> Write a comprehensive README for this project
```

## Complex Workflows

### Feature Implementation

```
> I need to add user authentication to my Express app.
  Can you:
  1. Create a User model
  2. Add authentication routes (login, register)
  3. Create JWT middleware
  4. Update the main server file

> Help me implement a caching layer:
  1. Create a cache utility using Redis
  2. Add caching middleware
  3. Update API routes to use caching
```

### Bug Fixing

```
> My app crashes when I try to fetch users. Here's the error: [paste error].
  Can you:
  1. Read the relevant files
  2. Identify the issue
  3. Suggest a fix

> The tests are failing. Can you:
  1. Run npm test
  2. Show me which tests failed
  3. Read the test files
  4. Fix the issues
```

## Advanced Usage

### Multi-step Analysis

```
> Analyze my project structure:
  1. List all files
  2. Show me the main entry point
  3. Identify dependencies
  4. Suggest improvements

> Performance audit:
  1. Find all database queries
  2. Identify N+1 query problems
  3. Suggest optimizations
```

### Code Migration

```
> Help me migrate from JavaScript to TypeScript:
  1. Show all .js files
  2. Create corresponding .ts files with types
  3. Update imports

> Convert my callbacks to async/await:
  1. Find all callback-based functions
  2. Refactor to use promises
  3. Update error handling
```

## Tips for Effective Usage

### Be Specific
Bad: "Fix my code"
Good: "In auth.ts, the login function returns undefined instead of a user object. Can you help fix this?"

### Provide Context
Bad: "Add validation"
Good: "Add email and password validation to the register function in auth.ts using regex"

### Break Down Complex Tasks
Bad: "Build a complete authentication system"
Good:
```
First: "Create a User model with email and password fields"
Then: "Add a register route that hashes passwords"
Then: "Create a login route with JWT tokens"
Finally: "Add authentication middleware to protect routes"
```

### Use Commands
- `/clear` - Start fresh when switching to unrelated tasks
- `/context` - Check if you're approaching context limits
- `/tools` - Remind yourself what tools are available

## Integration Examples

### With Git Workflow

```
> Show me what files have changed
> Read the modified files
> Help me write a descriptive commit message
> Create the commit (I'll run git commit manually)
```

### With CI/CD

```
> Show me the .github/workflows/ci.yml file
> Run the test suite locally
> Check if the build succeeds
> Suggest improvements to the CI pipeline
```

### With Docker

```
> Read the Dockerfile
> Explain what each layer does
> Suggest optimizations to reduce image size
> Create a docker-compose.yml for development
```

## Troubleshooting Common Issues

### Ollama Not Connected

```
> /test
# If this fails, exit G-Coder and run:
ollama serve
```

### Model Not Working Well

```
> /model codellama  # Switch to a code-specific model
# or
> /model deepseek-coder
```

### Context Too Large

```
> /clear  # Clear the conversation history
> /context  # Check current context size
```

### Tool Not Working

```
> /tools  # List all available tools and their parameters
```

---

For more information, see the main [README.md](README.md) or type `/help` in G-Coder.
