import { describe, it, expect, beforeEach } from "vitest";
import { MappedTypeResolver } from "../mapped-type-resolver.js";
import { Project, Type } from "ts-morph";
import { ok, isOk, type Result } from "../../core/result.js";
import { TypeKind, type TypeInfo } from "../../core/types.js";

describe("MappedTypeResolver", () => {
  let resolver: MappedTypeResolver;
  let project: Project;

  beforeEach(() => {
    resolver = new MappedTypeResolver();
    project = new Project({
      compilerOptions: {
        strict: true,
        noEmit: true,
      },
    });
  });

  const mockResolveType = async (type: Type, _depth: number): Promise<Result<TypeInfo>> => {
    // Simple mock for index signature value types
    if (type.isString()) {
      return ok({ kind: TypeKind.Primitive, name: "string" });
    }
    if (type.isNumber()) {
      return ok({ kind: TypeKind.Primitive, name: "number" });
    }
    if (type.isBoolean()) {
      return ok({ kind: TypeKind.Primitive, name: "boolean" });
    }
    return ok({ kind: TypeKind.Unknown });
  };

  describe("Already resolved mapped types", () => {
    it("should return null for already expanded mapped types", async () => {
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        interface User {
          id: string;
          name: string;
        }

        type Readonly<T> = {
          readonly [K in keyof T]: T[K];
        };

        type ReadonlyUser = Readonly<User>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("ReadonlyUser").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null because TypeScript already expanded it
        expect(result.value).toBeNull();
      }
    });

    it("should return null for Pick utility type", async () => {
      const sourceFile = project.createSourceFile(
        "test-pick.ts",
        `
        interface User {
          id: string;
          name: string;
          email: string;
        }

        type BasicUser = Pick<User, "id" | "name">;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("BasicUser").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null because TypeScript already filtered the properties
        expect(result.value).toBeNull();
      }
    });

    it("should return null for template literal mapped types", async () => {
      const sourceFile = project.createSourceFile(
        "test-template.ts",
        `
        interface Actions {
          load: () => void;
          save: () => void;
        }

        type Getters<T> = {
          [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
        };

        type ActionGetters = Getters<Actions>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("ActionGetters").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null because TypeScript already transformed the property names
        expect(result.value).toBeNull();
      }
    });

    it("should return null for Record with literal keys", async () => {
      const sourceFile = project.createSourceFile(
        "test-record.ts",
        `
        type ColorMap = Record<"red" | "blue" | "green", string>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("ColorMap").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null because TypeScript creates actual properties
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Index signatures", () => {
    it("should handle string index signatures", async () => {
      const sourceFile = project.createSourceFile(
        "test-string-index.ts",
        `
        interface StringDictionary {
          [key: string]: string;
        }
        `
      );

      const type = sourceFile.getInterfaceOrThrow("StringDictionary").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(0);
          expect(result.value.indexSignature).toBeDefined();
          expect(result.value.indexSignature?.keyType).toBe("string");
          expect(result.value.indexSignature?.valueType.kind).toBe(TypeKind.Primitive);
        }
      }
    });

    it("should handle number index signatures", async () => {
      const sourceFile = project.createSourceFile(
        "test-number-index.ts",
        `
        interface NumberDictionary {
          [index: number]: string;
        }
        `
      );

      const type = sourceFile.getInterfaceOrThrow("NumberDictionary").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(0);
          expect(result.value.indexSignature).toBeDefined();
          expect(result.value.indexSignature?.keyType).toBe("number");
        }
      }
    });

    it("should not treat arrays as index signatures", async () => {
      const sourceFile = project.createSourceFile(
        "test-array.ts",
        `
        type StringArray = string[];
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("StringArray").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should handle interfaces with both properties and index signatures", async () => {
      const sourceFile = project.createSourceFile(
        "test-mixed.ts",
        `
        interface MixedDictionary {
          known: string;
          [key: string]: string;
        }
        `
      );

      const type = sourceFile.getInterfaceOrThrow("MixedDictionary").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.indexSignature).toBeDefined();
          expect(result.value.indexSignature?.keyType).toBe("string");
        }
      }
    });
  });

  describe("Unresolved generic mapped types", () => {
    it("should handle mapped types dependent on generic parameters", async () => {
      const sourceFile = project.createSourceFile(
        "test-generic.ts",
        `
        type MyPartial<T> = {
          [K in keyof T]?: T[K];
        };

        interface Container<T> {
          data: MyPartial<T>;  // This depends on generic T
        }
        `
      );

      const containerType = sourceFile.getInterfaceOrThrow("Container").getType();
      const dataProp = containerType.getProperty("data");
      const propType = dataProp?.getTypeAtLocation(sourceFile);

      if (propType) {
        const result = await resolver.resolveMappedType(propType, mockResolveType);

        expect(isOk(result)).toBe(true);
        if (isOk(result) && result.value) {
          // Should return generic type info since it can't be expanded
          expect(result.value.kind).toBe(TypeKind.Generic);
          if (result.value.kind === TypeKind.Generic) {
            expect(result.value.name).toContain("MyPartial");
          }
        }
      }
    });

    it("should handle generic Record types", async () => {
      const sourceFile = project.createSourceFile(
        "test-generic-record.ts",
        `
        interface GenericContainer<K extends string, V> {
          data: Record<K, V>;  // This depends on generics K and V
        }
        `
      );

      const containerType = sourceFile.getInterfaceOrThrow("GenericContainer").getType();
      const dataProp = containerType.getProperty("data");
      const propType = dataProp?.getTypeAtLocation(sourceFile);

      if (propType) {
        const result = await resolver.resolveMappedType(propType, mockResolveType);

        expect(isOk(result)).toBe(true);
        if (isOk(result) && result.value) {
          // Should handle unresolved generic Record
          expect(result.value.kind).toBe(TypeKind.Generic);
        }
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle max depth protection", async () => {
      const resolverWithLowDepth = new MappedTypeResolver({ maxDepth: 2 });

      const sourceFile = project.createSourceFile(
        "test-depth.ts",
        `
        interface Test {
          [key: string]: string;
        }
        `
      );

      const type = sourceFile.getInterfaceOrThrow("Test").getType();
      const result = await resolverWithLowDepth.resolveMappedType(type, mockResolveType, 3);

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
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should return null for regular interfaces without index signatures", async () => {
      const sourceFile = project.createSourceFile(
        "test-interface.ts",
        `
        interface User {
          id: string;
          name: string;
        }
        `
      );

      const type = sourceFile.getInterfaceOrThrow("User").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

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

        type PartialUser = Partial<User>;
        type RequiredUser = Required<User>;
        type ReadonlyUser = Readonly<User>;
        type PickedUser = Pick<User, "id" | "name">;
        type OmittedUser = Omit<User, "email">;
        `
      );

      const partialType = sourceFile.getTypeAliasOrThrow("PartialUser").getType();
      const requiredType = sourceFile.getTypeAliasOrThrow("RequiredUser").getType();
      const readonlyType = sourceFile.getTypeAliasOrThrow("ReadonlyUser").getType();
      const pickedType = sourceFile.getTypeAliasOrThrow("PickedUser").getType();
      const omittedType = sourceFile.getTypeAliasOrThrow("OmittedUser").getType();

      const partialResult = await resolver.resolveMappedType(partialType, mockResolveType);
      const requiredResult = await resolver.resolveMappedType(requiredType, mockResolveType);
      const readonlyResult = await resolver.resolveMappedType(readonlyType, mockResolveType);
      const pickedResult = await resolver.resolveMappedType(pickedType, mockResolveType);
      const omittedResult = await resolver.resolveMappedType(omittedType, mockResolveType);

      // All should return null as TypeScript has already resolved them
      expect(isOk(partialResult) && partialResult.value).toBeNull();
      expect(isOk(requiredResult) && requiredResult.value).toBeNull();
      expect(isOk(readonlyResult) && readonlyResult.value).toBeNull();
      expect(isOk(pickedResult) && pickedResult.value).toBeNull();
      expect(isOk(omittedResult) && omittedResult.value).toBeNull();
    });

    it("should handle complex nested mapped types that TypeScript resolves", async () => {
      const sourceFile = project.createSourceFile(
        "test-nested.ts",
        `
        interface User {
          id: string;
          profile: {
            name: string;
            email: string;
          };
        }

        type DeepReadonly<T> = {
          readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
        };

        type ReadonlyUser = DeepReadonly<User>;
        `
      );

      const type = sourceFile.getTypeAliasOrThrow("ReadonlyUser").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return null as TypeScript resolves the nested structure
        expect(result.value).toBeNull();
      }
    });

    it("should handle API response patterns", async () => {
      const sourceFile = project.createSourceFile(
        "test-api.ts",
        `
        interface ApiResponse {
          [endpoint: string]: {
            data: unknown;
            error?: string;
          };
        }
        `
      );

      const type = sourceFile.getInterfaceOrThrow("ApiResponse").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        // Should handle as index signature
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.indexSignature).toBeDefined();
          expect(result.value.indexSignature?.keyType).toBe("string");
        }
      }
    });
  });
});