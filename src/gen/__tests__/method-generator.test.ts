import { test, expect, describe, beforeEach } from 'vitest';
import { MethodGenerator, type MethodGeneratorConfig } from '../method-generator.js';
import { TypeKind, type TypeInfo, type GenericParam } from '../../core/types.js';
import { PluginManager } from '../../core/plugin/index.js';
import type {
  PropertyMethodContext,
  CustomMethod,
  BuilderContext,
} from '../../core/plugin/index.js';
import { ok } from '../../core/result.js';

describe('MethodGenerator', () => {
  let methodGenerator: MethodGenerator;
  let baseConfig: MethodGeneratorConfig;

  beforeEach(() => {
    methodGenerator = new MethodGenerator();
    baseConfig = {
      addComments: true,
      contextType: 'BaseBuildContext',
    };
  });

  describe('generateBuilderInterface', () => {
    test('generates interface for simple object type', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
            jsDoc: 'Unique identifier',
          },
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateBuilderInterface('User', typeInfo, baseConfig);

      expect(result).toContain('export interface UserBuilderMethods');
      expect(result).toContain('withId(value: string): UserBuilder');
      expect(result).toContain('withName(value: string): UserBuilder');
      expect(result).toContain('/** Unique identifier */');
    });

    test('generates interface with generics', async () => {
      const genericParams: GenericParam[] = [
        {
          name: 'T',
          constraint: { kind: TypeKind.Primitive, name: 'string' },
        },
        {
          name: 'U',
          default: { kind: TypeKind.Primitive, name: 'number' },
        },
      ];

      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'ApiResponse',
        genericParams,
        properties: [
          {
            name: 'data',
            type: { kind: TypeKind.Generic, name: 'T' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateBuilderInterface(
        'ApiResponse',
        typeInfo,
        baseConfig,
      );

      expect(result).toContain(
        'export interface ApiResponseBuilderMethods<T extends string, U = number>',
      );
      expect(result).toContain('withData(value: T): ApiResponseBuilder<T, U>');
    });

    test('handles nested object types with builder support', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'address',
            type: {
              kind: TypeKind.Object,
              name: 'Address',
              properties: [],
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateBuilderInterface('User', typeInfo, baseConfig);

      expect(result).toContain(
        'withAddress(value: Address | FluentBuilder<Address, BaseBuildContext>): UserBuilder',
      );
    });

    test('returns empty interface for non-object types', async () => {
      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const result = await methodGenerator.generateBuilderInterface(
        'StringType',
        primitiveType,
        baseConfig,
      );

      expect(result).toContain('export interface StringTypeBuilderMethods');
      expect(result).not.toContain('with');
    });

    test('omits JSDoc when addComments is false', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
            jsDoc: 'Unique identifier',
          },
        ],
      };

      const config = { ...baseConfig, addComments: false };
      const result = await methodGenerator.generateBuilderInterface('User', typeInfo, config);

      expect(result).not.toContain('/** Unique identifier */');
      expect(result).toContain('withId(value: string): UserBuilder');
    });
  });

  describe('generateClassMethods', () => {
    test('generates class methods for simple object', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
            jsDoc: 'User ID',
          },
        ],
      };

      const result = await methodGenerator.generateClassMethods(
        typeInfo,
        'UserBuilder',
        '',
        baseConfig,
        'User',
      );

      expect(result).toContain('withId(value: string): UserBuilder');
      expect(result).toContain('return this.set("id", value);');
      expect(result).toContain('/** User ID */');
    });

    test('generates index signature method when present', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'DynamicObject',
        properties: [],
        indexSignature: {
          keyType: 'string',
          valueType: { kind: TypeKind.Primitive, name: 'any' },
        },
      };

      const result = await methodGenerator.generateClassMethods(
        typeInfo,
        'DynamicObjectBuilder',
        '',
        baseConfig,
        'DynamicObject',
      );

      expect(result).toContain(
        'withAdditionalProperties(props: Record<string, any>): DynamicObjectBuilder',
      );
      expect(result).toContain('Object.assign(this.values, props);');
    });

    test('returns empty string for non-object types', async () => {
      const primitiveType: TypeInfo = {
        kind: TypeKind.Primitive,
        name: 'string',
      };

      const result = await methodGenerator.generateClassMethods(
        primitiveType,
        'StringBuilder',
        '',
        baseConfig,
        'String',
      );

      expect(result).toBe('');
    });

    test('handles generic constraints correctly', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Container',
        properties: [
          {
            name: 'value',
            type: { kind: TypeKind.Generic, name: 'T' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateClassMethods(
        typeInfo,
        'ContainerBuilder',
        '<T extends string>',
        baseConfig,
        'Container',
      );

      expect(result).toContain('withValue(value: T): ContainerBuilder<T extends string>');
    });
  });

  describe('generateBuildMethod', () => {
    test('generates build method for object type', () => {
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

      const result = methodGenerator.generateBuildMethod('User', typeInfo, baseConfig);

      expect(result).toContain('build(context?: BaseBuildContext): User');
      expect(result).toContain('return this.buildWithDefaults(UserBuilder.defaults, context);');
      expect(result).toContain('Builds the final User object');
    });

    test('uses custom context type', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      const config = { ...baseConfig, contextType: 'CustomContext' };
      const result = methodGenerator.generateBuildMethod('User', typeInfo, config);

      expect(result).toContain('build(context?: CustomContext): User');
    });

    test('handles generic types', () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'Container',
        genericParams: [{ name: 'T' }],
        properties: [],
      };

      const result = methodGenerator.generateBuildMethod('Container', typeInfo, baseConfig);

      expect(result).toContain('build(context?: BaseBuildContext): Container<T>');
    });
  });

  describe('edge cases and special characters', () => {
    test('handles kebab-case property names', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'HttpHeader',
        properties: [
          {
            name: 'accept-encoding',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'content-type',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateClassMethods(
        typeInfo,
        'HttpHeaderBuilder',
        '',
        baseConfig,
        'HttpHeader',
      );

      expect(result).toContain('withAcceptEncoding(value: string)');
      expect(result).toContain('withContentType(value: string)');
      expect(result).toContain('return this.set("accept-encoding", value);');
      expect(result).toContain('return this.set("content-type", value);');
    });

    test('handles reserved keywords as property names', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'ReservedProps',
        properties: [
          {
            name: 'class',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'function',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateClassMethods(
        typeInfo,
        'ReservedPropsBuilder',
        '',
        baseConfig,
        'ReservedProps',
      );

      expect(result).toContain('withClass(value: string)');
      expect(result).toContain('withFunction(value: string)');
      expect(result).toContain('return this.set("class", value);');
      expect(result).toContain('return this.set("function", value);');
    });

    test('handles complex union types', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'StatusObject',
        properties: [
          {
            name: 'status',
            type: {
              kind: TypeKind.Union,
              unionTypes: [
                { kind: TypeKind.Literal, literal: 'active' },
                { kind: TypeKind.Literal, literal: 'inactive' },
                { kind: TypeKind.Primitive, name: 'undefined' },
              ],
            },
            optional: true,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateBuilderInterface(
        'StatusObject',
        typeInfo,
        baseConfig,
      );

      expect(result).toContain('withStatus(value: "active" | "inactive"): StatusObjectBuilder');
    });

    test('handles array types', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'ListContainer',
        properties: [
          {
            name: 'items',
            type: {
              kind: TypeKind.Array,
              elementType: { kind: TypeKind.Primitive, name: 'string' },
            },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateBuilderInterface(
        'ListContainer',
        typeInfo,
        baseConfig,
      );

      expect(result).toContain('withItems(value: Array<string>): ListContainerBuilder');
    });
  });

  describe('plugin integration', () => {
    test('applies plugin transformations to method signatures', async () => {
      const pluginManager = new PluginManager();

      // Mock plugin that transforms string parameters to uppercase
      const mockPlugin = {
        name: 'uppercase-transform',
        version: '1.0.0',
        transformPropertyMethod: (context: PropertyMethodContext) => {
          if (context.property.name === 'name') {
            return ok({
              parameterType: 'UppercaseString',
              extractValue: 'value.toUpperCase()',
            });
          }
          return ok({});
        },
      };

      pluginManager.register(mockPlugin);

      const config = { ...baseConfig, pluginManager };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const interfaceResult = await methodGenerator.generateBuilderInterface(
        'User',
        typeInfo,
        config,
      );

      const classResult = await methodGenerator.generateClassMethods(
        typeInfo,
        'UserBuilder',
        '',
        config,
        'User',
      );

      expect(interfaceResult).toContain('withName(value: UppercaseString): UserBuilder');
      expect(classResult).toContain('const extractedValue = value.toUpperCase();');
      expect(classResult).toContain('return this.set("name", extractedValue);');
    });

    test('includes custom methods from plugins', async () => {
      const pluginManager = new PluginManager();

      const mockPlugin = {
        name: 'custom-methods',
        version: '1.0.0',
        addCustomMethods: (_context: BuilderContext) => {
          const customMethods: CustomMethod[] = [
            {
              name: 'reset',
              signature: '()',
              implementation: 'this.values = {}; return this;',
              jsDoc: '/** Resets all values */',
            },
          ];
          return ok(customMethods);
        },
      };

      pluginManager.register(mockPlugin);

      const config = { ...baseConfig, pluginManager };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      const result = await methodGenerator.generateBuilderInterface('User', typeInfo, config);

      expect(result).toContain('/** Resets all values */');
      expect(result).toContain('reset(): UserBuilder');
    });
  });

  describe('error handling and validation', () => {
    test('throws error for empty type name', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      await expect(async () => {
        await methodGenerator.generateBuilderInterface('', typeInfo, baseConfig);
      }).rejects.toThrow('Type name must be a non-empty string');

      await expect(async () => {
        await methodGenerator.generateBuilderInterface('   ', typeInfo, baseConfig);
      }).rejects.toThrow('Type name must be a non-empty string');
    });

    test('throws error for null/undefined type name', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      await expect(async () => {
        await methodGenerator.generateBuilderInterface(null as any, typeInfo, baseConfig);
      }).rejects.toThrow('Type name must be a non-empty string');

      await expect(async () => {
        await methodGenerator.generateBuilderInterface(undefined as any, typeInfo, baseConfig);
      }).rejects.toThrow('Type name must be a non-empty string');
    });

    test('throws error for non-string type name', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [],
      };

      await expect(async () => {
        await methodGenerator.generateBuilderInterface(123 as any, typeInfo, baseConfig);
      }).rejects.toThrow('Type name must be a non-empty string');
    });

    test('handles malformed property gracefully', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'validProperty',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: '',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      // Should not throw, but should skip the invalid property
      const result = await methodGenerator.generateClassMethods(
        typeInfo,
        'UserBuilder',
        '',
        baseConfig,
        'User',
      );

      expect(result).toContain('withValidProperty');
      expect(result).not.toContain('with(');
    });

    test('validates object type structure', async () => {
      const malformedTypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        // missing properties for testing - this will cause a runtime error which we're testing
      } as TypeInfo;

      await expect(async () => {
        await methodGenerator.generateClassMethods(
          malformedTypeInfo,
          'UserBuilder',
          '',
          baseConfig,
          'User',
        );
      }).rejects.toThrow('Object type must have properties array');
    });

    test('handles plugin errors gracefully', async () => {
      const pluginManager = new PluginManager();

      // Mock plugin that throws errors
      const errorPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        transformPropertyMethod: () => {
          throw new Error('Plugin error');
        },
      };

      pluginManager.register(errorPlugin);

      const config = { ...baseConfig, pluginManager };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'name',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      // Should not throw, but should handle plugin errors gracefully
      const interfaceResult = await methodGenerator.generateBuilderInterface(
        'User',
        typeInfo,
        config,
      );

      const classResult = await methodGenerator.generateClassMethods(
        typeInfo,
        'UserBuilder',
        '',
        config,
        'User',
      );

      expect(interfaceResult).toContain('withName');
      expect(classResult).toContain('withName');
    });

    test('handles malformed plugin transform objects safely', async () => {
      const pluginManager = new PluginManager();

      // Mock plugin that returns malformed transforms
      const malformedPlugin = {
        name: 'malformed-plugin',
        version: '1.0.0',
        transformPropertyMethod: (context: PropertyMethodContext) => {
          // Return malformed objects to test safety
          if (context.property.name === 'test1') {
            return ok(null as any); // null transform
          }
          if (context.property.name === 'test2') {
            return ok(undefined as any); // undefined transform
          }
          if (context.property.name === 'test3') {
            return ok('not an object' as any); // string instead of object
          }
          if (context.property.name === 'test4') {
            return ok({
              parameterType: 123, // number instead of string
              extractValue: null, // null instead of string
              validate: '', // empty string should be ignored
            } as any);
          }
          return ok({});
        },
      };

      pluginManager.register(malformedPlugin);

      const config = { ...baseConfig, pluginManager };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'TestObject',
        properties: [
          {
            name: 'test1',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'test2',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'test3',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'test4',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      // Should not throw, but should handle malformed plugin transforms gracefully
      const interfaceResult = await methodGenerator.generateBuilderInterface(
        'TestObject',
        typeInfo,
        config,
      );

      const classResult = await methodGenerator.generateClassMethods(
        typeInfo,
        'TestObjectBuilder',
        '',
        config,
        'TestObject',
      );

      // All methods should be generated with fallback to original types
      expect(interfaceResult).toContain('withTest1(value: string)');
      expect(interfaceResult).toContain('withTest2(value: string)');
      expect(interfaceResult).toContain('withTest3(value: string)');
      expect(interfaceResult).toContain('withTest4(value: string)');
      expect(classResult).toContain('withTest1');
      expect(classResult).toContain('withTest2');
      expect(classResult).toContain('withTest3');
      expect(classResult).toContain('withTest4');
    });
  });

  describe('type safety and validation', () => {
    test('handles empty properties array', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'EmptyObject',
        properties: [],
      };

      const result = await methodGenerator.generateBuilderInterface(
        'EmptyObject',
        typeInfo,
        baseConfig,
      );

      expect(result).toContain('export interface EmptyObjectBuilderMethods');
      expect(result).not.toContain('with');
    });

    test('handles missing optional properties', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'User',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
            // jsDoc is optional and missing
          },
        ],
      };

      const result = await methodGenerator.generateBuilderInterface('User', typeInfo, baseConfig);

      expect(result).toContain('withId(value: string): UserBuilder');
      expect(result).not.toContain('/** */'); // No empty JSDoc
    });

    test('handles readonly properties', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'ImmutableUser',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: true,
          },
        ],
      };

      const result = await methodGenerator.generateBuilderInterface(
        'ImmutableUser',
        typeInfo,
        baseConfig,
      );

      // Should still generate methods for readonly properties in builders
      expect(result).toContain('withId(value: string): ImmutableUserBuilder');
    });

    test('skips properties with never type', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'MixedObject',
        properties: [
          {
            name: 'validProperty',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          {
            name: 'neverProperty',
            type: { kind: TypeKind.Never },
            optional: false,
            readonly: false,
          },
        ],
      };

      const interfaceResult = await methodGenerator.generateBuilderInterface(
        'MixedObject',
        typeInfo,
        baseConfig,
      );

      const classResult = await methodGenerator.generateClassMethods(
        typeInfo,
        'MixedObjectBuilder',
        '',
        baseConfig,
        'MixedObject',
      );

      // Should only generate method for valid property, not never type
      expect(interfaceResult).toContain('withValidProperty(value: string)');
      expect(interfaceResult).not.toContain('withNeverProperty');
      expect(classResult).toContain('withValidProperty');
      expect(classResult).not.toContain('withNeverProperty');
    });
  });

  describe('index signature handling', () => {
    test('handles different key types', async () => {
      const stringKeyType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'StringMap',
        properties: [],
        indexSignature: {
          keyType: 'string',
          valueType: { kind: TypeKind.Primitive, name: 'number' },
        },
      };

      const numberKeyType: TypeInfo = {
        kind: TypeKind.Object,
        name: 'NumberMap',
        properties: [],
        indexSignature: {
          keyType: 'number',
          valueType: { kind: TypeKind.Primitive, name: 'string' },
        },
      };

      const stringResult = await methodGenerator.generateClassMethods(
        stringKeyType,
        'StringMapBuilder',
        '',
        baseConfig,
        'StringMap',
      );

      const numberResult = await methodGenerator.generateClassMethods(
        numberKeyType,
        'NumberMapBuilder',
        '',
        baseConfig,
        'NumberMap',
      );

      expect(stringResult).toContain('withAdditionalProperties(props: Record<string, number>)');
      expect(numberResult).toContain('withAdditionalProperties(props: Record<number, string>)');
    });

    test('skips index signature method when not present', async () => {
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: 'RegularObject',
        properties: [
          {
            name: 'id',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
        ],
      };

      const result = await methodGenerator.generateClassMethods(
        typeInfo,
        'RegularObjectBuilder',
        '',
        baseConfig,
        'RegularObject',
      );

      expect(result).not.toContain('withAdditionalProperties');
    });
  });
});
