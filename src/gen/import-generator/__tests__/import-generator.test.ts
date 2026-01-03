import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImportGenerator } from '../import-generator.js';
import type { ImportGenerationContext } from '../types.js';
import type { ResolvedType } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import { isErr } from '../../../core/result.js';

// Mock all the dependencies
vi.mock('../generators/nodejs-imports.js', () => {
  return {
    NodeJSImportsGenerator: vi.fn(function () {
      return {
        generateNodeJSImports: vi.fn(function () {
          return [];
        }),
      };
    }),
  };
});

vi.mock('../generators/common-imports.js', () => {
  return {
    CommonImportsGenerator: vi.fn(function () {
      return {
        generateCommonImports: vi.fn(function () {
          return { ok: true, value: '' };
        }),
      };
    }),
  };
});

vi.mock('../generators/type-imports.js', () => {
  return {
    TypeImportsGenerator: vi.fn(function () {
      return {
        generateTypeImports: vi.fn(function () {
          return { ok: true, value: '' };
        }),
        dispose: vi.fn(),
      };
    }),
  };
});

vi.mock('../resolvers/package-resolver.js', () => {
  return {
    PackageResolver: vi.fn(function () {
      return {
        generateModuleImports: vi.fn(function () {
          return { ok: true, value: [] };
        }),
        shouldPreserveNamedImports: vi.fn(function () {
          return false;
        }),
      };
    }),
  };
});

vi.mock('../plugins/plugin-integration.js', () => {
  return {
    PluginIntegration: vi.fn(function () {
      return {
        processPluginImports: vi.fn(function (imports) {
          return Promise.resolve({ ok: true, value: imports.join('\n') });
        }),
      };
    }),
  };
});

vi.mock('../utils/deduplication.js', () => {
  return {
    extractModulesFromNamedImports: vi.fn(function () {
      return new Set();
    }),
  };
});

