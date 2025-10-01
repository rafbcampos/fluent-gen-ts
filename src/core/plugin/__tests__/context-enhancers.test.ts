import { describe, test, expect } from 'vitest';
import {
  enhanceParseContext,
  enhanceResolveContext,
  enhanceGenerateContext,
  enhancePropertyMethodContext,
  enhanceBuilderContext,
  enhanceValueContext,
  enhanceBuildMethodContext,
} from '../context-enhancers.js';
import { TypeKind } from '../../types.js';
import type { Type, Symbol } from 'ts-morph';
import { primitive } from '../type-matcher/index.js';

describe('Context Enhancers', () => {
  describe('enhanceParseContext', () => {
    test('should create parse context with sourceFile and typeName', () => {
      const context = enhanceParseContext('/test/file.ts', 'TestType');

      expect(context).toEqual({
        sourceFile: '/test/file.ts',
        typeName: 'TestType',
      });
    });
  });

  describe('enhanceResolveContext', () => {
    test('should create resolve context with type and symbol', () => {
      const mockType = {} as Type;
      const mockSymbol = {} as Symbol;

      const context = enhanceResolveContext(mockType, mockSymbol, '/test/file.ts', 'TestType');

      expect(context).toEqual({
        type: mockType,
        symbol: mockSymbol,
        sourceFile: '/test/file.ts',
        typeName: 'TestType',
      });
    });

    test('should create resolve context without optional properties', () => {
      const mockType = {} as Type;

      const context = enhanceResolveContext(mockType);

      expect(context).toEqual({
        type: mockType,
      });
    });
  });

  describe('enhanceGenerateContext', () => {
    test('should create generate context', () => {
      const resolvedType = {
        sourceFile: '/test/file.ts',
        name: 'TestType',
        typeInfo: { kind: TypeKind.Object as const, properties: [] as const },
        imports: [],
        dependencies: [],
      };

      const context = enhanceGenerateContext(resolvedType, {});

      expect(context.resolvedType).toBe(resolvedType);
      expect(context.options).toEqual({});
    });
  });

  describe('enhancePropertyMethodContext', () => {
    test('should create property method context with helper methods', () => {
      const property = {
        name: 'testProp',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };
      const propertyType = { kind: TypeKind.Primitive as const, name: 'string' };
      const typeInfo = { kind: TypeKind.Object as const, properties: [] as const };

      const context = enhancePropertyMethodContext(
        property,
        propertyType,
        'TestBuilder',
        'TestType',
        typeInfo,
        'string',
      );

      expect(context.property).toBe(property);
      expect(context.propertyType).toBe(propertyType);
      expect(context.builderName).toBe('TestBuilder');
      expect(context.typeName).toBe('TestType');
      expect(context.typeInfo).toBe(typeInfo);
      expect(context.originalTypeString).toBe('string');

      // Test helper methods
      expect(context.hasGeneric('T')).toBe(false);
      expect(context.getGenericConstraint('T')).toBeUndefined();
      expect(context.isOptional()).toBe(false);
      expect(context.isReadonly()).toBe(false);
      expect(context.getPropertyPath()).toEqual(['testProp']);
      expect(context.getMethodName()).toBe('withTestProp');
    });

    test('should handle generic parameters', () => {
      const property = {
        name: 'testProp',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };
      const genericParams = [{ name: 'T', constraint: 'string' }];

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
        genericParams,
      );

      expect(context.hasGeneric('T')).toBe(true);
      expect(context.hasGeneric('U')).toBe(false);
      expect(context.getGenericConstraint('T')).toBe('string');
      expect(context.getGenericConstraint('U')).toBeUndefined();
    });

    test('should handle kebab-case property names', () => {
      const property = {
        name: 'test-prop',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
      );

      expect(context.getMethodName()).toBe('withTestProp');
    });

    test('should handle snake_case property names', () => {
      const property = {
        name: 'test_prop',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
      );

      expect(context.getMethodName()).toBe('withTestProp');
    });

    test('should handle optional and readonly properties', () => {
      const property = {
        name: 'testProp',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: true,
        readonly: true,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
      );

      expect(context.isOptional()).toBe(true);
      expect(context.isReadonly()).toBe(true);
    });
  });

  describe('enhanceBuilderContext', () => {
    test('should create builder context with helper methods', () => {
      const properties = [
        {
          name: 'prop1',
          type: { kind: TypeKind.Primitive as const, name: 'string' },
          optional: false,
          readonly: false,
        },
        {
          name: 'prop2',
          type: { kind: TypeKind.Primitive as const, name: 'number' },
          optional: true,
          readonly: false,
        },
      ];
      const typeInfo = { kind: TypeKind.Object as const, properties };

      const context = enhanceBuilderContext(
        'TestType',
        typeInfo,
        'TestBuilder',
        properties,
        '<T>',
        'T extends string',
      );

      expect(context.typeName).toBe('TestType');
      expect(context.typeInfo).toBe(typeInfo);
      expect(context.builderName).toBe('TestBuilder');
      expect(context.properties).toBe(properties);
      expect(context.genericParams).toBe('<T>');
      expect(context.genericConstraints).toBe('T extends string');

      // Test helper methods
      expect(context.hasProperty('prop1')).toBe(true);
      expect(context.hasProperty('nonexistent')).toBe(false);
      expect(context.getProperty('prop1')).toBe(properties[0]);
      expect(context.getProperty('nonexistent')).toBeUndefined();
      expect(context.getRequiredProperties()).toEqual([properties[0]]);
      expect(context.getOptionalProperties()).toEqual([properties[1]]);
    });
  });

  describe('enhanceValueContext', () => {
    test('should create value context with type checker', () => {
      const type = { kind: TypeKind.Primitive as const, name: 'string' };
      const context = enhanceValueContext('testProp', 'testValue', type, false);

      expect(context.property).toBe('testProp');
      expect(context.valueVariable).toBe('testValue');
      expect(context.type).toBe(type);
      expect(context.isOptional).toBe(false);
      expect(context.typeChecker).toBeDefined();
    });
  });

  describe('enhanceBuildMethodContext', () => {
    test('should create build method context', () => {
      const properties = [
        {
          name: 'prop1',
          type: { kind: TypeKind.Primitive as const, name: 'string' },
          optional: false,
          readonly: false,
        },
      ];
      const typeInfo = { kind: TypeKind.Object as const, properties };
      const resolvedType = {
        sourceFile: '/test/file.ts',
        name: 'TestType',
        typeInfo,
        imports: [],
        dependencies: [],
      };

      const context = enhanceBuildMethodContext(
        'TestType',
        typeInfo,
        'TestBuilder',
        'build() { return this.values; }',
        properties,
        {},
        resolvedType,
        '<T>',
        'T extends string',
      );

      expect(context.typeName).toBe('TestType');
      expect(context.typeInfo).toBe(typeInfo);
      expect(context.builderName).toBe('TestBuilder');
      expect(context.buildMethodCode).toBe('build() { return this.values; }');
      expect(context.properties).toBe(properties);
      expect(context.options).toEqual({});
      expect(context.resolvedType).toBe(resolvedType);
      expect(context.genericParams).toBe('<T>');
      expect(context.genericConstraints).toBe('T extends string');
    });
  });

  describe('TypeMatcherWrapper functionality', () => {
    test('should handle primitive type checking', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
      );

      expect(context.type.isPrimitive()).toBe(true);
      expect(context.type.isPrimitive('string')).toBe(true);
      expect(context.type.isPrimitive('number')).toBe(false);
    });

    test('should handle reference type checking', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Reference as const, name: 'MyType' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Reference as const, name: 'MyType' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'MyType',
      );

      expect(context.type.isReference()).toBe(true);
      expect(context.type.isReference('MyType')).toBe(true);
      expect(context.type.isReference('OtherType')).toBe(false);
    });

    test('should handle generic type checking', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Generic as const, name: 'T' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Generic as const, name: 'T' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'T',
      );

      expect(context.type.isGeneric()).toBe(true);
      expect(context.type.isGeneric('T')).toBe(true);
      expect(context.type.isGeneric('U')).toBe(false);
    });

    test('should handle toString method', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
      );

      expect(context.type.toString()).toBe('string');
    });

    test('should return type kind when name not available', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Object as const, properties: [] as const },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Object as const, properties: [] as const },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'object',
      );

      expect(context.type.toString()).toBe(TypeKind.Object);
    });

    test('should handle object type matching', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Object as const, name: 'User', properties: [] as const },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Object as const, name: 'User', properties: [] as const },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'User',
      );

      const objectMatcher = context.type.isObject();
      expect(objectMatcher.match({ kind: TypeKind.Object, name: 'User', properties: [] })).toBe(
        true,
      );
    });

    test('should handle object type with name matching', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Object as const, name: 'User', properties: [] as const },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Object as const, name: 'User', properties: [] as const },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'User',
      );

      const objectMatcher = context.type.isObject('User');
      expect(objectMatcher.match({ kind: TypeKind.Object, name: 'User', properties: [] })).toBe(
        true,
      );
      expect(objectMatcher.match({ kind: TypeKind.Object, name: 'Post', properties: [] })).toBe(
        false,
      );
    });

    test('should handle object with generic parameters', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Object as const,
          name: 'Result',
          properties: [] as const,
          genericParams: [{ name: 'T' }],
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Object as const,
          name: 'Result',
          properties: [] as const,
          genericParams: [{ name: 'T' }],
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'Result<T>',
      );

      const objectMatcher = context.type.isObject().withGeneric('T');
      expect(
        objectMatcher.match({
          kind: TypeKind.Object,
          name: 'Result',
          properties: [],
          genericParams: [{ name: 'T' }],
        }),
      ).toBe(true);
      expect(
        objectMatcher.match({
          kind: TypeKind.Object,
          name: 'Result',
          properties: [],
          genericParams: [{ name: 'U' }],
        }),
      ).toBe(false);
      expect(
        objectMatcher.match({
          kind: TypeKind.Object,
          name: 'Result',
          properties: [],
          genericParams: [],
        }),
      ).toBe(false);
    });

    test('should handle object with any generic', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Object as const,
          name: 'Result',
          properties: [] as const,
          genericParams: [{ name: 'T' }],
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Object as const,
          name: 'Result',
          properties: [] as const,
          genericParams: [{ name: 'T' }],
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'Result<T>',
      );

      const objectMatcher = context.type.isObject().withGeneric();
      expect(
        objectMatcher.match({
          kind: TypeKind.Object,
          name: 'Result',
          properties: [],
          genericParams: [{ name: 'T' }],
        }),
      ).toBe(true);
    });

    test('should handle object with property matching', () => {
      const idType = { kind: TypeKind.Primitive as const, name: 'string' };
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Object as const,
          name: 'User',
          properties: [{ name: 'id', type: idType, optional: false, readonly: false }] as const,
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Object as const,
          name: 'User',
          properties: [{ name: 'id', type: idType, optional: false, readonly: false }] as const,
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'User',
      );

      const objectMatcher = context.type.isObject().withProperties('id');
      expect(
        objectMatcher.match({
          kind: TypeKind.Object,
          name: 'User',
          properties: [{ name: 'id', type: idType, optional: false, readonly: false }],
        }),
      ).toBe(true);
    });

    test('should handle array type matching', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'Array<string>',
      );

      const arrayMatcher = context.type.isArray();
      expect(
        arrayMatcher.match({
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'string' },
        }),
      ).toBe(true);
    });

    test('should handle union type matching', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Union as const,
          unionTypes: [
            { kind: TypeKind.Primitive as const, name: 'string' },
            { kind: TypeKind.Primitive as const, name: 'number' },
          ] as const,
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Union as const,
          unionTypes: [
            { kind: TypeKind.Primitive as const, name: 'string' },
            { kind: TypeKind.Primitive as const, name: 'number' },
          ] as const,
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string | number',
      );

      const unionMatcher = context.type.isUnion();
      expect(
        unionMatcher.match({
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Primitive, name: 'string' },
            { kind: TypeKind.Primitive, name: 'number' },
          ],
        }),
      ).toBe(true);
    });

    test('should handle intersection type matching', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Intersection as const,
          intersectionTypes: [
            { kind: TypeKind.Object as const, name: 'A', properties: [] as const },
            { kind: TypeKind.Object as const, name: 'B', properties: [] as const },
          ] as const,
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Intersection as const,
          intersectionTypes: [
            { kind: TypeKind.Object as const, name: 'A', properties: [] as const },
            { kind: TypeKind.Object as const, name: 'B', properties: [] as const },
          ] as const,
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'A & B',
      );

      const intersectionMatcher = context.type.isIntersection();
      expect(
        intersectionMatcher.match({
          kind: TypeKind.Intersection,
          intersectionTypes: [
            { kind: TypeKind.Object, name: 'A', properties: [] },
            { kind: TypeKind.Object, name: 'B', properties: [] },
          ],
        }),
      ).toBe(true);
    });

    test('should handle transformDeep', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
      );

      const transformer = context.type.transformDeep();
      expect(transformer).toBeDefined();
    });

    test('should handle containsDeep', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'Array<string>',
      );

      expect(context.type.containsDeep(primitive('string'))).toBe(true);
      expect(context.type.containsDeep(primitive('number'))).toBe(false);
    });

    test('should handle findDeep', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'Array<string>',
      );

      const found = context.type.findDeep(primitive('string'));
      expect(found).toHaveLength(1);
    });

    test('should handle matches method', () => {
      const property = {
        name: 'test',
        type: { kind: TypeKind.Primitive as const, name: 'string' },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        { kind: TypeKind.Primitive as const, name: 'string' },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string',
      );

      expect(context.type.matches(primitive('string'))).toBe(true);
      expect(context.type.matches(primitive('number'))).toBe(false);
    });

    test('should describe object matcher', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Object as const,
          name: 'User',
          properties: [
            {
              name: 'id',
              type: { kind: TypeKind.Primitive as const, name: 'string' },
              optional: false,
              readonly: false,
            },
          ] as const,
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Object as const,
          name: 'User',
          properties: [
            {
              name: 'id',
              type: { kind: TypeKind.Primitive as const, name: 'string' },
              optional: false,
              readonly: false,
            },
          ] as const,
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'User',
      );

      const objectMatcher = context.type.isObject('User').withProperties('id');
      expect(objectMatcher.describe()).toContain('object');
      expect(objectMatcher.describe()).toContain('User');
    });

    test('should describe array matcher', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Array as const,
          elementType: { kind: TypeKind.Primitive as const, name: 'string' },
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'Array<string>',
      );

      const arrayMatcher = context.type.isArray();
      expect(arrayMatcher.describe()).toBe('array');
    });

    test('should describe union matcher', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Union as const,
          unionTypes: [
            { kind: TypeKind.Primitive as const, name: 'string' },
            { kind: TypeKind.Primitive as const, name: 'number' },
          ] as const,
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Union as const,
          unionTypes: [
            { kind: TypeKind.Primitive as const, name: 'string' },
            { kind: TypeKind.Primitive as const, name: 'number' },
          ] as const,
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'string | number',
      );

      const unionMatcher = context.type.isUnion();
      expect(unionMatcher.describe()).toBe('union');
    });

    test('should describe intersection matcher', () => {
      const property = {
        name: 'test',
        type: {
          kind: TypeKind.Intersection as const,
          intersectionTypes: [
            { kind: TypeKind.Object as const, name: 'A', properties: [] as const },
            { kind: TypeKind.Object as const, name: 'B', properties: [] as const },
          ] as const,
        },
        optional: false,
        readonly: false,
      };

      const context = enhancePropertyMethodContext(
        property,
        {
          kind: TypeKind.Intersection as const,
          intersectionTypes: [
            { kind: TypeKind.Object as const, name: 'A', properties: [] as const },
            { kind: TypeKind.Object as const, name: 'B', properties: [] as const },
          ] as const,
        },
        'TestBuilder',
        'TestType',
        { kind: TypeKind.Object as const, properties: [] as const },
        'A & B',
      );

      const intersectionMatcher = context.type.isIntersection();
      expect(intersectionMatcher.describe()).toBe('intersection');
    });
  });
});
