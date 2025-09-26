import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { ResolvedType, TypeInfo, GeneratorOptions } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import { PluginManager, HookType, type BuildMethodContext } from '../core/plugin/index.js';
import { getCommonFileTemplate, getSingleFileUtilitiesTemplate } from './template-generator.js';
import { ImportGenerator } from './import-generator/index.js';
import { TypeStringGenerator } from './type-string-generator.js';
import { DefaultValueGenerator } from './default-value-generator.js';
import { MethodGenerator } from './method-generator.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Constants
const DEFAULT_OUTPUT_PATH = './generated';
const DEFAULT_CONTEXT_TYPE = 'BaseBuildContext';

/**
 * Type guard to check if typeInfo is an object type
 */
const isObjectType = (
  typeInfo: TypeInfo,
): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> => {
  return typeInfo.kind === TypeKind.Object;
};

export interface GeneratorConfig extends GeneratorOptions {
  addComments?: boolean;
  generateCommonFile?: boolean;
  outputDir?: string;
  tsConfigPath?: string;
  namingStrategy?: (typeName: string) => string;
}

/**
 * Main builder generator class
 * Orchestrates code generation for fluent builders
 */
export class BuilderGenerator {
  private readonly config: GeneratorConfig;
  private readonly pluginManager: PluginManager;
  private readonly generatedBuilders = new Set<string>();
  private readonly importGenerator: ImportGenerator;
  private readonly typeStringGenerator: TypeStringGenerator;
  private readonly defaultValueGenerator: DefaultValueGenerator;
  private readonly methodGenerator: MethodGenerator;
  private isGeneratingMultiple = false;

  constructor(config: GeneratorConfig = {}, pluginManager?: PluginManager) {
    this.config = config;
    this.pluginManager = pluginManager ?? new PluginManager();
    this.importGenerator = new ImportGenerator(config.tsConfigPath);
    this.typeStringGenerator = new TypeStringGenerator();
    this.defaultValueGenerator = new DefaultValueGenerator();
    this.methodGenerator = new MethodGenerator();
  }

  private getContextType(): string {
    return this.config.contextType ?? DEFAULT_CONTEXT_TYPE;
  }

  private getUseDefaults(): boolean {
    return this.config.useDefaults ?? true;
  }

  private getAddComments(): boolean {
    return this.config.addComments ?? true;
  }

  private getOutputDir(): string | undefined {
    return this.config.outputDir;
  }

  async generate(resolvedType: ResolvedType): Promise<Result<string>> {
    if (resolvedType.typeInfo.kind === TypeKind.Enum) {
      return err(new Error(`Cannot generate builder for enum type: ${resolvedType.name}`));
    }

    const hookResult = await this.pluginManager.executeHook({
      hookType: HookType.BeforeGenerate,
      input: { resolvedType, options: this.config as Record<string, unknown> },
    });

    if (!hookResult.ok) {
      return err(new Error(`BeforeGenerate hook failed`));
    }

    try {
      const code = await this.generateBuilder(resolvedType);

      const afterHook = await this.pluginManager.executeHook({
        hookType: HookType.AfterGenerate,
        input: code,
        additionalArgs: [{ resolvedType, options: this.config as Record<string, unknown> }],
      });

      if (!afterHook.ok) {
        return afterHook;
      }

      return ok(afterHook.value);
    } catch (error) {
      return err(new Error(`Failed to generate builder: ${error}`));
    }
  }

  /**
   * Clears internal caches and resets state
   */
  clearCache(): void {
    this.generatedBuilders.clear();
    this.isGeneratingMultiple = false;
  }

  /**
   * Sets whether generating multiple files
   * @param value - True if generating multiple files
   */
  setGeneratingMultiple(value: boolean): void {
    this.isGeneratingMultiple = value;
  }

  /**
   * Checks if a common.ts file exists in the specified directory
   * @param outputDir - The directory to check for common.ts
   * @returns True if common.ts exists
   */
  private hasExistingCommonFile(outputDir: string): boolean {
    try {
      const commonTsPath = path.join(outputDir, 'common.ts');
      return fs.existsSync(commonTsPath);
    } catch {
      return false;
    }
  }

  /**
   * Generates the common utilities file content
   */
  generateCommonFile(): string {
    return getCommonFileTemplate();
  }

