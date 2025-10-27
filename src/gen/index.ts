import { BuilderGenerator } from './generator.js';
import type { GeneratorConfig } from './generator.js';
import { TypeExtractor } from '../type-info/index.js';
import type { TypeExtractorOptions } from '../type-info/index.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { PluginManager } from '../core/plugin/index.js';
import type { Plugin } from '../core/plugin/index.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Configuration options for FluentGen code generator
 *
 * @extends GeneratorConfig
 * @extends TypeExtractorOptions
 */
export interface FluentGenOptions extends GeneratorConfig, TypeExtractorOptions {
  /** Directory where generated files will be written */
  outputDir?: string;
  /** Custom filename for generated builder files */
  fileName?: string;
}

/**
 * Validates that a string option is non-empty if provided
 */
function validateStringOption(value: string | undefined, fieldName: string): Result<void> {
  if (value !== undefined) {
    if (typeof value !== 'string' || value.trim() === '') {
      return err(new Error(`${fieldName} must be a non-empty string if provided`));
    }
  }
  return ok(undefined);
}

/**
 * Runs multiple validations and returns the first error encountered
 */
function combineValidations(...validations: Result<void>[]): Result<void> {
  for (const validation of validations) {
    if (!validation.ok) {
      return validation;
    }
  }
  return ok(undefined);
}

/**
 * Validates FluentGenOptions
 */
function validateOptions(options: FluentGenOptions): Result<void> {
  const maxDepthValidation =
    options.maxDepth !== undefined && (options.maxDepth < 1 || options.maxDepth > 100)
      ? err(new Error('maxDepth must be between 1 and 100'))
      : ok(undefined);

  return combineValidations(
    validateStringOption(options.outputDir, 'outputDir'),
    validateStringOption(options.fileName, 'fileName'),
    validateStringOption(options.tsConfigPath, 'tsConfigPath'),
    maxDepthValidation,
  );
}

/**
 * Extracts specified properties from source object to target object if they are defined
 */
function extractDefinedProperties<T, K extends keyof T>(
  source: T,
  target: Partial<T>,
  keys: K[],
): void {
  for (const key of keys) {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
}

/**
 * Extracts TypeExtractor options from FluentGenOptions
 */
function extractTypeExtractorOptions(options: FluentGenOptions): TypeExtractorOptions {
  const result: TypeExtractorOptions = {};
  extractDefinedProperties(options, result, [
    'tsConfigPath',
    'cache',
    'pluginManager',
    'maxDepth',
    'monorepoConfig',
  ]);
  return result;
}

/**
 * Extracts BuilderGenerator options from FluentGenOptions
 */
function extractGeneratorConfig(options: FluentGenOptions): GeneratorConfig {
  const result: GeneratorConfig = {};
  extractDefinedProperties(options, result, [
    'outputPath',
    'outputDir',
    'useDefaults',
    'contextType',
    'customCommonFilePath',
    'addComments',
    'tsConfigPath',
    'namingStrategy',
  ]);
  return result;
}

/**
 * Validates file path parameter
 */
function validateFilePath(filePath: string): Result<void> {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return err(new Error('filePath must be a non-empty string'));
  }

  const validExtensions = ['.ts', '.tsx', '.d.ts', '.js', '.jsx'];
  const hasValidExtension = validExtensions.some(ext => filePath.endsWith(ext));

  if (!hasValidExtension) {
    return err(
      new Error('filePath must be a TypeScript or JavaScript file (.ts, .tsx, .d.ts, .js, .jsx)'),
    );
  }

  return ok(undefined);
}

/**
 * Validates type name parameter
 */
function validateTypeName(typeName: string): Result<void> {
  if (typeof typeName !== 'string' || typeName.trim() === '') {
    return err(new Error('typeName must be a non-empty string'));
  }

  // Basic validation for valid TypeScript identifier
  const identifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  if (!identifierRegex.test(typeName)) {
    return err(new Error(`typeName '${typeName}' is not a valid TypeScript identifier`));
  }

  return ok(undefined);
}

/**
 * Validates array of type names
 */
function validateTypeNames(typeNames: string[]): Result<void> {
  if (!Array.isArray(typeNames)) {
    return err(new Error('typeNames must be an array'));
  }

  if (typeNames.length === 0) {
    return err(new Error('typeNames array cannot be empty'));
  }

  for (const typeName of typeNames) {
    const validation = validateTypeName(typeName);
    if (!validation.ok) {
      return validation;
    }
  }

  return ok(undefined);
}

/**
 * Validates glob pattern parameter
 */
