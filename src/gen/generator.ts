import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type {
  ResolvedType,
  TypeInfo,
  GeneratorOptions,
} from "../core/types.js";
import { TypeKind } from "../core/types.js";
import {
  PluginManager,
  HookType,
  type BuildMethodContext,
} from "../core/plugin.js";
import {
  getCommonFileTemplate,
  getSingleFileUtilitiesTemplate,
} from "./template-generator.js";
import { ImportGenerator } from "./import-generator.js";
import { TypeStringGenerator } from "./type-string-generator.js";
import { DefaultValueGenerator } from "./default-value-generator.js";
import { MethodGenerator } from "./method-generator.js";

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
}

/**
 * Main builder generator class
 * Orchestrates code generation for fluent builders
 */
export class BuilderGenerator {
  private readonly config: Required<GeneratorConfig>;
  private readonly pluginManager: PluginManager;
  private readonly generatedBuilders = new Set<string>();
  private readonly importGenerator: ImportGenerator;
  private readonly typeStringGenerator: TypeStringGenerator;
  private readonly defaultValueGenerator: DefaultValueGenerator;
  private readonly methodGenerator: MethodGenerator;
  private isGeneratingMultiple = false;

  constructor(config: GeneratorConfig = {}, pluginManager?: PluginManager) {
    this.config = {
      outputPath: config.outputPath ?? "./generated",
      useDefaults: config.useDefaults ?? true,
      contextType: config.contextType ?? "BaseBuildContext",
      importPath: "./common", // Always use ./common for consistency
      addComments: config.addComments ?? true,
      indentSize: config.indentSize ?? 2,
      useTab: config.useTab ?? false,
      generateCommonFile: false, // Will be determined by isGeneratingMultiple
    };
    this.pluginManager = pluginManager ?? new PluginManager();
    this.importGenerator = new ImportGenerator();
    this.typeStringGenerator = new TypeStringGenerator();
    this.defaultValueGenerator = new DefaultValueGenerator();
    this.methodGenerator = new MethodGenerator();
  }

