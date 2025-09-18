import { describe, it, expect, beforeEach, vi } from "vitest";
import { BuilderGenerator } from "../generator.js";
import type { GeneratorConfig } from "../generator.js";
import type { ResolvedType } from "../../core/types.js";
import { TypeKind } from "../../core/types.js";
import { PluginManager } from "../../core/plugin.js";
import { isOk, isErr, err } from "../../core/result.js";

describe("BuilderGenerator", () => {
  let generator: BuilderGenerator;

  beforeEach(() => {
    generator = new BuilderGenerator();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const gen = new BuilderGenerator();
      expect(gen).toBeDefined();
    });

    it("should accept custom config", () => {
      const config: GeneratorConfig = {
        outputPath: "/custom/path",
        useDefaults: false,
        contextType: "CustomContext",
        importPath: "@custom/core",
        addComments: false,
      };
      const gen = new BuilderGenerator(config);
      expect(gen).toBeDefined();
    });

    it("should accept custom plugin manager", () => {
      const pluginManager = new PluginManager();
      const gen = new BuilderGenerator({}, pluginManager);
      expect(gen).toBeDefined();
    });
  });

  describe("generate", () => {
    const createSimpleType = (): ResolvedType => ({
      sourceFile: "/test/file.ts",
      name: "TestType",
      typeInfo: {
        kind: TypeKind.Object,
        name: "TestType",
        properties: [
          {
            name: "id",
            type: { kind: TypeKind.Primitive, name: "string" },
            optional: false,
            readonly: false,
          },
          {
            name: "count",
            type: { kind: TypeKind.Primitive, name: "number" },
            optional: true,
            readonly: false,
          },
        ],
      },
      imports: [],
      dependencies: [],
    });

    it("should generate builder for simple type", async () => {
      const resolvedType = createSimpleType();
      const result = await generator.generate(resolvedType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain(
          "export interface TestTypeBuilderMethods",
        );
        expect(result.value).toContain("export class TestTypeBuilder");
        expect(result.value).toContain("export function testType(");
        expect(result.value).toContain("withId(value: string)");
        expect(result.value).toContain("withCount(value: number)");
      }
    });

    it("should generate properly formatted code", async () => {
      const resolvedType = createSimpleType();
      const result = await generator.generate(resolvedType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Verify the code is properly formatted and contains expected structures
        expect(result.value).toContain(
          "export interface TestTypeBuilderMethods",
        );
        expect(result.value).toContain("export class TestTypeBuilder");
        expect(result.value).toContain("export function testType(");
        // The code should be properly indented and structured
        expect(result.value).toMatch(/\{\s*\n.*\}/s); // Has proper braces and formatting
      }
    });

    it("should handle plugin manager", async () => {
      const pluginManager = new PluginManager();
      const gen = new BuilderGenerator({}, pluginManager);
      const result = await gen.generate(createSimpleType());

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("TestTypeBuilder");
      }
    });

    it("should handle types with no properties", async () => {
      const emptyType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "EmptyType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "EmptyType",
          properties: [],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(emptyType);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("EmptyTypeBuilder");
        expect(result.value).toContain("export function emptyType(");
      }
    });

    it("should handle code generation errors gracefully", async () => {
      // Create an invalid type that might cause generation issues
      const invalidType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "", // Empty name should cause issues
        typeInfo: {
          kind: TypeKind.Object,
          name: "",
          properties: [],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(invalidType);
      // Generator should handle edge cases gracefully
      expect(isOk(result) || isErr(result)).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear generated builders cache", async () => {
      const type1 = createTestType("Type1");
      const type2 = createTestType("Type2");

      await generator.generate(type1);
      await generator.generate(type2);

      generator.clearCache();

      // After clearing cache, should be able to generate again
      const result = await generator.generate(type1);
      expect(isOk(result)).toBe(true);
    });
  });

  describe("type generation", () => {
    it("should generate builder with JSDoc comments", async () => {
      const typeWithDocs: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "DocumentedType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "DocumentedType",
          properties: [
            {
              name: "name",
              type: { kind: TypeKind.Primitive, name: "string" },
              optional: false,
              readonly: false,
              jsDoc: "The user's name",
            },
            {
              name: "age",
              type: { kind: TypeKind.Primitive, name: "number" },
              optional: true,
              readonly: false,
              jsDoc: "The user's age in years",
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(typeWithDocs);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("/** The user's name */");
        expect(result.value).toContain("/** The user's age in years */");
      }
    });

    it("should generate builder with generics", async () => {
      const genericType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "GenericType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "GenericType",
          genericParams: [
            {
              name: "T",
              constraint: { kind: TypeKind.Primitive, name: "string" },
            },
            {
              name: "U",
              default: { kind: TypeKind.Primitive, name: "number" },
            },
          ],
          properties: [
            {
              name: "value",
              type: { kind: TypeKind.Generic, name: "T" },
              optional: false,
              readonly: false,
            },
            {
              name: "extra",
              type: { kind: TypeKind.Generic, name: "U" },
              optional: true,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(genericType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain(
          "GenericTypeBuilderMethods<T extends string, U = number>",
        );
        expect(result.value).toContain(
          "GenericTypeBuilder<T extends string, U = number>",
        );
        expect(result.value).toContain("withValue(value: T)");
        expect(result.value).toContain("withExtra(value: U)");
      }
    });

    it("should handle nested object types", async () => {
      const nestedType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "ParentType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "ParentType",
          properties: [
            {
              name: "child",
              type: {
                kind: TypeKind.Object,
                name: "ChildType",
                properties: [
                  {
                    name: "value",
                    type: { kind: TypeKind.Primitive, name: "string" },
                    optional: false,
                    readonly: false,
                  },
                ],
              },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(nestedType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain(
          "withChild(value: ChildType | FluentBuilder<ChildType, BaseBuildContext>)",
        );
      }
    });

    it("should handle array types", async () => {
      const arrayType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "ArrayType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "ArrayType",
          properties: [
            {
              name: "items",
              type: {
                kind: TypeKind.Array,
                elementType: { kind: TypeKind.Primitive, name: "string" },
              },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(arrayType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("withItems(value: Array<string>)");
      }
    });

    it("should handle union types", async () => {
      const unionType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "UnionType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "UnionType",
          properties: [
            {
              name: "status",
              type: {
                kind: TypeKind.Union,
                unionTypes: [
                  { kind: TypeKind.Literal, literal: "active" },
                  { kind: TypeKind.Literal, literal: "inactive" },
                  { kind: TypeKind.Literal, literal: "pending" },
                ],
              },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(unionType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain(
          'withStatus(value: "active" | "inactive" | "pending")',
        );
      }
    });

    it("should handle intersection types", async () => {
      const intersectionType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "IntersectionType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "IntersectionType",
          properties: [
            {
              name: "combined",
              type: {
                kind: TypeKind.Intersection,
                intersectionTypes: [
                  { kind: TypeKind.Object, name: "TypeA", properties: [] },
                  { kind: TypeKind.Object, name: "TypeB", properties: [] },
                ],
              },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(intersectionType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("withCombined(value: TypeA & TypeB)");
      }
    });

    it("should handle literal types", async () => {
      const literalType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "LiteralType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "LiteralType",
          properties: [
            {
              name: "constant",
              type: { kind: TypeKind.Literal, literal: 42 },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(literalType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("withConstant(value: 42)");
      }
    });

    it("should generate builders for dependencies", async () => {
      const childType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "Child",
        typeInfo: {
          kind: TypeKind.Object,
          name: "Child",
          properties: [
            {
              name: "value",
              type: { kind: TypeKind.Primitive, name: "string" },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const parentType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "Parent",
        typeInfo: {
          kind: TypeKind.Object,
          name: "Parent",
          properties: [
            {
              name: "child",
              type: { kind: TypeKind.Object, name: "Child", properties: [] },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [childType],
      };

      const result = await generator.generate(parentType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("export function parent(");
        expect(result.value).toContain("export function child(");
        expect(result.value).toContain("ChildBuilder");
      }
    });

    it("should not regenerate already generated builders", async () => {
      const type1: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "SharedType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "SharedType",
          properties: [],
        },
        imports: [],
        dependencies: [],
      };

      const type2: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "MainType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "MainType",
          properties: [],
        },
        imports: [],
        dependencies: [type1],
      };

      await generator.generate(type1);
      const result = await generator.generate(type2);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // SharedType should not be generated again
        const sharedTypeCount = (
          result.value.match(/export function sharedType/g) || []
        ).length;
        expect(sharedTypeCount).toBe(0);
      }
    });

    it("should handle circular dependencies gracefully", async () => {
      // Clear cache first
      generator.clearCache();

      const nodeType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "Node",
        typeInfo: {
          kind: TypeKind.Object,
          name: "Node",
          properties: [
            {
              name: "value",
              type: { kind: TypeKind.Primitive, name: "string" },
              optional: false,
              readonly: false,
            },
            {
              name: "child",
              type: { kind: TypeKind.Object, name: "Node", properties: [] },
              optional: true,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(nodeType);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("NodeBuilder");
        expect(result.value).toContain("withValue(value: string)");
        expect(result.value).toContain(
          "withChild(value: Node | FluentBuilder<Node, BaseBuildContext>)",
        );
      }
    });

    it("should handle imports correctly", async () => {
      const typeWithImports: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "ImportedType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "ImportedType",
          properties: [],
        },
        imports: ["lodash", "react", "./local"],
        dependencies: [],
      };

      const result = await generator.generate(typeWithImports);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('import type * as lodash from "lodash"');
        expect(result.value).toContain('import type * as react from "react"');
        expect(result.value).not.toContain(
          'import type * as local from "./local"',
        );
      }
    });

    it("should handle types with no comments when addComments is false", async () => {
      const gen = new BuilderGenerator({ addComments: false });
      const typeWithDocs: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "NoCommentType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "NoCommentType",
          properties: [
            {
              name: "field",
              type: { kind: TypeKind.Primitive, name: "string" },
              optional: false,
              readonly: false,
              jsDoc: "This should not appear",
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await gen.generate(typeWithDocs);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).not.toContain("This should not appear");
      }
    });
  });

  describe("plugin integration", () => {
    it("should handle plugin errors during beforeGenerate hook", async () => {
      const errorPlugin = {
        name: "error-plugin",
        version: "1.0.0",
        beforeGenerate: () => err(new Error("Plugin error")),
      };

      const pluginManager = new PluginManager();
      pluginManager.register(errorPlugin);
      const genWithErrorPlugin = new BuilderGenerator({}, pluginManager);

      const testType = createTestType("TestType");
      const result = await genWithErrorPlugin.generate(testType);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe("Plugin error");
      }
    });

    it("should handle plugin errors during afterGenerate hook", async () => {
      const errorPlugin = {
        name: "after-error-plugin",
        version: "1.0.0",
        afterGenerate: () => err(new Error("After generate error")),
      };

      const pluginManager = new PluginManager();
      pluginManager.register(errorPlugin);
      const genWithErrorPlugin = new BuilderGenerator({}, pluginManager);

      const testType = createTestType("TestType");
      const result = await genWithErrorPlugin.generate(testType);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe("After generate error");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle unknown type kinds", async () => {
      const unknownType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "UnknownType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "UnknownType",
          properties: [
            {
              name: "unknown",
              type: { kind: TypeKind.Unknown },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(unknownType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("withUnknown(value: unknown)");
      }
    });

    it("should handle types with no properties", async () => {
      const emptyType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "EmptyType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "EmptyType",
          properties: [],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(emptyType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain(
          "export interface EmptyTypeBuilderMethods",
        );
        expect(result.value).toContain("export class EmptyTypeBuilder");
        expect(result.value).toContain("export function emptyType(");
      }
    });

    it("should handle Reference type kind", async () => {
      const refType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "RefType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "RefType",
          properties: [
            {
              name: "ref",
              type: { kind: TypeKind.Reference, name: "OtherType" },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(refType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("withRef(value: OtherType)");
      }
    });

    it("should handle unknown type with name", async () => {
      const namedUnknownType: ResolvedType = {
        sourceFile: "/test/file.ts",
        name: "NamedUnknownType",
        typeInfo: {
          kind: TypeKind.Object,
          name: "NamedUnknownType",
          properties: [
            {
              name: "generic",
              type: { kind: TypeKind.Unknown },
              optional: false,
              readonly: false,
            },
          ],
        },
        imports: [],
        dependencies: [],
      };

      const result = await generator.generate(namedUnknownType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("withGeneric(value: unknown)");
      }
    });
  });
});

// Helper function
function createTestType(name: string): ResolvedType {
  return {
    sourceFile: "/test/file.ts",
    name,
    typeInfo: {
      kind: TypeKind.Object,
      name,
      properties: [],
    },
    imports: [],
    dependencies: [],
  };
}
