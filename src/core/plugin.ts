import type { Result } from './result.js';
import type { TypeInfo, ResolvedType, PropertyInfo, GeneratorOptions } from './types.js';
import type { Type, Symbol } from 'ts-morph';

export interface BaseTypeContext {
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
}

export interface BaseBuilderContext extends BaseTypeContext {
  readonly builderName: string;
}

export interface BaseGenericsContext {
  readonly genericParams: string;
  readonly genericConstraints: string;
}

export interface ParseContext {
  readonly sourceFile: string;
  readonly typeName: string;
}

export interface ResolveContext {
  readonly type: Type;
  readonly symbol?: Symbol | undefined;
  readonly sourceFile?: string;
  readonly typeName?: string;
}

export interface GenerateContext {
  readonly resolvedType: ResolvedType;
  readonly options: Record<string, unknown>;
}

export interface BuildMethodContext extends BaseBuilderContext, BaseGenericsContext {
  readonly buildMethodCode: string;
  readonly properties: readonly PropertyInfo[];
  readonly options: GeneratorOptions;
  readonly resolvedType: ResolvedType;
}

export interface PropertyMethodContext extends BaseBuilderContext {
  readonly property: PropertyInfo;
  readonly originalType: string;
}

export interface PropertyMethodTransform {
  readonly parameterType?: string;
  readonly extractValue?: string;
  readonly validate?: string;
}

export interface CustomMethod {
  readonly name: string;
  readonly signature: string;
  readonly implementation: string;
  readonly jsDoc?: string;
}

export interface BuilderContext extends BaseBuilderContext, BaseGenericsContext {
  readonly properties: readonly PropertyInfo[];
}

export interface ValueContext {
  readonly property: string;
  readonly valueVariable: string;
  readonly type: TypeInfo;
  readonly isOptional: boolean;
}

export interface ValueTransform {
  readonly condition?: string;
  readonly transform: string;
}

export interface PluginImports {
  readonly runtime?: readonly string[];
  readonly types?: readonly string[];
}

export enum HookType {
  BeforeParse = 'beforeParse',
  AfterParse = 'afterParse',
  BeforeResolve = 'beforeResolve',
  AfterResolve = 'afterResolve',
  BeforeGenerate = 'beforeGenerate',
  AfterGenerate = 'afterGenerate',
  TransformType = 'transformType',
  TransformProperty = 'transformProperty',
  TransformBuildMethod = 'transformBuildMethod',
  TransformPropertyMethod = 'transformPropertyMethod',
  AddCustomMethods = 'addCustomMethods',
  TransformValue = 'transformValue',
}

type PluginHookMap = {
  [HookType.BeforeParse]: (context: ParseContext) => Result<ParseContext>;
  [HookType.AfterParse]: (context: ParseContext, type: Type) => Result<Type>;
  [HookType.BeforeResolve]: (context: ResolveContext) => Result<ResolveContext>;
  [HookType.AfterResolve]: (context: ResolveContext, typeInfo: TypeInfo) => Result<TypeInfo>;
  [HookType.BeforeGenerate]: (context: GenerateContext) => Result<GenerateContext>;
  [HookType.AfterGenerate]: (code: string, context: GenerateContext) => Result<string>;
  [HookType.TransformType]: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>;
  [HookType.TransformProperty]: (property: PropertyInfo) => Result<PropertyInfo>;
  [HookType.TransformBuildMethod]: (context: BuildMethodContext) => Result<string>;
  [HookType.TransformPropertyMethod]: (
    context: PropertyMethodContext,
  ) => Result<PropertyMethodTransform>;
  [HookType.AddCustomMethods]: (context: BuilderContext) => Result<readonly CustomMethod[]>;
  [HookType.TransformValue]: (context: ValueContext) => Result<ValueTransform | null>;
};

type GetHookReturnType<K extends HookType> =
  ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never;

type GetHookInputType<K extends HookType> = Parameters<PluginHookMap[K]>[0];

