import { describe, it, expect } from "vitest";
import { ImportResolver } from "../import-resolver.js";
import { isOk } from "../result.js";

describe("ImportResolver", () => {
  const resolver = new ImportResolver();

  describe("resolve", () => {
    it("should identify relative imports", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "./utils.js",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isRelative).toBe(true);
        expect(result.value.isNodeModule).toBe(false);
        expect(result.value.moduleName).toBe("utils");
      }
    });

    it("should identify parent directory imports", () => {
      const result = resolver.resolve({
        sourceFile: "/src/components/Button.ts",
        importPath: "../utils/helpers.js",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isRelative).toBe(true);
        expect(result.value.isNodeModule).toBe(false);
        expect(result.value.moduleName).toBe("helpers");
      }
    });

    it("should identify node_modules imports", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "express",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isRelative).toBe(false);
        expect(result.value.isNodeModule).toBe(true);
        expect(result.value.packageName).toBe("express");
        expect(result.value.moduleName).toBe("express");
      }
    });

    it("should handle scoped packages", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "@angular/core",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isNodeModule).toBe(true);
        expect(result.value.scopedPackage).toBe("@angular");
        expect(result.value.packageName).toBe("@angular/core");
        expect(result.value.moduleName).toBe("core");
      }
    });

    it("should handle @types packages", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "@types/node",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isNodeModule).toBe(true);
        expect(result.value.isTypeDefinition).toBe(true);
        expect(result.value.packageName).toBe("@types/node");
        expect(result.value.moduleName).toBe("node");
      }
    });

    it("should handle @types packages with subpaths", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "@types/node/http",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isNodeModule).toBe(true);
        expect(result.value.isTypeDefinition).toBe(true);
        expect(result.value.packageName).toBe("@types/node");
        expect(result.value.subPath).toBe("http");
        expect(result.value.moduleName).toBe("http");
      }
    });

    it("should handle packages with subpaths", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "lodash/debounce",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.isNodeModule).toBe(true);
        expect(result.value.packageName).toBe("lodash");
        expect(result.value.subPath).toBe("debounce");
        expect(result.value.moduleName).toBe("debounce");
      }
    });

    it("should handle invalid scoped package", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "@",
      });

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain("Invalid scoped package");
      }
    });

    it("should clean invalid characters from module names", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "./my-utils.test.js",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.moduleName).toBe("my_utils_test");
      }
    });

    it("should prefix numeric module names", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "./123utils.js",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.moduleName).toBe("_123utils");
      }
    });
  });

  describe("formatImportPath", () => {
    it("should format @types/node to node: prefix", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "@types/node/http",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = resolver.formatImportPath(
          result.value,
          "/src/index.ts",
        );
        expect(formatted).toBe("node:http");
      }
    });

    it("should format @types packages without node", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "@types/express",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = resolver.formatImportPath(
          result.value,
          "/src/index.ts",
        );
        expect(formatted).toBe("express");
      }
    });

    it("should preserve regular node_modules paths", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "lodash/debounce",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = resolver.formatImportPath(
          result.value,
          "/src/index.ts",
        );
        expect(formatted).toBe("lodash/debounce");
      }
    });

    it("should handle @types/node/http.d format", () => {
      const result = resolver.resolve({
        sourceFile: "/src/index.ts",
        importPath: "@types/node/http.d",
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const formatted = resolver.formatImportPath(
          result.value,
          "/src/index.ts",
        );
        expect(formatted).toBe("node:http");
      }
    });
  });
});

