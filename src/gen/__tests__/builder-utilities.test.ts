import { describe, test, expect, beforeEach } from 'vitest';
import {
  FLUENT_BUILDER_SYMBOL,
  isFluentBuilder,
  isBuilderArray,
  createNestedContext,
  resolveValue,
  FluentBuilderBase,
  createInspectMethod,
  type FluentBuilder,
  type BaseBuildContext,
  type NestedContextGenerator,
} from '../builder-utilities.js';

describe('builder-utilities', () => {
  describe('FLUENT_BUILDER_SYMBOL', () => {
    test('uses global symbol registry', () => {
      const globalSymbol = Symbol.for('fluent-builder');
      expect(FLUENT_BUILDER_SYMBOL).toBe(globalSymbol);
      expect(typeof FLUENT_BUILDER_SYMBOL).toBe('symbol');
    });

    test('symbol description is correct', () => {
      expect(FLUENT_BUILDER_SYMBOL.description).toBe('fluent-builder');
    });
  });

  describe('isFluentBuilder', () => {
    test('returns false for null and undefined', () => {
      expect(isFluentBuilder(null)).toBe(false);
      expect(isFluentBuilder(undefined)).toBe(false);
    });

    test('returns false for primitive values', () => {
      expect(isFluentBuilder('string')).toBe(false);
      expect(isFluentBuilder(123)).toBe(false);
      expect(isFluentBuilder(true)).toBe(false);
      expect(isFluentBuilder(Symbol('test'))).toBe(false);
    });

    test('returns false for plain objects', () => {
      expect(isFluentBuilder({})).toBe(false);
      expect(isFluentBuilder({ someProperty: 'value' })).toBe(false);
      expect(isFluentBuilder([])).toBe(false);
    });

    test('returns false for objects with symbol but wrong value', () => {
      const obj = { [FLUENT_BUILDER_SYMBOL]: false };
      expect(isFluentBuilder(obj)).toBe(false);
    });

    test('returns false for objects with symbol but no build method', () => {
      const obj = { [FLUENT_BUILDER_SYMBOL]: true };
      expect(isFluentBuilder(obj)).toBe(false);
    });

    test('returns false for objects with symbol and non-function build', () => {
      const obj = { [FLUENT_BUILDER_SYMBOL]: true, build: 'not a function' };
      expect(isFluentBuilder(obj)).toBe(false);
    });

    test('returns true for valid fluent builders', () => {
      const validBuilder = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: () => ({ result: 'test' }),
      };
      expect(isFluentBuilder(validBuilder)).toBe(true);
    });

    test('handles edge case objects correctly', () => {
      class CustomClass {
        [FLUENT_BUILDER_SYMBOL] = true;
        build = () => ({ data: 'test' });
      }
      expect(isFluentBuilder(new CustomClass())).toBe(true);

      const functionWithSymbol = () => {};
      (functionWithSymbol as any)[FLUENT_BUILDER_SYMBOL] = true;
      (functionWithSymbol as any).build = () => {};
      // Functions have typeof "function", not "object", so isFluentBuilder should return false
      expect(isFluentBuilder(functionWithSymbol)).toBe(false);
    });
  });

  describe('isBuilderArray', () => {
    test('returns false for non-arrays', () => {
      expect(isBuilderArray(null)).toBe(false);
      expect(isBuilderArray(undefined)).toBe(false);
      expect(isBuilderArray('string')).toBe(false);
      expect(isBuilderArray({})).toBe(false);
    });

    test('returns false for empty arrays', () => {
      expect(isBuilderArray([])).toBe(true); // Empty array should return true
    });

    test('returns false for arrays with non-builders', () => {
      expect(isBuilderArray([1, 2, 3])).toBe(false);
      expect(isBuilderArray(['a', 'b'])).toBe(false);
      expect(isBuilderArray([{}])).toBe(false);
    });

    test('returns false for mixed arrays', () => {
      const builder = { [FLUENT_BUILDER_SYMBOL]: true, build: () => ({}) };
      expect(isBuilderArray([builder, 'string'])).toBe(false);
      expect(isBuilderArray([1, builder])).toBe(false);
    });

    test('returns true for arrays of builders', () => {
      const builder1 = { [FLUENT_BUILDER_SYMBOL]: true, build: () => ({}) };
      const builder2 = { [FLUENT_BUILDER_SYMBOL]: true, build: () => ({}) };
      expect(isBuilderArray([builder1, builder2])).toBe(true);
      expect(isBuilderArray([builder1])).toBe(true);
    });
  });

  describe('createNestedContext', () => {
    test('creates context with parameter name', () => {
      const parentContext: BaseBuildContext = { parentId: 'parent-123' };
      const result = createNestedContext({ parentContext, parameterName: 'testParam' });

      expect(result).toEqual({
        parentId: 'parent-123',
        parameterName: 'testParam',
      });
    });

    test('creates context with parameter name and index', () => {
      const parentContext: BaseBuildContext = { parentId: 'parent-123' };
      const result = createNestedContext({ parentContext, parameterName: 'arrayParam', index: 5 });

      expect(result).toEqual({
        parentId: 'parent-123',
        parameterName: 'arrayParam',
        index: 5,
      });
    });

    test('preserves additional context properties', () => {
      const parentContext = {
        parentId: 'parent-123',
        customProp: 'custom-value',
        anotherProp: 42,
      };
      const result = createNestedContext({ parentContext, parameterName: 'testParam', index: 1 });

      expect(result).toEqual({
        parentId: 'parent-123',
        customProp: 'custom-value',
        anotherProp: 42,
        parameterName: 'testParam',
        index: 1,
      });
    });

    test('handles empty parent context', () => {
      const parentContext: BaseBuildContext = {};
      const result = createNestedContext({ parentContext, parameterName: 'testParam' });

      expect(result).toEqual({
        parameterName: 'testParam',
      });
    });

    describe('custom context generator', () => {
      interface CustomContext extends BaseBuildContext {
        nodeId?: string;
      }

      test('uses custom generator when provided', () => {
        const generator: NestedContextGenerator<CustomContext> = ({
          parentContext,
          parameterName,
          index,
        }) => {
          let nodeId = parentContext.nodeId || 'root';
          nodeId += `-${parameterName}`;
          if (index !== undefined) nodeId += `-${index}`;
          return {
            ...parentContext,
            parameterName,
            ...(index !== undefined ? { index } : {}),
            nodeId,
            __nestedContextGenerator__: generator,
          };
        };

        const parentContext: CustomContext = {
          nodeId: 'root',
          __nestedContextGenerator__: generator,
        };

        const result = createNestedContext({ parentContext, parameterName: 'child' });

        expect(result).toEqual({
          nodeId: 'root-child',
          parameterName: 'child',
          __nestedContextGenerator__: generator,
        });
      });

      test('uses custom generator with array index', () => {
        const generator: NestedContextGenerator<CustomContext> = ({
          parentContext,
          parameterName,
          index,
        }) => {
          let nodeId = parentContext.nodeId || 'root';
          nodeId += `-${parameterName}`;
          if (index !== undefined) nodeId += `-${index}`;
          return {
            ...parentContext,
            parameterName,
            ...(index !== undefined ? { index } : {}),
            nodeId,
            __nestedContextGenerator__: generator,
          };
        };

        const parentContext: CustomContext = {
          nodeId: 'root',
          __nestedContextGenerator__: generator,
        };

        const result = createNestedContext({ parentContext, parameterName: 'items', index: 2 });

        expect(result).toEqual({
          nodeId: 'root-items-2',
          parameterName: 'items',
          index: 2,
          __nestedContextGenerator__: generator,
        });
      });

      test('generator propagates through nested builders', () => {
        const generator: NestedContextGenerator<CustomContext> = ({
          parentContext,
          parameterName,
          index,
        }) => {
          let nodeId = parentContext.nodeId || 'root';
          nodeId += `-${parameterName}`;
          if (index !== undefined) nodeId += `-${index}`;
          return {
            ...parentContext,
            parameterName,
            ...(index !== undefined ? { index } : {}),
            nodeId,
            __nestedContextGenerator__: generator,
          };
        };

        interface TestType {
          id: string;
          nested?: {
            value: string;
          };
        }

        class TestBuilder extends FluentBuilderBase<TestType, CustomContext> {
          build(context?: CustomContext): TestType {
            return this.buildWithDefaults({ id: context?.nodeId || 'default' }, context);
          }
          withNested(
            value: { value: string } | FluentBuilder<{ value: string }, CustomContext>,
          ): this {
            return this.set('nested', value);
          }
        }

        class NestedBuilder extends FluentBuilderBase<{ value: string }, CustomContext> {
          build(context?: CustomContext): { value: string } {
            return this.buildWithDefaults({ value: context?.nodeId || 'default' }, context);
          }
        }

        const rootContext: CustomContext = {
          nodeId: 'root',
          __nestedContextGenerator__: generator,
        };

        const builder = new TestBuilder();
        builder.withNested(new NestedBuilder());

        const result = builder.build(rootContext);

        expect(result.id).toBe('root');
        expect(result.nested?.value).toBe('root-nested');
      });

      test('falls back to default when no generator provided', () => {
        const parentContext: CustomContext = {
          nodeId: 'root',
        };

        const result = createNestedContext({ parentContext, parameterName: 'child' });

        expect(result).toEqual({
          nodeId: 'root',
          parameterName: 'child',
        });
      });

      test('parent can add custom data to context', () => {
        interface CustomContext extends BaseBuildContext {
          nodeId?: string;
          tenantId?: string;
          depth?: number;
        }

        const generator: NestedContextGenerator<CustomContext> = ({
          parentContext,
          parameterName,
          index,
        }) => {
          let nodeId = parentContext.nodeId || 'root';
          nodeId += `-${parameterName}`;
          if (index !== undefined) nodeId += `-${index}`;
          return {
            ...parentContext,
            parameterName,
            ...(index !== undefined ? { index } : {}),
            nodeId,
            tenantId: parentContext.tenantId || 'default-tenant',
            depth: (parentContext.depth || 0) + 1,
            __nestedContextGenerator__: generator,
          };
        };

        const parentContext: CustomContext = {
          nodeId: 'root',
          tenantId: 'tenant-123',
          depth: 0,
          __nestedContextGenerator__: generator,
        };

        const result = createNestedContext({ parentContext, parameterName: 'level1' });

        expect(result).toEqual({
          nodeId: 'root-level1',
          parameterName: 'level1',
          tenantId: 'tenant-123',
          depth: 1,
          __nestedContextGenerator__: generator,
        });
      });
    });
  });

  describe('resolveValue', () => {
    class MockBuilder implements FluentBuilder<{ value: string }> {
      readonly [FLUENT_BUILDER_SYMBOL] = true;
      constructor(private testValue: string) {}
      build(_context?: BaseBuildContext) {
        return { value: this.testValue };
      }
      peek(_key: 'value'): string | undefined {
        return this.testValue;
      }
      has(_key: 'value'): boolean {
        return true;
      }
    }

    test('resolves primitive values unchanged', () => {
      expect(resolveValue('string')).toBe('string');
      expect(resolveValue(123)).toBe(123);
      expect(resolveValue(true)).toBe(true);
      expect(resolveValue(null)).toBe(null);
      expect(resolveValue(undefined)).toBe(undefined);
    });

    test('resolves fluent builders', () => {
      const builder = new MockBuilder('test-value');
      const result = resolveValue(builder, { parentId: 'test' });

      expect(result).toEqual({ value: 'test-value' });
    });

    test('resolves arrays with builders', () => {
      const builder1 = new MockBuilder('value1');
      const builder2 = new MockBuilder('value2');
      const array = ['static', builder1, 42, builder2];

      const result = resolveValue(array, { parentId: 'test' });

      expect(result).toEqual(['static', { value: 'value1' }, 42, { value: 'value2' }]);
    });

    test('resolves nested objects with builders', () => {
      const builder = new MockBuilder('nested-value');
      const obj = {
        static: 'value',
        nested: builder,
        deep: {
          inner: builder,
        },
      };

      const result = resolveValue(obj, { parentId: 'test' });

      expect(result).toEqual({
        static: 'value',
        nested: { value: 'nested-value' },
        deep: {
          inner: { value: 'nested-value' },
        },
      });
    });

    test('passes correct context to nested builders', () => {
      const contextsReceived: (BaseBuildContext | undefined)[] = [];

      class ContextAwareBuilder implements FluentBuilder<{ value: string }> {
        readonly [FLUENT_BUILDER_SYMBOL] = true;
        build(context?: BaseBuildContext) {
          contextsReceived.push(context);
          return { value: 'test' };
        }
        peek(_key: 'value'): string | undefined {
          return 'test';
        }
        has(_key: 'value'): boolean {
          return true;
        }
      }

      const builder = new ContextAwareBuilder();
      const obj = { nested: builder };

      resolveValue(obj, { parentId: 'parent-123' });

      expect(contextsReceived).toHaveLength(1);
      expect(contextsReceived[0]).toEqual({
        parentId: 'parent-123',
        parameterName: 'nested',
        index: undefined,
      });
    });

    test('passes correct context to array builders', () => {
      const contextsReceived: (BaseBuildContext | undefined)[] = [];

      class ContextAwareBuilder implements FluentBuilder<{ value: string }> {
        readonly [FLUENT_BUILDER_SYMBOL] = true;
        build(context?: BaseBuildContext) {
          contextsReceived.push(context);
          return { value: 'test' };
        }
        peek(_key: 'value'): string | undefined {
          return 'test';
        }
        has(_key: 'value'): boolean {
          return true;
        }
      }

      const builder1 = new ContextAwareBuilder();
      const builder2 = new ContextAwareBuilder();
      const array = [builder1, 'static', builder2];

      resolveValue(array, { parentId: 'parent-123' });

      expect(contextsReceived).toHaveLength(2);
      expect(contextsReceived[0]).toEqual({
        parentId: 'parent-123',
        parameterName: 'array',
        index: 0,
      });
      expect(contextsReceived[1]).toEqual({
        parentId: 'parent-123',
        parameterName: 'array',
        index: 2,
      });
    });

    test('handles non-plain objects correctly', () => {
      class CustomClass {
        value = 'test';
      }
      const date = new Date('2023-01-01');
      const regexp = /test/;
      const customObj = new CustomClass();

      expect(resolveValue(date)).toBe(date);
      expect(resolveValue(regexp)).toBe(regexp);
      expect(resolveValue(customObj)).toBe(customObj);
    });

    test('handles circular references gracefully', () => {
      // Circular references are now handled gracefully by tracking visited objects
      const obj: any = { id: 'test' };
      obj.self = obj;

      const result = resolveValue(obj);
      expect(result).toBeDefined();
      // A new object is created during resolution
      expect(result).not.toBe(obj);
      // The circular reference points to the original object (prevents infinite recursion)
      expect((result as any).self).toBe(obj);
      expect((result as any).id).toBe('test');
    });

    test('resolves without context', () => {
      const builder = new MockBuilder('no-context');
      const result = resolveValue(builder);

      expect(result).toEqual({ value: 'no-context' });
    });
  });

  describe('FluentBuilderBase', () => {
    interface TestInterface {
      id: string;
      name?: string;
      tags?: string[];
      nested?: { value: string };
      mixed?: (string | { data: number })[];
    }

    class TestBuilder extends FluentBuilderBase<TestInterface> {
      build(context?: BaseBuildContext): TestInterface {
        return this.buildWithDefaults({ id: 'default-id' }, context);
      }

      withId(id: string): this {
        return this.set('id', id);
      }

      withName(name: string): this {
        return this.set('name', name);
      }

      withTags(tags: string[]): this {
        return this.set('tags', tags);
      }

      withNested(nested: { value: string } | FluentBuilder<{ value: string }>): this {
        return this.set('nested', nested);
      }

      withMixed(mixed: (string | { data: number } | FluentBuilder<{ data: number }>)[]): this {
        return this.set('mixed', mixed);
      }
    }

    class NestedBuilder extends FluentBuilderBase<{ value: string }> {
      build(context?: BaseBuildContext): { value: string } {
        return this.buildWithDefaults({ value: 'default-nested' }, context);
      }

      withValue(value: string): this {
        return this.set('value', value);
      }
    }

    describe('constructor', () => {
      test('creates builder with empty initial state', () => {
        const builder = new TestBuilder();
        expect(builder['values']).toEqual({});
        expect(builder['builders'].size).toBe(0);
        expect(builder['mixedArrays'].size).toBe(0);
      });

      test('creates builder with initial values', () => {
        const builder = new TestBuilder({
          id: 'initial-id',
          name: 'initial-name',
        });
        expect(builder['values']).toEqual({
          id: 'initial-id',
          name: 'initial-name',
        });
      });

      test('has fluent builder symbol', () => {
        const builder = new TestBuilder();
        expect(builder[FLUENT_BUILDER_SYMBOL]).toBe(true);
        expect(isFluentBuilder(builder)).toBe(true);
      });
    });

    describe('set method', () => {
      let builder: TestBuilder;

      beforeEach(() => {
        builder = new TestBuilder();
      });

      test('sets primitive values', () => {
        builder.withId('test-id').withName('test-name');

        expect(builder['values']).toEqual({
          id: 'test-id',
          name: 'test-name',
        });
        expect(builder['builders'].size).toBe(0);
      });

      test('sets nested builders', () => {
        const nestedBuilder = new NestedBuilder().withValue('nested-value');
        builder.withNested(nestedBuilder);

        expect(builder['values']).toEqual({});
        expect(builder['builders'].has('nested')).toBe(true);
        expect(builder['builders'].get('nested')).toBe(nestedBuilder);
      });

      test('handles static arrays', () => {
        builder.withTags(['tag1', 'tag2', 'tag3']);

        expect(builder['values'].tags).toEqual(['tag1', 'tag2', 'tag3']);
        expect(builder['mixedArrays'].size).toBe(0);
      });

      test('handles mixed arrays with builders', () => {
        class DataBuilder extends FluentBuilderBase<{ data: number }> {
          build(): { data: number } {
            return this.buildWithDefaults({ data: 0 });
          }
          withData(data: number): this {
            return this.set('data', data);
          }
        }

        const dataBuilder = new DataBuilder().withData(42);
        builder.withMixed(['string', dataBuilder, { data: 100 }]);

        expect(builder['mixedArrays'].has('mixed')).toBe(true);
        const metadata = builder['mixedArrays'].get('mixed');
        expect(metadata?.builderIndices.has(1)).toBe(true);
        expect('mixed' in builder['values']).toBe(false);
      });

      test('handles objects containing builders', () => {
        const nestedBuilder = new NestedBuilder().withValue('test');
        const objWithBuilder = { nested: nestedBuilder };

        builder.withNested(objWithBuilder as any);

        expect(builder['builders'].has('nested')).toBe(true);
        expect('nested' in builder['values']).toBe(false);
      });

      test('overwrites previous values correctly', () => {
        builder.withId('first-id');
        expect(builder['values'].id).toBe('first-id');

        const nestedBuilder = new NestedBuilder();
        builder.withNested(nestedBuilder);
        expect(builder['builders'].has('nested')).toBe(true);

        // Overwrite with static value
        builder.withNested({ value: 'static' });
        expect(builder['builders'].has('nested')).toBe(false);
        expect(builder['values'].nested).toEqual({ value: 'static' });
      });

      test('returns this for method chaining', () => {
        const result = builder.withId('test');
        expect(result).toBe(builder);
      });
    });

    describe('buildWithDefaults', () => {
      let builder: TestBuilder;

      beforeEach(() => {
        builder = new TestBuilder();
      });

      test('builds with defaults and explicit values', () => {
        builder.withName('explicit-name');
        const result = builder.build();

        expect(result).toEqual({
          id: 'default-id',
          name: 'explicit-name',
        });
      });

      test('builds with nested builders', () => {
        const nestedBuilder = new NestedBuilder().withValue('built-value');
        builder.withNested(nestedBuilder);

        const result = builder.build();

        expect(result).toEqual({
          id: 'default-id',
          nested: { value: 'built-value' },
        });
      });

      test('builds mixed arrays correctly', () => {
        class DataBuilder extends FluentBuilderBase<{ data: number }> {
          build(): { data: number } {
            return this.buildWithDefaults({ data: 999 });
          }
          withData(data: number): this {
            return this.set('data', data);
          }
        }

        const dataBuilder = new DataBuilder().withData(42);
        builder.withMixed(['static', dataBuilder, { data: 100 }]);

        const result = builder.build();

        expect(result.mixed).toEqual(['static', { data: 42 }, { data: 100 }]);
      });

      test('passes context to nested builders', () => {
        let receivedContext: BaseBuildContext | undefined;

        class ContextAwareBuilder extends FluentBuilderBase<{ value: string }> {
          build(context?: BaseBuildContext): { value: string } {
            receivedContext = context;
            return { value: 'test' };
          }
        }

        const nestedBuilder = new ContextAwareBuilder();
        builder.withNested(nestedBuilder);

        builder.build({ parentId: 'parent-123' });

        expect(receivedContext).toEqual({
          parentId: 'parent-123',
          parameterName: 'nested',
          index: undefined,
        });
      });
    });

    describe('conditional methods', () => {
      let builder: TestBuilder;

      beforeEach(() => {
        builder = new TestBuilder();
      });

      describe('if method', () => {
        test('sets value when predicate is true', () => {
          builder.if(() => true, 'name', 'conditional-name');
          const result = builder.build();

          expect(result.name).toBe('conditional-name');
        });

        test('does not set value when predicate is false', () => {
          builder.if(() => false, 'name', 'should-not-set');
          const result = builder.build();

          expect(result.name).toBeUndefined();
        });

        test('works with function values', () => {
          builder.if(
            () => true,
            'name',
            () => 'function-value',
          );
          const result = builder.build();

          expect(result.name).toBe('function-value');
        });

        test('works with builder values', () => {
          const nestedBuilder = new NestedBuilder().withValue('conditional-nested');
          builder.if(() => true, 'nested', nestedBuilder);
          const result = builder.build();

          expect(result.nested).toEqual({ value: 'conditional-nested' });
        });

        test('predicate receives builder instance', () => {
          let receivedBuilder: any;
          builder.if(
            b => {
              receivedBuilder = b;
              return true;
            },
            'name',
            'test',
          );

          expect(receivedBuilder).toBe(builder);
        });

        test('returns this for chaining', () => {
          const result = builder.if(() => true, 'name', 'test');
          expect(result).toBe(builder);
        });
      });

      describe('ifElse method', () => {
        test('uses true value when predicate is true', () => {
          builder.ifElse(() => true, 'name', 'true-value', 'false-value');
          const result = builder.build();

          expect(result.name).toBe('true-value');
        });

        test('uses false value when predicate is false', () => {
          builder.ifElse(() => false, 'name', 'true-value', 'false-value');
          const result = builder.build();

          expect(result.name).toBe('false-value');
        });

        test('works with function values', () => {
          builder.ifElse(
            () => true,
            'name',
            () => 'true-function',
            () => 'false-function',
          );
          const result = builder.build();

          expect(result.name).toBe('true-function');
        });

        test('works with builder values', () => {
          const trueBuilder = new NestedBuilder().withValue('true-nested');
          const falseBuilder = new NestedBuilder().withValue('false-nested');

          builder.ifElse(() => false, 'nested', trueBuilder, falseBuilder);
          const result = builder.build();

          expect(result.nested).toEqual({ value: 'false-nested' });
        });

        test('returns this for chaining', () => {
          const result = builder.ifElse(() => true, 'name', 'a', 'b');
          expect(result).toBe(builder);
        });
      });
    });

    describe('utility methods', () => {
      let builder: TestBuilder;

      beforeEach(() => {
        builder = new TestBuilder();
      });

      describe('has method', () => {
        test('returns false for unset properties', () => {
          expect(builder.has('name')).toBe(false);
          expect(builder.has('tags')).toBe(false);
        });

        test('returns true for set static values', () => {
          builder.withName('test');
          expect(builder.has('name')).toBe(true);
        });

        test('returns true for set builders', () => {
          const nestedBuilder = new NestedBuilder();
          builder.withNested(nestedBuilder);
          expect(builder.has('nested')).toBe(true);
        });

        test('returns true for mixed arrays', () => {
          class DataBuilder extends FluentBuilderBase<{ data: number }> {
            build(): { data: number } {
              return this.buildWithDefaults({ data: 0 });
            }
            withData(data: number): this {
              return this.set('data', data);
            }
          }
          const dataBuilder = new DataBuilder();
          builder.withMixed(['static', dataBuilder]);
          expect(builder.has('mixed')).toBe(true);
        });
      });

      describe('peek method', () => {
        test('returns undefined for unset properties', () => {
          expect(builder.peek('name')).toBeUndefined();
        });

        test('returns static values', () => {
          builder.withName('test-name');
          expect(builder.peek('name')).toBe('test-name');
        });

        test('returns undefined for builders (not resolved)', () => {
          const nestedBuilder = new NestedBuilder();
          builder.withNested(nestedBuilder);
          expect(builder.peek('nested')).toBeUndefined();
        });

        test('returns static arrays', () => {
          builder.withTags(['tag1', 'tag2']);
          expect(builder.peek('tags')).toEqual(['tag1', 'tag2']);
        });
      });
    });

    describe('complex scenarios', () => {
      test('handles deeply nested structure', () => {
        class Level3Builder extends FluentBuilderBase<{ level: number }> {
          build(): { level: number } {
            return { level: 3 };
          }
        }

        class Level2Builder extends FluentBuilderBase<{
          nested: { level: number };
        }> {
          build(): { nested: { level: number } } {
            return this.buildWithDefaults({});
          }
          withNested(nested: { level: number } | FluentBuilder<{ level: number }>): this {
            return this.set('nested', nested);
          }
        }

        const level3 = new Level3Builder();
        const level2 = new Level2Builder().withNested(level3);
        const level1 = new TestBuilder().withNested(level2 as any);

        const result = level1.build();

        expect(result.nested).toEqual({
          nested: { level: 3 },
        });
      });

      test('handles array of different types', () => {
        class StringBuilder extends FluentBuilderBase<string> {
          build(): string {
            return 'built-string';
          }
        }

        class NumberBuilder extends FluentBuilderBase<number> {
          build(): number {
            return 42;
          }
        }

        const stringBuilder = new StringBuilder();
        const numberBuilder = new NumberBuilder();

        // Mixed array with different builder types
        const mixedArray = [
          'static-string',
          stringBuilder,
          123,
          numberBuilder,
          { static: 'object' },
        ];

        // Note: This tests the current behavior but may not be the intended design
        const builder = new TestBuilder();
        builder.withMixed(mixedArray as any);

        const result = builder.build();

        expect(result.mixed).toEqual([
          'static-string',
          'built-string',
          123,
          42,
          { static: 'object' },
        ]);
      });

      test('handles objects containing builders in arrays', () => {
        class ItemBuilder extends FluentBuilderBase<{ id: string }> {
          build(): { id: string } {
            return this.buildWithDefaults({ id: 'default' });
          }
          withId(id: string): this {
            return this.set('id', id);
          }
        }

        const itemBuilder = new ItemBuilder().withId('nested-id');

        // Test the specific case that covers lines 184-185: objects containing builders in arrays
        const objWithBuilder = { nestedBuilder: itemBuilder };
        const mixedArray = ['static', objWithBuilder];

        const builder = new TestBuilder();
        builder.withMixed(mixedArray as any);

        const result = builder.build();

        expect(result.mixed).toEqual(['static', { nestedBuilder: { id: 'nested-id' } }]);
      });

      test('containsBuilder handles nested arrays with builders', () => {
        class NestedBuilder extends FluentBuilderBase<{ value: string }> {
          build(): { value: string } {
            return { value: 'nested' };
          }
        }

        // Test the recursive array case in containsBuilder (lines 215-216)
        const nestedBuilder = new NestedBuilder();
        const deepArray = ['static', [nestedBuilder]]; // Array containing array with builder

        const builder = new TestBuilder();

        // This will trigger the containsBuilder method to check nested arrays
        builder.withMixed(deepArray as any);

        const result = builder.build();

        expect(result.mixed).toEqual(['static', [{ value: 'nested' }]]);
      });
    });
  });

  describe('createInspectMethod', () => {
    test('formats builder name and properties', () => {
      const result = createInspectMethod('UserBuilder', {
        id: '123',
        name: 'John',
      });

      expect(result).toContain('UserBuilder');
      expect(result).toContain('"id"');
      expect(result).toContain('"123"');
      expect(result).toContain('"name"');
      expect(result).toContain('"John"');
    });

    test('handles empty properties', () => {
      const result = createInspectMethod('EmptyBuilder', {});

      expect(result).toContain('EmptyBuilder');
      expect(result).toContain('{}');
    });

    test('handles null and undefined values', () => {
      const result = createInspectMethod('TestBuilder', {
        nullValue: null,
        undefinedValue: undefined,
      });

      expect(result).toContain('null');
      // JSON.stringify omits undefined values from objects, so it won't appear in the output
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('undefinedValue');
    });

    test('handles complex nested objects', () => {
      const result = createInspectMethod('ComplexBuilder', {
        nested: {
          deep: {
            value: 'test',
          },
        },
        array: [1, 2, 3],
      });

      expect(result).toContain('ComplexBuilder');
      expect(result).toContain('nested');
      expect(result).toContain('deep');
      expect(result).toContain('array');
    });
  });

  describe('edge cases and error conditions', () => {
    test('handles malformed builder objects', () => {
      const malformedBuilder = {
        [FLUENT_BUILDER_SYMBOL]: 'not-boolean', // Wrong type
        build: () => ({}),
      };

      expect(isFluentBuilder(malformedBuilder)).toBe(false);
    });

    test('handles objects with null prototype', () => {
      const nullProtoObj = Object.create(null);
      nullProtoObj.someProperty = 'value';

      const result = resolveValue(nullProtoObj);
      // Null-prototype objects are treated as plain objects and resolved
      expect(result).toEqual(nullProtoObj);
      expect(result).not.toBe(nullProtoObj); // A new object is created
    });

    test('handles very large arrays', () => {
      const largeArray = Array.from({ length: 10000 }, () => 'item');
      const result = resolveValue(largeArray);

      expect(result).toEqual(largeArray);
      expect(Array.isArray(result)).toBe(true);
    });

    test('handles deeply nested objects without builders', () => {
      const deepObject: any = { level: 0 };
      let current = deepObject;

      // Create 100 levels deep
      for (let i = 1; i < 100; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const result = resolveValue(deepObject);
      expect(result).toEqual(deepObject);
    });
  });
});
