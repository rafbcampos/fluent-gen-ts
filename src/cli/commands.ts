import { FluentGen, type FluentGenOptions } from "../gen/index.js";
import { ConfigLoader } from "./config.js";
import { isOk } from "../core/result.js";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { glob } from "glob";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

export interface GenerateOptions {
  output?: string;
  config?: string;
  tsconfig?: string;
  defaults?: boolean;
  comments?: boolean;
}

export interface BatchOptions {
  config?: string;
  dry?: boolean;
}

export interface ScanOptions {
  output?: string;
  config?: string;
  interactive?: boolean;
}

interface CommandOptions {
  tsConfigPath?: string;
  outputDir?: string;
  fileName?: string;
  useDefaults?: boolean;
  addComments?: boolean;
  contextType?: string;
  importPath?: string;
  indentSize?: number;
  useTab?: boolean;
}

export class Commands {
  private configLoader = new ConfigLoader();

  private buildFluentGenOptions(
    options: CommandOptions,
  ): Partial<FluentGenOptions> {
    const result: Partial<FluentGenOptions> = {};

    if (options.tsConfigPath !== undefined)
      result.tsConfigPath = options.tsConfigPath;
    if (options.outputDir !== undefined) result.outputDir = options.outputDir;
    if (options.fileName !== undefined) result.fileName = options.fileName;
    if (options.useDefaults !== undefined)
      result.useDefaults = options.useDefaults;
    if (options.addComments !== undefined)
      result.addComments = options.addComments;
    if (options.contextType !== undefined)
      result.contextType = options.contextType;
    if (options.indentSize !== undefined)
      result.indentSize = options.indentSize;
    if (options.useTab !== undefined) result.useTab = options.useTab;

    return result;
  }