function validatePattern(pattern: string): Result<void> {
  if (typeof pattern !== 'string' || pattern.trim() === '') {
    return err(new Error('pattern must be a non-empty string'));
  }

  return ok(undefined);
}

/**
 * Executes a function with generator state management (multiple mode + cleanup)
 */
async function withGeneratorStateManagement<T>(
  generator: BuilderGenerator,
  extractor: TypeExtractor,
  operation: () => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    generator.setGeneratingMultiple(true);
    return await operation();
  } finally {
    generator.setGeneratingMultiple(false);
    generator.clearCache();
    extractor.clearCache();
  }
}

/**
 * Main FluentGen class for generating fluent builder patterns from TypeScript types
 *
 * @example
 * ```typescript
 * const generator = new FluentGen({
 *   outputDir: './generated',
 *   useDefaults: true
 * });
 *
 * const result = await generator.generateBuilder('./types.ts', 'User');
 * if (result.ok) {
 *   console.log('Generated:', result.value);
 * }
 * ```
 */
export class FluentGen {
  private readonly extractor: TypeExtractor;
  private readonly generator: BuilderGenerator;
  private readonly pluginManager: PluginManager;
  private readonly options: FluentGenOptions;

  /**
   * Creates a new FluentGen instance
   *
   * @param options - Configuration options for the generator
   * @throws {Error} When options validation fails
   */
  constructor(options: FluentGenOptions = {}) {
    const validationResult = validateOptions(options);
    if (!validationResult.ok) {
      throw new Error(`Invalid FluentGen options: ${validationResult.error.message}`);
    }

    this.options = options;
    this.pluginManager = options.pluginManager ?? new PluginManager();

    const extractorOptions = extractTypeExtractorOptions({
      ...options,
      pluginManager: this.pluginManager,
    });

    const generatorConfig = extractGeneratorConfig(options);

    this.extractor = new TypeExtractor(extractorOptions);
    this.generator = new BuilderGenerator(generatorConfig, this.pluginManager);
  }

  /**
   * Determines whether common.ts should be generated based on configuration
   * @returns true if common.ts should be generated, false if user has custom common file
   */
  private shouldGenerateCommonFile(): boolean {
    // If customCommonFilePath is provided, user has their own common file
    return this.options.customCommonFilePath === undefined;
  }

  /**
   * Generates a fluent builder for a specific type from a TypeScript file
   *
   * @param filePath - Path to the TypeScript file containing the type
   * @param typeName - Name of the type to generate a builder for
   * @returns Promise resolving to Result containing the generated builder code
   *
   * @example
   * ```typescript
   * const result = await generator.generateBuilder('./user.ts', 'User');
   * if (result.ok) {
   *   console.log(result.value); // Generated builder code
   * } else {
   *   console.error(result.error.message);
   * }
   * ```
   */
  async generateBuilder(filePath: string, typeName: string): Promise<Result<string>> {
    // Validate inputs
    const validation = combineValidations(validateFilePath(filePath), validateTypeName(typeName));
    if (!validation.ok) {
      return validation;
    }

    const extractResult = await this.extractor.extractType(filePath, typeName);
    if (!extractResult.ok) {
      return extractResult;
    }

    const generateResult = await this.generator.generate(extractResult.value);
    if (!generateResult.ok) {
      return generateResult;
    }

    return ok(generateResult.value);
  }

  /**
   * Clears the internal cache used by the generator
   * Useful when processing multiple unrelated type generations
   */
  clearCache(): void {
    this.generator.clearCache();
  }

  /**
   * Generates builders for multiple types from a single TypeScript file
   * Also generates a common.ts file with shared utilities
   *
   * @param filePath - Path to the TypeScript file containing the types
   * @param typeNames - Array of type names to generate builders for
   * @returns Promise resolving to Result containing a Map of filename to generated code
   *
   * @example
   * ```typescript
   * const result = await generator.generateMultiple('./types.ts', ['User', 'Product']);
   * if (result.ok) {
   *   for (const [filename, code] of result.value) {
   *     console.log(`File: ${filename}`);
   *     console.log(code);
   *   }
   * }
   * ```
   */
  async generateMultiple(
    filePath: string,
    typeNames: string[],
  ): Promise<Result<Map<string, string>>> {
    // Validate inputs
    const validation = combineValidations(validateFilePath(filePath), validateTypeNames(typeNames));
    if (!validation.ok) {
      return validation;
    }

    return withGeneratorStateManagement(this.generator, this.extractor, async () => {
      const results = new Map<string, string>();

      // Generate common.ts file only if configured to do so
      if (this.shouldGenerateCommonFile()) {
        results.set('common.ts', this.generator.generateCommonFile());
      }

      // Generate each builder
      for (const typeName of typeNames) {
        const result = await this.generateBuilder(filePath, typeName);
        if (!result.ok) {
          return result;
        }
        results.set(`${typeName}.builder.ts`, result.value);
      }

      return ok(results);
    });
  }

