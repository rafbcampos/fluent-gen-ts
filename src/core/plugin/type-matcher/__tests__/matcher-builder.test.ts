import { describe, it, expect } from 'vitest';
import { createTypeMatcher } from '../matcher-builder.js';
import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';

describe('createTypeMatcher', () => {
  describe('primitive', () => {
    it('should create a primitive matcher for specific types', () => {
      const m = createTypeMatcher();
      const matcher = m.primitive('string', 'number');

      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
      const booleanType: TypeInfo = { kind: TypeKind.Primitive, name: 'boolean' };

      expect(matcher.match(stringType)).toBe(true);
      expect(matcher.match(numberType)).toBe(true);
      expect(matcher.match(booleanType)).toBe(false);
    });

    it('should create a primitive matcher for any primitive', () => {
      const m = createTypeMatcher();
      const matcher = m.primitive();

      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };

      expect(matcher.match(stringType)).toBe(true);
      expect(matcher.match(numberType)).toBe(true);
    });

    it('should not match non-primitive types', () => {
      const m = createTypeMatcher();
      const matcher = m.primitive('string');

      const objectType: TypeInfo = { kind: TypeKind.Object, properties: [] };

      expect(matcher.match(objectType)).toBe(false);
    });
  });

  describe('object', () => {
    it('should create an object matcher without name constraint', () => {
      const m = createTypeMatcher();
      const matcher = m.object();

      const objectType: TypeInfo = { kind: TypeKind.Object, properties: [] };

      expect(matcher.match(objectType)).toBe(true);
    });

    it('should create an object matcher with name constraint', () => {
      const m = createTypeMatcher();
      const matcher = m.object('User');

      const userType: TypeInfo = { kind: TypeKind.Object, name: 'User', properties: [] };
      const productType: TypeInfo = { kind: TypeKind.Object, name: 'Product', properties: [] };

      expect(matcher.match(userType)).toBe(true);
      expect(matcher.match(productType)).toBe(false);
    });

    it('should not match non-object types', () => {
      const m = createTypeMatcher();
      const matcher = m.object();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(matcher.match(primitiveType)).toBe(false);
    });
  });

  describe('array', () => {
    it('should create an array matcher', () => {
      const m = createTypeMatcher();
      const matcher = m.array();

      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      expect(matcher.match(arrayType)).toBe(true);
    });

    it('should support element type matching', () => {
      const m = createTypeMatcher();
      const stringMatcher = m.primitive('string');
      const arrayMatcher = m.array().of(stringMatcher);

      const stringArrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      const numberArrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'number' },
      };

      expect(arrayMatcher.match(stringArrayType)).toBe(true);
      expect(arrayMatcher.match(numberArrayType)).toBe(false);
    });

    it('should not match non-array types', () => {
      const m = createTypeMatcher();
      const matcher = m.array();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(matcher.match(primitiveType)).toBe(false);
    });
  });

  describe('union', () => {
    it('should create a union matcher', () => {
      const m = createTypeMatcher();
      const matcher = m.union();

      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      expect(matcher.match(unionType)).toBe(true);
    });

    it('should support containment matching', () => {
      const m = createTypeMatcher();
      const matcher = m.union().containing(m.primitive('string')).containing(m.primitive('number'));

      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      expect(matcher.match(unionType)).toBe(true);
    });

    it('should not match non-union types', () => {
      const m = createTypeMatcher();
      const matcher = m.union();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(matcher.match(primitiveType)).toBe(false);
    });
  });

  describe('intersection', () => {
    it('should create an intersection matcher', () => {
      const m = createTypeMatcher();
      const matcher = m.intersection();

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, properties: [] },
          { kind: TypeKind.Object, properties: [] },
        ],
      };

      expect(matcher.match(intersectionType)).toBe(true);
    });

    it('should support inclusion matching', () => {
      const m = createTypeMatcher();
      const matcher = m.intersection().including(m.object());

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, properties: [] },
          { kind: TypeKind.Object, properties: [] },
        ],
      };

      expect(matcher.match(intersectionType)).toBe(true);
    });

    it('should not match non-intersection types', () => {
      const m = createTypeMatcher();
      const matcher = m.intersection();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(matcher.match(primitiveType)).toBe(false);
    });
  });

  describe('reference', () => {
    it('should create a reference matcher without name constraint', () => {
      const m = createTypeMatcher();
      const matcher = m.reference();

      const refType: TypeInfo = { kind: TypeKind.Reference, name: 'User' };

      expect(matcher.match(refType)).toBe(true);
    });

    it('should create a reference matcher with name constraint', () => {
      const m = createTypeMatcher();
      const matcher = m.reference('User');

      const userRef: TypeInfo = { kind: TypeKind.Reference, name: 'User' };
      const productRef: TypeInfo = { kind: TypeKind.Reference, name: 'Product' };

      expect(matcher.match(userRef)).toBe(true);
      expect(matcher.match(productRef)).toBe(false);
    });

    it('should not match non-reference types', () => {
      const m = createTypeMatcher();
      const matcher = m.reference();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(matcher.match(primitiveType)).toBe(false);
    });
  });

  describe('generic', () => {
    it('should create a generic matcher without name constraint', () => {
      const m = createTypeMatcher();
      const matcher = m.generic();

      const genericType: TypeInfo = {
        kind: TypeKind.Generic,
        name: 'T',
        constraint: { kind: TypeKind.Primitive, name: 'string' },
      };

      expect(matcher.match(genericType)).toBe(true);
    });

    it('should create a generic matcher with name constraint', () => {
      const m = createTypeMatcher();
      const matcher = m.generic('T');

      const tGeneric: TypeInfo = {
        kind: TypeKind.Generic,
        name: 'T',
        constraint: { kind: TypeKind.Unknown },
      };
      const kGeneric: TypeInfo = {
        kind: TypeKind.Generic,
        name: 'K',
        constraint: { kind: TypeKind.Unknown },
      };

      expect(matcher.match(tGeneric)).toBe(true);
      expect(matcher.match(kGeneric)).toBe(false);
    });

    it('should not match non-generic types', () => {
      const m = createTypeMatcher();
      const matcher = m.generic();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(matcher.match(primitiveType)).toBe(false);
    });
  });

  describe('any', () => {
    it('should match any type', () => {
      const m = createTypeMatcher();
      const matcher = m.any();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const objectType: TypeInfo = { kind: TypeKind.Object, properties: [] };
      const unknownType: TypeInfo = { kind: TypeKind.Unknown };

      expect(matcher.match(primitiveType)).toBe(true);
      expect(matcher.match(objectType)).toBe(true);
      expect(matcher.match(unknownType)).toBe(true);
    });
  });

  describe('never', () => {
    it('should never match any type', () => {
      const m = createTypeMatcher();
      const matcher = m.never();

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const objectType: TypeInfo = { kind: TypeKind.Object, properties: [] };

      expect(matcher.match(primitiveType)).toBe(false);
      expect(matcher.match(objectType)).toBe(false);
    });
  });

  describe('literal', () => {
    it('should match string literals', () => {
      const m = createTypeMatcher();
      const matcher = m.literal('test');

      const matchingLiteral: TypeInfo = { kind: TypeKind.Literal, literal: 'test' };
      const nonMatchingLiteral: TypeInfo = { kind: TypeKind.Literal, literal: 'other' };

      expect(matcher.match(matchingLiteral)).toBe(true);
      expect(matcher.match(nonMatchingLiteral)).toBe(false);
    });

    it('should match number literals', () => {
      const m = createTypeMatcher();
      const matcher = m.literal(42);

      const matchingLiteral: TypeInfo = { kind: TypeKind.Literal, literal: 42 };
      const nonMatchingLiteral: TypeInfo = { kind: TypeKind.Literal, literal: 99 };

      expect(matcher.match(matchingLiteral)).toBe(true);
      expect(matcher.match(nonMatchingLiteral)).toBe(false);
    });

    it('should match boolean literals', () => {
      const m = createTypeMatcher();
      const matcher = m.literal(true);

      const matchingLiteral: TypeInfo = { kind: TypeKind.Literal, literal: true };
      const nonMatchingLiteral: TypeInfo = { kind: TypeKind.Literal, literal: false };

      expect(matcher.match(matchingLiteral)).toBe(true);
      expect(matcher.match(nonMatchingLiteral)).toBe(false);
    });

    it('should not match non-literal types', () => {
      const m = createTypeMatcher();
      const matcher = m.literal('test');

      const primitiveType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };

      expect(matcher.match(primitiveType)).toBe(false);
    });
  });

  describe('or', () => {
    it('should match if any matcher matches', () => {
      const m = createTypeMatcher();
      const matcher = m.or(m.primitive('string'), m.primitive('number'));

      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
      const booleanType: TypeInfo = { kind: TypeKind.Primitive, name: 'boolean' };

      expect(matcher.match(stringType)).toBe(true);
      expect(matcher.match(numberType)).toBe(true);
      expect(matcher.match(booleanType)).toBe(false);
    });

    it('should handle multiple matchers', () => {
      const m = createTypeMatcher();
      const matcher = m.or(m.primitive('string'), m.object(), m.array());

      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const objectType: TypeInfo = { kind: TypeKind.Object, properties: [] };
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Unknown },
      };

      expect(matcher.match(stringType)).toBe(true);
      expect(matcher.match(objectType)).toBe(true);
      expect(matcher.match(arrayType)).toBe(true);
    });
  });

  describe('and', () => {
    it('should match if all matchers match', () => {
      const m = createTypeMatcher();
      const matcher = m.and(m.object(), m.object('User'));

      const userType: TypeInfo = { kind: TypeKind.Object, name: 'User', properties: [] };
      const productType: TypeInfo = { kind: TypeKind.Object, name: 'Product', properties: [] };

      expect(matcher.match(userType)).toBe(true);
      expect(matcher.match(productType)).toBe(false);
    });
  });

  describe('not', () => {
    it('should match if the inner matcher does not match', () => {
      const m = createTypeMatcher();
      const matcher = m.not(m.primitive('string'));

      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };

      expect(matcher.match(stringType)).toBe(false);
      expect(matcher.match(numberType)).toBe(true);
    });

    it('should work with complex matchers', () => {
      const m = createTypeMatcher();
      const matcher = m.not(m.or(m.primitive('string'), m.primitive('number')));

      const stringType: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
      const numberType: TypeInfo = { kind: TypeKind.Primitive, name: 'number' };
      const booleanType: TypeInfo = { kind: TypeKind.Primitive, name: 'boolean' };

      expect(matcher.match(stringType)).toBe(false);
      expect(matcher.match(numberType)).toBe(false);
      expect(matcher.match(booleanType)).toBe(true);
    });
  });

  describe('describe', () => {
    it('should provide descriptions for matchers', () => {
      const m = createTypeMatcher();

      expect(m.primitive('string').describe()).toContain('string');
      expect(m.object('User').describe()).toContain('User');
      expect(m.array().describe()).toBeDefined();
      expect(m.union().describe()).toBeDefined();
      expect(m.intersection().describe()).toBeDefined();
      expect(m.reference('T').describe()).toBeDefined();
      expect(m.generic('T').describe()).toBeDefined();
      expect(m.any().describe()).toBeDefined();
      expect(m.never().describe()).toBeDefined();
      expect(m.literal('test').describe()).toBeDefined();
    });
  });
});
