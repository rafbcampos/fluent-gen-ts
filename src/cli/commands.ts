import { FluentGen, type FluentGenOptions } from "../gen/index.js";
import { ConfigLoader, type Config, type Target } from "./config.js";
import { isOk, type Result } from "../core/result.js";
import { PluginManager, type Plugin } from "../core/plugin.js";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { glob } from "glob";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { minimatch } from "minimatch";

export interface GenerateOptions {
  output?: string;
  config?: string;
  tsconfig?: string;
  plugins?: string[];
  defaults?: boolean;
  comments?: boolean;
  dryRun?: boolean;
}

export interface BatchOptions {
  config?: string;
  plugins?: string[];
  dryRun?: boolean;
  parallel?: boolean;
}

export interface ScanOptions {
  output?: string;
  config?: string;
  plugins?: string[];
  exclude?: string[];
  types?: string;
  interactive?: boolean;
  dryRun?: boolean;
  ignorePrivate?: boolean;
}

export interface InitOptions {
  format?: string;
  template?: string;
  overwrite?: boolean;
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

type GenerateTask = {
  type: "generate";
  file: string;
  typeName: string;
  outputFile: string | undefined;
};

type ScanTask = {
  type: "scan";
  file: string;
  outputFile: string | undefined;
};

type Task = GenerateTask | ScanTask;

type TaskWithResult = Task & {
  result: Result<string> | Result<Map<string, string>>;
};

export class Commands {
  private configLoader = new ConfigLoader();

  private isValidPlugin(obj: unknown): obj is Plugin {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "name" in obj &&
      "version" in obj &&
      typeof (obj as any).name === "string" &&
      typeof (obj as any).version === "string"
    );
  }

  private async loadPlugins(pluginPaths?: string[]): Promise<PluginManager> {
    const pluginManager = new PluginManager();

    if (!pluginPaths || pluginPaths.length === 0) {
      return pluginManager;
    }

    for (const pluginPath of pluginPaths) {
      try {
        const absolutePath = path.resolve(pluginPath);
        const plugin = await import(absolutePath);
        const pluginInstance = plugin.default || plugin;

        if (this.isValidPlugin(pluginInstance)) {
          pluginManager.register(pluginInstance);
          console.log(chalk.gray(`  ✓ Loaded plugin: ${pluginInstance.name}`));
        } else {
          console.warn(
            chalk.yellow(
              `  ⚠ Invalid plugin format in ${pluginPath} - missing required 'name' or 'version' properties`,
            ),
          );
        }
      } catch (error) {
        console.error(
          chalk.red(`  ✗ Failed to load plugin ${pluginPath}:`),
          error,
        );
      }
    }

    return pluginManager;
  }

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

      // Load plugins
      const allPluginPaths = [
        ...(options.plugins || []),
        ...(config.plugins || []),
      ];

      let pluginManager: PluginManager | undefined;
      if (allPluginPaths.length > 0) {
        spinner.text = "Loading plugins...";
        pluginManager = await this.loadPlugins(allPluginPaths);
      }

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

      const generator = new FluentGen({
        ...genOptions,
        ...(pluginManager && { pluginManager }),
      });

      spinner.text = `Generating builder for ${chalk.cyan(typeName)}...`;

      const result = await generator.generateBuilder(file, typeName);

      if (!isOk(result)) {
        spinner.fail(chalk.red("Generation failed"));
        console.error(result.error);
        process.exit(1);
      }

      // Handle dry-run
      if (options.dryRun) {
        spinner.succeed(chalk.green("✓ Dry-run complete (no files written)"));
        console.log(chalk.gray("\nGenerated code preview:"));
        console.log(result.value);
        return;
      }

