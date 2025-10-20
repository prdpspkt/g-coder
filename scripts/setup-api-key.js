#!/usr/bin/env node
/**
 * Interactive script to set up API keys for g-coder
 * Usage: node scripts/setup-api-key.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CONFIG_DIR = path.join(os.homedir(), '.g-coder');
const ENV_FILE = path.join(CONFIG_DIR, '.env');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔧 G-Coder API Key Setup\n');

  // Ensure directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    console.log(`✓ Created directory: ${CONFIG_DIR}\n`);
  }

  console.log('Select your AI provider:');
  console.log('  1. DeepSeek (deepseek-chat, deepseek-coder)');
  console.log('  2. OpenAI (GPT-4, GPT-3.5)');
  console.log('  3. Anthropic (Claude)');
  console.log('  4. Ollama (Local, no API key needed)\n');

  const choice = await question('Enter choice (1-4): ');

  let provider, keyName, apiKey;

  switch (choice.trim()) {
    case '1':
      provider = 'deepseek';
      keyName = 'DEEPSEEK_API_KEY';
      console.log('\nGet your DeepSeek API key from: https://platform.deepseek.com/');
      apiKey = await question('Enter your DeepSeek API key: ');
      break;

    case '2':
      provider = 'openai';
      keyName = 'OPENAI_API_KEY';
      console.log('\nGet your OpenAI API key from: https://platform.openai.com/api-keys');
      apiKey = await question('Enter your OpenAI API key: ');
      break;

    case '3':
      provider = 'anthropic';
      keyName = 'ANTHROPIC_API_KEY';
      console.log('\nGet your Anthropic API key from: https://console.anthropic.com/');
      apiKey = await question('Enter your Anthropic API key: ');
      break;

    case '4':
      provider = 'ollama';
      console.log('\n✓ Ollama uses local models, no API key needed.');
      console.log('Make sure Ollama is running: ollama serve');
      console.log('\nUpdate your config.json:');
      console.log(`  "provider": "ollama",`);
      console.log(`  "model": "codellama",`);
      rl.close();
      return;

    default:
      console.log('\n❌ Invalid choice');
      rl.close();
      return;
  }

  if (!apiKey || apiKey.trim().length === 0) {
    console.log('\n❌ No API key provided');
    rl.close();
    return;
  }

  // Read existing .env file
  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  }

  // Update or add the key
  const lines = envContent.split('\n');
  const keyIndex = lines.findIndex(line => line.startsWith(`${keyName}=`));

  if (keyIndex >= 0) {
    lines[keyIndex] = `${keyName}=${apiKey.trim()}`;
    console.log(`\n✓ Updated existing ${keyName}`);
  } else {
    lines.push(`${keyName}=${apiKey.trim()}`);
    console.log(`\n✓ Added ${keyName}`);
  }

  // Write back to file
  fs.writeFileSync(ENV_FILE, lines.join('\n'));
  console.log(`✓ Saved to: ${ENV_FILE}\n`);

  // Check config.json
  const configFile = path.join(CONFIG_DIR, 'config.json');
  if (fs.existsSync(configFile)) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    if (config.provider !== provider) {
      console.log(`⚠️  Your config.json has provider: "${config.provider}"`);
      console.log(`   Update it to "${provider}" to use this API key\n`);
    }
  }

  console.log('✅ Setup complete! Run g-coder to start coding.\n');
  rl.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
