import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { formatError } from '../utils/error-utils.js';
import type {
  Plugin,
  HookTypeValue,
  PluginHookMap,
  PropertyMethodContext,
  PropertyMethodTransform,
  BuilderContext,
  CustomMethod,
  ValueContext,
  ValueTransform,
  PluginImports,
  Import,
} from './plugin-types.js';
import { HookType } from './plugin-types.js';
import { ImportManager } from './plugin-import-manager.js';

/**
 * Options for executing hooks
 */
interface ExecuteHookOptions<K extends HookTypeValue> {
  readonly hookType: K;
  readonly input: Parameters<PluginHookMap[K]>[0];
  readonly additionalArgs?: Parameters<PluginHookMap[K]> extends [unknown, ...infer Rest]
    ? Rest
    : [];
}

/**
 * Plugin manager for the plugin system
 * Handles plugin registration, validation, and hook execution
 */
export class PluginManager {
  private readonly plugins = new Map<string, Plugin>();

  /**
   * Register a plugin
   */
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

  /**
   * Unregister a plugin by name
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): readonly Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Execute a hook across all registered plugins in registration order
   *
   * @param options - Configuration for hook execution
   * @param options.hookType - The type of hook to execute
   * @param options.input - Input data to pass to the hook
   * @param options.additionalArgs - Additional arguments to pass to the hook
   * @returns Promise resolving to the final transformed result or error
   *
   * @example
   * ```typescript
   * const result = await manager.executeHook({
   *   hookType: HookType.BeforeParse,
   *   input: { sourceFile: 'file.ts', typeName: 'User' }
   * });
   * ```
   */
  async executeHook<K extends HookTypeValue>(
    options: ExecuteHookOptions<K>,
  ): Promise<Result<ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never>> {
    const { hookType, input, additionalArgs = [] } = options;
    let currentInput = input;

    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookType];
      if (typeof hook === 'function') {
        const result = await this.invokeHook(
          hook,
          currentInput,
          additionalArgs,
          plugin.name,
          hookType,
        );

        if (!result.ok) {
          return result as Result<never>;
        }

        currentInput = result.value as Parameters<PluginHookMap[K]>[0];
      }
    }

    return ok(currentInput as ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never);
  }

  /**
   * Get property method transformation for a specific property by merging
   * transformations from all plugins that provide them
   *
   * @param context - Context information about the property method
   * @returns Merged transformation object or null if no plugins provide transformations
   *
   * @example
   * ```typescript
   * const transform = manager.getPropertyMethodTransform(context);
   * if (transform) {
   *   console.log(transform.parameterType); // 'string'
   *   console.log(transform.extractValue); // 'String(value)'
   * }
   * ```
   */
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

  /**
   * Get all custom methods from plugins that provide them
   *
   * @param context - Builder context information
   * @returns Array of custom method definitions from all plugins
   *
   * @example
   * ```typescript
   * const methods = manager.getCustomMethods(context);
   * methods.forEach(method => {
   *   console.log(method.name); // 'withEmail'
   *   console.log(method.signature); // '(email: string): this'
   * });
   * ```
   */
  getCustomMethods(context: BuilderContext): readonly CustomMethod[] {
    return this.collectPluginResults<CustomMethod>({
      hookMethod: 'addCustomMethods',
      context,
      mergeStrategy: 'collect',
    });
  }

  /**
   * Get value transformations for a property from all plugins
   *
   * @param context - Value context information
   * @returns Array of value transformations (null values are filtered out)
   *
   * @example
   * ```typescript
   * const transforms = manager.getValueTransforms(context);
   * transforms.forEach(transform => {
   *   if (transform.condition) {
   *     console.log(`If ${transform.condition}, apply: ${transform.transform}`);
   *   }
   * });
   * ```
   */
  getValueTransforms(context: ValueContext): readonly ValueTransform[] {
    return this.collectPluginResults<ValueTransform, ValueContext>({
      hookMethod: 'transformValue',
      context,
      mergeStrategy: 'collect',
    });
  }

  /**
   * Get all required imports from registered plugins and deduplicate them
   *
   * @returns ImportManager instance with all plugin imports
   *
   * @example
   * ```typescript
   * const importManager = manager.getRequiredImports();
   * const statements = importManager.toImportStatements();
   * ```
   */
  getRequiredImports(): ImportManager {
    const importManager = new ImportManager();

    for (const plugin of this.plugins.values()) {
      if (plugin.imports?.imports) {
        for (const imp of plugin.imports.imports) {
          this.addImportToManager(importManager, imp);
        }
      }
    }

    return importManager.deduplicate();
  }

  /**
   * Generate import statements for all plugin requirements
   *
   * @returns Array of import statement strings
   *
   * @example
   * ```typescript
   * const statements = manager.generateImportStatements();
   * // ['import { User } from "../types.js"', 'import { merge } from "lodash"']
   * ```
   */
  generateImportStatements(): string[] {
    const importManager = this.getRequiredImports();
    return importManager.toImportStatements();
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get plugins count
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
  }

  /**
   * Get all plugins that implement a specific hook type
   *
   * @param hookType - The hook type to filter by
   * @returns Array of plugins that implement the specified hook
   *
   * @example
   * ```typescript
   * const parsePlugins = manager.getPluginsByHookType(HookType.BeforeParse);
   * ```
   */
  getPluginsByHookType(hookType: HookTypeValue): readonly Plugin[] {
    return Array.from(this.plugins.values()).filter(
      plugin => hookType in plugin && plugin[hookType],
    );
  }

  /**
   * Execute a specific hook from a specific plugin
   *
   * @param pluginName - Name of the plugin to execute hook from
   * @param options - Configuration for hook execution
   * @returns Promise resolving to the hook result or error
   *
   * @example
   * ```typescript
   * const result = await manager.executePluginHook('my-plugin', {
   *   hookType: HookType.TransformType,
   *   input: typeInfo
   * });
   * ```
   */
  async executePluginHook<K extends HookTypeValue>(
    pluginName: string,
    options: ExecuteHookOptions<K>,
  ): Promise<Result<ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never>> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return err(new Error(`Plugin ${pluginName} not found`));
    }

    const hook = plugin[options.hookType];
    if (!hook || typeof hook !== 'function') {
      return err(new Error(`Plugin ${pluginName} does not have hook ${options.hookType}`));
    }

    return this.invokeHook(
      hook,
      options.input,
      options.additionalArgs ?? [],
      pluginName,
      options.hookType,
    ) as Promise<Result<ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never>>;
  }

  /**
   * Collect results from all plugins for a specific hook method with error tolerance
   *
   * @param hookMethod - The hook method name to invoke
   * @param context - Context data to pass to the hook
   * @param mergeStrategy - How to handle results: 'collect' arrays or 'merge' objects
   * @returns Array of results from all plugins that successfully executed the hook
   */
  private collectPluginResults<T, C = unknown>({
    hookMethod,
    context,
    mergeStrategy,
  }: {
    hookMethod: keyof Plugin;
    context: C;
    mergeStrategy: 'collect' | 'merge';
  }): T[] {
    const results: T[] = [];

    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookMethod];
      if (typeof hook === 'function') {
        try {
          const result = (hook as (context: C) => Result<T | readonly T[]>)(context);
          if (
            this.isValidResult(result) &&
            result.ok &&
            result.value !== null &&
            result.value !== undefined
          ) {
            if (mergeStrategy === 'collect' && Array.isArray(result.value)) {
              results.push(...result.value);
            } else {
              results.push(result.value as T);
            }
          }
        } catch (error) {
          console.warn(`Plugin ${plugin.name} hook ${String(hookMethod)} failed:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Add an import to the import manager with appropriate options
   *
   * @param manager - ImportManager instance to add to
   * @param imp - Import configuration to add
   */
  private addImportToManager(manager: ImportManager, imp: Import): void {
    const options = this.buildImportOptions(imp);

    if (imp.kind === 'internal') {
      manager.addInternal(imp.path, [...imp.imports], options);
    } else {
      manager.addExternal(imp.package, [...imp.imports], options);
    }
  }

  /**
   * Build import options object from import configuration
   *
   * @param imp - Import configuration
   * @returns Options object for ImportManager
   */
  private buildImportOptions(imp: Import): {
    typeOnly?: boolean;
    isDefault?: boolean;
    defaultName?: string;
  } {
    const options: {
      typeOnly?: boolean;
      isDefault?: boolean;
      defaultName?: string;
    } = {};

    if (imp.isTypeOnly !== undefined) {
      options.typeOnly = imp.isTypeOnly;
    }
    if (imp.isDefault !== undefined) {
      options.isDefault = imp.isDefault;
    }
    if (imp.defaultName !== undefined) {
      options.defaultName = imp.defaultName;
    }

    return options;
  }

  /**
   * Validate that a value is a valid Result object with proper structure
   *
   * @param value - Value to validate
   * @returns Type guard indicating if value is a valid Result
   */
  /**
   * Invoke a plugin hook function with proper error handling and validation
   *
   * @param hook - The hook function to invoke
   * @param input - Input data to pass to the hook
   * @param additionalArgs - Additional arguments to pass to the hook
   * @param pluginName - Name of the plugin (for error messages)
   * @param hookType - Type of hook being invoked (for error messages)
   * @returns Promise resolving to hook result or error
   */
  private async invokeHook<T>(
    hook: Function,
    input: T,
    additionalArgs: readonly unknown[],
    pluginName: string,
    hookType: string,
  ): Promise<Result<T>> {
    try {
      let result: Result<unknown>;
      if (additionalArgs.length > 0) {
        result = await (hook as (...args: unknown[]) => Promise<Result<unknown>> | Result<unknown>)(
          input,
          ...additionalArgs,
        );
      } else {
        result = await (hook as (input: unknown) => Promise<Result<unknown>> | Result<unknown>)(
          input,
        );
      }

      if (!this.isValidResult(result)) {
        return err(new Error(`Plugin ${pluginName} hook ${hookType} returned invalid result`));
      }

      if (!result.ok) {
        return err(
          new Error(`Plugin ${pluginName} hook ${hookType} failed: ${result.error.message}`),
        );
      }

      return result as Result<T>;
    } catch (error) {
      return err(
        new Error(`Plugin ${pluginName} hook ${hookType} threw error: ${formatError(error)}`),
      );
    }
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

  /**
   * Validate plugin structure and all required properties
   *
   * @param plugin - Plugin object to validate
   * @returns Result indicating validation success or specific error
   */
  private validatePlugin(plugin: unknown): Result<Plugin> {
    if (typeof plugin !== 'object' || plugin === null) {
      return err(new Error('Plugin must be an object'));
    }

    const pluginObj = plugin as Record<string, unknown>;

    // Validate required properties
    if (typeof pluginObj.name !== 'string' || pluginObj.name.trim() === '') {
      return err(new Error("Plugin must have a non-empty 'name' property"));
    }

    if (typeof pluginObj.version !== 'string' || pluginObj.version.trim() === '') {
      return err(new Error("Plugin must have a non-empty 'version' property"));
    }

    // Validate description if present
    if ('description' in pluginObj && typeof pluginObj.description !== 'string') {
      return err(new Error("Plugin 'description' must be a string if provided"));
    }

    for (const method of Object.values(HookType)) {
      if (method in pluginObj && typeof pluginObj[method] !== 'function') {
        return err(new Error(`Plugin hook '${method}' must be a function if provided`));
      }
    }

    // Validate imports structure if present
    if ('imports' in pluginObj && pluginObj.imports !== undefined) {
      const importsResult = this.validatePluginImports(pluginObj.imports);
      if (!importsResult.ok) {
        return importsResult;
      }
    }

    return ok(plugin as Plugin);
  }

  /**
   * Validate plugin imports structure and format
   *
   * @param imports - Imports object to validate
   * @returns Result indicating validation success or specific error
   */
  private validatePluginImports(imports: unknown): Result<PluginImports> {
    if (typeof imports !== 'object' || imports === null) {
      return err(new Error("Plugin 'imports' must be an object if provided"));
    }

    const importsObj = imports as Record<string, unknown>;

    if (!('imports' in importsObj) || !Array.isArray(importsObj.imports)) {
      return err(new Error("Plugin 'imports.imports' must be an array"));
    }

    // Validate each import
    for (let i = 0; i < importsObj.imports.length; i++) {
      const imp = importsObj.imports[i];
      const result = this.validateImport(imp, i);
      if (!result.ok) {
        return result;
      }
    }

    return ok(imports as PluginImports);
  }

  /**
   * Validate a single import configuration object
   *
   * @param imp - Import object to validate
   * @param index - Index of import in array (for error messages)
   * @returns Result indicating validation success or specific error
   */
  private validateImport(imp: unknown, index: number): Result<Import> {
    if (typeof imp !== 'object' || imp === null) {
      return err(new Error(`Import at index ${index} must be an object`));
    }

    const impObj = imp as Record<string, unknown>;

    if (!('kind' in impObj) || (impObj.kind !== 'internal' && impObj.kind !== 'external')) {
      return err(new Error(`Import at index ${index} must have kind 'internal' or 'external'`));
    }

    if (!('imports' in impObj) || !Array.isArray(impObj.imports)) {
      return err(new Error(`Import at index ${index} must have 'imports' array`));
    }

    if (!impObj.imports.every(item => typeof item === 'string')) {
      return err(new Error(`Import at index ${index} 'imports' must be an array of strings`));
    }

    if (impObj.kind === 'internal') {
      if (!('path' in impObj) || typeof impObj.path !== 'string') {
        return err(new Error(`Internal import at index ${index} must have 'path' string`));
      }
    } else {
      if (!('package' in impObj) || typeof impObj.package !== 'string') {
        return err(new Error(`External import at index ${index} must have 'package' string`));
      }
    }

    // Optional fields
    if ('isTypeOnly' in impObj && typeof impObj.isTypeOnly !== 'boolean') {
      return err(new Error(`Import at index ${index} 'isTypeOnly' must be boolean if provided`));
    }

    if ('isDefault' in impObj && typeof impObj.isDefault !== 'boolean') {
      return err(new Error(`Import at index ${index} 'isDefault' must be boolean if provided`));
    }

    if ('defaultName' in impObj && typeof impObj.defaultName !== 'string') {
      return err(new Error(`Import at index ${index} 'defaultName' must be string if provided`));
    }

    return ok(imp as Import);
  }
}
