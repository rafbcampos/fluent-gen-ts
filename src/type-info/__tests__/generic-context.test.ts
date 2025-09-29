import { test, expect, describe, beforeEach } from 'vitest';
import { GenericContext } from '../generic-context.js';
import { TypeKind } from '../../core/types.js';
import type { GenericParam, TypeInfo } from '../../core/types.js';

describe('GenericContext', () => {
  let context: GenericContext;

  beforeEach(() => {
    context = new GenericContext();
  });

  describe('registerGenericParam', () => {
    test('registers a simple generic parameter', () => {
      const param: GenericParam = { name: 'T' };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(true);
      expect(context.isGenericParam('T')).toBe(true);
      expect(context.getGenericParam('T')).toEqual(param);
    });

    test('registers generic parameter with constraint', () => {
      const param: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(true);
      const retrieved = context.getGenericParam('T');
      expect(retrieved?.constraint).toEqual(param.constraint);
    });

    test('registers generic parameter with default', () => {
      const param: GenericParam = {
        name: 'T',
        default: { kind: TypeKind.Primitive, name: 'any' },
      };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(true);
      const retrieved = context.getGenericParam('T');
      expect(retrieved?.default).toEqual(param.default);
      expect(context.getDefaultType('T')).toEqual(param.default);
    });

    test('overwrites existing parameter with same name', () => {
      const param1: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };
      const param2: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'number' },
      };

      const result1 = context.registerGenericParam({ param: param1 });
      const result2 = context.registerGenericParam({ param: param2 });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      const retrieved = context.getGenericParam('T');
      expect(retrieved?.constraint).toEqual(param2.constraint);
    });

    test('returns error for invalid parameter name', () => {
      const param: GenericParam = { name: '' };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('non-empty string');
      }
    });

    test('returns error for circular constraint', () => {
      const param: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Reference, name: 'T' },
      };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Circular constraint');
      }
    });
  });

  describe('registerGenericParams', () => {
    test('registers multiple parameters', () => {
      const params: GenericParam[] = [
        { name: 'T' },
        { name: 'U', constraint: { kind: TypeKind.Primitive, name: 'string' } },
        { name: 'V', default: { kind: TypeKind.Primitive, name: 'number' } },
      ];

      const result = context.registerGenericParams({ params });

      expect(result.ok).toBe(true);
      expect(context.isGenericParam('T')).toBe(true);
      expect(context.isGenericParam('U')).toBe(true);
      expect(context.isGenericParam('V')).toBe(true);
      expect(context.getAllGenericParams()).toHaveLength(3);
    });

    test('handles empty array', () => {
      const result = context.registerGenericParams({ params: [] });

      expect(result.ok).toBe(true);
      expect(context.getAllGenericParams()).toHaveLength(0);
    });

    test('returns error on first invalid parameter', () => {
      const params: GenericParam[] = [
        { name: 'T' },
        { name: '' }, // Invalid
        { name: 'U' },
      ];

      const result = context.registerGenericParams({ params });

      expect(result.ok).toBe(false);
      // Should not register any parameters on error
      expect(context.getAllGenericParams()).toHaveLength(0);
    });
  });

  describe('setTypeArgument & getResolvedType', () => {
    test('sets and retrieves type arguments', () => {
      const param: GenericParam = { name: 'T' };
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const registerResult = context.registerGenericParam({ param });
      const setResult = context.setTypeArgument({
        paramName: 'T',
        type: typeArg,
      });

      expect(registerResult.ok).toBe(true);
      expect(setResult.ok).toBe(true);
      expect(context.getResolvedType('T')).toEqual(typeArg);
    });

    test('returns undefined for unresolved parameters', () => {
      const param: GenericParam = { name: 'T' };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(true);
      expect(context.getResolvedType('T')).toBeUndefined();
    });

    test('returns undefined for non-existent parameters', () => {
      expect(context.getResolvedType('NonExistent')).toBeUndefined();
    });

    test('type arguments take precedence over defaults', () => {
      const param: GenericParam = {
        name: 'T',
        default: { kind: TypeKind.Primitive, name: 'any' },
      };
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const registerResult = context.registerGenericParam({ param });
      const setResult = context.setTypeArgument({
        paramName: 'T',
        type: typeArg,
      });

      expect(registerResult.ok).toBe(true);
      expect(setResult.ok).toBe(true);
      expect(context.getResolvedType('T')).toEqual(typeArg);
      expect(context.getDefaultType('T')).toEqual(param.default);
    });

    test('returns error for non-existent parameter', () => {
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result = context.setTypeArgument({
        paramName: 'NonExistent',
        type: typeArg,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('not registered');
      }
    });

    test('returns error for empty parameter name', () => {
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result = context.setTypeArgument({ paramName: '', type: typeArg });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('non-empty string');
      }
    });
  });

  describe('parent-child context hierarchy', () => {
    test('child context inherits parent parameters', () => {
      const parent = new GenericContext();
      const parentResult = parent.registerGenericParam({
        param: { name: 'T' },
      });

      const child = parent.createChildContext();
      const childResult = child.registerGenericParam({ param: { name: 'U' } });

      expect(parentResult.ok).toBe(true);
      expect(childResult.ok).toBe(true);
      expect(child.isGenericParam('T')).toBe(true);
      expect(child.isGenericParam('U')).toBe(true);
      expect(parent.isGenericParam('U')).toBe(false);
    });

    test('child context can resolve parent type arguments', () => {
      const parent = new GenericContext();
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const registerResult = parent.registerGenericParam({
        param: { name: 'T' },
      });
      const setResult = parent.setTypeArgument({
        paramName: 'T',
        type: typeArg,
      });

      const child = parent.createChildContext();

      expect(registerResult.ok).toBe(true);
      expect(setResult.ok).toBe(true);
      expect(child.getResolvedType('T')).toEqual(typeArg);
    });

    test('child parameters shadow parent parameters', () => {
      const parent = new GenericContext();
      const child = parent.createChildContext();

      const parentParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };
      const childParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'number' },
      };

      const parentResult = parent.registerGenericParam({ param: parentParam });
      const childResult = child.registerGenericParam({ param: childParam });

      expect(parentResult.ok).toBe(true);
      expect(childResult.ok).toBe(true);
      expect(child.getGenericParam('T')?.constraint).toEqual(childParam.constraint);
      expect(parent.getGenericParam('T')?.constraint).toEqual(parentParam.constraint);
    });

    test('getAllGenericParams returns all parameters from hierarchy', () => {
      const parent = new GenericContext();
      const child = parent.createChildContext();

      parent.registerGenericParam({ param: { name: 'T' } });
      parent.registerGenericParam({ param: { name: 'U' } });
      child.registerGenericParam({ param: { name: 'V' } });
      child.registerGenericParam({ param: { name: 'W' } });

      const allParams = child.getAllGenericParams();
      const paramNames = allParams.map(p => p.name);

      expect(paramNames).toContain('T');
      expect(paramNames).toContain('U');
      expect(paramNames).toContain('V');
      expect(paramNames).toContain('W');
      expect(allParams).toHaveLength(4);
    });

    test('deep hierarchy works correctly', () => {
      let current = new GenericContext();

      // Create 5 levels deep
      for (let i = 0; i < 5; i++) {
        const result = current.registerGenericParam({
          param: { name: `T${i}` },
        });
        expect(result.ok).toBe(true);
        current = current.createChildContext();
      }

      // Deepest level should see all parameters
      expect(current.isGenericParam('T0')).toBe(true);
      expect(current.isGenericParam('T4')).toBe(true);
      expect(current.getAllGenericParams()).toHaveLength(5);
    });
  });

  describe('getUnresolvedGenerics', () => {
    test('returns parameters without type arguments', () => {
      const param1: GenericParam = { name: 'T' };
      const param2: GenericParam = { name: 'U' };
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result1 = context.registerGenericParam({ param: param1 });
      const result2 = context.registerGenericParam({ param: param2 });
      const result3 = context.setTypeArgument({
        paramName: 'T',
        type: typeArg,
      });

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(result3.ok).toBe(true);

      const unresolved = context.getUnresolvedGenerics();
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0]?.name).toBe('U');
    });

    test('returns empty array when all parameters are resolved', () => {
      const param: GenericParam = { name: 'T' };
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      context.registerGenericParam({ param });
      context.setTypeArgument({ paramName: 'T', type: typeArg });

      expect(context.getUnresolvedGenerics()).toHaveLength(0);
    });

    test('returns all parameters when none are resolved', () => {
      const params: GenericParam[] = [{ name: 'T' }, { name: 'U' }, { name: 'V' }];

      context.registerGenericParams({ params });

      const unresolved = context.getUnresolvedGenerics();
      expect(unresolved).toHaveLength(3);
      expect(unresolved.map(p => p.name)).toEqual(expect.arrayContaining(['T', 'U', 'V']));
    });
  });

  describe('merge', () => {
    test('merges parameters from another context', () => {
      const other = new GenericContext();

      context.registerGenericParam({ param: { name: 'T' } });
      other.registerGenericParam({ param: { name: 'U' } });

      const result = context.merge({ other });

      expect(result.ok).toBe(true);
      expect(context.isGenericParam('T')).toBe(true);
      expect(context.isGenericParam('U')).toBe(true);
    });

    test('merges type arguments from another context', () => {
      const other = new GenericContext();
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      other.registerGenericParam({ param: { name: 'T' } });
      other.setTypeArgument({ paramName: 'T', type: typeArg });

      const result = context.merge({ other });

      expect(result.ok).toBe(true);
      expect(context.getResolvedType('T')).toEqual(typeArg);
    });

    test('keeps existing parameters by default', () => {
      const other = new GenericContext();

      const existingParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };
      const newParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'number' },
      };

      context.registerGenericParam({ param: existingParam });
      other.registerGenericParam({ param: newParam });

      const result = context.merge({ other });

      expect(result.ok).toBe(true);
      expect(context.getGenericParam('T')?.constraint).toEqual(existingParam.constraint);
    });

    test('overwrites with explicit strategy', () => {
      const other = new GenericContext();

      const existingParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };
      const newParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'number' },
      };

      context.registerGenericParam({ param: existingParam });
      other.registerGenericParam({ param: newParam });

      const result = context.merge({ other, strategy: 'overwrite' });

      expect(result.ok).toBe(true);
      expect(context.getGenericParam('T')?.constraint).toEqual(newParam.constraint);
    });

    test('returns error on conflict with error strategy', () => {
      const other = new GenericContext();

      const existingParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };
      const newParam: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'number' },
      };

      context.registerGenericParam({ param: existingParam });
      other.registerGenericParam({ param: newParam });

      const result = context.merge({ other, strategy: 'error-on-conflict' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Conflicting generic parameter');
      }
    });

    test('keeps existing type arguments by default', () => {
      const other = new GenericContext();

      const existingArg: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };
      const newArg: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };

      context.registerGenericParam({ param: { name: 'T' } });
      context.setTypeArgument({ paramName: 'T', type: existingArg });

      other.registerGenericParam({ param: { name: 'T' } });
      other.setTypeArgument({ paramName: 'T', type: newArg });

      const result = context.merge({ other });

      expect(result.ok).toBe(true);
      expect(context.getResolvedType('T')).toEqual(existingArg);
    });
  });

  describe('clone', () => {
    test('creates independent copy', () => {
      const param: GenericParam = { name: 'T' };
      const typeArg: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      context.registerGenericParam({ param });
      context.setTypeArgument({ paramName: 'T', type: typeArg });

      const cloned = context.clone();

      expect(cloned.isGenericParam('T')).toBe(true);
      expect(cloned.getResolvedType('T')).toEqual(typeArg);
    });

    test('clone is independent of original', () => {
      context.registerGenericParam({ param: { name: 'T' } });

      const cloned = context.clone();
      cloned.registerGenericParam({ param: { name: 'U' } });

      expect(context.isGenericParam('U')).toBe(false);
      expect(cloned.isGenericParam('U')).toBe(true);
    });

    test('clone preserves parent context reference', () => {
      const parent = new GenericContext();
      parent.registerGenericParam({ param: { name: 'ParentT' } });

      const child = parent.createChildContext();
      child.registerGenericParam({ param: { name: 'ChildT' } });

      const cloned = child.clone();

      expect(cloned.isGenericParam('ParentT')).toBe(true);
      expect(cloned.isGenericParam('ChildT')).toBe(true);
    });

    test("modifications to clone don't affect parent hierarchy", () => {
      const parent = new GenericContext();
      const child = parent.createChildContext();

      child.registerGenericParam({ param: { name: 'T' } });

      const cloned = child.clone();
      cloned.setTypeArgument({
        paramName: 'T',
        type: { kind: TypeKind.Primitive, name: 'string' },
      });

      expect(child.getResolvedType('T')).toBeUndefined();
      expect(cloned.getResolvedType('T')).toBeDefined();
    });
  });

  describe('circular constraint detection', () => {
    test('detects direct circular constraint', () => {
      const param: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Reference, name: 'T' },
      };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Circular constraint');
      }
    });

    test('should detect indirect circular constraints between two parameters', () => {
      // First register T extends U - this should succeed
      const paramT: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Reference, name: 'U' },
      };

      const resultT = context.registerGenericParam({ param: paramT });
      expect(resultT.ok).toBe(true);

      // Now try to register U extends T - this should fail due to circularity
      const paramU: GenericParam = {
        name: 'U',
        constraint: { kind: TypeKind.Reference, name: 'T' },
      };

      const resultU = context.registerGenericParam({ param: paramU });
      expect(resultU.ok).toBe(false);
      if (!resultU.ok) {
        expect(resultU.error.message).toContain('Circular constraint');
      }
    });

    test('should detect indirect circular constraints in chain', () => {
      // Register T extends U
      const paramT: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Reference, name: 'U' },
      };
      expect(context.registerGenericParam({ param: paramT }).ok).toBe(true);

      // Register U extends V
      const paramU: GenericParam = {
        name: 'U',
        constraint: { kind: TypeKind.Reference, name: 'V' },
      };
      expect(context.registerGenericParam({ param: paramU }).ok).toBe(true);

      // Try to register V extends T - should fail
      const paramV: GenericParam = {
        name: 'V',
        constraint: { kind: TypeKind.Reference, name: 'T' },
      };

      const resultV = context.registerGenericParam({ param: paramV });
      expect(resultV.ok).toBe(false);
      if (!resultV.ok) {
        expect(resultV.error.message).toContain('Circular constraint');
      }
    });

    test('allows valid constraint chains without circularity', () => {
      // T extends string - should work
      const paramT: GenericParam = {
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };
      expect(context.registerGenericParam({ param: paramT }).ok).toBe(true);

      // U extends T - should work
      const paramU: GenericParam = {
        name: 'U',
        constraint: { kind: TypeKind.Reference, name: 'T' },
      };
      expect(context.registerGenericParam({ param: paramU }).ok).toBe(true);

      // V extends U - should work
      const paramV: GenericParam = {
        name: 'V',
        constraint: { kind: TypeKind.Reference, name: 'U' },
      };
      expect(context.registerGenericParam({ param: paramV }).ok).toBe(true);
    });
  });

  describe('edge cases and error conditions', () => {
    test('rejects empty parameter names', () => {
      const param: GenericParam = { name: '' };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(false);
      expect(context.isGenericParam('')).toBe(false);
    });

    test('rejects non-string parameter names', () => {
      const paramWithNumber = { name: 123 } as any;
      const result1 = context.registerGenericParam({ param: paramWithNumber });
      expect(result1.ok).toBe(false);

      const paramWithNull = { name: null } as any;
      const result2 = context.registerGenericParam({ param: paramWithNull });
      expect(result2.ok).toBe(false);

      const paramWithUndefined = { name: undefined } as any;
      const result3 = context.registerGenericParam({ param: paramWithUndefined });
      expect(result3.ok).toBe(false);
    });

    test('handles special characters in parameter names', () => {
      const param: GenericParam = { name: 'T$_123' };

      const result = context.registerGenericParam({ param });

      expect(result.ok).toBe(true);
      expect(context.isGenericParam('T$_123')).toBe(true);
    });

    test("large number of parameters doesn't cause issues", () => {
      const params: GenericParam[] = [];
      for (let i = 0; i < 1000; i++) {
        params.push({ name: `T${i}` });
      }

      const result = context.registerGenericParams({ params });

      expect(result.ok).toBe(true);
      expect(context.getAllGenericParams()).toHaveLength(1000);
      expect(context.isGenericParam('T999')).toBe(true);
    });

    test('context with no parent behaves correctly', () => {
      expect(context.getGenericParam('NonExistent')).toBeUndefined();
      expect(context.getResolvedType('NonExistent')).toBeUndefined();
      expect(context.isGenericParam('NonExistent')).toBe(false);
      expect(context.getAllGenericParams()).toHaveLength(0);
    });
  });

  describe('performance characteristics', () => {
    test('getAllGenericParams is called multiple times', () => {
      const parent = new GenericContext();
      const child = parent.createChildContext();

      parent.registerGenericParam({ param: { name: 'T' } });
      child.registerGenericParam({ param: { name: 'U' } });

      // Call multiple times to test caching performance
      const calls = 100;
      const start = performance.now();

      for (let i = 0; i < calls; i++) {
        child.getAllGenericParams();
      }

      const duration = performance.now() - start;
      console.log(`getAllGenericParams() ${calls} calls took ${duration}ms (with caching)`);

      // Should be much faster with caching
      expect(duration).toBeLessThan(10); // Should be very fast with caching
    });

    test('deep hierarchy lookup performance', () => {
      let current = new GenericContext();

      // Create 20 levels deep with multiple params each
      for (let level = 0; level < 20; level++) {
        for (let param = 0; param < 5; param++) {
          current.registerGenericParam({
            param: { name: `T${level}_${param}` },
          });
        }
        current = current.createChildContext();
      }

      const start = performance.now();

      // Test lookups at deepest level
      for (let i = 0; i < 100; i++) {
        current.isGenericParam('T0_0'); // Deepest lookup
        current.isGenericParam('T19_4'); // Latest level
        current.isGenericParam('NonExistent'); // Miss
      }

      const duration = performance.now() - start;
      console.log(`Deep hierarchy lookup 300 operations took ${duration}ms`);

      expect(duration).toBeLessThan(50); // Should be reasonably fast
    });

    test('cache invalidation works correctly', () => {
      const parent = new GenericContext();
      const child = parent.createChildContext();

      parent.registerGenericParam({ param: { name: 'T' } });

      // First call builds cache
      const firstCall = child.getAllGenericParams();
      expect(firstCall).toHaveLength(1);

      // Add parameter, should invalidate cache
      child.registerGenericParam({ param: { name: 'U' } });

      // Second call should return updated results
      const secondCall = child.getAllGenericParams();
      expect(secondCall).toHaveLength(2);
      expect(secondCall.map(p => p.name)).toContain('U');
    });

    test('child context cache should reflect parent context changes', () => {
      const parent = new GenericContext();
      const child = parent.createChildContext();

      // Build initial cache in child
      parent.registerGenericParam({ param: { name: 'T' } });
      const firstCall = child.getAllGenericParams();
      expect(firstCall).toHaveLength(1);
      expect(firstCall.map(p => p.name)).toContain('T');

      // Add parameter to parent after child cache is built
      parent.registerGenericParam({ param: { name: 'U' } });

      // Child should see the new parameter from parent
      // This test may currently fail due to cache invalidation bug
      const secondCall = child.getAllGenericParams();
      expect(secondCall).toHaveLength(2);
      expect(secondCall.map(p => p.name)).toEqual(expect.arrayContaining(['T', 'U']));
    });
  });
});
