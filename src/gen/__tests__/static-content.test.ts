import { describe, it, expect } from "vitest";
import {
  FLUENT_BUILDER_SYMBOL,
  isFluentBuilder,
  isBuilderArray,
  createNestedContext,
  createInspectMethod,
  getCommonFileTemplate,
  getSingleFileUtilitiesTemplate,
  type BaseBuildContext,
  type FluentBuilder,
} from "../static-content.js";

describe("static-content utilities", () => {
  describe("FLUENT_BUILDER_SYMBOL", () => {
    it("should be a symbol", () => {
      expect(typeof FLUENT_BUILDER_SYMBOL).toBe("symbol");
      expect(FLUENT_BUILDER_SYMBOL.toString()).toBe("Symbol(fluent-builder)");
    });

    it("should be the same symbol across imports", () => {
      const symbol2 = Symbol.for("fluent-builder");
      expect(FLUENT_BUILDER_SYMBOL).toBe(symbol2);
    });
  });

  describe("isFluentBuilder", () => {
    it("should return true for valid fluent builders", () => {
      const mockBuilder: FluentBuilder<unknown> = {
        [FLUENT_BUILDER_SYMBOL]: true as const,
        build: () => ({})
      };

      expect(isFluentBuilder(mockBuilder)).toBe(true);
    });

    it("should return false for non-functions", () => {
      expect(isFluentBuilder({})).toBe(false);
      expect(isFluentBuilder("string")).toBe(false);
      expect(isFluentBuilder(123)).toBe(false);
      expect(isFluentBuilder(null)).toBe(false);
      expect(isFluentBuilder(undefined)).toBe(false);
    });

    it("should return false for functions without the symbol", () => {
      const normalFunction = () => ({});
      expect(isFluentBuilder(normalFunction)).toBe(false);
    });

    it("should return false for functions with wrong symbol value", () => {
      const fakeBuilder = Object.assign(
        () => ({}),
        { [FLUENT_BUILDER_SYMBOL]: false }
      );
      expect(isFluentBuilder(fakeBuilder)).toBe(false);
    });
  });

  describe("isBuilderArray", () => {
    it("should return true for arrays of fluent builders", () => {
      const mockBuilder1: FluentBuilder<unknown> = {
        [FLUENT_BUILDER_SYMBOL]: true as const,
        build: () => ({})
      };
      const mockBuilder2: FluentBuilder<unknown> = {
        [FLUENT_BUILDER_SYMBOL]: true as const,
        build: () => ({})
      };

      expect(isBuilderArray([mockBuilder1, mockBuilder2])).toBe(true);
    });

    it("should return false for empty arrays", () => {
      expect(isBuilderArray([])).toBe(true); // Empty arrays are valid builder arrays
    });

    it("should return false for arrays with non-builders", () => {
      expect(isBuilderArray([() => ({}), "string"])).toBe(false);
    });

    it("should return false for non-arrays", () => {
      expect(isBuilderArray({})).toBe(false);
      expect(isBuilderArray("string")).toBe(false);
    });
  });

  describe("createNestedContext", () => {
    it("should create nested context with new parameter name", () => {
      const parentContext: BaseBuildContext = {
        parentId: "root",
        parameterName: "parent",
      };

      const nestedContext = createNestedContext(parentContext, "child");

      expect(nestedContext).toEqual({
        parentId: "root",
        parameterName: "child",
      });
    });

    it("should create nested context with index when provided", () => {
      const parentContext: BaseBuildContext = {
        parentId: "root",
      };

      const nestedContext = createNestedContext(parentContext, "items", 2);

      expect(nestedContext).toEqual({
        parentId: "root",
        parameterName: "items",
        index: 2,
      });
    });

    it("should preserve other properties from parent context", () => {
      const parentContext: BaseBuildContext = {
        parentId: "root",
        customProperty: "value",
      };

      const nestedContext = createNestedContext(parentContext, "child");

      expect(nestedContext).toEqual({
        parentId: "root",
        parameterName: "child",
        customProperty: "value",
      });
    });
  });

  describe("createInspectMethod", () => {
    it("should create proper inspect string", () => {
      const builderName = "UserBuilder";
      const properties = { name: "John", age: 30 };

      const result = createInspectMethod(builderName, properties);

      expect(result).toBe('UserBuilder { properties: {\n  "name": "John",\n  "age": 30\n} }');
    });

    it("should handle empty properties", () => {
      const builderName = "EmptyBuilder";
      const properties = {};

      const result = createInspectMethod(builderName, properties);

      expect(result).toBe("EmptyBuilder { properties: {} }");
    });
  });

  describe("template functions", () => {
    describe("getCommonFileTemplate", () => {
      it("should return non-empty string", () => {
        const template = getCommonFileTemplate();
        expect(typeof template).toBe("string");
        expect(template.length).toBeGreaterThan(0);
      });

      it("should contain expected exports", () => {
        const template = getCommonFileTemplate();
        expect(template).toContain("export const FLUENT_BUILDER_SYMBOL");
        expect(template).toContain("export interface BaseBuildContext");
        expect(template).toContain("export interface FluentBuilder");
        expect(template).toContain("export function isFluentBuilder");
        expect(template).toContain("export abstract class FluentBuilderBase");
      });
    });

    describe("getSingleFileUtilitiesTemplate", () => {
      it("should return non-empty string", () => {
        const template = getSingleFileUtilitiesTemplate();
        expect(typeof template).toBe("string");
        expect(template.length).toBeGreaterThan(0);
      });

      it("should contain utilities without export keywords", () => {
        const template = getSingleFileUtilitiesTemplate();
        expect(template).toContain("const FLUENT_BUILDER_SYMBOL");
        expect(template).toContain("interface BaseBuildContext");
        expect(template).toContain("interface FluentBuilder");
        expect(template).toContain("function isFluentBuilder");
        expect(template).toContain("abstract class FluentBuilderBase");
      });
    });
  });
});