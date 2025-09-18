#!/usr/bin/env node

import { Command } from "commander";
import { Commands } from "./commands.js";
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
);

const program = new Command();
const commands = new Commands();

program
  .name("fluent-gen")
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command("generate")
  .alias("gen")
  .description("Generate a fluent builder for a specific type")
  .argument("<file>", "Path to the TypeScript file")
  .argument("<type>", "Name of the interface or type to generate")
  .option("-o, --output <path>", "Output file path")
  .option("-c, --config <path>", "Path to configuration file")
  .option("-t, --tsconfig <path>", "Path to tsconfig.json")
  .option("-d, --defaults", "Use default values for optional properties")
  .option("--no-comments", "Don't include JSDoc comments in generated code")
  .action(async (file, type, options) => {
    try {
      await commands.generate(file, type, options);
    } catch (error) {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

program
  .command("batch")
  .description("Generate builders from configuration file")
  .option("-c, --config <path>", "Path to configuration file")
  .option("-d, --dry", "Dry run without writing files")
  .action(async (options) => {
    try {
      await commands.batch(options);
    } catch (error) {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

program
  .command("scan")
  .description("Scan files for interfaces and types")
  .argument("<pattern>", "Glob pattern to match files")
  .option(
    "-o, --output <pattern>",
    "Output file pattern (use {file} and {type} placeholders)",
  )
  .option("-c, --config <path>", "Path to configuration file")
  .option("-i, --interactive", "Interactive mode to select types")
  .action(async (pattern, options) => {
    try {
      await commands.scan(pattern, options);
    } catch (error) {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Initialize a configuration file")
  .action(async () => {
    const inquirer = (await import("inquirer")).default;

    console.log(chalk.blue("Initializing fluent-gen configuration...\n"));

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "outputDir",
        message: "Output directory for generated files:",
        default: "./generated",
      },
      {
        type: "confirm",
        name: "useDefaults",
        message: "Use default values for optional properties?",
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
          { name: "Tabs", value: { useTab: true } },
        ],
      },
      {
        type: "input",
        name: "tsConfigPath",
        message: "Path to tsconfig.json (optional):",
        default: "",
      },
    ]);

    const config = {
      tsConfigPath: answers.tsConfigPath || undefined,
      generator: {
        outputDir: answers.outputDir,
        useDefaults: answers.useDefaults,
        addComments: answers.addComments,
        ...answers.indent,
      },
      targets: [],
      patterns: [],
    };

    const { writeFileSync } = await import("node:fs");
    writeFileSync(".fluentgenrc.json", JSON.stringify(config, null, 2));

    console.log(
      chalk.green("\n Configuration file created: .fluentgenrc.json"),
    );
    console.log(
      chalk.gray(
        "\nYou can now add targets to the configuration file and run:",
      ),
    );
    console.log(chalk.cyan("  fluent-gen batch"));
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

