import { describe, test, expect } from 'vitest';
import {
  typeInfoToString,
  transformTypeDeep,
  containsTypeDeep,
  findTypesDeep,
  TypeDeepTransformer,
  primitive,
  array,
} from '../type-matcher/index.js';
import { TypeKind } from '../../types.js';
import type { TypeInfo } from '../../types.js';

describe('Deep Type Transformation', () => {
  describe('typeInfoToString', () => {
    test('should convert primitive types to strings', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
      const booleanType: TypeInfo = { kind: TypeKind.Primitive, name: 'boolean' };

      expect(typeInfoToString(stringType)).toBe('string');
      expect(typeInfoToString(numberType)).toBe('number');
      expect(typeInfoToString(booleanType)).toBe('boolean');
    });

    test('should convert array types to strings', () => {
      const stringArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      expect(typeInfoToString(stringArray)).toBe('Array<string>');
    });

    test('should convert nested array types to strings', () => {
      const nestedArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'number' },
        },
      };

      expect(typeInfoToString(nestedArray)).toBe('Array<Array<number>>');
    });

    test('should convert object types to strings', () => {
      const namedObject: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      expect(typeInfoToString(namedObject)).toBe('User');
    });

    test('should convert anonymous object types with properties', () => {
      const anonObject: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'age',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: true,
            readonly: false,
          },
        ],
      };

      expect(typeInfoToString(anonObject)).toBe('{ id: string; age?: number }');
    });

    test('should convert union types to strings', () => {
      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      expect(typeInfoToString(unionType)).toBe('string | number');
    });

    test('should convert intersection types to strings', () => {
      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'B', properties: [] },
        ],
      };

      expect(typeInfoToString(intersectionType)).toBe('A & B');
    });

    test('should convert literal types to strings', () => {
      const stringLiteral: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 'hello',
      };
      const numberLiteral: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 42,
      };

      expect(typeInfoToString(stringLiteral)).toBe('"hello"');
      expect(typeInfoToString(numberLiteral)).toBe('42');
    });

    test('should handle tuple types', () => {
      const tupleType: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      expect(typeInfoToString(tupleType)).toBe('[string, number]');
    });

    test('should handle readonly properties', () => {
      const objectWithReadonly: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: true,
          },
        ],
      };

      expect(typeInfoToString(objectWithReadonly)).toBe('{ readonly id: string }');
    });
  });

  describe('transformTypeDeep', () => {
    test('should transform primitive types', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result = transformTypeDeep(stringType, {
        onPrimitive: type => {
          if (type.name === 'string') {
            return 'string | { value: string }';
          }
          return null;
        },
      });

      expect(result).toBe('string | { value: string }');
    });

    test('should recursively transform array element types', () => {
      const stringArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      const result = transformTypeDeep(stringArray, {
        onPrimitive: type => {
          if (type.name === 'string') {
            return 'string | { value: string }';
          }
          return null;
        },
      });

      expect(result).toBe('Array<string | { value: string }>');
    });

    test('should recursively transform object property types', () => {
      const objectType: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'age',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = transformTypeDeep(objectType, {
        onPrimitive: type => {
          if (type.name === 'string') {
            return 'string | { value: string }';
          }
          return null;
        },
      });

      expect(result).toBe('{ name: string | { value: string }; age: number }');
    });

    test('should handle deeply nested object transformations', () => {
      const nestedObject: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'data',
            type: {
              kind: TypeKind.Object,
              properties: [
                {
                  name: 'value',
                  type: { kind: TypeKind.Primitive, name: 'string' },
                  optional: false,
                  readonly: false,
                },
              ],
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = transformTypeDeep(nestedObject, {
        onPrimitive: type => {
          if (type.name === 'string') {
            return 'string | { value: string }';
          }
          return null;
        },
      });

      expect(result).toBe('{ data: { value: string | { value: string } } }');
    });

    test('should transform union types', () => {
      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      const result = transformTypeDeep(unionType, {
        onPrimitive: type => {
          if (type.name === 'string') {
            return 'ValidatedString';
          }
          return null;
        },
      });

      expect(result).toBe('ValidatedString | number');
    });

    test('should use fallback onAny transformer', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result = transformTypeDeep(stringType, {
        onAny: () => 'CustomType',
      });

      expect(result).toBe('CustomType');
    });

    test('should not transform when returning null', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result = transformTypeDeep(stringType, {
        onPrimitive: () => null,
      });

      expect(result).toBe('string');
    });

    test('should handle complex nested array structures', () => {
      const complexArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Object,
          properties: [
            {
              name: 'tags',
              type: {
                kind: TypeKind.Array,
                elementType: { kind: TypeKind.Primitive, name: 'string' },
              },
              optional: false,
              readonly: false,
            },
          ],
        },
      };

      const result = transformTypeDeep(complexArray, {
        onPrimitive: type => {
          if (type.name === 'string') {
            return 'string | { value: string }';
          }
          return null;
        },
      });

      expect(result).toBe('Array<{ tags: Array<string | { value: string }> }>');
    });
  });

  describe('containsTypeDeep', () => {
    test('should find primitive type at root level', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(containsTypeDeep(stringType, primitive('string'))).toBe(true);
      expect(containsTypeDeep(stringType, primitive('number'))).toBe(false);
    });

    test('should find primitive type in array', () => {
      const stringArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      expect(containsTypeDeep(stringArray, primitive('string'))).toBe(true);
      expect(containsTypeDeep(stringArray, primitive('number'))).toBe(false);
    });

    test('should find primitive type in object properties', () => {
      const objectType: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'count',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: false,
          },
        ],
      };

      expect(containsTypeDeep(objectType, primitive('string'))).toBe(true);
      expect(containsTypeDeep(objectType, primitive('number'))).toBe(true);
      expect(containsTypeDeep(objectType, primitive('boolean'))).toBe(false);
    });

    test('should find type in deeply nested structures', () => {
      const nestedObject: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'data',
            type: {
              kind: TypeKind.Array,
              elementType: {
                kind: TypeKind.Object,
                properties: [
                  {
                    name: 'value',
                    type: { kind: TypeKind.Primitive, name: 'string' },
                    optional: false,
                    readonly: false,
                  },
                ],
              },
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      expect(containsTypeDeep(nestedObject, primitive('string'))).toBe(true);
    });

    test('should find type in union members', () => {
      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          {
            kind: TypeKind.Array,
            elementType: { kind: TypeKind.Primitive, name: 'number' },
          },
        ],
      };

      expect(containsTypeDeep(unionType, primitive('string'))).toBe(true);
      expect(containsTypeDeep(unionType, primitive('number'))).toBe(true);
      expect(containsTypeDeep(unionType, array())).toBe(true);
    });

    test('should find type in tuple elements', () => {
      const tupleType: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      expect(containsTypeDeep(tupleType, primitive('string'))).toBe(true);
      expect(containsTypeDeep(tupleType, primitive('number'))).toBe(true);
    });
  });

  describe('findTypesDeep', () => {
    test('should find all matching primitive types', () => {
      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
          { kind: TypeKind.Primitive, name: 'string' },
        ],
      };

      const found = findTypesDeep(unionType, primitive('string'));
      expect(found).toHaveLength(2);
      expect(
        found.every(t => t.kind === TypeKind.Primitive && 'name' in t && t.name === 'string'),
      ).toBe(true);
    });

    test('should find all occurrences in nested structures', () => {
      const complexType: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'tags',
            type: {
              kind: TypeKind.Array,
              elementType: { kind: TypeKind.Primitive, name: 'string' },
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      const found = findTypesDeep(complexType, primitive('string'));
      expect(found).toHaveLength(2);
    });

    test('should return empty array when no matches found', () => {
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
      const found = findTypesDeep(numberType, primitive('string'));
      expect(found).toHaveLength(0);
    });

    test('should find complex type patterns', () => {
      const complexType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          {
            kind: TypeKind.Array,
            elementType: { kind: TypeKind.Primitive, name: 'string' },
          },
          {
            kind: TypeKind.Array,
            elementType: { kind: TypeKind.Primitive, name: 'number' },
          },
        ],
      };

      const found = findTypesDeep(complexType, array());
      expect(found).toHaveLength(2);
    });
  });

  describe('TypeDeepTransformer', () => {
    test('should replace matching types with string', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const transformer = new TypeDeepTransformer(stringType);

      const result = transformer.replace(primitive('string'), 'CustomString').toString();
      expect(result).toBe('CustomString');
    });

    test('should replace matching types with function', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const transformer = new TypeDeepTransformer(stringType);

      const result = transformer
        .replace(primitive('string'), type => {
          if (type.kind === TypeKind.Primitive && 'name' in type) {
            return `Validated${type.name.charAt(0).toUpperCase()}${type.name.slice(1)}`;
          }
          return 'unknown';
        })
        .toString();

      expect(result).toBe('ValidatedString');
    });

    test('should chain multiple replacements', () => {
      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      const transformer = new TypeDeepTransformer(unionType);
      const result = transformer
        .replace(primitive('string'), 'ValidatedString')
        .replace(primitive('number'), 'ValidatedNumber')
        .toString();

      expect(result).toBe('ValidatedString | ValidatedNumber');
    });

    test('should handle replaceIf with custom predicate', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const transformer = new TypeDeepTransformer(stringType);

      const result = transformer
        .replaceIf((type, depth) => type.kind === TypeKind.Primitive && depth === 0, 'ReplacedType')
        .toString();

      expect(result).toBe('ReplacedType');
    });

    test('should apply first matching replacement', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const transformer = new TypeDeepTransformer(stringType);

      const result = transformer
        .replace(primitive('string'), 'FirstMatch')
        .replace(primitive('string'), 'SecondMatch')
        .toString();

      expect(result).toBe('FirstMatch');
    });

    test('should transform deeply nested arrays', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      const transformer = new TypeDeepTransformer(arrayType);
      const result = transformer
        .replace(primitive('string'), 'string | { value: string }')
        .toString();

      expect(result).toBe('Array<string | { value: string }>');
    });

    test('should check hasMatch correctly', () => {
      const objectType: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'data',
            type: {
              kind: TypeKind.Array,
              elementType: { kind: TypeKind.Primitive, name: 'string' },
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      const transformer = new TypeDeepTransformer(objectType);
      expect(transformer.hasMatch(primitive('string'))).toBe(true);
      expect(transformer.hasMatch(primitive('boolean'))).toBe(false);
    });

    test('should findMatches correctly', () => {
      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
          { kind: TypeKind.Primitive, name: 'string' },
        ],
      };

      const transformer = new TypeDeepTransformer(unionType);
      const matches = transformer.findMatches(primitive('string'));
      expect(matches).toHaveLength(2);
    });

    test('should handle real-world use case: wrapping all strings in union', () => {
      const complexType: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'tags',
            type: {
              kind: TypeKind.Array,
              elementType: { kind: TypeKind.Primitive, name: 'string' },
            },
            optional: false,
            readonly: false,
          },
          {
            name: 'metadata',
            type: {
              kind: TypeKind.Object,
              properties: [
                {
                  name: 'description',
                  type: { kind: TypeKind.Primitive, name: 'string' },
                  optional: false,
                  readonly: false,
                },
              ],
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      const transformer = new TypeDeepTransformer(complexType);
      const result = transformer
        .replace(primitive('string'), 'string | { value: string }')
        .toString();

      expect(result).toContain('name: string | { value: string }');
      expect(result).toContain('tags: Array<string | { value: string }>');
      expect(result).toContain('description: string | { value: string }');
    });
  });

  describe('transformTypeDeep with includeBuilderTypes option', () => {
    test('should add FluentBuilder union for named object types', () => {
      const namedObjectType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      const result = transformTypeDeep(namedObjectType, {}, { includeBuilderTypes: true });
      expect(result).toBe('User | FluentBuilder<User, BaseBuildContext>');
    });

    test('should add FluentBuilder union with custom builder and context type names', () => {
      const namedObjectType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      const result = transformTypeDeep(
        namedObjectType,
        {},
        {
          includeBuilderTypes: true,
          builderTypeName: 'MyBuilder',
          contextTypeName: 'MyContext',
        },
      );
      expect(result).toBe('User | MyBuilder<User, MyContext>');
    });

    test('should add FluentBuilder union to object properties', () => {
      const objectType: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'user',
            type: { kind: TypeKind.Object, name: 'User', properties: [] },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = transformTypeDeep(objectType, {}, { includeBuilderTypes: true });
      expect(result).toBe('{ user: User | FluentBuilder<User, BaseBuildContext> }');
    });

    test('should not add FluentBuilder union for __type names', () => {
      const anonymousType: TypeInfo = {
        kind: TypeKind.Object,
        name: '__type',
        properties: [],
      };

      const result = transformTypeDeep(anonymousType, {}, { includeBuilderTypes: true });
      expect(result).toBe('__type');
    });

    test('should not add FluentBuilder union for unknown names', () => {
      const unknownType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'unknown',
        properties: [],
      };

      const result = transformTypeDeep(unknownType, {}, { includeBuilderTypes: true });
      expect(result).toBe('unknown');
    });

    test('should not add FluentBuilder union for objects without names', () => {
      const anonymousObject: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = transformTypeDeep(anonymousObject, {}, { includeBuilderTypes: true });
      expect(result).toBe('{ id: string }');
    });

    test('should handle named objects with generic parameters', () => {
      const genericObject: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Result',
        properties: [],
        genericParams: [{ name: 'T' }, { name: 'E' }],
      };

      const result = transformTypeDeep(genericObject, {}, { includeBuilderTypes: true });
      expect(result).toBe('Result<T, E> | FluentBuilder<Result, BaseBuildContext>');
    });

    test('should not duplicate FluentBuilder union in nested properties', () => {
      const nestedType: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'data',
            type: { kind: TypeKind.Object, name: 'Data', properties: [] },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = transformTypeDeep(nestedType, {}, { includeBuilderTypes: true });
      const builderUnionCount = (result.match(/FluentBuilder/g) || []).length;
      expect(builderUnionCount).toBe(1);
    });
  });

  describe('transformTypeDeep edge cases', () => {
    test('should handle array with unknown element type', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'unknown' },
      };

      const result = transformTypeDeep(arrayType, {});
      expect(result).toBe('Array<unknown>');
    });

    test('should handle empty object', () => {
      const emptyObject: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
      };

      const result = transformTypeDeep(emptyObject, {});
      expect(result).toBe('{}');
    });

    test('should handle empty union', () => {
      const emptyUnion: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [],
      };

      const result = transformTypeDeep(emptyUnion, {});
      expect(result).toBe('never');
    });

    test('should handle empty intersection', () => {
      const emptyIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [],
      };

      const result = transformTypeDeep(emptyIntersection, {});
      expect(result).toBe('unknown');
    });

    test('should handle tuple with empty elements', () => {
      const emptyTuple: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [],
      };

      const result = transformTypeDeep(emptyTuple, {});
      expect(result).toBe('[]');
    });

    test('should handle transformer returning TypeInfo instead of string', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result = transformTypeDeep(stringType, {
        onPrimitive: type => {
          if (type.name === 'string') {
            return { kind: TypeKind.Primitive, name: 'number' };
          }
          return null;
        },
      });

      expect(result).toBe('number');
    });

    test('should handle onArray returning TypeInfo', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      const result = transformTypeDeep(arrayType, {
        onArray: () => ({ kind: TypeKind.Primitive, name: 'CustomArrayType' }),
      });

      expect(result).toBe('CustomArrayType');
    });

    test('should handle onObject returning TypeInfo', () => {
      const objectType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      const result = transformTypeDeep(objectType, {
        onObject: () => ({ kind: TypeKind.Primitive, name: 'CustomObjectType' }),
      });

      expect(result).toBe('CustomObjectType');
    });

    test('should handle onUnion returning TypeInfo', () => {
      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      const result = transformTypeDeep(unionType, {
        onUnion: () => ({ kind: TypeKind.Primitive, name: 'CustomUnionType' }),
      });

      expect(result).toBe('CustomUnionType');
    });

    test('should handle onIntersection returning TypeInfo', () => {
      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'B', properties: [] },
        ],
      };

      const result = transformTypeDeep(intersectionType, {
        onIntersection: () => ({ kind: TypeKind.Primitive, name: 'CustomIntersectionType' }),
      });

      expect(result).toBe('CustomIntersectionType');
    });

    test('should handle onGeneric returning TypeInfo', () => {
      const genericType: TypeInfo = {
        kind: TypeKind.Generic,
        name: 'T',
      };

      const result = transformTypeDeep(genericType, {
        onGeneric: () => ({ kind: TypeKind.Primitive, name: 'string' }),
      });

      expect(result).toBe('string');
    });

    test('should handle onLiteral returning TypeInfo', () => {
      const literalType: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 'hello',
      };

      const result = transformTypeDeep(literalType, {
        onLiteral: () => ({ kind: TypeKind.Primitive, name: 'string' }),
      });

      expect(result).toBe('string');
    });

    test('should handle onReference returning TypeInfo', () => {
      const referenceType: TypeInfo = {
        kind: TypeKind.Reference,
        name: 'MyType',
      };

      const result = transformTypeDeep(referenceType, {
        onReference: () => ({ kind: TypeKind.Primitive, name: 'string' }),
      });

      expect(result).toBe('string');
    });

    test('should handle onTuple returning TypeInfo', () => {
      const tupleType: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      const result = transformTypeDeep(tupleType, {
        onTuple: () => ({ kind: TypeKind.Primitive, name: 'CustomTupleType' }),
      });

      expect(result).toBe('CustomTupleType');
    });

    test('should handle onAny returning string directly', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      const result = transformTypeDeep(stringType, {
        onAny: () => 'AnyType',
      });

      expect(result).toBe('AnyType');
    });

    test('should handle generic object with multiple generic parameters', () => {
      const genericObject: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Result',
        properties: [],
        genericParams: [{ name: 'T' }, { name: 'E' }, { name: 'K' }],
      };

      const result = transformTypeDeep(genericObject, {});
      expect(result).toBe('Result<T, E, K>');
    });

    test('should handle generic object with constrained generic parameters', () => {
      const genericObject: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Result',
        properties: [],
        genericParams: [
          { name: 'T', constraint: { kind: TypeKind.Primitive, name: 'string' } },
          { name: 'E', constraint: { kind: TypeKind.Primitive, name: 'Error' } },
        ],
      };

      const result = transformTypeDeep(genericObject, {});
      expect(result).toBe('Result<T, E>');
    });
  });
});
