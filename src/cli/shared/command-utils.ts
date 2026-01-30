/**
 * Shared utilities for CLI commands
 * Provides common patterns for error handling, file operations, and console output
 */

import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { formatError } from '../../core/utils/error-utils.js';

/**
 * Options for file existence checking
 */
export interface FileExistenceOptions {
  /** The file path to check */
  filePath: string;
  /** Whether to allow overwriting existing files */
  overwrite?: boolean;
  /** Custom error message for existing files */
  existsMessage?: string;
}

/**
 * Result of path validation
 */
export interface PathValidationResult {
  /** The validated and normalized path */
  outputPath: string;
  /** The absolute path */
  absolutePath: string;
}

/**
 * Shared command utilities for consistent error handling and file operations
 */
export class CommandUtils {
  /**
   * Validates and normalizes an output path
   * @param output - The output path from options
   * @param defaultPath - The default path to use if output is empty
   * @returns The validated path information
   * @throws Error if the path is invalid
   */
  static validateOutputPath(output?: string, defaultPath = './common.ts'): PathValidationResult {
    // Handle undefined, null, or empty string
    let outputPath: string;
    if (!output || output.trim() === '') {
      outputPath = defaultPath;
    } else {
      outputPath = output.trim();
    }

    // Basic validation for obviously invalid paths
    if (outputPath.includes('\0')) {
      throw new Error('Invalid path: null characters are not allowed');
    }

    // Validate that it's not just a directory (should have a filename)
    const basename = path.basename(outputPath);
    if (!basename || basename === '.' || basename === '..') {
      throw new Error('Invalid path: must specify a filename, not just a directory');
    }

    const absolutePath = path.resolve(outputPath);

    return { outputPath, absolutePath };
  }

  /**
   * Checks if a file exists and handles overwrite logic
   * @param options - File existence checking options
   * @throws Error if file exists and overwrite is not allowed
   */
  static checkFileExistence(options: FileExistenceOptions): void {
    const { filePath, overwrite = false, existsMessage } = options;
    const absolutePath = path.resolve(filePath);

    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);

      // Check if it's a directory
      if (stats.isDirectory()) {
        throw new Error('Invalid path: must specify a filename, not just a directory');
      }

      // Check if file exists and overwrite is not allowed
      if (!overwrite) {
        const message =
          existsMessage || `File ${filePath} already exists. Use --overwrite to replace it.`;
        console.error(chalk.red(`\n${message}`));
        console.log(chalk.gray('Use --overwrite to replace it.'));
        throw new Error(message);
      }
    }
  }

  /**
   * Handles command errors consistently across all commands
   * @param error - The error that occurred
   * @param context - Context about where the error occurred
   * @throws Error with a formatted message
   */
  static handleCommandError(error: unknown, context: string): never {
    const errorMessage = formatError(error);
    console.error(chalk.red(`\n✗ ${context}:`), errorMessage);
    throw new Error(`${context}: ${errorMessage}`);
  }

  /**
   * Logs a success message with consistent formatting
   * @param message - The success message to display
   * @param details - Optional additional details
   */
  static logSuccess(message: string, details?: string): void {
    console.log(chalk.green(`\n✓ ${message}`));
    if (details) {
      console.log(chalk.gray(details));
    }
  }

  /**
   * Logs informational steps with consistent formatting
   * @param title - The step title
   * @param steps - Array of step descriptions
   */
  static logNextSteps(title: string, steps: string[]): void {
    console.log(chalk.blue(`\n${title}`));
    steps.forEach((step, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${step}`));
    });
  }

  /**
   * Ensures a directory exists, creating it if necessary
   * @param dirPath - The directory path to ensure exists
   */
  static ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
