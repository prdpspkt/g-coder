#!/usr/bin/env node

import { Command } from 'commander';
import { CLI } from './cli';
import { configManager } from './utils/config';
import { logger, LogLevel } from './utils/logger';
import { renderer } from './ui/renderer';
import { OllamaClient } from './ollama/client';

const program = new Command();

program
  .name('g-coder')
  .description('AI-powered CLI coding assistant powered by Ollama')
  .version('1.0.0');

program
  .command('start')
  .description('Start the interactive coding assistant')
  .option('-m, --model <model>', 'Ollama model to use')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    if (options.verbose) {
      logger.setLevel(LogLevel.DEBUG);
    }

    if (options.model) {
      configManager.set('model', options.model);
    }

    const cli = new CLI();
    await cli.start();
  });

program
  .command('config')
  .description('Manage configuration')
  .option('-s, --show', 'Show current configuration')
  .option('-r, --reset', 'Reset to default configuration')
  .option('-m, --model <model>', 'Set the default model')
  .option('-u, --url <url>', 'Set Ollama URL')
  .action((options) => {
    if (options.reset) {
      configManager.reset();
      console.log(renderer.renderSuccess('Configuration reset to defaults'));
      return;
    }

    if (options.model) {
      configManager.set('model', options.model);
      console.log(renderer.renderSuccess(`Model set to: ${options.model}`));
    }

    if (options.url) {
      configManager.set('ollamaUrl', options.url);
      console.log(renderer.renderSuccess(`Ollama URL set to: ${options.url}`));
    }

    if (options.show || (!options.model && !options.url)) {
      console.log(renderer.renderHeader('G-Coder Configuration'));
      const config = configManager.get();
      console.log(JSON.stringify(config, null, 2));
      console.log(`\nConfig file: ${configManager.getConfigPath()}`);
    }
  });

program
  .command('models')
  .description('List available Ollama models')
  .action(async () => {
    const config = configManager.get();
    const ollama = new OllamaClient(config.ollamaUrl);

    console.log(renderer.renderInfo('Fetching available models...'));

    const connected = await ollama.checkConnection();
    if (!connected) {
      console.log(renderer.renderError('Failed to connect to Ollama'));
      console.log(renderer.renderInfo('Make sure Ollama is running at ' + config.ollamaUrl));
      process.exit(1);
    }

    const models = await ollama.listModels();

    if (models.length === 0) {
      console.log(renderer.renderWarning('No models found'));
      console.log(renderer.renderInfo('Pull a model with: ollama pull <model-name>'));
    } else {
      console.log(renderer.renderHeader('Available Models'));
      models.forEach((model) => {
        const current = model === config.model ? chalk.green(' (current)') : '';
        console.log(`  • ${model}${current}`);
      });
    }
  });

program
  .command('test')
  .description('Test Ollama connection')
  .action(async () => {
    const config = configManager.get();
    console.log(renderer.renderInfo(`Testing connection to ${config.ollamaUrl}...`));

    const ollama = new OllamaClient(config.ollamaUrl);
    const connected = await ollama.checkConnection();

    if (connected) {
      console.log(renderer.renderSuccess('Successfully connected to Ollama'));
      const models = await ollama.listModels();
      console.log(renderer.renderInfo(`Found ${models.length} model(s)`));
    } else {
      console.log(renderer.renderError('Failed to connect to Ollama'));
      console.log(renderer.renderInfo('Make sure Ollama is running with: ollama serve'));
      process.exit(1);
    }
  });

// Default command: start
program.action(async () => {
  const cli = new CLI();
  await cli.start();
});

import chalk from 'chalk';

program.parse();
