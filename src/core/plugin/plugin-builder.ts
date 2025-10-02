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
  CustomMethodDefinition,
  MethodParameter,
} from './plugin-types.js';
import type { TypeInfo, PropertyInfo } from '../types.js';
import type { Type } from 'ts-morph';
import { ImportManager } from './plugin-import-manager.js';
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
  private customContextTypeName?: string;

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

  private propertyMethodTransformBuilder?: PropertyMethodTransformBuilder;
  private valueTransformBuilder?: ValueTransformBuilder;
  private buildMethodTransformBuilder?: BuildMethodTransformBuilder;
  private customMethodDefinitions: CustomMethodDefinition[] = [];

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }

  /**
   * Sets the plugin description
   * @param description - Human-readable description of what the plugin does
   * @returns This builder instance for chaining
   */
  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Set custom context type name for generated builders
   * @param typeName - The context type name (e.g., 'MyDomainContext')
   *
   * This is used during code generation to specify the context type in builder signatures.
   * The runtime context generator behavior should be provided by users via
   * `__nestedContextGenerator__` in their context objects when calling build().
   *
   * @example
   * .setContextTypeName('MyDomainContext')
   */
  setContextTypeName(typeName: string): this {
    this.customContextTypeName = typeName;
    return this;
  }

  /**
   * Configure imports required by the plugin
   * @param configurator - Function that configures the ImportManager
   * @returns This builder instance for chaining
   * @example
   * .requireImports(manager => manager
   *   .addInternal('../types.js', ['MyType'])
   *   .addExternal('zod', ['z'])
   * )
   */
  requireImports(configurator: (manager: ImportManager) => ImportManager): this {
    this.importManager = configurator(new ImportManager());
    return this;
  }

  /**
   * Registers a hook that runs before parsing a TypeScript type
   * @param hook - Function that receives parse context and returns modified context
   * @returns This builder instance for chaining
   */
  beforeParse(hook: (context: ParseContext) => Result<ParseContext>): this {
    this.beforeParseHook = hook;
    return this;
  }

  /**
   * Registers a hook that runs after parsing a TypeScript type
   * @param hook - Function that receives parse context and parsed type, returns modified type
   * @returns This builder instance for chaining
   */
  afterParse(hook: (context: ParseContext, type: Type) => Result<Type>): this {
    this.afterParseHook = hook;
    return this;
  }

  /**
   * Registers a hook that runs before resolving type information
   * @param hook - Function that receives resolve context and returns modified context
   * @returns This builder instance for chaining
   */
  beforeResolve(hook: (context: ResolveContext) => Result<ResolveContext>): this {
    this.beforeResolveHook = hook;
    return this;
  }

  /**
   * Registers a hook that runs after resolving type information
   * @param hook - Function that receives resolve context and type info, returns modified type info
   * @returns This builder instance for chaining
   */
  afterResolve(hook: (context: ResolveContext, typeInfo: TypeInfo) => Result<TypeInfo>): this {
    this.afterResolveHook = hook;
    return this;
  }

  /**
   * Registers a hook that runs before generating builder code
   * @param hook - Function that receives generate context and returns modified context
   * @returns This builder instance for chaining
   */
  beforeGenerate(hook: (context: GenerateContext) => Result<GenerateContext>): this {
    this.beforeGenerateHook = hook;
    return this;
  }

  /**
   * Registers a hook that runs after generating builder code
   * @param hook - Function that receives generated code and context, returns modified code
   * @returns This builder instance for chaining
   */
  afterGenerate(hook: (code: string, context: GenerateContext) => Result<string>): this {
    this.afterGenerateHook = hook;
    return this;
  }

  /**
   * Registers a hook that transforms type information during resolution
   * @param hook - Function that receives type and type info, returns modified type info
   * @returns This builder instance for chaining
   */
  transformType(hook: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>): this {
    this.transformTypeHook = hook;
    return this;
  }

  /**
   * Registers a hook that transforms property information during resolution
   * @param hook - Function that receives property info and returns modified property info
   * @returns This builder instance for chaining
   */
  transformProperty(hook: (property: PropertyInfo) => Result<PropertyInfo>): this {
    this.transformPropertyHook = hook;
    return this;
  }

  /**
   * Configure transformations for property setter methods in generated builders
   * @param configurator - Function that configures property method transforms using the builder
   * @returns This builder instance for chaining
   * @example
   * .transformPropertyMethods(builder => builder
   *   .when(ctx => ctx.type.isPrimitive('string'))
   *   .setParameter('string | Tagged<string>')
   *   .done()
   * )
   */
  transformPropertyMethods(
    configurator: (builder: PropertyMethodTransformBuilder) => PropertyMethodTransformBuilder,
  ): this {
    this.propertyMethodTransformBuilder = configurator(new PropertyMethodTransformBuilder());
    return this;
  }

  /**
   * Add a custom method to generated builders
   * @param configurator - Function that configures the custom method using the builder
   * @returns This builder instance for chaining
   * @example
   * .addMethod(builder => builder
   *   .name('withEmail')
   *   .parameters([{ name: 'email', type: 'string' }])
   *   .returns('this')
   *   .implementation('return this.email(email);')
   * )
   */
  addMethod(configurator: (builder: CustomMethodBuilder) => CustomMethodBuilder): this {
    const builder = configurator(new CustomMethodBuilder());
    const methodDefinition = builder.build();
    this.customMethodDefinitions.push(methodDefinition);
    return this;
  }

  /**
   * Configure transformations for property values in generated builders
   * @param configurator - Function that configures value transforms using the builder
   * @returns This builder instance for chaining
   * @example
   * .transformValues(builder => builder
   *   .when(ctx => ctx.typeChecker.isPrimitive('string'))
   *   .transform('value.trim()')
   *   .done()
   * )
   */
  transformValues(configurator: (builder: ValueTransformBuilder) => ValueTransformBuilder): this {
    this.valueTransformBuilder = configurator(new ValueTransformBuilder());
    return this;
  }

  /**
   * Configure transformations for the build method in generated builders
   * @param configurator - Function that configures build method transforms using the builder
   * @returns This builder instance for chaining
   * @example
   * .transformBuildMethod(builder => builder
   *   .insertBefore('return {', 'this.validate();')
   * )
   */
  transformBuildMethod(
    configurator: (builder: BuildMethodTransformBuilder) => BuildMethodTransformBuilder,
  ): this {
    this.buildMethodTransformBuilder = configurator(new BuildMethodTransformBuilder());
    return this;
  }

  /**
   * Registers a hook that transforms import statements in generated code
   * @param hook - Function that receives import context and returns modified import context
   * @returns This builder instance for chaining
   */
  transformImports(
    hook: (context: ImportTransformContext) => Result<ImportTransformContext>,
  ): this {
    this.transformImportsHook = hook;
    return this;
  }

  /**
   * Builds and returns the configured plugin
   * @returns The finalized Plugin object with all configured hooks and transforms
   */
  build(): Plugin {
    const transformPropertyMethod = this.propertyMethodTransformBuilder
      ? (context: PropertyMethodContext): Result<PropertyMethodTransform> => {
          const transformer = this.propertyMethodTransformBuilder!.build();
          const result = transformer(context);
          return ok(result || {});
        }
      : undefined;

    const addCustomMethods =
      this.customMethodDefinitions.length > 0
        ? (context: BuilderContext): Result<readonly CustomMethod[]> => {
            const methods = this.customMethodDefinitions
              .filter(def => !def.predicate || def.predicate(context))
              .map(def => {
                const customMethod: CustomMethod = {
                  name: def.name,
                  signature: this.buildMethodSignature(def),
                  implementation: this.buildMethodImplementation(def),
                  ...(def.jsDoc ? { jsDoc: def.jsDoc } : {}),
                };
                return customMethod;
              });
            return ok(methods);
          }
        : undefined;

    const transformValue = this.valueTransformBuilder
      ? (context: ValueContext): Result<ValueTransform | null> => {
          const transformer = this.valueTransformBuilder!.build();
          return ok(transformer(context));
        }
      : undefined;

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
      ...(this.customContextTypeName ? { contextTypeName: this.customContextTypeName } : {}),
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
   * Builds a parameter string from method parameters
   * @param parameters - Array of method parameters to format
   * @returns Formatted parameter string (e.g., "name: string, count?: number = 0")
   */
  private buildParameterString(parameters: readonly MethodParameter[]): string {
    return parameters
      .map(p => {
        const optional = p.isOptional ? '?' : '';
        const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
        return `${p.name}${optional}: ${p.type}${defaultVal}`;
      })
      .join(', ');
  }

  /**
   * Builds a method signature from custom method definition
   * @param method - The custom method definition
   * @returns Formatted method signature (e.g., "(param1: string, param2?: number)")
   */
  private buildMethodSignature(method: CustomMethodDefinition): string {
    const params = this.buildParameterString(method.parameters);
    return `(${params})`;
  }

  /**
   * Builds a complete method implementation from custom method definition
   * @param method - The custom method definition
   * @returns Complete method implementation code
   */
  private buildMethodImplementation(method: CustomMethodDefinition): string {
    const params = this.buildParameterString(method.parameters);

    const returnType = typeof method.returnType === 'string' ? method.returnType : 'this';

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
 * Creates a new plugin builder instance
 * @param name - The plugin name
 * @param version - The plugin version (e.g., '1.0.0')
 * @returns A new PluginBuilder instance for fluent configuration
 * @example
 * const plugin = createPlugin('my-plugin', '1.0.0')
 *   .setDescription('My custom plugin')
 *   .beforeParse(ctx => ok(ctx))
 *   .build();
 */
export function createPlugin(name: string, version: string): PluginBuilder {
  return new PluginBuilder(name, version);
}
