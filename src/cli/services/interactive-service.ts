import inquirer from 'inquirer';
import { FileService } from './file-service.js';
import { DiscoveryService, type DiscoveredInterface } from './discovery-service.js';
import { NamingService, type NamingConvention, type FileNamingConfig } from './naming-service.js';

export interface InputPatternsAnswers {
  patterns: string;
}

export interface InterfaceSelectionAnswers {
  selectedInterfaces: DiscoveredInterface[];
}

export interface OutputConfigAnswers {
  outputDir: string;
  namingConvention: NamingConvention;
  suffix: string;
}

export interface PluginConfigAnswers {
  hasPlugins: boolean;
  plugins?: string[];
}

export interface MonorepoConfigAnswers {
  enabled: boolean;
  workspaceRoot?: string;
  dependencyResolutionStrategy?: 'auto' | 'workspace-root' | 'hoisted' | 'local-only';
  customPaths?: string[];
}

export interface TypeSelection {
  file: string;
  type: string;
}

export class InteractiveService {
  private fileService = new FileService();
  private discoveryService = new DiscoveryService();
  private namingService = new NamingService();

  async askInputPatterns(): Promise<InputPatternsAnswers> {
    return inquirer.prompt([
      {
        type: 'input',
        name: 'patterns',
        message: 'Where are your TypeScript files? (comma-separated paths/globs):',
        default: 'src/**/*.ts',
        validate: (input: string) => {
          const patterns = this.discoveryService.parsePatterns(input);
          const { valid, invalid } = this.discoveryService.validatePatterns(patterns);

          if (invalid.length > 0) {
            return `Invalid patterns: ${invalid.join(', ')}. Patterns should contain .ts or wildcards.`;
          }

          return valid.length > 0 || 'Please provide at least one valid pattern.';
        },
      },
    ]);
  }

  async askInterfaceSelection(
    interfaces: DiscoveredInterface[],
  ): Promise<InterfaceSelectionAnswers> {
    if (interfaces.length === 0) {
      throw new Error('No interfaces found in the specified files.');
    }

    // Group interfaces by file for better organization
    const groupedChoices = this.groupInterfacesByFile(interfaces);

    const result = (await inquirer.prompt({
      type: 'checkbox',
      name: 'selectedInterfaces',
      message: 'Select interfaces to generate builders for:',
      choices: [
        { name: '🚀 Select All', value: '__SELECT_ALL__' },
        new inquirer.Separator(),
        ...groupedChoices,
      ],
      validate: (input: readonly any[]) => {
        const filtered = (input as any[]).filter(item => item !== '__SELECT_ALL__');
        return filtered.length > 0 || 'Please select at least one interface.';
      },
      filter: (input: readonly any[]) => {
        if ((input as any[]).includes('__SELECT_ALL__')) {
          return interfaces;
        }
        return (input as any[]).filter(item => item !== '__SELECT_ALL__');
      },
    })) as InterfaceSelectionAnswers;

    return result;
  }

  async askOutputConfig(): Promise<OutputConfigAnswers> {
    return inquirer.prompt([
      {
        type: 'input',
        name: 'outputDir',
        message: 'Where should generated builders be saved?',
        default: './src/builders/',
        validate: (input: string) => {
          const trimmed = input.trim();
          return trimmed.length > 0 || 'Output directory is required.';
        },
        filter: (input: string) => {
          const trimmed = input.trim();
          return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
        },
      },
      {
        type: 'list',
        name: 'namingConvention',
        message: 'File naming convention:',
        choices: this.namingService.getConventionChoices(),
      },
      {
        type: 'input',
        name: 'suffix',
        message: "File suffix (e.g., 'builder' for user.builder.ts):",
        default: 'builder',
        validate: (input: string) => {
          const trimmed = input.trim();
          return trimmed.length > 0 || 'Suffix is required.';
        },
      },
    ]);
  }

  async askPluginConfig(): Promise<PluginConfigAnswers> {
    const result = await inquirer.prompt<{ hasPlugins: boolean }>([
      {
        type: 'confirm',
        name: 'hasPlugins',
        message: 'Do you have any plugins to configure?',
        default: false,
      },
    ]);

    if (!result.hasPlugins) {
      return { hasPlugins: false };
    }

    const pluginAnswers = await inquirer.prompt<{ plugins: string }>([
      {
        type: 'input',
        name: 'plugins',
        message: 'Plugin file paths (comma-separated):',
        validate: (input: string) => {
          const plugins = input
            .split(',')
            .map(p => p.trim())
            .filter(Boolean);

          for (const plugin of plugins) {
            if (!this.fileService.fileExists(plugin)) {
              return `Plugin file not found: ${plugin}`;
            }
          }

          return plugins.length > 0 || 'Please provide at least one plugin path.';
        },
        filter: (input: string) =>
          input
            .split(',')
            .map(p => p.trim())
            .filter(Boolean),
      },
    ]);

    return {
      hasPlugins: true,
      plugins: pluginAnswers.plugins as unknown as string[],
    };
  }

