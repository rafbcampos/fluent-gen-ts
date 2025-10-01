import { describe, it, expect } from 'vitest';
import * as PublicAPI from '../index.js';

describe('Public API exports', () => {
  describe('Main programmatic API', () => {
    it('exports FluentGen class', () => {
      expect(PublicAPI.FluentGen).toBeDefined();
      expect(typeof PublicAPI.FluentGen).toBe('function');
    });
  });

  describe('Code generation', () => {
    it('exports BuilderGenerator class', () => {
      expect(PublicAPI.BuilderGenerator).toBeDefined();
      expect(typeof PublicAPI.BuilderGenerator).toBe('function');
    });
  });

  describe('Type extraction and analysis', () => {
    it('exports TypeExtractor class', () => {
      expect(PublicAPI.TypeExtractor).toBeDefined();
      expect(typeof PublicAPI.TypeExtractor).toBe('function');
    });
  });

  describe('Result handling', () => {
    it('exports ok function', () => {
      expect(PublicAPI.ok).toBeDefined();
      expect(typeof PublicAPI.ok).toBe('function');
    });

    it('exports err function', () => {
      expect(PublicAPI.err).toBeDefined();
      expect(typeof PublicAPI.err).toBe('function');
    });

    it('exports isOk function', () => {
      expect(PublicAPI.isOk).toBeDefined();
      expect(typeof PublicAPI.isOk).toBe('function');
    });

    it('exports isErr function', () => {
      expect(PublicAPI.isErr).toBeDefined();
      expect(typeof PublicAPI.isErr).toBe('function');
    });

    it('ok and isOk work correctly', () => {
      const result = PublicAPI.ok(42);
      expect(PublicAPI.isOk(result)).toBe(true);
      expect(PublicAPI.isErr(result)).toBe(false);
      if (PublicAPI.isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('err and isErr work correctly', () => {
      const result = PublicAPI.err('error message');
      expect(PublicAPI.isErr(result)).toBe(true);
      expect(PublicAPI.isOk(result)).toBe(false);
      if (PublicAPI.isErr(result)) {
        expect(result.error).toBe('error message');
      }
    });
  });

  describe('Plugin system', () => {
    it('exports plugin builder functions', () => {
      expect(PublicAPI.createPlugin).toBeDefined();
      expect(typeof PublicAPI.createPlugin).toBe('function');
    });

    it('exports type matcher builder functions', () => {
      expect(PublicAPI.literal).toBeDefined();
      expect(typeof PublicAPI.literal).toBe('function');

      expect(PublicAPI.primitive).toBeDefined();
      expect(typeof PublicAPI.primitive).toBe('function');

      expect(PublicAPI.array).toBeDefined();
      expect(typeof PublicAPI.array).toBe('function');

      expect(PublicAPI.object).toBeDefined();
      expect(typeof PublicAPI.object).toBe('function');

      expect(PublicAPI.union).toBeDefined();
      expect(typeof PublicAPI.union).toBe('function');

      expect(PublicAPI.intersection).toBeDefined();
      expect(typeof PublicAPI.intersection).toBe('function');

      expect(PublicAPI.generic).toBeDefined();
      expect(typeof PublicAPI.generic).toBe('function');

      expect(PublicAPI.reference).toBeDefined();
      expect(typeof PublicAPI.reference).toBe('function');
    });

    it('creates a basic plugin correctly', () => {
      const plugin = PublicAPI.createPlugin('test-plugin', '1.0.0').build();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    it('creates a type matcher correctly', () => {
      const matcher = PublicAPI.literal('test');
      expect(matcher).toBeDefined();
    });
  });

  describe('Runtime utilities for generated builders', () => {
    it('exports FLUENT_BUILDER_SYMBOL', () => {
      expect(PublicAPI.FLUENT_BUILDER_SYMBOL).toBeDefined();
      expect(typeof PublicAPI.FLUENT_BUILDER_SYMBOL).toBe('symbol');
    });

    it('exports isFluentBuilder function', () => {
      expect(PublicAPI.isFluentBuilder).toBeDefined();
      expect(typeof PublicAPI.isFluentBuilder).toBe('function');
    });

    it('exports isBuilderArray function', () => {
      expect(PublicAPI.isBuilderArray).toBeDefined();
      expect(typeof PublicAPI.isBuilderArray).toBe('function');
    });

    it('exports createNestedContext function', () => {
      expect(PublicAPI.createNestedContext).toBeDefined();
      expect(typeof PublicAPI.createNestedContext).toBe('function');
    });

    it('exports resolveValue function', () => {
      expect(PublicAPI.resolveValue).toBeDefined();
      expect(typeof PublicAPI.resolveValue).toBe('function');
    });

    it('isFluentBuilder identifies builder objects correctly', () => {
      const nonBuilder = { foo: 'bar' };
      expect(PublicAPI.isFluentBuilder(nonBuilder)).toBe(false);

      const builder = {
        [PublicAPI.FLUENT_BUILDER_SYMBOL]: true,
        build: () => ({ result: 'value' }),
      };
      expect(PublicAPI.isFluentBuilder(builder)).toBe(true);
    });

    it('isBuilderArray identifies builder arrays correctly', () => {
      const nonBuilderArray = [{ foo: 'bar' }];
      expect(PublicAPI.isBuilderArray(nonBuilderArray)).toBe(false);

      const builderArray = [
        {
          [PublicAPI.FLUENT_BUILDER_SYMBOL]: true,
          build: () => ({ id: 1 }),
        },
      ];
      expect(PublicAPI.isBuilderArray(builderArray)).toBe(true);

      const emptyArray: unknown[] = [];
      expect(PublicAPI.isBuilderArray(emptyArray)).toBe(true);
    });

    it('resolveValue resolves non-builder values', () => {
      const value = { foo: 'bar' };
      const resolved = PublicAPI.resolveValue(value);
      expect(resolved).toEqual({ foo: 'bar' });
    });

    it('resolveValue resolves builder objects', () => {
      const builder = {
        [PublicAPI.FLUENT_BUILDER_SYMBOL]: true,
        build: () => ({ result: 'value' }),
      };
      const resolved = PublicAPI.resolveValue(builder);
      expect(resolved).toEqual({ result: 'value' });
    });

    it('resolveValue resolves arrays with builders', () => {
      const builderArray = [
        { [PublicAPI.FLUENT_BUILDER_SYMBOL]: true, build: () => ({ id: 1 }) },
        { [PublicAPI.FLUENT_BUILDER_SYMBOL]: true, build: () => ({ id: 2 }) },
      ];
      const resolved = PublicAPI.resolveValue(builderArray);
      expect(resolved).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('resolveValue resolves nested objects with builders', () => {
      const nested = {
        user: {
          [PublicAPI.FLUENT_BUILDER_SYMBOL]: true,
          build: () => ({ name: 'John' }),
        },
        items: [
          { [PublicAPI.FLUENT_BUILDER_SYMBOL]: true, build: () => ({ id: 1 }) },
          { [PublicAPI.FLUENT_BUILDER_SYMBOL]: true, build: () => ({ id: 2 }) },
        ],
      };
      const resolved = PublicAPI.resolveValue(nested);
      expect(resolved).toEqual({
        user: { name: 'John' },
        items: [{ id: 1 }, { id: 2 }],
      });
    });
  });

  describe('Integration: plugin system with type matchers', () => {
    it('creates a plugin with property method transformations', () => {
      const plugin = PublicAPI.createPlugin('uuid-plugin', '1.0.0')
        .transformPropertyMethods(builder =>
          builder
            .when(ctx => ctx.property.name === 'id')
            .setParameter('UUID')
            .done(),
        )
        .build();

      expect(plugin.name).toBe('uuid-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.transformPropertyMethod).toBeDefined();
    });

    it('creates plugin with import manager', () => {
      const plugin = PublicAPI.createPlugin('import-plugin', '1.0.0')
        .requireImports(manager => manager.addExternal('uuid', ['UUID']))
        .build();

      expect(plugin.imports).toBeDefined();
      expect(plugin.imports?.imports).toHaveLength(1);
    });

    it('creates plugin with value transformations', () => {
      const plugin = PublicAPI.createPlugin('value-plugin', '1.0.0')
        .transformValues(builder =>
          builder
            .when(ctx => ctx.typeChecker.isPrimitive('string'))
            .transform('value.trim()')
            .done(),
        )
        .build();

      expect(plugin.transformValue).toBeDefined();
    });
  });
});
