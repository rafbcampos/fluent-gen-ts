import { describe, it, expect } from 'vitest';
import { containsTypeDeep, findTypesDeep } from '../deep-matching.js';
import { TypeKind } from '../../../../types.js';
import type { TypeInfo } from '../../../../types.js';
import { primitive } from '../../matchers/primitive-matcher.js';
import { object } from '../../matchers/object-matcher.js';

describe('containsTypeDeep', () => {
  describe('direct matching', () => {
    it('should match at top level', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should not match when type does not match', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const matcher = primitive('number');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });
  });

  describe('array types', () => {
    it('should find matching element type in array', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should find type in nested array', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'number' },
        },
      };
      const matcher = primitive('number');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should not find non-matching type in array', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };
      const matcher = primitive('number');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });

    it('should handle array without elementType', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Unknown },
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });
  });

  describe('object types', () => {
    it('should find matching type in object property', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should find type in deeply nested properties', () => {
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
                  type: { kind: TypeKind.Primitive, name: 'number' },
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
      const matcher = primitive('number');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should find type in any property', () => {
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
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should handle object without properties', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });
  });

  describe('union types', () => {
    it('should find matching type in union', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should find deeply nested type in union', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          {
            kind: TypeKind.Array,
            elementType: { kind: TypeKind.Primitive, name: 'number' },
          },
        ],
      };
      const matcher = primitive('number');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should handle union without unionTypes', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });
  });

  describe('intersection types', () => {
    it('should find matching type in intersection', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'Base', properties: [] },
          { kind: TypeKind.Object, name: 'Mixin', properties: [] },
        ],
      };
      const matcher = object('Base');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should find deeply nested type in intersection', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          {
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
        ],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should handle intersection without intersectionTypes', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });
  });

  describe('tuple types', () => {
    it('should find matching type in tuple', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should find deeply nested type in tuple', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [
          {
            kind: TypeKind.Array,
            elementType: { kind: TypeKind.Primitive, name: 'string' },
          },
        ],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(true);
    });

    it('should handle tuple without elements', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [],
      };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });
  });

  describe('other types', () => {
    it('should return false for types without nested structure', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Never };
      const matcher = primitive('string');

      expect(containsTypeDeep(typeInfo, matcher)).toBe(false);
    });
  });
});

describe('findTypesDeep', () => {
  describe('direct matching', () => {
    it('should find type at top level', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(typeInfo);
    });

    it('should return empty array when no match', () => {
      const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const matcher = primitive('number');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(0);
    });
  });

  describe('array types', () => {
    it('should find all matching types in array', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: stringType,
      };
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(stringType);
    });

    it('should find types in nested arrays', () => {
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Array,
          elementType: numberType,
        },
      };
      const matcher = primitive('number');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(numberType);
    });
  });

  describe('object types', () => {
    it('should find all matching types in object properties', () => {
      const stringType1: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const stringType2: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'name',
            type: stringType1,
            optional: false,
            readonly: false,
          },
          {
            name: 'email',
            type: stringType2,
            optional: false,
            readonly: false,
          },
        ],
      };
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(2);
    });

    it('should find types in deeply nested objects', () => {
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
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
                  type: numberType,
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
      const matcher = primitive('number');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(numberType);
    });
  });

  describe('union types', () => {
    it('should find all matching types in union', () => {
      const stringType1: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const stringType2: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [stringType1, { kind: TypeKind.Primitive, name: 'number' }, stringType2],
      };
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(2);
    });

    it('should find deeply nested types in union', () => {
      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'number' },
          {
            kind: TypeKind.Array,
            elementType: stringType,
          },
        ],
      };
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(stringType);
    });
  });

  describe('intersection types', () => {
    it('should find all matching types in intersection', () => {
      const base: TypeInfo = { kind: TypeKind.Object, name: 'Base', properties: [] };
      const mixin: TypeInfo = { kind: TypeKind.Object, name: 'Mixin', properties: [] };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [base, mixin],
      };
      const matcher = object();

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(2);
    });
  });

  describe('tuple types', () => {
    it('should find all matching types in tuple', () => {
      const stringType1: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const stringType2: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Tuple,
        elements: [stringType1, { kind: TypeKind.Primitive, name: 'number' }, stringType2],
      };
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(2);
    });
  });

  describe('complex nested structures', () => {
    it('should find all matching types across complex structure', () => {
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
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(2);
    });

    it('should handle multiple levels of nesting', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Array,
        elementType: {
          kind: TypeKind.Object,
          properties: [
            {
              name: 'values',
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
      const matcher = primitive('string');

      const results = findTypesDeep(typeInfo, matcher);
      expect(results).toHaveLength(1);
    });
  });
});