  async confirmConfig(): Promise<boolean> {
    const result = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: '\nSave this configuration?',
        default: true,
      },
    ]);
    return result.confirm;
  }

  async askRunBatch(): Promise<boolean> {
    const result = await inquirer.prompt<{ runBatch: boolean }>([
      {
        type: 'confirm',
        name: 'runBatch',
        message: 'Generate builders now?',
        default: true,
      },
    ]);
    return result.runBatch;
  }

  async askMonorepoConfig(): Promise<MonorepoConfigAnswers> {
    const result = await inquirer.prompt<{ enabled: boolean }>([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Are you working in a monorepo environment?',
        default: false,
      },
    ]);

    if (!result.enabled) {
      return { enabled: false };
    }

    const strategyAnswer = await inquirer.prompt<{
      dependencyResolutionStrategy: 'auto' | 'workspace-root' | 'hoisted' | 'local-only';
    }>([
      {
        type: 'list',
        name: 'dependencyResolutionStrategy',
        message: 'How should dependencies be resolved?',
        choices: [
          {
            name: 'Auto-detect (recommended) - Try multiple strategies',
            value: 'auto',
          },
          {
            name: 'Workspace Root - Look in workspace root node_modules',
            value: 'workspace-root',
          },
          {
            name: 'Hoisted - Walk up directory tree',
            value: 'hoisted',
          },
          {
            name: 'Local Only - Only check local node_modules',
            value: 'local-only',
          },
        ],
        default: 'auto',
      },
    ]);

    let workspaceRoot: string | undefined;
    let customPaths: string[] | undefined;

    if (strategyAnswer.dependencyResolutionStrategy === 'workspace-root') {
      const workspaceRootAnswer = await inquirer.prompt<{ workspaceRoot: string }>([
        {
          type: 'input',
          name: 'workspaceRoot',
          message: 'Path to workspace root:',
          default: process.cwd(),
          validate: (input: string) => {
            return this.fileService.directoryExists(input) || 'Directory does not exist';
          },
        },
      ]);
      workspaceRoot = workspaceRootAnswer.workspaceRoot;
    }

    const customPathsAnswer = await inquirer.prompt<{ hasCustomPaths: boolean }>([
      {
        type: 'confirm',
        name: 'hasCustomPaths',
        message: 'Do you have custom paths where dependencies might be located?',
        default: false,
      },
    ]);

    if (customPathsAnswer.hasCustomPaths) {
      const pathsAnswer = await inquirer.prompt<{ customPaths: string }>([
        {
          type: 'input',
          name: 'customPaths',
          message: 'Custom dependency paths (comma-separated):',
          validate: (input: string) => {
            const paths = input
              .split(',')
              .map(p => p.trim())
              .filter(Boolean);

            for (const path of paths) {
              if (!this.fileService.directoryExists(path)) {
                return `Directory does not exist: ${path}`;
              }
            }

            return paths.length > 0 || 'Please provide at least one path.';
          },
          filter: (input: string) =>
            input
              .split(',')
              .map(p => p.trim())
              .filter(Boolean),
        },
      ]);
      customPaths = pathsAnswer.customPaths as unknown as string[];
    }

    return {
      enabled: true,
      dependencyResolutionStrategy: strategyAnswer.dependencyResolutionStrategy,
      ...(workspaceRoot !== undefined && { workspaceRoot }),
      ...(customPaths !== undefined && { customPaths }),
    };
  }

  showFileNamePreview(config: FileNamingConfig): void {
    const preview = this.namingService.getFileNamePreview(config);
    console.log(`\n📝 ${preview}`);
  }

  async selectTypes(types: TypeSelection[]): Promise<TypeSelection[]> {
    const result = await inquirer.prompt<{ selected: TypeSelection[] }>([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select types to generate:',
        choices: types.map(t => ({
          name: `${t.type} (${t.file})`,
          value: t,
        })),
      },
    ]);
    return result.selected;
  }

  private groupInterfacesByFile(interfaces: DiscoveredInterface[]): any[] {
    const grouped = new Map<string, DiscoveredInterface[]>();

    for (const iface of interfaces) {
      if (!grouped.has(iface.file)) {
        grouped.set(iface.file, []);
      }
      grouped.get(iface.file)!.push(iface);
    }

    const choices: any[] = [];

    for (const [file, fileInterfaces] of grouped) {
      choices.push(new inquirer.Separator(`📁 ${file}`));

      for (const iface of fileInterfaces) {
        choices.push({
          name: `  └─ ${iface.name}`,
          value: iface,
        });
      }

      choices.push(new inquirer.Separator());
    }

    return choices;
  }
}
