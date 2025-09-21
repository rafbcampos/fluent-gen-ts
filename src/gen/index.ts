import { BuilderGenerator } from './generator.js';
import type { GeneratorConfig } from './generator.js';
import { TypeExtractor } from '../type-info/index.js';
import type { TypeExtractorOptions } from '../type-info/index.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { PluginManager } from '../core/plugin.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export interface FluentGenOptions extends GeneratorConfig, TypeExtractorOptions {
  outputDir?: string;
  fileName?: string;
}

/**
 * Validates FluentGenOptions
 */
function validateOptions(options: FluentGenOptions): Result<void> {
  if (options.outputDir !== undefined) {
    if (typeof options.outputDir !== 'string' || options.outputDir.trim() === '') {
      return err(new Error('outputDir must be a non-empty string if provided'));
    }
  }

  if (options.fileName !== undefined) {
    if (typeof options.fileName !== 'string' || options.fileName.trim() === '') {
      return err(new Error('fileName must be a non-empty string if provided'));
    }
  }

  if (options.maxDepth !== undefined && (options.maxDepth < 1 || options.maxDepth > 100)) {
    return err(new Error('maxDepth must be between 1 and 100'));
  }

  if (options.tsConfigPath !== undefined) {
    if (typeof options.tsConfigPath !== 'string' || options.tsConfigPath.trim() === '') {
      return err(new Error('tsConfigPath must be a non-empty string if provided'));
    }
  }

  return ok(undefined);
}

/**
 * Extracts TypeExtractor options from FluentGenOptions
 */
function extractTypeExtractorOptions({
  tsConfigPath,
  cache,
  pluginManager,
  maxDepth,
}: FluentGenOptions): TypeExtractorOptions {
  const options: TypeExtractorOptions = {};

  if (tsConfigPath !== undefined) {
    options.tsConfigPath = tsConfigPath;
  }

  if (cache !== undefined) {
    options.cache = cache;
  }

  if (pluginManager !== undefined) {
    options.pluginManager = pluginManager;
  }

  if (maxDepth !== undefined) {
    options.maxDepth = maxDepth;
  }

  return options;
}

/**
 * Extracts BuilderGenerator options from FluentGenOptions
 */
function extractGeneratorConfig({
  outputPath,
  useDefaults,
  contextType,
  addComments,
}: FluentGenOptions): GeneratorConfig {
  const config: GeneratorConfig = {};

  if (outputPath !== undefined) {
    config.outputPath = outputPath;
  }

  if (useDefaults !== undefined) {
    config.useDefaults = useDefaults;
  }

  if (contextType !== undefined) {
    config.contextType = contextType;
  }

  if (addComments !== undefined) {
    config.addComments = addComments;
  }

  return config;
}

/**
 * Validates file path parameter
 */
function validateFilePath(filePath: string): Result<void> {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return err(new Error('filePath must be a non-empty string'));
  }

  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.d.ts')) {
    return err(new Error('filePath must be a TypeScript file (.ts, .tsx, or .d.ts)'));
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

export class FluentGen {
  private readonly extractor: TypeExtractor;
  private readonly generator: BuilderGenerator;
  private readonly pluginManager: PluginManager;
  private readonly options: FluentGenOptions;

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

  async generateBuilder(filePath: string, typeName: string): Promise<Result<string>> {
    // Validate inputs
    const filePathValidation = validateFilePath(filePath);
    if (!filePathValidation.ok) {
      return filePathValidation;
    }

    const typeNameValidation = validateTypeName(typeName);
    if (!typeNameValidation.ok) {
      return typeNameValidation;
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

  clearCache(): void {
    this.generator.clearCache();
  }

  async generateMultiple(
    filePath: string,
    typeNames: string[],
  ): Promise<Result<Map<string, string>>> {
    // Validate inputs
    const filePathValidation = validateFilePath(filePath);
    if (!filePathValidation.ok) {
      return filePathValidation;
    }

    const typeNamesValidation = validateTypeNames(typeNames);
    if (!typeNamesValidation.ok) {
      return typeNamesValidation;
    }

    try {
      // Set generator to multiple mode
      this.generator.setGeneratingMultiple(true);

      const results = new Map<string, string>();

      // Generate common.ts file
      results.set('common.ts', this.generator.generateCommonFile());

      // Generate each builder
      for (const typeName of typeNames) {
        const result = await this.generateBuilder(filePath, typeName);
        if (!result.ok) {
          return result;
        }
        results.set(`${typeName}.builder.ts`, result.value);
      }

      return ok(results);
    } finally {
      // Reset generator state
      this.generator.setGeneratingMultiple(false);
      this.generator.clearCache();
    }
  }

  async generateToFile(
    filePath: string,
    typeName: string,
    outputPath?: string,
  ): Promise<Result<string>> {
    // Validate inputs
    const filePathValidation = validateFilePath(filePath);
    if (!filePathValidation.ok) {
      return filePathValidation;
    }

    const typeNameValidation = validateTypeName(typeName);
    if (!typeNameValidation.ok) {
      return typeNameValidation;
    }

    if (outputPath !== undefined) {
      if (typeof outputPath !== 'string' || outputPath.trim() === '') {
        return err(new Error('outputPath must be a non-empty string if provided'));
      }
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
    const patternValidation = validatePattern(pattern);
    if (!patternValidation.ok) {
      return patternValidation;
    }

    try {
      // Dynamic import with proper typing
      const globModule = (await import('glob')) as {
        glob: (pattern: string) => Promise<string[]>;
      };
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

  registerPlugin(plugin: import('../core/plugin.js').Plugin): Result<void> {
    try {
      this.pluginManager.register(plugin);
      return ok(undefined);
    } catch (error) {
      return err(new Error(`Failed to register plugin: ${error}`));
    }
  }

  private getOutputPath(typeName: string): string {
    const outputDir = this.options.outputDir ?? './generated';
    const fileName = this.options.fileName ?? `${typeName.toLowerCase()}.builder.ts`;

    return path.join(outputDir, fileName);
  }
}

export { BuilderGenerator } from './generator.js';
export type { GeneratorConfig } from './generator.js';
