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
            .filter((t) => t.kind === TypeKind.Literal)
            .map((t) => (t as any).literal)
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
            .filter((t) => t.kind === TypeKind.Literal)
            .map((t) => (t as any).literal)
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
      // Should handle nested template literals appropriately
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
            .filter((t) => t.kind === TypeKind.Literal)
            .map((t) => (t as any).literal)
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
            .filter((t) => t.kind === TypeKind.Literal)
            .map((t) => (t as any).literal)
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
      // Should handle intrinsic string manipulation types
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
      // Should generate properly capitalized event names
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

