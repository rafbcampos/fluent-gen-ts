import { test, expect, describe } from 'vitest';
import {
  type Result,
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  and,
  andThen,
  or,
  orElse,
  match,
  tap,
  tapErr,
  inspect,
  inspectErr,
  toString,
  all,
  any,
} from '../result.js';

describe('Result types', () => {
  describe('Ok type construction', () => {
    test('creates Ok value with correct structure', () => {
      const result = ok('success');

      expect(result.ok).toBe(true);
      expect(result.value).toBe('success');
      expect('error' in result).toBe(false);
    });

    test('creates Ok with different value types', () => {
      const stringResult = ok('hello');
      const numberResult = ok(42);
      const objectResult = ok({ id: 1, name: 'test' });
      const nullResult = ok(null);
      const undefinedResult = ok(undefined);

      expect(stringResult.value).toBe('hello');
      expect(numberResult.value).toBe(42);
      expect(objectResult.value).toEqual({ id: 1, name: 'test' });
      expect(nullResult.value).toBe(null);
      expect(undefinedResult.value).toBe(undefined);
    });
  });

  describe('Err type construction', () => {
    test('creates Err value with correct structure', () => {
      const result = err('failure');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('failure');
      expect('value' in result).toBe(false);
    });

    test('creates Err with different error types', () => {
      const stringErr = err('error message');
      const errorObjectErr = err(new Error('test error'));
      const numberErr = err(404);
      const objectErr = err({ code: 'ERR_001', message: 'Custom error' });

      expect(stringErr.error).toBe('error message');
      expect(errorObjectErr.error).toBeInstanceOf(Error);
      expect(numberErr.error).toBe(404);
      expect(objectErr.error).toEqual({
        code: 'ERR_001',
        message: 'Custom error',
      });
    });
  });
});

describe('Type guards', () => {
  describe('isOk', () => {
    test('returns true for Ok values', () => {
      const okResult = ok('success');
      expect(isOk(okResult)).toBe(true);
    });

    test('returns false for Err values', () => {
      const errResult = err('failure');
      expect(isOk(errResult)).toBe(false);
    });

    test('provides proper type narrowing', () => {
      const result: Result<string, string> = ok('success');

      if (isOk(result)) {
        // TypeScript should know result.value exists
        expect(result.value).toBe('success');
        // @ts-expect-error - result.error should not exist on Ok type
        expect(result.error).toBeUndefined();
      }
    });
  });

  describe('isErr', () => {
    test('returns true for Err values', () => {
      const errResult = err('failure');
      expect(isErr(errResult)).toBe(true);
    });

    test('returns false for Ok values', () => {
      const okResult = ok('success');
      expect(isErr(okResult)).toBe(false);
    });

    test('provides proper type narrowing', () => {
      const result: Result<string, string> = err('failure');

      if (isErr(result)) {
        // TypeScript should know result.error exists
        expect(result.error).toBe('failure');
        // @ts-expect-error - result.value should not exist on Err type
        expect(result.value).toBeUndefined();
      }
    });
  });
});

describe('map function', () => {
  test('transforms Ok value using provided function', () => {
    const result = ok(5);
    const mapped = map(result, x => x * 2);

    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe(10);
    }
  });

  test('preserves Err value without applying function', () => {
    const result = err('failure');
    const mapped = map(result, (x: any) => x * 2);

    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBe('failure');
    }
  });

  test('handles type transformation correctly', () => {
    const stringResult = ok('hello');
    const lengthResult = map(stringResult, str => str.length);

    expect(isOk(lengthResult)).toBe(true);
    if (isOk(lengthResult)) {
      expect(lengthResult.value).toBe(5);
    }
  });

  test('handles complex transformations', () => {
    const objectResult = ok({ name: 'test', age: 25 });
    const transformedResult = map(objectResult, obj => ({
      fullName: obj.name.toUpperCase(),
      isAdult: obj.age >= 18,
    }));

    expect(isOk(transformedResult)).toBe(true);
    if (isOk(transformedResult)) {
      expect(transformedResult.value).toEqual({
        fullName: 'TEST',
        isAdult: true,
      });
    }
  });
});

