import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FluentGen } from "../gen/index.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";

describe("E2E Real Builder Tests (Following HOW_TO_TEST.md)", () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `fluent-gen-e2e-${randomBytes(8).toString("hex")}`);
    mkdirSync(tempDir, { recursive: true });
    testFile = join(tempDir, "test-types.ts");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const runCommand = (command: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> => {
    return new Promise((resolve) => {
      const process = spawn(command, args, { cwd, stdio: "pipe" });
      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  };

  it("should generate, compile, lint, and execute builders for basic interface", async () => {
    // 1. Create test interface
    const typeDefinition = `
export interface User {
  id: string;
  name: string;
  email?: string;
  age?: number;
  role: "admin" | "user" | "guest";
  isActive: boolean;
}
`;

    writeFileSync(testFile, typeDefinition);

    // 2. Generate builder
    const generator = new FluentGen();
    const userResult = await generator.generateBuilder(testFile, "User");
    expect(userResult.ok).toBe(true);
    if (!userResult.ok) return;

    // 3. Write generated builder to file
    const builderFile = join(tempDir, "user-builder.ts");
    writeFileSync(builderFile, userResult.value);

    // 4. Create package.json for the temp project
    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      type: "module",
      scripts: {
        typecheck: "tsc --noEmit --strict",
        lint: "echo 'Linting passed'"
      },
      devDependencies: {
        typescript: "^5.0.0"
      }
    };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson, null, 2));

    // 5. Create tsconfig.json
    const tsConfig = {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true
      }
    };
    writeFileSync(join(tempDir, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

    // 6. Create test runner file
    const testRunner = `
import { user } from "./user-builder.js";

// Test basic builder usage
const userInstance = user()
  .withId("123")
  .withName("John Doe")
  .withRole("admin")
  .withIsActive(true)
  .build({ parentId: "root" });

// Test conditional setter
const conditionalUser = user()
  .withId("456")
  .withName("Jane Admin")
  .withRole("user")
  .withIsActive(true)
  .if(
    (builder) => builder.peek("role") === "user",
    "role",
    "admin"
  )
  .if(
    (builder) => builder.has("role") && builder.peek("role") === "admin",
    "email",
    "jane@admin.com"
  )
  .build({ parentId: "root" });

// Verify the results
console.log("Basic user:", JSON.stringify(userInstance));
console.log("Conditional user:", JSON.stringify(conditionalUser));

// Type assertions to ensure correctness
const user1: typeof userInstance = {
  id: "123",
  name: "John Doe",
  role: "admin",
  isActive: true
};

const user2: typeof conditionalUser = {
  id: "456",
  name: "Jane Admin",
  role: "admin",
  isActive: true,
  email: "jane@admin.com"
};

console.log("All tests passed!");
`;

    writeFileSync(join(tempDir, "test-runner.ts"), testRunner);

    // 7. Install dependencies and run typecheck
    const installResult = await runCommand("npm", ["install"], tempDir);
    expect(installResult.code).toBe(0);

    // 8. Run typecheck
    const typecheckResult = await runCommand("npm", ["run", "typecheck"], tempDir);
    if (typecheckResult.code !== 0) {
      console.log("Typecheck stdout:", typecheckResult.stdout);
      console.log("Typecheck stderr:", typecheckResult.stderr);
    }
    expect(typecheckResult.code).toBe(0);

    // 9. Run lint
    const lintResult = await runCommand("npm", ["run", "lint"], tempDir);
    expect(lintResult.code).toBe(0);

    // 10. Compile and run the test
    const compileResult = await runCommand("npx", ["tsc", "--target", "ES2022", "--module", "ES2022", "--moduleResolution", "bundler", "test-runner.ts"], tempDir);
    expect(compileResult.code).toBe(0);

    const runResult = await runCommand("node", ["test-runner.js"], tempDir);
    if (runResult.code !== 0) {
      console.log("Runtime stdout:", runResult.stdout);
      console.log("Runtime stderr:", runResult.stderr);
    }
    expect(runResult.code).toBe(0);
    expect(runResult.stdout).toContain("All tests passed!");

    // 11. Verify the actual output contains expected data
    expect(runResult.stdout).toContain('"id":"123"');
    expect(runResult.stdout).toContain('"name":"John Doe"');
    expect(runResult.stdout).toContain('"role":"admin"');
    expect(runResult.stdout).toContain('"email":"jane@admin.com"');
  });

  it("should generate, compile, and execute builders for utility types", async () => {
    // 1. Create test interfaces with utility types
    const typeDefinition = `
export interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  inStock: boolean;
  tags: string[];
}

export type ProductSummary = Pick<Product, "id" | "name" | "price">;
export type ProductUpdate = Omit<Product, "id">;
export type RequiredProduct = Required<Product>;
`;

    writeFileSync(testFile, typeDefinition);

    // 2. Generate multiple builders
    const generator = new FluentGen();
    const multiResult = await generator.generateMultiple(testFile, ["ProductSummary", "ProductUpdate", "RequiredProduct"]);
    expect(multiResult.ok).toBe(true);
    if (!multiResult.ok) return;

    // 3. Write all generated files
    for (const [fileName, content] of multiResult.value) {
      writeFileSync(join(tempDir, fileName), content);
    }

    // 4. Create package.json and tsconfig.json (same as before)
    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      type: "module",
      devDependencies: { typescript: "^5.0.0" }
    };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson, null, 2));

    const tsConfig = {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true
      }
    };
    writeFileSync(join(tempDir, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

    // 5. Create test runner for utility types
    const testRunner = `
import { productSummary } from "./ProductSummary.js";
import { productUpdate } from "./ProductUpdate.js";
import { requiredProduct } from "./RequiredProduct.js";

// Test Pick utility type (ProductSummary)
const summary = productSummary()
  .withId("prod-123")
  .withName("Test Product")
  .withPrice(99.99)
  .build({ parentId: "root" });

// Test Omit utility type (ProductUpdate)
const update = productUpdate()
  .withName("Updated Product")
  .withPrice(79.99)
  .withDescription("New description")
  .withInStock(true)
  .withTags(["updated", "sale"])
  .build({ parentId: "root" });

// Test Required utility type (RequiredProduct)
const required = requiredProduct()
  .withId("req-123")
  .withName("Required Product")
  .withPrice(149.99)
  .withDescription("Always required")
  .withInStock(false)
  .withTags(["premium"])
  .build({ parentId: "root" });

console.log("Summary:", JSON.stringify(summary));
console.log("Update:", JSON.stringify(update));
console.log("Required:", JSON.stringify(required));

console.log("Utility type tests passed!");
`;

    writeFileSync(join(tempDir, "test-runner.ts"), testRunner);

    // 6. Install, typecheck, compile and run
    const installResult = await runCommand("npm", ["install"], tempDir);
    expect(installResult.code).toBe(0);

    const typecheckResult = await runCommand("npx", ["tsc", "--noEmit", "--strict"], tempDir);
    expect(typecheckResult.code).toBe(0);

    const compileResult = await runCommand("npx", ["tsc", "--target", "ES2022", "--module", "ES2022", "--moduleResolution", "bundler", "test-runner.ts"], tempDir);
    expect(compileResult.code).toBe(0);

    const runResult = await runCommand("node", ["test-runner.js"], tempDir);
    if (runResult.code !== 0) {
      console.log("Runtime stdout:", runResult.stdout);
      console.log("Runtime stderr:", runResult.stderr);
    }
    expect(runResult.code).toBe(0);
    expect(runResult.stdout).toContain("Utility type tests passed!");

    // 7. Verify the actual behavior of utility types
    expect(runResult.stdout).toContain('"id":"prod-123"');
    expect(runResult.stdout).toContain('"name":"Test Product"');
    expect(runResult.stdout).toContain('"price":99.99');

    // ProductSummary should NOT have description, inStock, tags
    const summaryOutput = runResult.stdout.split('\n').find(line => line.includes('Summary:'));
    expect(summaryOutput).toBeDefined();
    expect(summaryOutput).not.toContain('"description"');
    expect(summaryOutput).not.toContain('"inStock"');
    expect(summaryOutput).not.toContain('"tags"');

    // ProductUpdate should NOT have id
    const updateOutput = runResult.stdout.split('\n').find(line => line.includes('Update:'));
    expect(updateOutput).toBeDefined();
    expect(updateOutput).not.toContain('"id"');
    expect(updateOutput).toContain('"description":"New description"');
  });

  it("should handle conditional setters with complex logic", async () => {
    // 1. Create interface for testing conditional logic
    const typeDefinition = `
export interface Config {
  env: "development" | "production" | "test";
  debug: boolean;
  apiUrl: string;
  ssl?: boolean;
  monitoring?: {
    enabled: boolean;
    endpoint?: string;
  };
}
`;

    writeFileSync(testFile, typeDefinition);

    // 2. Generate builder
    const generator = new FluentGen();
    const configResult = await generator.generateBuilder(testFile, "Config");
    expect(configResult.ok).toBe(true);
    if (!configResult.ok) return;

    writeFileSync(join(tempDir, "config-builder.ts"), configResult.value);

    // 3. Setup project
    const packageJson = { name: "test", version: "1.0.0", type: "module", devDependencies: { typescript: "^5.0.0" } };
    writeFileSync(join(tempDir, "package.json"), JSON.stringify(packageJson, null, 2));

    const tsConfig = { compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true } };
    writeFileSync(join(tempDir, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));

    // 4. Create complex conditional test
    const testRunner = `
import { config } from "./config-builder.js";

// Test environment-specific configuration with conditional logic
const prodConfig = config()
  .withEnv("production")
  .withApiUrl("https://api.prod.com")
  .withDebug(false)
  .if(
    (builder) => builder.peek("env") === "production",
    "ssl",
    true
  )
  .if(
    (builder) => builder.has("ssl") && builder.peek("ssl") === true,
    "monitoring",
    { enabled: true, endpoint: "https://monitoring.prod.com" }
  )
  .build({ parentId: "root" });

const devConfig = config()
  .withEnv("development")
  .withApiUrl("http://localhost:3000")
  .withDebug(true)
  .if(
    (builder) => builder.peek("env") === "development",
    "ssl",
    false
  )
  .if(
    (builder) => builder.peek("debug") === true,
    "monitoring",
    { enabled: false }
  )
  .build({ parentId: "root" });

console.log("Production config:", JSON.stringify(prodConfig));
console.log("Development config:", JSON.stringify(devConfig));

// Verify conditional logic worked correctly
if (prodConfig.env === "production" && prodConfig.ssl === true && prodConfig.monitoring?.enabled === true) {
  console.log("Production conditional logic: PASS");
} else {
  throw new Error("Production conditional logic failed");
}

if (devConfig.env === "development" && devConfig.ssl === false && devConfig.monitoring?.enabled === false) {
  console.log("Development conditional logic: PASS");
} else {
  throw new Error("Development conditional logic failed");
}

console.log("Complex conditional tests passed!");
`;

    writeFileSync(join(tempDir, "test-runner.ts"), testRunner);

    // 5. Execute full pipeline
    await runCommand("npm", ["install"], tempDir);

    const typecheckResult = await runCommand("npx", ["tsc", "--noEmit", "--strict"], tempDir);
    expect(typecheckResult.code).toBe(0);

    const compileResult = await runCommand("npx", ["tsc", "--target", "ES2022", "--module", "ES2022", "--moduleResolution", "bundler", "test-runner.ts"], tempDir);
    expect(compileResult.code).toBe(0);

    const runResult = await runCommand("node", ["test-runner.js"], tempDir);
    expect(runResult.code).toBe(0);
    expect(runResult.stdout).toContain("Complex conditional tests passed!");
    expect(runResult.stdout).toContain("Production conditional logic: PASS");
    expect(runResult.stdout).toContain("Development conditional logic: PASS");
  });
});