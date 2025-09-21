import type { Type, Symbol as TsSymbol, SourceFile } from 'ts-morph';
import type { TypeInfo } from './types.js';

export interface CacheEntry<T> {
  readonly value: T;
  readonly lastAccessed: number;
}

export interface CacheOptions {
  readonly maxSize?: number;
}

export class Cache<K, V> {
  private readonly cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private accessOrder = 0;

  constructor({ maxSize = 1000 }: CacheOptions = {}) {
    this.maxSize = maxSize;
  }

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

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = 0;
  }

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

  getCacheKey({ file, typeName }: { file: string; typeName: string }): string {
    return JSON.stringify({ file, typeName });
  }

  getSymbol(key: string): TsSymbol | undefined {
    const value = this.symbolCache.get(key);
    return this.isSymbol(value) ? value : undefined;
  }

  setSymbol(key: string, value: TsSymbol): void {
    this.symbolCache.set(key, value);
  }

  getType(key: string): Type | TypeInfo | undefined {
    const value = this.typeCache.get(key);
    return this.isTypeOrTypeInfo(value) ? value : undefined;
  }

  setType(key: string, value: Type | TypeInfo): void {
    this.typeCache.set(key, value);
  }

  getFile(path: string): SourceFile | undefined {
    const value = this.fileCache.get(path);
    return this.isSourceFile(value) ? value : undefined;
  }

  setFile(path: string, value: SourceFile): void {
    this.fileCache.set(path, value);
  }

  clear(): void {
    this.symbolCache.clear();
    this.typeCache.clear();
    this.fileCache.clear();
  }

  private isSymbol(value: unknown): value is TsSymbol {
    return (
      value != null &&
      typeof value === 'object' &&
      value.constructor.name === 'Symbol' &&
      'getName' in value &&
      typeof (value as TsSymbol).getName === 'function'
    );
  }

  private isTypeOrTypeInfo(value: unknown): value is Type | TypeInfo {
    return this.isType(value) || this.isTypeInfo(value);
  }

  private isType(value: unknown): value is Type {
    return (
      value != null &&
      typeof value === 'object' &&
      value.constructor.name === 'Type' &&
      'getText' in value &&
      typeof (value as Type).getText === 'function'
    );
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
    return (
      value != null &&
      typeof value === 'object' &&
      value.constructor.name === 'SourceFile' &&
      'getFilePath' in value &&
      typeof (value as SourceFile).getFilePath === 'function'
    );
  }
}
