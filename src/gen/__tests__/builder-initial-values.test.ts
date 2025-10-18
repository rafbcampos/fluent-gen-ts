import { describe, test, expect } from 'vitest';
import { FluentBuilderBase, type BaseBuildContext } from '../builder-utilities.js';

describe('builder initial values with defaults', () => {
  interface TestEntity {
    id: string;
    value: string;
    optional?: number;
  }

  class TestEntityBuilder extends FluentBuilderBase<TestEntity> {
    private static readonly defaults: Record<string, unknown> = {
      id: 'generated-id-123',
    };

    build(context?: BaseBuildContext): TestEntity {
      return this.buildWithDefaults(TestEntityBuilder.defaults, context);
    }

    withId(id: string): this {
      return this.set('id', id);
    }

    withValue(value: string): this {
      return this.set('value', value);
    }

    withOptional(optional: number): this {
      return this.set('optional', optional);
    }
  }

  test('builder without initial values should use defaults', () => {
    const builder = new TestEntityBuilder();
    const result = builder.withValue('test').build();

    expect(result).toEqual({
      id: 'generated-id-123',
      value: 'test',
    });
  });

  test('builder with explicit withId should override default', () => {
    const builder = new TestEntityBuilder();
    const result = builder.withId('custom-id').withValue('test').build();

    expect(result).toEqual({
      id: 'custom-id',
      value: 'test',
    });
  });

  test('builder with initial values should still use defaults for unset properties', () => {
    // This is the bug: when passing initial values, defaults are lost
    const builder = new TestEntityBuilder({ value: 'initial-value' });
    const result = builder.build();

    // User expectation: id should still be generated
    expect(result).toEqual({
      id: 'generated-id-123',
      value: 'initial-value',
    });
  });

  test('builder with initial values including id should override default', () => {
    const builder = new TestEntityBuilder({ id: 'initial-id', value: 'initial-value' });
    const result = builder.build();

    expect(result).toEqual({
      id: 'initial-id',
      value: 'initial-value',
    });
  });

  test('builder with initial undefined values should not override defaults', () => {
    // If a user passes undefined explicitly, it should not override the default
    const builder = new TestEntityBuilder({ id: undefined, value: 'test' } as any);
    const result = builder.build();

    // User expectation: id should still use default
    expect(result).toEqual({
      id: 'generated-id-123',
      value: 'test',
    });
  });

  test('mixing initial values and explicit setter calls', () => {
    const builder = new TestEntityBuilder({ value: 'initial-value' });
    const result = builder.withOptional(42).build();

    expect(result).toEqual({
      id: 'generated-id-123',
      value: 'initial-value',
      optional: 42,
    });
  });

  test('explicit setter should override initial value', () => {
    const builder = new TestEntityBuilder({ value: 'initial-value' });
    const result = builder.withValue('overridden-value').build();

    expect(result).toEqual({
      id: 'generated-id-123',
      value: 'overridden-value',
    });
  });
});