  async generate(
    file: string,
    typeName: string,
    options: GenerateOptions = {},
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

      spinner.text = "Initializing generator...";

      const outputDir = options.output
        ? path.dirname(options.output)
        : undefined;
      const fileName = options.output
        ? path.basename(options.output)
        : `${typeName.toLowerCase()}.builder.ts`;
      const tsConfigPath = options.tsconfig ?? config.tsConfigPath;

      const baseOptions: CommandOptions = {};
      if (config.generator?.outputDir !== undefined)
        baseOptions.outputDir = config.generator.outputDir;
      if (config.generator?.useDefaults !== undefined)
        baseOptions.useDefaults = config.generator.useDefaults;
      if (config.generator?.contextType !== undefined)
        baseOptions.contextType = config.generator.contextType;
      if (config.generator?.importPath !== undefined)
        baseOptions.importPath = config.generator.importPath;
      if (config.generator?.indentSize !== undefined)
        baseOptions.indentSize = config.generator.indentSize;
      if (config.generator?.useTab !== undefined)
        baseOptions.useTab = config.generator.useTab;
      if (config.generator?.addComments !== undefined)
        baseOptions.addComments = config.generator.addComments;

      const genOptions = this.buildFluentGenOptions({
        ...baseOptions,
        ...(tsConfigPath !== undefined && { tsConfigPath }),
        ...(outputDir !== undefined && { outputDir }),
        ...(fileName !== undefined && { fileName }),
        ...(options.defaults !== undefined && {
          useDefaults: options.defaults,
        }),
        ...(options.comments !== undefined && {
          addComments: options.comments,
        }),
      });

      const generator = new FluentGen(genOptions);

      spinner.text = `Generating builder for ${chalk.cyan(typeName)}...`;

      const result = options.output
        ? await generator.generateToFile(file, typeName, options.output)
        : await generator.generateBuilder(file, typeName);

      if (!isOk(result)) {
        spinner.fail(chalk.red("Generation failed"));
        console.error(result.error);
        process.exit(1);
      }

      if (options.output) {
        spinner.succeed(
          chalk.green(`✓ Generated builder at ${chalk.cyan(result.value)}`),
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

  async batch(options: BatchOptions = {}): Promise<void> {
    const spinner = ora("Loading configuration...").start();

    try {
      const configResult = this.configLoader.load(options.config);
      if (!isOk(configResult)) {
        spinner.fail(chalk.red("Failed to load configuration"));
        console.error(configResult.error);
        process.exit(1);
      }

      const config = configResult.value;

      if (!config.targets || config.targets.length === 0) {
        spinner.fail(chalk.red("No targets found in configuration"));
        process.exit(1);
      }

      spinner.text = "Processing targets...";

      const baseOptions: CommandOptions = {};
      if (config.generator?.outputDir !== undefined)
        baseOptions.outputDir = config.generator.outputDir;
      if (config.generator?.useDefaults !== undefined)
        baseOptions.useDefaults = config.generator.useDefaults;
      if (config.generator?.contextType !== undefined)
        baseOptions.contextType = config.generator.contextType;
      if (config.generator?.importPath !== undefined)
        baseOptions.importPath = config.generator.importPath;
      if (config.generator?.indentSize !== undefined)
        baseOptions.indentSize = config.generator.indentSize;
      if (config.generator?.useTab !== undefined)
        baseOptions.useTab = config.generator.useTab;
      if (config.generator?.addComments !== undefined)
        baseOptions.addComments = config.generator.addComments;

      const genOptions = this.buildFluentGenOptions({
        ...baseOptions,
        ...(config.tsConfigPath !== undefined && {
          tsConfigPath: config.tsConfigPath,
        }),
      });

      const generator = new FluentGen(genOptions);

      let successCount = 0;
      let failCount = 0;

      for (const target of config.targets) {
        spinner.text = `Processing ${chalk.cyan(target.file)}...`;

        if (target.types && target.types.length > 0) {
          for (const typeName of target.types) {
            const result = await generator.generateBuilder(
              target.file,
              typeName,
            );

            if (isOk(result)) {
              if (!options.dry && target.outputFile) {
                const outputPath = target.outputFile.replace(
                  "{type}",
                  typeName.toLowerCase(),
                );
                await this.writeOutput(outputPath, result.value);
              }
              successCount++;
            } else {
              console.error(
                chalk.yellow(
                  `  ⚠ Failed to generate ${typeName}: ${result.error.message}`,
                ),
              );
              failCount++;
            }
          }
        } else {
          const scanResult = await generator.scanAndGenerate(target.file);

          if (isOk(scanResult)) {
            for (const [key, code] of scanResult.value) {
              if (!options.dry && target.outputFile) {
                const [file, type] = key.split(":");
                const outputPath = target.outputFile
                  .replace("{file}", path.basename(file!, ".ts"))
                  .replace("{type}", type!.toLowerCase());
                await this.writeOutput(outputPath, code);
              }
              successCount++;
            }
          } else {
            failCount++;
          }
        }
      }

      spinner.succeed(
        chalk.green(
          `✓ Batch generation complete: ${successCount} succeeded, ${failCount} failed`,
        ),
      );
    } catch (error) {
      spinner.fail(chalk.red("Unexpected error"));
      console.error(error);
      process.exit(1);
    }
  }

  async scan(pattern: string, options: ScanOptions = {}): Promise<void> {
    const spinner = ora(
      `Scanning for files matching ${chalk.cyan(pattern)}...`,
    ).start();

    try {
      const files = await glob(pattern);

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

      const baseOptions: CommandOptions = {};
      if (config.generator?.outputDir !== undefined)
        baseOptions.outputDir = config.generator.outputDir;
      if (config.generator?.useDefaults !== undefined)
        baseOptions.useDefaults = config.generator.useDefaults;
      if (config.generator?.contextType !== undefined)
        baseOptions.contextType = config.generator.contextType;
      if (config.generator?.importPath !== undefined)
        baseOptions.importPath = config.generator.importPath;
      if (config.generator?.indentSize !== undefined)
        baseOptions.indentSize = config.generator.indentSize;
      if (config.generator?.useTab !== undefined)
        baseOptions.useTab = config.generator.useTab;
      if (config.generator?.addComments !== undefined)
        baseOptions.addComments = config.generator.addComments;

      const genOptions = this.buildFluentGenOptions({
        ...baseOptions,
        ...(config.tsConfigPath !== undefined && {
          tsConfigPath: config.tsConfigPath,
        }),
      });

      const generator = new FluentGen(genOptions);

      const allTypes: Array<{ file: string; type: string }> = [];

      for (const file of files) {
        const scanSpinner = ora(`Scanning ${chalk.cyan(file)}...`).start();
        const extractor = new (
          await import("../type-info/index.js")
        ).TypeExtractor();
        const scanResult = await extractor.scanFile(file);

        if (isOk(scanResult) && scanResult.value.length > 0) {
          scanSpinner.succeed(
            chalk.green(
              `  ✓ Found ${scanResult.value.length} type(s) in ${file}`,
            ),
          );

          for (const type of scanResult.value) {
            allTypes.push({ file, type });
            console.log(chalk.gray(`    - ${type}`));
          }
        } else {
          scanSpinner.info(chalk.gray(`  ○ No types found in ${file}`));
        }
      }

      if (allTypes.length === 0) {
        console.log(chalk.yellow("No types found to generate"));
        process.exit(0);
      }

      if (options.interactive) {
        const answers = await inquirer.prompt([
          {
            type: "checkbox",
            name: "selected",
            message: "Select types to generate:",
            choices: allTypes.map((t) => ({
              name: `${t.type} (${t.file})`,
              value: t,
            })),
          },
        ]);

        for (const { file, type } of answers.selected) {
          const genSpinner = ora(
            `Generating builder for ${chalk.cyan(type)}...`,
          ).start();
          const result = await generator.generateBuilder(file, type);

          if (isOk(result)) {
            if (options.output) {
              const outputPath = options.output
                .replace("{file}", path.basename(file, ".ts"))
                .replace("{type}", type.toLowerCase());
              await this.writeOutput(outputPath, result.value);
              genSpinner.succeed(chalk.green(`✓ Generated ${outputPath}`));
            } else {
              genSpinner.succeed(chalk.green(`✓ Generated ${type}`));
              console.log(result.value);
            }
          } else {
            genSpinner.fail(chalk.red(`✗ Failed to generate ${type}`));
          }
        }
      } else {
        console.log(
          chalk.blue(`\nGenerating builders for ${allTypes.length} type(s)...`),
        );

        for (const { file, type } of allTypes) {
          const result = await generator.generateBuilder(file, type);

          if (isOk(result)) {
            if (options.output) {
              const outputPath = options.output
                .replace("{file}", path.basename(file, ".ts"))
                .replace("{type}", type.toLowerCase());
              await this.writeOutput(outputPath, result.value);
              console.log(chalk.green(`✓ Generated ${outputPath}`));
            } else {
              console.log(chalk.green(`✓ Generated ${type}`));
            }
          } else {
            console.log(chalk.red(`✗ Failed to generate ${type}`));
          }
        }
      }
    } catch (error) {
      spinner.fail(chalk.red("Unexpected error"));
      console.error(error);
      process.exit(1);
    }
  }

  private async writeOutput(
    outputPath: string,
    content: string,
  ): Promise<void> {
    const dir = path.dirname(outputPath);
    await mkdir(dir, { recursive: true });
    await writeFile(outputPath, content, "utf-8");
  }
}
