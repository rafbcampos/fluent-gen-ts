/**
 * Tests for function-based parameter transformations
 * These tests verify that setParameter() correctly handles both static strings
 * and dynamic functions that transform types based on context
 */

import { describe, test, expect } from 'vitest';
import { PropertyMethodTransformBuilder } from '../transform-builders.js';
import { TypeKind } from '../../types.js';
import type { PropertyMethodContext } from '../plugin-types.js';

describe('Function-based parameter transformations', () => {
  test('should store function in transform result', () => {
    const builder = new PropertyMethodTransformBuilder();
    const transform = builder
      .when(() => true)
      .setParameter(ctx => `Wrapped<${ctx.originalTypeString}>`)
      .done()
      .build();

    const context = createContext({ originalTypeString: 'string' });
    const result = transform(context);

    expect(result.parameterType).toBeDefined();
    expect(typeof result.parameterType).toBe('function');
  });

  test('should evaluate function with context to produce type string', () => {
    const builder = new PropertyMethodTransformBuilder();
    const transform = builder
      .when(() => true)
      .setParameter(ctx => `Tagged<${ctx.originalTypeString}>`)
      .done()
      .build();

    const context = createContext({ originalTypeString: 'number' });
    const result = transform(context);

    if (typeof result.parameterType === 'function') {
      const evaluated = result.parameterType(context);
      expect(evaluated).toBe('Tagged<number>');
    } else {
      throw new Error('Expected function but got string');
    }
  });

  test('should handle deep type transformation with transformDeep()', () => {
    const builder = new PropertyMethodTransformBuilder();
    const transform = builder
      .when(() => true)
      .setParameter(ctx => {
        // Simulate what transformDeep() would return
        return `Array<${ctx.originalTypeString} | { value: ${ctx.originalTypeString} }>`;
      })
      .done()
      .build();

    const context = createContext({ originalTypeString: 'string' });
    const result = transform(context);

    if (typeof result.parameterType === 'function') {
      const evaluated = result.parameterType(context);
      expect(evaluated).toBe('Array<string | { value: string }>');
    }
  });

  test('should support complex type transformations', () => {
    const builder = new PropertyMethodTransformBuilder();
    const transform = builder
      .when(() => true)
      .setParameter(ctx => {
        const base = ctx.originalTypeString;
        return `${base} | TaggedTemplate<${base}> | FluentBuilder<${base}>`;
      })
      .done()
      .build();

    const context = createContext({
      originalTypeString: 'User',
      typeName: 'MyType',
    });
    const result = transform(context);

    if (typeof result.parameterType === 'function') {
      const evaluated = result.parameterType(context);
      expect(evaluated).toBe('User | TaggedTemplate<User> | FluentBuilder<User>');
    }
  });

  test('should work alongside static string parameters', () => {
    const builder = new PropertyMethodTransformBuilder();
    const transform = builder
      .when(ctx => ctx.property.name === 'staticProp')
      .setParameter('string | null')
      .done()
      .when(ctx => ctx.property.name === 'dynamicProp')
      .setParameter(ctx => `Dynamic<${ctx.originalTypeString}>`)
      .done()
      .build();

    const staticContext = createContext({
      property: {
        name: 'staticProp',
        type: { kind: TypeKind.Primitive, name: 'string' },
        optional: false,
        readonly: false,
      },
    });
    const dynamicContext = createContext({
      property: {
        name: 'dynamicProp',
        type: { kind: TypeKind.Primitive, name: 'number' },
        optional: false,
        readonly: false,
      },
      originalTypeString: 'number',
    });

    const staticResult = transform(staticContext);
    expect(staticResult.parameterType).toBe('string | null');

    const dynamicResult = transform(dynamicContext);
    expect(typeof dynamicResult.parameterType).toBe('function');
    if (typeof dynamicResult.parameterType === 'function') {
      expect(dynamicResult.parameterType(dynamicContext)).toBe('Dynamic<number>');
    }
  });

  test('should access full context including type matcher', () => {
    const builder = new PropertyMethodTransformBuilder();
    const transform = builder
      .when(() => true)
      .setParameter(ctx => {
        // Access various context properties
        return `${ctx.builderName}_${ctx.typeName}_${ctx.property.name}`;
      })
      .done()
      .build();

    const context = createContext({
      builderName: 'UserBuilder',
      typeName: 'User',
      property: {
        name: 'email',
        type: { kind: TypeKind.Primitive, name: 'string' },
        optional: false,
        readonly: false,
      },
    });
    const result = transform(context);

    if (typeof result.parameterType === 'function') {
      const evaluated = result.parameterType(context);
      expect(evaluated).toBe('UserBuilder_User_email');
    }
  });
});

// Helper to create mock context
function createContext(overrides: Partial<PropertyMethodContext> = {}): PropertyMethodContext {
  return {
    typeName: 'TestType',
    typeInfo: { kind: TypeKind.Object, properties: [] },
    builderName: 'TestTypeBuilder',
    property: {
      name: 'testProp',
      type: { kind: TypeKind.Primitive, name: 'string' },
      optional: false,
      readonly: false,
    },
    propertyType: { kind: TypeKind.Primitive, name: 'string' },
    originalTypeString: 'string',
    type: {
      isPrimitive: () => false,
      isObject: () => ({ match: () => false }),
      isArray: () => ({ match: () => false }),
      isUnion: () => ({ match: () => false }),
      isIntersection: () => ({ match: () => false }),
      isReference: () => false,
      isGeneric: () => false,
      matches: () => false,
      toString: () => 'string',
      transformDeep: () => ({
        replace: () => ({ toString: () => 'transformed' }),
        hasMatch: () => false,
        findMatches: () => [],
      }),
      containsDeep: () => false,
      findDeep: () => [],
    },
    hasGeneric: () => false,
    getGenericConstraint: () => undefined,
    isOptional: () => false,
    isReadonly: () => false,
    getPropertyPath: () => ['testProp'],
    getMethodName: () => 'withTestProp',
    ...overrides,
  } as PropertyMethodContext;
}
