import { describe, it, expect, beforeEach } from "vitest";
import { ConditionalTypeResolver } from "../conditional-type-resolver.js";
import { Project, Type } from "ts-morph";
import { ok, isOk, type Result } from "../../core/result.js";
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

  const mockResolveType = async (_type: Type, _depth: number): Promise<Result<TypeInfo>> => {
    // Simple mock that returns unknown for unresolved types
    return ok({ kind: TypeKind.Unknown });
  };

  describe("Already resolved conditional types", () => {
    it("should return null for already resolved conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type IsString<T> = T extends string ? true : false;
        type Test = IsString<string>;  // TypeScript resolves this to 'true'
        `
      );

      const testType = sourceFile.getTypeAliasOrThrow("Test").getType();
      const result = await resolver.resolveConditionalType(testType, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null because TypeScript already resolved it to 'true'
        expect(result.value).toBeNull();
      }
    });

    it("should return null for conditional types resolved to objects", async () => {
      const sourceFile = project.createSourceFile(
        "test-obj.ts",
        `
        interface User {
          id: string;
          name: string;
        }

        interface Admin {
          id: string;
          role: string;
        }

        type GetUser<T> = T extends "admin" ? Admin : User;
        type Result = GetUser<"user">;  // TypeScript resolves this to User
        `
      );

      const resultType = sourceFile.getTypeAliasOrThrow("Result").getType();
      const result = await resolver.resolveConditionalType(resultType, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null because TypeScript already resolved it
        expect(result.value).toBeNull();
      }
    });

    it("should return null for resolved distributive conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test-distributive.ts",
        `
        type NonNullable<T> = T extends null | undefined ? never : T;
        type Result = NonNullable<string | null>;  // TypeScript resolves this to 'string'
        `
      );

      const resultType = sourceFile.getTypeAliasOrThrow("Result").getType();
      const result = await resolver.resolveConditionalType(resultType, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null because TypeScript already resolved it to 'string'
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Unresolved conditional types", () => {
    it("should handle conditional types dependent on generic parameters", async () => {
      const sourceFile = project.createSourceFile(
        "test-generic.ts",
        `
        type IsArray<T> = T extends any[] ? true : false;

        interface Container<T> {
          value: T;
          isArray: IsArray<T>;  // This depends on generic T
        }
        `
      );

      const containerType = sourceFile.getInterfaceOrThrow("Container").getType();
      const isArrayProp = containerType.getProperty("isArray");
      const propType = isArrayProp?.getTypeAtLocation(sourceFile);

      if (propType) {
        const result = await resolver.resolveConditionalType(propType, mockResolveType);

        expect(isOk(result)).toBe(true);
        if (isOk(result) && result.value) {
          // Should return a generic type info since it can't be resolved
          expect(result.value.kind).toBe(TypeKind.Generic);
          if (result.value.kind === TypeKind.Generic) {
            expect(result.value.name).toContain("IsArray");
          }
        }
      }
    });

    it("should handle nested conditional types with unresolved parameters", async () => {
      const sourceFile = project.createSourceFile(
        "test-nested-generic.ts",
        `
        type DeepCheck<T> = T extends object
          ? T extends any[]
            ? "array"
            : "object"
          : "primitive";

        interface GenericContainer<T> {
          type: DeepCheck<T>;
        }
        `
      );

      const containerType = sourceFile.getInterfaceOrThrow("GenericContainer").getType();
      const typeProp = containerType.getProperty("type");
      const propType = typeProp?.getTypeAtLocation(sourceFile);

      if (propType) {
        const result = await resolver.resolveConditionalType(propType, mockResolveType);

        expect(isOk(result)).toBe(true);
        if (isOk(result) && result.value) {
          // Should handle unresolved conditional
          expect(result.value.kind).toBe(TypeKind.Generic);
        }
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle max depth protection", async () => {
      const resolverWithLowDepth = new ConditionalTypeResolver({ maxDepth: 2 });

      const sourceFile = project.createSourceFile(
        "test-depth.ts",
        `type Test = string;`
      );

      const type = sourceFile.getTypeAliasOrThrow("Test").getType();
      const result = await resolverWithLowDepth.resolveConditionalType(type, mockResolveType, 3);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain("depth");
      }
    });

    it("should return null for primitive types", async () => {
      const sourceFile = project.createSourceFile(
        "test-primitive.ts",
        `type Test = string;`
      );

      const type = sourceFile.getTypeAliasOrThrow("Test").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should return null for literal types", async () => {
      const sourceFile = project.createSourceFile(
        "test-literal.ts",
        `type Test = "hello";`
      );

      const type = sourceFile.getTypeAliasOrThrow("Test").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should return null for object types with properties", async () => {
      const sourceFile = project.createSourceFile(
        "test-object.ts",
        `
        interface Test {
          id: string;
          name: string;
        }
        `
      );

      const type = sourceFile.getInterfaceOrThrow("Test").getType();
      const result = await resolver.resolveConditionalType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle TypeScript utility types that are already resolved", async () => {
      const sourceFile = project.createSourceFile(
        "test-utility.ts",
        `
        interface User {
          id: string;
          name: string;
          email?: string;
        }

        type RequiredUser = Required<User>;
        type PartialUser = Partial<User>;
        type PickedUser = Pick<User, "id" | "name">;
        `
      );

      const requiredType = sourceFile.getTypeAliasOrThrow("RequiredUser").getType();
      const partialType = sourceFile.getTypeAliasOrThrow("PartialUser").getType();
      const pickedType = sourceFile.getTypeAliasOrThrow("PickedUser").getType();

      const requiredResult = await resolver.resolveConditionalType(requiredType, mockResolveType);
      const partialResult = await resolver.resolveConditionalType(partialType, mockResolveType);
      const pickedResult = await resolver.resolveConditionalType(pickedType, mockResolveType);

      // All should return null as TypeScript has already resolved them
      expect(isOk(requiredResult) && requiredResult.value).toBeNull();
      expect(isOk(partialResult) && partialResult.value).toBeNull();
      expect(isOk(pickedResult) && pickedResult.value).toBeNull();
    });

    it("should handle complex conditional types that TypeScript resolves", async () => {
      const sourceFile = project.createSourceFile(
        "test-complex.ts",
        `
        type IsFunction<T> = T extends (...args: any[]) => any ? true : false;
        type IsObject<T> = T extends object ? true : false;

        type TestFunction = IsFunction<() => void>;  // Resolves to true
        type TestObject = IsObject<{ a: string }>;   // Resolves to true
        type TestPrimitive = IsObject<string>;        // Resolves to false
        `
      );

      const functionType = sourceFile.getTypeAliasOrThrow("TestFunction").getType();
      const objectType = sourceFile.getTypeAliasOrThrow("TestObject").getType();
      const primitiveType = sourceFile.getTypeAliasOrThrow("TestPrimitive").getType();

      const functionResult = await resolver.resolveConditionalType(functionType, mockResolveType);
      const objectResult = await resolver.resolveConditionalType(objectType, mockResolveType);
      const primitiveResult = await resolver.resolveConditionalType(primitiveType, mockResolveType);

      // All should return null as TypeScript resolves them
      expect(isOk(functionResult) && functionResult.value).toBeNull();
      expect(isOk(objectResult) && objectResult.value).toBeNull();
      expect(isOk(primitiveResult) && primitiveResult.value).toBeNull();
    });
  });
});