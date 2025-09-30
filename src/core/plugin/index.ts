/**
 * Plugin System for fluent-gen-ts
 *
 * This module provides a fluent, type-safe, and ergonomic API for creating plugins
 * that extend the functionality of the fluent builder generator.
 *
 * Key features:
 * - Fluent builder pattern for plugin creation
 * - Type-safe matchers for type checking
 * - Structured import management (no string manipulation)
 * - Transform builders for common transformations
 * - Rich contexts with helper methods
 *
 * @example
 * ```typescript
 * import { createPlugin, primitive, object, createImportManager } from 'fluent-gen-ts';
 *
 * const myPlugin = createPlugin('my-plugin', '1.0.0')
 *   .requireImports(imports => imports
 *     .addInternalTypes('../types.js', ['TypeA'])
 *     .addExternal('@my-org/pkg', ['TypeB'])
 *   )
 *   .transformPropertyMethods(builder => builder
 *     .when(ctx => ctx.type.isPrimitive('string', 'number', 'boolean'))
 *     .setParameter(type => `${type} | TaggedTemplateValue<${type}>`)
 *     .setExtractor('String(value)')
 *     .done()
 *   )
 *   .build();
 * ```
 */

import type { Plugin } from './plugin-types.js';
import { PluginManager } from './plugin-manager.js';

export type {
  // Plugin Definition Types
  Plugin,
  PluginImports,
  Import,
  InternalImport,
  ExternalImport,

  // Hook Types
  HookTypeValue,
  PluginHookMap,

  // Context Types
  ParseContext,
  ResolveContext,
  GenerateContext,
  PropertyMethodContext,
  BuilderContext,
  ValueContext,
  BuildMethodContext,
  TypeMatcherInterface,

  // Transform Types
  PropertyMethodTransform,
  CustomMethod,
  ValueTransform,
  ImportTransformContext,

  // Structured Import Types
  StructuredImport,
  StructuredNamedImport,
  CreateImportOptions,
  RelativeToMonorepoMapping,
  ImportTransformUtils,

  // Type Matcher Types
  TypeMatcher,
  TypeMatcherBuilder,
  ObjectTypeMatcher,
  ArrayTypeMatcher,
  UnionTypeMatcher,
  IntersectionTypeMatcher,

  // Type Transformation Types
  TypeTransformer,
  TypeTransformContext,

  // Transform Builder Types
  PropertyMethodTransformRule,
  ValueTransformRule,
  BuildMethodTransformation,
  CustomMethodDefinition,
  MethodParameter,
} from './plugin-types.js';

export { createPlugin, PluginBuilder } from './plugin-builder.js';
export { HookType } from './plugin-types.js';
export { PluginManager } from './plugin-manager.js';
export { ImportManager, createImportManager } from './plugin-import-manager.js';
export {
  createTypeMatcher,
  // Convenience exports for direct usage
  primitive,
  object,
  array,
  union,
  intersection,
  reference,
  generic,
  any,
  never,
  literal,
  or,
  and,
  not,
  // Deep transformation utilities
  typeInfoToString,
  transformTypeDeep,
  containsTypeDeep,
  findTypesDeep,
  TypeDeepTransformer,
} from './type-matcher/index.js';
export {
  PropertyMethodTransformBuilder,
  ValueTransformBuilder,
  BuildMethodTransformBuilder,
  CustomMethodBuilder,
  createPropertyMethodTransformBuilder,
  createValueTransformBuilder,
  createBuildMethodTransformBuilder,
  createCustomMethodBuilder,
} from './transform-builders.js';
export {
  enhanceParseContext,
  enhanceResolveContext,
  enhanceGenerateContext,
  enhancePropertyMethodContext,
  enhanceBuilderContext,
  enhanceValueContext,
  enhanceBuildMethodContext,
} from './context-enhancers.js';
export { ImportParser, ImportSerializer, ImportTransformUtilsImpl } from './import-transformer.js';
export { ImportParsingUtils } from '../utils/import-parser-utils.js';

// Re-export Result type and functions for plugin authors
export type { Result } from '../result.js';
export { ok, err } from '../result.js';

// Re-export core types that plugin authors might need
export type { TypeInfo, PropertyInfo, ResolvedType, GeneratorOptions } from '../types.js';
export { TypeKind } from '../types.js';

// Re-export TypeScript AST types for advanced plugin authors
export type { Type, Symbol } from 'ts-morph';

/**
 * Type guard to check if an object is a valid Plugin
 *
 * Validates that the object has the minimum required properties:
 * - `name`: non-empty string
 * - `version`: non-empty string
 *
 * Additional optional properties are allowed and not validated by this function.
 * For comprehensive plugin validation including hook methods and imports structure,
 * use `PluginManager.register()` which performs deeper validation.
 *
 * @param obj - The object to validate
 * @returns `true` if the object is a valid Plugin, `false` otherwise
 *
 * @example
 * ```typescript
 * const plugin = { name: 'my-plugin', version: '1.0.0' };
 * if (isValidPlugin(plugin)) {
 *   console.log('Valid plugin:', plugin.name);
 * }
 * ```
 *
 * @example
 * ```typescript
 * const invalid = { name: '', version: '1.0.0' };
 * isValidPlugin(invalid); // false - empty name
 * ```
 */
export function isValidPlugin(obj: unknown): obj is Plugin {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const plugin = obj as Record<string, unknown>;

  return (
    typeof plugin.name === 'string' &&
    typeof plugin.version === 'string' &&
    plugin.name.length > 0 &&
    plugin.version.length > 0
  );
}

/**
 * Factory function to create a new PluginManager instance
 *
 * The PluginManager handles plugin registration, validation, and hook execution.
 * Each call creates a new, independent instance with its own plugin registry.
 *
 * @returns A new PluginManager instance
 *
 * @example
 * ```typescript
 * const manager = createPluginManager();
 * const plugin = createPlugin('my-plugin', '1.0.0').build();
 * manager.register(plugin);
 * ```
 *
 * @example
 * ```typescript
 * // Create separate managers for different contexts
 * const devManager = createPluginManager();
 * const prodManager = createPluginManager();
 * ```
 */
export function createPluginManager(): PluginManager {
  return new PluginManager();
}
