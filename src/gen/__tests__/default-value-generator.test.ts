import { test, expect, describe, beforeEach } from 'vitest';
import { DefaultValueGenerator, type DefaultGeneratorConfig } from '../default-value-generator.js';
import { TypeKind, type TypeInfo } from '../../core/types.js';

describe('DefaultValueGenerator', () => {
  let generator: DefaultValueGenerator;

  beforeEach(() => {
    generator = new DefaultValueGenerator();
  });

  describe('generateDefaultsObject', () => {
    test('returns null when useDefaults is false', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Test',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };
      const config: DefaultGeneratorConfig = { useDefaults: false };

      const result = generator.generateDefaultsObject({ typeInfo, config });
      expect(result).toBeNull();
    });

    test('returns null for non-object types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };
      const config: DefaultGeneratorConfig = { useDefaults: true };

      const result = generator.generateDefaultsObject({ typeInfo, config });
      expect(result).toBeNull();
    });

    test('generates defaults for required properties only', () => {
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
          {
            name: 'name',
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
      const config: DefaultGeneratorConfig = { useDefaults: true };

      const result = generator.generateDefaultsObject({ typeInfo, config });
      expect(result).toBe('{ id: "", name: "" }');
    });

    test('handles circular references by detecting type key', () => {
      const circularType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Node',
        properties: [],
      };
      // Add self-reference after creation
      (circularType as any).properties = [
        {
          name: 'value',
          type: { kind: TypeKind.Primitive, name: 'string' },
          optional: false,
          readonly: false,
        },
        {
          name: 'next',
          type: circularType,
          optional: false,
          readonly: false,
        },
      ];
      const config: DefaultGeneratorConfig = { useDefaults: true };

      const result = generator.generateDefaultsObject({
        typeInfo: circularType,
        config,
      });
      // Should detect circular reference and stop recursion
      expect(result).toBe('{ value: "", next: {} }');
    });

    test('respects max depth', () => {
      const deepType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Level1',
        properties: [
          {
            name: 'level2',
            type: {
              kind: TypeKind.Object,
              name: 'Level2',
              properties: [
                {
                  name: 'level3',
                  type: {
                    kind: TypeKind.Object,
                    name: 'Level3',
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
            },
            optional: false,
            readonly: false,
          },
        ],
      };
      const config: DefaultGeneratorConfig = { useDefaults: true, maxDepth: 2 };

      const result = generator.generateDefaultsObject({
        typeInfo: deepType,
        config,
      });
      expect(result).toBe('{ level2: { level3: {} } }');
    });

    test('handles property names with special characters', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Config',
        properties: [
          {
            name: 'api-key',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'max-retries',
            type: { kind: TypeKind.Primitive, name: 'number' },
            optional: false,
            readonly: false,
          },
        ],
      };
      const config: DefaultGeneratorConfig = { useDefaults: true };

      const result = generator.generateDefaultsObject({ typeInfo, config });
      expect(result).toBe('{ ["api-key"]: "", ["max-retries"]: 0 }');
    });

    test('returns null for empty object', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Empty',
        properties: [],
      };
      const config: DefaultGeneratorConfig = { useDefaults: true };

      const result = generator.generateDefaultsObject({ typeInfo, config });
      expect(result).toBeNull();
    });
  });

  describe('getDefaultValueForType', () => {
    describe('Primitive types', () => {
      test('generates correct defaults for primitive types', () => {
        const primitives: Array<[string, string]> = [
          ['string', '""'],
          ['number', '0'],
          ['boolean', 'false'],
          ['bigint', 'BigInt(0)'],
          ['symbol', 'Symbol()'],
          ['undefined', 'undefined'],
          ['null', 'null'],
          ['void', 'undefined'],
          ['never', 'undefined'],
          ['any', 'undefined'],
          ['unknown', 'undefined'],
        ];

        primitives.forEach(([name, expected]) => {
          const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name };
          const result = generator.getDefaultValueForType({ typeInfo });
          expect(result).toBe(expected);
        });
      });

      test('uses custom defaults when provided', () => {
        const typeInfo: TypeInfo = { kind: TypeKind.Primitive, name: 'string' };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          customDefaults: new Map([['string', () => '"custom"']]),
        };

        const result = generator.getDefaultValueForType({ typeInfo, config });
        expect(result).toBe('"custom"');
      });
    });

    describe('Array types', () => {
      test('generates array with default element for primitive types by default', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'string' },
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        // Default behavior includes a default element for primitives
        expect(result).toBe('[""]');
      });

      test('generates array with default element for primitives', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'number' },
        };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          maxDepth: 5,
        };

        const result = generator.getDefaultValueForType({
          typeInfo,
          config,
          depth: 0,
        });
        expect(result).toBe('[0]');
      });

      test('generates empty array for complex element types', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Array,
          elementType: {
            kind: TypeKind.Object,
            name: 'Item',
            properties: [],
          },
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('[]');
      });

      test('respects max depth for arrays', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'string' },
        };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          maxDepth: 2,
        };

        const result = generator.getDefaultValueForType({
          typeInfo,
          config,
          depth: 5,
        });
        expect(result).toBe('[]');
      });
    });

    describe('Function types', () => {
      test('generates arrow function returning undefined', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Function,
          name: 'callback',
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('() => undefined');
      });
    });

    describe('Literal types', () => {
      test('handles string literals', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Literal,
          literal: 'hello',
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('"hello"');
      });

      test('handles number literals', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Literal,
          literal: 42,
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('42');
      });

      test('handles boolean literals', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Literal,
          literal: true,
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('true');
      });
    });

    describe('Union types', () => {
      test('picks first non-undefined type', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Primitive, name: 'undefined' },
            { kind: TypeKind.Primitive, name: 'string' },
            { kind: TypeKind.Primitive, name: 'number' },
          ],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('""');
      });

      test('returns undefined if all types are undefined', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
          unionTypes: [{ kind: TypeKind.Primitive, name: 'undefined' }],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });

      test('handles empty union', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Union,
          unionTypes: [],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });
    });

    describe('Object types', () => {
      test('generates nested object defaults', () => {
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
            {
              name: 'active',
              type: { kind: TypeKind.Primitive, name: 'boolean' },
              optional: false,
              readonly: false,
            },
          ],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('{ id: "", active: false }');
      });

      test('generates empty object for object with no required properties', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Object,
          name: 'Options',
          properties: [
            {
              name: 'flag',
              type: { kind: TypeKind.Primitive, name: 'boolean' },
              optional: true,
              readonly: false,
            },
          ],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('{}');
      });

      test('handles object at max depth', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Object,
          name: 'Deep',
          properties: [
            {
              name: 'value',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
            },
          ],
        };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          maxDepth: 1,
        };

        const result = generator.getDefaultValueForType({
          typeInfo,
          config,
          depth: 5,
        });
        expect(result).toBe('{}');
      });
    });

    describe('Reference types', () => {
      test('returns empty object for references', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Reference,
          name: 'SomeType',
          typeArguments: [],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('{}');
      });
    });

    describe('Generic types', () => {
      test('returns undefined for generic types', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Generic,
          name: 'T',
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });
    });

    describe('Tuple types', () => {
      test('generates tuple with default elements', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Tuple,
          elements: [
            { kind: TypeKind.Primitive, name: 'string' },
            { kind: TypeKind.Primitive, name: 'number' },
            { kind: TypeKind.Primitive, name: 'boolean' },
          ],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('["", 0, false]');
      });

      test('generates empty array at max depth', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Tuple,
          elements: [
            { kind: TypeKind.Primitive, name: 'string' },
            { kind: TypeKind.Primitive, name: 'number' },
          ],
        };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          maxDepth: 2,
        };

        const result = generator.getDefaultValueForType({
          typeInfo,
          config,
          depth: 5,
        });
        expect(result).toBe('[]');
      });
    });

    describe('Intersection types', () => {
      test('merges defaults from intersection types', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Intersection,
          intersectionTypes: [
            {
              kind: TypeKind.Object,
              name: 'A',
              properties: [
                {
                  name: 'a',
                  type: { kind: TypeKind.Primitive, name: 'string' },
                  optional: false,
                  readonly: false,
                },
              ],
            },
            {
              kind: TypeKind.Object,
              name: 'B',
              properties: [
                {
                  name: 'b',
                  type: { kind: TypeKind.Primitive, name: 'number' },
                  optional: false,
                  readonly: false,
                },
              ],
            },
          ],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('{ a: "", b: 0 }');
      });

      test('handles overlapping properties in intersection', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Intersection,
          intersectionTypes: [
            {
              kind: TypeKind.Object,
              name: 'A',
              properties: [
                {
                  name: 'value',
                  type: { kind: TypeKind.Primitive, name: 'string' },
                  optional: false,
                  readonly: false,
                },
              ],
            },
            {
              kind: TypeKind.Object,
              name: 'B',
              properties: [
                {
                  name: 'value',
                  type: { kind: TypeKind.Primitive, name: 'number' },
                  optional: false,
                  readonly: false,
                },
              ],
            },
          ],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        // Last one wins in the current implementation
        expect(result).toBe('{ value: 0 }');
      });

      test('returns empty object for empty intersection', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Intersection,
          intersectionTypes: [],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('{}');
      });

      test('handles intersection at max depth', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Intersection,
          intersectionTypes: [
            {
              kind: TypeKind.Object,
              name: 'A',
              properties: [
                {
                  name: 'a',
                  type: { kind: TypeKind.Primitive, name: 'string' },
                  optional: false,
                  readonly: false,
                },
              ],
            },
          ],
        };
        const config: DefaultGeneratorConfig = {
          useDefaults: true,
          maxDepth: 1,
        };

        const result = generator.getDefaultValueForType({
          typeInfo,
          config,
          depth: 5,
        });
        expect(result).toBe('{}');
      });
    });

    describe('Enum types', () => {
      test('returns first enum value', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Enum,
          name: 'Color',
          values: ['red', 'green', 'blue'],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('"red"');
      });

      test('handles numeric enum values', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Enum,
          name: 'Priority',
          values: [0, 1, 2],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('0');
      });

      test('returns undefined for empty enum', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Enum,
          name: 'Empty',
          values: [],
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });

      test('returns undefined for enum without values', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Enum,
          name: 'NoValues',
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });
    });

    describe('Unknown type', () => {
      test('returns undefined for unknown type', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Unknown,
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });
    });

    describe('Unhandled TypeKind cases', () => {
      test('returns undefined for Keyof type', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Keyof,
          target: { kind: TypeKind.Object, name: 'Test', properties: [] },
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });

      test('returns undefined for Typeof type', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Typeof,
          target: { kind: TypeKind.Primitive, name: 'string' },
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });

      test('returns undefined for Index type', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Index,
          object: { kind: TypeKind.Object, name: 'Test', properties: [] },
          index: { kind: TypeKind.Literal, literal: 'prop' },
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });

      test('returns undefined for Conditional type', () => {
        const typeInfo: TypeInfo = {
          kind: TypeKind.Conditional,
          checkType: { kind: TypeKind.Generic, name: 'T' },
          extendsType: { kind: TypeKind.Primitive, name: 'string' },
          trueType: { kind: TypeKind.Primitive, name: 'number' },
          falseType: { kind: TypeKind.Primitive, name: 'boolean' },
        };

        const result = generator.getDefaultValueForType({ typeInfo });
        expect(result).toBe('undefined');
      });
    });
  });
});
