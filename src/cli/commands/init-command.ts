import chalk from 'chalk';
import ora from 'ora';
import type { InitOptions } from '../types.js';
import type { Config } from '../config.js';
import { FileService } from '../services/file-service.js';
import { InteractiveService } from '../services/interactive-service.js';
import { DiscoveryService } from '../services/discovery-service.js';

export class InitCommand {
  private fileService = new FileService();
  private interactiveService = new InteractiveService();
  private discoveryService = new DiscoveryService();

  async execute(options: InitOptions = {}): Promise<void> {
    const existingConfig = this.fileService.findExistingConfig();

    if (existingConfig && !options.overwrite) {
      console.error(chalk.red(`\nConfiguration file ${existingConfig} already exists.`));
      console.log(chalk.gray('Use --overwrite to replace it.'));
      process.exit(1);
    }

    console.log(chalk.blue('\n🚀 Welcome to fluent-gen configuration setup!\n'));

    try {
      const config = await this.runGuidedSetup();

      console.log(chalk.blue('\n📝 Configuration Preview:\n'));
      console.log(JSON.stringify(config, null, 2));

      const confirmed = await this.interactiveService.confirmConfig();

      if (!confirmed) {
        console.log(chalk.yellow('\n✖ Configuration cancelled.'));
        return;
      }

      const configFile = this.fileService.getConfigFileName('json');
      this.fileService.writeConfigFile(configFile, config, 'json');

      console.log(chalk.green(`\n✓ Configuration file created: ${configFile}`));

      // Ask if they want to run batch generation immediately
      const runBatch = await this.interactiveService.askRunBatch();

      if (runBatch) {
        const { BatchCommand } = await import('./batch-command.js');
        const batchCommand = new BatchCommand();
        console.log(chalk.blue('\n🏗️  Generating builders...\n'));
        await batchCommand.execute({});
      } else {
        this.showNextSteps(config);
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Setup failed:'), error);
      process.exit(1);
    }
  }

  private async runGuidedSetup(): Promise<Config> {
    // Step 1: Ask for input patterns
    console.log(chalk.cyan('📂 Step 1: Discover TypeScript files'));
    const patternsAnswer = await this.interactiveService.askInputPatterns();
    const patterns = this.discoveryService.parsePatterns(patternsAnswer.patterns);

    // Step 2: Discover and scan files
    console.log(chalk.cyan('\n🔍 Step 2: Scanning for interfaces...'));
    const spinner = ora('Scanning files...').start();

    const discovery = await this.discoveryService.discoverAll(patterns);

    if (discovery.files.length === 0) {
      spinner.fail('No TypeScript files found');
      throw new Error('No TypeScript files found matching the patterns');
    }

    if (discovery.interfaces.length === 0) {
      spinner.fail('No interfaces found');
      throw new Error('No interfaces or types found in the specified files');
    }

    spinner.succeed(
      `Found ${discovery.files.length} files with ${discovery.interfaces.length} interfaces`,
    );

    // Step 3: Interface selection
    console.log(chalk.cyan('\n✅ Step 3: Select interfaces'));
    const interfaceSelection = await this.interactiveService.askInterfaceSelection(
      discovery.interfaces,
    );

    // Step 4: Output configuration
    console.log(chalk.cyan('\n📁 Step 4: Configure output'));
    const outputConfig = await this.interactiveService.askOutputConfig();

    // Show preview of file naming
    this.interactiveService.showFileNamePreview({
      convention: outputConfig.namingConvention,
      suffix: outputConfig.suffix,
    });

    // Step 5: Monorepo configuration
    console.log(chalk.cyan('\n📦 Step 5: Configure monorepo settings (optional)'));
    const monorepoConfig = await this.interactiveService.askMonorepoConfig();

    // Step 6: Plugin configuration
    console.log(chalk.cyan('\n🔌 Step 6: Configure plugins (optional)'));
    const pluginConfig = await this.interactiveService.askPluginConfig();

    // Build configuration
    return this.buildConfig(
      patterns,
      interfaceSelection.selectedInterfaces,
      outputConfig,
      monorepoConfig,
      pluginConfig,
    );
  }

  private buildConfig(
    patterns: string[],
    selectedInterfaces: any[],
    outputConfig: any,
    monorepoConfig: any,
    pluginConfig: any,
  ): Config {
    // Group interfaces by file to create targets
    const fileMap = new Map<string, string[]>();

    for (const iface of selectedInterfaces) {
      if (!fileMap.has(iface.file)) {
        fileMap.set(iface.file, []);
      }
      fileMap.get(iface.file)!.push(iface.name);
    }

    // Create targets from selected interfaces
    const targets = Array.from(fileMap.entries()).map(([file, types]) => ({
      file,
      types,
      outputFile: `${outputConfig.outputDir}{type}.${outputConfig.suffix}.ts`,
    }));

    return {
      generator: {
        outputDir: outputConfig.outputDir,
        useDefaults: true,
        addComments: true,
      },
      targets,
      patterns,
      ...(monorepoConfig.enabled && { monorepo: monorepoConfig }),
      ...(pluginConfig.hasPlugins && { plugins: pluginConfig.plugins }),
    };
  }

  private showNextSteps(config: Config): void {
    console.log(chalk.blue('\n📚 Next steps:\n'));

    if (config.targets && config.targets.length > 0) {
      console.log(chalk.cyan('  1. Generate builders from your targets:'));
      console.log(chalk.gray('     fluent-gen batch\n'));
    } else if (config.patterns && config.patterns.length > 0) {
      console.log(chalk.cyan('  1. Scan and generate builders from patterns:'));
      console.log(chalk.gray(`     fluent-gen scan "${config.patterns[0]}"\n`));
    } else {
      console.log(chalk.cyan('  1. Generate a single builder:'));
      console.log(chalk.gray('     fluent-gen generate <file> <type>\n'));

      console.log(chalk.cyan('  2. Or scan for types to generate:'));
      console.log(chalk.gray('     fluent-gen scan "src/**/*.ts" --interactive\n'));
    }

    console.log(chalk.cyan('  For more information:'));
    console.log(chalk.gray('     fluent-gen --help'));
  }
}
