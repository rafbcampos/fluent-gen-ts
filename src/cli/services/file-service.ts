import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import type { Config } from '../config.js';

type ConfigFormat = 'js' | 'cjs' | 'json';

const CONFIG_FILE_NAMES = {
  json: '.fluentgenrc.json',
  js: 'fluentgen.config.js',
  cjs: 'fluentgen.config.cjs',
  yaml: '.fluentgenrc.yaml',
  yml: '.fluentgenrc.yml',
  jsLegacy: '.fluentgenrc.js',
  cjsLegacy: '.fluentgenrc.cjs',
} as const;

/**
 * Service for file and directory operations including writing outputs,
 * configuration file management, and path resolution.
 *
 * Provides utilities for:
 * - Writing generated content to files
 * - Managing configuration files in different formats
 * - Resolving template-based output paths
 * - File and directory existence checks
 */
export class FileService {
  /**
   * Writes content to a file, creating directories as needed.
   *
   * @param outputPath - The absolute path where the file should be written
   * @param content - The content to write to the file
   * @throws {Error} When the file cannot be written or directories cannot be created
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * await fileService.writeOutput('/path/to/output.ts', 'export const example = true;');
   * ```
   */
  async writeOutput(outputPath: string, content: string): Promise<void> {
    const dir = path.dirname(outputPath);
    await mkdir(dir, { recursive: true });
    await writeFile(outputPath, content, 'utf-8');
  }

  /**
   * Writes multiple files in parallel from a map of paths to content.
   *
   * @param outputs - Map where keys are file paths and values are file contents
   * @throws {Error} When any file cannot be written
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * const outputs = new Map([
   *   ['/path/to/file1.ts', 'export const file1 = true;'],
   *   ['/path/to/file2.ts', 'export const file2 = true;']
   * ]);
   * await fileService.writeOutputBatch(outputs);
   * ```
   */
  async writeOutputBatch(outputs: Map<string, string>): Promise<void> {
    const writePromises = Array.from(outputs.entries()).map(([outputPath, content]) =>
      this.writeOutput(outputPath, content),
    );
    await Promise.all(writePromises);
  }

  /**
   * Checks if a file exists at the given path.
   *
   * @param filePath - The path to check for file existence
   * @returns True if the file exists, false otherwise
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * if (fileService.fileExists('./config.json')) {
   *   console.log('Config file found');
   * }
   * ```
   */
  fileExists(filePath: string): boolean {
    return existsSync(filePath);
  }

  /**
   * Checks if a directory exists at the given path.
   *
   * @param dirPath - The path to check for directory existence
   * @returns True if the directory exists, false otherwise
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * if (fileService.directoryExists('./src')) {
   *   console.log('Source directory found');
   * }
   * ```
   */
  directoryExists(dirPath: string): boolean {
    return existsSync(dirPath);
  }

  /**
   * Resolves a template path by replacing placeholder variables with actual values.
   *
   * Template variables are specified in the format `{key}` and will be replaced
   * with the corresponding value from the replacements object. All occurrences
   * of each variable are replaced.
   *
   * @param template - The template string containing placeholder variables
   * @param replacements - Object mapping variable names to their replacement values
   * @returns The resolved path with all variables replaced
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * const result = fileService.resolveOutputPath(
   *   'output/{type}/{name}.ts',
   *   { type: 'interfaces', name: 'User' }
   * );
   * // Returns: 'output/interfaces/User.ts'
   * ```
   */
  resolveOutputPath(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replaceAll(`{${key}}`, value);
    }
    return result;
  }

  /**
   * Writes a configuration object to a file in the specified format.
   *
   * Supports writing configuration files in JSON, JavaScript (ES modules), and
   * CommonJS formats. YAML formats are not supported for writing.
   *
   * @param configPath - The path where the config file should be written
   * @param config - The configuration object to write
   * @param format - The format to write the config in ('json', 'js', or 'cjs')
   * @throws {Error} When the file cannot be written
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * const config = { outputDir: './dist', useDefaults: true };
   * fileService.writeConfigFile('./fluentgen.config.js', config, 'js');
   * ```
   */
  writeConfigFile(configPath: string, config: Config, format: ConfigFormat): void {
    let content: string;

    switch (format) {
      case 'js':
      case 'cjs':
        content = `module.exports = ${JSON.stringify(config, null, 2)};\n`;
        break;
      default:
        content = JSON.stringify(config, null, 2);
    }

    writeFileSync(configPath, content);
  }

  /**
   * Gets the appropriate config file name for the specified format.
   *
   * Returns the conventional file name for configuration files in different
   * formats. Defaults to JSON format if no format is specified.
   *
   * @param format - The config format ('json', 'js', or 'cjs')
   * @returns The appropriate file name for the specified format
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * const fileName = fileService.getConfigFileName('js');
   * // Returns: 'fluentgen.config.js'
   * ```
   */
  getConfigFileName(format?: ConfigFormat): string {
    switch (format) {
      case 'js':
        return CONFIG_FILE_NAMES.js;
      case 'cjs':
        return CONFIG_FILE_NAMES.cjs;
      case 'json':
      default:
        return CONFIG_FILE_NAMES.json;
    }
  }

  /**
   * Searches for an existing configuration file in the current directory.
   *
   * Looks for configuration files in various formats including JSON, YAML,
   * JavaScript, and CommonJS. Returns the first file found based on a
   * predefined priority order.
   *
   * @returns The path to the first existing config file, or undefined if none found
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * const configPath = fileService.findExistingConfig();
   * if (configPath) {
   *   console.log(`Found config: ${configPath}`);
   * }
   * ```
   */
  findExistingConfig(): string | undefined {
    const configFiles = [
      CONFIG_FILE_NAMES.json,
      CONFIG_FILE_NAMES.yaml,
      CONFIG_FILE_NAMES.yml,
      CONFIG_FILE_NAMES.jsLegacy,
      CONFIG_FILE_NAMES.cjsLegacy,
      CONFIG_FILE_NAMES.js,
      CONFIG_FILE_NAMES.cjs,
    ];

    return configFiles.find(file => this.fileExists(file));
  }

  /**
   * Validates that a TypeScript configuration file exists.
   *
   * Returns true if the path is empty/falsy (indicating no custom tsconfig)
   * or if the specified file exists.
   *
   * @param tsConfigPath - The path to the TypeScript config file to validate
   * @returns True if path is empty or file exists, false if file doesn't exist
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * const isValid = fileService.validateTsConfigPath('./tsconfig.json');
   * if (!isValid) {
   *   console.error('TypeScript config file not found');
   * }
   * ```
   */
  validateTsConfigPath(tsConfigPath: string): boolean {
    if (!tsConfigPath) return true;
    return this.fileExists(tsConfigPath);
  }

  /**
   * Extracts a type name from an output file path.
   *
   * Takes the base filename (without .ts extension), splits on dots,
   * and returns the first part as the type name. Useful for deriving
   * type names from file paths.
   *
   * @param outputPath - The output file path to extract the type name from
   * @returns The extracted type name
   *
   * @example
   * ```typescript
   * const fileService = new FileService();
   * const typeName = fileService.extractTypeName('./output/User.builder.ts');
   * // Returns: 'User'
   * ```
   */
  extractTypeName(outputPath: string): string {
    const baseName = path.basename(outputPath, '.ts');
    const parts = baseName.split('.');
    return parts[0] || baseName;
  }
}
