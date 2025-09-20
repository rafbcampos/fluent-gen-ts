import { describe, it, expect, beforeEach } from "vitest";
import { TemplateLiteralResolver } from "../template-literal-resolver.js";
import { Project, Type } from "ts-morph";
import { ok, err, isOk, isErr, type Result } from "../../core/result.js";
import { TypeKind, type TypeInfo } from "../../core/types.js";

describe("TemplateLiteralResolver", () => {
  let resolver: TemplateLiteralResolver;
  let project: Project;

  beforeEach(() => {
    resolver = new TemplateLiteralResolver();
    project = new Project({
      compilerOptions: {
        strict: true,
        noEmit: true,
      },
    });
  });

  const mockResolveType = async (type: Type, _depth: number) => {
    if (type.isString()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "string" });
    }
    if (type.isNumber()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "number" });
    }
    if (type.isBoolean()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "boolean" });
    }
    if (type.isLiteral()) {
      return ok<TypeInfo>({
        kind: TypeKind.Literal,
        literal: type.getLiteralValue(),
      });
    }
    if (type.isUnion()) {
      const unionTypes = type.getUnionTypes();
      const resolvedTypes: TypeInfo[] = [];
      for (const unionType of unionTypes) {
        if (unionType.isLiteral()) {
          resolvedTypes.push({
            kind: TypeKind.Literal,
            literal: unionType.getLiteralValue(),
          });
        }
      }
      if (resolvedTypes.length > 0) {
        return ok<TypeInfo>({
          kind: TypeKind.Union,
          unionTypes: resolvedTypes,
        });
      }
    }

    return ok<TypeInfo>({ kind: TypeKind.Unknown });
  };

  describe("Basic template literal detection", () => {
    it("should detect template literal types", async () => {
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type Greeting = \`Hello, \${string}\`;
        `,
      );

      const greetingType = sourceFile.getTypeAliasOrThrow("Greeting").getType();
      const result = await resolver.resolveTemplateLiteral(
        greetingType,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeDefined();
      }
    });

    it("should return null for non-template-literal types", async () => {
      const sourceFile = project.createSourceFile(
        "test-non-template.ts",
        `type SimpleString = string;`,
      );

      const simpleType = sourceFile
        .getTypeAliasOrThrow("SimpleString")
        .getType();
      const result = await resolver.resolveTemplateLiteral(
        simpleType,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Simple template literals", () => {
    it("should resolve template literals without placeholders", async () => {
      const sourceFile = project.createSourceFile(
        "test-simple.ts",
        `type StaticMessage = \`Hello, World!\`;`,
      );

      const type = sourceFile.getTypeAliasOrThrow("StaticMessage").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("Hello, World!");
        }
      }
    });
  });

  describe("Template literals with placeholders", () => {
    it("should handle template literals with string placeholders", async () => {
      const sourceFile = project.createSourceFile(
        "test-placeholder.ts",
        `
        type EmailDomain = \`user@\${string}.com\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("EmailDomain").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        // Since it has a string placeholder, it should resolve to string type
        expect(result.value.kind).toBe(TypeKind.Primitive);
        if (result.value.kind === TypeKind.Primitive) {
          expect(result.value.name).toBe("string");
        }
      }
    });

    it("should handle template literals with literal union placeholders", async () => {
      const sourceFile = project.createSourceFile(
        "test-union-placeholder.ts",
        `
        type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
        type Endpoint = \`/api/\${HttpMethod}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Endpoint").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(4);
          const literals = result.value.unionTypes
            .filter((t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal)
            .map((t) => t.literal)
            .sort();
          expect(literals).toEqual([
            "/api/DELETE",
            "/api/GET",
            "/api/POST",
            "/api/PUT",
          ]);
        }
      }
    });

    it("should handle multiple placeholders", async () => {
      const sourceFile = project.createSourceFile(
        "test-multiple-placeholders.ts",
        `
        type Environment = "dev" | "prod";
        type Region = "us" | "eu";
        type ApiUrl = \`https://\${Environment}-\${Region}.example.com\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("ApiUrl").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(4);
          const literals = result.value.unionTypes
            .filter((t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal)
            .map((t) => t.literal)
            .sort();
          expect(literals).toEqual([
            "https://dev-eu.example.com",
            "https://dev-us.example.com",
            "https://prod-eu.example.com",
            "https://prod-us.example.com",
          ]);
        }
      }
    });
  });

  describe("Complex template literals", () => {
    it("should handle nested template literals", async () => {
      const sourceFile = project.createSourceFile(
        "test-nested.ts",
        `
        type Prefix = \`pre-\${string}\`;
        type Suffixed = \`\${Prefix}-post\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Suffixed").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Primitive);
        if (result.value.kind === TypeKind.Primitive) {
          expect(result.value.name).toBe("string");
        }
      }
    });

    it("should handle template literals with number literals", async () => {
      const sourceFile = project.createSourceFile(
        "test-numbers.ts",
        `
        type Port = 3000 | 8080;
        type ServerUrl = \`http://localhost:\${Port}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("ServerUrl").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(2);
          const literals = result.value.unionTypes
            .filter((t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal)
            .map((t) => t.literal)
            .sort();
          expect(literals).toEqual([
            "http://localhost:3000",
            "http://localhost:8080",
          ]);
        }
      }
    });

    it("should handle template literals with boolean literals", async () => {
      const sourceFile = project.createSourceFile(
        "test-boolean.ts",
        `
        type FeatureFlag = \`feature-\${boolean}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("FeatureFlag").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(2);
          const literals = result.value.unionTypes
            .filter((t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal)
            .map((t) => t.literal)
            .sort();
          expect(literals).toEqual(["feature-false", "feature-true"]);
        }
      }
    });
  });

  describe("Template literal patterns", () => {
    it("should handle uppercase/lowercase transformations", async () => {
      const sourceFile = project.createSourceFile(
        "test-transforms.ts",
        `
        type Uppercase<T extends string> = Uppercase<T>;
        type Lowercase<T extends string> = Lowercase<T>;
        type Capitalize<T extends string> = Capitalize<T>;
        type Uncapitalize<T extends string> = Uncapitalize<T>;

        type ShoutGreeting = Uppercase<"hello">;
        type WhisperGreeting = Lowercase<"HELLO">;
        type ProperName = Capitalize<"john">;
        type CasualName = Uncapitalize<"John">;
        `,
      );

      const shoutType = sourceFile
        .getTypeAliasOrThrow("ShoutGreeting")
        .getType();
      const result = await resolver.resolveTemplateLiteral(
        shoutType,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("HELLO");
        }
      }
    });
  });

  describe("Max depth protection", () => {
    it("should handle max depth exceeded", async () => {
      const resolverWithLowDepth = new TemplateLiteralResolver({ maxDepth: 2 });

      const deepResolve = async (t: Type, depth: number): Promise<any> => {
        if (depth > 3) {
          return err(new Error("Max depth"));
        }
        return mockResolveType(t, depth);
      };

      const sourceFile = project.createSourceFile(
        "test-depth.ts",
        `
        type Deep1 = \`level-\${string}\`;
        type Deep2 = \`\${Deep1}-nested\`;
        type Deep3 = \`\${Deep2}-more\`;
        type Deep4 = \`\${Deep3}-deeper\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Deep4").getType();
      const result = await resolverWithLowDepth.resolveTemplateLiteral(
        type,
        deepResolve,
        0,
      );

      // Should handle max depth gracefully
      expect(result).toBeDefined();
      if (isErr(result)) {
        expect(result.error.message).toContain("depth");
      }
    });
  });

  describe("TypeScript internal flag detection", () => {
    it("should detect template literal types using TypeScript flags", async () => {
      const sourceFile = project.createSourceFile(
        "flag-detection.ts",
        `type TemplateFlag = \`prefix-\${string}\`;`
      );

      const type = sourceFile.getTypeAliasOrThrow("TemplateFlag").getType();
      const result = await resolver.resolveTemplateLiteral(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).not.toBeNull();
      }
    });

    it("should handle types with TypeScript flags but no template literal flag", async () => {
      const sourceFile = project.createSourceFile(
        "non-template-flag.ts",
        `type RegularString = string;`
      );

      const type = sourceFile.getTypeAliasOrThrow("RegularString").getType();
      const result = await resolver.resolveTemplateLiteral(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should handle types with malformed compiler type", async () => {
      const mockTypeWithBadFlags = {
        getText: () => "`template`",
        compilerType: {
          flags: "not-a-number"
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithBadFlags,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("template");
        }
      }
    });

    it("should handle types without flags property in compiler type", async () => {
      const mockTypeWithoutFlags = {
        getText: () => "`no-flags`",
        compilerType: {
          someOtherProperty: true
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithoutFlags,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("no-flags");
        }
      }
    });
  });

  describe("Template reconstruction logic", () => {
    it("should handle types with TypeScript internal structure", async () => {
      const mockTypeWithInternalStructure = {
        getText: () => "Template<T>",
        compilerType: {
          texts: ["prefix-", "-middle-", "-suffix"],
          types: [
            { getText: () => "string" },
            { getText: () => "number" }
          ]
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithInternalStructure,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should handle types with empty texts array", async () => {
      const mockTypeWithEmptyTexts = {
        getText: () => "`template`",
        compilerType: {
          texts: [],
          types: []
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithEmptyTexts,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("template");
        }
      }
    });

    it("should handle types with null texts property", async () => {
      const mockTypeWithNullTexts = {
        getText: () => "`template`",
        compilerType: {
          texts: null,
          types: []
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithNullTexts,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("template");
        }
      }
    });

    it("should handle types where texts is not an array", async () => {
      const mockTypeWithBadTexts = {
        getText: () => "`template`",
        compilerType: {
          texts: "not-an-array",
          types: []
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithBadTexts,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("template");
        }
      }
    });

    it("should handle types with partial internal structure", async () => {
      const mockTypeWithPartialStructure = {
        getText: () => "`partial-${T}`",
        compilerType: {
          texts: ["partial-", ""],
          types: undefined
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithPartialStructure,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Primitive);
        if (result.value.kind === TypeKind.Primitive) {
          expect(result.value.name).toBe("string");
        }
      }
    });
  });

  describe("Template literal value expansion edge cases", () => {
    it("should handle types with extractable computed values", async () => {
      const mockTypeWithComputedValues = {
        getText: () => "`computed-${T}`",
        compilerType: {
          types: [
            { value: "literal1" },
            { value: "literal2" },
            { value: "literal3" }
          ]
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithComputedValues,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes.length).toBe(3);
          const allAreLiterals = result.value.unionTypes.every(
            (t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal
          );
          expect(allAreLiterals).toBe(true);
        }
      }
    });

    it("should handle types with partial value extraction", async () => {
      const mockTypeWithPartialValues = {
        getText: () => "`partial-${T}`",
        compilerType: {
          types: [
            { value: "extractable" },
            { someOtherProperty: true },
            { value: undefined }
          ]
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithPartialValues,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("extractable");
        }
      }
    });

    it("should handle types with numeric values", async () => {
      const mockTypeWithNumericValues = {
        getText: () => "`number-${N}`",
        compilerType: {
          types: [
            { value: 42 },
            { value: 100 },
            { value: 0 }
          ]
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithNumericValues,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes.length).toBe(3);
          const allAreLiterals = result.value.unionTypes.every(
            (t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal
          );
          expect(allAreLiterals).toBe(true);
        }
      }
    });

    it("should handle types with boolean values", async () => {
      const mockTypeWithBooleanValues = {
        getText: () => "`flag-${B}`",
        compilerType: {
          types: [
            { value: true },
            { value: false }
          ]
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithBooleanValues,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes.length).toBe(2);
          const allAreLiterals = result.value.unionTypes.every(
            (t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal
          );
          expect(allAreLiterals).toBe(true);
        }
      }
    });

    it("should handle types without extractable values", async () => {
      const mockTypeWithoutValues = {
        getText: () => "`no-values-${T}`",
        compilerType: {
          types: [
            { notAValue: "something" },
            { random: true }
          ]
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithoutValues,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Primitive);
        if (result.value.kind === TypeKind.Primitive) {
          expect(result.value.name).toBe("string");
        }
      }
    });

    it("should handle types with empty types array", async () => {
      const mockTypeWithEmptyTypes = {
        getText: () => "`empty-types`",
        compilerType: {
          types: []
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithEmptyTypes,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("empty-types");
        }
      }
    });

    it("should handle types with non-array types property", async () => {
      const mockTypeWithBadTypes = {
        getText: () => "`bad-types`",
        compilerType: {
          types: "not-an-array"
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithBadTypes,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("bad-types");
        }
      }
    });
  });

  describe("Error handling", () => {
    it("should handle malformed template literals gracefully", async () => {
      const sourceFile = project.createSourceFile(
        "test-malformed.ts",
        `
        // TypeScript might not even allow this, but we should handle it
        type Weird = string & \`prefix-\${number}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Weird").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      // Should not crash
      expect(result).toBeDefined();
    });

    it("should handle max depth exceeded gracefully", async () => {
      const lowDepthResolver = new TemplateLiteralResolver({ maxDepth: 1 });
      const sourceFile = project.createSourceFile(
        "deep-template.ts",
        `
        type DeepTemplate = \`level-\${string}\`;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("DeepTemplate").getType();
      const result = await lowDepthResolver.resolveTemplateLiteral(
        type,
        mockResolveType,
        2 // Exceed max depth
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Max template literal resolution depth exceeded");
      }
    });

    it("should handle exceptions in template literal processing", async () => {
      // Test the error handling wrapper in resolveTemplateLiteral
      const errorResolver = new TemplateLiteralResolver();

      // Mock a scenario where the internal processing throws
      const originalExtractPattern = (errorResolver as any).extractTemplateLiteralPattern;
      (errorResolver as any).extractTemplateLiteralPattern = () => {
        throw new Error("Intentional processing error");
      };

      const mockType = {
        getText: () => "`template`",
        compilerType: {}
      } as unknown as Type;

      const result = await errorResolver.resolveTemplateLiteral(
        mockType,
        mockResolveType
      );

      // Restore original method
      (errorResolver as any).extractTemplateLiteralPattern = originalExtractPattern;

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Failed to resolve template literal type");
      }
    });

    it("should handle resolver function errors", async () => {
      const errorResolver = async (
        _type: Type,
        _depth: number,
      ): Promise<Result<TypeInfo>> => {
        return err(new Error("Resolution failed"));
      };

      const sourceFile = project.createSourceFile(
        "test-resolver-error.ts",
        `type Test = \`error-\${string}\`;`,
      );

      const type = sourceFile.getTypeAliasOrThrow("Test").getType();
      const result = await resolver.resolveTemplateLiteral(type, errorResolver);

      // Should handle or propagate resolver errors appropriately
      expect(result).toBeDefined();
    });

    it("should handle template literal pattern extraction errors", async () => {
      const mockTypeWithBadPattern = {
        getText: () => {
          throw new Error("getText failed");
        },
        compilerType: {
          texts: ["broken", "pattern"],
          types: []
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithBadPattern,
        mockResolveType
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Failed to resolve template literal type");
        expect(result.error.message).toContain("getText failed");
      }
    });

    it("should handle types that throw during internal processing", async () => {
      const mockTypeWithThrowingGetter = {
        getText: () => {
          throw new Error("getText failed");
        },
        compilerType: null
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithThrowingGetter,
        mockResolveType
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Failed to resolve template literal type");
        expect(result.error.message).toContain("getText failed");
      }
    });

    it("should handle circular reference in template resolution", async () => {
      const sourceFile = project.createSourceFile(
        "circular-template.ts",
        `
        type A<T> = \`prefix-\${B<T>}\`;
        type B<T> = \`suffix-\${A<T>}\`;
        type CircularTemplate = A<string>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("CircularTemplate").getType();
      const result = await resolver.resolveTemplateLiteral(type, mockResolveType);

      expect(result).toBeDefined();
    });

    it("should handle template literals with malformed placeholder syntax", async () => {
      const mockTypeWithBadPlaceholder = {
        getText: () => "`prefix-$invalid-suffix`",
        compilerType: null
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithBadPlaceholder,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("prefix-$invalid-suffix");
        }
      }
    });

    it("should handle template literals with complex nested errors", async () => {
      const errorThrowingResolver = async (
        type: Type,
        depth: number,
      ): Promise<Result<TypeInfo>> => {
        if (depth > 2) {
          throw new Error("Deep resolution error");
        }
        return mockResolveType(type, depth);
      };

      const sourceFile = project.createSourceFile(
        "nested-error.ts",
        `
        type Level1 = \`l1-\${string}\`;
        type Level2 = \`l2-\${Level1}\`;
        type Level3 = \`l3-\${Level2}\`;
        type Level4 = \`l4-\${Level3}\`;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("Level4").getType();
      const result = await resolver.resolveTemplateLiteral(type, errorThrowingResolver);

      expect(result).toBeDefined();
    });

    it("should handle types without compiler representation", async () => {
      const mockTypeWithoutCompiler = {
        getText: () => "`template-literal`",
        // No compilerType property
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithoutCompiler,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("template-literal");
        }
      }
    });

    it("should handle types with malformed internal structure", async () => {
      const mockTypeWithBadStructure = {
        getText: () => "SomeType",
        compilerType: {
          texts: null, // Invalid structure
          types: "not-an-array"
        }
      } as unknown as Type;

      const result = await resolver.resolveTemplateLiteral(
        mockTypeWithBadStructure,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should handle empty template literals", async () => {
      const sourceFile = project.createSourceFile(
        "test-empty.ts",
        `type Empty = \`\`;`,
      );

      const type = sourceFile.getTypeAliasOrThrow("Empty").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("");
        }
      }
    });
  });

  describe("String transformation intrinsics", () => {
    it("should handle Capitalize<T> utility type", async () => {
      const sourceFile = project.createSourceFile(
        "capitalize-test.ts",
        `
        type LowercaseWord = "hello";
        type CapitalizedWord = Capitalize<LowercaseWord>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("CapitalizedWord").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("Hello");
        }
      }
    });

    it("should handle Uncapitalize<T> utility type", async () => {
      const sourceFile = project.createSourceFile(
        "uncapitalize-test.ts",
        `
        type UppercaseWord = "HELLO";
        type UncapitalizedWord = Uncapitalize<UppercaseWord>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("UncapitalizedWord").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("hELLO");
        }
      }
    });

    it("should handle Uppercase<T> utility type", async () => {
      const sourceFile = project.createSourceFile(
        "uppercase-test.ts",
        `
        type MixedCase = "Hello World";
        type UppercaseText = Uppercase<MixedCase>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("UppercaseText").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("HELLO WORLD");
        }
      }
    });

    it("should handle Lowercase<T> utility type", async () => {
      const sourceFile = project.createSourceFile(
        "lowercase-test.ts",
        `
        type MixedCase = "Hello World";
        type LowercaseText = Lowercase<MixedCase>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("LowercaseText").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("hello world");
        }
      }
    });

    it("should handle edge cases in string transformations", () => {
      // Test applyStringTransform with edge cases
      expect(resolver.applyStringTransform("", "capitalize")).toBe("");
      expect(resolver.applyStringTransform("", "uncapitalize")).toBe("");
      expect(resolver.applyStringTransform("", "uppercase")).toBe("");
      expect(resolver.applyStringTransform("", "lowercase")).toBe("");
      expect(resolver.applyStringTransform("a", "capitalize")).toBe("A");
      expect(resolver.applyStringTransform("A", "uncapitalize")).toBe("a");
      expect(resolver.applyStringTransform("hello", "unknown")).toBe("hello");
    });

    it("should handle non-transform types in resolveCapitalizePattern", () => {
      const mockType = {
        getText: () => "RegularType<string>"
      } as unknown as Type;
      const result = resolver.resolveCapitalizePattern(mockType);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Template literal value expansion", () => {
    it("should handle template literals with computed values", async () => {
      const sourceFile = project.createSourceFile(
        "computed-values.ts",
        `
        type Environment = "dev" | "staging" | "prod";
        type DatabaseUrl = \`postgres://localhost:5432/\${Environment}\`;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("DatabaseUrl").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes.length).toBeGreaterThan(0);
          const allAreLiterals = result.value.unionTypes.every(
            (t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal
          );
          expect(allAreLiterals).toBe(true);
        }
      }
    });

    it("should handle template literals with multiple placeholders", async () => {
      const sourceFile = project.createSourceFile(
        "multi-placeholder.ts",
        `
        type Protocol = "http" | "https";
        type Domain = "api" | "cdn";
        type ServiceUrl = \`\${Protocol}://\${Domain}.example.com\`;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("ServiceUrl").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes.length).toBe(4);
          const allAreLiterals = result.value.unionTypes.every(
            (t): t is { kind: TypeKind.Literal; literal: string } => t.kind === TypeKind.Literal
          );
          expect(allAreLiterals).toBe(true);
        }
      }
    });

    it("should handle template literals that resolve to string fallback", async () => {
      const sourceFile = project.createSourceFile(
        "string-fallback.ts",
        `
        type DynamicTemplate = \`dynamic-\${string}\`;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("DynamicTemplate").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        // Should fallback to string when cannot determine concrete values
        expect(result.value.kind).toBe(TypeKind.Primitive);
        if (result.value.kind === TypeKind.Primitive) {
          expect(result.value.name).toBe("string");
        }
      }
    });
  });

  describe("Template literal pattern extraction", () => {
    it("should extract patterns without placeholders", async () => {
      const sourceFile = project.createSourceFile(
        "no-placeholder.ts",
        `
        type StaticString = \`hello-world\`;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("StaticString").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("hello-world");
        }
      }
    });

    it("should handle empty template literals", async () => {
      const sourceFile = project.createSourceFile(
        "empty-template.ts",
        `
        type EmptyTemplate = \`\`;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("EmptyTemplate").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("");
        }
      }
    });
  });

  describe("Real-world template literal patterns", () => {
    it("should handle CSS class name patterns", async () => {
      const sourceFile = project.createSourceFile(
        "test-css.ts",
        `
        type Size = "sm" | "md" | "lg";
        type Color = "primary" | "secondary" | "danger";
        type ButtonClass = \`btn-\${Size}-\${Color}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("ButtonClass").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(9);
          // Should generate all combinations
        }
      }
    });

    it("should handle route patterns", async () => {
      const sourceFile = project.createSourceFile(
        "test-routes.ts",
        `
        type Entity = "users" | "posts" | "comments";
        type Action = "list" | "create" | "update" | "delete";
        type Route = \`/\${Entity}/\${Action}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Route").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(12);
          // Should generate all route combinations
        }
      }
    });

    it("should handle event name patterns", async () => {
      const sourceFile = project.createSourceFile(
        "test-events.ts",
        `
        type EventTarget = "button" | "form" | "input";
        type EventType = "click" | "submit" | "change";
        type EventName = \`on\${Capitalize<EventTarget>}\${Capitalize<EventType>}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("EventName").getType();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Primitive);
        if (result.value.kind === TypeKind.Primitive) {
          expect(result.value.name).toBe("string");
        }
      }
    });
  });

  describe("Performance considerations", () => {
    it("should handle large union expansions efficiently", async () => {
      const sourceFile = project.createSourceFile(
        "test-performance.ts",
        `
        type Letter = "a" | "b" | "c" | "d" | "e";
        type Number = "1" | "2" | "3" | "4" | "5";
        type Code = \`\${Letter}\${Number}\`;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Code").getType();
      const startTime = performance.now();
      const result = await resolver.resolveTemplateLiteral(
        type,
        mockResolveType,
      );
      const endTime = performance.now();

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(25);
        }
      }

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});

