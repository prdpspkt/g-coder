#!/usr/bin/env node
/**
 * Create a fresh, clean config.json file
 * Usage: node scripts/create-fresh-config.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.g-coder');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const defaultConfig = {
  "provider": "deepseek",
  "model": "deepseek-chat",
  "temperature": 0.7,
  "maxTokens": 8192,
  "maxContextTokens": 64000,
  "enableTokenShortening": true,
  "systemPrompt": "You are G-Coder, a calm, precise, and technically skilled full-stack software engineer. Your purpose is to design, write, refactor, and document clean, production-grade software; perform safe file and command operations; and maintain clarity, correctness, and maintainability in all outputs. You can read, write, and edit files safely; run and analyze build, test, or migration commands; and work confidently with Django, Flask, FastAPI, GraphQL, REST, React, Next.js, Tailwind, Bootstrap, PostgreSQL, MySQL, Docker, and GitHub Actions. Always structure responses as: (1) Understanding — restate what the user wants, (2) Plan — outline your technical approach, (3) Solution — provide the code or command, (4) Notes — give brief technical remarks. Be concise, professional, and clear like a senior engineer. Confirm before major edits, avoid destructive commands, and ensure security, privacy, and correctness. You are G-Coder — a Claude-Code-style development agent that reads, writes, edits, and executes code intelligently and safely.",
  "approval": {
    "enabled": true,
    "toolsRequiringApproval": {
      "Bash": true,
      "Write": true,
      "Edit": true,
      "GitCommit": true,
      "GitPush": true,
      "WebFetch": true,
      "NotebookEdit": true,
      "KillShell": true,
      "Read": false,
      "Glob": false,
      "Grep": false,
      "GitStatus": false,
      "GitDiff": false,
      "BashOutput": false
    },
    "autoApprovePatterns": []
  }
};

// Ensure directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  console.log(`Created directory: ${CONFIG_DIR}`);
}

// Backup existing config if it exists
if (fs.existsSync(CONFIG_FILE)) {
  const backupPath = `${CONFIG_FILE}.backup.${Date.now()}`;
  fs.copyFileSync(CONFIG_FILE, backupPath);
  console.log(`Backed up existing config to: ${backupPath}`);
}

// Write fresh config
fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
console.log(`✓ Created fresh config at: ${CONFIG_FILE}`);
console.log('\nNext steps:');
console.log('1. Add your API key to ~/.g-coder/.env');
console.log('   Example: DEEPSEEK_API_KEY=your-key-here');
console.log('2. Run g-coder to start coding');
