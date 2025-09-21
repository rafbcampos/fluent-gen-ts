#!/usr/bin/env node

import { Command } from 'commander';
import { Commands } from './commands.js';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
}

function isValidPackageJson(obj: unknown): obj is PackageJson {
  return typeof obj === 'object' && obj !== null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonRaw = JSON.parse(
  readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
);

const packageJson: PackageJson = isValidPackageJson(packageJsonRaw) ? packageJsonRaw : {};

const program = new Command();
const commands = new Commands();

program
  .name('fluent-gen')
  .description(packageJson.description || 'TypeScript type extraction system')
  .version(packageJson.version || '0.0.1');

program
  .command('generate')
  .alias('gen')
  .description('Generate a fluent builder for a specific type')
  .argument('<file>', 'Path to the TypeScript file')
  .argument('<type>', 'Name of the interface or type to generate')
  .option('-o, --output <path>', 'Output file path')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('-p, --plugins <paths...>', 'Path(s) to plugin files')
  .option('-d, --defaults', 'Use default values for optional properties')
  .option('--dry-run', 'Preview what would be generated without writing files')
  .option('--no-comments', "Don't include JSDoc comments in generated code")
  .action(async (file, type, options) => {
    try {
      await commands.generate(file, type, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Generate builders from configuration file')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --plugins <paths...>', 'Path(s) to plugin files')
  .option('-d, --dry-run', 'Dry run without writing files')
  .option('--parallel', 'Generate builders in parallel')
  .action(async options => {
    try {
      await commands.batch(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('Scan files for interfaces and types')
  .argument('<pattern>', 'Glob pattern to match files')
  .option('-o, --output <pattern>', 'Output file pattern (use {file} and {type} placeholders)')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --plugins <paths...>', 'Path(s) to plugin files')
  .option('-e, --exclude <patterns...>', 'Patterns to exclude from scanning')
  .option('-t, --types <types>', 'Comma-separated list of type names to include')
  .option('-i, --interactive', 'Interactive mode to select types')
  .option('--dry-run', 'Preview discovered types without generating')
  .option('--ignore-private', 'Ignore non-exported interfaces')
  .action(async (pattern, options) => {
    try {
      await commands.scan(pattern, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a configuration file')
  .option('--overwrite', 'Overwrite existing configuration')
  .action(async options => {
    try {
      await commands.init(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
