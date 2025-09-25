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

// ============================================================================
// Core Types
// ============================================================================

// Import types for use in utility functions
import type { Plugin } from './plugin-types.js';
import { PluginManager as PM } from './plugin-manager.js';

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

  // Type Matcher Types
  TypeMatcher,
  TypeMatcherBuilder,
  ObjectTypeMatcher,
  ArrayTypeMatcher,
  UnionTypeMatcher,
  IntersectionTypeMatcher,

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
} from './type-matcher.js';
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

// Re-export Result type and functions for plugin authors
export type { Result } from '../result.js';
export { ok, err } from '../result.js';

// Re-export core types that plugin authors might need
export type { TypeInfo, PropertyInfo, ResolvedType, GeneratorOptions } from '../types.js';
export { TypeKind } from '../types.js';

// Re-export TypeScript AST types for advanced plugin authors
export type { Type, Symbol } from 'ts-morph';

/**
 * Check if a plugin is valid
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
 * Create a plugin manager instance
 */
export function createPluginManager(): PM {
  return new PM();
}
