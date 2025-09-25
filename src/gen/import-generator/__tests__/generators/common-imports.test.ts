import { describe, test, expect, beforeEach } from 'vitest';
import { CommonImportsGenerator } from '../../generators/common-imports.js';
import type { ImportGeneratorConfig } from '../../types.js';
import { isErr } from '../../../../core/result.js';

describe('CommonImportsGenerator', () => {
  let generator: CommonImportsGenerator;

  beforeEach(() => {
    generator = new CommonImportsGenerator();
  });

  describe('generateCommonImports', () => {
    test('generates imports when isGeneratingMultiple is true', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: './common.js',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchInlineSnapshot(`
          "import type {
            FluentBuilder,
            BaseBuildContext,
          } from "./common.js";
          import {
            FluentBuilderBase,
            createInspectMethod
          } from "./common.js";"
        `);
      }
    });

    test('generates imports when hasExistingCommon is true (single file mode)', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: false,
        hasExistingCommon: true,
        commonImportPath: '../common.js',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchInlineSnapshot(`
          "import type {
            FluentBuilder,
            BaseBuildContext,
          } from "../common.js";
          import {
            FluentBuilderBase,
            createInspectMethod
          } from "../common.js";"
        `);
      }
    });

    test('returns empty string when neither condition is met', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: false,
        hasExistingCommon: false,
        commonImportPath: './common.js',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('');
      }
    });

    test('handles various common import paths correctly', () => {
      const testCases = [
        './common.js',
        '../shared/common.js',
        '@company/common',
        '/absolute/path/common.js',
      ];

      for (const path of testCases) {
        const config: ImportGeneratorConfig = {
          isGeneratingMultiple: true,
          hasExistingCommon: false,
          commonImportPath: path,
          outputDir: './dist',
        };

        const result = generator.generateCommonImports(config);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toContain(`from "${path}";`);
        }
      }
    });

    test('validates common import path', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: '',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid common import path');
      }
    });

    test('validates common import path for null/undefined', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: null as any,
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid common import path');
      }
    });

    test('validates common import path for whitespace-only string', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: '   ',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid common import path');
      }
    });

    test('generates correct import structure', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: './common.js',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const lines = result.value.split('\n');

        // Should have exactly the expected structure
        expect(lines).toStrictEqual([
          'import type {',
          '  FluentBuilder,',
          '  BaseBuildContext,',
          '} from "./common.js";',
          'import {',
          '  FluentBuilderBase,',
          '  createInspectMethod',
          '} from "./common.js";',
        ]);
      }
    });

    test('handles plugin manager in config (should not affect output)', () => {
      const mockPluginManager = {
        getRequiredImports: () => ({ toImportStatements: () => [] }),
        executeHook: async () => ({ ok: true, value: { imports: [] } }),
      } as any;

      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: './common.js',
        outputDir: './dist',
        pluginManager: mockPluginManager,
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Plugin manager should not affect common imports generation
        expect(result.value).toContain('FluentBuilder,');
        expect(result.value).toContain('FluentBuilderBase,');
      }
    });

    test('both conditions true still generates imports', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: true,
        commonImportPath: './common.js',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('FluentBuilder,');
        expect(result.value).toContain('FluentBuilderBase,');
      }
    });

    test('handles edge case with hasExistingCommon undefined', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: false,
        hasExistingCommon: false,
        commonImportPath: './common.js',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('');
      }
    });

    test('handles scoped package import paths', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: '@company/fluent-builder',
        outputDir: './dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchInlineSnapshot(`
          "import type {
            FluentBuilder,
            BaseBuildContext,
          } from "@company/fluent-builder";
          import {
            FluentBuilderBase,
            createInspectMethod
          } from "@company/fluent-builder";"
        `);
      }
    });

    test('catches and wraps unexpected errors', () => {
      // Create a config that causes validation to fail
      const config = {
        isGeneratingMultiple: true,
        hasExistingCommon: false,
        commonImportPath: null as any, // This will cause validation error
        outputDir: '/project/dist',
      };

      const result = generator.generateCommonImports(config);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid common import path');
      }
    });
  });
});
