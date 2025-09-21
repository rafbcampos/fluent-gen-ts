/**
 * Represents a successful result containing a value.
 * @template T - The type of the success value
 */
export type Ok<T> = {
  readonly ok: true;
  readonly value: T;
};

/**
 * Represents a failed result containing an error.
 * @template E - The type of the error value
 */
export type Err<E> = {
  readonly ok: false;
  readonly error: E;
};

/**
 * A type representing either success (Ok) or failure (Err).
 * This is a discriminated union that enables type-safe error handling without exceptions.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value (defaults to Error)
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number, string> {
 *   return b === 0 ? err("Division by zero") : ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (isOk(result)) {
 *   console.log(result.value); // 5
 * } else {
 *   console.error(result.error); // Division by zero
 * }
 * ```
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Creates a successful Result containing the given value.
 *
 * @template T - The type of the success value
 * @param value - The value to wrap in a successful Result
 * @returns An Ok Result containing the value
 *
 * @example
 * ```ts
 * const result = ok("Hello, World!");
 * console.log(result); // { ok: true, value: "Hello, World!" }
 * ```
 */
export const ok = <T>(value: T): Ok<T> => ({
  ok: true,
  value,
});

/**
 * Creates a failed Result containing the given error.
 *
 * @template E - The type of the error value
 * @param error - The error to wrap in a failed Result
 * @returns An Err Result containing the error
 *
 * @example
 * ```ts
 * const result = err("Something went wrong");
 * console.log(result); // { ok: false, error: "Something went wrong" }
 * ```
 */
export const err = <E>(error: E): Err<E> => ({
  ok: false,
  error,
});

/**
 * Type guard function that checks if a Result is Ok.
 * Narrows the type to Ok<T> when true.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to check
 * @returns true if the Result is Ok, false otherwise
 *
 * @example
 * ```ts
 * const result: Result<string, string> = ok("success");
 * if (isOk(result)) {
 *   console.log(result.value); // TypeScript knows this is string
 * }
 * ```
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok === true;

/**
 * Type guard function that checks if a Result is Err.
 * Narrows the type to Err<E> when true.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to check
 * @returns true if the Result is Err, false otherwise
 *
 * @example
 * ```ts
 * const result: Result<string, string> = err("failure");
 * if (isErr(result)) {
 *   console.log(result.error); // TypeScript knows this is string
 * }
 * ```
 */
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => result.ok === false;

/**
 * Transforms the success value of a Result using the provided function.
 * If the Result is Err, it is returned unchanged.
 *
 * @template T - The type of the original success value
 * @template U - The type of the transformed success value
 * @template E - The type of the error value
 * @param result - The Result to transform
 * @param fn - Function to transform the success value
 * @returns A new Result with the transformed value, or the original Err
 *
 * @example
 * ```ts
 * const result = ok(5);
 * const doubled = map(result, x => x * 2);
 * console.log(doubled); // Ok({ value: 10 })
 *
 * const error = err("failed");
 * const notTransformed = map(error, x => x * 2);
 * console.log(notTransformed); // Err({ error: "failed" })
 * ```
 */
export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> => {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
};

/**
 * Transforms the error value of a Result using the provided function.
 * If the Result is Ok, it is returned unchanged.
 *
 * @template T - The type of the success value
 * @template E - The type of the original error value
 * @template F - The type of the transformed error value
 * @param result - The Result to transform
 * @param fn - Function to transform the error value
 * @returns A new Result with the transformed error, or the original Ok
 *
 * @example
 * ```ts
 * const result = err("not found");
 * const withCode = mapErr(result, msg => ({ code: 404, message: msg }));
 * console.log(withCode); // Err({ error: { code: 404, message: "not found" } })
 *
 * const success = ok("data");
 * const unchanged = mapErr(success, msg => ({ code: 500, message: msg }));
 * console.log(unchanged); // Ok({ value: "data" })
 * ```
 */
export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> => {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
};