  private async generateBuilder(resolvedType: ResolvedType): Promise<string> {
    const { name, typeInfo } = resolvedType;

    if (this.generatedBuilders.has(name)) {
      return '';
    }

    this.generatedBuilders.add(name);

    const parts: string[] = [];

    // If generating a single file, check for existing common.ts and add utilities accordingly
    if (!this.isGeneratingMultiple) {
      // Use configured outputDir or fall back to default output path
      const checkDir = this.getOutputDir() || DEFAULT_OUTPUT_PATH;
      const hasCommon = this.hasExistingCommonFile(checkDir);
      if (hasCommon) {
        // common.ts exists, imports will be handled by ImportGenerator
        // Don't inline utilities
      } else {
        // No common.ts found, inline utilities
        parts.push(getSingleFileUtilitiesTemplate());
      }
    }

    // Add the main builder parts
    parts.push(
      await this.generateImports(resolvedType),
      await this.generateBuilderInterface(name, typeInfo),
      await this.generateBuilderClass(name, typeInfo, resolvedType),
      this.generateFactoryFunction(name, typeInfo),
    );

    // Do NOT generate nested builders automatically
    // Each type should have its builder generated explicitly when requested
    // Properties will accept FluentBuilder<T> | T to handle both cases

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generates import statements for the builder
   */
  private async generateImports(resolvedType: ResolvedType): Promise<string> {
    // Use configured outputDir or fall back to default output path
    const checkDir = this.getOutputDir() || DEFAULT_OUTPUT_PATH;
    const hasCommon = this.hasExistingCommonFile(checkDir);

    const result = await this.importGenerator.generateAllImports({
      resolvedType,
      config: {
        isGeneratingMultiple: this.isGeneratingMultiple,
        hasExistingCommon: hasCommon,
        commonImportPath: './common.js',
        pluginManager: this.pluginManager,
        outputDir: checkDir,
      },
    });

    if (!result.ok) {
      throw new Error(`Failed to generate imports: ${result.error.message}`);
    }

    return result.value;
  }

  /**
   * Generates the builder interface
   */
  private async generateBuilderInterface(name: string, typeInfo: TypeInfo): Promise<string> {
    return this.methodGenerator.generateBuilderInterface(name, typeInfo, {
      addComments: this.getAddComments(),
      contextType: this.getContextType(),
      pluginManager: this.pluginManager,
    });
  }

  /**
   * Generates the builder class implementation
   */
  private async generateBuilderClass(
    name: string,
    typeInfo: TypeInfo,
    resolvedType: ResolvedType,
  ): Promise<string> {
    const builderName = this.getBuilderName(name);
    const { genericParams, genericConstraints } = this.extractGenericInfo(typeInfo);

    const defaultsCode = this.generateDefaultsCode(typeInfo);
    const methods = await this.generateMethodsCode(typeInfo, builderName, genericConstraints, name);
    const buildMethod = await this.generateBuildMethodWithPlugins(name, typeInfo, resolvedType);

    return this.formatBuilderClass({
      builderName,
      genericParams,
      genericConstraints,
      name,
      defaultsCode,
      methods,
      buildMethod,
    });
  }

  /**
   * Extracts generic parameter information from TypeInfo
   */
  private extractGenericInfo(typeInfo: TypeInfo): {
    genericParams: string;
    genericConstraints: string;
  } {
    if (!isObjectType(typeInfo)) {
      return { genericParams: '', genericConstraints: '' };
    }

    // If there are no generic parameters at all, return empty
    if (!typeInfo.genericParams || typeInfo.genericParams.length === 0) {
      return { genericParams: '', genericConstraints: '' };
    }

    // The fundamental question: does this type actually need parameterization?
    // Check if all the type's properties are fully resolved (no unresolved generics)
    if (this.areAllTypeParametersResolved(typeInfo)) {
      return { genericParams: '', genericConstraints: '' };
    }

    return {
      genericParams: this.typeStringGenerator.formatGenericParams(typeInfo.genericParams),
      genericConstraints: this.typeStringGenerator.formatGenericConstraints(typeInfo.genericParams),
    };
  }

  /**
   * Checks if all type parameters in the resolved type are actually resolved
   * to concrete types, meaning the builder doesn't need generic parameters
   */
  private areAllTypeParametersResolved(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>,
  ): boolean {
    // Walk through all properties and check if any still reference unresolved generics
    return this.checkPropertiesForUnresolvedGenerics(typeInfo.properties);
  }

  /**
   * Recursively checks if properties contain any unresolved generic references
   */
  private checkPropertiesForUnresolvedGenerics(properties: readonly any[], depth = 0): boolean {
    // Prevent excessive recursion, especially for complex types like Date
    if (depth > 2) {
      return true;
    }

    for (const property of properties) {
      const isResolved = this.isTypeFullyResolved(property.type, depth + 1);
      if (!isResolved) {
        return false; // Found an unresolved generic, so we need type parameters
      }
    }

    return true; // All properties are fully resolved
  }

  /**
   * Checks if a type is fully resolved (no generic type references)
   */
  private isTypeFullyResolved(typeInfo: TypeInfo, depth = 0): boolean {
    // Prevent excessive recursion
    if (depth > 3) {
      return true;
    }

    switch (typeInfo.kind) {
      case TypeKind.Generic:
        // Generic types are by definition unresolved type parameters
        return false;

      case TypeKind.Primitive:
        // Primitives are always resolved unless they're generic type references
        // A generic type reference would have a name that matches a type parameter
        if ('name' in typeInfo && typeInfo.name) {
          const looksLikeParam = this.looksLikeTypeParameter(typeInfo.name);
          return !looksLikeParam;
        }
        return true;

      case TypeKind.Object:
        // For object types, check if they have unresolved generics in their properties
        if ('properties' in typeInfo && typeInfo.properties) {
          return this.checkPropertiesForUnresolvedGenerics(typeInfo.properties, depth);
        }
        return true;

      case TypeKind.Array:
        // Arrays are resolved if their element type is resolved
        return this.isTypeFullyResolved(typeInfo.elementType, depth + 1);

      case TypeKind.Union:
        // Unions are resolved if all union members are resolved
        return typeInfo.unionTypes.every(unionType =>
          this.isTypeFullyResolved(unionType, depth + 1),
        );

      case TypeKind.Intersection:
        // Intersections are resolved if all intersection members are resolved
        return typeInfo.intersectionTypes.every(intersectionType =>
          this.isTypeFullyResolved(intersectionType, depth + 1),
        );

      default:
        // For any other type kinds, assume they're resolved
        return true;
    }
  }

  /**
   * Heuristic to detect if a type name looks like a type parameter
   */
  private looksLikeTypeParameter(name: string): boolean {
    // Common patterns for type parameters:
    // - Single uppercase letters: T, U, V, K
    // - Short uppercase combinations: TKey, TValue
    // - Names starting with T followed by uppercase: TData, TResponse
    return /^[A-Z]$/.test(name) || /^T[A-Z]/.test(name) || /^[A-Z]{1,3}$/.test(name);
  }

  /**
   * Generates the defaults code for a builder
   */
  private generateDefaultsCode(typeInfo: TypeInfo): string {
    const defaults = this.defaultValueGenerator.generateDefaultsObject({
      typeInfo,
      config: { useDefaults: this.getUseDefaults() },
    });
    return defaults
      ? `  private static readonly defaults: Record<string, unknown> = ${defaults};`
      : '';
  }

  /**
   * Generates the methods code for a builder
   */
  private async generateMethodsCode(
    typeInfo: TypeInfo,
    builderName: string,
    genericConstraints: string,
    name: string,
  ): Promise<string> {
    return this.methodGenerator.generateClassMethods(
      typeInfo,
      builderName,
      genericConstraints,
      {
        addComments: this.getAddComments(),
        contextType: this.getContextType(),
        pluginManager: this.pluginManager,
      },
      name,
    );
  }

  /**
   * Formats the complete builder class string
   */
  private formatBuilderClass(params: {
    builderName: string;
    genericParams: string;
    genericConstraints: string;
    name: string;
    defaultsCode: string;
    methods: string;
    buildMethod: string;
  }): string {
    const {
      builderName,
      genericParams,
      genericConstraints,
      name,
      defaultsCode,
      methods,
      buildMethod,
    } = params;

    return `
/**
* A builder for ${name}
*/
export class ${builderName}${genericParams} extends FluentBuilderBase<${name}${genericConstraints}> implements ${builderName}Methods${genericConstraints}, FluentBuilder<${name}${genericConstraints}, BaseBuildContext> {
${defaultsCode}

${methods}

${buildMethod}

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return createInspectMethod("${builderName}", this.values);
  }
}
`.trim();
  }

  /**
   * Generates the build method with plugin transformations
   */
  private async generateBuildMethodWithPlugins(
    name: string,
    typeInfo: TypeInfo,
    resolvedType: ResolvedType,
  ): Promise<string> {
    const builderName = this.getBuilderName(name);
    const { genericParams, genericConstraints } = this.extractGenericInfo(typeInfo);
    const properties = isObjectType(typeInfo) ? typeInfo.properties : [];

    let buildMethodCode = await this.generateEnhancedBuildMethod(
      name,
      typeInfo,
      genericConstraints,
    );

    const context: BuildMethodContext = {
      buildMethodCode,
      typeInfo,
      typeName: name,
      builderName,
      genericParams,
      genericConstraints,
      properties,
      options: this.config,
      resolvedType,
    };

    return this.applyPluginTransformations(buildMethodCode, context);
  }

  /**
   * Applies plugin transformations to the build method
   */
  private applyPluginTransformations(
    buildMethodCode: string,
    baseContext: BuildMethodContext,
  ): string {
    let result = buildMethodCode;

    for (const plugin of this.pluginManager.getPlugins()) {
      if (!plugin.transformBuildMethod) continue;

      try {
        // Create a new context with current build method code
        const context: BuildMethodContext = {
          ...baseContext,
          buildMethodCode: result,
        };

        const transformed = plugin.transformBuildMethod(context);
        if (transformed.ok) {
          result = transformed.value;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Plugin '${plugin.name}' transformBuildMethod failed: ${errorMessage}`);
      }
    }

    return result;
  }

  /**
   * Generates enhanced build method with value transformations
   */
  private async generateEnhancedBuildMethod(
    typeName: string,
    typeInfo: TypeInfo,
    genericConstraints: string,
  ): Promise<string> {
    const builderName = this.getBuilderName(typeName);
    const hasDefaults = this.hasDefaultValues(typeInfo);
    const defaultsReference = hasDefaults ? `${builderName}.defaults` : 'undefined';

    return `  /**
   * Builds the final ${typeName} object
   * @param context - Optional build context for nested builders
   */
  build(context?: ${this.getContextType()}): ${typeName}${genericConstraints} {
    return this.buildWithDefaults(${defaultsReference}, context);
  }`;
  }

  /**
   * Checks if a type has default values
   */
  private hasDefaultValues(typeInfo: TypeInfo): boolean {
    return (
      this.defaultValueGenerator.generateDefaultsObject({
        typeInfo,
        config: { useDefaults: this.getUseDefaults() },
      }) !== null
    );
  }

  /**
   * Generates the factory function for creating builders
   */
  private generateFactoryFunction(name: string, typeInfo: TypeInfo): string {
    const builderName = this.getBuilderName(name);
    const funcName = this.config.namingStrategy
      ? this.config.namingStrategy(name)
      : this.lowerFirst(name);
    const genericParams = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericParams(typeInfo.genericParams)
      : '';
    const genericConstraints = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericConstraints(typeInfo.genericParams)
      : '';

    // Add JSDoc for the factory function
    const jsDoc =
      this.getAddComments() && isObjectType(typeInfo) && typeInfo.properties.length
        ? `/**\n * Creates a new ${name} builder\n * @param initial Optional initial values\n * @returns A fluent builder for ${name}\n */\n`
        : '';

    return `
${jsDoc}export function ${funcName}${genericParams}(initial?: Partial<${name}${genericConstraints}>): ${builderName}${genericConstraints} {
  return new ${builderName}${genericConstraints}(initial);
}
`.trim();
  }

  private getBuilderName(typeName: string): string {
    return `${typeName}Builder`;
  }

  /**
   * Converts PascalCase to camelCase, properly handling acronyms
   * Examples:
   * - APIRoute -> apiRoute
   * - UserAPI -> userAPI
   * - XMLHttpRequest -> xmlHttpRequest
   * - SimpleClass -> simpleClass
   */
  private lowerFirst(str: string): string {
    if (!str) return str;

    // If the string is only 1 character, just lowercase it
    if (str.length === 1) {
      return str.toLowerCase();
    }

    // If the string starts with multiple uppercase letters (acronym)
    // we need to lowercase them until we hit a non-uppercase letter
    let i = 0;
    while (i < str.length) {
      const char = str[i];
      if (char && char === char.toUpperCase() && /[A-Z]/.test(char)) {
        i++;
      } else {
        break;
      }
    }

    if (i === 0) {
      // No uppercase letters at start, return as-is
      return str;
    }

    if (i === 1) {
      // Only first letter is uppercase, simple case
      return str.charAt(0).toLowerCase() + str.slice(1);
    }

    if (i === str.length) {
      // Entire string is uppercase (like "RGB"), lowercase entire string
      return str.toLowerCase();
    }

    // Multiple uppercase letters followed by lowercase
    // Keep last uppercase letter with the following lowercase part
    // Example: "APIRoute" -> i=3, so "API" + "Route" -> "api" + "Route" = "apiRoute"
    return str.slice(0, i - 1).toLowerCase() + str.slice(i - 1);
  }
}
