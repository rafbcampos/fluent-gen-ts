import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PluginManager } from '../plugin-manager.js';
import {
  HookType,
  type Plugin,
  type PropertyMethodContext,
  type BuilderContext,
  type ValueContext,
} from '../plugin-types.js';
import { ok, err } from '../../result.js';
import { TypeKind } from '../../types.js';

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
  });

  describe('constructor', () => {
    test('should initialize with empty plugin registry', () => {
      expect(pluginManager.getPlugins()).toHaveLength(0);
      expect(pluginManager.getPluginCount()).toBe(0);
    });
  });

  describe('plugin registration', () => {
    test('should register valid plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
      };

      expect(() => pluginManager.register(plugin)).not.toThrow();
      expect(pluginManager.getPlugins()).toHaveLength(1);
      expect(pluginManager.getPlugin('test-plugin')).toBe(plugin);
    });

    test('should reject plugin without name', () => {
      const invalidPlugin = {
        version: '1.0.0',
      } as Plugin;

      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin must have a non-empty 'name' property",
      );
    });

    test('should reject plugin without version', () => {
      const invalidPlugin = {
        name: 'test-plugin',
      } as Plugin;

      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin must have a non-empty 'version' property",
      );
    });

    test('should reject plugin with empty name', () => {
      const invalidPlugin: Plugin = {
        name: '',
        version: '1.0.0',
      };

      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin must have a non-empty 'name' property",
      );
    });

    test('should reject plugin with empty version', () => {
      const invalidPlugin: Plugin = {
        name: 'test-plugin',
        version: '',
      };

      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        "Plugin validation failed: Plugin must have a non-empty 'version' property",
      );
    });

    test('should reject non-object plugin', () => {
      const invalidPlugin = 'not-an-object' as any;

      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        'Plugin validation failed: Plugin must be an object',
      );
    });

    test('should reject null plugin', () => {
      const invalidPlugin = null as any;

      expect(() => pluginManager.register(invalidPlugin)).toThrow(
        'Plugin validation failed: Plugin must be an object',
      );
    });

    test('should reject duplicate plugin registration', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      pluginManager.register(plugin);
      expect(() => pluginManager.register(plugin)).toThrow(
        'Plugin test-plugin is already registered',
      );
    });

    test('should validate hook methods are functions', () => {
      const pluginWithInvalidHook = {
        name: 'test-plugin',
        version: '1.0.0',
        beforeParse: 'not-a-function',
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidHook)).toThrow(
        "Plugin validation failed: Plugin hook 'beforeParse' must be a function if provided",
      );
    });

    test('should validate description is string if provided', () => {
      const pluginWithInvalidDescription = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 123,
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidDescription)).toThrow(
        "Plugin validation failed: Plugin 'description' must be a string if provided",
      );
    });
  });

  describe('plugin unregistration', () => {
    test('should unregister existing plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      pluginManager.register(plugin);
      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);

      const result = pluginManager.unregister('test-plugin');
      expect(result).toBe(true);
      expect(pluginManager.hasPlugin('test-plugin')).toBe(false);
      expect(pluginManager.getPlugins()).toHaveLength(0);
    });

    test('should return false when unregistering non-existent plugin', () => {
      const result = pluginManager.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('plugin queries', () => {
    beforeEach(() => {
      const plugin1: Plugin = {
        name: 'plugin-1',
        version: '1.0.0',
        beforeParse: () => ok({} as any),
      };

      const plugin2: Plugin = {
        name: 'plugin-2',
        version: '2.0.0',
        transformProperty: () => ok({} as any),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);
    });

    test('should get all plugins', () => {
      const plugins = pluginManager.getPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins.map(p => p.name)).toEqual(['plugin-1', 'plugin-2']);
    });

    test('should get plugin by name', () => {
      const plugin = pluginManager.getPlugin('plugin-1');
      expect(plugin).toBeDefined();
      if (plugin) {
        expect(plugin.name).toBe('plugin-1');
      }
    });

    test('should return undefined for non-existent plugin', () => {
      const plugin = pluginManager.getPlugin('non-existent');
      expect(plugin).toBeUndefined();
    });

    test('should check if plugin exists', () => {
      expect(pluginManager.hasPlugin('plugin-1')).toBe(true);
      expect(pluginManager.hasPlugin('non-existent')).toBe(false);
    });

    test('should get plugin count', () => {
      expect(pluginManager.getPluginCount()).toBe(2);
    });

    test('should filter plugins by hook type', () => {
      const parsePlugins = pluginManager.getPluginsByHookType(HookType.BeforeParse);
      expect(parsePlugins).toHaveLength(1);
      expect(parsePlugins[0]!.name).toBe('plugin-1');

      const transformPlugins = pluginManager.getPluginsByHookType(HookType.TransformProperty);
      expect(transformPlugins).toHaveLength(1);
      expect(transformPlugins[0]!.name).toBe('plugin-2');

      const generatePlugins = pluginManager.getPluginsByHookType(HookType.BeforeGenerate);
      expect(generatePlugins).toHaveLength(0);
    });
  });

  describe('clear', () => {
    test('should clear all plugins', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      pluginManager.register(plugin);
      expect(pluginManager.getPluginCount()).toBe(1);

      pluginManager.clear();
      expect(pluginManager.getPluginCount()).toBe(0);
      expect(pluginManager.getPlugins()).toHaveLength(0);
    });
  });

  describe('hook execution', () => {
    test('should execute hook across multiple plugins', async () => {
      const plugin1: Plugin = {
        name: 'plugin-1',
        version: '1.0.0',
        beforeParse: context => ok({ ...context, modified: 'plugin-1' }),
      };

      const plugin2: Plugin = {
        name: 'plugin-2',
        version: '1.0.0',
        beforeParse: context => ok({ ...context, modified: 'plugin-2' }),
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const initialContext = {
        sourceFile: '/test/file.ts',
        typeName: 'TestType',
      };

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: initialContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sourceFile).toBe('/test/file.ts');
        expect(result.value.typeName).toBe('TestType');
        expect((result.value as typeof initialContext & { modified: string }).modified).toBe(
          'plugin-2',
        ); // Last plugin wins
      }
    });

    test('should handle hook execution errors', async () => {
      const faultyPlugin: Plugin = {
        name: 'faulty-plugin',
        version: '1.0.0',
        beforeParse: () => err(new Error('Hook failed')),
      };

      pluginManager.register(faultyPlugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Plugin faulty-plugin hook beforeParse failed: Hook failed',
        );
      }
    });

    test('should handle hook that throws exception', async () => {
      const throwingPlugin: Plugin = {
        name: 'throwing-plugin',
        version: '1.0.0',
        beforeParse: () => {
          throw new Error('Unexpected error');
        },
      };

      pluginManager.register(throwingPlugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Plugin throwing-plugin hook beforeParse threw error: Error: Unexpected error',
        );
      }
    });

    test('should handle hook returning invalid result', async () => {
      const invalidPlugin: Plugin = {
        name: 'invalid-plugin',
        version: '1.0.0',
        beforeParse: () => 'not-a-result' as any,
      };

      pluginManager.register(invalidPlugin);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Plugin invalid-plugin hook beforeParse returned invalid result',
        );
      }
    });

    test('should execute hooks with additional arguments', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        afterParse: (context, type) => ok(type),
      };

      pluginManager.register(plugin);

      const mockType = { getText: () => 'TestType' } as any;
      const result = await pluginManager.executeHook({
        hookType: HookType.AfterParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
        additionalArgs: [mockType],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(mockType);
      }
    });

    test('should skip plugins without the requested hook', async () => {
      const plugin1: Plugin = {
        name: 'plugin-1',
        version: '1.0.0',
        beforeParse: context => ok({ ...context, modified: 'plugin-1' }),
      };

      const plugin2: Plugin = {
        name: 'plugin-2',
        version: '1.0.0',
        // No beforeParse hook
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const result = await pluginManager.executeHook({
        hookType: HookType.BeforeParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(
          (result.value as { sourceFile: string; typeName: string; modified: string }).modified,
        ).toBe('plugin-1');
      }
    });
  });

  describe('specific plugin hook execution', () => {
    test('should execute hook from specific plugin', async () => {
      const plugin: Plugin = {
        name: 'target-plugin',
        version: '1.0.0',
        beforeParse: context => ok({ ...context, modified: 'target-plugin' }),
      };

      pluginManager.register(plugin);

      const result = await pluginManager.executePluginHook('target-plugin', {
        hookType: HookType.BeforeParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(
          (result.value as { sourceFile: string; typeName: string; modified: string }).modified,
        ).toBe('target-plugin');
      }
    });

    test('should return error for non-existent plugin', async () => {
      const result = await pluginManager.executePluginHook('non-existent', {
        hookType: HookType.BeforeParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Plugin non-existent not found');
      }
    });

    test('should return error when plugin lacks requested hook', async () => {
      const plugin: Plugin = {
        name: 'no-hook-plugin',
        version: '1.0.0',
      };

      pluginManager.register(plugin);

      const result = await pluginManager.executePluginHook('no-hook-plugin', {
        hookType: HookType.BeforeParse,
        input: { sourceFile: '/test/file.ts', typeName: 'TestType' },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Plugin no-hook-plugin does not have hook beforeParse');
      }
    });
  });

  describe('specialized hook methods', () => {
    describe('getPropertyMethodTransform', () => {
      test('should collect and merge property method transforms', () => {
        const plugin1: Plugin = {
          name: 'plugin-1',
          version: '1.0.0',
          transformPropertyMethod: () => ok({ parameterType: 'string' }),
        };

        const plugin2: Plugin = {
          name: 'plugin-2',
          version: '1.0.0',
          transformPropertyMethod: () => ok({ extractValue: 'String(value)' }),
        };

        pluginManager.register(plugin1);
        pluginManager.register(plugin2);

        const mockContext: PropertyMethodContext = {
          typeName: 'User',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          builderName: 'UserBuilder',
          property: {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          propertyType: { kind: TypeKind.Primitive, name: 'string' },
          originalTypeString: 'string',
          type: {
            isPrimitive: () => true,
            isObject: () => ({}) as any,
            isArray: () => ({}) as any,
            isUnion: () => ({}) as any,
            isIntersection: () => ({}) as any,
            isReference: () => false,
            isGeneric: () => false,
            matches: () => false,
            toString: () => 'string',
            transformDeep: () => ({}) as any,
            containsDeep: () => false,
            findDeep: () => [],
          },
          hasGeneric: () => false,
          getGenericConstraint: () => undefined,
          isOptional: () => false,
          isReadonly: () => false,
          getPropertyPath: () => ['email'],
          getMethodName: () => 'email',
        };

        const result = pluginManager.getPropertyMethodTransform(mockContext);
        expect(result).toEqual({
          parameterType: 'string',
          extractValue: 'String(value)',
        });
      });

      test('should return null when no plugins provide transforms', () => {
        const plugin: Plugin = {
          name: 'no-transform-plugin',
          version: '1.0.0',
        };

        pluginManager.register(plugin);

        const mockContext: PropertyMethodContext = {
          typeName: 'User',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          builderName: 'UserBuilder',
          property: {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          propertyType: { kind: TypeKind.Primitive, name: 'string' },
          originalTypeString: 'string',
          type: {
            isPrimitive: () => true,
            isObject: () => ({}) as any,
            isArray: () => ({}) as any,
            isUnion: () => ({}) as any,
            isIntersection: () => ({}) as any,
            isReference: () => false,
            isGeneric: () => false,
            matches: () => false,
            toString: () => 'string',
            transformDeep: () => ({}) as any,
            containsDeep: () => false,
            findDeep: () => [],
          },
          hasGeneric: () => false,
          getGenericConstraint: () => undefined,
          isOptional: () => false,
          isReadonly: () => false,
          getPropertyPath: () => ['email'],
          getMethodName: () => 'email',
        };

        const result = pluginManager.getPropertyMethodTransform(mockContext);
        expect(result).toBeNull();
      });
    });

    describe('getCustomMethods', () => {
      test('should collect custom methods from multiple plugins', () => {
        const plugin1: Plugin = {
          name: 'plugin-1',
          version: '1.0.0',
          addCustomMethods: () =>
            ok([
              {
                name: 'withEmail',
                signature: '(email: string): this',
                implementation: 'return this.email(email);',
              },
            ]),
        };

        const plugin2: Plugin = {
          name: 'plugin-2',
          version: '1.0.0',
          addCustomMethods: () =>
            ok([
              {
                name: 'withName',
                signature: '(name: string): this',
                implementation: 'return this.name(name);',
              },
            ]),
        };

        pluginManager.register(plugin1);
        pluginManager.register(plugin2);

        const mockContext: BuilderContext = {
          typeName: 'User',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          builderName: 'UserBuilder',
          genericParams: '',
          genericConstraints: '',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        const methods = pluginManager.getCustomMethods(mockContext);
        expect(methods).toHaveLength(2);
        expect(methods.map(m => m.name)).toEqual(['withEmail', 'withName']);
      });

      test('should handle failed custom method hooks gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const plugin: Plugin = {
          name: 'failing-plugin',
          version: '1.0.0',
          addCustomMethods: () => {
            throw new Error('Custom method generation failed');
          },
        };

        pluginManager.register(plugin);

        const mockContext: BuilderContext = {
          typeName: 'User',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          builderName: 'UserBuilder',
          genericParams: '',
          genericConstraints: '',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        const methods = pluginManager.getCustomMethods(mockContext);
        expect(methods).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalledWith(
          'Plugin failing-plugin hook addCustomMethods failed:',
          expect.any(Error),
        );

        consoleSpy.mockRestore();
      });
    });

    describe('getValueTransforms', () => {
      test('should collect value transforms from plugins', () => {
        const plugin: Plugin = {
          name: 'transform-plugin',
          version: '1.0.0',
          transformValue: () => ok({ transform: 'value.toUpperCase()' }),
        };

        pluginManager.register(plugin);

        const mockContext: ValueContext = {
          property: 'email',
          valueVariable: 'emailValue',
          type: { kind: TypeKind.Primitive, name: 'string' },
          isOptional: false,
          typeChecker: {
            isPrimitive: () => true,
            isObject: () => ({}) as any,
            isArray: () => ({}) as any,
            isUnion: () => ({}) as any,
            isIntersection: () => ({}) as any,
            isReference: () => false,
            isGeneric: () => false,
            matches: () => false,
            toString: () => 'string',
            transformDeep: () => ({}) as any,
            containsDeep: () => false,
            findDeep: () => [],
          },
        };

        const transforms = pluginManager.getValueTransforms(mockContext);
        expect(transforms).toHaveLength(1);
        expect(transforms[0]!.transform).toBe('value.toUpperCase()');
      });

      test('should filter out null transforms', () => {
        const plugin1: Plugin = {
          name: 'plugin-1',
          version: '1.0.0',
          transformValue: () => ok({ transform: 'value.trim()' }),
        };

        const plugin2: Plugin = {
          name: 'plugin-2',
          version: '1.0.0',
          transformValue: () => ok(null),
        };

        pluginManager.register(plugin1);
        pluginManager.register(plugin2);

        const mockContext: ValueContext = {
          property: 'email',
          valueVariable: 'emailValue',
          type: { kind: TypeKind.Primitive, name: 'string' },
          isOptional: false,
          typeChecker: {
            isPrimitive: () => true,
            isObject: () => ({}) as any,
            isArray: () => ({}) as any,
            isUnion: () => ({}) as any,
            isIntersection: () => ({}) as any,
            isReference: () => false,
            isGeneric: () => false,
            matches: () => false,
            toString: () => 'string',
            transformDeep: () => ({}) as any,
            containsDeep: () => false,
            findDeep: () => [],
          },
        };

        const transforms = pluginManager.getValueTransforms(mockContext);
        expect(transforms).toHaveLength(1);
        expect(transforms[0]!.transform).toBe('value.trim()');
      });
    });
  });

  describe('import management', () => {
    test('should collect imports from all plugins', () => {
      const plugin1: Plugin = {
        name: 'plugin-1',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'internal',
              path: '../types.js',
              imports: ['User'],
            },
          ],
        },
      };

      const plugin2: Plugin = {
        name: 'plugin-2',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'external',
              package: 'lodash',
              imports: ['merge'],
            },
          ],
        },
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const importManager = pluginManager.getRequiredImports();
      expect(importManager).toBeDefined();

      const statements = pluginManager.generateImportStatements();
      expect(statements).toEqual(
        expect.arrayContaining([expect.stringContaining('User'), expect.stringContaining('merge')]),
      );
    });

    test('should handle plugins without imports', () => {
      const plugin: Plugin = {
        name: 'no-imports-plugin',
        version: '1.0.0',
      };

      pluginManager.register(plugin);

      const statements = pluginManager.generateImportStatements();
      expect(statements).toEqual([]);
    });
  });

  describe('import validation', () => {
    test('should validate plugin imports structure', () => {
      const pluginWithInvalidImports = {
        name: 'invalid-imports-plugin',
        version: '1.0.0',
        imports: 'not-an-object',
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidImports)).toThrow(
        "Plugin validation failed: Plugin 'imports' must be an object if provided",
      );
    });

    test('should validate imports array', () => {
      const pluginWithInvalidImportsArray = {
        name: 'invalid-imports-array-plugin',
        version: '1.0.0',
        imports: {
          imports: 'not-an-array',
        },
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidImportsArray)).toThrow(
        "Plugin validation failed: Plugin 'imports.imports' must be an array",
      );
    });

    test('should validate individual import objects', () => {
      const pluginWithInvalidImport = {
        name: 'invalid-import-plugin',
        version: '1.0.0',
        imports: {
          imports: ['not-an-import-object'],
        },
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidImport)).toThrow(
        'Plugin validation failed: Import at index 0 must be an object',
      );
    });

    test('should validate import kind', () => {
      const pluginWithInvalidKind = {
        name: 'invalid-kind-plugin',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'invalid-kind',
              imports: ['Test'],
            },
          ],
        },
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidKind)).toThrow(
        "Plugin validation failed: Import at index 0 must have kind 'internal' or 'external'",
      );
    });

    test('should validate internal import has path', () => {
      const pluginWithInvalidInternalImport = {
        name: 'invalid-internal-plugin',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'internal',
              imports: ['Test'],
            },
          ],
        },
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidInternalImport)).toThrow(
        "Plugin validation failed: Internal import at index 0 must have 'path' string",
      );
    });

    test('should validate external import has package', () => {
      const pluginWithInvalidExternalImport = {
        name: 'invalid-external-plugin',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'external',
              imports: ['Test'],
            },
          ],
        },
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidExternalImport)).toThrow(
        "Plugin validation failed: External import at index 0 must have 'package' string",
      );
    });

    test('should validate imports array contains strings', () => {
      const pluginWithInvalidImportsContent = {
        name: 'invalid-imports-content-plugin',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'internal',
              path: '../types.js',
              imports: [123, 'valid'],
            },
          ],
        },
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidImportsContent)).toThrow(
        "Plugin validation failed: Import at index 0 'imports' must be an array of strings",
      );
    });

    test('should validate optional import fields', () => {
      const pluginWithInvalidOptionalFields = {
        name: 'invalid-optional-fields-plugin',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'internal',
              path: '../types.js',
              imports: ['Test'],
              isTypeOnly: 'not-boolean',
              isDefault: 'not-boolean',
              defaultName: 123,
            },
          ],
        },
      } as any;

      expect(() => pluginManager.register(pluginWithInvalidOptionalFields)).toThrow(
        "Plugin validation failed: Import at index 0 'isTypeOnly' must be boolean if provided",
      );
    });
  });
});
