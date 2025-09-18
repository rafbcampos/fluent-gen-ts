import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { FluentGen } from "../gen/index.js";
import { isOk } from "../core/result.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { execa } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Node Modules Dependency Resolution", () => {
  const generatedDir = path.join(__dirname, "..", "..", ".generated");
  const generator = new FluentGen({});

  beforeAll(async () => {
    await fs.mkdir(generatedDir, { recursive: true });
  });

  beforeEach(() => {
    generator.clearCache();
  });

  afterAll(async () => {
    // Clean up generated files after all tests
    // Commented out for now to allow inspection
    // await fs.rm(generatedDir, { recursive: true, force: true });
  });

  describe("@types/node Interface Resolution", () => {
    it("should generate builder for IncomingHttpHeaders from @types/node", async () => {
      // Test that we can resolve an interface from node_modules/@types/node
      const httpTypesPath = path.join(
        __dirname,
        "..",
        "..",
        "node_modules",
        "@types",
        "node",
        "http.d.ts",
      );
      const result = await generator.generateBuilder(
        httpTypesPath,
        "IncomingHttpHeaders",
      );

      if (!isOk(result)) {
        console.error("Generation failed:", result.error);
      }

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write generated code to file for inspection
      const outputPath = path.join(
        generatedDir,
        "incoming-http-headers.builder.ts",
      );
      await fs.writeFile(outputPath, result.value, "utf-8");

      // Run type-check to ensure generated code is valid
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");

      // Run lint to ensure code quality
      const lintResult = await execa("pnpm", ["lint", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(lintResult.exitCode).toBe(0);

      // Verify the generated code contains expected elements
      expect(result.value).toContain("IncomingHttpHeaders");
      expect(result.value).toContain("incomingHttpHeaders");
      expect(result.value).toContain("withAccept");
      expect(result.value).toContain("withContentType");
      expect(result.value).toContain("withAuthorization");
    });

    it("should build valid IncomingHttpHeaders object with type-safe validation", async () => {
      const httpTypesPath = path.join(
        __dirname,
        "..",
        "..",
        "node_modules",
        "@types",
        "node",
        "http.d.ts",
      );
      const result = await generator.generateBuilder(
        httpTypesPath,
        "IncomingHttpHeaders",
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Create test file with type-safe validation using const expect pattern
      const outputPath = path.join(
        generatedDir,
        "incoming-http-headers.validation.ts",
      );
      const testCode = `${result.value}

// Test with common HTTP headers - const expect pattern for type safety
const expected: IncomingHttpHeaders = {
  "content-type": "application/json",
  "authorization": "Bearer token123",
  "accept": "application/json",
  "user-agent": "fluent-gen-test/1.0.0"
};

const built = incomingHttpHeaders()
  .withContentType("application/json")
  .withAuthorization("Bearer token123")
  .withAccept("application/json")
  .withUserAgent("fluent-gen-test/1.0.0")
  .build();

// This will fail type-check if types don't match exactly
const typeCheck: IncomingHttpHeaders = built;

// Verify object structure matches
const isValid = (
  built["content-type"] === expected["content-type"] &&
  built["authorization"] === expected["authorization"] &&
  built["accept"] === expected["accept"] &&
  built["user-agent"] === expected["user-agent"]
);

console.log(JSON.stringify({ expected, built, isValid }));
`;

      await fs.writeFile(outputPath, testCode, "utf-8");

      // Type-check the test code to ensure type safety
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");
    });

    it("should handle optional properties correctly", async () => {
      const httpTypesPath = path.join(
        __dirname,
        "..",
        "..",
        "node_modules",
        "@types",
        "node",
        "http.d.ts",
      );
      const result = await generator.generateBuilder(
        httpTypesPath,
        "IncomingHttpHeaders",
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const outputPath = path.join(
        generatedDir,
        "incoming-http-headers.optional.ts",
      );
      const testCode = `${result.value}

// Test with minimal headers (all properties are optional)
const expected1: IncomingHttpHeaders = {
  "host": "example.com"
};

const built1 = incomingHttpHeaders()
  .withHost("example.com")
  .build();

// Test with no properties (empty object should be valid)
const expected2: IncomingHttpHeaders = {};

const built2 = incomingHttpHeaders().build();

// Type checks - these must pass for the test to be valid
const typeCheck1: IncomingHttpHeaders = built1;
const typeCheck2: IncomingHttpHeaders = built2;

console.log(JSON.stringify({
  test1: { expected: expected1, built: built1, matches: built1.host === expected1.host },
  test2: { expected: expected2, built: built2, matches: Object.keys(built2).length === 0 }
}));
`;

      await fs.writeFile(outputPath, testCode, "utf-8");

      // Type-check the test code
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");
    });

    it("should handle hyphenated header names correctly", async () => {
      const httpTypesPath = path.join(
        __dirname,
        "..",
        "..",
        "node_modules",
        "@types",
        "node",
        "http.d.ts",
      );
      const result = await generator.generateBuilder(
        httpTypesPath,
        "IncomingHttpHeaders",
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const outputPath = path.join(
        generatedDir,
        "incoming-http-headers.hyphenated.ts",
      );
      const testCode = `${result.value}

// Test hyphenated headers that should have camelCase methods
const expected: IncomingHttpHeaders = {
  "content-type": "text/html",
  "accept-encoding": "gzip, deflate",
  "cache-control": "no-cache",
  "user-agent": "test-agent"
};

const built = incomingHttpHeaders()
  .withContentType("text/html")
  .withAcceptEncoding("gzip, deflate")
  .withCacheControl("no-cache")
  .withUserAgent("test-agent")
  .build();

// Type safety check
const typeCheck: IncomingHttpHeaders = built;

// Verify all properties match
const allMatch = (
  built["content-type"] === expected["content-type"] &&
  built["accept-encoding"] === expected["accept-encoding"] &&
  built["cache-control"] === expected["cache-control"] &&
  built["user-agent"] === expected["user-agent"]
);

console.log(JSON.stringify({ expected, built, allMatch }));
`;

      await fs.writeFile(outputPath, testCode, "utf-8");

      // Type-check the test code
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");
    });
  });
});
