import inquirer from 'inquirer';
import { FileService } from './file-service.js';
import { DiscoveryService, type DiscoveredInterface } from './discovery-service.js';
import { NamingService, type NamingConvention, type FileNamingConfig } from './naming-service.js';

type SeparatorInstance = InstanceType<typeof inquirer.Separator>;

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

  private parseCommaSeparatedInput(input: string): string[] {
    return input
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private validatePaths(
    paths: string[],
    validateFn: (path: string) => boolean,
    errorPrefix: string,
  ): string | true {
    for (const path of paths) {
      if (!validateFn(path)) {
        return `${errorPrefix}: ${path}`;
      }
    }
    return paths.length > 0 || 'Please provide at least one path.';
  }

  private ensureStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
    if (typeof value === 'string') {
      return [value];
    }
    return [];
  }

  /**
   * Prompts user for TypeScript file patterns to scan for interfaces.
   * Validates patterns to ensure they contain .ts files or valid wildcards.
   *
   * @returns Promise resolving to user's input patterns
   * @example
   * ```typescript
   * const { patterns } = await service.askInputPatterns();
   * // patterns might be: "src/\**\/\*.ts,lib/\**\/\*.ts"
   * ```
   */
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

  /**
   * Prompts user to select which interfaces to generate builders for.
   * Groups interfaces by file for better organization and includes a "Select All" option.
   *
   * @param interfaces - Array of discovered interfaces to choose from
   * @returns Promise resolving to selected interfaces
   * @throws Error when no interfaces are provided
   * @example
   * ```typescript
   * const { selectedInterfaces } = await service.askInterfaceSelection(interfaces);
   * ```
   */
  async askInterfaceSelection(
    interfaces: DiscoveredInterface[],
  ): Promise<InterfaceSelectionAnswers> {
    if (interfaces.length === 0) {
      throw new Error('No interfaces found in the specified files.');
    }

    const groupedChoices = this.groupInterfacesByFile(interfaces);

    const result = await inquirer.prompt<InterfaceSelectionAnswers>({
      type: 'checkbox',
      name: 'selectedInterfaces',
      message: 'Select interfaces to generate builders for:',
      choices: [
        { name: '🚀 Select All', value: '__SELECT_ALL__' },
        new inquirer.Separator(),
        ...groupedChoices,
      ],
      validate: input => {
        const filtered = Array.isArray(input)
          ? input.filter(item => item !== '__SELECT_ALL__')
          : [];
        return filtered.length > 0 || 'Please select at least one interface.';
      },
      filter: (input: unknown) => {
        if (Array.isArray(input) && input.includes('__SELECT_ALL__')) {
          return interfaces;
        }
        return Array.isArray(input) ? input.filter(item => item !== '__SELECT_ALL__') : [];
      },
    });

    return result;
  }

  /**
   * Prompts user for output configuration including directory, naming convention, and file suffix.
   *
   * @returns Promise resolving to output configuration
   * @example
   * ```typescript
   * const { outputDir, namingConvention, suffix } = await service.askOutputConfig();
   * // outputDir: "./src/builders/"
   * // namingConvention: "kebab-case"
   * // suffix: "builder"
   * ```
   */
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

  /**
   * Prompts user for plugin configuration.
   * Validates that plugin files exist before accepting them.
   *
   * @returns Promise resolving to plugin configuration
   * @example
   * ```typescript
   * const config = await service.askPluginConfig();
   * if (config.hasPlugins) {
   *   console.log('Plugins:', config.plugins);
   * }
   * ```
   */
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
          const plugins = this.parseCommaSeparatedInput(input);
          return this.validatePaths(
            plugins,
            path => this.fileService.fileExists(path),
            'Plugin file not found',
          );
        },
        filter: (input: string) => this.parseCommaSeparatedInput(input),
      },
    ]);

    return {
      hasPlugins: true,
      plugins: this.ensureStringArray(pluginAnswers.plugins),
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

  /**
   * Prompts user for monorepo configuration including dependency resolution strategy.
   * Validates directory paths and provides various resolution strategies.
   *
   * @returns Promise resolving to monorepo configuration
   * @example
   * ```typescript
   * const config = await service.askMonorepoConfig();
   * if (config.enabled) {
   *   console.log('Strategy:', config.dependencyResolutionStrategy);
   * }
   * ```
   */
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
            const paths = this.parseCommaSeparatedInput(input);
            return this.validatePaths(
              paths,
              path => this.fileService.directoryExists(path),
              'Directory does not exist',
            );
          },
          filter: (input: string) => this.parseCommaSeparatedInput(input),
        },
      ]);
      customPaths = this.ensureStringArray(pathsAnswer.customPaths);
    }

    return {
      enabled: true,
      dependencyResolutionStrategy: strategyAnswer.dependencyResolutionStrategy,
      ...(workspaceRoot !== undefined && { workspaceRoot }),
      ...(customPaths !== undefined && { customPaths }),
    };
  }

  /**
   * Displays a preview of how files will be named based on the configuration.
   *
   * @param config - File naming configuration
   * @example
   * ```typescript
   * service.showFileNamePreview({ namingConvention: 'kebab-case', suffix: 'builder' });
   * // Outputs: 📝 user-profile.builder.ts
   * ```
   */
  showFileNamePreview(config: FileNamingConfig): void {
    const preview = this.namingService.getFileNamePreview(config);
    console.log(`\n📝 ${preview}`);
  }

  /**
   * Prompts user to select specific types from a list of available types.
   *
   * @param types - Array of available types to select from
   * @returns Promise resolving to selected types
   * @example
   * ```typescript
   * const selected = await service.selectTypes([
   *   { file: 'user.ts', type: 'User' },
   *   { file: 'user.ts', type: 'UserConfig' }
   * ]);
   * ```
   */
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

  private groupInterfacesByFile(
    interfaces: DiscoveredInterface[],
  ): Array<SeparatorInstance | { name: string; value: DiscoveredInterface }> {
    const grouped = new Map<string, DiscoveredInterface[]>();

    for (const iface of interfaces) {
      if (!grouped.has(iface.file)) {
        grouped.set(iface.file, []);
      }
      const fileInterfaces = grouped.get(iface.file);
      if (fileInterfaces) {
        fileInterfaces.push(iface);
      }
    }

    const choices: Array<SeparatorInstance | { name: string; value: DiscoveredInterface }> = [];

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
