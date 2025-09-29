import { test, expect, describe, beforeEach } from 'vitest';
import { CacheManager } from '../cache-manager.js';
import { GenericContext } from '../../../generic-context.js';
import { TypeResolutionCache } from '../../../../core/cache.js';
import { TypeKind } from '../../../../core/types.js';
import type { TypeInfo, GenericParam } from '../../../../core/types.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let cache: TypeResolutionCache;
  let context: GenericContext;

  beforeEach(() => {
    cache = new TypeResolutionCache();
    cacheManager = new CacheManager(cache);
    context = new GenericContext();
  });

  describe('generateKey', () => {
    test('generates simple key without generics', () => {
      const key = cacheManager.generateKey({
        typeString: 'string',
        context,
      });

      expect(key).toBe('string');
    });

    test('generates key with single resolved generic', () => {
      const param: GenericParam = { name: 'T' };
      const resolvedType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      context.registerGenericParam({ param });
      context.setTypeArgument({ paramName: 'T', type: resolvedType });

      const key = cacheManager.generateKey({
        typeString: 'Array<T>',
        context,
      });

      expect(key).toContain('Array<T>::');
      expect(key).toContain('T=primitive:');
      expect(key).toContain('string');
    });

    test('generates consistent key with multiple resolved generics', () => {
      const paramT: GenericParam = { name: 'T' };
      const paramU: GenericParam = { name: 'U' };
      const resolvedTypeT: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const resolvedTypeU: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };

      context.registerGenericParam({ param: paramT });
      context.registerGenericParam({ param: paramU });
      context.setTypeArgument({ paramName: 'T', type: resolvedTypeT });
      context.setTypeArgument({ paramName: 'U', type: resolvedTypeU });

      const key1 = cacheManager.generateKey({
        typeString: 'Map<T, U>',
        context,
      });

      const key2 = cacheManager.generateKey({
        typeString: 'Map<T, U>',
        context,
      });

      expect(key1).toBe(key2);
      expect(key1).toContain('T=primitive:');
      expect(key1).toContain('U=primitive:');
    });

    test('handles unresolved generics', () => {
      const param: GenericParam = { name: 'T' };
      context.registerGenericParam({ param });

      const key = cacheManager.generateKey({
        typeString: 'Array<T>',
        context,
      });

      expect(key).toContain('T=unresolved');
    });

    test('sorts generic parameters for consistent keys', () => {
      const paramA: GenericParam = { name: 'A' };
      const paramB: GenericParam = { name: 'B' };
      const paramZ: GenericParam = { name: 'Z' };

      context.registerGenericParam({ param: paramA });
      context.registerGenericParam({ param: paramB });
      context.registerGenericParam({ param: paramZ });

      context.setTypeArgument({
        paramName: 'A',
        type: { kind: TypeKind.Primitive, name: 'string' },
      });
      context.setTypeArgument({
        paramName: 'B',
        type: { kind: TypeKind.Primitive, name: 'number' },
      });
      context.setTypeArgument({
        paramName: 'Z',
        type: { kind: TypeKind.Primitive, name: 'boolean' },
      });

      const key = cacheManager.generateKey({
        typeString: 'Complex<A, B, Z>',
        context,
      });

      const parts = key.split('::')[1]?.split('|') || [];
      expect(parts[0]?.startsWith('A=')).toBe(true);
      expect(parts[1]?.startsWith('B=')).toBe(true);
      expect(parts[2]?.startsWith('Z=')).toBe(true);
    });

    test('handles complex nested type objects', () => {
      const param: GenericParam = { name: 'T' };
      const complexType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'ComplexType',
        properties: [
          {
            name: 'prop1',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'prop2',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: true,
            readonly: false,
          },
        ],
      };

      context.registerGenericParam({ param });
      context.setTypeArgument({ paramName: 'T', type: complexType });

      const key = cacheManager.generateKey({
        typeString: 'Wrapper<T>',
        context,
      });

      expect(key).toContain('T=object:');
      expect(key).toContain('prop1:string');
      expect(key).toContain('prop2?:number');
    });
  });

  describe('get', () => {
    test('returns undefined for non-existent key', () => {
      const result = cacheManager.get('non-existent');
      expect(result).toBeUndefined();
    });

    test('returns cached TypeInfo', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      cacheManager.set('test-key', typeInfo);

      const result = cacheManager.get('test-key');
      expect(result).toEqual(typeInfo);
    });
  });

  describe('set', () => {
    test('stores TypeInfo in cache', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      cacheManager.set('test-key', typeInfo);
      const result = cacheManager.get('test-key');

      expect(result).toEqual(typeInfo);
    });
  });

  describe('clear', () => {
    test('clears all cached entries', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      cacheManager.set('test-key', typeInfo);

      expect(cacheManager.get('test-key')).toEqual(typeInfo);

      cacheManager.clear();

      expect(cacheManager.get('test-key')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    test('handles empty type string', () => {
      const key = cacheManager.generateKey({
        typeString: '',
        context,
      });

      expect(key).toBe('');
    });

    test('handles context with no generic parameters', () => {
      const key = cacheManager.generateKey({
        typeString: 'SomeType',
        context,
      });

      expect(key).toBe('SomeType');
    });

    test('handles mixed resolved and unresolved generics', () => {
      const paramT: GenericParam = { name: 'T' };
      const paramU: GenericParam = { name: 'U' };

      context.registerGenericParam({ param: paramT });
      context.registerGenericParam({ param: paramU });
      context.setTypeArgument({
        paramName: 'T',
        type: { kind: TypeKind.Primitive, name: 'string' },
      });
      // U is left unresolved

      const key = cacheManager.generateKey({
        typeString: 'Map<T, U>',
        context,
      });

      expect(key).toContain('T=primitive:');
      expect(key).toContain('U=unresolved');
    });
  });
});
