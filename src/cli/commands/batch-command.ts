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
    console.log(chalk.bold('\n━━━ Configuration Phase ━━━'));
    const configPath = options.config || 'default search path';
    console.log(chalk.gray(`Config: ${configPath}`));
    console.log();

    try {
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

      const allPluginPaths = this.pluginService.mergePluginPaths(options.plugins, config.plugins);

      let pluginManager = undefined;
      if (allPluginPaths.length > 0) {
        console.log(chalk.bold('\n━━━ Plugin Phase ━━━'));
        pluginManager = await this.pluginService.loadPlugins(allPluginPaths);
        console.log(chalk.green(`✔ Loaded ${allPluginPaths.length} plugin(s)`));
      }

      console.log(chalk.bold('\n━━━ Generation Phase ━━━'));
      const targetCount = config.targets ? config.targets.length : 0;
      console.log(chalk.gray(`Processing ${targetCount} target(s)...\n`));

      const generator = this.generatorService.createGenerator(config, pluginManager);

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

      console.log(chalk.bold('\n━━━ Summary ━━━'));
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
    } catch (error) {
      console.error(chalk.red('✖ Unexpected error'));
      console.error(error);
      process.exit(1);
    }
  }
}
