/**
 * TypeResolver - Core class for resolving TypeScript types to TypeInfo structures.
 *
 * @remarks
 * The TypeResolver analyzes TypeScript types from ts-morph and converts them into
 * structured TypeInfo objects. It handles complex type scenarios including:
 * - Generic types with type parameters
 * - Union and intersection types
 * - Mapped and conditional types
 * - Utility types (Partial, Required, etc.)
 * - Built-in types and type aliases
 *
 * @example
 * ```typescript
 * import { TypeResolver } from '@type-info/resolver';
 *
 * const resolver = new TypeResolver({
 *   maxDepth: 30,
 *   expandUtilityTypes: true
 * });
 *
 * const result = await resolver.resolveType(someType);
 * if (result.ok) {
 *   console.log(result.value);
 * }
 * ```
 */
export { TypeResolver } from './type-resolver.js';

/**
 * ResolverOptions - Configuration options for TypeResolver.
 *
 * @remarks
 * Controls how the TypeResolver processes types:
 * - maxDepth: Maximum recursion depth for nested type resolution
 * - cache: Custom cache implementation for resolved types
 * - pluginManager: Plugin system for extending resolution behavior
 * - expandUtilityTypes: Whether to expand utility types like Partial/Required
 * - resolveMappedTypes: Whether to resolve mapped types
 * - resolveConditionalTypes: Whether to resolve conditional types
 * - resolveTemplateLiterals: Whether to resolve template literal types
 * - project: ts-morph Project instance for type resolution context
 */
export type { ResolverOptions } from './resolver-options.js';
