import { describe, it, expect, vi } from "vitest";
import {
  PluginManager,
  HookType,
  type Plugin,
  type ResolveContext,
} from "../core/plugin.js";
import { BuilderGenerator } from "../gen/generator.js";
import { TypeExtractor } from "../type-info/index.js";
import { isOk, ok, err } from "../core/result.js";
import type { TypeInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";
import { Type } from "ts-morph";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Plugin Hooks", () => {
  const fixturesPath = path.join(__dirname, "fixtures", "simple.ts");

  describe("PluginManager", () => {
    it("should register and execute plugins", () => {
      const pluginManager = new PluginManager();
      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      pluginManager.register(mockPlugin);
      expect(pluginManager.getPlugins()).toContain(mockPlugin);
    });

    it("should not allow duplicate plugin registration", () => {
      const pluginManager = new PluginManager();
      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      pluginManager.register(mockPlugin);
      expect(() => pluginManager.register(mockPlugin)).toThrow(
        "Plugin test-plugin is already registered",
      );
    });

    it("should unregister plugins", () => {
      const pluginManager = new PluginManager();
      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      pluginManager.register(mockPlugin);
      expect(pluginManager.unregister("test-plugin")).toBe(true);
      expect(pluginManager.getPlugins()).not.toContain(mockPlugin);
    });
  });

  describe("Hook Execution", () => {
    it("should execute beforeParse hook", async () => {
      const beforeParseMock = vi.fn((context) => ok(context));
      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        beforeParse: beforeParseMock,
      };

      const pluginManager = new PluginManager();
      pluginManager.register(mockPlugin);

      const context = { sourceFile: "test.ts", typeName: "Test" };
      const result = await pluginManager.executeHook(
        HookType.BeforeParse,
        context,
      );

      expect(beforeParseMock).toHaveBeenCalledWith(context);
      expect(isOk(result)).toBe(true);
    });

    it("should execute afterResolve hook", async () => {
      const afterResolveMock = vi.fn((context, typeInfo) => ok(typeInfo));
      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        afterResolve: afterResolveMock,
      };

      const pluginManager = new PluginManager();
      pluginManager.register(mockPlugin);

      // Create a minimal Type mock for testing
      const mockType = {} as Type;
      const context: ResolveContext = {
        sourceFile: "test.ts",
        typeName: "Test",
        type: mockType,
      };
      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: "Test",
        properties: [],
      };

      const result = await pluginManager.executeHook(
        HookType.AfterResolve,
        context,
        typeInfo,
      );

      expect(afterResolveMock).toHaveBeenCalledWith(context, typeInfo);
      expect(isOk(result)).toBe(true);
    });

    it("should execute transformType hook", async () => {
      const transformTypeMock = vi.fn((type, typeInfo) => {
        // Add a custom property to the type
        return ok({
          ...typeInfo,
          properties: [
            ...(typeInfo.properties || []),
            {
              name: "customProp",
              type: { kind: TypeKind.Primitive, name: "string" },
              optional: false,
              readonly: false,
            },
          ],
        });
      });

      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        transformType: transformTypeMock,
      };

      const pluginManager = new PluginManager();
      pluginManager.register(mockPlugin);

      const typeInfo: TypeInfo = {
        kind: TypeKind.Object,
        name: "Test",
        properties: [],
      };

      const mockTypeForTransform = {} as Type;
      const result = await pluginManager.executeHook(
        HookType.TransformType,
        mockTypeForTransform,
        typeInfo,
      );

      expect(transformTypeMock).toHaveBeenCalled();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const expectedTypeInfo = {
          ...typeInfo,
          properties: [
            {
              name: "customProp",
              type: { kind: TypeKind.Primitive, name: "string" },
              optional: false,
              readonly: false,
            },
          ],
        };
        expect(result.value).toEqual(expectedTypeInfo);
      }
    });

    it("should execute transformProperty hook", async () => {
      const transformPropertyMock = vi.fn((property) => {
        // Make property optional
        return ok({
          ...property,
          optional: true,
        });
      });

      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        transformProperty: transformPropertyMock,
      };

      const pluginManager = new PluginManager();
      pluginManager.register(mockPlugin);

      const property = {
        name: "testProp",
        type: { kind: TypeKind.Primitive, name: "string" },
        optional: false,
        readonly: false,
      };

      const result = await pluginManager.executeHook(
        HookType.TransformProperty,
        property,
      );

      expect(transformPropertyMock).toHaveBeenCalledWith(property);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.optional).toBe(true);
      }
    });

    it("should execute multiple plugins in order", async () => {
      const callOrder: string[] = [];

      const plugin1: Plugin = {
        name: "plugin-1",
        version: "1.0.0",
        beforeParse: (context) => {
          callOrder.push("plugin-1");
          return ok(context);
        },
      };

      const plugin2: Plugin = {
        name: "plugin-2",
        version: "1.0.0",
        beforeParse: (context) => {
          callOrder.push("plugin-2");
          return ok(context);
        },
      };

      const pluginManager = new PluginManager();
      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context = { sourceFile: "test.ts", typeName: "Test" };
      await pluginManager.executeHook(HookType.BeforeParse, context);

      expect(callOrder).toEqual(["plugin-1", "plugin-2"]);
    });

    it("should stop execution on plugin error", async () => {
      const plugin1: Plugin = {
        name: "plugin-1",
        version: "1.0.0",
        beforeParse: () => err(new Error("Plugin error")),
      };

      const plugin2Mock = vi.fn((context) => ok(context));
      const plugin2: Plugin = {
        name: "plugin-2",
        version: "1.0.0",
        beforeParse: plugin2Mock,
      };

      const pluginManager = new PluginManager();
      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const context = { sourceFile: "test.ts", typeName: "Test" };
      const result = await pluginManager.executeHook(
        HookType.BeforeParse,
        context,
      );

      expect(isOk(result)).toBe(false);
      expect(plugin2Mock).not.toHaveBeenCalled();
    });
  });

  describe("Integration with Generator", () => {
    it("should allow plugins to modify generated code", async () => {
      const afterGenerateMock = vi.fn((code, _context) => {
        // Add a comment to the generated code
        return ok(`// Modified by plugin\n${code}`);
      });

      const mockPlugin: Plugin = {
        name: "code-modifier",
        version: "1.0.0",
        afterGenerate: afterGenerateMock,
      };

      const pluginManager = new PluginManager();
      pluginManager.register(mockPlugin);

      const generator = new BuilderGenerator({}, pluginManager);

      const extractor = new TypeExtractor();
      const extractResult = await extractor.extractType(
        fixturesPath,
        "Address",
      );

      expect(isOk(extractResult)).toBe(true);
      if (!isOk(extractResult)) return;

      const generateResult = await generator.generate(extractResult.value);

      expect(isOk(generateResult)).toBe(true);
      if (isOk(generateResult)) {
        expect(generateResult.value).toContain("// Modified by plugin");
        expect(afterGenerateMock).toHaveBeenCalled();
      }
    });

    it("should allow plugins to tap into all available hooks", async () => {
      const hooksCalled: string[] = [];

      const comprehensivePlugin: Plugin = {
        name: "comprehensive-plugin",
        version: "1.0.0",
        beforeParse: (context) => {
          hooksCalled.push("beforeParse");
          return ok(context);
        },
        afterParse: (context, type) => {
          hooksCalled.push("afterParse");
          return ok(type);
        },
        beforeResolve: (context) => {
          hooksCalled.push("beforeResolve");
          return ok(context);
        },
        afterResolve: (context, typeInfo) => {
          hooksCalled.push("afterResolve");
          return ok(typeInfo);
        },
        beforeGenerate: (context) => {
          hooksCalled.push("beforeGenerate");
          return ok(context);
        },
        afterGenerate: (code, _context) => {
          hooksCalled.push("afterGenerate");
          return ok(code);
        },
        transformType: (type, typeInfo) => {
          hooksCalled.push("transformType");
          return ok(typeInfo);
        },
        transformProperty: (property) => {
          hooksCalled.push("transformProperty");
          return ok(property);
        },
      };

      const pluginManager = new PluginManager();
      pluginManager.register(comprehensivePlugin);

      // Note: Not all hooks will be called in a single operation
      // This test verifies that the plugin interface supports all hooks
      expect(comprehensivePlugin.beforeParse).toBeDefined();
      expect(comprehensivePlugin.afterParse).toBeDefined();
      expect(comprehensivePlugin.beforeResolve).toBeDefined();
      expect(comprehensivePlugin.afterResolve).toBeDefined();
      expect(comprehensivePlugin.beforeGenerate).toBeDefined();
      expect(comprehensivePlugin.afterGenerate).toBeDefined();
      expect(comprehensivePlugin.transformType).toBeDefined();
      expect(comprehensivePlugin.transformProperty).toBeDefined();

      // Test that hooks are actually called during generation
      const generator = new BuilderGenerator({}, pluginManager);

      const extractor = new TypeExtractor();
      const extractResult = await extractor.extractType(
        fixturesPath,
        "Address",
      );

      if (isOk(extractResult)) {
        const generateResult = await generator.generate(extractResult.value);
        expect(isOk(generateResult)).toBe(true);

        // At minimum, these hooks should have been called
        expect(hooksCalled).toContain("beforeGenerate");
        expect(hooksCalled).toContain("afterGenerate");
      }
    });
  });
});
