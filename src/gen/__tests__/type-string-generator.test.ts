import { test, expect, describe, beforeEach } from 'vitest';
import { TypeStringGenerator, type TypeStringGeneratorOptions } from '../type-string-generator.js';
import { TypeKind, type TypeInfo, type PropertyInfo, type GenericParam } from '../../core/types.js';

describe('TypeStringGenerator', () => {
  let generator: TypeStringGenerator;

  beforeEach(() => {
    generator = new TypeStringGenerator();
  });

  describe('constructor', () => {
    test('creates generator with default options', () => {
      const defaultGenerator = new TypeStringGenerator();
      expect(defaultGenerator).toBeDefined();
    });

    test('creates generator with custom options', () => {
      const options: TypeStringGeneratorOptions = {
        builderTypeName: 'CustomBuilder',
        contextTypeName: 'CustomContext',
        includeBuilderTypes: false,
      };
      const customGenerator = new TypeStringGenerator(options);
      expect(customGenerator).toBeDefined();
    });
  });

  describe('typeInfoToString', () => {
    test('handles primitive types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('string');
    });

    test('handles array types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Primitive,
          name: 'string',
        },
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('Array<string>');
    });

    test('handles union types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('string | number');
    });

    test('handles intersection types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Reference, name: 'BaseType' },
          { kind: TypeKind.Reference, name: 'Extension' },
        ],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('BaseType & Extension');
    });

    test('handles literal types', () => {
      const stringLiteralType: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 'test',
      };
      expect(generator.typeInfoToString(stringLiteralType)).toBe('"test"');

      const numberLiteralType: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 42,
      };
      expect(generator.typeInfoToString(numberLiteralType)).toBe('42');

      const booleanLiteralType: TypeInfo = {
        kind: TypeKind.Literal,
        literal: true,
      };
      expect(generator.typeInfoToString(booleanLiteralType)).toBe('true');
    });

    test('handles object types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('User');
    });

    test('handles object types without valid names', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: '__type',
        properties: [],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('object');
    });

    test('handles reference types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Reference,
        name: 'CustomType',
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('CustomType');
    });

    test('handles generic types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Generic,
        name: 'T',
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('T');
    });

    test('handles function types', () => {
      const withName: TypeInfo = {
        kind: TypeKind.Function,
        name: 'CustomFunction',
      };
      expect(generator.typeInfoToString(withName)).toBe('CustomFunction');

      const withoutName: TypeInfo = {
        kind: TypeKind.Function,
      };
      expect(generator.typeInfoToString(withoutName)).toBe('Function');
    });

    test('handles tuple types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
          { kind: TypeKind.Primitive, name: 'boolean' },
        ],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('[string, number, boolean]');
    });

    test('handles enum types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Enum,
        name: 'Color',
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('Color');
    });

    test('handles keyof types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Keyof,
        target: { kind: TypeKind.Reference, name: 'User' },
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('keyof User');
    });

    test('handles typeof types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Typeof,
        target: { kind: TypeKind.Reference, name: 'defaultUser' },
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('typeof defaultUser');
    });

    test('handles index access types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Index,
        object: { kind: TypeKind.Reference, name: 'User' },
        index: { kind: TypeKind.Literal, literal: 'id' },
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('User["id"]');
    });

    test('handles conditional types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Conditional,
        checkType: { kind: TypeKind.Generic, name: 'T' },
        extendsType: { kind: TypeKind.Primitive, name: 'string' },
        trueType: { kind: TypeKind.Literal, literal: true },
        falseType: { kind: TypeKind.Literal, literal: false },
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('T extends string ? true : false');
    });

    test('handles unknown types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Unknown,
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('unknown');
    });
  });

  describe('getPropertyType', () => {
    test('returns basic type for required property', () => {
      const prop: PropertyInfo = {
        name: 'id',
        type: { kind: TypeKind.Primitive, name: 'string' },
        optional: false,
        readonly: false,
      };

      const result = generator.getPropertyType(prop);
      expect(result).toBe('string');
    });

    test('removes undefined from optional union types', () => {
      const prop: PropertyInfo = {
        name: 'age',
        type: {
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Primitive, name: 'number' },
            { kind: TypeKind.Primitive, name: 'undefined' },
          ],
        },
        optional: true,
        readonly: false,
      };

      const result = generator.getPropertyType(prop);
      expect(result).toBe('number');
    });

    test('adds builder type for object properties', () => {
      const prop: PropertyInfo = {
        name: 'address',
        type: {
          kind: TypeKind.Object,
          name: 'Address',
          properties: [],
        },
        optional: false,
        readonly: false,
      };

      const result = generator.getPropertyType(prop);
      expect(result).toBe('Address | FluentBuilder<Address, BaseBuildContext>');
    });

    test('does not add builder type for internal object types', () => {
      const prop: PropertyInfo = {
        name: 'data',
        type: {
          kind: TypeKind.Object,
          name: '__type',
          properties: [],
        },
        optional: false,
        readonly: false,
      };

      const result = generator.getPropertyType(prop);
      expect(result).toBe('object');
    });

    test('respects includeBuilderTypes option', () => {
      const generatorWithoutBuilders = new TypeStringGenerator({
        includeBuilderTypes: false,
      });

      const prop: PropertyInfo = {
        name: 'address',
        type: {
          kind: TypeKind.Object,
          name: 'Address',
          properties: [],
        },
        optional: false,
        readonly: false,
      };

      const result = generatorWithoutBuilders.getPropertyType(prop);
      expect(result).toBe('Address');
    });

    test('uses custom builder and context type names', () => {
      const customGenerator = new TypeStringGenerator({
        builderTypeName: 'MyBuilder',
        contextTypeName: 'MyContext',
      });

      const prop: PropertyInfo = {
        name: 'address',
        type: {
          kind: TypeKind.Object,
          name: 'Address',
          properties: [],
        },
        optional: false,
        readonly: false,
      };

      const result = customGenerator.getPropertyType(prop);
      expect(result).toBe('Address | MyBuilder<Address, MyContext>');
    });
  });

  describe('formatGenericParams', () => {
    test('returns empty string for no parameters', () => {
      expect(generator.formatGenericParams()).toBe('');
      expect(generator.formatGenericParams([])).toBe('');
    });

    test('formats simple generic parameters', () => {
      const params: GenericParam[] = [{ name: 'T' }, { name: 'U' }];

      const result = generator.formatGenericParams(params);
      expect(result).toBe('<T, U>');
    });

    test('formats generic parameters with constraints', () => {
      const params: GenericParam[] = [
        {
          name: 'T',
          constraint: { kind: TypeKind.Primitive, name: 'string' },
        },
        {
          name: 'U',
          constraint: { kind: TypeKind.Reference, name: 'BaseType' },
        },
      ];

      const result = generator.formatGenericParams(params);
      expect(result).toBe('<T extends string, U extends BaseType>');
    });

    test('formats generic parameters with defaults', () => {
      const params: GenericParam[] = [
        {
          name: 'T',
          default: { kind: TypeKind.Primitive, name: 'string' },
        },
        {
          name: 'U',
          default: { kind: TypeKind.Reference, name: 'DefaultType' },
        },
      ];

      const result = generator.formatGenericParams(params);
      expect(result).toBe('<T = string, U = DefaultType>');
    });

    test('formats generic parameters with constraints and defaults', () => {
      const params: GenericParam[] = [
        {
          name: 'T',
          constraint: { kind: TypeKind.Reference, name: 'BaseType' },
          default: { kind: TypeKind.Reference, name: 'DefaultType' },
        },
      ];

      const result = generator.formatGenericParams(params);
      expect(result).toBe('<T extends BaseType = DefaultType>');
    });
  });

  describe('formatGenericConstraints', () => {
    test('returns empty string for no parameters', () => {
      expect(generator.formatGenericConstraints()).toBe('');
      expect(generator.formatGenericConstraints([])).toBe('');
    });

    test('formats generic parameter names only', () => {
      const params: GenericParam[] = [
        {
          name: 'T',
          constraint: { kind: TypeKind.Primitive, name: 'string' },
          default: { kind: TypeKind.Primitive, name: 'string' },
        },
        { name: 'U' },
      ];

      const result = generator.formatGenericConstraints(params);
      expect(result).toBe('<T, U>');
    });
  });

  describe('edge cases', () => {
    test('handles empty union types gracefully', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('');
    });

    test('handles empty intersection types gracefully', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('');
    });

    test('handles empty tuple types gracefully', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [],
      };

      const result = generator.typeInfoToString(typeInfo);
      expect(result).toBe('[]');
    });

    test('handles nested complex types', () => {
      const complexType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Union,
          unionTypes: [
            {
              kind: TypeKind.Object,
              name: 'User',
              properties: [],
            },
            {
              kind: TypeKind.Literal,
              literal: null,
            },
          ],
        },
      };

      const result = generator.typeInfoToString(complexType);
      expect(result).toBe('Array<User | null>');
    });
  });
});
