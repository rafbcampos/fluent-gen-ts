import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import { isOk } from "../../core/result.js";
import type { GenerateOptions } from "../types.js";
import { ConfigLoader } from "../config.js";
import { PluginService } from "../services/plugin-service.js";
import { GeneratorService } from "../services/generator-service.js";

export class GenerateCommand {
  private configLoader = new ConfigLoader();
  private pluginService = new PluginService();
  private generatorService = new GeneratorService();

  async execute(
    file: string,
    typeName: string,
    options: GenerateOptions = {}
  ): Promise<void> {
    const spinner = ora("Loading configuration...").start();

    try {
      const configResult = this.configLoader.load(options.config);
      if (!isOk(configResult)) {
        spinner.fail(chalk.red("Failed to load configuration"));
        console.error(configResult.error);
        process.exit(1);
      }

      const config = configResult.value;

      const allPluginPaths = this.pluginService.mergePluginPaths(
        options.plugins,
        config.plugins
      );

      let pluginManager = undefined;
      if (allPluginPaths.length > 0) {
        spinner.text = "Loading plugins...";
        pluginManager = await this.pluginService.loadPlugins(allPluginPaths);
      }

      spinner.text = "Initializing generator...";

      const outputDir = options.output
        ? path.dirname(options.output)
        : undefined;
      const fileName = options.output
        ? path.basename(options.output)
        : `${typeName.toLowerCase()}.builder.ts`;

      const genOptions = this.generatorService.mergeGeneratorOptions(
        config,
        {
          ...(options.tsconfig !== undefined && { tsConfigPath: options.tsconfig }),
          ...(outputDir !== undefined && { outputDir }),
          ...(fileName !== undefined && { fileName }),
          ...(options.defaults !== undefined && { useDefaults: options.defaults }),
          ...(options.comments !== undefined && { addComments: options.comments }),
        },
        options.output
      );

      const generator = this.generatorService.createGenerator(
        config,
        pluginManager,
        genOptions
      );

      spinner.text = `Generating builder for ${chalk.cyan(typeName)}...`;

      const result = await generator.generateBuilder(file, typeName);

      if (!isOk(result)) {
        spinner.fail(chalk.red("Generation failed"));
        console.error(result.error);
        process.exit(1);
      }

      if (options.dryRun) {
        spinner.succeed(chalk.green("✓ Dry-run complete (no files written)"));
        console.log(chalk.gray("\nGenerated code preview:"));
        console.log(result.value);
        return;
      }

      if (options.output) {
        await generator.generateToFile(file, typeName, options.output);
        spinner.succeed(
          chalk.green(`✓ Generated builder at ${chalk.cyan(options.output)}`)
        );
      } else {
        spinner.succeed(chalk.green("✓ Generation complete"));
        console.log(result.value);
      }
    } catch (error) {
      spinner.fail(chalk.red("Unexpected error"));
      console.error(error);
      process.exit(1);
    }
  }
}