import { describe, it, expect, beforeEach, vi } from "vitest";
import { FluentGen } from "../index.js";
import type { FluentGenOptions } from "../index.js";
import { isOk, isErr } from "../../core/result.js";
import { PluginManager, HookType } from "../../core/plugin.js";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock fs/promises for file writing tests
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe("FluentGen", () => {
  let fluentGen: FluentGen;
  const fixturesPath = path.join(
    __dirname,
    "..",
    "..",
    "__tests__",
    "fixtures",
    "simple.ts",
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fluentGen = new FluentGen();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const gen = new FluentGen();
      expect(gen).toBeDefined();
    });

    it("should accept custom options", () => {
      const options: FluentGenOptions = {
        outputDir: "/custom/output",
        fileName: "custom.builder.ts",
        maxDepth: 5,
        outputPath: "/custom/path",
        useDefaults: false,
        contextType: "CustomContext",
        importPath: "@custom/core",
        addComments: false,
      };

      const gen = new FluentGen(options);
      expect(gen).toBeDefined();
    });

    it("should use provided plugin manager", () => {
      const pluginManager = new PluginManager();
      const gen = new FluentGen({ pluginManager });
      expect(gen).toBeDefined();
    });
  });

  describe("generateBuilder", () => {
    it("should generate builder for Address type", async () => {
      const result = await fluentGen.generateBuilder(fixturesPath, "Address");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should generate builder for User type with nested Address", async () => {
      const result = await fluentGen.generateBuilder(fixturesPath, "User");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should generate builder for generic ApiResponse type", async () => {
      const result = await fluentGen.generateBuilder(
        fixturesPath,
        "ApiResponse",
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should handle non-existent type", async () => {
      const result = await fluentGen.generateBuilder(
        fixturesPath,
        "NonExistentType",
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("not found");
      }
    });

    it("should handle non-existent file", async () => {
      const result = await fluentGen.generateBuilder(
        "/nonexistent/file.ts",
        "TestType",
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("File not found");
      }
    });
  });

  describe("generateBuilder with JSDoc", () => {
    it("should include JSDoc comments when addComments is true", async () => {
      const genWithComments = new FluentGen({ addComments: true });
      const result = await genWithComments.generateBuilder(
        fixturesPath,
        "Address",
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should not include JSDoc comments when addComments is false", async () => {
      const genNoComments = new FluentGen({ addComments: false });
      const result = await genNoComments.generateBuilder(
        fixturesPath,
        "Address",
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });
  });

  describe("clearCache", () => {
    it("should clear the generator cache", () => {
      expect(() => fluentGen.clearCache()).not.toThrow();
    });
  });

  describe("generateMultiple", () => {
    it("should generate builders for multiple types", async () => {
      const result = await fluentGen.generateMultiple(fixturesPath, [
        "Address",
        "Point",
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should handle errors in one of the types", async () => {
      const result = await fluentGen.generateMultiple(fixturesPath, [
        "Address",
        "NonExistent",
      ]);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("not found");
      }
    });

    it("should handle empty type list", async () => {
      const result = await fluentGen.generateMultiple(fixturesPath, []);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });
  });

  describe("generateToFile", () => {
    it("should generate and write to file with default path", async () => {
      const result = await fluentGen.generateToFile(fixturesPath, "Address");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain("address.builder.ts");
        expect(fs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining("generated"),
          { recursive: true },
        );
        expect(fs.writeFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining("AddressBuilder"),
          "utf-8",
        );
      }
    });

    it("should use custom output path", async () => {
      const customPath = "/custom/output/custom.builder.ts";
      const result = await fluentGen.generateToFile(
        fixturesPath,
        "Address",
        customPath,
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(customPath);
        expect(fs.mkdir).toHaveBeenCalledWith("/custom/output", {
          recursive: true,
        });
        expect(fs.writeFile).toHaveBeenCalledWith(
          customPath,
          expect.stringContaining("AddressBuilder"),
          "utf-8",
        );
      }
    });

    it("should handle generation errors", async () => {
      const result = await fluentGen.generateToFile(
        fixturesPath,
        "NonExistent",
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("not found");
      }
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should handle file write errors", async () => {
      const writeError = new Error("Write failed");
      vi.mocked(fs.writeFile).mockRejectedValueOnce(writeError);

      const result = await fluentGen.generateToFile(fixturesPath, "Address");

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain("Failed to write file");
      }
    });

    it("should use custom output dir and filename from options", async () => {
      const customGen = new FluentGen({
        outputDir: "/my/output",
        fileName: "my-builder.ts",
      });

      const result = await customGen.generateToFile(fixturesPath, "Address");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(path.join("/my/output", "my-builder.ts"));
      }
    });
  });

  describe("scanAndGenerate", () => {
    it("should scan and generate builders for fixture files", async () => {
      const pattern = path.join(
        __dirname,
        "..",
        "..",
        "__tests__",
        "fixtures",
        "simple.ts",
      );
      const result = await fluentGen.scanAndGenerate(pattern);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should find multiple types in the fixture file
        expect(result.value.size).toBeGreaterThan(0);
        // Check for some expected types
        const keys = Array.from(result.value.keys());
        expect(keys.some((k) => k.includes("Address"))).toBe(true);
      }
    });

    it("should handle no matching files", async () => {
      const result = await fluentGen.scanAndGenerate(
        "/nonexistent/pattern/*.ts",
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.size).toBe(0);
      }
    });
  });

  describe("registerPlugin", () => {
    it("should register a plugin", () => {
      const plugin = {
        name: "test-plugin",
        version: "1.0.0",
        hooks: {
          [HookType.BeforeGenerate]: vi.fn(),
        },
      };

      expect(() => fluentGen.registerPlugin(plugin)).not.toThrow();
    });

    it("should apply plugin hooks during generation", async () => {
      const genWithPlugin = new FluentGen();

      const plugin = {
        name: "test-plugin",
        version: "1.0.0",
        hooks: {
          [HookType.BeforeGenerate]: vi.fn(),
        },
      };

      genWithPlugin.registerPlugin(plugin);

      const result = await genWithPlugin.generateBuilder(
        fixturesPath,
        "Address",
      );

      expect(isOk(result)).toBe(true);
    });
  });

  describe("complex types", () => {
    it("should generate builder for Result union type", async () => {
      const result = await fluentGen.generateBuilder(fixturesPath, "Result");

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });

    it("should generate builder for ComplexType with various property types", async () => {
      const result = await fluentGen.generateBuilder(
        fixturesPath,
        "ComplexType",
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result).toMatchSnapshot();
      }
    });
  });
});

