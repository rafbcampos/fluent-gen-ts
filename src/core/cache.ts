export interface CacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly hits: number;
}

export class Cache<K, V> {
  private readonly cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly ttl?: number;

  constructor(maxSize = 1000, ttl?: number) {
    this.maxSize = maxSize;
    if (ttl !== undefined) {
      this.ttl = ttl;
    }
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    this.cache.set(key, {
      ...entry,
      hits: entry.hits + 1,
    });

    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  has(key: K): boolean {
    if (!this.cache.has(key)) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let lruKey: K | undefined;
    let minScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      const score = entry.hits + (Date.now() - entry.timestamp) / 1000;
      if (score < minScore) {
        minScore = score;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.cache.delete(lruKey);
    }
  }
}

export class TypeResolutionCache {
  private readonly symbolCache = new Cache<string, unknown>(5000);
  private readonly typeCache = new Cache<string, unknown>(5000);
  private readonly fileCache = new Cache<string, unknown>(1000);

  getCacheKey(file: string, typeName: string): string {
    return `${file}::${typeName}`;
  }

  getSymbol(key: string): unknown {
    return this.symbolCache.get(key);
  }

  setSymbol(key: string, value: unknown): void {
    this.symbolCache.set(key, value);
  }

  getType(key: string): unknown {
    return this.typeCache.get(key);
  }

  setType(key: string, value: unknown): void {
    this.typeCache.set(key, value);
  }

  getFile(path: string): unknown {
    return this.fileCache.get(path);
  }

  setFile(path: string, value: unknown): void {
    this.fileCache.set(path, value);
  }

  clear(): void {
    this.symbolCache.clear();
    this.typeCache.clear();
    this.fileCache.clear();
  }
}

