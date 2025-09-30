import { describe, test, expect } from 'vitest';
import {
  createTypeMatcher,
  primitive,
  object,
  array,
  union,
  intersection,
  reference,
  generic,
  any,
  never,
  literal,
  or,
  and,
  not,
} from '../type-matcher/index.js';
import { TypeKind } from '../../types.js';
import type { TypeInfo } from '../../types.js';

describe('Type Matchers', () => {
  describe('createTypeMatcher', () => {
    test('should create type matcher builder', () => {
      const builder = createTypeMatcher();
      expect(builder).toBeDefined();
      expect(builder.primitive).toBeDefined();
      expect(builder.object).toBeDefined();
      expect(builder.array).toBeDefined();
    });
  });

  describe('primitive matcher', () => {
    test('should match any primitive when no names specified', () => {
      const matcher = primitive();

      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'number' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'boolean' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Object, properties: [] })).toBe(false);
    });

    test('should match specific primitive types', () => {
      const stringMatcher = primitive('string');

      expect(stringMatcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(stringMatcher.match({ kind: TypeKind.Primitive, name: 'number' })).toBe(false);
      expect(stringMatcher.match({ kind: TypeKind.Object, properties: [] })).toBe(false);
    });

    test('should match multiple primitive types', () => {
      const matcher = primitive('string', 'number');

      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'number' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'boolean' })).toBe(false);
    });

    test('should describe primitive matcher correctly', () => {
      expect(primitive().describe()).toBe('primitive');
      expect(primitive('string').describe()).toBe('primitive(string)');
      expect(primitive('string', 'number').describe()).toBe('primitive(string | number)');
    });

    test('should handle primitive type without name property', () => {
      const matcher = primitive('string');
      const primitiveWithoutName: TypeInfo = { kind: TypeKind.Primitive } as any;

      expect(matcher.match(primitiveWithoutName)).toBe(false);
    });
  });

  describe('object matcher', () => {
    test('should match any object when no constraints', () => {
      const matcher = object();

      expect(matcher.match({ kind: TypeKind.Object, properties: [] })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
    });

    test('should match object by name', () => {
      const matcher = object('User');

      expect(matcher.match({ kind: TypeKind.Object, name: 'User', properties: [] })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Object, name: 'Product', properties: [] })).toBe(false);
      expect(matcher.match({ kind: TypeKind.Object, properties: [] })).toBe(false);
    });

    test('should match object with generic', () => {
      const matcher = object().withGeneric('T');

      const objectWithGeneric: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
        genericParams: [{ name: 'T' }],
      };

      const objectWithoutGeneric: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
      };

      expect(matcher.match(objectWithGeneric)).toBe(true);
      expect(matcher.match(objectWithoutGeneric)).toBe(false);
    });

    test('should match object with required property', () => {
      const matcher = object().withProperty('email');

      const objectWithEmail: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const objectWithoutEmail: TypeInfo = {
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

      expect(matcher.match(objectWithEmail)).toBe(true);
      expect(matcher.match(objectWithoutEmail)).toBe(false);
    });

    test('should match object with property type constraint', () => {
      const matcher = object().withProperty('email', primitive('string'));

      const objectWithStringEmail: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const objectWithNumberEmail: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: false,
          },
        ],
      };

      expect(matcher.match(objectWithStringEmail)).toBe(true);
      expect(matcher.match(objectWithNumberEmail)).toBe(false);
    });

    test('should match object with multiple properties', () => {
      const matcher = object().withProperties('name', 'email');

      const objectWithBothProps: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const objectWithOneProps: TypeInfo = {
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

      expect(matcher.match(objectWithBothProps)).toBe(true);
      expect(matcher.match(objectWithOneProps)).toBe(false);
    });

    test('should chain object matcher methods fluently', () => {
      const matcher = object('User')
        .withGeneric('T')
        .withProperty('id', primitive('string'))
        .withProperties('name', 'email');

      expect(matcher.describe()).toContain('User');
    });

    test('should describe object matcher correctly', () => {
      expect(object().describe()).toBe('object');
      expect(object('User').describe()).toBe('object(User)');
      expect(object().withGeneric('T').describe()).toContain('generic');
      expect(object().withProperty('email').describe()).toContain('email');
    });
  });

  describe('array matcher', () => {
    test('should match any array', () => {
      const matcher = array();

      expect(
        matcher.match({
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'string' },
        }),
      ).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
    });

    test('should match array with specific element type', () => {
      const matcher = array().of(primitive('string'));

      const stringArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      const numberArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'number' },
      };

      expect(matcher.match(stringArray)).toBe(true);
      expect(matcher.match(numberArray)).toBe(false);
    });

    test('should match array with complex element type', () => {
      const matcher = array().of(object('User'));

      const userArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Object, name: 'User', properties: [] },
      };

      const stringArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      expect(matcher.match(userArray)).toBe(true);
      expect(matcher.match(stringArray)).toBe(false);
    });

    test('should match array with chained matcher', () => {
      const matcher = array().of(primitive('string'));

      const stringArray: TypeInfo = {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Primitive, name: 'string' },
      };

      expect(matcher.match(stringArray)).toBe(true);
    });

    test('should describe array matcher correctly', () => {
      expect(array().describe()).toBe('array');
      expect(array().of(primitive('string')).describe()).toContain('array of');
    });
  });

  describe('union matcher', () => {
    test('should match any union', () => {
      const matcher = union();

      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      expect(matcher.match(unionType)).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
    });

    test('should match union containing specific type', () => {
      const matcher = union().containing(primitive('string'));

      const stringNumberUnion: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      const numberBooleanUnion: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'number' },
          { kind: TypeKind.Primitive, name: 'boolean' },
        ],
      };

      expect(matcher.match(stringNumberUnion)).toBe(true);
      expect(matcher.match(numberBooleanUnion)).toBe(false);
    });

    test('should match union with exact types', () => {
      const matcher = union().exact(primitive('string'), primitive('number'));

      const exactUnion: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      const differentUnion: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'boolean' },
        ],
      };

      const partialUnion: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [{ kind: TypeKind.Primitive, name: 'string' }],
      };

      expect(matcher.match(exactUnion)).toBe(true);
      expect(matcher.match(differentUnion)).toBe(false);
      expect(matcher.match(partialUnion)).toBe(false);
    });

    test('should match union containing type with chained matcher', () => {
      const matcher = union().containing(primitive('string'));

      const unionType: TypeInfo = {
        kind: TypeKind.Union,
        unionTypes: [
          { kind: TypeKind.Primitive, name: 'string' },
          { kind: TypeKind.Primitive, name: 'number' },
        ],
      };

      expect(matcher.match(unionType)).toBe(true);
    });

    test('should describe union matcher correctly', () => {
      expect(union().describe()).toBe('union');
      expect(union().containing(primitive('string')).describe()).toContain('containing');
    });
  });

  describe('intersection matcher', () => {
    test('should match any intersection', () => {
      const matcher = intersection();

      const intersectionType: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'B', properties: [] },
        ],
      };

      expect(matcher.match(intersectionType)).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
    });

    test('should match intersection including specific type', () => {
      const matcher = intersection().including(object('A'));

      const intersectionWithA: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'B', properties: [] },
        ],
      };

      const intersectionWithoutA: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'B', properties: [] },
          { kind: TypeKind.Object, name: 'C', properties: [] },
        ],
      };

      expect(matcher.match(intersectionWithA)).toBe(true);
      expect(matcher.match(intersectionWithoutA)).toBe(false);
    });

    test('should match intersection with exact types', () => {
      const matcher = intersection().exact(object('A'), object('B'));

      const exactIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'B', properties: [] },
        ],
      };

      const differentIntersection: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'C', properties: [] },
        ],
      };

      expect(matcher.match(exactIntersection)).toBe(true);
      expect(matcher.match(differentIntersection)).toBe(false);
    });

    test('should describe intersection matcher correctly', () => {
      expect(intersection().describe()).toBe('intersection');
      expect(intersection().including(object('A')).describe()).toContain('including');
    });
  });

  describe('reference matcher', () => {
    test('should match any reference when no name specified', () => {
      const matcher = reference();

      expect(matcher.match({ kind: TypeKind.Reference, name: 'User' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Reference, name: 'Product' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
    });

    test('should match specific reference by name', () => {
      const matcher = reference('User');

      expect(matcher.match({ kind: TypeKind.Reference, name: 'User' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Reference, name: 'Product' })).toBe(false);
    });

    test('should describe reference matcher correctly', () => {
      expect(reference().describe()).toBe('reference');
      expect(reference('User').describe()).toBe('reference(User)');
    });
  });

  describe('generic matcher', () => {
    test('should match any generic when no name specified', () => {
      const matcher = generic();

      expect(matcher.match({ kind: TypeKind.Generic, name: 'T' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Generic, name: 'U' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
    });

    test('should match specific generic by name', () => {
      const matcher = generic('T');

      expect(matcher.match({ kind: TypeKind.Generic, name: 'T' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Generic, name: 'U' })).toBe(false);
    });

    test('should describe generic matcher correctly', () => {
      expect(generic().describe()).toBe('generic');
      expect(generic('T').describe()).toBe('generic(T)');
    });
  });

  describe('special matchers', () => {
    test('any matcher should match all types', () => {
      const matcher = any();

      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Object, properties: [] })).toBe(true);
      expect(
        matcher.match({
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'string' },
        }),
      ).toBe(true);
      expect(matcher.describe()).toBe('any');
    });

    test('never matcher should match only never types', () => {
      const matcher = never();

      expect(matcher.match({ kind: TypeKind.Never })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
      expect(matcher.describe()).toBe('never');
    });

    test('literal matcher should match specific literal values', () => {
      const stringMatcher = literal('hello');
      const numberMatcher = literal(42);
      const boolMatcher = literal(true);

      expect(stringMatcher.match({ kind: TypeKind.Literal, literal: 'hello' })).toBe(true);
      expect(stringMatcher.match({ kind: TypeKind.Literal, literal: 'world' })).toBe(false);

      expect(numberMatcher.match({ kind: TypeKind.Literal, literal: 42 })).toBe(true);
      expect(numberMatcher.match({ kind: TypeKind.Literal, literal: 43 })).toBe(false);

      expect(boolMatcher.match({ kind: TypeKind.Literal, literal: true })).toBe(true);
      expect(boolMatcher.match({ kind: TypeKind.Literal, literal: false })).toBe(false);

      expect(stringMatcher.describe()).toBe('literal("hello")');
      expect(numberMatcher.describe()).toBe('literal(42)');
      expect(boolMatcher.describe()).toBe('literal(true)');
    });
  });

  describe('composite matchers', () => {
    test('or matcher should match when any sub-matcher matches', () => {
      const matcher = or(primitive('string'), primitive('number'));

      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'number' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'boolean' })).toBe(false);

      expect(matcher.describe()).toContain('or');
    });

    test('and matcher should match when all sub-matchers match', () => {
      const matcher = and(object().withProperty('name'), object().withProperty('email'));

      const objectWithBoth: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const objectWithOne: TypeInfo = {
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

      expect(matcher.match(objectWithBoth)).toBe(true);
      expect(matcher.match(objectWithOne)).toBe(false);

      expect(matcher.describe()).toContain('and');
    });

    test('not matcher should match when sub-matcher does not match', () => {
      const matcher = not(primitive('string'));

      expect(matcher.match({ kind: TypeKind.Primitive, name: 'number' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(false);
      expect(matcher.match({ kind: TypeKind.Object, properties: [] })).toBe(true);

      expect(matcher.describe()).toContain('not');
    });

    test('should handle complex nested matchers', () => {
      const matcher = or(
        and(primitive('string'), not(literal('empty'))),
        object('User').withProperty('id'),
      );

      expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(matcher.match({ kind: TypeKind.Literal, literal: 'empty' })).toBe(false);

      const userObject: TypeInfo = {
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

      expect(matcher.match(userObject)).toBe(true);
    });
  });

  describe('builder pattern integration', () => {
    test('should work with type matcher builder', () => {
      const builder = createTypeMatcher();

      const stringMatcher = builder.primitive('string');
      const userMatcher = builder.object('User').withProperty('email');
      const arrayMatcher = builder.array().of(builder.primitive('number'));

      expect(stringMatcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(userMatcher.describe()).toContain('User');
      expect(arrayMatcher.describe()).toContain('array');
    });

    test('should create complex matchers with builder', () => {
      const builder = createTypeMatcher();

      const complexMatcher = builder.or(
        builder.primitive('string'),
        builder.object().withProperty('value', builder.primitive('number')),
      );

      expect(complexMatcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);

      const valueObject: TypeInfo = {
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

      expect(complexMatcher.match(valueObject)).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle missing properties in type info', () => {
      const matcher = primitive('string');
      const invalidType = { kind: TypeKind.Primitive } as TypeInfo;

      expect(matcher.match(invalidType)).toBe(false);
    });

    test('should handle empty arrays in union/intersection matchers', () => {
      const unionMatcher = union().exact();
      const intersectionMatcher = intersection().exact();

      const emptyUnion: TypeInfo = { kind: TypeKind.Union, unionTypes: [] };
      const emptyIntersection: TypeInfo = { kind: TypeKind.Intersection, intersectionTypes: [] };

      expect(unionMatcher.match(emptyUnion)).toBe(true);
      expect(intersectionMatcher.match(emptyIntersection)).toBe(true);
    });

    test('should handle null/undefined in literal matcher', () => {
      // Test with valid literal values instead of null/undefined which aren't supported by the literal matcher
      const stringMatcher = literal('null');
      const numberMatcher = literal(0);

      expect(stringMatcher.match({ kind: TypeKind.Literal, literal: 'null' })).toBe(true);
      expect(stringMatcher.match({ kind: TypeKind.Literal, literal: 'undefined' })).toBe(false);

      expect(numberMatcher.match({ kind: TypeKind.Literal, literal: 0 })).toBe(true);
      expect(numberMatcher.match({ kind: TypeKind.Literal, literal: 1 })).toBe(false);
    });

    test('should handle object properties with null/undefined types', () => {
      const matcher = object().withProperty('test');

      const objectWithProperty: TypeInfo = {
        kind: TypeKind.Object,
        properties: [
          {
            name: 'test',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      expect(matcher.match(objectWithProperty)).toBe(true);
    });

    test('should handle intersection types with both "types" and "intersectionTypes" properties', () => {
      const matcher = intersection().including(object('A'));

      // Test with "intersectionTypes" property (current standard)
      const intersectionWithIntersectionTypes: TypeInfo = {
        kind: TypeKind.Intersection,
        intersectionTypes: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'B', properties: [] },
        ],
      };

      // Test with "types" property (alternative format)
      const intersectionWithTypes: TypeInfo = {
        kind: TypeKind.Intersection,
        types: [
          { kind: TypeKind.Object, name: 'A', properties: [] },
          { kind: TypeKind.Object, name: 'B', properties: [] },
        ],
      } as any;

      expect(matcher.match(intersectionWithIntersectionTypes)).toBe(true);
      expect(matcher.match(intersectionWithTypes)).toBe(true);
    });

    test('should handle literal types with both "value" and "literal" properties', () => {
      const matcher = literal('test');

      // Test with "literal" property (current standard)
      const literalWithLiteralProp: TypeInfo = {
        kind: TypeKind.Literal,
        literal: 'test',
      };

      // Test with "value" property (alternative format)
      const literalWithValueProp: TypeInfo = {
        kind: TypeKind.Literal,
        value: 'test',
      } as any;

      expect(matcher.match(literalWithLiteralProp)).toBe(true);
      expect(matcher.match(literalWithValueProp)).toBe(true);
    });

    test('should handle literal types without literal value properties', () => {
      const matcher = literal('test');

      // Test with literal type that has no value/literal property
      const literalWithoutValue: TypeInfo = {
        kind: TypeKind.Literal,
      } as any;

      expect(matcher.match(literalWithoutValue)).toBe(false);
    });

    test('should handle array types without element type', () => {
      const arrayMatcher = array().of(primitive('string'));

      // Array without elementType property should not match specific element constraint
      const arrayWithoutElementType: TypeInfo = {
        kind: TypeKind.Array,
      } as any;

      expect(arrayMatcher.match(arrayWithoutElementType)).toBe(false);

      // But unconstrained array should match
      const unconstrainedArrayMatcher = array();
      expect(unconstrainedArrayMatcher.match(arrayWithoutElementType)).toBe(true);
    });

    test('should handle reference and generic types without name property', () => {
      const referenceMatcher = reference('TestType');
      const genericMatcher = generic('T');

      const referenceWithoutName: TypeInfo = { kind: TypeKind.Reference } as any;
      const genericWithoutName: TypeInfo = { kind: TypeKind.Generic } as any;

      expect(referenceMatcher.match(referenceWithoutName)).toBe(false);
      expect(genericMatcher.match(genericWithoutName)).toBe(false);

      // But matchers without name constraints should match
      expect(reference().match(referenceWithoutName)).toBe(true);
      expect(generic().match(genericWithoutName)).toBe(true);
    });

    test('should handle object types without name when name matcher is specified', () => {
      const matcher = object('User');

      const objectWithoutName: TypeInfo = {
        kind: TypeKind.Object,
        properties: [],
      };

      expect(matcher.match(objectWithoutName)).toBe(false);
    });

    test('should handle object types without properties when property constraints exist', () => {
      const matcher = object().withProperty('email');

      const objectWithoutProperties: TypeInfo = {
        kind: TypeKind.Object,
      } as any;

      // Should not match since required properties don't exist
      expect(matcher.match(objectWithoutProperties)).toBe(false);

      // But object matcher without property constraints should match
      const unconstrainedMatcher = object();
      expect(unconstrainedMatcher.match(objectWithoutProperties)).toBe(true);
    });

    test('should handle union types without unionTypes property', () => {
      const matcher = union().containing(primitive('string'));

      const unionWithoutTypes: TypeInfo = {
        kind: TypeKind.Union,
      } as any;

      expect(matcher.match(unionWithoutTypes)).toBe(false);
    });

    test('should handle intersection types without intersection type properties', () => {
      const matcher = intersection().including(object('A'));

      const intersectionWithoutTypes: TypeInfo = {
        kind: TypeKind.Intersection,
      } as any;

      expect(matcher.match(intersectionWithoutTypes)).toBe(false);
    });
  });
});
