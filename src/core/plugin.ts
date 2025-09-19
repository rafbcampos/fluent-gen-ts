import type { Result } from "./result.js";
import type {
  TypeInfo,
  ResolvedType,
  PropertyInfo,
  GeneratorOptions,
} from "./types.js";
import type { Type, Symbol } from "ts-morph";

export interface ParseContext {
  readonly sourceFile: string;
  readonly typeName: string;
}

export interface ResolveContext extends ParseContext {
  readonly type: Type;
  readonly symbol?: Symbol;
}

export interface GenerateContext {
  readonly resolvedType: ResolvedType;
  readonly options: Record<string, unknown>;
}

export interface BuildMethodContext {
  readonly buildMethodCode: string;
  readonly typeInfo: TypeInfo;
  readonly typeName: string;
  readonly builderName: string;
  readonly genericParams: string;
  readonly genericConstraints: string;
  readonly properties: readonly PropertyInfo[];
  readonly options: GeneratorOptions;
  readonly resolvedType: ResolvedType;
}

export interface PropertyMethodContext {
  readonly property: PropertyInfo;
  readonly originalType: string;
  readonly builderName: string;
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
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

export interface BuilderContext {
  readonly typeName: string;
  readonly builderName: string;
  readonly typeInfo: TypeInfo;
  readonly properties: readonly PropertyInfo[];
  readonly genericParams: string;
  readonly genericConstraints: string;
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
  BeforeParse = "beforeParse",
  AfterParse = "afterParse",
  BeforeResolve = "beforeResolve",
  AfterResolve = "afterResolve",
  BeforeGenerate = "beforeGenerate",
  AfterGenerate = "afterGenerate",
  TransformType = "transformType",
  TransformProperty = "transformProperty",
  TransformBuildMethod = "transformBuildMethod",
  TransformPropertyMethod = "transformPropertyMethod",
  AddCustomMethods = "addCustomMethods",
  TransformValue = "transformValue",
}

export interface Plugin {
  readonly name: string;
  readonly version: string;

  /** Import dependencies this plugin requires */
  readonly imports?: PluginImports;

  beforeParse?(context: ParseContext): Result<ParseContext>;
  afterParse?(context: ParseContext, type: Type): Result<Type>;

  beforeResolve?(context: ResolveContext): Result<ResolveContext>;
  afterResolve?(context: ResolveContext, typeInfo: TypeInfo): Result<TypeInfo>;

  beforeGenerate?(context: GenerateContext): Result<GenerateContext>;
  afterGenerate?(code: string, context: GenerateContext): Result<string>;

  transformType?(type: Type, typeInfo: TypeInfo): Result<TypeInfo>;
  transformProperty?(property: PropertyInfo): Result<PropertyInfo>;
  transformBuildMethod?(context: BuildMethodContext): Result<string>;

  /** Transform the method signature for a property */
  transformPropertyMethod?(
    context: PropertyMethodContext,
  ): Result<PropertyMethodTransform>;

  /** Add custom methods to the builder */
  addCustomMethods?(context: BuilderContext): Result<readonly CustomMethod[]>;

  /** Transform values during the build process */
  transformValue?(context: ValueContext): Result<ValueTransform | null>;
}

export class PluginManager {
  private readonly plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  async executeHook<T>(
    hookType: HookType,
    input: T,
    ...args: unknown[]
  ): Promise<Result<T>> {
    const methodName = hookType as keyof Plugin;
    let currentInput = input;

    for (const plugin of this.plugins.values()) {
      const hook = plugin[methodName];
      if (typeof hook === "function") {
        const result =
          args.length > 0
            ? await (hook as Function).call(plugin, currentInput, ...args)
            : await (hook as Function).call(plugin, currentInput);
        if (!result.ok) {
          return result as Result<T>;
        }
        currentInput = result.value as T;
      }
    }

    return { ok: true, value: currentInput };
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
  getPropertyMethodTransform(
    context: PropertyMethodContext,
  ): PropertyMethodTransform | null {
    let transform: PropertyMethodTransform = {};

    for (const plugin of this.plugins.values()) {
      if (plugin.transformPropertyMethod) {
        const result = plugin.transformPropertyMethod(context);
        if (result.ok && result.value) {
          // Merge transforms, later plugins override earlier ones
          transform = { ...transform, ...result.value };
        }
      }
    }

    return Object.keys(transform).length > 0 ? transform : null;
  }

  /** Get all custom methods from plugins */
  getCustomMethods(context: BuilderContext): readonly CustomMethod[] {
    const allMethods: CustomMethod[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.addCustomMethods) {
        const result = plugin.addCustomMethods(context);
        if (result.ok && result.value) {
          allMethods.push(...result.value);
        }
      }
    }

    return allMethods;
  }

  /** Get value transformations for a property */
  getValueTransforms(context: ValueContext): readonly ValueTransform[] {
    const transforms: ValueTransform[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.transformValue) {
        const result = plugin.transformValue(context);
        if (result.ok && result.value) {
          transforms.push(result.value);
        }
      }
    }

    return transforms;
  }

  private dedupeImports(imports: string[]): string[] {
    return Array.from(new Set(imports));
  }
}
