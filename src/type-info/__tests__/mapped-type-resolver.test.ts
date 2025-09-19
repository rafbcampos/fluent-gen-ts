import { describe, it, expect, beforeEach } from "vitest";
import { MappedTypeResolver } from "../mapped-type-resolver.js";
import { Project, Type } from "ts-morph";
import { ok, err, isOk, isErr, type Result } from "../../core/result.js";
import {
  TypeKind,
  type TypeInfo,
  type PropertyInfo,
} from "../../core/types.js";

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

  const mockResolveType = async (type: Type) => {
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
        const resolved = await mockResolveType(unionType);
        if (isOk(resolved)) {
          resolvedTypes.push(resolved.value);
        }
      }
      return ok<TypeInfo>({ kind: TypeKind.Union, unionTypes: resolvedTypes });
    }
    if (type.isObject() && !type.isArray()) {
      const properties: PropertyInfo[] = [];
      for (const prop of type.getProperties()) {
        properties.push({
          name: prop.getName(),
          type: { kind: TypeKind.Unknown },
          optional: prop.isOptional(),
          readonly: false,
        });
      }
      return ok<TypeInfo>({ kind: TypeKind.Object, properties });
    }

    return ok<TypeInfo>({ kind: TypeKind.Unknown });
  };

  describe("Basic mapped type detection", () => {
    it("should detect mapped types", async () => {
      const sourceFile = project.createSourceFile(
        "test.ts",
        `
        type Readonly<T> = {
          readonly [K in keyof T]: T[K];
        };

        interface User {
          id: string;
          name: string;
        }

        type ReadonlyUser = Readonly<User>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("ReadonlyUser").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeDefined();
        if (result.value && result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(2);
          expect(result.value.properties.every((p) => p.readonly)).toBe(true);
        }
      }
    });

    it("should return null for non-mapped types", async () => {
      const sourceFile = project.createSourceFile(
        "test-non-mapped.ts",
        `
        interface SimpleInterface {
          value: string;
        }
        `,
      );

      const type = sourceFile.getInterfaceOrThrow("SimpleInterface").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Keyof mapped types", () => {
    it("should handle [K in keyof T] pattern", async () => {
      const sourceFile = project.createSourceFile(
        "test-keyof.ts",
        `
        type Clone<T> = {
          [K in keyof T]: T[K];
        };

        interface Original {
          prop1: string;
          prop2: number;
          prop3?: boolean;
        }

        type Cloned = Clone<Original>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Cloned").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(3);
          const prop3 = result.value.properties.find((p) => p.name === "prop3");
          expect(prop3?.optional).toBe(true);
        }
      }
    });
  });

  describe("Mapped types with modifiers", () => {
    it("should handle readonly modifier", async () => {
      const sourceFile = project.createSourceFile(
        "test-readonly.ts",
        `
        type MakeReadonly<T> = {
          readonly [K in keyof T]: T[K];
        };

        interface Mutable {
          value: string;
        }

        type Immutable = MakeReadonly<Mutable>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Immutable").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties.every((p) => p.readonly)).toBe(true);
        }
      }
    });

    it("should handle optional modifier", async () => {
      const sourceFile = project.createSourceFile(
        "test-optional.ts",
        `
        type MakeOptional<T> = {
          [K in keyof T]?: T[K];
        };

        interface Required {
          value: string;
        }

        type Optional = MakeOptional<Required>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Optional").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties.every((p) => p.optional)).toBe(true);
        }
      }
    });

    it("should handle removing modifiers with -", async () => {
      const sourceFile = project.createSourceFile(
        "test-remove-modifiers.ts",
        `
        type Mutable<T> = {
          -readonly [K in keyof T]: T[K];
        };

        type RequiredMutable<T> = {
          -readonly [K in keyof T]-?: T[K];
        };

        interface ReadonlyOptional {
          readonly value?: string;
        }

        type MutableRequired = RequiredMutable<ReadonlyOptional>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("MutableRequired").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(
            result.value.properties.every((p) => !p.readonly && !p.optional),
          ).toBe(true);
        }
      }
    });
  });

  describe("Mapped types with string literals", () => {
    it("should handle mapped types over string literal unions", async () => {
      const sourceFile = project.createSourceFile(
        "test-string-literals.ts",
        `
        type Keys = "prop1" | "prop2" | "prop3";

        type ObjectFromKeys = {
          [K in Keys]: string;
        };
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("ObjectFromKeys").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(3);
          const propNames = result.value.properties.map((p) => p.name).sort();
          expect(propNames).toEqual(["prop1", "prop2", "prop3"]);
        }
      }
    });
  });

  describe("Template literal property names", () => {
    it("should handle template literal patterns in mapped types", async () => {
      const sourceFile = project.createSourceFile(
        "test-template-literals.ts",
        `
        type Getters<T> = {
          [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
        };

        interface Person {
          name: string;
          age: number;
        }

        type PersonGetters = Getters<Person>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("PersonGetters").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(2);
          const propNames = result.value.properties.map((p) => p.name).sort();
          expect(propNames).toEqual(["getAge", "getName"]);
        }
      }
    });

    it("should handle key remapping with as clause", async () => {
      const sourceFile = project.createSourceFile(
        "test-key-remapping.ts",
        `
        type Prefixed<T, P extends string> = {
          [K in keyof T as \`\${P}_\${string & K}\`]: T[K];
        };

        interface Original {
          foo: string;
          bar: number;
        }

        type PrefixedType = Prefixed<Original, "prefix">;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("PrefixedType").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          const propNames = result.value.properties.map((p) => p.name).sort();
          expect(propNames).toEqual(["prefix_bar", "prefix_foo"]);
        }
      }
    });
  });

  describe("Index signatures", () => {
    it("should detect index signatures", async () => {
      const sourceFile = project.createSourceFile(
        "test-index-sig.ts",
        `
        interface StringIndex {
          [key: string]: string;
        }

        interface NumberIndex {
          [index: number]: string;
        }
        `,
      );

      const stringType = sourceFile
        .getInterfaceOrThrow("StringIndex")
        .getType();
      const numberType = sourceFile
        .getInterfaceOrThrow("NumberIndex")
        .getType();

      const stringResult = await resolver.resolveMappedType(
        stringType,
        mockResolveType,
      );
      const numberResult = await resolver.resolveMappedType(
        numberType,
        mockResolveType,
      );

      expect(isOk(stringResult)).toBe(true);
      expect(isOk(numberResult)).toBe(true);

      if (isOk(stringResult) && stringResult.value) {
        expect(stringResult.value.kind).toBe(TypeKind.Object);
        if (stringResult.value.kind === TypeKind.Object) {
          expect(stringResult.value.indexSignature).toBeDefined();
          expect(stringResult.value.indexSignature?.keyType).toBe("string");
        }
      }

      if (isOk(numberResult) && numberResult.value) {
        expect(numberResult.value.kind).toBe(TypeKind.Object);
        if (numberResult.value.kind === TypeKind.Object) {
          expect(numberResult.value.indexSignature).toBeDefined();
          expect(numberResult.value.indexSignature?.keyType).toBe("number");
        }
      }
    });

    it("should not treat arrays as index signatures", async () => {
      const sourceFile = project.createSourceFile(
        "test-array.ts",
        `
        type StringArray = string[];
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("StringArray").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("Complex mapped types", () => {
    it("should handle mapped types with conditional types", async () => {
      const sourceFile = project.createSourceFile(
        "test-conditional-mapped.ts",
        `
        type NullableProperties<T> = {
          [K in keyof T]: T[K] | null;
        };

        interface Data {
          id: string;
          count: number;
        }

        type NullableData = NullableProperties<Data>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("NullableData").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(2);
          // Each property should be a union with null
        }
      }
    });

    it("should handle filtering in mapped types", async () => {
      const sourceFile = project.createSourceFile(
        "test-filtering.ts",
        `
        type PickByType<T, U> = {
          [K in keyof T as T[K] extends U ? K : never]: T[K];
        };

        interface Mixed {
          id: string;
          name: string;
          count: number;
          isActive: boolean;
        }

        type StringsOnly = PickByType<Mixed, string>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("StringsOnly").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          // Should only have string properties
          const propNames = result.value.properties.map((p) => p.name).sort();
          expect(propNames).toEqual(["id", "name"]);
        }
      }
    });
  });

  describe("Max depth protection", () => {
    it("should handle max depth exceeded", async () => {
      const resolverWithLowDepth = new MappedTypeResolver({ maxDepth: 2 });

      const deepResolve = async (t: Type, depth: number): Promise<any> => {
        if (depth > 3) {
          return err(new Error("Max depth"));
        }
        return mockResolveType(t);
      };

      const sourceFile = project.createSourceFile(
        "test-depth.ts",
        `
        type Deep1<T> = { [K in keyof T]: T[K] };
        type Deep2<T> = { [K in keyof Deep1<T>]: Deep1<T>[K] };
        type Deep3<T> = { [K in keyof Deep2<T>]: Deep2<T>[K] };
        type Deep4<T> = { [K in keyof Deep3<T>]: Deep3<T>[K] };

        interface Base {
          value: string;
        }

        type VeryDeep = Deep4<Base>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("VeryDeep").getType();
      const result = await resolverWithLowDepth.resolveMappedType(
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

  describe("Error handling", () => {
    it("should handle types without symbols gracefully", async () => {
      // Create a mock type without a symbol
      const sourceFile = project.createSourceFile(
        "test-no-symbol.ts",
        `type AnyType = any;`,
      );

      const type = sourceFile.getTypeAliasOrThrow("AnyType").getType();
      const result = await resolver.resolveMappedType(type, mockResolveType);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });

    it("should handle resolver function errors", async () => {
      const errorResolver = async (
        type: Type,
        depth: number,
      ): Promise<Result<TypeInfo>> => {
        return err(
          new Error(`Resolution failed. Type: ${type}, Depth: ${depth}`),
        );
      };

      const sourceFile = project.createSourceFile(
        "test-resolver-error.ts",
        `
        type Mapped<T> = { [K in keyof T]: T[K] };
        interface Test { value: string; }
        type Result = Mapped<Test>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow("Result").getType();
      const result = await resolver.resolveMappedType(type, errorResolver);

      // Should handle or propagate resolver errors appropriately
      expect(result).toBeDefined();
    });
  });

  describe("Real-world mapped type patterns", () => {
    it("should handle TypeScript utility type patterns", async () => {
      const sourceFile = project.createSourceFile(
        "test-utility-patterns.ts",
        `
        // Simplified versions of TypeScript utility types
        type MyPartial<T> = { [K in keyof T]?: T[K] };
        type MyRequired<T> = { [K in keyof T]-?: T[K] };
        type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
        type MyPick<T, K extends keyof T> = { [P in K]: T[P] };

        interface User {
          id: string;
          name?: string;
          email: string;
        }

        type PartialUser = MyPartial<User>;
        type RequiredUser = MyRequired<User>;
        type ReadonlyUser = MyReadonly<User>;
        type BasicUser = MyPick<User, "id" | "name">;
        `,
      );

      const partialType = sourceFile
        .getTypeAliasOrThrow("PartialUser")
        .getType();
      const requiredType = sourceFile
        .getTypeAliasOrThrow("RequiredUser")
        .getType();
      const readonlyType = sourceFile
        .getTypeAliasOrThrow("ReadonlyUser")
        .getType();

      const partialResult = await resolver.resolveMappedType(
        partialType,
        mockResolveType,
      );
      const requiredResult = await resolver.resolveMappedType(
        requiredType,
        mockResolveType,
      );
      const readonlyResult = await resolver.resolveMappedType(
        readonlyType,
        mockResolveType,
      );

      expect(isOk(partialResult)).toBe(true);
      expect(isOk(requiredResult)).toBe(true);
      expect(isOk(readonlyResult)).toBe(true);

      if (
        isOk(partialResult) &&
        partialResult.value?.kind === TypeKind.Object
      ) {
        expect(partialResult.value.properties.every((p) => p.optional)).toBe(
          true,
        );
      }

      if (
        isOk(requiredResult) &&
        requiredResult.value?.kind === TypeKind.Object
      ) {
        expect(requiredResult.value.properties.every((p) => !p.optional)).toBe(
          true,
        );
      }

      if (
        isOk(readonlyResult) &&
        readonlyResult.value?.kind === TypeKind.Object
      ) {
        expect(readonlyResult.value.properties.every((p) => p.readonly)).toBe(
          true,
        );
      }
    });

    it("should handle getter/setter patterns", async () => {
      const sourceFile = project.createSourceFile(
        "test-getters-setters.ts",
        `
        type Getters<T> = {
          [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
        };

        type Setters<T> = {
          [K in keyof T as \`set\${Capitalize<string & K>}\`]: (value: T[K]) => void;
        };

        interface State {
          count: number;
          message: string;
        }

        type StateGetters = Getters<State>;
        type StateSetters = Setters<State>;
        `,
      );

      const gettersType = sourceFile
        .getTypeAliasOrThrow("StateGetters")
        .getType();
      const settersType = sourceFile
        .getTypeAliasOrThrow("StateSetters")
        .getType();

      const gettersResult = await resolver.resolveMappedType(
        gettersType,
        mockResolveType,
      );
      const settersResult = await resolver.resolveMappedType(
        settersType,
        mockResolveType,
      );

      expect(isOk(gettersResult)).toBe(true);
      expect(isOk(settersResult)).toBe(true);

      if (
        isOk(gettersResult) &&
        gettersResult.value?.kind === TypeKind.Object
      ) {
        const propNames = gettersResult.value.properties
          .map((p) => p.name)
          .sort();
        expect(propNames).toEqual(["getCount", "getMessage"]);
      }

      if (
        isOk(settersResult) &&
        settersResult.value?.kind === TypeKind.Object
      ) {
        const propNames = settersResult.value.properties
          .map((p) => p.name)
          .sort();
        expect(propNames).toEqual(["setCount", "setMessage"]);
      }
    });
  });
});