/**
 * Chains Results together, applying the function only if the Result is Ok.
 * Also known as "bind" or "andThen" in other functional programming languages.
 *
 * @template T - The type of the original success value
 * @template U - The type of the new success value
 * @template E - The type of the error value
 * @param result - The Result to chain
 * @param fn - Function that returns a new Result
 * @returns The result of the function, or the original Err
 *
 * @example
 * ```ts
 * const parseNumber = (s: string): Result<number, string> =>
 *   isNaN(Number(s)) ? err("Not a number") : ok(Number(s));
 *
 * const validatePositive = (n: number): Result<number, string> =>
 *   n > 0 ? ok(n) : err("Must be positive");
 *
 * const result = flatMap(ok("42"), parseNumber);
 * const validated = flatMap(result, validatePositive);
 * console.log(validated); // Ok({ value: 42 })
 * ```
 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
};

/**
 * Extracts the success value from a Result, throwing an error if it's an Err.
 * Non-Error values are automatically wrapped in Error instances for better stack traces.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to unwrap
 * @returns The success value
 * @throws Error when the Result is Err
 *
 * @example
 * ```ts
 * const success = ok("Hello");
 * console.log(unwrap(success)); // "Hello"
 *
 * const failure = err("Something went wrong");
 * unwrap(failure); // throws Error("Something went wrong")
 *
 * const numberError = err(404);
 * unwrap(numberError); // throws Error("Result unwrap failed: 404")
 * ```
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) {
    return result.value;
  }

  // Ensure we always throw an Error instance for better stack traces
  if (result.error instanceof Error) {
    throw result.error;
  }

  // Convert non-Error values to Error instances with descriptive message
  const errorMessage =
    typeof result.error === 'string'
      ? result.error
      : `Result unwrap failed: ${JSON.stringify(result.error)}`;

  throw new Error(errorMessage);
};

/**
 * Extracts the success value from a Result, or returns a default value if it's an Err.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to unwrap
 * @param defaultValue - The value to return if the Result is Err
 * @returns The success value or the default value
 *
 * @example
 * ```ts
 * const success = ok("Hello");
 * console.log(unwrapOr(success, "Default")); // "Hello"
 *
 * const failure = err("Something went wrong");
 * console.log(unwrapOr(failure, "Default")); // "Default"
 * ```
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
};

/**
 * Returns the second Result if the first is Ok, otherwise returns the first.
 * Useful for chaining operations where you want the last successful value.
 *
 * @template T - The type of the first success value
 * @template U - The type of the second success value
 * @template E - The type of the error value
 * @param result - The first Result
 * @param otherResult - The second Result
 * @returns The second Result if first is Ok, otherwise the first Result
 *
 * @example
 * ```ts
 * const first = ok("first");
 * const second = ok("second");
 * console.log(and(first, second)); // Ok({ value: "second" })
 *
 * const error = err("failed");
 * console.log(and(error, second)); // Err({ error: "failed" })
 * ```
 */
export const and = <T, U, E>(result: Result<T, E>, otherResult: Result<U, E>): Result<U, E> => {
  if (isOk(result)) {
    return otherResult;
  }
  return result;
};

/**
 * Applies a function that returns a Result if the input Result is Ok.
 * This is an alias for flatMap, providing a more descriptive name for chaining.
 *
 * @template T - The type of the original success value
 * @template U - The type of the new success value
 * @template E - The type of the error value
 * @param result - The Result to process
 * @param fn - Function that returns a new Result
 * @returns The result of the function, or the original Err
 *
 * @example
 * ```ts
 * const divide = (n: number): Result<number, string> =>
 *   n === 0 ? err("Division by zero") : ok(10 / n);
 *
 * const result = andThen(ok(2), divide);
 * console.log(result); // Ok({ value: 5 })
 * ```
 */
export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
};

/**
 * Returns the first Result if it's Ok, otherwise returns the second Result.
 * Useful for providing fallback values.
 *
 * @template T - The type of the success value
 * @template E - The type of the first error value
 * @template F - The type of the second error value
 * @param result - The first Result
 * @param otherResult - The fallback Result
 * @returns The first Result if Ok, otherwise the second Result
 *
 * @example
 * ```ts
 * const primary = ok("success");
 * const fallback = ok("fallback");
 * console.log(or(primary, fallback)); // Ok({ value: "success" })
 *
 * const failed = err("primary failed");
 * console.log(or(failed, fallback)); // Ok({ value: "fallback" })
 * ```
 */
export const or = <T, E, F>(result: Result<T, E>, otherResult: Result<T, F>): Result<T, F> => {
  if (isOk(result)) {
    return result;
  }
  return otherResult;
};

/**
 * Applies a function to the error value if the Result is Err.
 * Useful for error recovery or transformation.
 *
 * @template T - The type of the success value
 * @template E - The type of the original error value
 * @template F - The type of the new error value
 * @param result - The Result to process
 * @param fn - Function to apply to the error value
 * @returns The original Ok, or the result of applying fn to the error
 *
 * @example
 * ```ts
 * const recover = (error: string): Result<string, number> =>
 *   error === "recoverable" ? ok("recovered") : err(500);
 *
 * const failed = err("recoverable");
 * console.log(orElse(failed, recover)); // Ok({ value: "recovered" })
 *
 * const unrecoverable = err("fatal");
 * console.log(orElse(unrecoverable, recover)); // Err({ error: 500 })
 * ```
 */
export const orElse = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>,
): Result<T, F> => {
  if (isOk(result)) {
    return result;
  }
  return fn(result.error);
};

/**
 * Pattern matching for Results. Applies the appropriate function based on the Result type.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @template U - The type of the return value
 * @param result - The Result to match against
 * @param handlers - Object containing ok and err handler functions
 * @returns The result of applying the appropriate handler
 *
 * @example
 * ```ts
 * const result = ok(42);
 * const message = match(result, {
 *   ok: (value) => `Success: ${value}`,
 *   err: (error) => `Error: ${error}`,
 * });
 * console.log(message); // "Success: 42"
 * ```
 */
