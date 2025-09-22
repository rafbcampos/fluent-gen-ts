/**
 * Template generation utilities for fluent builders
 * Generates code templates for builder files
 */

import { BUILDER_UTILITIES_CONTENT } from './builder-utilities-content.js';

/**
 * Generates the common.ts file template content
 * This template is used when generating multiple builder files
 * @returns The complete template string for common.ts
 */
export function getCommonFileTemplate(): string {
  return `/**
 * Common utilities for fluent builders
 */

${BUILDER_UTILITIES_CONTENT}`;
}

/**
 * Generates utility functions template for single file output
 * Removes export keywords for inline inclusion
 * @returns The template string for single file utilities
 */
export function getSingleFileUtilitiesTemplate(): string {
  // Remove export keywords for single file inclusion
  const processedContent = BUILDER_UTILITIES_CONTENT.replace(/^export /gm, '');

  return `
${processedContent}
`;
}
