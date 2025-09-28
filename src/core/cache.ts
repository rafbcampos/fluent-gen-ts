import type { Type, Symbol as TsSymbol, SourceFile } from 'ts-morph';
import type { TypeInfo } from './types.js';

const SYMBOL_MARKER = Symbol.for('gen:cache:symbol');
const TYPE_MARKER = Symbol.for('gen:cache:type');
const SOURCE_FILE_MARKER = Symbol.for('gen:cache:sourceFile');

export interface CacheEntry<T> {
  readonly value: T;
  readonly lastAccessed: number;
}

export interface CacheOptions {
  readonly maxSize?: number;
}

/**
 * A generic LRU (Least Recently Used) cache implementation.
 * Automatically evicts the least recently used items when the cache reaches its maximum size.
 *
 * @template K - The type of keys in the cache
 * @template V - The type of values in the cache
 *
 * @example
 * ```ts
 * const cache = new Cache<string, number>({ maxSize: 100 });
 * cache.set('key1', 42);
 * const value = cache.get('key1'); // 42
 * ```
 */
export class Cache<K, V> {
  private readonly cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private accessOrder = 0;

  constructor({ maxSize = 1000 }: CacheOptions = {}) {
    this.maxSize = maxSize;
  }

  /**
   * Retrieves a value from the cache and updates its access time.
   *
   * @param key - The key to retrieve
   * @returns The cached value, or undefined if not found
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Update last accessed time for LRU tracking
    this.cache.set(key, {
      value: entry.value,
      lastAccessed: ++this.accessOrder,
    });

    return entry.value;
  }

  /**
   * Stores a value in the cache. If the cache is full and the key is new,
   * the least recently used item will be evicted.
   *
   * @param key - The key to store
   * @param value - The value to store
   */
  set(key: K, value: V): void {
    // Don't store anything if maxSize is 0
    if (this.maxSize === 0) {
      return;
    }

    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      lastAccessed: ++this.accessOrder,
    });
  }

  /**
   * Checks if a key exists in the cache.
   *
   * @param key - The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Removes a key-value pair from the cache.
   *
   * @param key - The key to delete
   * @returns True if the key was deleted, false if it didn't exist
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Removes all entries from the cache and resets access tracking.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = 0;
  }

  /**
   * Returns the current number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let lruKey: K | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.cache.delete(lruKey);
    }
  }
}

export interface TypeResolutionCacheOptions {
  readonly symbolCacheSize?: number;
  readonly typeCacheSize?: number;
  readonly fileCacheSize?: number;
}

/**
 * A specialized cache for TypeScript type resolution operations.
 * Maintains separate LRU caches for symbols, types, and source files from ts-morph.
 *
 * @example
 * ```ts
 * const cache = new TypeResolutionCache({ symbolCacheSize: 1000 });
 * const key = cache.getCacheKey({ file: 'test.ts', typeName: 'User' });
 * cache.setType(key, typeObject);
 * const type = cache.getType(key);
 * ```
 */
export class TypeResolutionCache {
  private readonly symbolCache: Cache<string, TsSymbol>;
  private readonly typeCache: Cache<string, Type | TypeInfo>;
  private readonly fileCache: Cache<string, SourceFile>;

  constructor({
    symbolCacheSize = 5000,
    typeCacheSize = 5000,
    fileCacheSize = 1000,
  }: TypeResolutionCacheOptions = {}) {
    this.symbolCache = new Cache({ maxSize: symbolCacheSize });
    this.typeCache = new Cache({ maxSize: typeCacheSize });
    this.fileCache = new Cache({ maxSize: fileCacheSize });
  }

  /**
   * Generates a unique cache key from file path and type name.
   * Uses null byte separator to avoid collisions.
   *
   * @param params - Object containing file path and type name
   * @returns A unique cache key string
   */
  getCacheKey({ file, typeName }: { file: string; typeName: string }): string {
    return `${file}\0${typeName}`;
  }

  /**
   * Retrieves a cached ts-morph Symbol.
   *
   * @param key - The cache key
   * @returns The cached Symbol, or undefined if not found or invalid
   */
  getSymbol(key: string): TsSymbol | undefined {
    const value = this.symbolCache.get(key);
    return this.isSymbol(value) ? value : undefined;
  }

  /**
   * Stores a ts-morph Symbol in the cache.
   *
   * @param key - The cache key
   * @param value - The Symbol to cache
   */
  setSymbol(key: string, value: TsSymbol): void {
    Object.defineProperty(value, SYMBOL_MARKER, { value: true, enumerable: false });
    this.symbolCache.set(key, value);
  }

  /**
   * Retrieves a cached ts-morph Type or TypeInfo.
   *
   * @param key - The cache key
   * @returns The cached Type or TypeInfo, or undefined if not found or invalid
   */
  getType(key: string): Type | TypeInfo | undefined {
    const value = this.typeCache.get(key);
    return this.isTypeOrTypeInfo(value) ? value : undefined;
  }

  /**
   * Stores a ts-morph Type or TypeInfo in the cache.
   *
   * @param key - The cache key
   * @param value - The Type or TypeInfo to cache
   */
  setType(key: string, value: Type | TypeInfo): void {
    Object.defineProperty(value, TYPE_MARKER, { value: true, enumerable: false });
    this.typeCache.set(key, value);
  }

  /**
   * Retrieves a cached ts-morph SourceFile.
   *
   * @param path - The file path
   * @returns The cached SourceFile, or undefined if not found or invalid
   */
  getFile(path: string): SourceFile | undefined {
    const value = this.fileCache.get(path);
    return this.isSourceFile(value) ? value : undefined;
  }

  /**
   * Stores a ts-morph SourceFile in the cache.
   *
   * @param path - The file path
   * @param value - The SourceFile to cache
   */
  setFile(path: string, value: SourceFile): void {
    Object.defineProperty(value, SOURCE_FILE_MARKER, { value: true, enumerable: false });
    this.fileCache.set(path, value);
  }

  /**
   * Clears all cached symbols, types, and files.
   */
  clear(): void {
    this.symbolCache.clear();
    this.typeCache.clear();
    this.fileCache.clear();
  }

  private isSymbol(value: unknown): value is TsSymbol {
    return value != null && typeof value === 'object' && SYMBOL_MARKER in value;
  }

  private isTypeOrTypeInfo(value: unknown): value is Type | TypeInfo {
    return this.isType(value) || this.isTypeInfo(value);
  }

  private isType(value: unknown): value is Type {
    return value != null && typeof value === 'object' && TYPE_MARKER in value;
  }

  private isTypeInfo(value: unknown): value is TypeInfo {
    return (
      value != null &&
      typeof value === 'object' &&
      'kind' in value &&
      typeof (value as TypeInfo).kind === 'string'
    );
  }

  private isSourceFile(value: unknown): value is SourceFile {
    return value != null && typeof value === 'object' && SOURCE_FILE_MARKER in value;
  }
}
