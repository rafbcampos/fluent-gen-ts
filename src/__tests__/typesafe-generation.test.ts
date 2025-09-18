import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { FluentGen } from "../gen/index.js";
import { isOk } from "../core/result.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { execa } from "execa";
// Types are used in generated test files, not directly in test code

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Type-safe Builder Generation", () => {
  const fixturesPath = path.join(__dirname, "fixtures", "simple.ts");
  const generatedDir = path.join(__dirname, "..", "..", ".generated");
  const generator = new FluentGen({});

  beforeAll(async () => {
    // Ensure generated directory exists
    await fs.mkdir(generatedDir, { recursive: true });
  });

  beforeEach(() => {
    // Clear generator cache before each test to ensure fresh generation
    generator.clearCache();
  });

  afterAll(async () => {
    // Clean up generated files after all tests
    // Commented out for now to allow inspection
    // await fs.rm(generatedDir, { recursive: true, force: true });
  });

  describe("Type-checking and Linting", () => {
    it("should generate type-safe builder for Address interface", async () => {
      const result = await generator.generateBuilder(fixturesPath, "Address");

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write generated code to file
      const outputPath = path.join(generatedDir, "address.builder.ts");
      await fs.writeFile(outputPath, result.value, "utf-8");

      // Run type-check
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");

      // Run lint
      const lintResult = await execa("pnpm", ["lint", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(lintResult.exitCode).toBe(0);
    });

    it("should generate type-safe builder for User interface with nested types", async () => {
      const result = await generator.generateBuilder(fixturesPath, "User");

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write generated code to file
      const outputPath = path.join(generatedDir, "user.builder.ts");
      await fs.writeFile(outputPath, result.value, "utf-8");

      // Run type-check
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");

      // Run lint
      const lintResult = await execa("pnpm", ["lint", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(lintResult.exitCode).toBe(0);
    });

    it("should generate type-safe builder for Point type alias", async () => {
      const result = await generator.generateBuilder(fixturesPath, "Point");

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write generated code to file
      const outputPath = path.join(generatedDir, "point.builder.ts");
      await fs.writeFile(outputPath, result.value, "utf-8");

      // Run type-check
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");

      // Run lint
      const lintResult = await execa("pnpm", ["lint", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(lintResult.exitCode).toBe(0);
    });

    it("should generate type-safe builder for generic interface", async () => {
      const result = await generator.generateBuilder(
        fixturesPath,
        "ApiResponse",
      );

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write generated code to file
      const outputPath = path.join(generatedDir, "apiresponse.builder.ts");
      await fs.writeFile(outputPath, result.value, "utf-8");

      // Run type-check
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
      expect(typecheckResult.stderr).toBe("");

      // Run lint
      const lintResult = await execa("pnpm", ["lint", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(lintResult.exitCode).toBe(0);
    });
  });

  describe("Object Validation", () => {
    it("should build valid Address object matching interface", async () => {
      const result = await generator.generateBuilder(fixturesPath, "Address");
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write and compile builder
      const outputPath = path.join(generatedDir, "address.validation.ts");
      const testCode = `${result.value}

// Test the builder
const expected: Address = {
  street: "123 Main St",
  city: "New York",
  country: "USA"
};

const built = address()
  .withStreet("123 Main St")
  .withCity("New York")
  .withCountry("USA")
  .build();

// This will fail type-check if types don't match
const typeCheck: Address = built;

console.log(JSON.stringify({
  expected,
  built,
  matches: JSON.stringify(expected) === JSON.stringify(built)
}));
`;

      await fs.writeFile(outputPath, testCode, "utf-8");

      // Type-check the test code
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
    });

    it("should build valid User object with nested Address", async () => {
      const result = await generator.generateBuilder(fixturesPath, "User");
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Generate Address builder too since User depends on it
      const addressResult = await generator.generateBuilder(
        fixturesPath,
        "Address",
      );
      expect(isOk(addressResult)).toBe(true);
      if (!isOk(addressResult)) return;

      // Write and compile builder
      const outputPath = path.join(generatedDir, "user.validation.ts");

      // Remove imports from User code and combine
      const userLines = result.value.split("\n");
      const userCodeStart = userLines.findIndex((line) =>
        line.startsWith("export"),
      );
      const userCodeWithoutImports = userLines.slice(userCodeStart).join("\n");

      // Update Address import to include User type
      const addressCode = addressResult.value.replace(
        "import type { Address }",
        "import type { Address, User }",
      );

      const testCode = `${addressCode}

${userCodeWithoutImports}

// Test the builder
const expected: User = {
  id: "user-123",
  name: "John Doe",
  age: 30,
  address: {
    street: "456 Oak Ave",
    city: "San Francisco",
    country: "USA"
  }
};

const built = user()
  .withId("user-123")
  .withName("John Doe")
  .withAge(30)
  .withAddress(
    address()
      .withStreet("456 Oak Ave")
      .withCity("San Francisco")
      .withCountry("USA")
      .build()
  )
  .build();

// This will fail type-check if types don't match
const typeCheck: User = built;

console.log(JSON.stringify({
  expected,
  built,
  matches: JSON.stringify(expected) === JSON.stringify(built)
}));
`;

      await fs.writeFile(outputPath, testCode, "utf-8");

      // Type-check the test code
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
    });

    it("should build valid Point object with optional property", async () => {
      const result = await generator.generateBuilder(fixturesPath, "Point");
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write and compile builder
      const outputPath = path.join(generatedDir, "point.validation.ts");
      const testCode = `${result.value}

// Test the builder with all properties
const expected1: Point = {
  x: 10,
  y: 20,
  z: 30
};

const built1 = point()
  .withX(10)
  .withY(20)
  .withZ(30)
  .build();

// Test without optional property
const expected2: Point = {
  x: 5,
  y: 15
};

const built2 = point()
  .withX(5)
  .withY(15)
  .build();

// Type checks
const typeCheck1: Point = built1;
const typeCheck2: Point = built2;

console.log(JSON.stringify({
  test1: {
    expected: expected1,
    built: built1,
    matches: JSON.stringify(expected1) === JSON.stringify(built1)
  },
  test2: {
    expected: expected2,
    built: built2,
    matches: JSON.stringify(expected2) === JSON.stringify(built2)
  }
}));
`;

      await fs.writeFile(outputPath, testCode, "utf-8");

      // Type-check the test code
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
    });

    it("should build valid ApiResponse with generics", async () => {
      const result = await generator.generateBuilder(
        fixturesPath,
        "ApiResponse",
      );
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // Write and compile builder
      const outputPath = path.join(generatedDir, "apiresponse.validation.ts");
      const testCode = `${result.value}

interface SimpleUser {
  id: string;
  name: string;
}

// Test with specific generic types
const expected: ApiResponse<string, any> = {
  data: "Success",
  error: undefined,
  user: { id: "1", name: "Alice" },
  timestamp: 1234567890
};

const built = apiResponse<string, any>()
  .withData("Success")
  .withUser({ id: "1", name: "Alice" })
  .withTimestamp(1234567890)
  .build();

// Type check
const typeCheck: ApiResponse<string, any> = built;

console.log(JSON.stringify({
  expected,
  built,
  matches: JSON.stringify(expected) === JSON.stringify(built)
}));
`;

      await fs.writeFile(outputPath, testCode, "utf-8");

      // Type-check the test code
      const typecheckResult = await execa("pnpm", ["typecheck", outputPath], {
        reject: false,
        cwd: path.join(__dirname, "..", ".."),
      });

      expect(typecheckResult.exitCode).toBe(0);
    });
  });
});
