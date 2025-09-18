import { describe, it, expect, beforeEach } from "vitest";
import { BuilderGenerator } from "../gen/generator.js";
import { TypeExtractor } from "../type-info/index.js";
import {
  PluginManager,
  type Plugin,
  type PropertyMethodContext,
  type BuilderContext,
  type ValueContext,
  type CustomMethod,
  type PropertyMethodTransform,
  type ValueTransform,
} from "../core/plugin.js";
import { isOk, ok, err } from "../core/result.js";
import { TypeKind } from "../core/types.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Enhanced Plugin System", () => {
  let pluginManager: PluginManager;
  let generator: BuilderGenerator;
  let extractor: TypeExtractor;

  beforeEach(() => {
    pluginManager = new PluginManager();
    generator = new BuilderGenerator({}, pluginManager);
    extractor = new TypeExtractor();
  });

  describe("Property Method Transformation", () => {
    it("should transform method signatures for sensitive fields", async () => {
      const sensitivePlugin: Plugin = {
        name: "sensitive-transform",
        version: "1.0.0",

        imports: {
          runtime: ["import { SensitiveValue } from './security.js';"]
        },

        transformPropertyMethod(context: PropertyMethodContext) {
          if (context.property.name === "password") {
            const transform: PropertyMethodTransform = {
              parameterType: `string | SensitiveValue<string>`,
              extractValue: `typeof value === 'object' ? value.value : value`,
              validate: `if (typeof value === 'object' && value.sensitive) { console.log('Sensitive!'); }`
            };
            return ok(transform);
          }
          return ok({});
        }
      };

      pluginManager.register(sensitivePlugin);

      // Create test fixture
      const testCode = `
export interface UserCredentials {
  username: string;
  password: string;
  apiKey?: string;
}`;
      const testFile = path.join(__dirname, "../__temp__/test-sensitive.ts");
      await fs.mkdir(path.dirname(testFile), { recursive: true });
      await fs.writeFile(testFile, testCode);

      const extractResult = await extractor.extractType(testFile, "UserCredentials");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Check generated code
      expect(generateResult.value).toContain("import { SensitiveValue } from './security.js';");
      expect(generateResult.value).toContain("withPassword(value: string | SensitiveValue<string>)");
      expect(generateResult.value).toContain("typeof value === 'object' ? value.value : value");
      expect(generateResult.value).toContain("console.log('Sensitive!')");

      await fs.unlink(testFile);
    });

    it("should handle multiple plugin transformations", async () => {
      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        transformPropertyMethod(context: PropertyMethodContext) {
          if (context.property.type.kind === TypeKind.Primitive) {
            return ok({ parameterType: `${context.originalType} | null` });
          }
          return ok({});
        }
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        transformPropertyMethod(context: PropertyMethodContext) {
          if (context.property.optional) {
            return ok({ validate: `if (value === null) return this;` });
          }
          return ok({});
        }
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context: PropertyMethodContext = {
        property: {
          name: "age",
          type: { kind: TypeKind.Primitive, name: "number" },
          optional: true,
          readonly: false
        },
        originalType: "number",
        builderName: "PersonBuilder",
        typeName: "Person",
        typeInfo: { kind: TypeKind.Object, properties: [] }
      };

      const transform = await pluginManager.getPropertyMethodTransform(context);
      expect(transform).not.toBeNull();
      expect(transform?.parameterType).toBe("number | null");
      expect(transform?.validate).toBe("if (value === null) return this;");
    });
  });

  describe("Custom Methods Addition", () => {
    it("should add custom methods to builders", async () => {
      const customPlugin: Plugin = {
        name: "custom-methods",
        version: "1.0.0",

        imports: {
          runtime: ["import { validate } from './validators.js';"]
        },

        addCustomMethods(_context: BuilderContext) {
          const methods: CustomMethod[] = [
            {
              name: "withValidation",
              signature: "()",
              implementation: "validate(this.values); return this;",
              jsDoc: "/** Validates all values */"
            },
            {
              name: "reset",
              signature: "()",
              implementation: "this.values = {}; return this;",
              jsDoc: "/** Resets the builder */"
            }
          ];
          return ok(methods);
        }
      };

      pluginManager.register(customPlugin);

      const testCode = `
export interface Config {
  name: string;
  value: number;
}`;
      const testFile = path.join(__dirname, "../__temp__/test-custom.ts");
      await fs.mkdir(path.dirname(testFile), { recursive: true });
      await fs.writeFile(testFile, testCode);

      const extractResult = await extractor.extractType(testFile, "Config");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Check for custom methods
      expect(generateResult.value).toContain("import { validate } from './validators.js';");
      expect(generateResult.value).toContain("withValidation()");
      expect(generateResult.value).toContain("reset()");
      expect(generateResult.value).toContain("/** Validates all values */");
      expect(generateResult.value).toContain("/** Resets the builder */");

      await fs.unlink(testFile);
    });

    it("should generate property-specific custom methods", async () => {
      const encryptPlugin: Plugin = {
        name: "encrypt-plugin",
        version: "1.0.0",

        imports: {
          runtime: ["import { encrypt } from './crypto.js';"]
        },

        addCustomMethods(_context: BuilderContext) {
          const methods: CustomMethod[] = [];

          for (const prop of context.properties) {
            if (prop.type.kind === TypeKind.Primitive && prop.type.name === "string") {
              methods.push({
                name: `withEncrypted${prop.name.charAt(0).toUpperCase() + prop.name.slice(1)}`,
                signature: "(value: string)",
                implementation: `return this.set("${prop.name}", encrypt(value));`,
                jsDoc: `/** Encrypts and sets ${prop.name} */`
              });
            }
          }

          return ok(methods);
        }
      };

      pluginManager.register(encryptPlugin);

      const context: BuilderContext = {
        typeName: "User",
        builderName: "UserBuilder",
        typeInfo: {
          kind: TypeKind.Object,
          properties: [
            { name: "email", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
            { name: "age", type: { kind: TypeKind.Primitive, name: "number" }, optional: false, readonly: false }
          ]
        },
        properties: [
          { name: "email", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
          { name: "age", type: { kind: TypeKind.Primitive, name: "number" }, optional: false, readonly: false }
        ],
        genericParams: "",
        genericConstraints: ""
      };

      const methods = await pluginManager.getCustomMethods(context);
      expect(methods).toHaveLength(1);
      expect(methods[0]?.name).toBe("withEncryptedEmail");
      expect(methods[0]?.implementation).toContain('encrypt(value)');
    });
  });

  describe("Value Transformation", () => {
    it("should transform values during build", async () => {
      const maskPlugin: Plugin = {
        name: "mask-plugin",
        version: "1.0.0",

        transformValue(context: ValueContext) {
          if (context.property === "secret") {
            const transform: ValueTransform = {
              condition: `${context.valueVariable} !== undefined`,
              transform: `${context.valueVariable} = "***MASKED***"`
            };
            return ok(transform);
          }
          return ok(null);
        }
      };

      pluginManager.register(maskPlugin);

      const context: ValueContext = {
        property: "secret",
        valueVariable: "result['secret']",
        type: { kind: TypeKind.Primitive, name: "string" },
        isOptional: false
      };

      const transforms = await pluginManager.getValueTransforms(context);
      expect(transforms).toHaveLength(1);
      expect(transforms[0]?.condition).toBe("result['secret'] !== undefined");
      expect(transforms[0]?.transform).toBe("result['secret'] = \"***MASKED***\"");
    });

    it("should apply multiple value transformations", async () => {
      const trimPlugin: Plugin = {
        name: "trim-plugin",
        version: "1.0.0",
        transformValue(context: ValueContext) {
          if (context.type.kind === TypeKind.Primitive && context.type.name === "string") {
            return ok({
              transform: `${context.valueVariable} = ${context.valueVariable}.trim()`
            });
          }
          return ok(null);
        }
      };

      const upperPlugin: Plugin = {
        name: "upper-plugin",
        version: "1.0.0",
        transformValue(context: ValueContext) {
          if (context.property === "code") {
            return ok({
              transform: `${context.valueVariable} = ${context.valueVariable}.toUpperCase()`
            });
          }
          return ok(null);
        }
      };

      pluginManager.register(trimPlugin);
      pluginManager.register(upperPlugin);

      const context: ValueContext = {
        property: "code",
        valueVariable: "result['code']",
        type: { kind: TypeKind.Primitive, name: "string" },
        isOptional: false
      };

      const transforms = await pluginManager.getValueTransforms(context);
      expect(transforms).toHaveLength(2);
      expect(transforms[0]?.transform).toContain('.trim()');
      expect(transforms[1]?.transform).toContain('.toUpperCase()');
    });
  });

  describe("Import Management", () => {
    it("should collect imports from multiple plugins", () => {
      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        imports: {
          runtime: ["import { funcA } from './a.js';"],
          types: ["import type { TypeA } from './types.js';"]
        }
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        imports: {
          runtime: [
            "import { funcB } from './b.js';",
            "import { funcA } from './a.js';" // Duplicate
          ],
          types: ["import type { TypeB } from './types.js';"]
        }
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const imports = pluginManager.getRequiredImports();

      // Should deduplicate imports
      expect(imports.runtime).toHaveLength(2);
      expect(imports.runtime).toContain("import { funcA } from './a.js';");
      expect(imports.runtime).toContain("import { funcB } from './b.js';");

      expect(imports.types).toHaveLength(2);
      expect(imports.types).toContain("import type { TypeA } from './types.js';");
      expect(imports.types).toContain("import type { TypeB } from './types.js';");
    });
  });

  describe("End-to-End Plugin Integration", () => {
    it("should generate working builder with all plugin features", async () => {
      const comprehensivePlugin: Plugin = {
        name: "comprehensive",
        version: "1.0.0",

        imports: {
          runtime: [
            "import { encrypt, validate } from './utils.js';",
            "import type { Encrypted } from './types.js';"
          ]
        },

        transformPropertyMethod(context: PropertyMethodContext) {
          if (context.property.name === "email") {
            return ok({
              parameterType: "string | { value: string; encrypted: boolean }",
              extractValue: "typeof value === 'object' ? value.value : value"
            });
          }
          return ok({});
        },

        addCustomMethods(_context: BuilderContext) {
          return ok([
            {
              name: "validateAndBuild",
              signature: "(context?: BaseBuildContext)",
              implementation: "validate(this.values); return this.build(context);",
              jsDoc: "/** Validates and builds */"
            }
          ]);
        },

        transformValue(context: ValueContext) {
          if (context.property === "email") {
            return ok({
              condition: "typeof " + context.valueVariable + " === 'string'",
              transform: context.valueVariable + " = " + context.valueVariable + ".toLowerCase()"
            });
          }
          return ok(null);
        }
      };

      pluginManager.register(comprehensivePlugin);

      const testCode = `
export interface Account {
  id: string;
  email: string;
  name: string;
}`;
      const testFile = path.join(__dirname, "../__temp__/test-comprehensive.ts");
      await fs.mkdir(path.dirname(testFile), { recursive: true });
      await fs.writeFile(testFile, testCode);

      const extractResult = await extractor.extractType(testFile, "Account");
      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);
      expect(isOk(generateResult)).toBe(true);
      if (!isOk(generateResult)) return;

      // Verify all plugin features are present
      expect(generateResult.value).toContain("import { encrypt, validate } from './utils.js';");
      expect(generateResult.value).toContain("withEmail(value: string | { value: string; encrypted: boolean })");
      expect(generateResult.value).toContain("typeof value === 'object' ? value.value : value");
      expect(generateResult.value).toContain("validateAndBuild(context?: BaseBuildContext)");

      // Write to file for type checking
      const outputFile = path.join(__dirname, "../__temp__/comprehensive-output.ts");
      await fs.writeFile(outputFile, generateResult.value);

      // Clean up
      await fs.unlink(testFile);
      await fs.unlink(outputFile);
    });
  });

  describe("Plugin Error Handling", () => {
    it("should handle plugin errors gracefully", async () => {
      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",

        transformPropertyMethod() {
          return err(new Error("Plugin error"));
        },

        addCustomMethods() {
          return err(new Error("Method error"));
        }
      };

      pluginManager.register(errorPlugin);

      const methodContext: PropertyMethodContext = {
        property: { name: "test", type: { kind: TypeKind.Primitive, name: "string" }, optional: false, readonly: false },
        originalType: "string",
        builderName: "TestBuilder",
        typeName: "Test",
        typeInfo: { kind: TypeKind.Object, properties: [] }
      };

      const transform = await pluginManager.getPropertyMethodTransform(methodContext);
      expect(transform).toBeNull(); // Should return null on error

      const builderContext: BuilderContext = {
        typeName: "Test",
        builderName: "TestBuilder",
        typeInfo: { kind: TypeKind.Object, properties: [] },
        properties: [],
        genericParams: "",
        genericConstraints: ""
      };

      const methods = await pluginManager.getCustomMethods(builderContext);
      expect(methods).toHaveLength(0); // Should return empty array on error
    });
  });
});