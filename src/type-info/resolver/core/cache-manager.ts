import type { TypeInfo } from '../../../core/types.js';
import type { TypeResolutionCache } from '../../../core/cache.js';
import type { GenericContext } from '../../generic-context.js';

/**
 * Manages type resolution caching with context-aware key generation.
 *
 * Provides efficient caching for type resolution results by generating deterministic
 * keys that account for generic type parameters and their resolved values. This ensures
 * that the same type with different generic bindings gets separate cache entries.
 *
 * @example
 * ```typescript
 * const cache = new TypeResolutionCache();
 * const manager = new CacheManager(cache);
 * const context = new GenericContext();
 *
 * // Generate a cache key
 * const key = manager.generateKey({ typeString: 'Array<T>', context });
 *
 * // Store and retrieve type info
 * manager.set(key, typeInfo);
 * const cached = manager.get(key);
 * ```
 */
export class CacheManager {
  /**
   * Creates a new CacheManager instance.
   *
   * @param cache - The underlying type resolution cache to use for storage
   */
  constructor(private readonly cache: TypeResolutionCache) {}

  /**
   * Generates a deterministic cache key for a type string and generic context.
   *
   * The key incorporates both the base type string and the resolved generic parameters
   * to ensure that the same type with different generic bindings gets separate cache entries.
   * Generic parameters are sorted alphabetically to ensure consistent key generation.
   *
   * @param params - Parameters for key generation
   * @param params.typeString - The base type string (e.g., 'Array<T>')
   * @param params.context - Generic context containing parameter bindings
   * @returns A deterministic cache key string
   *
   * @example
   * ```typescript
   * const key1 = manager.generateKey({ typeString: 'Array<T>', context });
   * // With T=string: "Array<T>::T=primitive:string"
   *
   * const key2 = manager.generateKey({ typeString: 'Map<K,V>', context });
   * // With K=string, V=number: "Map<K,V>::K=primitive:string|V=primitive:number"
   * ```
   */
  generateKey(params: { typeString: string; context: GenericContext }): string {
    const { typeString, context } = params;
    const resolvedGenerics = context
      .getAllGenericParams()
      .map(param => {
        const resolved = context.getResolvedType(param.name);
        return resolved
          ? `${param.name}=${resolved.kind}:${this.serializeTypeInfo(resolved)}`
          : `${param.name}=unresolved`;
      })
      .sort()
      .join('|');

    return resolvedGenerics ? `${typeString}::${resolvedGenerics}` : typeString;
  }

  /**
   * Serializes a TypeInfo object into a deterministic string representation.
   *
   * Creates a compact, deterministic string representation of any TypeInfo object
   * that can be used as part of cache keys. The serialization handles nested types
   * recursively and sorts arrays/unions to ensure consistent output regardless of
   * input order.
   *
   * @param type - The TypeInfo object to serialize
   * @returns A deterministic string representation of the type
   */
  private serializeTypeInfo(type: TypeInfo): string {
    switch (type.kind) {
      case 'primitive':
        return type.name;
      case 'array':
        return `Array<${this.serializeTypeInfo(type.elementType)}>`;
      case 'object':
        if (!type.properties || type.properties.length === 0) {
          return type.name || 'EmptyObject';
        }
        const props = type.properties
          .map(
            prop => `${prop.name}${prop.optional ? '?' : ''}:${this.serializeTypeInfo(prop.type)}`,
          )
          .sort()
          .join(',');
        return `{${props}}`;
      case 'union':
        return type.unionTypes
          .map((t: TypeInfo) => this.serializeTypeInfo(t))
          .sort()
          .join('|');
      case 'intersection':
        return type.intersectionTypes
          .map((t: TypeInfo) => this.serializeTypeInfo(t))
          .sort()
          .join('&');
      case 'reference':
        const args = type.typeArguments?.map(arg => this.serializeTypeInfo(arg)).join(',') || '';
        return args ? `${type.name}<${args}>` : type.name;
      case 'tuple':
        return `[${type.elements.map(e => this.serializeTypeInfo(e)).join(',')}]`;
      case 'literal':
        return `"${type.literal as string}"`;
      case 'function':
        return type.name || 'Function';
      default:
        return type.kind;
    }
  }

  /**
   * Retrieves a cached TypeInfo by its key.
   *
   * Safely extracts TypeInfo from the cache, filtering out any non-TypeInfo
   * entries that might be stored alongside. Uses type guards to ensure
   * only valid TypeInfo objects are returned.
   *
   * @param key - The cache key to look up
   * @returns The cached TypeInfo if found and valid, undefined otherwise
   *
   * @example
   * ```typescript
   * const key = manager.generateKey({ typeString: 'User', context });
   * const typeInfo = manager.get(key);
   * if (typeInfo) {
   *   console.log('Found cached type:', typeInfo.kind);
   * }
   * ```
   */
  get(key: string): TypeInfo | undefined {
    const result = this.cache.getType(key);
    return result && typeof result === 'object' && 'kind' in result
      ? (result as TypeInfo)
      : undefined;
  }

  /**
   * Stores a TypeInfo object in the cache with the specified key.
   *
   * The TypeInfo will be stored in the underlying cache and can be retrieved
   * later using the same key. The cache may evict old entries based on its
   * LRU policy when full.
   *
   * @param key - The cache key to store under
   * @param value - The TypeInfo object to cache
   *
   * @example
   * ```typescript
   * const key = manager.generateKey({ typeString: 'User', context });
   * const typeInfo = { kind: 'object', name: 'User', properties: [...] };
   * manager.set(key, typeInfo);
   * ```
   */
  set(key: string, value: TypeInfo): void {
    this.cache.setType(key, value);
  }

  /**
   * Clears all entries from the cache.
   *
   * Removes all cached TypeInfo objects and resets the cache to an empty state.
   * This operation cannot be undone and will require all types to be resolved
   * again from their original sources.
   *
   * @example
   * ```typescript
   * manager.clear(); // All cached types are now gone
   * ```
   */
  clear(): void {
    this.cache.clear();
  }
}
