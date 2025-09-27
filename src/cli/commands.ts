import type {
  BatchOptions,
  GenerateOptions,
  InitOptions,
  ScanOptions,
  SetupCommonOptions,
} from './types.js';
import { GenerateCommand } from './commands/generate-command.js';
import { BatchCommand } from './commands/batch-command.js';
import { ScanCommand } from './commands/scan-command.js';
import { InitCommand } from './commands/init-command.js';
import { SetupCommonCommand } from './commands/setup-common-command.js';

/**
 * Facade class providing a unified interface to all CLI commands.
 * Delegates command execution to specialized command classes while maintaining a simple API.
 *
 * @example
 * ```ts
 * const commands = new Commands();
 * await commands.generate('./types.ts', 'UserType', { output: './builders.ts' });
 * ```
 */
export class Commands {
  private generateCommand = new GenerateCommand();
  private batchCommand = new BatchCommand();
  private scanCommand = new ScanCommand();
  private initCommand = new InitCommand();
  private setupCommonCommand = new SetupCommonCommand();

  /**
   * Generates a fluent builder for a specific TypeScript type.
   *
   * @param file - Path to the TypeScript file containing the target type
   * @param typeName - Name of the type to generate a builder for
   * @param options - Generation options
   * @param options.output - Output file path. If provided and not in dry-run mode, writes to file. Otherwise prints to console.
   * @param options.config - Path to configuration file
   * @param options.tsconfig - Path to tsconfig.json
   * @param options.plugins - Array of plugin paths to load
   * @param options.defaults - Whether to include default values in the builder
   * @param options.comments - Whether to add comments to generated code
   * @param options.dryRun - If true, generates code but does not write to file
   *
   * @throws {Error} If configuration loading or builder generation fails
   *
   * @example
   * ```ts
   * // Generate builder and print to console
   * await commands.generate('./user.ts', 'User');
   *
   * // Generate builder and save to file
   * await commands.generate('./user.ts', 'User', { output: './user-builder.ts' });
   * ```
   */
  async generate(file: string, typeName: string, options: GenerateOptions = {}): Promise<void> {
    return this.generateCommand.execute(file, typeName, options);
  }

  /**
   * Executes batch generation of builders based on configuration file targets.
   *
   * @param options - Batch generation options
   * @param options.config - Path to configuration file containing targets
   * @param options.plugins - Array of plugin paths to load
   * @param options.dryRun - If true, generates code but does not write files
   * @param options.parallel - Whether to run generation tasks in parallel
   *
   * @throws {Error} If configuration loading fails or no targets are found
   *
   * @example
   * ```ts
   * // Run batch generation with default config
   * await commands.batch();
   *
   * // Run batch generation in parallel with custom config
   * await commands.batch({ config: './custom-config.json', parallel: true });
   * ```
   */
  async batch(options: BatchOptions = {}): Promise<void> {
    return this.batchCommand.execute(options);
  }

  /**
   * Scans TypeScript files for types matching a pattern and generates builders.
   *
   * @param pattern - Glob pattern to match TypeScript files
   * @param options - Scan options
   * @param options.output - Output directory for generated files
   * @param options.config - Path to configuration file
   * @param options.plugins - Array of plugin paths to load
   * @param options.exclude - Array of patterns to exclude from scanning
   * @param options.types - Comma-separated list of specific type names to scan for
   * @param options.interactive - Whether to prompt for confirmation before generating
   * @param options.dryRun - If true, scans and reports but does not generate files
   * @param options.ignorePrivate - Whether to ignore private/internal types
   *
   * @throws {Error} If pattern matching or generation fails
   *
   * @example
   * ```ts
   * // Scan all TypeScript files in src directory
   * await commands.scan('src/**\\/*.ts');
   *
   * // Scan with specific output directory and exclusions
   * await commands.scan('src/**\\/*.ts', {
   *   output: './generated',
   *   exclude: ['**\\/*.test.ts', '**\\/*.spec.ts']
   * });
   * ```
   */
  async scan(pattern: string, options: ScanOptions = {}): Promise<void> {
    return this.scanCommand.execute(pattern, options);
  }

  /**
   * Initializes a new project configuration file.
   *
   * @param options - Initialization options
   * @param options.overwrite - Whether to overwrite existing configuration files
   *
   * @throws {Error} If configuration file creation fails
   *
   * @example
   * ```ts
   * // Initialize with default settings
   * await commands.init();
   *
   * // Initialize and overwrite existing config
   * await commands.init({ overwrite: true });
   * ```
   */
  async init(options: InitOptions = {}): Promise<void> {
    return this.initCommand.execute(options);
  }

  /**
   * Sets up common utility functions and types for generated builders.
   *
   * @param options - Setup options
   * @param options.output - Output directory for common files
   * @param options.overwrite - Whether to overwrite existing common files
   *
   * @throws {Error} If common file generation fails
   *
   * @example
   * ```ts
   * // Setup common files in default location
   * await commands.setupCommon();
   *
   * // Setup common files in custom directory
   * await commands.setupCommon({ output: './src/builders/common' });
   * ```
   */
  async setupCommon(options: SetupCommonOptions = {}): Promise<void> {
    return this.setupCommonCommand.execute(options);
  }
}