type GetHookAdditionalArgs<K extends HookType> =
  Parameters<PluginHookMap[K]> extends [unknown, ...infer Rest] ? Rest : [];

interface ExecuteHookOptions<K extends HookType> {
  readonly hookType: K;
  readonly input: GetHookInputType<K>;
  readonly additionalArgs?: GetHookAdditionalArgs<K>;
}

export interface Plugin {
  readonly name: string;
  readonly version: string;

  /** Import dependencies this plugin requires */
  readonly imports?: PluginImports;

  beforeParse?: PluginHookMap[HookType.BeforeParse];
  afterParse?: PluginHookMap[HookType.AfterParse];
  beforeResolve?: PluginHookMap[HookType.BeforeResolve];
  afterResolve?: PluginHookMap[HookType.AfterResolve];
  beforeGenerate?: PluginHookMap[HookType.BeforeGenerate];
  afterGenerate?: PluginHookMap[HookType.AfterGenerate];
  transformType?: PluginHookMap[HookType.TransformType];
  transformProperty?: PluginHookMap[HookType.TransformProperty];
  transformBuildMethod?: PluginHookMap[HookType.TransformBuildMethod];
  transformPropertyMethod?: PluginHookMap[HookType.TransformPropertyMethod];
  addCustomMethods?: PluginHookMap[HookType.AddCustomMethods];
  transformValue?: PluginHookMap[HookType.TransformValue];
}

