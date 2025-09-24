import chalk from 'chalk';
import ora from 'ora';
import { isOk } from '../../core/result.js';
import type { BatchOptions } from '../types.js';
import { ConfigLoader } from '../config.js';
import { PluginService } from '../services/plugin-service.js';
import { GeneratorService } from '../services/generator-service.js';
import { TaskRunner } from '../services/task-runner.js';

export class BatchCommand {
  private configLoader = new ConfigLoader();
  private pluginService = new PluginService();
  private generatorService = new GeneratorService();
  private taskRunner = new TaskRunner();

  async execute(options: BatchOptions = {}): Promise<void> {
    const spinner = ora('Loading configuration...').start();

    try {
      const configResult = this.configLoader.load(options.config);
      if (!isOk(configResult)) {
        spinner.fail(chalk.red('Failed to load configuration'));
        console.error(configResult.error);
        process.exit(1);
      }

      const config = configResult.value;

      if (!config.targets || config.targets.length === 0) {
        spinner.fail(chalk.red('No targets found in configuration'));
        process.exit(1);
      }

      const allPluginPaths = this.pluginService.mergePluginPaths(options.plugins, config.plugins);

      let pluginManager = undefined;
      if (allPluginPaths.length > 0) {
        spinner.text = 'Loading plugins...';
        pluginManager = await this.pluginService.loadPlugins(allPluginPaths);
      }

      spinner.text = 'Processing targets...';

      const generator = this.generatorService.createGenerator(config, pluginManager);

      const tasks = this.taskRunner.createTasksFromTargets(config.targets);

      const result = await this.taskRunner.runTasks(tasks, generator, {
        ...(options.parallel !== undefined && { parallel: options.parallel }),
        ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
        generateCommonFile: config.generator?.generateCommonFile ?? true,
        ...(config.generator && { generatorConfig: config.generator }),
        onProgress: message => {
          spinner.text = message;
        },
      });

      spinner.succeed(
        chalk.green(
          `✓ Batch generation complete: ${result.successCount} succeeded, ${result.failCount} failed`,
        ),
      );
    } catch (error) {
      spinner.fail(chalk.red('Unexpected error'));
      console.error(error);
      process.exit(1);
    }
  }
}
