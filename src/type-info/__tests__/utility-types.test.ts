import { describe, it, expect, beforeEach } from "vitest";
import { TypeExtractor } from "../index.js";
import { TypeKind } from "../../core/types.js";
import { isOk } from "../../core/result.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

describe("Utility Type Resolution", () => {
  let extractor: TypeExtractor;
  let tempDir: string;

  beforeEach(() => {
    extractor = new TypeExtractor();
    tempDir = join(tmpdir(), `test-${randomBytes(8).toString("hex")}`);
    mkdirSync(tempDir, { recursive: true });
  });

  describe("Pick utility type", () => {
    it("should resolve Pick<T, K> correctly", async () => {
      const code = `
        interface User {
          id: string;
          name: string;
          email: string;
          age: number;
        }

        type UserBasic = Pick<User, "id" | "name">;
      `;

      const testFile = join(tempDir, "pick-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "UserBasic");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.properties).toHaveLength(2);
          expect(typeInfo.properties.map(p => p.name).sort()).toEqual(["id", "name"]);
        }
      }
    });
  });

  describe("Omit utility type", () => {
    it("should resolve Omit<T, K> correctly", async () => {
      const code = `
        interface User {
          id: string;
          name: string;
          email: string;
          age: number;
        }

        type UserPublic = Omit<User, "email">;
      `;

      const testFile = join(tempDir, "omit-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "UserPublic");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.properties).toHaveLength(3);
          expect(typeInfo.properties.map(p => p.name).sort()).toEqual(["age", "id", "name"]);
        }
      }
    });
  });

  describe("Partial utility type", () => {
    it("should make all properties optional with Partial<T>", async () => {
      const code = `
        interface User {
          id: string;
          name: string;
          age: number;
        }

        type PartialUser = Partial<User>;
      `;

      const testFile = join(tempDir, "partial-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "PartialUser");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.properties).toHaveLength(3);
          expect(typeInfo.properties.every(p => p.optional)).toBe(true);
        }
      }
    });
  });

  describe("Required utility type", () => {
    it("should make all properties required with Required<T>", async () => {
      const code = `
        interface User {
          id?: string;
          name?: string;
          age?: number;
        }

        type RequiredUser = Required<User>;
      `;

      const testFile = join(tempDir, "required-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "RequiredUser");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.properties).toHaveLength(3);
          expect(typeInfo.properties.every(p => !p.optional)).toBe(true);
        }
      }
    });
  });

  describe("Record utility type", () => {
    it("should resolve Record<K, T> correctly", async () => {
      const code = `
        type UserRoles = Record<"admin" | "user" | "guest", {
          permissions: string[];
          level: number;
        }>;
      `;

      const testFile = join(tempDir, "record-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "UserRoles");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.properties).toHaveLength(3);
          expect(typeInfo.properties.map(p => p.name).sort()).toEqual(["admin", "guest", "user"]);

          // All properties should have the same type
          const firstProp = typeInfo.properties[0];
          expect(firstProp).toBeDefined();
          if (firstProp) {
            expect(firstProp.type.kind).toBe(TypeKind.Object);
          }
        }
      }
    });
  });

  describe("Index signatures", () => {
    it("should detect and handle index signatures", async () => {
      const code = `
        interface DynamicObject {
          id: string;
          [key: string]: unknown;
        }
      `;

      const testFile = join(tempDir, "index-sig-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "DynamicObject");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.properties).toHaveLength(1);
          const firstProp = typeInfo.properties[0];
          expect(firstProp).toBeDefined();
          if (firstProp) {
            expect(firstProp.name).toBe("id");
          }

          // Check for index signature
          expect(typeInfo.indexSignature).toBeDefined();
          if (typeInfo.indexSignature) {
            expect(typeInfo.indexSignature.keyType).toBe("string");
            expect(typeInfo.indexSignature.valueType.kind).toBe(TypeKind.Unknown);
          }
        }
      }
    });

    it("should handle readonly index signatures", async () => {
      const code = `
        interface ReadonlyDict {
          readonly [key: string]: string;
        }
      `;

      const testFile = join(tempDir, "readonly-index-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "ReadonlyDict");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.indexSignature).toBeDefined();
          if (typeInfo.indexSignature) {
            expect(typeInfo.indexSignature.keyType).toBe("string");
            expect(typeInfo.indexSignature.readonly).toBe(true);
          }
        }
      }
    });
  });

  describe("Nested utility types", () => {
    it("should resolve nested utility types", async () => {
      const code = `
        interface User {
          id: string;
          name: string;
          email: string;
          profile: {
            bio: string;
            avatar: string;
          };
        }

        type UpdateUser = Partial<Pick<User, "name" | "email" | "profile">>;
      `;

      const testFile = join(tempDir, "nested-utility-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "UpdateUser");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        expect(typeInfo.kind).toBe(TypeKind.Object);

        if (typeInfo.kind === TypeKind.Object) {
          expect(typeInfo.properties).toHaveLength(3);
          expect(typeInfo.properties.every(p => p.optional)).toBe(true);
          expect(typeInfo.properties.map(p => p.name).sort()).toEqual(["email", "name", "profile"]);
        }
      }
    });
  });

  describe("Complex compositions", () => {
    it("should handle complex type compositions with utility types", async () => {
      const code = `
        interface BaseEntity {
          id: string;
          createdAt: Date;
          updatedAt: Date;
        }

        interface User extends BaseEntity {
          name: string;
          email: string;
          role: "admin" | "user";
        }

        type CreateUserInput = Omit<User, keyof BaseEntity> & Partial<Pick<BaseEntity, "id">>;
      `;

      const testFile = join(tempDir, "complex-test.ts");
      writeFileSync(testFile, code);

      const result = await extractor.extractType(testFile, "CreateUserInput");
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const typeInfo = result.value.typeInfo;
        // This should resolve to an intersection type
        expect(typeInfo.kind).toBe(TypeKind.Intersection);
      }
    });
  });
});