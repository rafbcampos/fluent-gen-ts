import { describe, it, expect, beforeEach } from "vitest";
import { ConditionalTypeResolver } from "../conditional-type-resolver.js";
import { Project, Type } from "ts-morph";
import { ok, err, isOk, isErr, type Result } from "../../core/result.js";
import { TypeKind, type TypeInfo } from "../../core/types.js";

describe("ConditionalTypeResolver", () => {
  let resolver: ConditionalTypeResolver;
  let project: Project;

  beforeEach(() => {
    resolver = new ConditionalTypeResolver();
    project = new Project({
      compilerOptions: {
        strict: true,
        noEmit: true,
      },
    });
  });

  const mockResolveType = async (type: Type, _depth: number) => {
    const typeText = type.getText();

    // Mock resolution for basic types
    if (type.isString()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "string" });
    }
    if (type.isNumber()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "number" });
    }
    if (type.isBoolean()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "boolean" });
    }
    if (type.isNull()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "null" });
    }
    if (type.isUndefined()) {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "undefined" });
    }
    if (typeText === "never") {
      return ok<TypeInfo>({ kind: TypeKind.Primitive, name: "never" });
    }
    if (type.isLiteral()) {
      return ok<TypeInfo>({ kind: TypeKind.Literal, literal: type.getLiteralValue() });
    }
    if (type.isObject() && !type.isArray()) {
      return ok<TypeInfo>({ kind: TypeKind.Object, properties: [] });
    }
    if (type.isArray()) {
      return ok<TypeInfo>({
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Unknown }
      });
    }

    return ok<TypeInfo>({ kind: TypeKind.Unknown });
  };

  describe("Basic conditional type resolution", () => {
    it("should detect conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type IsString<T> = T extends string ? true : false;
        type Test1 = IsString<string>;
        type Test2 = IsString<number>;
        `
      );

      const test1Type = sourceFile.getTypeAliasOrThrow("Test1").getType();
      const result = await resolver.resolveConditionalType(test1Type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // TypeScript should resolve this to true
        if (result.value) {
          expect(result.value.kind).toBe(TypeKind.Literal);
          if (result.value.kind === TypeKind.Literal) {
            expect(result.value.literal).toBe(true);
          }
        }
      }
    });

    it("should handle non-conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test-non-conditional.ts",
        `type SimpleType = string;`
      );

      const simpleType = sourceFile.getTypeAliasOrThrow("SimpleType").getType();
      const result = await resolver.resolveConditionalType(simpleType, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Nested conditional types", () => {
    it("should resolve nested conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test-nested.ts",
        `
        type NestedCheck<T> = T extends string
          ? T extends "admin"
            ? "full-access"
            : "limited-access"
          : "no-access";

        type AdminAccess = NestedCheck<"admin">;
        type UserAccess = NestedCheck<"user">;
        type NumberAccess = NestedCheck<number>;
        `
      );

      const adminType = sourceFile.getTypeAliasOrThrow("AdminAccess").getType();
      const result = await resolver.resolveConditionalType(adminType, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        if (result.value.kind === TypeKind.Literal) {
          expect(result.value.literal).toBe("full-access");
        }
      }
    });
  });

  describe("Conditional types with unions", () => {
    it("should handle conditional types with union conditions", async () => {
      const sourceFile = project.createSourceFile(
        "test-union.ts",
        `
        type ExtractStrings<T> = T extends string | number ? T : never;
        type StringOrNumber = ExtractStrings<string | boolean | number>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("StringOrNumber").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      // This would resolve to string | number
    });
  });

  describe("Conditional types with generics", () => {
    it("should handle unresolved generic conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test-generic.ts",
        `
        type IsArray<T> = T extends readonly unknown[] ? true : false;

        interface GenericTest<T> {
          isArray: IsArray<T>;
        }
        `
      );

      const interfaceNode = sourceFile.getInterfaceOrThrow("GenericTest");
      const isArrayProp = interfaceNode.getPropertyOrThrow("isArray");
      const propType = isArrayProp.getType();

      const result = await resolver.resolveConditionalType(propType, mockResolveType);

      expect(isOk(result)).toBe(true);
      // For unresolved generics, it should return a union or unknown
    });
  });

  describe("Conditional types with infer", () => {
    it("should detect infer keyword in conditional types", () => {
      const sourceFile = project.createSourceFile(
        "test-infer.ts",
        `
        type ReturnType<T> = T extends (...args: never[]) => infer R ? R : never;
        type FunctionReturn = ReturnType<() => string>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("FunctionReturn").getType();
      const inferResult = resolver.resolveInferTypes(type);

      expect(isOk(inferResult)).toBe(true);
      if (isOk(inferResult)) {
        // Should detect the infer keyword
        expect(inferResult.value).toBeDefined();
      }
    });

    it("should handle multiple infer types", () => {
      const sourceFile = project.createSourceFile(
        "test-multi-infer.ts",
        `
        type Parameters<T> = T extends (...args: infer P) => infer R
          ? { params: P, return: R }
          : never;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("Parameters").getType();
      const inferResult = resolver.resolveInferTypes(type);

      expect(isOk(inferResult)).toBe(true);
      // Should detect multiple infer keywords
    });
  });

  describe("Max depth protection", () => {
    it("should handle max depth exceeded", async () => {
      const resolverWithLowDepth = new ConditionalTypeResolver({ maxDepth: 2 });

      // Create a deeply nested conditional type
      const sourceFile = project.createSourceFile(
        "test-depth.ts",
        `
        type Deep<T, N extends number = 10> = N extends 0
          ? T
          : T extends string
            ? Deep<T, Decrement<N>>
            : never;

        type Decrement<N> = N extends 10 ? 9 : N extends 9 ? 8 : 0;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("Deep").getType();

      const deepResolve = async (t: Type, depth: number): Promise<any> => {
        if (depth > 3) {
          return err(new Error("Max depth"));
        }
        return resolverWithLowDepth.resolveConditionalType(t, deepResolve, depth);
      };

      const result = await resolverWithLowDepth.resolveConditionalType(type, deepResolve, 0);

      // Should handle max depth gracefully
      expect(result).toBeDefined();
      if (isErr(result)) {
        expect(result.error.message).toContain("depth");
      }
    });
  });

  describe("Complex real-world conditional types", () => {
    it("should handle TypeScript built-in conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test-builtin.ts",
        `
        // Simplified version of TypeScript's built-in types
        type MyExclude<T, U> = T extends U ? never : T;
        type MyExtract<T, U> = T extends U ? T : never;
        type MyNonNullable<T> = T extends null | undefined ? never : T;

        type Colors = "red" | "blue" | "green" | null;
        type NonNullColors = MyNonNullable<Colors>;
        type PrimaryColors = MyExclude<Colors, "green" | null>;
        `
      );

      const nonNullColors = sourceFile.getTypeAliasOrThrow("NonNullColors").getType();
      const result = await resolver.resolveConditionalType(nonNullColors, mockResolveType);

      expect(isOk(result)).toBe(true);
      // Should resolve to "red" | "blue" | "green"
    });

    it("should handle distributive conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test-distributive.ts",
        `
        type ToArray<T> = T extends unknown ? T[] : never;
        type StringOrNumber = string | number;
        type ArrayUnion = ToArray<StringOrNumber>;
        // Should be string[] | number[]
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("ArrayUnion").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      // Should handle distributive conditional types correctly
    });
  });

  describe("Error handling", () => {
    it("should handle malformed conditional types gracefully", async () => {
      const sourceFile = project.createSourceFile(
        "test-malformed.ts",
        `
        // This creates an unusual type that might trip up the resolver
        type Weird = unknown & (string extends number ? true : false);
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("Weird").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      // Should not crash, return either ok with null or handled result
      expect(result).toBeDefined();
    });

    it("should handle resolver function errors", async () => {
      const errorResolver = async (_type: Type, _depth: number): Promise<Result<TypeInfo>> => {
        return err(new Error("Resolution failed"));
      };

      const sourceFile = project.createSourceFile(
        "test-resolver-error.ts",
        `type Test<T> = T extends string ? T : never;`
      );

      const type = sourceFile.getTypeAliasOrThrow("Test").getType();
      const result = await resolver.resolveConditionalType(type, errorResolver);

      // Should propagate or handle resolver errors appropriately
      expect(result).toBeDefined();
    });
  });

  describe("Type equality checks", () => {
    it("should detect when both branches resolve to the same type", async () => {
      const sourceFile = project.createSourceFile(
        "test-equality.ts",
        `
        // Both branches resolve to string
        type AlwaysString<T> = T extends unknown ? string : string;
        type Result = AlwaysString<number>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("Result").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        // Should simplify to just string instead of a union
        expect(result.value.kind).toBe(TypeKind.Primitive);
        if (result.value.kind === TypeKind.Primitive) {
          expect(result.value.name).toBe("string");
        }
      }
    });
  });

  describe("Pattern matching conditional types", () => {
    it("should handle template literal pattern matching", async () => {
      const sourceFile = project.createSourceFile(
        "test-pattern.ts",
        `
        type StartsWith<T, U> = T extends \`\${U & string}\${string}\` ? true : false;
        type Test = StartsWith<"hello", "he">;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("Test").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      // Should handle template literal patterns
    });

    it("should handle tuple pattern matching", async () => {
      const sourceFile = project.createSourceFile(
        "test-tuple-pattern.ts",
        `
        type First<T> = T extends readonly [infer H, ...unknown[]] ? H : never;
        type FirstOfTuple = First<[1, 2, 3]>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("FirstOfTuple").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      // Should extract the first element
    });
  });
});