  async generateMultipleFromFiles(
    fileTypeMap: Map<string, string[]>,
  ): Promise<Result<Map<string, string>>> {
    // Validate inputs
    if (!fileTypeMap || fileTypeMap.size === 0) {
      return err(new Error('fileTypeMap cannot be empty'));
    }

    for (const [filePath, typeNames] of fileTypeMap) {
      const filePathValidation = validateFilePath(filePath);
      if (!filePathValidation.ok) {
        return filePathValidation;
      }

      const typeNamesValidation = validateTypeNames(typeNames);
      if (!typeNamesValidation.ok) {
        return typeNamesValidation;
      }
    }

    return withGeneratorStateManagement(this.generator, this.extractor, async () => {
      const results = new Map<string, string>();

      // Generate common.ts file only if configured to do so
      if (this.shouldGenerateCommonFile()) {
        results.set('common.ts', this.generator.generateCommonFile());
      }

      // Generate builders from each file
      for (const [filePath, typeNames] of fileTypeMap) {
        // Reset resolver state before processing each file to prevent depth accumulation
        this.extractor.clearCache();

        for (const typeName of typeNames) {
          const result = await this.generateBuilder(filePath, typeName);
          if (!result.ok) {
            return result;
          }

          // Prevent name collisions by including file info when duplicate type names exist
          const baseKey = `${typeName}.builder.ts`;
          let finalKey = baseKey;
          if (results.has(baseKey)) {
            const fileBaseName = path.basename(filePath, path.extname(filePath));
            finalKey = `${typeName}.${fileBaseName}.builder.ts`;
          }

          results.set(finalKey, result.value);
        }
      }

      return ok(results);
    });
  }

  async generateToFile(
    filePath: string,
    typeName: string,
    outputPath?: string,
  ): Promise<Result<string>> {
    // Validate inputs
    const validation = combineValidations(
      validateFilePath(filePath),
      validateTypeName(typeName),
      validateStringOption(outputPath, 'outputPath'),
    );
    if (!validation.ok) {
      return validation;
    }

    const code = await this.generateBuilder(filePath, typeName);
    if (!code.ok) {
      return code;
    }

    const output = outputPath ?? this.getOutputPath(typeName);

    try {
      const dir = path.dirname(output);
      await mkdir(dir, { recursive: true });
      await writeFile(output, code.value, 'utf-8');

      return ok(output);
    } catch (error) {
      return err(new Error(`Failed to write file: ${error}`));
    }
  }

  async scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>> {
    // Validate input
    const validation = validatePattern(pattern);
    if (!validation.ok) {
      return validation;
    }

    try {
      // Dynamic import with proper type checking
      const globModule = await import('glob');
      if (typeof globModule.glob !== 'function') {
        return err(new Error('Invalid glob module: missing glob function'));
      }
      const files = await globModule.glob(pattern);
      const results = new Map<string, string>();

      for (const file of files) {
        const scanResult = await this.extractor.scanFile(file);
        if (!scanResult.ok) {
          continue;
        }

        for (const typeName of scanResult.value) {
          const genResult = await this.generateBuilder(file, typeName);
          if (genResult.ok) {
            const key = `${file}:${typeName}`;
            results.set(key, genResult.value);
          }
        }
      }

      return ok(results);
    } catch (error) {
      return err(new Error(`Failed to scan and generate: ${error}`));
    }
  }

  /**
   * Registers a plugin with the generator
   *
   * @param plugin - The plugin to register
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * const result = generator.registerPlugin({
   *   name: 'my-plugin',
   *   version: '1.0.0',
   *   // ... plugin implementation
   * });
   * if (!result.ok) {
   *   console.error('Plugin registration failed:', result.error.message);
   * }
   * ```
   */
  registerPlugin(plugin: Plugin): Result<void> {
    try {
      this.pluginManager.register(plugin);
      return ok(undefined);
    } catch (error) {
      return err(new Error(`Failed to register plugin: ${error}`));
    }
  }

  private getOutputPath(typeName: string): string {
    const outputDir = this.options.outputDir ?? './generated';
    const fileName =
      this.options.fileName ?? `${typeName.charAt(0).toLowerCase() + typeName.slice(1)}.builder.ts`;

    return path.join(outputDir, fileName);
  }
}

export { BuilderGenerator } from './generator.js';
export type { GeneratorConfig } from './generator.js';