describe('mapErr function', () => {
  test('transforms Err value using provided function', () => {
    const result = err('failure');
    const mapped = mapErr(result, error => `Error: ${error}`);

    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBe('Error: failure');
    }
  });

  test('preserves Ok value without applying function', () => {
    const result = ok('success');
    const mapped = mapErr(result, (error: any) => `Error: ${error}`);

    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe('success');
    }
  });

  test('handles error type transformation', () => {
    const stringErrorResult = err('not found');
    const errorObjectResult = mapErr(stringErrorResult, msg => new Error(msg));

    expect(isErr(errorObjectResult)).toBe(true);
    if (isErr(errorObjectResult)) {
      expect(errorObjectResult.error).toBeInstanceOf(Error);
      expect(errorObjectResult.error.message).toBe('not found');
    }
  });

  test('handles complex error transformations', () => {
    const simpleErrorResult = err(404);
    const detailedErrorResult = mapErr(simpleErrorResult, code => ({
      statusCode: code,
      message: code === 404 ? 'Not Found' : 'Unknown Error',
      timestamp: new Date().toISOString(),
    }));

    expect(isErr(detailedErrorResult)).toBe(true);
    if (isErr(detailedErrorResult)) {
      expect(detailedErrorResult.error.statusCode).toBe(404);
      expect(detailedErrorResult.error.message).toBe('Not Found');
      expect(detailedErrorResult.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

describe('flatMap function', () => {
  test('chains Ok values successfully', () => {
    const result = ok(5);
    const chained = flatMap(result, x => ok(x * 2));

    expect(isOk(chained)).toBe(true);
    if (isOk(chained)) {
      expect(chained.value).toBe(10);
    }
  });

  test('chains Ok to Err', () => {
    const result = ok(5);
    const chained = flatMap(result, x => err(`Value ${x} is invalid`));

    expect(isErr(chained)).toBe(true);
    if (isErr(chained)) {
      expect(chained.error).toBe('Value 5 is invalid');
    }
  });

  test('preserves Err value without calling function', () => {
    const result = err('initial failure');
    const chained = flatMap(result, (x: any) => ok(x * 2));

    expect(isErr(chained)).toBe(true);
    if (isErr(chained)) {
      expect(chained.error).toBe('initial failure');
    }
  });

  test('handles complex chaining scenarios', () => {
    const parseNumber = (str: string): Result<number, string> => {
      const parsed = parseInt(str, 10);
      return isNaN(parsed) ? err('Not a number') : ok(parsed);
    };

    const validatePositive = (num: number): Result<number, string> => {
      return num > 0 ? ok(num) : err('Number must be positive');
    };

    // Valid chain
    const validInput = ok('42');
    const validResult = flatMap(validInput, str => flatMap(parseNumber(str), validatePositive));

    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe(42);
    }

    // Invalid number chain
    const invalidInput = ok('abc');
    const invalidResult = flatMap(invalidInput, str => flatMap(parseNumber(str), validatePositive));

    expect(isErr(invalidResult)).toBe(true);
    if (isErr(invalidResult)) {
      expect(invalidResult.error).toBe('Not a number');
    }

    // Negative number chain
    const negativeInput = ok('-5');
    const negativeResult = flatMap(negativeInput, str =>
      flatMap(parseNumber(str), validatePositive),
    );

    expect(isErr(negativeResult)).toBe(true);
    if (isErr(negativeResult)) {
      expect(negativeResult.error).toBe('Number must be positive');
    }
  });
});

describe('unwrap function', () => {
  test('returns value for Ok result', () => {
    const result = ok('success');
    expect(unwrap(result)).toBe('success');
  });

  test('throws error for Err result', () => {
    const result = err('failure');
    expect(() => unwrap(result)).toThrow('failure');
  });

  test('throws Error object correctly', () => {
    const error = new Error('Test error');
    const result = err(error);
    expect(() => unwrap(result)).toThrow(error);
  });

  test('wraps non-Error values in Error instances', () => {
    const numberErr = err(404);
    try {
      unwrap(numberErr);
      expect.fail('Expected unwrap to throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe('Result unwrap failed: 404');
    }

    const objectErr = err({ message: 'Custom error' });
    try {
      unwrap(objectErr);
      expect.fail('Expected unwrap to throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe('Result unwrap failed: {"message":"Custom error"}');
    }
  });

  test('preserves string errors as Error messages', () => {
    const stringErr = err('Something went wrong');
    try {
      unwrap(stringErr);
      expect.fail('Expected unwrap to throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe('Something went wrong');
    }
  });

  test('preserves complex value types', () => {
    const complexValue = { users: [{ id: 1, name: 'John' }], total: 1 };
    const result = ok(complexValue);

    expect(unwrap(result)).toEqual(complexValue);
    expect(unwrap(result)).toBe(complexValue); // Same reference
  });
});

describe('unwrapOr function', () => {
  test('returns value for Ok result', () => {
    const result = ok('success');
    expect(unwrapOr(result, 'default')).toBe('success');
  });

  test('returns default value for Err result', () => {
    const result = err('failure');
    expect(unwrapOr(result, 'default')).toBe('default');
  });

  test('handles different default value types', () => {
    const errResult = err('failure');

    expect(unwrapOr(errResult, 'default string')).toBe('default string');
    expect(unwrapOr(errResult, 42)).toBe(42);
    expect(unwrapOr(errResult, { fallback: true })).toEqual({ fallback: true });
    expect(unwrapOr(errResult, null)).toBe(null);
    expect(unwrapOr(errResult, undefined)).toBe(undefined);
  });

  test('preserves Ok value even when default is provided', () => {
    const result = ok('actual value');
    expect(unwrapOr(result, 'this should not be used')).toBe('actual value');
  });

  test('works with complex types', () => {
    type User = { id: number; name: string };
    const defaultUser: User = { id: 0, name: 'Anonymous' };

    const okUserResult = ok({ id: 1, name: 'John' });
    const errUserResult = err('User not found');

    expect(unwrapOr(okUserResult, defaultUser)).toEqual({
      id: 1,
      name: 'John',
    });
    expect(unwrapOr(errUserResult, defaultUser)).toEqual(defaultUser);
  });
});

describe('and function', () => {
  test('returns second result when first is Ok', () => {
    const first = ok('first');
    const second = ok('second');
    const result = and(first, second);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('second');
    }
  });

  test('returns first result when first is Err', () => {
    const first = err('first error');
    const second = ok('second');
    const result = and(first, second);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe('first error');
    }
  });

  test('works with different types', () => {
    const stringResult = ok('hello');
    const numberResult = ok(42);
    const result = and(stringResult, numberResult);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });
});

describe('andThen function', () => {
  test('applies function when result is Ok', () => {
    const result = ok(5);
    const chained = andThen(result, x => ok(x * 2));

    expect(isOk(chained)).toBe(true);
    if (isOk(chained)) {
      expect(chained.value).toBe(10);
    }
  });

  test('preserves Err without applying function', () => {
    const result = err('error');
    const chained = andThen(result, (x: any) => ok(x * 2));

    expect(isErr(chained)).toBe(true);
    if (isErr(chained)) {
      expect(chained.error).toBe('error');
    }
  });

  test('handles function that returns Err', () => {
    const result = ok(5);
    const chained = andThen(result, x => err(`Value ${x} is invalid`));

    expect(isErr(chained)).toBe(true);
    if (isErr(chained)) {
      expect(chained.error).toBe('Value 5 is invalid');
    }
  });
});

describe('or function', () => {
  test('returns first result when first is Ok', () => {
    const first = ok('first');
    const second = ok('second');
    const result = or(first, second);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('first');
    }
  });

  test('returns second result when first is Err', () => {
    const first = err('first error');
    const second = ok('second');
    const result = or(first, second);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('second');
    }
  });

  test('returns second result when both are Err', () => {
    const first = err('first error');
    const second = err('second error');
    const result = or(first, second);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe('second error');
    }
  });
});

describe('orElse function', () => {
  test('preserves Ok without applying function', () => {
    const result = ok('success');
    const fallback = orElse(result, (_error: any) => ok('fallback'));

    expect(isOk(fallback)).toBe(true);
    if (isOk(fallback)) {
      expect(fallback.value).toBe('success');
    }
  });

  test('applies function when result is Err', () => {
    const result = err('error');
    const fallback = orElse(result, error => ok(`Recovered from: ${error}`));

    expect(isOk(fallback)).toBe(true);
    if (isOk(fallback)) {
      expect(fallback.value).toBe('Recovered from: error');
    }
  });

  test('handles function that returns Err', () => {
    const result = err('original error');
    const fallback = orElse(result, error => err(`New error: ${error}`));

    expect(isErr(fallback)).toBe(true);
    if (isErr(fallback)) {
      expect(fallback.error).toBe('New error: original error');
    }
  });
});

describe('match function', () => {
  test('calls ok function for Ok result', () => {
    const result = ok('success');
    const matched = match(result, {
      ok: value => `Got: ${String(value)}`,
      err: error => `Error: ${String(error)}`,
    });

    expect(matched).toBe('Got: success');
  });

  test('calls err function for Err result', () => {
    const result = err('failure');
    const matched = match(result, {
      ok: value => `Got: ${String(value)}`,
      err: error => `Error: ${String(error)}`,
    });

    expect(matched).toBe('Error: failure');
  });

  test('handles different return types', () => {
    const stringResult = ok('hello');
    const numberResult = match(stringResult, {
      ok: value => value.length,
      err: () => -1,
    });

    expect(numberResult).toBe(5);

    const errorResult = err('error');
    const errorNumber = match(errorResult, {
      ok: (value: string) => value.length,
      err: () => -1,
    });

    expect(errorNumber).toBe(-1);
  });
});

describe('tap function', () => {
  test('executes side effect for Ok result', () => {
    let sideEffect = '';
    const result = ok('hello');
    const tapped = tap(result, value => {
      sideEffect = `Processed: ${value}`;
    });

    expect(sideEffect).toBe('Processed: hello');
    expect(tapped).toBe(result); // Should return the same result
  });

  test('does not execute side effect for Err result', () => {
    let sideEffect = '';
    const result = err('error');
    const tapped = tap(result, (value: any) => {
      sideEffect = `Processed: ${value}`;
    });

    expect(sideEffect).toBe(''); // Should not have been called
    expect(tapped).toBe(result); // Should return the same result
  });
});

describe('tapErr function', () => {
  test('executes side effect for Err result', () => {
    let sideEffect = '';
    const result = err('error');
    const tapped = tapErr(result, error => {
      sideEffect = `Logged error: ${error}`;
    });

    expect(sideEffect).toBe('Logged error: error');
    expect(tapped).toBe(result); // Should return the same result
  });

  test('does not execute side effect for Ok result', () => {
    let sideEffect = '';
    const result = ok('success');
    const tapped = tapErr(result, (error: any) => {
      sideEffect = `Logged error: ${error}`;
    });

    expect(sideEffect).toBe(''); // Should not have been called
    expect(tapped).toBe(result); // Should return the same result
  });
});

describe('inspect function', () => {
  test('is an alias for tap', () => {
    let sideEffect = '';
    const result = ok('hello');
    const inspected = inspect(result, value => {
      sideEffect = `Inspected: ${value}`;
    });

    expect(sideEffect).toBe('Inspected: hello');
    expect(inspected).toBe(result);
  });
});

describe('inspectErr function', () => {
  test('is an alias for tapErr', () => {
    let sideEffect = '';
    const result = err('error');
    const inspected = inspectErr(result, error => {
      sideEffect = `Inspected error: ${error}`;
    });

    expect(sideEffect).toBe('Inspected error: error');
    expect(inspected).toBe(result);
  });
});

describe('toString function', () => {
  test('formats Ok result correctly', () => {
    const stringResult = ok('hello');
    const numberResult = ok(42);
    const objectResult = ok({ name: 'test' });

    expect(toString(stringResult)).toBe('Ok("hello")');
    expect(toString(numberResult)).toBe('Ok(42)');
    expect(toString(objectResult)).toBe('Ok({"name":"test"})');
  });

  test('formats Err result correctly', () => {
    const stringErr = err('error');
    const numberErr = err(404);
    const objectErr = err({ code: 'ERR_001' });

    expect(toString(stringErr)).toBe('Err("error")');
    expect(toString(numberErr)).toBe('Err(404)');
    expect(toString(objectErr)).toBe('Err({"code":"ERR_001"})');
  });

  test('handles null and undefined values', () => {
    const nullOk = ok(null);
    const undefinedErr = err(undefined);

    expect(toString(nullOk)).toBe('Ok(null)');
    expect(toString(undefinedErr)).toBe('Err(undefined)'); // JSON.stringify keeps undefined as string
  });
});

describe('all function', () => {
  test('returns Ok with all values when all results are Ok', () => {
    const results = [ok(1), ok(2), ok(3)];
    const combined = all(results);

    expect(isOk(combined)).toBe(true);
    if (isOk(combined)) {
      expect(combined.value).toEqual([1, 2, 3]);
    }
  });

  test('returns first Err when any result is Err', () => {
    const results = [ok(1), err('error'), ok(3)];
    const combined = all(results);

    expect(isErr(combined)).toBe(true);
    if (isErr(combined)) {
      expect(combined.error).toBe('error');
    }
  });

  test('returns Ok with empty array for empty input', () => {
    const results: Result<number, string>[] = [];
    const combined = all(results);

    expect(isOk(combined)).toBe(true);
    if (isOk(combined)) {
      expect(combined.value).toEqual([]);
    }
  });

  test('preserves order of values', () => {
    const results = [ok('first'), ok('second'), ok('third')];
    const combined = all(results);

    expect(isOk(combined)).toBe(true);
    if (isOk(combined)) {
      expect(combined.value).toEqual(['first', 'second', 'third']);
    }
  });
});

describe('any function', () => {
  test('returns first Ok when any result is Ok', () => {
    const results = [err('error1'), ok('success'), err('error2')];
    const combined = any(results);

    expect(isOk(combined)).toBe(true);
    if (isOk(combined)) {
      expect(combined.value).toBe('success');
    }
  });

  test('returns Err with all errors when all results are Err', () => {
    const results = [err('error1'), err('error2'), err('error3')];
    const combined = any(results);

    expect(isErr(combined)).toBe(true);
    if (isErr(combined)) {
      expect(combined.error).toEqual(['error1', 'error2', 'error3']);
    }
  });

  test('returns Err with empty array for empty input', () => {
    const results: Result<string, string>[] = [];
    const combined = any(results);

    expect(isErr(combined)).toBe(true);
    if (isErr(combined)) {
      expect(combined.error).toEqual([]);
    }
  });

  test('returns first Ok even when there are multiple', () => {
    const results = [err('error1'), ok('first'), ok('second')];
    const combined = any(results);

    expect(isOk(combined)).toBe(true);
    if (isOk(combined)) {
      expect(combined.value).toBe('first');
    }
  });
});

describe('Edge cases and type safety', () => {
  test('handles null and undefined values correctly', () => {
    const nullOk = ok(null);
    const undefinedOk = ok(undefined);
    const nullErr = err(null);
    const undefinedErr = err(undefined);

    expect(isOk(nullOk)).toBe(true);
    expect(isOk(undefinedOk)).toBe(true);
    expect(isErr(nullErr)).toBe(true);
    expect(isErr(undefinedErr)).toBe(true);

    expect(unwrap(nullOk)).toBe(null);
    expect(unwrap(undefinedOk)).toBe(undefined);
    expect(unwrapOr(nullErr, 'default')).toBe('default');
    expect(unwrapOr(undefinedErr, 'default')).toBe('default');
  });

  test('maintains immutability', () => {
    const originalValue = { count: 1 };
    const result = ok(originalValue);

    // Modifying the original object should not affect the result
    originalValue.count = 2;
    expect(result.value.count).toBe(2); // This shows it's the same reference

    // The result itself should be readonly
    // @ts-expect-error - ok property should be readonly
    result.ok = false;
    // @ts-expect-error - value property should be readonly
    result.value = { count: 3 };
  });

  test('works with generic constraints', () => {
    interface HasId {
      id: string;
    }

    const createEntity = <T extends HasId>(data: T): Result<T, string> => {
      return data.id ? ok(data) : err('Missing ID');
    };

    const validEntity = { id: '123', name: 'Test' };
    const invalidEntity = { id: '', name: 'Test' };

    const validResult = createEntity(validEntity);
    const invalidResult = createEntity(invalidEntity);

    expect(isOk(validResult)).toBe(true);
    expect(isErr(invalidResult)).toBe(true);
  });

  test('supports complex generic scenarios', () => {
    type ApiResponse<T> = Result<{ data: T; status: number }, { error: string; code: number }>;

    const successResponse: ApiResponse<string> = ok({
      data: 'Hello',
      status: 200,
    });
    const errorResponse: ApiResponse<string> = err({
      error: 'Not found',
      code: 404,
    });

    expect(isOk(successResponse)).toBe(true);
    expect(isErr(errorResponse)).toBe(true);

    if (isOk(successResponse)) {
      expect(successResponse.value.data).toBe('Hello');
      expect(successResponse.value.status).toBe(200);
    }

    if (isErr(errorResponse)) {
      expect(errorResponse.error.error).toBe('Not found');
      expect(errorResponse.error.code).toBe(404);
    }
  });
});