  async generate(resolvedType: ResolvedType): Promise<Result<string>> {
    if (resolvedType.typeInfo.kind === TypeKind.Enum) {
      return err(
        new Error(
          `Cannot generate builder for enum type: ${resolvedType.name}`,
        ),
      );
    }

    const hookResult = await this.pluginManager.executeHook(
      HookType.BeforeGenerate,
      { resolvedType, options: this.config },
    );

    if (!hookResult.ok) {
      return hookResult;
    }

    try {
      const code = await this.generateBuilder(resolvedType);

      // TODO: Re-enable prettier formatting when standalone bundle issue is resolved
      // const formattedCode = await prettier.format(code, {
      //   parser: "typescript",
      //   semi: true,
      //   singleQuote: false,
      //   trailingComma: "all",
      //   printWidth: 100,
      // });

      const afterHook = await this.pluginManager.executeHook(
        HookType.AfterGenerate,
        code, // Using unformatted code temporarily
        { resolvedType, options: this.config },
      );

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
   * Generates the common utilities file content
   */
  generateCommonFile(): string {
    return getCommonFileTemplate();
  }

  private async generateBuilder(resolvedType: ResolvedType): Promise<string> {
    const { name, typeInfo } = resolvedType;

    if (this.generatedBuilders.has(name)) {
      return "";
    }

    this.generatedBuilders.add(name);

    const parts: string[] = [];

    // If generating a single file, add utilities at the beginning
    if (!this.isGeneratingMultiple) {
      parts.push(getSingleFileUtilitiesTemplate());
    }

    // Add the main builder parts
    parts.push(
      this.generateImports(resolvedType),
      await this.generateBuilderInterface(name, typeInfo),
      await this.generateBuilderClass(name, typeInfo, resolvedType),
      this.generateFactoryFunction(name, typeInfo),
    );

    // Do NOT generate nested builders automatically
    // Each type should have its builder generated explicitly when requested
    // Properties will accept FluentBuilder<T> | T to handle both cases

    return parts.filter(Boolean).join("\n\n");
  }

  /**
   * Generates import statements for the builder
   */
  private generateImports(resolvedType: ResolvedType): string {
    return this.importGenerator.generateAllImports(resolvedType, {
      isGeneratingMultiple: this.isGeneratingMultiple,
      commonImportPath: "./common.js",
      pluginManager: this.pluginManager,
    });
  }

  /**
   * Generates the builder interface
   */
  private async generateBuilderInterface(
    name: string,
    typeInfo: TypeInfo,
  ): Promise<string> {
    return this.methodGenerator.generateBuilderInterface(name, typeInfo, {
      addComments: this.config.addComments,
      contextType: this.config.contextType,
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
    const genericParams = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericParams(typeInfo.genericParams)
      : "";
    const genericConstraints = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericConstraints(
          typeInfo.genericParams,
        )
      : "";

    // Generate static defaults
    const defaults = this.defaultValueGenerator.generateDefaultsObject(
      typeInfo,
      {
        useDefaults: this.config.useDefaults,
      },
    );
    const defaultsCode = defaults
      ? `  private static readonly defaults: Record<string, unknown> = ${defaults};`
      : "";

    // Generate methods
    const methods = await this.methodGenerator.generateClassMethods(
      typeInfo,
      builderName,
      genericConstraints,
      {
        addComments: this.config.addComments,
        contextType: this.config.contextType,
        pluginManager: this.pluginManager,
      },
      name,
    );

    const buildMethod = await this.generateBuildMethodWithPlugins(
      name,
      typeInfo,
      resolvedType,
    );

    return `
export class ${builderName}${genericParams} extends FluentBuilderBase<${name}${genericConstraints}> implements ${builderName}Methods${genericConstraints}, FluentBuilder<${name}${genericConstraints}, BaseBuildContext> {
${defaultsCode}

  constructor(initial?: Partial<${name}${genericConstraints}>) {
    super(initial);
  }

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
    const genericParams = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericParams(typeInfo.genericParams)
      : "";
    const genericConstraints = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericConstraints(
          typeInfo.genericParams,
        )
      : "";
    const properties = isObjectType(typeInfo) ? typeInfo.properties : [];

    // Generate enhanced build method with value transformations
    let buildMethodCode = await this.generateEnhancedBuildMethod(
      name,
      typeInfo,
      genericConstraints,
    );

    // Apply plugin transformations if available
    for (const plugin of this.pluginManager.getPlugins()) {
      if (plugin.transformBuildMethod) {
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

        const result = plugin.transformBuildMethod(context);
        if (result.ok) {
          buildMethodCode = result.value;
        }
      }
    }

    return buildMethodCode;
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
    const defaultsReference = hasDefaults
      ? `${builderName}.defaults`
      : "undefined";

    return `  /**
   * Builds the final ${typeName} object
   * @param context - Optional build context for nested builders
   */
  build(context?: ${this.config.contextType}): ${typeName}${genericConstraints} {
    return this.buildWithDefaults(${defaultsReference}, context);
  }`;
  }

  /**
   * Checks if a type has default values
   */
  private hasDefaultValues(typeInfo: TypeInfo): boolean {
    return (
      this.defaultValueGenerator.generateDefaultsObject(typeInfo, {
        useDefaults: this.config.useDefaults,
      }) !== null
    );
  }

  /**
   * Generates the factory function for creating builders
   */
  private generateFactoryFunction(name: string, typeInfo: TypeInfo): string {
    const builderName = this.getBuilderName(name);
    const funcName = this.lowerFirst(name);
    const genericParams = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericParams(typeInfo.genericParams)
      : "";
    const genericConstraints = isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericConstraints(
          typeInfo.genericParams,
        )
      : "";

    // Add JSDoc for the factory function
    const jsDoc =
      this.config.addComments &&
      isObjectType(typeInfo) &&
      typeInfo.properties.length
        ? `/**\n * Creates a new ${name} builder\n * @param initial Optional initial values\n * @returns A fluent builder for ${name}\n */\n`
        : "";

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
   * Converts first character to lowercase
   */
  private lowerFirst(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}