export class PluginManager {
  private readonly plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin): void {
    const validationResult = this.validatePlugin(plugin);
    if (!validationResult.ok) {
      throw new Error(`Plugin validation failed: ${validationResult.error.message}`);
    }

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  async executeHook<K extends HookType>(
    options: ExecuteHookOptions<K>,
  ): Promise<Result<GetHookReturnType<K>>> {
    const { hookType, input, additionalArgs = [] } = options;
    let currentInput = input;

    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookType];
      if (typeof hook === 'function') {
        try {
          const result =
            additionalArgs.length > 0
              ? await (hook as any)(currentInput, ...additionalArgs)
              : await (hook as any)(currentInput);

          if (!this.isValidResult(result)) {
            return {
              ok: false,
              error: new Error(`Plugin ${plugin.name} hook ${hookType} returned invalid result`),
            };
          }

          if (!result.ok) {
            return {
              ok: false,
              error: new Error(`Plugin ${plugin.name} hook ${hookType} failed: ${result.error}`),
            };
          }

          currentInput = result.value as GetHookInputType<K>;
        } catch (error) {
          return {
            ok: false,
            error: new Error(`Plugin ${plugin.name} hook ${hookType} threw error: ${error}`),
          };
        }
      }
    }

    return { ok: true, value: currentInput as GetHookReturnType<K> };
  }

  getPlugins(): ReadonlyArray<Plugin> {
    return Array.from(this.plugins.values());
  }

  /** Get all required imports from registered plugins */
  getRequiredImports(): PluginImports {
    const runtimeImports: string[] = [];
    const typeImports: string[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.imports?.runtime) {
        runtimeImports.push(...plugin.imports.runtime);
      }
      if (plugin.imports?.types) {
        typeImports.push(...plugin.imports.types);
      }
    }

    return {
      runtime: this.dedupeImports(runtimeImports),
      types: this.dedupeImports(typeImports),
    };
  }

  /** Get property method transformation for a specific property */
  getPropertyMethodTransform(context: PropertyMethodContext): PropertyMethodTransform | null {
    const results = this.collectPluginResults<PropertyMethodTransform>({
      hookMethod: 'transformPropertyMethod',
      context,
      mergeStrategy: 'merge',
    });

    return results.length > 0
      ? results.reduce((acc, curr) => ({ ...acc, ...curr }), {} as PropertyMethodTransform)
      : null;
  }

  /** Get all custom methods from plugins */
  getCustomMethods(context: BuilderContext): readonly CustomMethod[] {
    return this.collectPluginResults<CustomMethod>({
      hookMethod: 'addCustomMethods',
      context,
      mergeStrategy: 'collect',
    });
  }

  /** Get value transformations for a property */
  getValueTransforms(context: ValueContext): readonly ValueTransform[] {
    return this.collectPluginResults<ValueTransform>({
      hookMethod: 'transformValue',
      context,
      mergeStrategy: 'collect',
    }).filter((transform): transform is ValueTransform => transform !== null);
  }

  private collectPluginResults<T>({
    hookMethod,
    context,
    mergeStrategy,
  }: {
    hookMethod: keyof Plugin;
    context: unknown;
    mergeStrategy: 'collect' | 'merge';
  }): T[] {
    const results: T[] = [];

    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookMethod];
      if (typeof hook === 'function') {
        try {
          const result = (hook as any)(context);
          if (
            this.isValidResult(result) &&
            result.ok &&
            result.value !== null &&
            result.value !== undefined
          ) {
            if (mergeStrategy === 'collect' && Array.isArray(result.value)) {
              results.push(...(result.value as T[]));
            } else {
              results.push(result.value as T);
            }
          }
        } catch (error) {
          // Log error but continue with other plugins
          console.warn(`Plugin ${plugin.name} hook ${String(hookMethod)} failed:`, error);
        }
      }
    }

    return results;
  }

  private dedupeImports(imports: string[]): string[] {
    return Array.from(new Set(imports));
  }

  private isValidResult(value: unknown): value is Result<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'ok' in value &&
      typeof (value as { ok: unknown }).ok === 'boolean' &&
      ((value as { ok: boolean }).ok ? 'value' in value : 'error' in value)
    );
  }

  private validatePlugin(plugin: unknown): Result<Plugin> {
    if (typeof plugin !== 'object' || plugin === null) {
      return {
        ok: false,
        error: new Error('Plugin must be an object'),
      };
    }

    const pluginObj = plugin as Record<string, unknown>;

    // Validate required properties
    if (typeof pluginObj.name !== 'string' || pluginObj.name.trim() === '') {
      return {
        ok: false,
        error: new Error("Plugin must have a non-empty 'name' property"),
      };
    }

    if (typeof pluginObj.version !== 'string' || pluginObj.version.trim() === '') {
      return {
        ok: false,
        error: new Error("Plugin must have a non-empty 'version' property"),
      };
    }

    // Validate hook methods are functions if present
    const hookMethods = [
      'beforeParse',
      'afterParse',
      'beforeResolve',
      'afterResolve',
      'beforeGenerate',
      'afterGenerate',
      'transformType',
      'transformProperty',
      'transformBuildMethod',
      'transformPropertyMethod',
      'addCustomMethods',
      'transformValue',
    ];

    for (const method of hookMethods) {
      if (method in pluginObj && typeof pluginObj[method] !== 'function') {
        return {
          ok: false,
          error: new Error(`Plugin hook '${method}' must be a function if provided`),
        };
      }
    }

    // Validate imports structure if present
    if ('imports' in pluginObj && pluginObj.imports !== undefined) {
      const imports = pluginObj.imports as Record<string, unknown>;
      if (typeof imports !== 'object' || imports === null) {
        return {
          ok: false,
          error: new Error("Plugin 'imports' must be an object if provided"),
        };
      }

      if ('runtime' in imports && imports.runtime !== undefined) {
        if (
          !Array.isArray(imports.runtime) ||
          !imports.runtime.every(item => typeof item === 'string')
        ) {
          return {
            ok: false,
            error: new Error("Plugin 'imports.runtime' must be an array of strings if provided"),
          };
        }
      }

      if ('types' in imports && imports.types !== undefined) {
        if (
          !Array.isArray(imports.types) ||
          !imports.types.every(item => typeof item === 'string')
        ) {
          return {
            ok: false,
            error: new Error("Plugin 'imports.types' must be an array of strings if provided"),
          };
        }
      }
    }

    return { ok: true, value: plugin as Plugin };
  }
}
