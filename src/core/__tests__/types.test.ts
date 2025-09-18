import { describe, it, expect } from "vitest";
import { FLUENT_BUILDER_SYMBOL, isFluentBuilder, TypeKind } from "../types.js";

describe("FluentBuilder", () => {
  describe("isFluentBuilder", () => {
    it("should identify fluent builders", () => {
      const builder = Object.assign(() => ({ value: 42 }), {
        [FLUENT_BUILDER_SYMBOL]: true,
      });

      expect(isFluentBuilder(builder)).toBe(true);
    });

    it("should reject non-builders", () => {
      expect(isFluentBuilder({})).toBe(false);
      expect(isFluentBuilder(() => {})).toBe(false);
      expect(isFluentBuilder(null)).toBe(false);
      expect(isFluentBuilder(undefined)).toBe(false);
      expect(isFluentBuilder("string")).toBe(false);
      expect(isFluentBuilder(42)).toBe(false);
    });

    it("should reject objects with wrong symbol value", () => {
      const fake = Object.assign(() => ({ value: 42 }), {
        [FLUENT_BUILDER_SYMBOL]: false,
      });

      expect(isFluentBuilder(fake)).toBe(false);
    });
  });
});

describe("TypeKind", () => {
  it("should have all expected type kinds", () => {
    expect(TypeKind.Primitive).toBe("primitive");
    expect(TypeKind.Object).toBe("object");
    expect(TypeKind.Array).toBe("array");
    expect(TypeKind.Union).toBe("union");
    expect(TypeKind.Intersection).toBe("intersection");
    expect(TypeKind.Generic).toBe("generic");
    expect(TypeKind.Literal).toBe("literal");
    expect(TypeKind.Unknown).toBe("unknown");
    expect(TypeKind.Reference).toBe("reference");
    expect(TypeKind.Function).toBe("function");
    expect(TypeKind.Tuple).toBe("tuple");
    expect(TypeKind.Enum).toBe("enum");
  });
});

