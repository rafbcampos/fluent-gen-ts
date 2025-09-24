import type { Result } from '../result.js';
import { ok } from '../result.js';
import type {
  Plugin,
  PropertyMethodContext,
  BuilderContext,
  ValueContext,
  BuildMethodContext,
  PropertyMethodTransform,
  CustomMethod,
  ValueTransform,
  ImportTransformContext,
  ParseContext,
  ResolveContext,
  GenerateContext,
} from './plugin-types.js';
import type { TypeInfo, PropertyInfo } from '../types.js';
import type { Type } from 'ts-morph';
import { ImportManager } from './plugin-import-manager.js';
import type { CustomMethodDefinition } from './plugin-types.js';
import {
  PropertyMethodTransformBuilder,
  ValueTransformBuilder,
  BuildMethodTransformBuilder,
  CustomMethodBuilder,
} from './transform-builders.js';

/**
 * Fluent builder for creating plugins
 * Provides a type-safe, ergonomic API for defining plugin behavior
 */
export class PluginBuilder {
  private name: string;
  private version: string;
  private description?: string;
  private importManager?: ImportManager;

  // Hook functions
  private beforeParseHook?: (context: ParseContext) => Result<ParseContext>;
  private afterParseHook?: (context: ParseContext, type: Type) => Result<Type>;
  private beforeResolveHook?: (context: ResolveContext) => Result<ResolveContext>;
  private afterResolveHook?: (context: ResolveContext, typeInfo: TypeInfo) => Result<TypeInfo>;
  private beforeGenerateHook?: (context: GenerateContext) => Result<GenerateContext>;
  private afterGenerateHook?: (code: string, context: GenerateContext) => Result<string>;
  private transformTypeHook?: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>;
  private transformPropertyHook?: (property: PropertyInfo) => Result<PropertyInfo>;
  private transformImportsHook?: (
    context: ImportTransformContext,
  ) => Result<ImportTransformContext>;