      // Write output if specified
      if (options.output) {
        await generator.generateToFile(file, typeName, options.output);
        spinner.succeed(
          chalk.green(`✓ Generated builder at ${chalk.cyan(options.output)}`),
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

      // Load plugins
      const allPluginPaths = [
        ...(options.plugins || []),
        ...(config.plugins || []),
      ];

      let pluginManager: PluginManager | undefined;
      if (allPluginPaths.length > 0) {
        spinner.text = "Loading plugins...";
        pluginManager = await this.loadPlugins(allPluginPaths);
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

      const generator = new FluentGen({
        ...genOptions,
        ...(pluginManager && { pluginManager }),
      });

      let successCount = 0;
      let failCount = 0;

      // Handle parallel processing
      if (options.parallel) {
        const tasks: Task[] = config.targets.flatMap((target): Task[] => {
          if (target.types && target.types.length > 0) {
            return target.types.map(
              (typeName): GenerateTask => ({
                type: "generate",
                file: target.file,
                typeName,
                outputFile: target.outputFile,
              }),
            );
          } else {
            return [
              {
                type: "scan",
                file: target.file,
                outputFile: target.outputFile,
              },
            ];
          }
        });

        spinner.text = `Processing ${tasks.length} builders in parallel...`;

        const results = await Promise.allSettled(
          tasks.map(async (task) => {
            if (task.type === "generate") {
              const result = await generator.generateBuilder(
                task.file,
                task.typeName,
              );

              if (isOk(result) && !options.dryRun && task.outputFile) {
                const outputPath = task.outputFile.replace(
                  "{type}",
                  task.typeName.toLowerCase(),
                );
                await this.writeOutput(outputPath, result.value);
              }

              return { ...task, result };
            } else {
              const result = await generator.scanAndGenerate(task.file);

              if (isOk(result) && !options.dryRun && task.outputFile) {
                for (const [key, code] of result.value) {
                  const keyParts = key.split(":");
                  if (keyParts.length === 2) {
                    const [file, type] = keyParts;
                    const outputPath = task.outputFile
                      .replace("{file}", path.basename(file!, ".ts"))
                      .replace("{type}", type!.toLowerCase());
                    await this.writeOutput(outputPath, code);
                  }
                }
              }

              return { ...task, result };
            }
          }),
        );

        results.forEach((res) => {
          if (res.status === "fulfilled") {
            const taskWithResult = res.value as TaskWithResult;
            if ("ok" in taskWithResult.result && taskWithResult.result.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } else {
            failCount++;
            console.error(chalk.yellow(`  ⚠ Failed: ${res.reason}`));
          }
        });
      } else {
        // Sequential processing
        for (const target of config.targets) {
          spinner.text = `Processing ${chalk.cyan(target.file)}...`;

          if (target.types && target.types.length > 0) {
            for (const typeName of target.types) {
              const result = await generator.generateBuilder(
                target.file,
                typeName,
              );

              if (isOk(result)) {
                if (!options.dryRun && target.outputFile) {
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
                if (!options.dryRun && target.outputFile) {
                  const keyParts = key.split(":");
                  if (keyParts.length === 2) {
                    const [file, type] = keyParts;
                    const outputPath = target.outputFile
                      .replace("{file}", path.basename(file!, ".ts"))
                      .replace("{type}", type!.toLowerCase());
                    await this.writeOutput(outputPath, code);
                  }
                }
                successCount++;
              }
            } else {
              failCount++;
            }
          }
        }
      } // End of sequential processing

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
      let files = await glob(pattern);

      // Apply exclusion patterns
      if (options.exclude && options.exclude.length > 0) {
        files = files.filter((file) => {
          return !options.exclude!.some((excludePattern) =>
            minimatch(file, excludePattern),
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

      // Load plugins
      const allPluginPaths = [
        ...(options.plugins || []),
        ...(config.plugins || []),
      ];

      let pluginManager: PluginManager | undefined;
      if (allPluginPaths.length > 0) {
        spinner.text = "Loading plugins...";
        pluginManager = await this.loadPlugins(allPluginPaths);
      }

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

      const generator = new FluentGen({
        ...genOptions,
        ...(pluginManager && { pluginManager }),
      });

      const allTypes: Array<{ file: string; type: string }> = [];

      // Filter types if specified
      const typeFilter = options.types?.split(",").map((t) => t.trim());

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
            // Apply type filter if specified
            if (!typeFilter || typeFilter.includes(type)) {
              allTypes.push({ file, type });
              console.log(chalk.gray(`    - ${type}`));
            }
          }
        } else {
          scanSpinner.info(chalk.gray(`  ○ No types found in ${file}`));
        }
      }

      if (allTypes.length === 0) {
        console.log(chalk.yellow("No types found to generate"));
        process.exit(0);
      }

      // Handle dry-run for scan
      if (options.dryRun) {
        console.log(
          chalk.blue(`\n✓ Dry-run complete. Found ${allTypes.length} type(s):`),
        );
        allTypes.forEach(({ file, type }) => {
          console.log(chalk.gray(`  ${type} (${file})`));
        });
        return;
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

  async getTemplate(templateName: string): Promise<Config> {
    const templates = {
      basic: {
        tsConfigPath: "./tsconfig.json",
        generator: {
          outputDir: "./src/builders",
          useDefaults: true,
          addComments: true,
          indentSize: 2,
          useTab: false,
        },
        targets: [],
        patterns: [],
        plugins: [],
      },
      advanced: {
        tsConfigPath: "./tsconfig.json",
        generator: {
          outputDir: "./src/generated/builders",
          useDefaults: true,
          addComments: true,
          contextType: "BuildContext",
          importPath: "../context",
          indentSize: 2,
          useTab: false,
        },
        targets: [],
        patterns: [],
        plugins: [],
        exclude: ["**/*.test.ts", "**/*.spec.ts"],
      },
      monorepo: {
        tsConfigPath: "./packages/shared/tsconfig.json",
        generator: {
          outputDir: "./packages/shared/src/builders",
          useDefaults: true,
          addComments: true,
          indentSize: 2,
          useTab: false,
        },
        targets: [],
        patterns: ["packages/*/src/**/*.interface.ts"],
        exclude: ["**/node_modules/**", "**/*.test.ts", "**/*.spec.ts"],
        plugins: [],
      },
    };

    const template = templates[templateName as keyof typeof templates];
    return template ?? templates.basic;
  }

  async getDefaultConfig(): Promise<Config> {
    return {
      tsConfigPath: "./tsconfig.json",
      generator: {
        outputDir: "./generated",
        useDefaults: true,
        addComments: true,
        indentSize: 2,
        useTab: false,
      },
      targets: [],
      patterns: [],
      plugins: [],
    };
  }

  async init(options: InitOptions = {}): Promise<void> {
    const { existsSync, writeFileSync } = await import("node:fs");

    // Check if config already exists
    const configFiles = [
      ".fluentgenrc.json",
      ".fluentgenrc.yaml",
      ".fluentgenrc.js",
      "fluentgen.config.js",
    ];
    const existingConfig = configFiles.find((file) => existsSync(file));

    if (existingConfig && !options.overwrite) {
      console.error(
        chalk.red(`\nConfiguration file ${existingConfig} already exists.`),
      );
      console.log(chalk.gray("Use --overwrite to replace it."));
      process.exit(1);
    }

    console.log(
      chalk.blue("\n🚀 Welcome to fluent-gen configuration setup!\n"),
    );

    let config: Config;

    // If template is specified, load it
    if (options.template) {
      config = await this.getTemplate(options.template);
      console.log(chalk.green(`✓ Using ${options.template} template\n`));
    } else {
      // Interactive setup
      const setupType = await inquirer.prompt([
        {
          type: "list",
          name: "setupType",
          message: "How would you like to set up your configuration?",
          choices: [
            { name: "🎯 Quick setup (recommended defaults)", value: "quick" },
            {
              name: "⚙️  Custom setup (configure everything)",
              value: "custom",
            },
            { name: "📋 Start from template", value: "template" },
          ],
        },
      ]);

      if (setupType.setupType === "template") {
        const { template } = await inquirer.prompt([
          {
            type: "list",
            name: "template",
            message: "Choose a template:",
            choices: [
              { name: "Basic - Simple single package setup", value: "basic" },
              {
                name: "Advanced - With context and advanced features",
                value: "advanced",
              },
              { name: "Monorepo - Multi-package workspace", value: "monorepo" },
            ],
          },
        ]);
        config = await this.getTemplate(template);
      } else if (setupType.setupType === "quick") {
        config = await this.getDefaultConfig();
      } else {
        // Custom interactive setup
        const basicAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "tsConfigPath",
            message: "Path to tsconfig.json:",
            default: "./tsconfig.json",
            validate: (input: string) => {
              if (!input) return true;
              if (!existsSync(input)) {
                return `File ${input} does not exist. Press enter to skip or provide a valid path.`;
              }
              return true;
            },
          },
          {
            type: "input",
            name: "outputDir",
            message: "Output directory for generated builders:",
            default: "./src/builders",
          },
          {
            type: "confirm",
            name: "useDefaults",
            message: "Generate default values for optional properties?",
            default: true,
          },
          {
            type: "confirm",
            name: "addComments",
            message: "Include JSDoc comments in generated code?",
            default: true,
          },
          {
            type: "list",
            name: "indent",
            message: "Indentation style:",
            choices: [
              { name: "2 spaces", value: { useTab: false, indentSize: 2 } },
              { name: "4 spaces", value: { useTab: false, indentSize: 4 } },
              { name: "Tabs", value: { useTab: true, indentSize: undefined } },
            ],
          },
        ]);

        // Advanced options
        const { hasAdvanced } = await inquirer.prompt([
          {
            type: "confirm",
            name: "hasAdvanced",
            message:
              "Configure advanced options? (context type, plugins, etc.)",
            default: false,
          },
        ]);

        interface AdvancedAnswers {
          contextType?: string;
          importPath?: string;
          hasPlugins?: boolean;
          plugins?: string[];
        }
        let advancedAnswers: AdvancedAnswers = {};
        if (hasAdvanced) {
          advancedAnswers = await inquirer.prompt([
            {
              type: "input",
              name: "contextType",
              message: "Custom context type name (leave empty for none):",
              default: "",
            },
            {
              type: "input",
              name: "importPath",
              message: "Import path for context type:",
              when: (answers: AdvancedAnswers) => !!answers.contextType,
              default: "./context",
            },
            {
              type: "confirm",
              name: "hasPlugins",
              message: "Do you have plugins to configure?",
              default: false,
            },
            {
              type: "input",
              name: "plugins",
              message: "Plugin file paths (comma-separated):",
              when: (answers: AdvancedAnswers) => answers.hasPlugins,
              filter: (input: string) =>
                input
                  .split(",")
                  .map((p) => p.trim())
                  .filter(Boolean),
            },
          ]);
        }

        // Target configuration
        const { configureTargets } = await inquirer.prompt([
          {
            type: "confirm",
            name: "configureTargets",
            message: "Would you like to configure build targets now?",
            default: true,
          },
        ]);

        const targets: Target[] = [];
        if (configureTargets) {
          let addMore = true;
          while (addMore) {
            const targetAnswers = await inquirer.prompt([
              {
                type: "input",
                name: "file",
                message: "TypeScript file path:",
                validate: (input: string) => !!input || "File path is required",
              },
              {
                type: "input",
                name: "types",
                message:
                  "Type names to generate (comma-separated, or leave empty for all):",
                filter: (input: string) => {
                  if (!input) return undefined;
                  return input
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                },
              },
              {
                type: "input",
                name: "outputFile",
                message: "Output file pattern (use {type} placeholder):",
                default: "./src/builders/{type}.builder.ts",
              },
              {
                type: "confirm",
                name: "addMore",
                message: "Add another target?",
                default: false,
              },
            ]);

            targets.push({
              file: targetAnswers.file,
              types: targetAnswers.types,
              outputFile: targetAnswers.outputFile,
            });

            addMore = targetAnswers.addMore;
          }
        }

        // Pattern configuration
        const { configurePatterns } = await inquirer.prompt([
          {
            type: "confirm",
            name: "configurePatterns",
            message: "Would you like to configure file scan patterns?",
            default: false,
          },
        ]);

        const patterns: string[] = [];
        const exclude: string[] = [];
        if (configurePatterns) {
          const patternAnswers = await inquirer.prompt([
            {
              type: "input",
              name: "patterns",
              message: "Glob patterns to scan (comma-separated):",
              default: "src/**/*.interface.ts, src/**/*.type.ts",
              filter: (input: string) =>
                input
                  .split(",")
                  .map((p) => p.trim())
                  .filter(Boolean),
            },
            {
              type: "input",
              name: "exclude",
              message: "Patterns to exclude (comma-separated):",
              default: "**/*.test.ts, **/*.spec.ts, **/node_modules/**",
              filter: (input: string) =>
                input
                  .split(",")
                  .map((p) => p.trim())
                  .filter(Boolean),
            },
          ]);
          patterns.push(...patternAnswers.patterns);
          exclude.push(...patternAnswers.exclude);
        }

        // Build final config
        config = {
          ...(basicAnswers.tsConfigPath && {
            tsConfigPath: basicAnswers.tsConfigPath,
          }),
          generator: {
            outputDir: basicAnswers.outputDir,
            useDefaults: basicAnswers.useDefaults,
            addComments: basicAnswers.addComments,
            ...basicAnswers.indent,
            ...(advancedAnswers.contextType && {
              contextType: advancedAnswers.contextType,
            }),
            ...(advancedAnswers.importPath && {
              importPath: advancedAnswers.importPath,
            }),
          },
          targets,
          patterns,
          ...(exclude.length > 0 && { exclude }),
          ...(advancedAnswers.plugins && { plugins: advancedAnswers.plugins }),
        };
      }
    }

    // Ask for confirmation and show preview
    console.log(chalk.blue("\n📝 Configuration Preview:\n"));
    console.log(JSON.stringify(config, null, 2));

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "\nSave this configuration?",
        default: true,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("\n✖ Configuration cancelled."));
      return;
    }

    // Determine filename based on format
    const configFile =
      options.format === "yaml"
        ? ".fluentgenrc.yaml"
        : options.format === "js"
          ? "fluentgen.config.js"
          : ".fluentgenrc.json";

    // Write configuration file
    if (options.format === "js") {
      const jsContent = `module.exports = ${JSON.stringify(config, null, 2)};\n`;
      writeFileSync(configFile, jsContent);
    } else {
      // For now, we'll use JSON for both json and yaml formats
      writeFileSync(configFile, JSON.stringify(config, null, 2));
    }

    console.log(chalk.green(`\n✓ Configuration file created: ${configFile}`));

    // Show next steps
    console.log(chalk.blue("\n📚 Next steps:\n"));

    if (config.targets && config.targets.length > 0) {
      console.log(chalk.cyan("  1. Generate builders from your targets:"));
      console.log(chalk.gray("     fluent-gen batch\n"));
    } else if (config.patterns && config.patterns.length > 0) {
      console.log(chalk.cyan("  1. Scan and generate builders from patterns:"));
      console.log(chalk.gray(`     fluent-gen scan "${config.patterns[0]}"\n`));
    } else {
      console.log(chalk.cyan("  1. Generate a single builder:"));
      console.log(chalk.gray("     fluent-gen generate <file> <type>\n"));

      console.log(chalk.cyan("  2. Or scan for types to generate:"));
      console.log(
        chalk.gray('     fluent-gen scan "src/**/*.ts" --interactive\n'),
      );
    }

    console.log(chalk.cyan("  For more information:"));
    console.log(chalk.gray("     fluent-gen --help"));
  }
}
