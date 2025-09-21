import { test, expect, describe, beforeEach } from 'vitest';
import { Cache, TypeResolutionCache } from '../cache.js';
import { Project } from 'ts-morph';

describe('Cache', () => {
  let cache: Cache<string, string>;

  beforeEach(() => {
    cache = new Cache<string, string>();
  });

  describe('constructor', () => {
    test('creates cache with default options', () => {
      const defaultCache = new Cache<string, string>();
      expect(defaultCache.size).toBe(0);
    });

    test('creates cache with custom maxSize', () => {
      const customCache = new Cache<string, string>({ maxSize: 500 });
      expect(customCache.size).toBe(0);
    });
  });

  describe('basic operations', () => {
    test('stores and retrieves values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      expect(cache.size).toBe(1);
    });

    test('returns undefined for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    test('checks if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    test('deletes keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.delete('non-existent')).toBe(false);
    });

    test('clears all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('LRU behavior', () => {
    test('evicts least recently used item when cache is full', () => {
      const smallCache = new Cache<string, string>({ maxSize: 2 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      expect(smallCache.size).toBe(2);

      // Access key1 to make it more recently used
      smallCache.get('key1');

      // Adding key3 should evict key2 (least recently used)
      smallCache.set('key3', 'value3');
      expect(smallCache.size).toBe(2);
      expect(smallCache.has('key1')).toBe(true);
      expect(smallCache.has('key2')).toBe(false);
      expect(smallCache.has('key3')).toBe(true);
    });

    test("updating existing key doesn't increase size", () => {
      const smallCache = new Cache<string, string>({ maxSize: 2 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      expect(smallCache.size).toBe(2);

      // Update existing key
      smallCache.set('key1', 'updated-value1');
      expect(smallCache.size).toBe(2);
      expect(smallCache.get('key1')).toBe('updated-value1');
    });

    test('accessing items updates LRU order', () => {
      const smallCache = new Cache<string, string>({ maxSize: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Access in order: key3, key1, key2
      smallCache.get('key3');
      smallCache.get('key1');
      smallCache.get('key2');

      // Adding key4 should evict key3 (oldest access)
      smallCache.set('key4', 'value4');
      expect(smallCache.has('key3')).toBe(false);
      expect(smallCache.has('key1')).toBe(true);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key4')).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles zero maxSize', () => {
      const zeroCache = new Cache<string, string>({ maxSize: 0 });
      zeroCache.set('key1', 'value1');
      expect(zeroCache.size).toBe(0);
      expect(zeroCache.get('key1')).toBeUndefined();
    });

    test('handles single item cache', () => {
      const singleCache = new Cache<string, string>({ maxSize: 1 });

      singleCache.set('key1', 'value1');
      expect(singleCache.size).toBe(1);
      expect(singleCache.get('key1')).toBe('value1');

      singleCache.set('key2', 'value2');
      expect(singleCache.size).toBe(1);
      expect(singleCache.has('key1')).toBe(false);
      expect(singleCache.get('key2')).toBe('value2');
    });
  });
});

describe('TypeResolutionCache', () => {
  let cache: TypeResolutionCache;
  let project: Project;

  beforeEach(() => {
    cache = new TypeResolutionCache();
    project = new Project();
  });

  describe('constructor', () => {
    test('creates cache with default options', () => {
      const defaultCache = new TypeResolutionCache();
      expect(defaultCache).toBeDefined();
    });

    test('creates cache with custom options', () => {
      const customCache = new TypeResolutionCache({
        symbolCacheSize: 100,
        typeCacheSize: 200,
        fileCacheSize: 50,
      });
      expect(customCache).toBeDefined();
    });
  });

  describe('cache key generation', () => {
    test('generates consistent keys', () => {
      const key1 = cache.getCacheKey({ file: 'test.ts', typeName: 'User' });
      const key2 = cache.getCacheKey({ file: 'test.ts', typeName: 'User' });
      expect(key1).toBe(key2);
    });

    test('generates different keys for different inputs', () => {
      const key1 = cache.getCacheKey({ file: 'test.ts', typeName: 'User' });
      const key2 = cache.getCacheKey({ file: 'test.ts', typeName: 'Admin' });
      const key3 = cache.getCacheKey({ file: 'other.ts', typeName: 'User' });

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    test('handles potential collision cases', () => {
      const key1 = cache.getCacheKey({
        file: 'file.ts',
        typeName: 'Type::Name',
      });
      const key2 = cache.getCacheKey({
        file: 'file.ts::Type',
        typeName: 'Name',
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe('type caching', () => {
    test('caches and retrieves Type objects', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export interface User {
          id: string;
          name: string;
        }
      `,
      );

      const userInterface = sourceFile.getInterface('User');
      if (!userInterface) {
        throw new Error('User interface not found');
      }

      const userType = userInterface.getType();
      const key = cache.getCacheKey({ file: 'test.ts', typeName: 'User' });

      cache.setType(key, userType);
      const retrieved = cache.getType(key);

      expect(retrieved).toBe(userType);
    });

    test('returns undefined for non-existent types', () => {
      const key = cache.getCacheKey({
        file: 'test.ts',
        typeName: 'NonExistent',
      });
      expect(cache.getType(key)).toBeUndefined();
    });
  });

  describe('symbol caching', () => {
    test('caches and retrieves Symbol objects', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export interface User {
          id: string;
          name: string;
        }
      `,
      );

      const userInterface = sourceFile.getInterface('User');
      if (!userInterface) {
        throw new Error('User interface not found');
      }

      const userSymbol = userInterface.getSymbol();
      if (!userSymbol) {
        throw new Error('User symbol not found');
      }

      const key = 'user-symbol-key';
      cache.setSymbol(key, userSymbol);
      const retrieved = cache.getSymbol(key);

      expect(retrieved).toBe(userSymbol);
    });

    test('returns undefined for non-existent symbols', () => {
      expect(cache.getSymbol('non-existent')).toBeUndefined();
    });
  });

  describe('file caching', () => {
    test('caches and retrieves SourceFile objects', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export interface User {
          id: string;
        }
      `,
      );

      const filePath = 'test.ts';
      cache.setFile(filePath, sourceFile);
      const retrieved = cache.getFile(filePath);

      expect(retrieved).toBe(sourceFile);
    });

    test('returns undefined for non-existent files', () => {
      expect(cache.getFile('non-existent.ts')).toBeUndefined();
    });
  });

  describe('type guards', () => {
    test('validates cached objects with type guards', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export interface User {
          id: string;
        }
      `,
      );

      const userInterface = sourceFile.getInterface('User');
      if (!userInterface) {
        throw new Error('User interface not found');
      }

      const userType = userInterface.getType();
      const key = cache.getCacheKey({ file: 'test.ts', typeName: 'User' });

      cache.setType(key, userType);

      // Should return the Type object since it passes type guard
      expect(cache.getType(key)).toBe(userType);

      // Type guards are tested implicitly - if we store a Type and retrieve it,
      // it should work. If we try to retrieve something that was never a Type,
      // it should return undefined.
      const nonExistentKey = cache.getCacheKey({
        file: 'non-existent.ts',
        typeName: 'NonExistent',
      });
      expect(cache.getType(nonExistentKey)).toBeUndefined();
    });
  });

  describe('cache clearing', () => {
    test('clears all caches', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export interface User {
          id: string;
        }
      `,
      );

      const userInterface = sourceFile.getInterface('User');
      if (!userInterface) {
        throw new Error('User interface not found');
      }

      const userType = userInterface.getType();
      const userSymbol = userInterface.getSymbol();

      if (!userSymbol) {
        throw new Error('User symbol not found');
      }

      // Cache all types
      const typeKey = cache.getCacheKey({ file: 'test.ts', typeName: 'User' });
      cache.setType(typeKey, userType);
      cache.setSymbol('symbol-key', userSymbol);
      cache.setFile('test.ts', sourceFile);

      // Verify they're cached
      expect(cache.getType(typeKey)).toBe(userType);
      expect(cache.getSymbol('symbol-key')).toBe(userSymbol);
      expect(cache.getFile('test.ts')).toBe(sourceFile);

      // Clear and verify they're gone
      cache.clear();
      expect(cache.getType(typeKey)).toBeUndefined();
      expect(cache.getSymbol('symbol-key')).toBeUndefined();
      expect(cache.getFile('test.ts')).toBeUndefined();
    });
  });
});
