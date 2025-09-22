import { test, expect, describe, beforeEach } from 'vitest';
import { Project, type Type } from 'ts-morph';
import {
  PluginManager,
  HookType,
  type Plugin,
  type ParseContext,
  type PropertyMethodContext,
  type BuilderContext,
  type CustomMethod,
  type ValueContext,
  type ValueTransform,
  type ImportTransformContext,
} from '../plugin.js';
import { ok, err } from '../result.js';
import { TypeKind, type TypeInfo } from '../types.js';

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let project: Project;

  beforeEach(() => {
    pluginManager = new PluginManager();
    project = new Project();
  });

  describe('constructor', () => {
    test('creates empty plugin manager', () => {
      const manager = new PluginManager();
      expect(manager.getPlugins()).toHaveLength(0);
    });
  });

  describe('plugin registration', () => {
    const validPlugin: Plugin = {
      name: 'test-plugin',
      version: '1.0.0',
    };

    test('registers valid plugin', () => {
      pluginManager.register(validPlugin);
      expect(pluginManager.getPlugins()).toHaveLength(1);
      expect(pluginManager.getPlugins()[0]).toBe(validPlugin);
    });

    test('throws error when registering duplicate plugin', () => {
      pluginManager.register(validPlugin);
      expect(() => pluginManager.register(validPlugin)).toThrow(
        'Plugin test-plugin is already registered',
      );
    });

    test('throws error for invalid plugin - missing name', () => {
      const invalidPlugin = { version: '1.0.0' } as unknown as Plugin;
      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin must have a non-empty 'name' property",
      );
    });

    test('throws error for invalid plugin - empty name', () => {
      const invalidPlugin = { name: '', version: '1.0.0' } as Plugin;
      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin must have a non-empty 'name' property",
      );
    });

    test('throws error for invalid plugin - missing version', () => {
      const invalidPlugin = { name: 'test' } as unknown as Plugin;
      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin must have a non-empty 'version' property",
      );
    });

    test('throws error for invalid plugin - non-function hook', () => {
      const invalidPlugin = {
        name: 'test',
        version: '1.0.0',
        beforeParse: 'not a function',
      } as unknown as Plugin;
      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin hook 'beforeParse' must be a function if provided",
      );
    });

    test('throws error for invalid plugin - invalid imports structure', () => {
      const invalidPlugin = {
        name: 'test',
        version: '1.0.0',
        imports: 'not an object',
      } as unknown as Plugin;
      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin 'imports' must be an object if provided",
      );
    });

    test('throws error for invalid plugin - invalid runtime imports', () => {
      const invalidPlugin = {
        name: 'test',
        version: '1.0.0',
        imports: { runtime: ['valid', 123] },
      } as unknown as Plugin;
      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin 'imports.runtime' must be an array of strings if provided",
      );
    });

    test('accepts valid plugin with imports', () => {
      const validPluginWithImports: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        imports: {
          runtime: ['react', 'lodash'],
          types: ['@types/react', '@types/lodash'],
        },
      };

      expect(() => pluginManager.register(validPluginWithImports)).not.toThrow();
      expect(pluginManager.getPlugins()).toHaveLength(1);
    });

    test('accepts valid plugin with hook methods', () => {
      const validPluginWithHooks: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        beforeParse: (context: ParseContext) => ok(context),
        transformType: (type: Type, typeInfo: TypeInfo) => ok(typeInfo),
      };

      expect(() => pluginManager.register(validPluginWithHooks)).not.toThrow();
      expect(pluginManager.getPlugins()).toHaveLength(1);
    });
  });

  describe('plugin unregistration', () => {
    test('unregisters existing plugin', () => {
      const plugin: Plugin = { name: 'test', version: '1.0.0' };
      pluginManager.register(plugin);

      const result = pluginManager.unregister('test');
      expect(result).toBe(true);
      expect(pluginManager.getPlugins()).toHaveLength(0);
    });

    test('returns false for non-existent plugin', () => {
      const result = pluginManager.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('hook execution', () => {
    test('executes beforeParse hook successfully', async () => {
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        beforeParse: (context: ParseContext) => ok({ ...context, typeName: 'Modified' }),
      };
      pluginManager.register(plugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Original' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.typeName).toBe('Modified');
      }
    });

    test('executes afterParse hook with additional args', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export interface User {
          id: string;
        }
      `,
      );
      const userInterface = sourceFile.getInterface('User');
      if (!userInterface) {
        throw new Error('User interface not found');
      }
      const userType = userInterface.getType();

      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        afterParse: (context: ParseContext, type: Type) => {
          expect(type).toBe(userType);
          return ok(type);
        },
      };
      pluginManager.register(plugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.AfterParse,
        input: { sourceFile: 'test.ts', typeName: 'User' },
        additionalArgs: [userType],
      });

      expect(result.ok).toBe(true);
    });

    test('handles plugin hook errors gracefully', async () => {
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        beforeParse: () => {
          throw new Error('Plugin error');
        },
      };
      pluginManager.register(plugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Test' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Plugin test hook beforeParse threw error: Error: Plugin error',
        );
      }
    });

    test('handles plugin hook returning error result', async () => {
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        beforeParse: () => err(new Error('Hook failed')),
      };
      pluginManager.register(plugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Test' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Plugin test hook beforeParse failed: Error: Hook failed',
        );
      }
    });

    test('handles plugin hook returning invalid result', async () => {
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        beforeParse: () => ({ invalid: 'result' }) as any,
      };
      pluginManager.register(plugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Test' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Plugin test hook beforeParse returned invalid result',
        );
      }
    });

    test('executes multiple plugins in sequence', async () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        beforeParse: (context: ParseContext) =>
          ok({ ...context, typeName: context.typeName + '-1' }),
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        beforeParse: (context: ParseContext) =>
          ok({ ...context, typeName: context.typeName + '-2' }),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Base' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.typeName).toBe('Base-1-2');
      }
    });

    test('stops execution on first plugin error', async () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        beforeParse: () => err(new Error('First plugin failed')),
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        beforeParse: () => ok({ sourceFile: 'test.ts', typeName: 'Should not reach here' }),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Test' },
      });

      expect(result.ok).toBe(false);
    });

    test('skips plugins without the requested hook', async () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        // No beforeParse hook
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        beforeParse: (context: ParseContext) => ok({ ...context, typeName: 'Modified' }),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Original' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.typeName).toBe('Modified');
      }
    });
  });

  describe('import aggregation', () => {
    test('aggregates imports from multiple plugins', () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        imports: {
          runtime: ['react', 'lodash'],
          types: ['@types/react'],
        },
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        imports: {
          runtime: ['axios'],
          types: ['@types/lodash', '@types/axios'],
        },
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const imports = pluginManager.getRequiredImports();

      expect(imports.runtime).toEqual(['react', 'lodash', 'axios']);
      expect(imports.types).toEqual(['@types/react', '@types/lodash', '@types/axios']);
    });

    test('deduplicates imports', () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        imports: {
          runtime: ['react', 'lodash'],
        },
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        imports: {
          runtime: ['react', 'axios'], // react is duplicate
        },
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const imports = pluginManager.getRequiredImports();

      expect(imports.runtime).toEqual(['react', 'lodash', 'axios']);
    });

    test('handles plugins without imports', () => {
      const plugin: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        // No imports
      };

      pluginManager.register(plugin);

      const imports = pluginManager.getRequiredImports();

      expect(imports.runtime).toEqual([]);
      expect(imports.types).toEqual([]);
    });
  });

  describe('property method transformation', () => {
    test('returns null when no plugins provide transformation', () => {
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        // No transformPropertyMethod
      };

      pluginManager.register(plugin);

      const context: PropertyMethodContext = {
        property: {
          name: 'id',
          type: { kind: TypeKind.Primitive, name: 'string' },
          optional: false,
          readonly: false,
        },
        propertyType: { kind: TypeKind.Primitive, name: 'string' },
        originalTypeString: 'string',
        builderName: 'UserBuilder',
        typeName: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        isType: (kind: TypeKind) => kind === TypeKind.Primitive,
        hasGenericConstraint: () => false,
        isArrayType: () => false,
        isUnionType: () => false,
        isPrimitiveType: (name?: string) => !name || name === 'string',
      };

      const result = pluginManager.getPropertyMethodTransform(context);
      expect(result).toBeNull();
    });

    test('merges transformations from multiple plugins', () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        transformPropertyMethod: () =>
          ok({
            parameterType: 'string | number',
            extractValue: 'String(value)',
          }),
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        transformPropertyMethod: () =>
          ok({
            validate: "if (!value) throw new Error('Required')",
          }),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: PropertyMethodContext = {
        property: {
          name: 'id',
          type: { kind: TypeKind.Primitive, name: 'string' },
          optional: false,
          readonly: false,
        },
        propertyType: { kind: TypeKind.Primitive, name: 'string' },
        originalTypeString: 'string',
        builderName: 'UserBuilder',
        typeName: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        isType: (kind: TypeKind) => kind === TypeKind.Primitive,
        hasGenericConstraint: () => false,
        isArrayType: () => false,
        isUnionType: () => false,
        isPrimitiveType: (name?: string) => !name || name === 'string',
      };

      const result = pluginManager.getPropertyMethodTransform(context);

      expect(result).toEqual({
        parameterType: 'string | number',
        extractValue: 'String(value)',
        validate: "if (!value) throw new Error('Required')",
      });
    });

    test('later plugins override earlier ones for same properties', () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        transformPropertyMethod: () =>
          ok({
            parameterType: 'string',
            validate: 'original validation',
          }),
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        transformPropertyMethod: () =>
          ok({
            parameterType: 'number', // Override
          }),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: PropertyMethodContext = {
        property: {
          name: 'id',
          type: { kind: TypeKind.Primitive, name: 'string' },
          optional: false,
          readonly: false,
        },
        propertyType: { kind: TypeKind.Primitive, name: 'string' },
        originalTypeString: 'string',
        builderName: 'UserBuilder',
        typeName: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        isType: (kind: TypeKind) => kind === TypeKind.Primitive,
        hasGenericConstraint: () => false,
        isArrayType: () => false,
        isUnionType: () => false,
        isPrimitiveType: (name?: string) => !name || name === 'string',
      };

      const result = pluginManager.getPropertyMethodTransform(context);

      expect(result).toEqual({
        parameterType: 'number', // Overridden
        validate: 'original validation', // Preserved
      });
    });
  });

  describe('custom methods', () => {
    test('returns empty array when no plugins provide custom methods', () => {
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        // No addCustomMethods
      };

      pluginManager.register(plugin);

      const context: BuilderContext = {
        typeName: 'User',
        builderName: 'UserBuilder',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        properties: [],
        genericParams: '',
        genericConstraints: '',
      };

      const result = pluginManager.getCustomMethods(context);
      expect(result).toEqual([]);
    });

    test('collects custom methods from multiple plugins', () => {
      const method1: CustomMethod = {
        name: 'withDefaults',
        signature: 'withDefaults(): this',
        implementation: 'return this;',
        jsDoc: 'Sets default values',
      };

      const method2: CustomMethod = {
        name: 'validate',
        signature: 'validate(): boolean',
        implementation: 'return true;',
      };

      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        addCustomMethods: () => ok([method1]),
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        addCustomMethods: () => ok([method2]),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: BuilderContext = {
        typeName: 'User',
        builderName: 'UserBuilder',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        properties: [],
        genericParams: '',
        genericConstraints: '',
      };

      const result = pluginManager.getCustomMethods(context);
      expect(result).toEqual([method1, method2]);
    });
  });

  describe('value transformations', () => {
    test('returns empty array when no plugins provide transformations', () => {
      const plugin: Plugin = {
        name: 'test',
        version: '1.0.0',
        // No transformValue
      };

      pluginManager.register(plugin);

      const context: ValueContext = {
        property: 'id',
        valueVariable: 'idValue',
        type: { kind: TypeKind.Primitive, name: 'string' },
        isOptional: false,
      };

      const result = pluginManager.getValueTransforms(context);
      expect(result).toEqual([]);
    });

    test('collects value transformations from multiple plugins', () => {
      const transform1: ValueTransform = {
        condition: "typeof value === 'string'",
        transform: 'value.trim()',
      };

      const transform2: ValueTransform = {
        transform: 'value.toLowerCase()',
      };

      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        transformValue: () => ok(transform1),
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        transformValue: () => ok(transform2),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: ValueContext = {
        property: 'name',
        valueVariable: 'nameValue',
        type: { kind: TypeKind.Primitive, name: 'string' },
        isOptional: false,
      };

      const result = pluginManager.getValueTransforms(context);
      expect(result).toEqual([transform1, transform2]);
    });

    test('filters out null transforms', () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        transformValue: () => ok(null), // Returns null
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        transformValue: () =>
          ok({
            transform: 'value.toUpperCase()',
          }),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: ValueContext = {
        property: 'name',
        valueVariable: 'nameValue',
        type: { kind: TypeKind.Primitive, name: 'string' },
        isOptional: false,
      };

      const result = pluginManager.getValueTransforms(context);
      expect(result).toEqual([
        {
          transform: 'value.toUpperCase()',
        },
      ]);
    });
  });

  describe('error handling in collectPluginResults', () => {
    test('continues with other plugins when one throws an error', () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        addCustomMethods: () => {
          throw new Error('Plugin1 error');
        },
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        addCustomMethods: () =>
          ok([
            {
              name: 'test',
              signature: 'test(): void',
              implementation: 'return;',
            },
          ]),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: BuilderContext = {
        typeName: 'User',
        builderName: 'UserBuilder',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        properties: [],
        genericParams: '',
        genericConstraints: '',
      };

      // Should not throw and should return results from plugin2
      const result = pluginManager.getCustomMethods(context);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('test');
    });
  });

  describe('edge cases', () => {
    test('handles empty plugin list gracefully', async () => {
      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: 'test.ts', typeName: 'Test' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          sourceFile: 'test.ts',
          typeName: 'Test',
        });
      }
    });

    test('handles plugin with all hooks', () => {
      const fullPlugin: Plugin = {
        name: 'full-plugin',
        version: '1.0.0',
        imports: {
          runtime: ['react'],
          types: ['@types/react'],
        },
        beforeParse: context => ok(context),
        afterParse: (context, type) => ok(type),
        beforeResolve: context => ok(context),
        afterResolve: (context, typeInfo) => ok(typeInfo),
        beforeGenerate: context => ok(context),
        afterGenerate: (code, _context) => ok(code),
        transformType: (type, typeInfo) => ok(typeInfo),
        transformProperty: property => ok(property),
        transformBuildMethod: _context => ok('method code'),
        transformPropertyMethod: _context => ok({ parameterType: 'any' }),
        addCustomMethods: _context => ok([]),
        transformValue: _context => ok(null),
        transformImports: context => ok(context),
      };

      expect(() => pluginManager.register(fullPlugin)).not.toThrow();
      expect(pluginManager.getPlugins()).toHaveLength(1);
    });
  });

  describe('import transformations', () => {
    test('transforms imports through plugin hook', async () => {
      const plugin: Plugin = {
        name: 'import-transformer',
        version: '1.0.0',
        transformImports: (context: ImportTransformContext) => {
          // Sort imports alphabetically as an example transformation
          const sorted = [...context.imports].sort();
          return ok({ ...context, imports: sorted });
        },
      };

      pluginManager.register(plugin);

      const context: ImportTransformContext = {
        imports: ['import { z } from "zod";', 'import { a } from "a";'],
        resolvedType: {
          name: 'TestType',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          sourceFile: 'test.ts',
          imports: [],
          dependencies: [],
        },
        isGeneratingMultiple: false,
        hasExistingCommon: false,
      };

      const result = await pluginManager.executeHook({
        hookType: HookType.TransformImports,
        input: context,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.imports).toEqual([
          'import { a } from "a";',
          'import { z } from "zod";',
        ]);
      }
    });

    test('handles multiple import transformation plugins', async () => {
      const plugin1: Plugin = {
        name: 'plugin1',
        version: '1.0.0',
        transformImports: (context: ImportTransformContext) => {
          // Add a comment to each import
          const commented = context.imports.map(imp => `// Auto-generated\n${imp}`);
          return ok({ ...context, imports: commented });
        },
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        version: '1.0.0',
        transformImports: (context: ImportTransformContext) => {
          // Filter out any imports containing 'test'
          const filtered = context.imports.filter(imp => !imp.includes('test'));
          return ok({ ...context, imports: filtered });
        },
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: ImportTransformContext = {
        imports: ['import { real } from "real";', 'import { test } from "test";'],
        resolvedType: {
          name: 'TestType',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          sourceFile: 'test.ts',
          imports: [],
          dependencies: [],
        },
        isGeneratingMultiple: false,
        hasExistingCommon: false,
      };

      const result = await pluginManager.executeHook({
        hookType: HookType.TransformImports,
        input: context,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // First plugin adds comments, second plugin filters out 'test' imports
        expect(result.value.imports).toEqual(['// Auto-generated\nimport { real } from "real";']);
      }
    });
  });

  describe('enhanced property method context', () => {
    test('provides type checking helper methods', () => {
      const plugin: Plugin = {
        name: 'type-checker',
        version: '1.0.0',
        transformPropertyMethod: (context: PropertyMethodContext) => {
          if (context.isPrimitiveType('string')) {
            return ok({ parameterType: 'string | number', extractValue: 'String(value)' });
          }
          return ok({});
        },
      };

      pluginManager.register(plugin);

      const context: PropertyMethodContext = {
        property: {
          name: 'name',
          type: { kind: TypeKind.Primitive, name: 'string' },
          optional: false,
          readonly: false,
        },
        propertyType: { kind: TypeKind.Primitive, name: 'string' },
        originalTypeString: 'string',
        builderName: 'UserBuilder',
        typeName: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        isType: (kind: TypeKind) => kind === TypeKind.Primitive,
        hasGenericConstraint: () => false,
        isArrayType: () => false,
        isUnionType: () => false,
        isPrimitiveType: (name?: string) => !name || name === 'string',
      };

      const result = pluginManager.getPropertyMethodTransform(context);
      expect(result).toEqual({
        parameterType: 'string | number',
        extractValue: 'String(value)',
      });
    });

    test('array type helper works correctly', () => {
      const context: PropertyMethodContext = {
        property: {
          name: 'items',
          type: { kind: TypeKind.Array, elementType: { kind: TypeKind.Primitive, name: 'string' } },
          optional: false,
          readonly: false,
        },
        propertyType: {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'string' },
        },
        originalTypeString: 'string[]',
        builderName: 'UserBuilder',
        typeName: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [] },
        isType: (kind: TypeKind) => kind === TypeKind.Array,
        hasGenericConstraint: () => false,
        isArrayType: () => true,
        isUnionType: () => false,
        isPrimitiveType: () => false,
      };

      expect(context.isArrayType()).toBe(true);
      expect(context.isPrimitiveType()).toBe(false);
      expect(context.isType(TypeKind.Array)).toBe(true);
    });
  });
});
