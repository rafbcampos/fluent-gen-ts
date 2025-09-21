/**
 * Template generation utilities for fluent builders
 * Generates code templates for builder files
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Resolves the path to the builder-utilities.ts file
 */
function getBuilderUtilitiesPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, 'builder-utilities.ts');
}

/**
 * Reads the builder-utilities.ts file content as a string
 * Throws an error if the file cannot be read
 */
function readBuilderUtilitiesContent(): string {
  try {
    const filePath = getBuilderUtilitiesPath();
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to read builder-utilities.ts: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generates the common.ts file template content
 * This template is used when generating multiple builder files
 * @returns The complete template string for common.ts
 */
export function getCommonFileTemplate(): string {
  const builderUtilitiesContent = readBuilderUtilitiesContent();

  return `/**
 * Common utilities for fluent builders
 */

${builderUtilitiesContent}`;
}

/**
 * Generates utility functions template for single file output
 * Removes export keywords for inline inclusion
 * @returns The template string for single file utilities
 */
export function getSingleFileUtilitiesTemplate(): string {
  const builderUtilitiesContent = readBuilderUtilitiesContent();

  // Remove export keywords for single file inclusion
  const processedContent = builderUtilitiesContent.replace(/^export /gm, '');

  return `
${processedContent}
`;
}
