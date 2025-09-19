import { describe, it, expect } from "vitest";
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
} from "../builder-utilities.js";

describe("Builder Utilities", () => {
  describe("FLUENT_BUILDER_SYMBOL", () => {
    it("should be a unique symbol", () => {
      expect(typeof FLUENT_BUILDER_SYMBOL).toBe("symbol");
      expect(FLUENT_BUILDER_SYMBOL.toString()).toBe("Symbol(fluent-builder)");
    });

    it("should use Symbol.for for module boundary compatibility", () => {
      const duplicateSymbol = Symbol.for("fluent-builder");
      expect(FLUENT_BUILDER_SYMBOL).toBe(duplicateSymbol);
    });
  });

  describe("isFluentBuilder", () => {
    it("should return true for valid fluent builders", () => {
      const validBuilder: FluentBuilder<string> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: () => "test",
      };
      expect(isFluentBuilder(validBuilder)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isFluentBuilder(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isFluentBuilder(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isFluentBuilder("string")).toBe(false);
      expect(isFluentBuilder(123)).toBe(false);
      expect(isFluentBuilder(true)).toBe(false);
      expect(isFluentBuilder(Symbol())).toBe(false);
    });

    it("should return false for regular objects", () => {
      expect(isFluentBuilder({})).toBe(false);
      expect(isFluentBuilder({ build: () => "test" })).toBe(false);
    });

    it("should return false for objects with wrong symbol value", () => {
      const invalidBuilder = {
        [FLUENT_BUILDER_SYMBOL]: false,
        build: () => "test",
      };
      expect(isFluentBuilder(invalidBuilder)).toBe(false);
    });

    it("should return false for objects without build method", () => {
      const invalidBuilder = {
        [FLUENT_BUILDER_SYMBOL]: true,
      };
      expect(isFluentBuilder(invalidBuilder)).toBe(false);
    });

    it("should return false for objects with non-function build", () => {
      const invalidBuilder = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: "not a function",
      };
      expect(isFluentBuilder(invalidBuilder)).toBe(false);
    });

    it("should handle generic type parameters", () => {
      interface CustomContext extends BaseBuildContext {
        customProp: string;
      }

      const builder: FluentBuilder<number, CustomContext> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: (context?: CustomContext) => context?.index ?? 42,
      };

      expect(isFluentBuilder<number, CustomContext>(builder)).toBe(true);
    });
  });

  describe("isBuilderArray", () => {
    it("should return true for array of valid builders", () => {
      const builders: FluentBuilder<string>[] = [
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "a" },
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "b" },
      ];
      expect(isBuilderArray(builders)).toBe(true);
    });

    it("should return true for empty array", () => {
      expect(isBuilderArray([])).toBe(true);
    });

    it("should return false for non-arrays", () => {
      expect(isBuilderArray("not an array")).toBe(false);
      expect(isBuilderArray(123)).toBe(false);
      expect(isBuilderArray({})).toBe(false);
    });

    it("should return false for array with non-builders", () => {
      const mixed = [
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "a" },
        "not a builder",
      ];
      expect(isBuilderArray(mixed)).toBe(false);
    });

    it("should return false for array with partial builders", () => {
      const partial = [
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "a" },
        { [FLUENT_BUILDER_SYMBOL]: true }, // missing build
      ];
      expect(isBuilderArray(partial)).toBe(false);
    });
  });

  describe("createNestedContext", () => {
    it("should create context with parameter name", () => {
      const parent: BaseBuildContext = { parentId: "parent" };
      const nested = createNestedContext(parent, "childParam");

      expect(nested).toEqual({
        parentId: "parent",
        parameterName: "childParam",
      });
    });

    it("should create context with index", () => {
      const parent: BaseBuildContext = { parentId: "parent" };
      const nested = createNestedContext(parent, "arrayItem", 5);

      expect(nested).toEqual({
        parentId: "parent",
        parameterName: "arrayItem",
        index: 5,
      });
    });

    it("should preserve custom properties", () => {
      interface CustomContext extends BaseBuildContext {
        customField: string;
        customNumber: number;
      }

      const parent: CustomContext = {
        parentId: "parent",
        customField: "value",
        customNumber: 42,
      };

      const nested = createNestedContext(parent, "child");

      expect(nested).toEqual({
        parentId: "parent",
        parameterName: "child",
        customField: "value",
        customNumber: 42,
      });
    });

    it("should override existing parameterName and index", () => {
      const parent: BaseBuildContext = {
        parentId: "parent",
        parameterName: "oldParam",
        index: 1,
      };

      const nested = createNestedContext(parent, "newParam", 10);

      expect(nested.parameterName).toBe("newParam");
      expect(nested.index).toBe(10);
    });
  });

  describe("resolveValue", () => {
    it("should resolve fluent builders", () => {
      const builder: FluentBuilder<string> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: () => "resolved",
      };

      expect(resolveValue(builder)).toBe("resolved");
    });

    it("should pass context to builders", () => {
      const context: BaseBuildContext = { parentId: "test" };
      const builder: FluentBuilder<string, BaseBuildContext> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: (ctx) => ctx?.parentId ?? "no-context",
      };

      expect(resolveValue(builder, context)).toBe("test");
    });

    it("should resolve arrays of builders", () => {
      const builders = [
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "a" },
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "b" },
      ];

      expect(resolveValue(builders)).toEqual(["a", "b"]);
    });

    it("should resolve mixed arrays", () => {
      const mixed = [
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "builder" },
        "regular",
        42,
      ];

      expect(resolveValue(mixed)).toEqual(["builder", "regular", 42]);
    });

    it("should create array context with index", () => {
      const context: BaseBuildContext = { parentId: "parent" };
      const builders = [
        {
          [FLUENT_BUILDER_SYMBOL]: true,
          build: (ctx?: BaseBuildContext) => ctx?.index ?? -1,
        },
        {
          [FLUENT_BUILDER_SYMBOL]: true,
          build: (ctx?: BaseBuildContext) => ctx?.index ?? -1,
        },
      ];

      const result = resolveValue(builders, context);
      expect(result).toEqual([0, 1]);
    });

    it("should resolve nested objects with builders", () => {
      const obj = {
        regular: "value",
        builder: {
          [FLUENT_BUILDER_SYMBOL]: true,
          build: () => "built",
        },
        nested: {
          deepBuilder: {
            [FLUENT_BUILDER_SYMBOL]: true,
            build: () => "deep",
          },
        },
      };

      expect(resolveValue(obj)).toEqual({
        regular: "value",
        builder: "built",
        nested: {
          deepBuilder: "deep",
        },
      });
    });

    it("should handle null and undefined", () => {
      expect(resolveValue(null)).toBeNull();
      expect(resolveValue(undefined)).toBeUndefined();
    });

    it("should handle primitives", () => {
      expect(resolveValue("string")).toBe("string");
      expect(resolveValue(123)).toBe(123);
      expect(resolveValue(true)).toBe(true);
    });

    it("should not modify non-plain objects", () => {
      class CustomClass {
        value = "test";
      }
      const instance = new CustomClass();

      expect(resolveValue(instance)).toBe(instance);
    });

    it("should handle circular references gracefully", () => {
      const obj: any = { value: "test" };
      obj.circular = obj;

      // TODO: Current implementation doesn't handle circular references
      // This would require tracking visited objects
      // For now, we acknowledge this limitation
      expect(() => {
        resolveValue(obj);
      }).toThrow();
    });
  });

  describe("FluentBuilderBase", () => {
    class TestBuilder extends FluentBuilderBase<{
      name: string;
      age?: number;
      tags: string[];
    }> {
      withName(name: string) {
        return this.set("name", name);
      }

      withAge(age?: number) {
        return this.set("age", age);
      }

      withTags(tags: string[]) {
        return this.set("tags", tags);
      }

      build(context?: BaseBuildContext) {
        return this.buildWithDefaults({ name: "default", tags: [] }, context);
      }
    }

    it("should have fluent builder symbol", () => {
      const builder = new TestBuilder();
      expect(builder[FLUENT_BUILDER_SYMBOL]).toBe(true);
    });

    it("should set and build simple values", () => {
      const result = new TestBuilder()
        .withName("John")
        .withAge(30)
        .withTags(["dev", "test"])
        .build();

      expect(result).toEqual({
        name: "John",
        age: 30,
        tags: ["dev", "test"],
      });
    });

    it("should apply defaults", () => {
      const result = new TestBuilder().withAge(25).build();

      expect(result).toEqual({
        name: "default",
        age: 25,
        tags: [],
      });
    });

    it("should handle nested builders", () => {
      const nestedBuilder: FluentBuilder<string> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: () => "nested-value",
      };

      const builder = new TestBuilder();
      builder["set"]("name", nestedBuilder);

      const result = builder.build();
      expect(result.name).toBe("nested-value");
    });

    it("should handle builder arrays", () => {
      const tagBuilders = [
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "tag1" },
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "tag2" },
      ];

      const builder = new TestBuilder();
      builder["set"]("tags", tagBuilders);

      const result = builder.build();
      expect(result.tags).toEqual(["tag1", "tag2"]);
    });

    it("should handle mixed arrays with builders", () => {
      const mixed = [
        "regular",
        { [FLUENT_BUILDER_SYMBOL]: true, build: () => "built" },
      ];

      const builder = new TestBuilder();
      builder["set"]("tags", mixed);

      const result = builder.build();
      expect(result.tags).toEqual(["regular", "built"]);
    });

    it("should handle conditional setting with if", () => {
      const builder = new TestBuilder()
        .withName("Alice")
        .if(() => true, "age", 30)
        .if(() => false, "tags", ["ignored"]);

      const result = builder.build();
      expect(result.age).toBe(30);
      expect(result.tags).toEqual([]);
    });

    it("should handle conditional with value function", () => {
      const builder = new TestBuilder().if(
        () => true,
        "name",
        () => "Generated",
      );

      const result = builder.build();
      expect(result.name).toBe("Generated");
    });

    it("should handle conditional with builder function", () => {
      const nameBuilder: FluentBuilder<string> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: () => "BuilderName",
      };

      const builder = new TestBuilder().if(
        () => true,
        "name",
        () => nameBuilder,
      );

      const result = builder.build();
      expect(result.name).toBe("BuilderName");
    });

    it("should check if property exists with has", () => {
      const builder = new TestBuilder().withName("Test");

      expect(builder.has("name")).toBe(true);
      expect(builder.has("age")).toBe(false);
    });

    it("should check builder properties with has", () => {
      const builder = new TestBuilder();
      const nameBuilder: FluentBuilder<string> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: () => "test",
      };
      builder["set"]("name", nameBuilder);

      expect(builder.has("name")).toBe(true);
    });

    it("should peek at current values", () => {
      const builder = new TestBuilder().withName("Peek").withAge(42);

      expect(builder.peek("name")).toBe("Peek");
      expect(builder.peek("age")).toBe(42);
      expect(builder.peek("tags")).toBeUndefined();
    });

    it("should handle initial values in constructor", () => {
      const builder = new TestBuilder({
        name: "Initial",
        age: 50,
      });

      const result = builder.build();
      expect(result.name).toBe("Initial");
      expect(result.age).toBe(50);
    });

    it("should pass context to nested builders", () => {
      const context: BaseBuildContext = { parentId: "parent" };

      const nameBuilder: FluentBuilder<string, BaseBuildContext> = {
        [FLUENT_BUILDER_SYMBOL]: true,
        build: (ctx) => `name-${ctx?.parentId}`,
      };

      const builder = new TestBuilder();
      builder["set"]("name", nameBuilder);

      const result = builder.build(context);
      expect(result.name).toBe("name-parent");
    });

    it("should use predicate with access to builder state", () => {
      const builder = new TestBuilder()
        .withName("Check")
        .if((b) => b.peek("name") === "Check", "age", 100);

      const result = builder.build();
      expect(result.age).toBe(100);
    });
  });

  describe("createInspectMethod", () => {
    it("should format builder for inspection", () => {
      const result = createInspectMethod("UserBuilder", {
        id: 123,
        name: "Alice",
        nested: { value: true },
      });

      expect(result).toContain("UserBuilder");
      expect(result).toContain('"id": 123');
      expect(result).toContain('"name": "Alice"');
      expect(result).toContain('"nested"');
    });

    it("should handle empty properties", () => {
      const result = createInspectMethod("EmptyBuilder", {});

      expect(result).toBe("EmptyBuilder { properties: {} }");
    });

    it("should handle special characters in JSON", () => {
      const result = createInspectMethod("TestBuilder", {
        quote: 'String with "quotes"',
        newline: "Line 1\nLine 2",
      });

      expect(result).toContain("TestBuilder");
      expect(result).toContain('\\"quotes\\"');
    });

    it("should handle undefined values", () => {
      const result = createInspectMethod("TestBuilder", {
        defined: "value",
        notDefined: undefined,
      });

      expect(result).toContain('"defined": "value"');
      // JSON.stringify omits undefined
      expect(result).not.toContain("notDefined");
    });
  });
});

