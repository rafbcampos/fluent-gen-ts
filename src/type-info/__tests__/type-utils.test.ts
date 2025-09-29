import { describe, it, expect } from 'vitest';
import { TypeKind } from '../../core/types.js';
import type { TypeInfo } from '../../core/types.js';
import { collectAllProperties, hasProperties, getPrimaryObjectType } from '../type-utils.js';

describe('type-utils', () => {
  describe('collectAllProperties', () => {
    it('should collect properties from a simple object type', () => {
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
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = collectAllProperties(objectType);

      expect(result).toHaveLength(2);
      expect(result.map(p => p.name)).toEqual(['id', 'name']);
    });

    it('should collect properties from intersection of two object types', () => {
      const type1: TypeInfo = {
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

      const type2: TypeInfo = {
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

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [type1, type2],
      };

      const result = collectAllProperties(intersectionType);

      expect(result).toHaveLength(2);
      expect(result.map(p => p.name).sort()).toEqual(['id', 'name']);
    });

    it('should handle nested intersections (A & (B & C))', () => {
      const typeA: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'a',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const typeB: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'b',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const typeC: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'c',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const nestedIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [typeB, typeC],
      };

      const outerIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [typeA, nestedIntersection],
      };

      const result = collectAllProperties(outerIntersection);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.name).sort()).toEqual(['a', 'b', 'c']);
    });

    it('should handle duplicate property names (left-most wins)', () => {
      const type1: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'value',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const type2: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'value',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [type1, type2],
      };

      const result = collectAllProperties(intersectionType);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('value');
      expect((result[0]!.type as any).name).toBe('string'); // First one wins
    });

    it('should return empty array for empty intersection', () => {
      const emptyIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [],
      };

      const result = collectAllProperties(emptyIntersection);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for object with no properties', () => {
      const emptyObject: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
      };

      const result = collectAllProperties(emptyObject);

      expect(result).toHaveLength(0);
    });

    it('should ignore non-object types in intersection', () => {
      const objectType: TypeInfo = {
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

      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [objectType, primitiveType],
      };

      const result = collectAllProperties(intersectionType);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('id');
    });

    it('should return empty array for non-object, non-intersection types', () => {
      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const result = collectAllProperties(primitiveType);

      expect(result).toHaveLength(0);
    });
  });

  describe('hasProperties', () => {
    it('should return true for object type with properties', () => {
      const objectType: TypeInfo = {
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

      expect(hasProperties(objectType)).toBe(true);
    });

    it('should return false for object type without properties', () => {
      const emptyObject: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
      };

      expect(hasProperties(emptyObject)).toBe(false);
    });

    it('should return true for intersection with properties', () => {
      const objectType: TypeInfo = {
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

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [objectType],
      };

      expect(hasProperties(intersectionType)).toBe(true);
    });

    it('should return false for intersection without properties', () => {
      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [primitiveType],
      };

      expect(hasProperties(intersectionType)).toBe(false);
    });

    it('should return false for empty intersection', () => {
      const emptyIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [],
      };

      expect(hasProperties(emptyIntersection)).toBe(false);
    });

    it('should return false for primitive types', () => {
      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      expect(hasProperties(primitiveType)).toBe(false);
    });

    it('should return false for array types', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      expect(hasProperties(arrayType)).toBe(false);
    });

    it('should handle nested intersections', () => {
      const objectType: TypeInfo = {
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

      const nestedIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [objectType],
      };

      const outerIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [nestedIntersection],
      };

      expect(hasProperties(outerIntersection)).toBe(true);
    });
  });

  describe('getPrimaryObjectType', () => {
    it('should return the object type itself', () => {
      const objectType: TypeInfo = {
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

      const result = getPrimaryObjectType(objectType);

      expect(result).toBe(objectType);
    });

    it('should return first object type from intersection', () => {
      const objectType1: TypeInfo = {
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

      const objectType2: TypeInfo = {
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

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [objectType1, objectType2],
      };

      const result = getPrimaryObjectType(intersectionType);

      expect(result).toBe(objectType1);
    });

    it('should return null for primitive types', () => {
      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const result = getPrimaryObjectType(primitiveType);

      expect(result).toBeNull();
    });

    it('should return null for empty intersection', () => {
      const emptyIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [],
      };

      const result = getPrimaryObjectType(emptyIntersection);

      expect(result).toBeNull();
    });

    it('should skip non-object types in intersection', () => {
      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const objectType: TypeInfo = {
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

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [primitiveType, objectType],
      };

      const result = getPrimaryObjectType(intersectionType);

      expect(result).toBe(objectType);
    });

    it('should handle nested intersections', () => {
      const objectType: TypeInfo = {
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

      const nestedIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [objectType],
      };

      const outerIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [nestedIntersection],
      };

      const result = getPrimaryObjectType(outerIntersection);

      expect(result).toBe(objectType);
    });

    it('should return null for intersection with only non-object types', () => {
      const primitiveType1: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const primitiveType2: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'number',
      };

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [primitiveType1, primitiveType2],
      };

      const result = getPrimaryObjectType(intersectionType);

      expect(result).toBeNull();
    });
  });
});
