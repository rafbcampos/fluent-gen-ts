import { describe, test, expect, vi } from 'vitest';
import { PluginBuilder, createPlugin } from '../plugin-builder.js';
import { ok } from '../../result.js';
import type { BuilderContext } from '../plugin-types.js';
import { TypeKind } from '../../types.js';

describe('PluginBuilder', () => {
  describe('createPlugin', () => {
    test('should create a new plugin builder instance', () => {
      const builder = createPlugin('test-plugin', '1.0.0');
      expect(builder).toBeInstanceOf(PluginBuilder);
    });
  });

  describe('basic plugin creation', () => {
    test('should build minimal plugin with name and version', () => {
      const plugin = createPlugin('test-plugin', '1.0.0').build();

      expect(plugin).toEqual({
        name: 'test-plugin',
        version: '1.0.0',
      });
    });

    test('should build plugin with description', () => {
      const plugin = createPlugin('test-plugin', '1.0.0').setDescription('A test plugin').build();

      expect(plugin).toEqual({
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
      });
    });
  });

  describe('import management', () => {
    test('should configure plugin imports', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .requireImports(manager =>
          manager.addInternal('../types.js', ['MyType']).addExternal('@test/lib', ['ExternalType']),
        )
        .build();

      expect(plugin.imports).toBeDefined();
      expect(plugin.imports?.imports).toHaveLength(2);
    });
  });

  describe('lifecycle hooks', () => {
    test('should set beforeParse hook', () => {
      const beforeParseHook = vi.fn(context => ok(context));
      const plugin = createPlugin('test-plugin', '1.0.0').beforeParse(beforeParseHook).build();

      expect(plugin.beforeParse).toBe(beforeParseHook);
    });

    test('should set afterParse hook', () => {
      const afterParseHook = vi.fn((context, type) => ok(type));
      const plugin = createPlugin('test-plugin', '1.0.0').afterParse(afterParseHook).build();

      expect(plugin.afterParse).toBe(afterParseHook);
    });

    test('should set beforeResolve hook', () => {
      const beforeResolveHook = vi.fn(context => ok(context));
      const plugin = createPlugin('test-plugin', '1.0.0').beforeResolve(beforeResolveHook).build();

      expect(plugin.beforeResolve).toBe(beforeResolveHook);
    });

    test('should set afterResolve hook', () => {
      const afterResolveHook = vi.fn((context, typeInfo) => ok(typeInfo));
      const plugin = createPlugin('test-plugin', '1.0.0').afterResolve(afterResolveHook).build();

      expect(plugin.afterResolve).toBe(afterResolveHook);
    });

    test('should set beforeGenerate hook', () => {
      const beforeGenerateHook = vi.fn(context => ok(context));
      const plugin = createPlugin('test-plugin', '1.0.0')
        .beforeGenerate(beforeGenerateHook)
        .build();

      expect(plugin.beforeGenerate).toBe(beforeGenerateHook);
    });

    test('should set afterGenerate hook', () => {
      const afterGenerateHook = vi.fn((code, _context) => ok(code));
      const plugin = createPlugin('test-plugin', '1.0.0').afterGenerate(afterGenerateHook).build();

      expect(plugin.afterGenerate).toBe(afterGenerateHook);
    });

    test('should set transformType hook', () => {
      const transformTypeHook = vi.fn((type, typeInfo) => ok(typeInfo));
      const plugin = createPlugin('test-plugin', '1.0.0').transformType(transformTypeHook).build();

      expect(plugin.transformType).toBe(transformTypeHook);
    });

    test('should set transformProperty hook', () => {
      const transformPropertyHook = vi.fn(property => ok(property));
      const plugin = createPlugin('test-plugin', '1.0.0')
        .transformProperty(transformPropertyHook)
        .build();

      expect(plugin.transformProperty).toBe(transformPropertyHook);
    });

    test('should set transformImports hook', () => {
      const transformImportsHook = vi.fn(context => ok(context));
      const plugin = createPlugin('test-plugin', '1.0.0')
        .transformImports(transformImportsHook)
        .build();

      expect(plugin.transformImports).toBe(transformImportsHook);
    });
  });

  describe('transform builders', () => {
    test('should configure property method transformations', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .transformPropertyMethods(builder =>
          builder
            .when(() => true)
            .setParameter('string')
            .done(),
        )
        .build();

      expect(plugin.transformPropertyMethod).toBeDefined();
      expect(typeof plugin.transformPropertyMethod).toBe('function');
    });

    test('should configure value transformations', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .transformValues(builder =>
          builder
            .when(() => true)
            .transform('value.trim()')
            .done(),
        )
        .build();

      expect(plugin.transformValue).toBeDefined();
      expect(typeof plugin.transformValue).toBe('function');
    });

    test('should configure build method transformations', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .transformBuildMethod(builder => builder.insertBefore('return {', 'this.validate();'))
        .build();

      expect(plugin.transformBuildMethod).toBeDefined();
      expect(typeof plugin.transformBuildMethod).toBe('function');
    });

    test('should add custom methods', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .addMethod(builder =>
          builder
            .name('withEmail')
            .parameters([{ name: 'email', type: 'string' }])
            .returns('this')
            .implementation('return this.email(email);'),
        )
        .build();

      expect(plugin.addCustomMethods).toBeDefined();
      expect(typeof plugin.addCustomMethods).toBe('function');
    });
  });

  describe('method signature and implementation building', () => {
    test('should build method signature with parameters', () => {
      const builder = new PluginBuilder('test', '1.0.0');

      // Access private method via type assertion for testing
      const buildMethodSignature = (builder as any).buildMethodSignature;
      const methodDef = {
        name: 'withData',
        parameters: [
          { name: 'data', type: 'string' },
          { name: 'optional', type: 'boolean', isOptional: true },
          { name: 'withDefault', type: 'number', isOptional: true, defaultValue: '42' },
        ],
      };

      const signature = buildMethodSignature.call(builder, methodDef);
      expect(signature).toBe('(data: string, optional?: boolean, withDefault?: number = 42)');
    });

    test('should build method implementation', () => {
      const builder = new PluginBuilder('test', '1.0.0');

      // Access private method via type assertion for testing
      const buildMethodImplementation = (builder as any).buildMethodImplementation;
      const methodDef = {
        name: 'withData',
        parameters: [{ name: 'data', type: 'string' }],
        returnType: 'this',
        implementation: 'return this.setData(data);',
      };

      const implementation = buildMethodImplementation.call(builder, methodDef);
      expect(implementation).toContain('withData(data: string): this');
      expect(implementation).toContain('return this.setData(data);');
    });

    test('should handle existing method implementation', () => {
      const builder = new PluginBuilder('test', '1.0.0');

      // Access private method via type assertion for testing
      const buildMethodImplementation = (builder as any).buildMethodImplementation;
      const methodDef = {
        name: 'customMethod',
        parameters: [],
        implementation: 'customMethod(): this { return this; }',
      };

      const implementation = buildMethodImplementation.call(builder, methodDef);
      expect(implementation).toBe('customMethod(): this { return this; }');
    });
  });

  describe('method chaining', () => {
    test('should support fluent method chaining', () => {
      const builder = createPlugin('test-plugin', '1.0.0');

      const result = builder
        .setDescription('Test plugin')
        .beforeParse(ctx => ok(ctx))
        .afterParse((ctx, type) => ok(type))
        .beforeResolve(ctx => ok(ctx))
        .afterResolve((ctx, typeInfo) => ok(typeInfo))
        .beforeGenerate(ctx => ok(ctx))
        .afterGenerate((code, _ctx) => ok(code))
        .transformType((type, typeInfo) => ok(typeInfo))
        .transformProperty(property => ok(property))
        .transformImports(ctx => ok(ctx));

      expect(result).toBe(builder);
    });

    test('should support transform builder chaining', () => {
      const builder = createPlugin('test-plugin', '1.0.0');

      const result = builder
        .transformPropertyMethods(b =>
          b
            .when(() => true)
            .setParameter('string')
            .done(),
        )
        .transformValues(b =>
          b
            .when(() => true)
            .transform('value')
            .done(),
        )
        .transformBuildMethod(b => b.insertBefore('return', 'validate()'))
        .addMethod(b => b.name('test').implementation('return this;'));

      expect(result).toBe(builder);
    });
  });

  describe('comprehensive plugin building', () => {
    test('should build plugin with all features', () => {
      const plugin = createPlugin('comprehensive-plugin', '2.0.0')
        .setDescription('A comprehensive test plugin')
        .requireImports(manager =>
          manager
            .addInternal('../types.js', ['InternalType'])
            .addExternal('@test/lib', ['ExternalType']),
        )
        .beforeParse(ctx => ok(ctx))
        .afterParse((ctx, type) => ok(type))
        .beforeResolve(ctx => ok(ctx))
        .afterResolve((ctx, typeInfo) => ok(typeInfo))
        .beforeGenerate(ctx => ok(ctx))
        .afterGenerate((code, _ctx) => ok(code))
        .transformType((type, typeInfo) => ok(typeInfo))
        .transformProperty(property => ok(property))
        .transformPropertyMethods(builder =>
          builder
            .when(() => true)
            .setParameter('string | TaggedValue<string>')
            .done(),
        )
        .transformValues(builder =>
          builder
            .when(() => true)
            .transform('value.trim()')
            .done(),
        )
        .transformBuildMethod(builder => builder.insertBefore('return {', 'this.validate();'))
        .addMethod(builder =>
          builder
            .name('withEmail')
            .parameters([{ name: 'email', type: 'string' }])
            .returns('this')
            .implementation('return this.email(email);')
            .jsDoc('Sets the email property'),
        )
        .transformImports(ctx => ok(ctx))
        .build();

      expect(plugin.name).toBe('comprehensive-plugin');
      expect(plugin.version).toBe('2.0.0');
      expect(plugin.description).toBe('A comprehensive test plugin');
      expect(plugin.imports).toBeDefined();
      expect(plugin.beforeParse).toBeDefined();
      expect(plugin.afterParse).toBeDefined();
      expect(plugin.beforeResolve).toBeDefined();
      expect(plugin.afterResolve).toBeDefined();
      expect(plugin.beforeGenerate).toBeDefined();
      expect(plugin.afterGenerate).toBeDefined();
      expect(plugin.transformType).toBeDefined();
      expect(plugin.transformProperty).toBeDefined();
      expect(plugin.transformPropertyMethod).toBeDefined();
      expect(plugin.transformValue).toBeDefined();
      expect(plugin.transformBuildMethod).toBeDefined();
      expect(plugin.addCustomMethods).toBeDefined();
      expect(plugin.transformImports).toBeDefined();
    });
  });

  describe('conditional custom methods with when()', () => {
    test('should filter custom methods based on predicate', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .addMethod(builder =>
          builder
            .when(ctx => ctx.builderName === 'UserBuilder')
            .name('withEmail')
            .implementation('return this.email(email);'),
        )
        .addMethod(builder =>
          builder
            .when(ctx => ctx.builderName === 'ProductBuilder')
            .name('withPrice')
            .implementation('return this.price(price);'),
        )
        .build();

      expect(plugin.addCustomMethods).toBeDefined();

      if (plugin.addCustomMethods) {
        const userContext: BuilderContext = {
          builderName: 'UserBuilder',
          typeName: 'User',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          genericParams: '',
          genericConstraints: '',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        const productContext: BuilderContext = {
          builderName: 'ProductBuilder',
          typeName: 'Product',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          genericParams: '',
          genericConstraints: '',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        const userMethods = plugin.addCustomMethods(userContext);
        const productMethods = plugin.addCustomMethods(productContext);

        expect(userMethods.ok).toBe(true);
        if (userMethods.ok) {
          expect(userMethods.value).toHaveLength(1);
          expect(userMethods.value[0]!.name).toBe('withEmail');
        }

        expect(productMethods.ok).toBe(true);
        if (productMethods.ok) {
          expect(productMethods.value).toHaveLength(1);
          expect(productMethods.value[0]!.name).toBe('withPrice');
        }
      }
    });

    test('should include methods without predicate for all contexts', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .addMethod(builder =>
          builder
            .when(ctx => ctx.builderName === 'UserBuilder')
            .name('withEmail')
            .implementation('return this.email(email);'),
        )
        .addMethod(builder => builder.name('common').implementation('return this;'))
        .build();

      expect(plugin.addCustomMethods).toBeDefined();

      if (plugin.addCustomMethods) {
        const userContext: BuilderContext = {
          builderName: 'UserBuilder',
          typeName: 'User',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          genericParams: '',
          genericConstraints: '',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        const productContext: BuilderContext = {
          builderName: 'ProductBuilder',
          typeName: 'Product',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          genericParams: '',
          genericConstraints: '',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        const userMethods = plugin.addCustomMethods(userContext);
        const productMethods = plugin.addCustomMethods(productContext);

        expect(userMethods.ok).toBe(true);
        if (userMethods.ok) {
          expect(userMethods.value).toHaveLength(2);
          expect(userMethods.value.map(m => m.name)).toEqual(['withEmail', 'common']);
        }

        expect(productMethods.ok).toBe(true);
        if (productMethods.ok) {
          expect(productMethods.value).toHaveLength(1);
          expect(productMethods.value.map(m => m.name)).toEqual(['common']);
        }
      }
    });

    test('should return empty array when no methods match', () => {
      const plugin = createPlugin('test-plugin', '1.0.0')
        .addMethod(builder =>
          builder
            .when(ctx => ctx.builderName === 'UserBuilder')
            .name('withEmail')
            .implementation('return this.email(email);'),
        )
        .build();

      expect(plugin.addCustomMethods).toBeDefined();

      if (plugin.addCustomMethods) {
        const productContext: BuilderContext = {
          builderName: 'ProductBuilder',
          typeName: 'Product',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          genericParams: '',
          genericConstraints: '',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        const result = plugin.addCustomMethods(productContext);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toHaveLength(0);
        }
      }
    });
  });
});
