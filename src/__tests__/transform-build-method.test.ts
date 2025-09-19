import { describe, it, expect, beforeEach } from "vitest";
import { BuilderGenerator } from "../gen/generator.js";
import { TypeExtractor } from "../type-info/index.js";
import {
  PluginManager,
  type Plugin,
  type BuildMethodContext,
} from "../core/plugin.js";
import { isOk, ok } from "../core/result.js";
import { TypeKind } from "../core/types.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Transform Build Method Plugin Integration", () => {
  const fixturesPath = path.join(__dirname, "fixtures", "plugin-scenario.ts");
  let pluginManager: PluginManager;
  let generator: BuilderGenerator;
  let extractor: TypeExtractor;

  beforeEach(() => {
    pluginManager = new PluginManager();
    generator = new BuilderGenerator({}, pluginManager);
    extractor = new TypeExtractor();
  });

  describe("Basic Plugin Functionality", () => {
    it("should support transformBuildMethod hook", async () => {
      const commentPlugin: Plugin = {
        name: "comment-plugin",
        version: "1.0.0",
        transformBuildMethod(context: BuildMethodContext) {
          const modifiedCode = context.buildMethodCode.replace(
            "build(context?: BaseBuildContext):",
            "// Enhanced by plugin\n  build(context?: BaseBuildContext):",
          );
          return ok(modifiedCode);
        },
      };

      pluginManager.register(commentPlugin);

      const extractResult = await extractor.extractType(fixturesPath, "Text");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Write generated code to temporary file and type-check it
      const tempFile = path.join(
        __dirname,
        "../__temp__/plugin-comment-test.ts",
      );
      await fs.mkdir(path.dirname(tempFile), { recursive: true });
      await fs.writeFile(tempFile, generateResult.value);

      // Verify it type-checks
      const { execSync } = await import("node:child_process");
      expect(() => {
        execSync(`npx tsc --noEmit ${tempFile}`, { stdio: "pipe" });
      }).not.toThrow();

      // Snapshot test - verify exact output
      expect(generateResult.value).toMatchSnapshot();

      // Clean up
      await fs.unlink(tempFile);
    });

    it("should handle plugin errors gracefully", async () => {
      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        transformBuildMethod() {
          return { ok: false, error: new Error("Plugin error") };
        },
      };

      pluginManager.register(errorPlugin);

      const extractResult = await extractor.extractType(fixturesPath, "Text");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Should fallback to default build method
      expect(generateResult.value).toMatchSnapshot();
    });
  });

  describe("Deterministic ID Plugin", () => {
    const createDeterministicIdPlugin = (): Plugin => ({
      name: "deterministic-id-plugin",
      version: "1.0.0",
      transformBuildMethod(context: BuildMethodContext) {
        // Only modify types that have an 'id' property
        const hasIdProperty = context.properties.some(
          (prop) => prop.name === "id",
        );
        if (!hasIdProperty) {
          return ok(context.buildMethodCode);
        }

        // Create enhanced build method with ID generation
        const enhancedBuildMethod = `  build(context?: BaseBuildContext & { parentId?: string; parameterName?: string; index?: number }): ${context.typeName}${context.genericConstraints} {
    // Generate deterministic ID based on context
    const generatedId = this.generateId(context);
    const result = { ...this.values };

    // Set ID if not already provided
    if (!result.id) {
      result.id = generatedId;
    }

    // Build nested components with enhanced context
    const enhancedContext = {
      ...context,
      parentId: generatedId,
    };

    // Process mixed arrays
    this.mixedArrays.forEach((array, key) => {
      const resolvedArray: unknown[] = [];
      array.forEach((item, index) => {
        const indexedKey = \`\${key}[\${index}]\`;
        const nestedContext = enhancedContext ? createNestedContext(enhancedContext, key, index) : undefined;

        // Check if this index has a builder stored
        if (this.builders.has(indexedKey)) {
          const builderOrObj = this.builders.get(indexedKey);
          resolvedArray[index] = resolveValue(builderOrObj, nestedContext);
        } else {
          // Static value
          resolvedArray[index] = item;
        }
      });
      (result as Record<string, unknown>)[key] = resolvedArray;
    });

    // Process regular builders (non-array)
    this.builders.forEach((value, key) => {
      // Skip indexed keys (they're handled in mixed arrays)
      if (key.includes('[')) return;
      // Skip keys that are in mixed arrays
      if (this.mixedArrays.has(key)) return;

      const nestedContext = enhancedContext ? createNestedContext(enhancedContext, key) : undefined;
      (result as Record<string, unknown>)[key] = resolveValue(value, nestedContext);
    });

    return result as ${context.typeName}${context.genericConstraints};
  }

  private generateId(context?: BaseBuildContext & { parentId?: string; parameterName?: string; index?: number }): string {
    if (!context?.parentId) {
      return "root";
    }

    const parts = [context.parentId, context.parameterName];
    if (context.index !== undefined) {
      parts.push(context.index.toString());
    }

    return parts.join("-");
  }`;

        return ok(enhancedBuildMethod);
      },
    });

    it("should generate complete deterministic ID logic for Action type", async () => {
      pluginManager.register(createDeterministicIdPlugin());

      const extractResult = await extractor.extractType(fixturesPath, "Action");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Write to temp file and type-check
      const tempFile = path.join(
        __dirname,
        "../__temp__/deterministic-id-action.ts",
      );
      await fs.mkdir(path.dirname(tempFile), { recursive: true });
      await fs.writeFile(tempFile, generateResult.value);

      expect(() => {
        const { execSync } = require("node:child_process");
        execSync(`npx tsc --noEmit ${tempFile}`, { stdio: "pipe" });
      }).not.toThrow();

      // Snapshot test
      expect(generateResult.value).toMatchSnapshot();

      await fs.unlink(tempFile);
    });

    it("should work with complex nested types like Button", async () => {
      pluginManager.register(createDeterministicIdPlugin());

      const extractResult = await extractor.extractType(fixturesPath, "Button");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Type-check the generated code
      const tempFile = path.join(
        __dirname,
        "../__temp__/deterministic-id-button.ts",
      );
      await fs.mkdir(path.dirname(tempFile), { recursive: true });
      await fs.writeFile(tempFile, generateResult.value);

      expect(() => {
        const { execSync } = require("node:child_process");
        execSync(`npx tsc --noEmit ${tempFile}`, { stdio: "pipe" });
      }).not.toThrow();

      // Snapshot test
      expect(generateResult.value).toMatchSnapshot();

      await fs.unlink(tempFile);
    });

    it("should not modify types without id property", async () => {
      pluginManager.register(createDeterministicIdPlugin());

      // Create a type without 'id' property
      const typeWithoutId = {
        sourceFile: fixturesPath,
        name: "SimpleType",
        typeInfo: {
          kind: TypeKind.Object as const,
          name: "SimpleType",
          properties: [
            {
              name: "value",
              type: { kind: TypeKind.Primitive as const, name: "string" },
              optional: false,
              readonly: false,
            },
            {
              name: "count",
              type: { kind: TypeKind.Primitive as const, name: "number" },
              optional: true,
              readonly: false,
            },
          ],
        } as const,
        imports: [] as const,
        dependencies: [] as const,
      };

      const generateResult = await generator.generate(typeWithoutId);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Type-check the generated code by creating a complete TypeScript file
      const typeDefinition = `
export interface SimpleType {
  value: string;
  count?: number;
}
      `;

      const completeCode = generateResult.value.replace(
        'import type { SimpleType } from "/home/rcampos/repos/gen/src/__tests__/fixtures/plugin-scenario.ts";',
        typeDefinition,
      );

      const tempFile = path.join(__dirname, "../__temp__/no-id-property.ts");
      await fs.mkdir(path.dirname(tempFile), { recursive: true });
      await fs.writeFile(tempFile, completeCode);

      expect(() => {
        const { execSync } = require("node:child_process");
        execSync(`npx tsc --noEmit ${tempFile}`, { stdio: "pipe" });
      }).not.toThrow();

      // Should use default build method (no plugin modifications)
      expect(generateResult.value).toMatchSnapshot();

      await fs.unlink(tempFile);
    });
  });

  describe("Context-Based Plugin Customization", () => {
    it("should allow plugins to customize based on any property", async () => {
      const customContextPlugin: Plugin = {
        name: "custom-context-plugin",
        version: "1.0.0",
        transformBuildMethod(context: BuildMethodContext) {
          // Custom logic based on type having a 'style' property
          const hasStyleProperty = context.properties.some(
            (prop) => prop.name === "style",
          );

          if (hasStyleProperty) {
            const customBuildMethod = context.buildMethodCode.replace(
              "const result = { ...this.values };",
              `const result = { ...this.values };
    // Custom styling logic based on context
    if (context && 'theme' in context) {
      // Apply theme-specific defaults
      console.log("Applying theme:", (context as any).theme);
    }`,
            );
            return ok(customBuildMethod);
          }

          return ok(context.buildMethodCode);
        },
      };

      pluginManager.register(customContextPlugin);

      const extractResult = await extractor.extractType(fixturesPath, "Text");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Type-check and snapshot
      const tempFile = path.join(
        __dirname,
        "../__temp__/custom-context-plugin.ts",
      );
      await fs.mkdir(path.dirname(tempFile), { recursive: true });
      await fs.writeFile(tempFile, generateResult.value);

      expect(() => {
        const { execSync } = require("node:child_process");
        execSync(`npx tsc --noEmit ${tempFile}`, { stdio: "pipe" });
      }).not.toThrow();

      expect(generateResult.value).toMatchSnapshot();

      await fs.unlink(tempFile);
    });
  });

  describe("Full Context Validation", () => {
    it("should provide comprehensive context to plugins", async () => {
      let capturedContext: BuildMethodContext | undefined;

      const contextInspectorPlugin: Plugin = {
        name: "context-inspector",
        version: "1.0.0",
        transformBuildMethod(context: BuildMethodContext) {
          capturedContext = context;
          return ok(context.buildMethodCode);
        },
      };

      pluginManager.register(contextInspectorPlugin);

      const extractResult = await extractor.extractType(fixturesPath, "Form");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      await generator.generate(extractResult.value);

      // Validate that plugin receives comprehensive context
      expect(capturedContext).toBeDefined();
      expect(capturedContext?.typeName).toBe("Form");
      expect(capturedContext?.builderName).toBe("FormBuilder");
      expect(capturedContext?.properties).toHaveLength(4); // id, title, buttons, primaryAction
      expect(capturedContext?.resolvedType).toBeDefined();
      expect(capturedContext?.options).toBeDefined();
      expect(capturedContext?.genericParams).toBeDefined();
      expect(capturedContext?.genericConstraints).toBeDefined();

      // Verify properties are correctly exposed
      const propNames = capturedContext?.properties.map((p) => p.name);
      expect(propNames).toEqual(["id", "title", "buttons", "primaryAction"]);
    });
  });
});

