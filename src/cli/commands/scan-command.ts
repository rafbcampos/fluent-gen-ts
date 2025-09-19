import chalk from "chalk";
import ora from "ora";
import { glob } from "glob";
import path from "node:path";
import { minimatch } from "minimatch";
import { isOk } from "../../core/result.js";
import type { ScanOptions } from "../types.js";
import { ConfigLoader } from "../config.js";
import { PluginService } from "../services/plugin-service.js";
import { GeneratorService } from "../services/generator-service.js";
import { FileService } from "../services/file-service.js";
import { InteractiveService } from "../services/interactive-service.js";
import { TypeExtractor } from "../../type-info/index.js";
import type { FluentGen } from "../../gen/index.js";

export class ScanCommand {
  private configLoader = new ConfigLoader();
  private pluginService = new PluginService();
  private generatorService = new GeneratorService();
  private fileService = new FileService();
  private interactiveService = new InteractiveService();

  async execute(pattern: string, options: ScanOptions = {}): Promise<void> {
    const spinner = ora(
      `Scanning for files matching ${chalk.cyan(pattern)}...`
    ).start();

    try {
      let files = await glob(pattern);

      if (options.exclude && options.exclude.length > 0) {
        files = files.filter((file) => {
          return !options.exclude!.some((excludePattern) =>
            minimatch(file, excludePattern)
          );
        });
      }

      if (files.length === 0) {
        spinner.fail(chalk.yellow("No files found matching pattern"));
        process.exit(0);
      }

      spinner.succeed(chalk.green(`Found ${files.length} file(s)`));

      const configResult = this.configLoader.load(options.config);
      if (!isOk(configResult)) {
        console.error(chalk.red("Failed to load configuration"));
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

      const generator = this.generatorService.createGenerator(
        config,
        pluginManager
      );

      const allTypes = await this.scanForTypes(files, options.types);

      if (allTypes.length === 0) {
        console.log(chalk.yellow("No types found to generate"));
        process.exit(0);
      }

      if (options.dryRun) {
        console.log(
          chalk.blue(`\n✓ Dry-run complete. Found ${allTypes.length} type(s):`)
        );
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
      spinner.fail(chalk.red("Unexpected error"));
      console.error(error);
      process.exit(1);
    }
  }

  private async scanForTypes(
    files: string[],
    typeFilter?: string
  ): Promise<Array<{ file: string; type: string }>> {
    const allTypes: Array<{ file: string; type: string }> = [];
    const filterList = typeFilter?.split(",").map((t) => t.trim());

    for (const file of files) {
      const scanSpinner = ora(`Scanning ${chalk.cyan(file)}...`).start();
      const extractor = new TypeExtractor();
      const scanResult = await extractor.scanFile(file);

      if (isOk(scanResult) && scanResult.value.length > 0) {
        scanSpinner.succeed(
          chalk.green(
            `  ✓ Found ${scanResult.value.length} type(s) in ${file}`
          )
        );

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
    options: ScanOptions
  ): Promise<void> {
    const selected = await this.interactiveService.selectTypes(allTypes);

    for (const { file, type } of selected) {
      const genSpinner = ora(
        `Generating builder for ${chalk.cyan(type)}...`
      ).start();
      const result = await generator.generateBuilder(file, type);

      if (isOk(result)) {
        if (options.output) {
          const outputPath = this.fileService.resolveOutputPath(options.output, {
            file: path.basename(file, ".ts"),
            type: type.toLowerCase(),
          });
          await this.fileService.writeOutput(outputPath, result.value);
          genSpinner.succeed(chalk.green(`✓ Generated ${outputPath}`));
        } else {
          genSpinner.succeed(chalk.green(`✓ Generated ${type}`));
          console.log(result.value);
        }
      } else {
        genSpinner.fail(chalk.red(`✗ Failed to generate ${type}`));
      }
    }
  }

  private async processAll(
    allTypes: Array<{ file: string; type: string }>,
    generator: FluentGen,
    options: ScanOptions
  ): Promise<void> {
    console.log(
      chalk.blue(`\nGenerating builders for ${allTypes.length} type(s)...`)
    );

    for (const { file, type } of allTypes) {
      const result = await generator.generateBuilder(file, type);

      if (isOk(result)) {
        if (options.output) {
          const outputPath = this.fileService.resolveOutputPath(options.output, {
            file: path.basename(file, ".ts"),
            type: type.toLowerCase(),
          });
          await this.fileService.writeOutput(outputPath, result.value);
          console.log(chalk.green(`✓ Generated ${outputPath}`));
        } else {
          console.log(chalk.green(`✓ Generated ${type}`));
        }
      } else {
        console.log(chalk.red(`✗ Failed to generate ${type}`));
      }
    }
  }
}