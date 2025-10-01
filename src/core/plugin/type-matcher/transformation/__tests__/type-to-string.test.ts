import { describe, it, expect } from 'vitest';
import { typeInfoToString } from '../type-to-string.js';
import { TypeKind } from '../../../../types.js';
import type { TypeInfo } from '../../../../types.js';

describe('typeInfoToString', () => {
  describe('primitive types', () => {
    it('should convert string primitive', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      expect(typeInfoToString(typeInfo)).toBe('string');
    });

    it('should convert number primitive', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
      expect(typeInfoToString(typeInfo)).toBe('number');
    });

    it('should convert boolean primitive', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'boolean' };
      expect(typeInfoToString(typeInfo)).toBe('boolean');
    });

    it('should return unknown for primitive without name', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: '' };
      expect(typeInfoToString(typeInfo)).toBe('');
    });
  });

  describe('array types', () => {
    it('should convert array of primitives', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };
      expect(typeInfoToString(typeInfo)).toBe('Array<string>');
    });

    it('should convert nested arrays', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'number' },
        },
      };
      expect(typeInfoToString(typeInfo)).toBe('Array<Array<number>>');
    });

    it('should return Array<unknown> for array without elementType', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Array, elementType: { kind: TypeKind.Unknown } };
      expect(typeInfoToString(typeInfo)).toBe('Array<unknown>');
    });
  });

  describe('object types', () => {
    it('should convert named object type', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };
      expect(typeInfoToString(typeInfo)).toBe('User');
    });

    it('should convert named object with generic params', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Response',
        genericParams: [{ name: 'T' }, { name: 'E' }],
        properties: [],
      };
      expect(typeInfoToString(typeInfo)).toBe('Response<T, E>');
    });

    it('should convert anonymous object with properties', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: false,
          },
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('{ id: number; name: string }');
    });

    it('should handle optional properties', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: false,
          },
          {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: true,
            readonly: false,
          },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('{ id: number; email?: string }');
    });

    it('should handle readonly properties', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: true,
          },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('{ readonly id: number }');
    });

    it('should return {} for empty object', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
      };
      expect(typeInfoToString(typeInfo)).toBe('{}');
    });
  });

  describe('union types', () => {
    it('should convert union of primitives', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('string | number');
    });

    it('should convert union with multiple types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
          { kind: TypeKind.Literal, literal: null },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('string | number | null');
    });

    it('should return never for empty union', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [],
      };
      expect(typeInfoToString(typeInfo)).toBe('never');
    });
  });

  describe('intersection types', () => {
    it('should convert intersection of objects', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'Base', properties: [] },
          { kind: TypeKind.Object, name: 'Mixin', properties: [] },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('Base & Mixin');
    });

    it('should return unknown for empty intersection', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [],
      };
      expect(typeInfoToString(typeInfo)).toBe('unknown');
    });
  });

  describe('generic types', () => {
    it('should convert generic with name', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Generic,
        name: 'T',
        constraint: { kind: TypeKind.Unknown },
      };
      expect(typeInfoToString(typeInfo)).toBe('T');
    });

    it('should return T for generic without name', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Generic,
        name: 'T',
        constraint: { kind: TypeKind.Unknown },
      };
      expect(typeInfoToString(typeInfo)).toBe('T');
    });
  });

  describe('literal types', () => {
    it('should convert string literal', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 'test',
      };
      expect(typeInfoToString(typeInfo)).toBe('"test"');
    });

    it('should convert number literal', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 42,
      };
      expect(typeInfoToString(typeInfo)).toBe('42');
    });

    it('should convert boolean literal true', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Literal,
        literal: true,
      };
      expect(typeInfoToString(typeInfo)).toBe('true');
    });

    it('should convert boolean literal false', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Literal,
        literal: false,
      };
      expect(typeInfoToString(typeInfo)).toBe('false');
    });

    it('should convert null literal', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Literal,
        literal: null,
      };
      expect(typeInfoToString(typeInfo)).toBe('null');
    });

    it('should return unknown for literal without value', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Literal,
        literal: undefined,
      };
      expect(typeInfoToString(typeInfo)).toBe('undefined');
    });
  });

  describe('reference types', () => {
    it('should convert reference with name', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Reference,
        name: 'User',
      };
      expect(typeInfoToString(typeInfo)).toBe('User');
    });

    it('should return unknown for reference without name', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Reference,
        name: '',
      };
      expect(typeInfoToString(typeInfo)).toBe('');
    });
  });

  describe('function types', () => {
    it('should convert named function', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Function,
        name: 'handler',
      };
      expect(typeInfoToString(typeInfo)).toBe('handler');
    });

    it('should return Function for unnamed function', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Function,
      };
      expect(typeInfoToString(typeInfo)).toBe('Function');
    });
  });

  describe('tuple types', () => {
    it('should convert tuple with elements', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('[string, number]');
    });

    it('should return [] for empty tuple', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [],
      };
      expect(typeInfoToString(typeInfo)).toBe('[]');
    });

    it('should return [] for tuple without elements', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [],
      };
      expect(typeInfoToString(typeInfo)).toBe('[]');
    });
  });

  describe('enum types', () => {
    it('should convert enum with name', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Enum,
        name: 'Status',
      };
      expect(typeInfoToString(typeInfo)).toBe('Status');
    });

    it('should return enum for enum without name', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Enum,
        name: '',
      };
      expect(typeInfoToString(typeInfo)).toBe('');
    });
  });

  describe('special types', () => {
    it('should convert never type', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Never,
      };
      expect(typeInfoToString(typeInfo)).toBe('never');
    });

    it('should convert unknown type', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Unknown,
      };
      expect(typeInfoToString(typeInfo)).toBe('unknown');
    });
  });

  describe('complex nested types', () => {
    it('should convert complex nested type', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'data',
            type: {
              kind: TypeKind.Array,
              elementType: {
                kind: TypeKind.Union,
                unionTypes: [
                  { kind: TypeKind.Primitive, name: 'string' },
                  { kind: TypeKind.Primitive, name: 'number' },
                ],
              },
            },
            optional: false,
            readonly: false,
          },
        ],
      };
      expect(typeInfoToString(typeInfo)).toBe('{ data: Array<string | number> }');
    });

    it('should handle deeply nested objects', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'nested',
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
      expect(typeInfoToString(typeInfo)).toBe('{ nested: { value: string } }');
    });
  });
});
