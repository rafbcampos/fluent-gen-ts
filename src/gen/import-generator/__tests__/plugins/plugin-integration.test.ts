import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PluginIntegration } from '../../plugins/plugin-integration.js';
import type { ImportGeneratorConfig } from '../../types.js';
import type { ResolvedType } from '../../../../core/types.js';
import { TypeKind } from '../../../../core/types.js';
import { isErr } from '../../../../core/result.js';
import { HookType } from '../../../../core/plugin/index.js';
import { ImportParser } from '../../../../core/plugin/import-transformer.js';
import type { StructuredImport } from '../../../../core/plugin/plugin-types.js';

// Mock deduplication
vi.mock('../../utils/deduplication.js', () => {
  return {
    deduplicateImports: vi.fn(function (imports: string[]) {
      return [...new Set(imports)];
    }),
  };
});

// Helper function to parse import strings to structured imports for tests
function parseImportsForTest(importStrings: string[]): StructuredImport[] {
  return ImportParser.parseImports(importStrings);
}

describe('PluginIntegration', () => {
  let integration: PluginIntegration;
  let mockPluginManager: any;
  let mockResolvedType: ResolvedType;
  let mockConfig: ImportGeneratorConfig;

  beforeEach(() => {
    integration = new PluginIntegration();

    mockPluginManager = {
      getRequiredImports: vi.fn(() => ({
        toImportStatements: vi.fn(() => []),
      })),
      executeHook: vi.fn(),
    };

    mockResolvedType = {
      name: 'TestType',
      sourceFile: '/test/types.ts',
      typeInfo: { kind: TypeKind.Primitive, name: 'string' },
      imports: [],
      dependencies: [],
    };

    mockConfig = {
      isGeneratingMultiple: true,
      hasExistingCommon: false,
      commonImportPath: './common.js',
      outputDir: './dist',
      pluginManager: mockPluginManager,
    };
  });

  describe('processPluginImports', () => {
    test('returns base imports when no plugin manager', async () => {
      const baseImports = [
        'import type { User } from "./types.js";',
        'import { api } from "./api.js";',
      ];

      const { pluginManager: _, ...configWithoutPlugin } = mockConfig;

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        configWithoutPlugin,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(baseImports.join('\n'));
      }
    });

    test('adds plugin imports to base imports', async () => {
      const baseImports = ['import type { User } from "./types.js";'];
      const pluginImports = ['import { utility } from "plugin-utils";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => pluginImports,
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest([...baseImports, ...pluginImports]),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('import type { User } from "./types.js";');
        expect(result.value).toContain('import { utility } from "plugin-utils";');
      }
    });

    test('deduplicates imports after adding plugin imports', async () => {
      const baseImports = ['import type { User } from "./types.js";'];
      const pluginImports = ['import type { User } from "./types.js";']; // Duplicate

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => pluginImports,
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest(baseImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should only appear once after deduplication
        const lines = result.value.split('\n');
        const userImports = lines.filter(line => line.includes('User'));
        expect(userImports).toHaveLength(1);
      }
    });

    test('applies plugin transformations to imports', async () => {
      const baseImports = ['import type { User } from "./types.js";'];
      const transformedImports = ['import type { User, TransformedUser } from "./types.js";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => [],
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest(transformedImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('TransformedUser');
      }

      expect(mockPluginManager.executeHook).toHaveBeenCalledWith({
        hookType: HookType.TransformImports,
        input: expect.objectContaining({
          imports: parseImportsForTest(baseImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        }),
      });
    });

    test('deduplicates again after plugin transformations', async () => {
      const baseImports = ['import type { User } from "./types.js";'];
      const transformedImports = [
        'import type { User } from "./types.js";',
        'import type { User } from "./types.js";', // Plugin introduces duplicate
        'import type { Profile } from "./types.js";',
      ];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => [],
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest(transformedImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const lines = result.value.split('\n');
        const userImports = lines.filter(line => line.includes('User'));
        expect(userImports).toHaveLength(1);
      }
    });

    test('handles plugin transformation errors', async () => {
      const baseImports = ['import type { User } from "./types.js";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => [],
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: false,
        error: new Error('Plugin transformation failed'),
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Plugin transformation failed');
      }
    });

    test('handles plugin hook execution exceptions', async () => {
      const baseImports = ['import type { User } from "./types.js";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => [],
      });

      mockPluginManager.executeHook.mockRejectedValue(new Error('Hook execution error'));

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Failed to apply plugin transformations');
      }
    });

    test('handles plugin import collection errors gracefully', async () => {
      const baseImports = ['import type { User } from "./types.js";'];

      mockPluginManager.getRequiredImports.mockImplementation(() => {
        throw new Error('Plugin import collection error');
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Failed to process plugin imports');
      }
    });

    test('passes correct context to plugin transformations', async () => {
      const baseImports = ['import type { User } from "./types.js";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => [],
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest(baseImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const customConfig = {
        ...mockConfig,
        isGeneratingMultiple: false,
        hasExistingCommon: true,
      };

      await integration.processPluginImports(baseImports, mockResolvedType, customConfig);

      expect(mockPluginManager.executeHook).toHaveBeenCalledWith({
        hookType: HookType.TransformImports,
        input: expect.objectContaining({
          imports: parseImportsForTest(baseImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: false,
          hasExistingCommon: true,
          utils: expect.any(Object),
        }),
      });
    });

    test('handles complex plugin import scenarios', async () => {
      const baseImports = [
        'import type { User } from "./types.js";',
        'import { api } from "./api.js";',
      ];

      const pluginImports = [
        'import { pluginUtil } from "my-plugin";',
        'import type { PluginType } from "my-plugin";',
      ];

      const transformedImports = [
        'import type { User, EnhancedUser } from "./types.js";',
        'import { api, enhancedApi } from "./api.js";',
        'import { pluginUtil } from "my-plugin";',
        'import type { PluginType } from "my-plugin";',
      ];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => pluginImports,
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest(transformedImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('EnhancedUser');
        expect(result.value).toContain('enhancedApi');
        expect(result.value).toContain('pluginUtil');
        expect(result.value).toContain('PluginType');
      }
    });

    test('handles empty base imports', async () => {
      const baseImports: string[] = [];
      const pluginImports = ['import { utility } from "plugin-utils";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => pluginImports,
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest(pluginImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('import { utility } from "plugin-utils";');
      }
    });

    test('handles empty plugin imports', async () => {
      const baseImports = ['import type { User } from "./types.js";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => [],
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest(baseImports),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('import type { User } from "./types.js";');
      }
    });

    test('preserves import order after transformations', async () => {
      const baseImports = [
        'import type { User } from "./types.js";',
        'import { api } from "./api.js";',
      ];

      const pluginImports = ['import { utility } from "plugin-utils";'];

      mockPluginManager.getRequiredImports.mockReturnValue({
        toImportStatements: () => pluginImports,
      });

      mockPluginManager.executeHook.mockResolvedValue({
        ok: true,
        value: {
          imports: parseImportsForTest([...baseImports, ...pluginImports]),
          resolvedType: mockResolvedType,
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          utils: expect.any(Object),
        },
      });

      const result = await integration.processPluginImports(
        baseImports,
        mockResolvedType,
        mockConfig,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const lines = result.value.split('\n');
        expect(lines[0]).toContain('User');
        expect(lines[1]).toContain('api');
        expect(lines[2]).toContain('utility');
      }
    });
  });
});
