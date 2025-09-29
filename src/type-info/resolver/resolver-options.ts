import type { Project } from 'ts-morph';
import type { TypeResolutionCache } from '../../core/cache.js';
import type { PluginManager } from '../../core/plugin/index.js';

/**
 * Configuration options for TypeResolver behavior and type resolution strategies.
 *
 * @public
 */
export interface ResolverOptions {
  /**
   * Maximum recursion depth for nested type resolution to prevent infinite loops.
   * @defaultValue 30
   */
  readonly maxDepth?: number;

  /**
   * Custom cache implementation for storing resolved types to improve performance.
   * @defaultValue new TypeResolutionCache()
   */
  readonly cache?: TypeResolutionCache;

  /**
   * Plugin system for extending type resolution behavior with custom hooks.
   * @defaultValue new PluginManager()
   */
  readonly pluginManager?: PluginManager;

  /**
   * Whether to expand utility types like Partial, Required, Pick, etc. into their resolved form.
   * @defaultValue true
   */
  readonly expandUtilityTypes?: boolean;

  /**
   * Whether to resolve mapped types like `{ [K in keyof T]: T[K] }` into their expanded form.
   * @defaultValue true
   */
  readonly resolveMappedTypes?: boolean;

  /**
   * Whether to resolve conditional types like `T extends U ? X : Y` based on type conditions.
   * @defaultValue true
   */
  readonly resolveConditionalTypes?: boolean;

  /**
   * Whether to resolve template literal types like `${string}-suffix` into their expanded form.
   * @defaultValue true
   */
  readonly resolveTemplateLiterals?: boolean;

  /**
   * ts-morph Project instance providing the TypeScript compilation context for type resolution.
   * Required for complex type operations that need access to the full TypeScript program.
   */
  readonly project?: Project;
}