describe('ImportGenerator', () => {
  let generator: ImportGenerator;
  let mockNodeJSGenerator: any;
  let mockCommonGenerator: any;
  let mockTypeGenerator: any;
  let mockPackageResolver: any;
  let mockPluginIntegration: any;

  beforeEach(async () => {
    // Get the mocked constructors
    const { NodeJSImportsGenerator } = await import('../generators/nodejs-imports.js');
    const { CommonImportsGenerator } = await import('../generators/common-imports.js');
    const { TypeImportsGenerator } = await import('../generators/type-imports.js');
    const { PackageResolver } = await import('../resolvers/package-resolver.js');
    const { PluginIntegration } = await import('../plugins/plugin-integration.js');

    // Create mock instances
    mockNodeJSGenerator = {
      generateNodeJSImports: vi.fn(function () {
        return [];
      }),
    };

    mockCommonGenerator = {
      generateCommonImports: vi.fn(function () {
        return { ok: true, value: '' };
      }),
    };

    mockTypeGenerator = {
      generateTypeImports: vi.fn(function () {
        return { ok: true, value: '' };
      }),
      dispose: vi.fn(),
    };

    mockPackageResolver = {
      generateModuleImports: vi.fn(function () {
        return { ok: true, value: [] };
      }),
      shouldPreserveNamedImports: vi.fn(function () {
        return false;
      }),
    };

    mockPluginIntegration = {
      processPluginImports: vi.fn(function (imports) {
        return Promise.resolve({ ok: true, value: imports.join('\n') });
      }),
    };

    // Configure mocked constructors
    (NodeJSImportsGenerator as any).mockImplementation(function () {
      return mockNodeJSGenerator;
    });
    (CommonImportsGenerator as any).mockImplementation(function () {
      return mockCommonGenerator;
    });
    (TypeImportsGenerator as any).mockImplementation(function () {
      return mockTypeGenerator;
    });
    (PackageResolver as any).mockImplementation(function () {
      return mockPackageResolver;
    });
    (PluginIntegration as any).mockImplementation(function () {
      return mockPluginIntegration;
    });

    generator = new ImportGenerator(); // No tsconfig for consistent test behavior
  });

  afterEach(() => {
    generator.dispose();
  });

  describe('generateAllImports', () => {
    test('orchestrates all import generation steps correctly', async () => {
      const context = createImportContext();

      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: true,
        value: 'import { FluentBuilderBase } from "./common.js";',
      });

      mockNodeJSGenerator.generateNodeJSImports.mockReturnValue([
        'import { EventEmitter } from "events";',
      ]);

      mockTypeGenerator.generateTypeImports.mockReturnValue({
        ok: true,
        value: 'import type { User } from "./types.js";',
      });

      mockPackageResolver.generateModuleImports.mockReturnValue({
        ok: true,
        value: ['import type * as React from "react";'],
      });

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('FluentBuilderBase');
        expect(result.value).toContain('EventEmitter');
        expect(result.value).toContain('User');
        expect(result.value).toContain('React');
      }
    });

    test('generates common imports first', async () => {
      const context = createImportContext();

      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: true,
        value: 'import { FluentBuilderBase } from "./common.js";',
      });

      await generator.generateAllImports(context);

      expect(mockCommonGenerator.generateCommonImports).toHaveBeenCalledWith(context.config);
    });

    test('generates Node.js imports after common imports', async () => {
      const context = createImportContext();

      mockNodeJSGenerator.generateNodeJSImports.mockReturnValue([
        'import { EventEmitter } from "events";',
      ]);

      await generator.generateAllImports(context);

      expect(mockNodeJSGenerator.generateNodeJSImports).toHaveBeenCalledWith(context.resolvedType);
    });

    test('generates type imports and uses result for module exclusions', async () => {
      const context = createImportContext();

      mockTypeGenerator.generateTypeImports.mockReturnValue({
        ok: true,
        value: 'import type { User } from "react";',
      });

      const mockExtractModules = vi.mocked(
        await import('../utils/deduplication.js'),
      ).extractModulesFromNamedImports;
      mockExtractModules.mockReturnValue(new Set(['react']));

      await generator.generateAllImports(context);

      expect(mockTypeGenerator.generateTypeImports).toHaveBeenCalledWith(
        context.resolvedType,
        context.config.outputDir,
      );

      // Should pass the extracted modules to exclude namespace imports
      expect(mockPackageResolver.generateModuleImports).toHaveBeenCalledWith(
        context.resolvedType,
        expect.any(Set),
      );
    });

    test('passes all imports to plugin integration', async () => {
      const context = createImportContext();

      const commonImports = 'import { FluentBuilderBase } from "./common.js";';
      const nodeImports = ['import { EventEmitter } from "events";'];
      const typeImports = 'import type { User } from "./types.js";';
      const moduleImports = ['import type * as React from "react";'];

      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: true,
        value: commonImports,
      });

      mockNodeJSGenerator.generateNodeJSImports.mockReturnValue(nodeImports);

      mockTypeGenerator.generateTypeImports.mockReturnValue({
        ok: true,
        value: typeImports,
      });

      mockPackageResolver.generateModuleImports.mockReturnValue({
        ok: true,
        value: moduleImports,
      });

      await generator.generateAllImports(context);

      expect(mockPluginIntegration.processPluginImports).toHaveBeenCalledWith(
        expect.arrayContaining([commonImports, ...nodeImports, typeImports, ...moduleImports]),
        context.resolvedType,
        context.config,
      );
    });

    test('handles missing common imports gracefully', async () => {
      const context = createImportContext();

      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: true,
        value: '', // Empty common imports
      });

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toContain('undefined');
      }
    });

    test('handles empty Node.js imports', async () => {
      const context = createImportContext();

      mockNodeJSGenerator.generateNodeJSImports.mockReturnValue([]);

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(true);
      expect(mockTypeGenerator.generateTypeImports).toHaveBeenCalled();
    });

    test('handles type import generation errors', async () => {
      const context = createImportContext();

      mockTypeGenerator.generateTypeImports.mockReturnValue({
        ok: false,
        error: new Error('Type import generation failed'),
      });

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Type import generation failed');
      }
    });

    test('handles module import generation errors', async () => {
      const context = createImportContext();

      mockTypeGenerator.generateTypeImports.mockReturnValue({
        ok: true,
        value: 'import type { User } from "./types.js";',
      });

      mockPackageResolver.generateModuleImports.mockReturnValue({
        ok: false,
        error: new Error('Module import generation failed'),
      });

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Module import generation failed');
      }
    });

    test('handles plugin processing errors', async () => {
      const context = createImportContext();

      mockPluginIntegration.processPluginImports.mockResolvedValue({
        ok: false,
        error: new Error('Plugin processing failed'),
      });

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Plugin processing failed');
      }
    });

    test('handles common import generation errors', async () => {
      const context = createImportContext();

      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: false,
        error: new Error('Common import generation failed'),
      });

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Common import generation failed');
      }
    });

    test('validates input parameters', async () => {
      const result = await generator.generateAllImports({
        resolvedType: null as any,
        config: null as any,
      });

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid resolved type or configuration');
      }
    });

    test('handles complex real-world scenario with mixed imports', async () => {
      const context = createImportContext({
        resolvedType: createResolvedType('APIResponse', '/project/src/api.ts', {
          kind: TypeKind.Object,
          properties: [
            {
              name: 'emitter',
              type: { kind: TypeKind.Primitive, name: 'EventEmitter' },
              optional: false,
              readonly: false,
            },
            {
              name: 'user',
              type: {
                kind: TypeKind.Object,
                name: 'User',
                properties: [],
                sourceFile: '/project/src/user.ts',
              },
              optional: false,
              readonly: false,
            },
          ],
        }),
        config: {
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          commonImportPath: './common.js',
          outputDir: '/project/dist',
          pluginManager: {
            getRequiredImports: () => ({
              toImportStatements: () => ['import { plugin } from "my-plugin";'],
            }),
            executeHook: async () => ({ ok: true, value: { imports: [] } }),
          } as any,
        },
      });

      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: true,
        value: `import type {
  FluentBuilder,
  BaseBuildContext,
} from "./common.js";
import {
  FluentBuilderBase,
  createInspectMethod
} from "./common.js";`,
      });

      mockNodeJSGenerator.generateNodeJSImports.mockReturnValue([
        'import { EventEmitter } from "events";',
      ]);

      mockTypeGenerator.generateTypeImports.mockReturnValue({
        ok: true,
        value: `import type { APIResponse } from "/project/dist/api.js";
import type { User } from "/project/dist/user.js";`,
      });

      mockPackageResolver.generateModuleImports.mockReturnValue({
        ok: true,
        value: [],
      });

      const result = await generator.generateAllImports(context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('FluentBuilder');
        expect(result.value).toContain('FluentBuilderBase');
        expect(result.value).toContain('EventEmitter');
        expect(result.value).toContain('APIResponse');
        expect(result.value).toContain('User');
      }
    });

    test('preserves named imports by checking shouldPreserveNamedImports', async () => {
      const context = createImportContext({
        resolvedType: createResolvedType(
          'User',
          '/project/src/user.ts',
          {
            kind: TypeKind.Object,
            properties: [],
          },
          ['react', 'lodash'],
        ),
      });

      mockPackageResolver.shouldPreserveNamedImports
        .mockReturnValueOnce(true) // For react
        .mockReturnValueOnce(false); // For lodash

      const mockExtractModules = vi.mocked(
        await import('../utils/deduplication.js'),
      ).extractModulesFromNamedImports;
      mockExtractModules.mockReturnValue(new Set());

      await generator.generateAllImports(context);

      // Should add react to excluded modules
      expect(mockPackageResolver.generateModuleImports).toHaveBeenCalledWith(
        context.resolvedType,
        expect.objectContaining({
          has: expect.any(Function),
        }),
      );
    });
  });

  describe('individual method delegation', () => {
    test('generateNodeJSImports delegates correctly', () => {
      const resolvedType = createResolvedType();
      mockNodeJSGenerator.generateNodeJSImports.mockReturnValue(['import { fs } from "node:fs";']);

      const result = generator.generateNodeJSImports(resolvedType);

      expect(mockNodeJSGenerator.generateNodeJSImports).toHaveBeenCalledWith(resolvedType);
      expect(result).toEqual(['import { fs } from "node:fs";']);
    });

    test('generateCommonImports delegates correctly', () => {
      const config = createImportContext().config;
      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: true,
        value: 'common imports',
      });

      const result = generator.generateCommonImports(config);

      expect(mockCommonGenerator.generateCommonImports).toHaveBeenCalledWith(config);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('common imports');
      }
    });

    test('generateTypeImports delegates correctly', () => {
      const resolvedType = createResolvedType();
      const outputDir = '/project/dist';

      mockTypeGenerator.generateTypeImports.mockReturnValue({
        ok: true,
        value: 'type imports',
      });

      const result = generator.generateTypeImports(resolvedType, outputDir);

      expect(mockTypeGenerator.generateTypeImports).toHaveBeenCalledWith(resolvedType, outputDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('type imports');
      }
    });

    test('generateModuleImports delegates correctly', () => {
      const resolvedType = createResolvedType();
      const excludeModules = new Set(['react']);

      mockPackageResolver.generateModuleImports.mockReturnValue({
        ok: true,
        value: ['import type * as Lodash from "lodash";'],
      });

      const result = generator.generateModuleImports(resolvedType, excludeModules);

      expect(mockPackageResolver.generateModuleImports).toHaveBeenCalledWith(
        resolvedType,
        excludeModules,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('import type * as Lodash from "lodash";');
      }
    });

    test('generateCommonImports handles errors', () => {
      const config = createImportContext().config;
      mockCommonGenerator.generateCommonImports.mockReturnValue({
        ok: false,
        error: new Error('Common generation failed'),
      });

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toBe('Common generation failed');
      }
    });

    test('generateModuleImports handles errors', () => {
      const resolvedType = createResolvedType();

      mockPackageResolver.generateModuleImports.mockReturnValue({
        ok: false,
        error: new Error('Module generation failed'),
      });

      const result = generator.generateModuleImports(resolvedType);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toBe('Module generation failed');
      }
    });
  });

  describe('dispose', () => {
    test('disposes type generator', () => {
      generator.dispose();
      expect(mockTypeGenerator.dispose).toHaveBeenCalled();
    });
  });

  // Helper functions
  function createImportContext(
    overrides: Partial<ImportGenerationContext> = {},
  ): ImportGenerationContext {
    return {
      resolvedType: createResolvedType(),
      config: {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: './common.js',
        outputDir: '/project/dist',
      },
      ...overrides,
    };
  }

  function createResolvedType(
    name = 'TestType',
    sourceFile = '/project/src/types.ts',
    typeInfo: ResolvedType['typeInfo'] = { kind: TypeKind.Primitive as const, name: 'string' },
    imports: string[] = [],
  ): ResolvedType {
    return {
      name,
      sourceFile,
      typeInfo,
      imports,
      dependencies: [],
    };
  }
});
