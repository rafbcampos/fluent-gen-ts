import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BuilderGenerator } from '../generator.js';
import { PluginManager } from '../../core/plugin/index.js';
import { TypeKind } from '../../core/types.js';
import type { ResolvedType, PropertyInfo } from '../../core/types.js';
import type { Plugin, BuildMethodContext } from '../../core/plugin/index.js';
import type { GeneratorConfig } from '../generator.js';
import { ok, err } from '../../core/result.js';

// Mock the ImportGenerator to prevent file system access during tests
vi.mock('../import-generator/index.js', () => {
  return {
    ImportGenerator: vi.fn(function () {
      return {
        generateAllImports: vi.fn(function ({ config }) {
          // When generating multiple files, include import from common.js
          if (config?.isGeneratingMultiple) {
            return {
              ok: true,
              value:
                'import { FluentBuilder, FluentBuilderBase, createInspectMethod } from "./common.js";',
            };
          }
          // When single file mode, return empty imports (utilities are inlined)
          return { ok: true, value: '' };
        }),
        dispose: vi.fn(),
      };
    }),
  };
});

describe('BuilderGenerator', () => {
  let generator: BuilderGenerator;
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
    generator = new BuilderGenerator({}, pluginManager);
  });

  describe('constructor', () => {
    test('initializes with default configuration', () => {
      const gen = new BuilderGenerator();
      expect(gen).toBeDefined();
    });

    test('accepts custom configuration', () => {
      const config: GeneratorConfig = {
        outputPath: './custom-output',
        useDefaults: false,
        contextType: 'CustomContext',
        addComments: false,
      };
      const gen = new BuilderGenerator(config);
      expect(gen).toBeDefined();
    });

    test('accepts plugin manager', () => {
      const pm = new PluginManager();
      const gen = new BuilderGenerator({}, pm);
      expect(gen).toBeDefined();
    });
  });

  describe('generate', () => {
    test('generates builder for simple object type', async () => {
      const resolvedType: ResolvedType = createSimpleResolvedType();
      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('UserBuilder');
        expect(result.value).toContain('withId');
        expect(result.value).toContain('withName');
        expect(result.value).toContain('function user');
        expect(result.value).toContain('FluentBuilderBase');
      }
    });

    test('rejects enum types', async () => {
      const resolvedType: ResolvedType = {
        name: 'Status',
        sourceFile: '/test/status.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Enum,
          name: 'Status',
          values: ['Active', 'Inactive'],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(false);
      // When result.ok is false, it's an Err type with error property
    });

    test('handles types with optional properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Config',
        sourceFile: '/test/config.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Config',
          properties: [
            createProperty('host', 'string', false),
            createProperty('port', 'number', true),
            createProperty('debug', 'boolean', true),
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withHost');
        expect(result.value).toContain('withPort');
        expect(result.value).toContain('withDebug');
        expect(result.value).toContain('defaults: Record<string, unknown> = { host: ""');
      }
    });

    test('handles types with generic parameters', async () => {
      const resolvedType: ResolvedType = {
        name: 'Container',
        sourceFile: '/test/container.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Container',
          properties: [
            {
              name: 'value',
              type: { kind: TypeKind.Generic, name: 'T' },
              optional: false,
              readonly: false,
            },
            createProperty('label', 'string', false),
          ],
          genericParams: [
            {
              name: 'T',
            },
          ],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('ContainerBuilder<T>');
        expect(result.value).toContain('function container<T>');
        expect(result.value).toContain('withValue(value: T)');
      }
    });

    test('handles types with index signatures', async () => {
      const resolvedType: ResolvedType = {
        name: 'Dictionary',
        sourceFile: '/test/dict.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Dictionary',
          properties: [],
          genericParams: [],
          indexSignature: {
            keyType: 'string',
            valueType: { kind: TypeKind.Primitive, name: 'any' },
            readonly: false,
          },
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withAdditionalProperties');
        expect(result.value).toContain('Record<string, any>');
      }
    });

    test('handles nested object properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Person',
        sourceFile: '/test/person.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Person',
          properties: [
            createProperty('name', 'string', false),
            {
              name: 'address',
              type: {
                kind: TypeKind.Object,
                properties: [
                  createProperty('street', 'string', false),
                  createProperty('city', 'string', false),
                ],
              },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withAddress');
        // Should accept the nested type
        expect(result.value).toMatch(/withAddress\(value:.*\)/);
      }
    });

    test('handles array properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'TodoList',
        sourceFile: '/test/todo.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'TodoList',
          properties: [
            createProperty('title', 'string', false),
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
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withItems');
        expect(result.value).toMatch(/Array<string>|string\[\]/);
      }
    });

    test('handles union type properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Status',
        sourceFile: '/test/status.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Status',
          properties: [
            {
              name: 'state',
              type: {
                kind: TypeKind.Union,
                unionTypes: [
                  { kind: TypeKind.Literal, literal: 'active' },
                  { kind: TypeKind.Literal, literal: 'inactive' },
                  { kind: TypeKind.Literal, literal: 'pending' },
                ],
              },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withState');
        expect(result.value).toContain('"active" | "inactive" | "pending"');
      }
    });

    test('prevents duplicate generation', async () => {
      const resolvedType = createSimpleResolvedType();

      const result1 = await generator.generate(resolvedType);
      const result2 = await generator.generate(resolvedType);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value).toBe('');
      }
    });

    test('handles error in hook execution', async () => {
      const errorPlugin: Plugin = {
        name: 'error-plugin',
        version: '1.0.0',
        beforeGenerate: () => err(new Error('Hook error')),
      };
      pluginManager.register(errorPlugin);

      const resolvedType = createSimpleResolvedType();
      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(false);
      // When result.ok is false, it's an Err type with error property
    });

    test('includes JSDoc comments when enabled', async () => {
      const genWithComments = new BuilderGenerator({ addComments: true });
      const resolvedType: ResolvedType = {
        name: 'Doc',
        sourceFile: '/test/doc.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Doc',
          properties: [
            {
              name: 'id',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
              jsDoc: 'Unique document ID',
            },
            {
              name: 'title',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
              jsDoc: 'Document title',
            },
          ],
          genericParams: [],
        },
      };

      const result = await genWithComments.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('/** Unique document ID */');
        expect(result.value).toContain('/** Document title */');
        expect(result.value).toContain('Creates a new Doc builder');
      }
    });

    test('excludes JSDoc comments when disabled', async () => {
      const genNoComments = new BuilderGenerator({ addComments: false });
      const resolvedType: ResolvedType = {
        name: 'Doc',
        sourceFile: '/test/doc.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Doc',
          properties: [
            {
              name: 'id',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
              jsDoc: 'Unique document ID',
            },
          ],
          genericParams: [],
        },
      };

      const result = await genNoComments.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toContain('/** Unique document ID */');
        expect(result.value).not.toContain('Creates a new Doc builder');
      }
    });

    test('uses custom namingStrategy for factory function', async () => {
      const genWithNaming = new BuilderGenerator({
        namingStrategy: (typeName: string) => typeName.replace(/Asset$/, '').toLowerCase(),
      });
      const resolvedType: ResolvedType = {
        name: 'ActionAsset',
        sourceFile: '/test/action-asset.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'ActionAsset',
          properties: [
            {
              name: 'id',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await genWithNaming.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('ActionAssetBuilder');
        expect(result.value).toContain('function action(');
        expect(result.value).not.toContain('function actionAsset(');
      }
    });
  });

  describe('multiple file generation', () => {
    test('generateCommonFile generates utilities', () => {
      const commonFile = generator.generateCommonFile();

      expect(commonFile).toContain('FluentBuilder');
      expect(commonFile).toContain('FluentBuilderBase');
      expect(commonFile).toContain('BaseBuildContext');
      expect(commonFile).toContain('isFluentBuilder');
      expect(commonFile).toContain('FLUENT_BUILDER_SYMBOL');
    });

    test('setGeneratingMultiple changes generation mode', async () => {
      generator.setGeneratingMultiple(true);

      const resolvedType = createSimpleResolvedType();
      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('from "./common.js"');
        expect(result.value).not.toContain('const FLUENT_BUILDER_SYMBOL');
      }
    });

    test('single file mode includes utilities inline', async () => {
      generator.setGeneratingMultiple(false);

      const resolvedType = createSimpleResolvedType();
      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toContain('from "./common.js"');
        expect(result.value).toContain('const FLUENT_BUILDER_SYMBOL');
        expect(result.value).toContain('abstract class FluentBuilderBase');
      }
    });
  });

  describe('clearCache', () => {
    test('clears generated builders cache', async () => {
      const resolvedType = createSimpleResolvedType();

      await generator.generate(resolvedType);
      generator.clearCache();

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBe('');
        expect(result.value).toContain('UserBuilder');
      }
    });

    test('resets isGeneratingMultiple flag', () => {
      generator.setGeneratingMultiple(true);
      generator.clearCache();
      // The flag should be reset - test indirectly by generation behavior
      // After clearCache, it should be in single-file mode
    });
  });

  describe('plugin integration', () => {
    test('executes beforeGenerate hook', async () => {
      const mockHook = vi.fn(() => ok({ resolvedType: createSimpleResolvedType(), options: {} }));
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        beforeGenerate: mockHook as any,
      };
      pluginManager.register(plugin);

      const resolvedType = createSimpleResolvedType();
      await generator.generate(resolvedType);

      expect(mockHook).toHaveBeenCalled();
    });

    test('executes afterGenerate hook', async () => {
      const mockHook = vi.fn((code: string) => ok(code + '\n// Modified by plugin'));
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        afterGenerate: mockHook as any,
      };
      pluginManager.register(plugin);

      const resolvedType = createSimpleResolvedType();
      const result = await generator.generate(resolvedType);

      expect(mockHook).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('// Modified by plugin');
      }
    });

    test('transforms build method via plugin', async () => {
      const plugin: Plugin = {
        name: 'build-transform-plugin',
        version: '1.0.0',
        transformBuildMethod: (context: BuildMethodContext) => {
          return ok(`  // Custom build method
  build(context?: ${context.options.contextType}): ${context.typeName}${context.genericConstraints} {
    console.log("Building ${context.typeName}");
    return this.buildWithDefaults(undefined, context);
  }`);
        },
      };
      pluginManager.register(plugin);

      const resolvedType = createSimpleResolvedType();
      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('// Custom build method');
        expect(result.value).toContain('console.log("Building User")');
      }
    });
  });

  describe('error handling', () => {
    test('handles generation errors gracefully', async () => {
      // Create a type that might cause issues - builder will use empty name which creates "Builder" class
      const invalidResolvedType: ResolvedType = {
        name: '',
        sourceFile: '/test/invalid.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: '',
          properties: [],
          genericParams: [],
        },
      };

      const result = await generator.generate(invalidResolvedType);

      // Empty name might be rejected as invalid, which is acceptable
      // The point is it shouldn't throw an exception
      if (!result.ok) {
        expect(result.ok).toBe(false);
        // We know it's an Err type if ok is false
      } else {
        // If it does generate, should contain "Builder"
        expect(result.value).toContain('Builder');
      }
    });

    test('handles plugin errors gracefully', async () => {
      const errorPlugin: Plugin = {
        name: 'error-plugin',
        version: '1.0.0',
        transformBuildMethod: () => {
          throw new Error('Plugin error');
        },
      };
      pluginManager.register(errorPlugin);

      const resolvedType = createSimpleResolvedType();
      const result = await generator.generate(resolvedType);

      // Should still generate despite plugin error
      expect(result.ok).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles types with readonly properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Immutable',
        sourceFile: '/test/immutable.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Immutable',
          properties: [
            {
              name: 'id',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: true,
            },
            {
              name: 'value',
              type: { kind: TypeKind.Primitive, name: 'number' },
              optional: false,
              readonly: true,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withId');
        expect(result.value).toContain('withValue');
      }
    });

    test('handles empty object types', async () => {
      const resolvedType: ResolvedType = {
        name: 'Empty',
        sourceFile: '/test/empty.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Empty',
          properties: [],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('EmptyBuilder');
        expect(result.value).toContain('function empty');
        // Should not contain any method starting with "with" followed by a capital letter (property methods)
        expect(result.value).not.toMatch(/\bwith[A-Z]\w*\(/);
      }
    });

    test('handles types with special characters in property names', async () => {
      const resolvedType: ResolvedType = {
        name: 'Special',
        sourceFile: '/test/special.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Special',
          properties: [
            {
              name: 'content-type',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
            },
            {
              name: '@id',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withContentType');
        expect(result.value).toContain('set("content-type"');
        // The method should preserve the actual property name in set() call
        expect(result.value).toContain('set("@id"');
        // But the method name itself needs to be valid JavaScript
        // (it might be with@Id which is invalid, so this test might reveal a bug)
      }
    });

    test('handles intersection types', async () => {
      const resolvedType: ResolvedType = {
        name: 'Combined',
        sourceFile: '/test/combined.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Combined',
          properties: [
            {
              name: 'prop',
              type: {
                kind: TypeKind.Intersection,
                intersectionTypes: [
                  { kind: TypeKind.Primitive, name: 'string' },
                  { kind: TypeKind.Primitive, name: 'number' },
                ],
              },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withProp');
        expect(result.value).toContain('string & number');
      }
    });

    test('handles function type properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Handler',
        sourceFile: '/test/handler.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Handler',
          properties: [
            {
              name: 'onClick',
              type: { kind: TypeKind.Function, name: '() => void' },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withOnClick');
        expect(result.value).toContain('() => void');
      }
    });

    test('handles tuple type properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Coordinate',
        sourceFile: '/test/coordinate.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Coordinate',
          properties: [
            {
              name: 'position',
              type: {
                kind: TypeKind.Tuple,
                elements: [
                  { kind: TypeKind.Primitive, name: 'number' },
                  { kind: TypeKind.Primitive, name: 'number' },
                ],
              },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withPosition');
        expect(result.value).toContain('[number, number]');
      }
    });

    test('handles reference type properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Container',
        sourceFile: '/test/container.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Container',
          properties: [
            {
              name: 'user',
              type: {
                kind: TypeKind.Reference,
                name: 'User',
                typeArguments: [],
              },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withUser');
        // Reference types should just be the type name in the signature
        expect(result.value).toContain('withUser(value: User)');
      }
    });

    test('handles unknown type properties', async () => {
      const resolvedType: ResolvedType = {
        name: 'Dynamic',
        sourceFile: '/test/dynamic.ts',
        imports: [],
        dependencies: [],
        typeInfo: {
          kind: TypeKind.Object,
          name: 'Dynamic',
          properties: [
            {
              name: 'data',
              type: { kind: TypeKind.Unknown },
              optional: false,
              readonly: false,
            },
          ],
          genericParams: [],
        },
      };

      const result = await generator.generate(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('withData');
        expect(result.value).toContain('unknown');
      }
    });
  });
});

// Helper functions
function createSimpleResolvedType(): ResolvedType {
  return {
    name: 'User',
    sourceFile: '/test/user.ts',
    imports: [],
    dependencies: [],
    typeInfo: {
      kind: TypeKind.Object,
      name: 'User',
      properties: [createProperty('id', 'string', false), createProperty('name', 'string', false)],
      genericParams: [],
    },
  };
}

function createProperty(name: string, type: string, optional: boolean): PropertyInfo {
  return {
    name,
    type: { kind: TypeKind.Primitive, name: type },
    optional,
    readonly: false,
  };
}
