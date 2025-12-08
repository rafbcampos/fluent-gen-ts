import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import path from 'node:path';
import { minimatch } from 'minimatch';
import { isOk } from '../../core/result.js';
import type { ScanOptions } from '../types.js';
import { TypeExtractor } from '../../type-info/index.js';
import type { FluentGen } from '../../gen/index.js';
import type { PluginManager } from '../../core/plugin/plugin-manager.js';
import { createScanCommandServices, type ScanCommandServices } from '../shared/command-services.js';

/**
 * Error thrown when scan command execution fails.
 */
export class ScanCommandError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ScanCommandError';
  }
}

/**
 * Command for scanning files and generating builders for TypeScript types
 *
 * Handles file scanning with glob patterns, type extraction, plugin loading,
 * and builder generation with support for interactive selection and various output options.
 */
export class ScanCommand {
  private readonly services: ScanCommandServices;

  constructor(services?: ScanCommandServices) {
    this.services = services ?? createScanCommandServices();
  }

  /**
   * Execute the scan command with the given pattern and options
   *
   * @param pattern - Glob pattern to match files (e.g., "src/*.ts")
   * @param options - Scan options including exclusions, output settings, and mode
   * @throws {Error} When configuration loading fails or other critical errors occur
   *
   * @example
   * ```typescript
   * const command = new ScanCommand();
   * await command.execute("src/*.ts", {
   *   exclude: ["*.test.ts"],
   *   output: "./generated",
   *   interactive: true
   * });
   * ```
   */
  async execute(pattern: string, options: ScanOptions = {}): Promise<void> {
    const spinner = ora(`Scanning for files matching ${chalk.cyan(pattern)}...`).start();
    const { configLoader, pluginService, generatorService } = this.services;

    try {
      let files = await glob(pattern);

      if (options.exclude && options.exclude.length > 0) {
        files = files.filter(file => {
          return !options.exclude!.some(excludePattern => minimatch(file, excludePattern));
        });
      }

      if (files.length === 0) {
        spinner.fail(chalk.yellow('No files found matching pattern'));
        return;
      }

      spinner.succeed(chalk.green(`Found ${files.length} file(s)`));

      const configResult = await configLoader.load(options.config);
      if (!isOk(configResult)) {
        spinner.fail(chalk.red('Failed to load configuration'));
        throw new ScanCommandError('Failed to load configuration', configResult.error);
      }

      const config = configResult.value;

      const allPluginPaths = pluginService.mergePluginPaths(options.plugins, config.plugins);

      let pluginManager: PluginManager | undefined = undefined;
      if (allPluginPaths.length > 0) {
        spinner.text = 'Loading plugins...';
        pluginManager = await pluginService.loadPlugins(allPluginPaths);
      }

      const generator = generatorService.createGenerator({
        config,
        ...(pluginManager && { pluginManager }),
      });

      const allTypes = await this.scanForTypes(files, options.types);

      if (allTypes.length === 0) {
        console.log(chalk.yellow('No types found to generate'));
        return;
      }

      if (options.dryRun) {
        console.log(chalk.blue(`\n✓ Dry-run complete. Found ${allTypes.length} type(s):`));
        allTypes.forEach(({ file, type }) => {
          console.log(chalk.gray(`  ${type} (${file})`));
        });
        return;
      }

      if (options.interactive) {
        await this.processInteractive(allTypes, generator, options);
      } else {
        await this.processAll(allTypes, generator, options);
      }
    } catch (error) {
      spinner.fail(chalk.red('Unexpected error'));
      console.error(error);
      if (error instanceof ScanCommandError) {
        throw error;
      }
      throw new ScanCommandError('Unexpected error during scan', error);
    }
  }

  private async handleGenerationOutput(
    file: string,
    type: string,
    generatedCode: string,
    options: ScanOptions,
  ): Promise<string> {
    const { fileService } = this.services;

    if (options.output) {
      const outputPath = fileService.resolveOutputPath(options.output, {
        file: path.basename(file, '.ts'),
        type: type.toLowerCase(),
      });
      await fileService.writeOutput(outputPath, generatedCode);
      return outputPath;
    } else {
      console.log(generatedCode);
      return type;
    }
  }

  private async scanForTypes(
    files: string[],
    typeFilter?: string,
  ): Promise<Array<{ file: string; type: string }>> {
    const allTypes: Array<{ file: string; type: string }> = [];
    const filterList = typeFilter?.split(',').map(t => t.trim());
    const extractor = new TypeExtractor();

    for (const file of files) {
      const scanSpinner = ora(`Scanning ${chalk.cyan(file)}...`).start();
      const scanResult = await extractor.scanFile(file);

      if (isOk(scanResult) && scanResult.value.length > 0) {
        scanSpinner.succeed(chalk.green(`  ✓ Found ${scanResult.value.length} type(s) in ${file}`));

        for (const type of scanResult.value) {
          if (!filterList || filterList.includes(type)) {
            allTypes.push({ file, type });
            console.log(chalk.gray(`    - ${type}`));
          }
        }
      } else {
        scanSpinner.info(chalk.gray(`  ○ No types found in ${file}`));
      }
    }

    return allTypes;
  }

  private async processInteractive(
    allTypes: Array<{ file: string; type: string }>,
    generator: FluentGen,
    options: ScanOptions,
  ): Promise<void> {
    const { interactiveService } = this.services;
    const selected = await interactiveService.selectTypes(allTypes);

    for (const { file, type } of selected) {
      const genSpinner = ora(`Generating builder for ${chalk.cyan(type)}...`).start();
      const result = await generator.generateBuilder(file, type);

      if (isOk(result)) {
        const output = await this.handleGenerationOutput(file, type, result.value, options);
        genSpinner.succeed(chalk.green(`✓ Generated ${output}`));
      } else {
        genSpinner.fail(chalk.red(`✗ Failed to generate ${type}`));
      }
    }
  }

  private async processAll(
    allTypes: Array<{ file: string; type: string }>,
    generator: FluentGen,
    options: ScanOptions,
  ): Promise<void> {
    console.log(chalk.blue(`\nGenerating builders for ${allTypes.length} type(s)...`));

    for (const { file, type } of allTypes) {
      const result = await generator.generateBuilder(file, type);

      if (isOk(result)) {
        const output = await this.handleGenerationOutput(file, type, result.value, options);
        console.log(chalk.green(`✓ Generated ${output}`));
      } else {
        console.log(chalk.red(`✗ Failed to generate ${type}`));
      }
    }
  }
}