  // Transform builders
  private propertyMethodTransformBuilder?: PropertyMethodTransformBuilder;
  private valueTransformBuilder?: ValueTransformBuilder;
  private buildMethodTransformBuilder?: BuildMethodTransformBuilder;
  private customMethods: CustomMethod[] = [];

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }

  /**
   * Set plugin description
   */
  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Configure plugin imports
   */
  requireImports(configurator: (manager: ImportManager) => ImportManager): this {
    this.importManager = configurator(new ImportManager());
    return this;
  }

  /**
   * Set beforeParse hook
   */
  beforeParse(hook: (context: ParseContext) => Result<ParseContext>): this {
    this.beforeParseHook = hook;
    return this;
  }

  /**
   * Set afterParse hook
   */
  afterParse(hook: (context: ParseContext, type: Type) => Result<Type>): this {
    this.afterParseHook = hook;
    return this;
  }

  /**
   * Set beforeResolve hook
   */
  beforeResolve(hook: (context: ResolveContext) => Result<ResolveContext>): this {
    this.beforeResolveHook = hook;
    return this;
  }

  /**
   * Set afterResolve hook
   */
  afterResolve(hook: (context: ResolveContext, typeInfo: TypeInfo) => Result<TypeInfo>): this {
    this.afterResolveHook = hook;
    return this;
  }

  /**
   * Set beforeGenerate hook
   */
  beforeGenerate(hook: (context: GenerateContext) => Result<GenerateContext>): this {
    this.beforeGenerateHook = hook;
    return this;
  }

  /**
   * Set afterGenerate hook
   */
  afterGenerate(hook: (code: string, context: GenerateContext) => Result<string>): this {
    this.afterGenerateHook = hook;
    return this;
  }

  /**
   * Set transformType hook
   */
  transformType(hook: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>): this {
    this.transformTypeHook = hook;
    return this;
  }

  /**
   * Set transformProperty hook
   */
  transformProperty(hook: (property: PropertyInfo) => Result<PropertyInfo>): this {
    this.transformPropertyHook = hook;
    return this;
  }

  /**
   * Configure property method transformations
   */
  transformPropertyMethods(
    configurator: (builder: PropertyMethodTransformBuilder) => PropertyMethodTransformBuilder,
  ): this {
    this.propertyMethodTransformBuilder = configurator(new PropertyMethodTransformBuilder());
    return this;
  }

  /**
   * Add a single custom method
   */
  addMethod(configurator: (builder: CustomMethodBuilder) => CustomMethodBuilder): this {
    const builder = configurator(new CustomMethodBuilder());
    const method = builder.build();

    // Convert CustomMethodDefinition to CustomMethod format
    const customMethod: CustomMethod = {
      name: method.name,
      signature: this.buildMethodSignature(method),
      implementation: this.buildMethodImplementation(method),
      ...(method.jsDoc ? { jsDoc: method.jsDoc } : {}),
    };

    this.customMethods.push(customMethod);
    return this;
  }

  /**
   * Configure value transformations
   */
  transformValues(configurator: (builder: ValueTransformBuilder) => ValueTransformBuilder): this {
    this.valueTransformBuilder = configurator(new ValueTransformBuilder());
    return this;
  }

  /**
   * Configure build method transformations
   */
  transformBuildMethod(
    configurator: (builder: BuildMethodTransformBuilder) => BuildMethodTransformBuilder,
  ): this {
    this.buildMethodTransformBuilder = configurator(new BuildMethodTransformBuilder());
    return this;
  }

  /**
   * Set transformImports hook
   */
  transformImports(
    hook: (context: ImportTransformContext) => Result<ImportTransformContext>,
  ): this {
    this.transformImportsHook = hook;
    return this;
  }

  /**
   * Build the final plugin
   */
  build(): Plugin {
    // Build property method transform if configured
    const transformPropertyMethod = this.propertyMethodTransformBuilder
      ? (context: PropertyMethodContext): Result<PropertyMethodTransform> => {
          const transformer = this.propertyMethodTransformBuilder!.build();
          const result = transformer(context);
          return ok(result || {});
        }
      : undefined;

    // Build custom methods if configured
    const addCustomMethods =
      this.customMethods.length > 0
        ? (_context: BuilderContext): Result<readonly CustomMethod[]> => {
            return ok(this.customMethods);
          }
        : undefined;

    // Build value transform if configured
    const transformValue = this.valueTransformBuilder
      ? (context: ValueContext): Result<ValueTransform | null> => {
          const transformer = this.valueTransformBuilder!.build();
          return ok(transformer(context));
        }
      : undefined;

    // Build method transform if configured
    const transformBuildMethod = this.buildMethodTransformBuilder
      ? (context: BuildMethodContext): Result<string> => {
          const transformer = this.buildMethodTransformBuilder!.build();
          return ok(transformer(context));
        }
      : undefined;

    const plugin: Plugin = {
      name: this.name,
      version: this.version,
      ...(this.description ? { description: this.description } : {}),
      ...(this.importManager ? { imports: this.importManager.build() } : {}),
      ...(this.beforeParseHook ? { beforeParse: this.beforeParseHook } : {}),
      ...(this.afterParseHook ? { afterParse: this.afterParseHook } : {}),
      ...(this.beforeResolveHook ? { beforeResolve: this.beforeResolveHook } : {}),
      ...(this.afterResolveHook ? { afterResolve: this.afterResolveHook } : {}),
      ...(this.beforeGenerateHook ? { beforeGenerate: this.beforeGenerateHook } : {}),
      ...(this.afterGenerateHook ? { afterGenerate: this.afterGenerateHook } : {}),
      ...(this.transformTypeHook ? { transformType: this.transformTypeHook } : {}),
      ...(this.transformPropertyHook ? { transformProperty: this.transformPropertyHook } : {}),
      ...(transformPropertyMethod ? { transformPropertyMethod } : {}),
      ...(addCustomMethods ? { addCustomMethods } : {}),
      ...(transformValue ? { transformValue } : {}),
      ...(transformBuildMethod ? { transformBuildMethod } : {}),
      ...(this.transformImportsHook ? { transformImports: this.transformImportsHook } : {}),
    };

    return plugin;
  }

  /**
   * Build method signature from custom method definition
   */
  private buildMethodSignature(method: CustomMethodDefinition): string {
    const params = method.parameters
      .map(p => {
        const optional = p.isOptional ? '?' : '';
        const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
        return `${p.name}${optional}: ${p.type}${defaultVal}`;
      })
      .join(', ');

    return `(${params})`;
  }

  /**
   * Build method implementation from custom method definition
   */
  private buildMethodImplementation(method: CustomMethodDefinition): string {
    const params = method.parameters
      .map(p => {
        const optional = p.isOptional ? '?' : '';
        const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
        return `${p.name}${optional}: ${p.type}${defaultVal}`;
      })
      .join(', ');

    const returnType = typeof method.returnType === 'string' ? method.returnType : 'this'; // Default return type

    const implementation =
      typeof method.implementation === 'string' ? method.implementation : '// Implementation';

    // If implementation doesn't include the full method signature, wrap it
    if (!implementation.includes(method.name)) {
      return `
  ${method.name}(${params}): ${returnType} {
    ${implementation}
  }`;
    }

    return implementation;
  }
}

/**
 * Create a new plugin builder
 */
export function createPlugin(name: string, version: string): PluginBuilder {
  return new PluginBuilder(name, version);
}
