import type { Result } from '../result.js';
import { ok, err } from '../result.js';
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
   * Execute a hook across all registered plugins
   */
  async executeHook<K extends HookTypeValue>(
    options: ExecuteHookOptions<K>,
  ): Promise<Result<ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never>> {
    const { hookType, input, additionalArgs = [] } = options;
    let currentInput = input;

    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookType];
      if (typeof hook === 'function') {
        try {
          let result: Result<unknown>;
          if (additionalArgs.length > 0) {
            result = await (
              hook as (...args: unknown[]) => Promise<Result<unknown>> | Result<unknown>
            )(currentInput, ...additionalArgs);
          } else {
            result = await (hook as (input: unknown) => Promise<Result<unknown>> | Result<unknown>)(
              currentInput,
            );
          }

          if (!this.isValidResult(result)) {
            return err(new Error(`Plugin ${plugin.name} hook ${hookType} returned invalid result`));
          }

          if (!result.ok) {
            return err(
              new Error(`Plugin ${plugin.name} hook ${hookType} failed: ${result.error.message}`),
            );
          }

          currentInput = result.value as Parameters<PluginHookMap[K]>[0];
        } catch (error) {
          return err(new Error(`Plugin ${plugin.name} hook ${hookType} threw error: ${error}`));
        }
      }
    }

    return ok(currentInput as ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never);
  }

  /**
   * Get property method transformation for a specific property
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
   * Get all custom methods from plugins
   */
  getCustomMethods(context: BuilderContext): readonly CustomMethod[] {
    return this.collectPluginResults<CustomMethod>({
      hookMethod: 'addCustomMethods',
      context,
      mergeStrategy: 'collect',
    });
  }

  /**
   * Get value transformations for a property
   */
  getValueTransforms(context: ValueContext): readonly ValueTransform[] {
    return this.collectPluginResults<ValueTransform>({
      hookMethod: 'transformValue',
      context,
      mergeStrategy: 'collect',
    }).filter((transform): transform is ValueTransform => transform !== null);
  }

  /**
   * Get all required imports from registered plugins
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
   * Generate import statements for plugin requirements
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
   * Get plugins by hook type
   */
  getPluginsByHookType(hookType: HookTypeValue): readonly Plugin[] {
    return Array.from(this.plugins.values()).filter(
      plugin => hookType in plugin && plugin[hookType],
    );
  }

  /**
   * Execute a specific hook from a specific plugin
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

    try {
      let result: Result<unknown>;
      if (options.additionalArgs && options.additionalArgs.length > 0) {
        result = await (hook as (...args: unknown[]) => Promise<Result<unknown>> | Result<unknown>)(
          options.input,
          ...options.additionalArgs,
        );
      } else {
        result = await (hook as (input: unknown) => Promise<Result<unknown>> | Result<unknown>)(
          options.input,
        );
      }

      if (!this.isValidResult(result)) {
        return err(
          new Error(`Plugin ${pluginName} hook ${options.hookType} returned invalid result`),
        );
      }

      return result as Result<ReturnType<PluginHookMap[K]> extends Result<infer R> ? R : never>;
    } catch (error) {
      return err(new Error(`Plugin ${pluginName} hook ${options.hookType} threw error: ${error}`));
    }
  }

  /**
   * Collect results from plugins for a specific hook method
   */
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
          const result = (hook as (context: unknown) => Result<unknown>)(context);
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

  /**
   * Add an import to the import manager
   */
  private addImportToManager(manager: ImportManager, imp: Import): void {
    if (imp.kind === 'internal') {
      manager.addInternal(imp.path, [...imp.imports], {
        ...(imp.isTypeOnly !== undefined ? { typeOnly: imp.isTypeOnly } : {}),
        ...(imp.isDefault !== undefined ? { isDefault: imp.isDefault } : {}),
        ...(imp.defaultName !== undefined ? { defaultName: imp.defaultName } : {}),
      });
    } else {
      manager.addExternal(imp.package, [...imp.imports], {
        ...(imp.isTypeOnly !== undefined ? { typeOnly: imp.isTypeOnly } : {}),
        ...(imp.isDefault !== undefined ? { isDefault: imp.isDefault } : {}),
        ...(imp.defaultName !== undefined ? { defaultName: imp.defaultName } : {}),
      });
    }
  }

  /**
   * Validate that a value is a valid Result
   */
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
   * Validate plugin structure
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
      'transformImports',
    ];

    for (const method of hookMethods) {
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
   * Validate plugin imports structure
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
   * Validate a single import
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
