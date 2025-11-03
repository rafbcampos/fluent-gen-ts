import { describe, test, expect } from 'vitest';
import {
  isValidPlugin,
  createPluginManager,
  HookType,
  createPlugin,
  PluginManager,
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
  createPropertyMethodTransformBuilder,
  createValueTransformBuilder,
  createBuildMethodTransformBuilder,
  createCustomMethodBuilder,
  enhanceParseContext,
  enhanceResolveContext,
  enhanceGenerateContext,
  enhancePropertyMethodContext,
  enhanceBuilderContext,
  enhanceValueContext,
  enhanceBuildMethodContext,
  ok,
  err,
  TypeKind,
} from '../index.js';
import type { Plugin } from '../index.js';

describe('Plugin Index Exports', () => {
  describe('isValidPlugin', () => {
    test('should return true for valid plugin objects', () => {
      const validPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      expect(isValidPlugin(validPlugin)).toBe(true);
    });

    test('should return true for valid plugin with additional properties', () => {
      const validPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
      };

      expect(isValidPlugin(validPlugin)).toBe(true);
    });

    test('should return false for non-object values', () => {
      expect(isValidPlugin(null)).toBe(false);
      expect(isValidPlugin(undefined)).toBe(false);
      expect(isValidPlugin('string')).toBe(false);
      expect(isValidPlugin(123)).toBe(false);
      expect(isValidPlugin([])).toBe(false);
      expect(isValidPlugin(() => {})).toBe(false);
    });

    test('should return false for objects without name', () => {
      const invalidPlugin = {
        version: '1.0.0',
      };

      expect(isValidPlugin(invalidPlugin)).toBe(false);
    });

    test('should return false for objects without version', () => {
      const invalidPlugin = {
        name: 'test-plugin',
      };

      expect(isValidPlugin(invalidPlugin)).toBe(false);
    });

    test('should return false for objects with empty name', () => {
      const invalidPlugin = {
        name: '',
        version: '1.0.0',
      };

      expect(isValidPlugin(invalidPlugin)).toBe(false);
    });

    test('should return false for objects with empty version', () => {
      const invalidPlugin = {
        name: 'test-plugin',
        version: '',
      };

      expect(isValidPlugin(invalidPlugin)).toBe(false);
    });

    test('should return false for objects with non-string name', () => {
      const invalidPlugin = {
        name: 123,
        version: '1.0.0',
      };

      expect(isValidPlugin(invalidPlugin)).toBe(false);
    });

    test('should return false for objects with non-string version', () => {
      const invalidPlugin = {
        name: 'test-plugin',
        version: 123,
      };

      expect(isValidPlugin(invalidPlugin)).toBe(false);
    });
  });

  describe('createPluginManager', () => {
    test('should create a new PluginManager instance', () => {
      const manager = createPluginManager();
      expect(manager).toBeInstanceOf(PluginManager);
    });

    test('should create different instances on multiple calls', () => {
      const manager1 = createPluginManager();
      const manager2 = createPluginManager();

      expect(manager1).not.toBe(manager2);
      expect(manager1).toBeInstanceOf(PluginManager);
      expect(manager2).toBeInstanceOf(PluginManager);
    });
  });

  describe('exported constants and enums', () => {
    test('should export HookType enum', () => {
      expect(HookType).toBeDefined();
      expect(typeof HookType).toBe('object');
      expect(HookType.BeforeParse).toBeDefined();
      expect(HookType.AfterParse).toBeDefined();
      expect(HookType.BeforeResolve).toBeDefined();
      expect(HookType.AfterResolve).toBeDefined();
      expect(HookType.BeforeGenerate).toBeDefined();
      expect(HookType.AfterGenerate).toBeDefined();
    });

    test('should export TypeKind enum', () => {
      expect(TypeKind).toBeDefined();
      expect(typeof TypeKind).toBe('object');
      expect(TypeKind.Primitive).toBeDefined();
      expect(TypeKind.Object).toBeDefined();
      expect(TypeKind.Array).toBeDefined();
      expect(TypeKind.Union).toBeDefined();
    });
  });

  describe('exported factory functions', () => {
    test('should export createPlugin function', () => {
      expect(typeof createPlugin).toBe('function');
      const plugin = createPlugin('test', '1.0.0');
      expect(plugin).toBeDefined();
    });

    test('should export createTypeMatcher function', () => {
      expect(typeof createTypeMatcher).toBe('function');
      const matcher = createTypeMatcher();
      expect(matcher).toBeDefined();
    });

    test('should export transform builder factory functions', () => {
      expect(typeof createPropertyMethodTransformBuilder).toBe('function');
      expect(typeof createValueTransformBuilder).toBe('function');
      expect(typeof createBuildMethodTransformBuilder).toBe('function');
      expect(typeof createCustomMethodBuilder).toBe('function');

      const propertyBuilder = createPropertyMethodTransformBuilder();
      const valueBuilder = createValueTransformBuilder();
      const buildBuilder = createBuildMethodTransformBuilder();
      const customBuilder = createCustomMethodBuilder();

      expect(propertyBuilder).toBeDefined();
      expect(valueBuilder).toBeDefined();
      expect(buildBuilder).toBeDefined();
      expect(customBuilder).toBeDefined();
    });

    test('should export context enhancer functions', () => {
      expect(typeof enhanceParseContext).toBe('function');
      expect(typeof enhanceResolveContext).toBe('function');
      expect(typeof enhanceGenerateContext).toBe('function');
      expect(typeof enhancePropertyMethodContext).toBe('function');
      expect(typeof enhanceBuilderContext).toBe('function');
      expect(typeof enhanceValueContext).toBe('function');
      expect(typeof enhanceBuildMethodContext).toBe('function');

      // Test that they can be called
      const parseContext = enhanceParseContext('/test.ts', 'TestType');
      expect(parseContext).toBeDefined();
    });
  });

  describe('exported type matcher functions', () => {
    test('should export primitive matcher function', () => {
      expect(typeof primitive).toBe('function');
      const matcher = primitive('string');
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
    });

    test('should export object matcher function', () => {
      expect(typeof object).toBe('function');
      const matcher = object('User');
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
    });

    test('should export array matcher function', () => {
      expect(typeof array).toBe('function');
      const matcher = array();
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
    });

    test('should export union matcher function', () => {
      expect(typeof union).toBe('function');
      const matcher = union();
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
    });

    test('should export intersection matcher function', () => {
      expect(typeof intersection).toBe('function');
      const matcher = intersection();
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
    });

    test('should export reference matcher function', () => {
      expect(typeof reference).toBe('function');
      const matcher = reference('MyType');
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
    });

    test('should export generic matcher function', () => {
      expect(typeof generic).toBe('function');
      const matcher = generic('T');
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
    });

    test('should export special matcher functions', () => {
      expect(typeof any).toBe('function');
      expect(typeof never).toBe('function');
      expect(typeof literal).toBe('function');

      const anyMatcher = any();
      const neverMatcher = never();
      const literalMatcher = literal('test');

      expect(anyMatcher).toBeDefined();
      expect(neverMatcher).toBeDefined();
      expect(literalMatcher).toBeDefined();
    });

    test('should export composite matcher functions', () => {
      expect(typeof or).toBe('function');
      expect(typeof and).toBe('function');
      expect(typeof not).toBe('function');

      const stringMatcher = primitive('string');
      const numberMatcher = primitive('number');

      const orMatcher = or(stringMatcher, numberMatcher);
      const andMatcher = and(stringMatcher, numberMatcher);
      const notMatcher = not(stringMatcher);

      expect(orMatcher).toBeDefined();
      expect(andMatcher).toBeDefined();
      expect(notMatcher).toBeDefined();
    });
  });

  describe('exported result functions', () => {
    test('should export ok function', () => {
      expect(typeof ok).toBe('function');
      const result = ok('success');
      expect(result).toHaveProperty('value', 'success');
    });

    test('should export err function', () => {
      expect(typeof err).toBe('function');
      const result = err(new Error('test error'));
      expect(result).toHaveProperty('error');
      expect((result as any).error).toBeInstanceOf(Error);
    });
  });

  describe('integration with actual functionality', () => {
    test('should be able to create a functional plugin using exported functions', () => {
      const plugin = createPlugin('integration-test', '1.0.0')
        .setDescription('Integration test plugin')
        .transformPropertyMethods(builder =>
          builder
            .when(() => true)
            .setParameter('string | TaggedValue<string>')
            .done(),
        )
        .addMethod(builder =>
          builder
            .name('withEmail')
            .parameters([{ name: 'email', type: 'string' }])
            .returns('this')
            .implementation('return this.email(email);'),
        )
        .build();

      expect(isValidPlugin(plugin)).toBe(true);
      expect(plugin.name).toBe('integration-test');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('Integration test plugin');
      expect(plugin.transformPropertyMethod).toBeDefined();
      expect(plugin.addCustomMethods).toBeDefined();
    });

    test('should be able to use type matchers in a realistic scenario', () => {
      const stringMatcher = primitive('string');
      const numberMatcher = primitive('number');
      const unionMatcher = or(stringMatcher, numberMatcher);
      const objectMatcher = object('User');

      // Test type matching functionality
      expect(stringMatcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(numberMatcher.match({ kind: TypeKind.Primitive, name: 'number' })).toBe(true);
      expect(unionMatcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
      expect(objectMatcher.match({ kind: TypeKind.Object, name: 'User', properties: [] })).toBe(
        true,
      );
    });

    test('should be able to create and use a plugin manager', () => {
      const manager = createPluginManager();
      const plugin = createPlugin('test-plugin', '1.0.0').build();

      expect(isValidPlugin(plugin)).toBe(true);

      manager.register(plugin);

      const plugins = manager.getPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0]).toBe(plugin);
    });
  });
});
