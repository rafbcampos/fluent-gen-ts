import chalk from 'chalk';
import ora from 'ora';
import { isOk } from '../../core/result.js';
import type { BatchOptions } from '../types.js';
import { ConfigLoader, type Config, type Target } from '../config.js';
import { PluginService } from '../services/plugin-service.js';
import { GeneratorService } from '../services/generator-service.js';
import { TaskRunner } from '../services/task-runner.js';
import type { PluginManager } from '../../core/plugin/index.js';

type ValidatedConfig = Config & { targets: Target[] };

/**
 * Handles batch generation of builders from configuration files.
 * Orchestrates configuration loading, plugin management, and task execution.
 */
export class BatchCommand {
  private configLoader = new ConfigLoader();
  private pluginService = new PluginService();
  private generatorService = new GeneratorService();
  private taskRunner = new TaskRunner();

  /**
   * Executes the batch generation command.
   * @param options - Command options including config path, plugins, dryRun, and parallel flags
   */
  async execute(options: BatchOptions = {}): Promise<void> {
    try {
      const config = this.loadAndValidateConfig(options);
      const pluginManager = await this.loadPluginsIfNeeded(options, config);
      const result = await this.runGeneration(options, config, pluginManager);
      this.printSummary(result);
    } catch (error) {
      this.handleError(error);
    }
  }

  private loadAndValidateConfig(options: BatchOptions): ValidatedConfig {
    this.printSectionHeader('Configuration Phase');
    const configPath = options.config || 'default search path';
    console.log(chalk.gray(`Config: ${configPath}`));
    console.log();

    const configResult = this.configLoader.load(options.config);
    if (!isOk(configResult)) {
      console.error(chalk.red('✖ Failed to load configuration'));
      console.error(configResult.error);
      process.exit(1);
    }

    const config = configResult.value;
    console.log(chalk.green('✔ Configuration loaded'));

    if (!config.targets || config.targets.length === 0) {
      console.error(chalk.red('✖ No targets found in configuration'));
      process.exit(1);
    }

    return config as ValidatedConfig;
  }

  private async loadPluginsIfNeeded(
    options: BatchOptions,
    config: ValidatedConfig,
  ): Promise<PluginManager | undefined> {
    const allPluginPaths = this.pluginService.mergePluginPaths(options.plugins, config.plugins);

    if (allPluginPaths.length === 0) {
      return undefined;
    }

    this.printSectionHeader('Plugin Phase');
    const pluginManager = await this.pluginService.loadPlugins(allPluginPaths);
    console.log(chalk.green(`✔ Loaded ${allPluginPaths.length} plugin(s)`));

    return pluginManager;
  }

  private async runGeneration(
    options: BatchOptions,
    config: ValidatedConfig,
    pluginManager: PluginManager | undefined,
  ): Promise<{ successCount: number; failCount: number; errors: string[] }> {
    this.printSectionHeader('Generation Phase');
    console.log(chalk.gray(`Processing ${config.targets.length} target(s)...\n`));

    const generator = this.generatorService.createGenerator({
      config,
      ...(pluginManager && { pluginManager }),
    });
    const spinner = ora();
    const tasks = this.taskRunner.createTasksFromTargets(config.targets);

    const result = await this.taskRunner.runTasks(tasks, generator, {
      ...(options.parallel !== undefined && { parallel: options.parallel }),
      ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
      generateCommonFile: config.generator?.generateCommonFile ?? true,
      ...(config.generator && { generatorConfig: config.generator }),
      onProgress: message => {
        spinner.start(message);
      },
    });

    spinner.stop();
    return result;
  }

  private printSummary(result: {
    successCount: number;
    failCount: number;
    errors: string[];
  }): void {
    this.printSectionHeader('Summary');
    console.log(
      chalk.green(
        `✔ Batch generation complete: ${result.successCount} succeeded, ${result.failCount} failed`,
      ),
    );

    if (result.errors.length > 0) {
      console.log(chalk.bold('\nErrors:'));
      result.errors.forEach(error => {
        console.error(chalk.yellow(`  ⚠ ${error}`));
      });
    }
  }

  private printSectionHeader(title: string): void {
    console.log(chalk.bold(`\n━━━ ${title} ━━━`));
  }

  private handleError(error: unknown): never {
    console.error(chalk.red('✖ Unexpected error'));
    console.error(error);
    process.exit(1);
  }
}
