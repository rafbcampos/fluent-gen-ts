import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
} from "../result.js";

describe("Result", () => {
  describe("ok", () => {
    it("should create an Ok result", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });
  });

  describe("err", () => {
    it("should create an Err result", () => {
      const error = new Error("test error");
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe("isOk", () => {
    it("should return true for Ok results", () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it("should return false for Err results", () => {
      const result = err(new Error("test"));
      expect(isOk(result)).toBe(false);
    });
  });

  describe("isErr", () => {
    it("should return false for Ok results", () => {
      const result = ok(42);
      expect(isErr(result)).toBe(false);
    });

    it("should return true for Err results", () => {
      const result = err(new Error("test"));
      expect(isErr(result)).toBe(true);
    });
  });

  describe("map", () => {
    it("should transform Ok values", () => {
      const result = ok(42);
      const mapped = map(result, (x) => x * 2);
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(84);
      }
    });

    it("should pass through Err values", () => {
      const error = new Error("test");
      const result = err<Error>(error);
      const mapped = map(result, (x: any) => x * 2);
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });
  });

  describe("mapErr", () => {
    it("should pass through Ok values", () => {
      const result = ok(42);
      const mapped = mapErr(result, (_e: Error) => new Error("wrapped"));
      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(42);
      }
    });

    it("should transform Err values", () => {
      const result = err(new Error("test"));
      const mapped = mapErr(result, (e) => new Error(`wrapped: ${e.message}`));
      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error.message).toBe("wrapped: test");
      }
    });
  });

  describe("flatMap", () => {
    it("should chain Ok results", () => {
      const result = ok(42);
      const chained = flatMap(result, (x) => ok(x * 2));
      expect(isOk(chained)).toBe(true);
      if (isOk(chained)) {
        expect(chained.value).toBe(84);
      }
    });

    it("should short-circuit on first Err", () => {
      const error = new Error("test");
      const result = err<Error>(error);
      const chained = flatMap(result, (x: any) => ok(x * 2));
      expect(isErr(chained)).toBe(true);
      if (isErr(chained)) {
        expect(chained.error).toBe(error);
      }
    });

    it("should propagate Err from function", () => {
      const result = ok(42);
      const error = new Error("chain error");
      const chained = flatMap(result, () => err(error));
      expect(isErr(chained)).toBe(true);
      if (isErr(chained)) {
        expect(chained.error).toBe(error);
      }
    });
  });

  describe("unwrap", () => {
    it("should return value for Ok results", () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it("should throw error for Err results", () => {
      const error = new Error("test");
      const result = err(error);
      expect(() => unwrap(result)).toThrow(error);
    });
  });

  describe("unwrapOr", () => {
    it("should return value for Ok results", () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it("should return default for Err results", () => {
      const result = err(new Error("test"));
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });
});

