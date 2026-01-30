#!/usr/bin/env node

import { Command } from 'commander';
import { Commands } from './commands.js';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { formatError } from '../core/utils/error-utils.js';

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
}

/**
 * Type guard to validate if an object conforms to PackageJson interface
 * @param obj - The object to validate
 * @returns True if obj is a valid PackageJson structure
 */
function isValidPackageJson(obj: unknown): obj is PackageJson {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const pkg = obj as Record<string, unknown>;

  return (
    (pkg.name === undefined || typeof pkg.name === 'string') &&
    (pkg.version === undefined || typeof pkg.version === 'string') &&
    (pkg.description === undefined || typeof pkg.description === 'string')
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Safely loads and parses package.json file
 * @returns Parsed PackageJson object or empty object if loading fails
 */
function loadPackageJson(): PackageJson {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
    const packageJsonRaw = JSON.parse(packageJsonContent);

    return isValidPackageJson(packageJsonRaw) ? packageJsonRaw : {};
  } catch {
    // Return default values if package.json cannot be read or parsed
    return {};
  }
}

const packageJson = loadPackageJson();

/**
 * Wraps command execution with consistent error handling
 * @param commandFn - The command function to execute
 * @returns A wrapped function that handles errors consistently
 */
function withErrorHandling<T extends readonly unknown[]>(
  commandFn: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await commandFn(...args);
    } catch (error) {
      console.error(chalk.red('Error:'), formatError(error));
      process.exit(1);
    }
  };
}

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
  .action(
    withErrorHandling(async (file, type, options) => {
      await commands.generate(file, type, options);
    }),
  );

program
  .command('batch')
  .description('Generate builders from configuration file')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-p, --plugins <paths...>', 'Path(s) to plugin files')
  .option('-d, --dry-run', 'Dry run without writing files')
  .option('--parallel', 'Generate builders in parallel')
  .action(
    withErrorHandling(async options => {
      await commands.batch(options);
    }),
  );

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
  .action(
    withErrorHandling(async (pattern, options) => {
      await commands.scan(pattern, options);
    }),
  );

program
  .command('init')
  .description('Initialize a configuration file')
  .option('--overwrite', 'Overwrite existing configuration')
  .action(
    withErrorHandling(async options => {
      await commands.init(options);
    }),
  );

program
  .command('setup-common')
  .description('Create a customizable common.ts utilities file')
  .option('-o, --output <path>', 'Output file path (default: ./common.ts)')
  .option('--overwrite', 'Overwrite existing file')
  .action(
    withErrorHandling(async options => {
      await commands.setupCommon(options);
    }),
  );

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