export const match = <T, E, U>(
  result: Result<T, E>,
  { ok: onOk, err: onErr }: { ok: (value: T) => U; err: (error: E) => U },
): U => {
  if (isOk(result)) {
    return onOk(result.value);
  }
  return onErr(result.error);
};

/**
 * Performs a side effect on the success value without modifying the Result.
 * Useful for logging, debugging, or other side effects.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to tap
 * @param fn - Function to execute for side effects
 * @returns The original Result unchanged
 *
 * @example
 * ```ts
 * const result = ok("data")
 *   .pipe(
 *     tap(value => console.log(`Processing: ${value}`)),
 *     map(value => value.toUpperCase())
 *   );
 * // Logs: "Processing: data"
 * // Returns: Ok({ value: "DATA" })
 * ```
 */
export const tap = <T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> => {
  if (isOk(result)) {
    fn(result.value);
  }
  return result;
};

/**
 * Performs a side effect on the error value without modifying the Result.
 * Useful for logging errors or other side effects.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to tap
 * @param fn - Function to execute for side effects on error
 * @returns The original Result unchanged
 *
 * @example
 * ```ts
 * const result = err("Network timeout")
 *   .pipe(
 *     tapErr(error => console.error(`Error occurred: ${error}`)),
 *     mapErr(error => new Error(error))
 *   );
 * // Logs: "Error occurred: Network timeout"
 * // Returns: Err({ error: Error("Network timeout") })
 * ```
 */
export const tapErr = <T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> => {
  if (isErr(result)) {
    fn(result.error);
  }
  return result;
};

/**
 * Alias for tap. Performs a side effect on the success value without modifying the Result.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to inspect
 * @param fn - Function to execute for side effects
 * @returns The original Result unchanged
 *
 * @example
 * ```ts
 * const result = ok("data")
 *   .pipe(inspect(value => console.log(`Inspecting: ${value}`)));
 * ```
 */
export const inspect = <T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> =>
  tap(result, fn);

/**
 * Alias for tapErr. Performs a side effect on the error value without modifying the Result.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to inspect
 * @param fn - Function to execute for side effects on error
 * @returns The original Result unchanged
 *
 * @example
 * ```ts
 * const result = err("failed")
 *   .pipe(inspectErr(error => console.error(`Inspecting error: ${error}`)));
 * ```
 */
export const inspectErr = <T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> =>
  tapErr(result, fn);

/**
 * Converts a Result to a string representation for debugging purposes.
 *
 * @template T - The type of the success value
 * @template E - The type of the error value
 * @param result - The Result to convert to string
 * @returns A string representation of the Result
 *
 * @example
 * ```ts
 * const success = ok({ name: "John", age: 30 });
 * console.log(toString(success)); // 'Ok({"name":"John","age":30})'
 *
 * const failure = err("Not found");
 * console.log(toString(failure)); // 'Err("Not found")'
 * ```
 */
export const toString = <T, E>(result: Result<T, E>): string => {
  if (isOk(result)) {
    return `Ok(${JSON.stringify(result.value)})`;
  }
  return `Err(${JSON.stringify(result.error)})`;
};

/**
 * Combines an array of Results into a single Result containing an array of values.
 * If any Result is Err, returns the first Err encountered.
 * If all Results are Ok, returns Ok with an array of all values.
 *
 * @template T - The type of the success values
 * @template E - The type of the error value
 * @param results - Array of Results to combine
 * @returns Ok with array of values, or the first Err encountered
 *
 * @example
 * ```ts
 * const results = [ok(1), ok(2), ok(3)];
 * console.log(all(results)); // Ok({ value: [1, 2, 3] })
 *
 * const mixed = [ok(1), err("failed"), ok(3)];
 * console.log(all(mixed)); // Err({ error: "failed" })
 *
 * const empty: Result<number, string>[] = [];
 * console.log(all(empty)); // Ok({ value: [] })
 * ```
 */
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
};

/**
 * Returns the first Ok Result from an array, or Err with all errors if none succeed.
 * Useful for trying multiple operations and taking the first successful one.
 *
 * @template T - The type of the success value
 * @template E - The type of the error values
 * @param results - Array of Results to check
 * @returns The first Ok Result, or Err with array of all errors
 *
 * @example
 * ```ts
 * const results = [err("first failed"), ok("success"), err("third failed")];
 * console.log(any(results)); // Ok({ value: "success" })
 *
 * const allFailed = [err("failed 1"), err("failed 2")];
 * console.log(any(allFailed)); // Err({ error: ["failed 1", "failed 2"] })
 *
 * const empty: Result<string, string>[] = [];
 * console.log(any(empty)); // Err({ error: [] })
 * ```
 */
export const any = <T, E>(results: Result<T, E>[]): Result<T, E[]> => {
  const errors: E[] = [];
  for (const result of results) {
    if (isOk(result)) {
      return result;
    }
    errors.push(result.error);
  }
  return err(errors);
};
