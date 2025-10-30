import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ConfigLoader } from '../../config.js';

describe('ConfigLoader', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
  });

  describe('load', () => {
    test('handles missing config gracefully', async () => {
      const mockExplorer = {
        search: vi.fn().mockResolvedValue(null),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = await loader.load();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({});
      }
    });

    test('handles invalid config object', async () => {
      const mockExplorer = {
        search: vi.fn().mockResolvedValue({
          config: { invalid: 'property' },
        }),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = await loader.load();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid configuration');
      }
    });

    test('handles explorer error when specific path provided', async () => {
      const mockExplorer = {
        search: vi.fn(),
        load: vi.fn().mockRejectedValue(new Error('File not found')),
      };
      (loader as any).explorer = mockExplorer;

      const result = await loader.load('/nonexistent/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to load configuration');
      }
    });

    test('handles non-Error thrown objects', async () => {
      const mockExplorer = {
        search: vi.fn(),
        load: vi.fn().mockRejectedValue('string error'),
      };
      (loader as any).explorer = mockExplorer;

      const result = await loader.load('/some/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to load configuration: string error');
      }
    });

    test('handles valid config', async () => {
      const validConfig = {
        outputDir: './output',
        useDefaults: true,
      };
      const mockExplorer = {
        search: vi.fn().mockResolvedValue({
          config: { generator: validConfig },
        }),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = await loader.load();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.generator).toEqual(validConfig);
      }
    });

    test('extracts default export from ES module config', async () => {
      const validConfig = {
        generator: {
          naming: {
            transform: '(typeName) => typeName.toLowerCase()',
          },
        },
        targets: [{ file: 'test.ts' }],
      };
      // Simulate what cosmiconfig returns for ES module exports
      const mockExplorer = {
        search: vi.fn().mockResolvedValue({
          config: {
            __esModule: true,
            default: validConfig,
          },
        }),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = await loader.load();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(validConfig);
        expect(result.value.generator?.naming?.transform).toBe(
          '(typeName) => typeName.toLowerCase()',
        );
      }
    });

    test('handles config without default export', async () => {
      const validConfig = {
        generator: {
          naming: {
            convention: 'kebab-case',
          },
        },
        targets: [{ file: 'test.ts' }],
      };
      const mockExplorer = {
        search: vi.fn().mockResolvedValue({
          config: validConfig,
        }),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = await loader.load();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(validConfig);
      }
    });
  });

  describe('validate', () => {
    test('validates valid config', () => {
      const validConfig = {
        generator: { outputDir: './out' },
        targets: [{ file: 'test.ts' }],
      };

      const result = loader.validate(validConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(validConfig);
      }
    });

    test('rejects invalid config', () => {
      const invalidConfig = {
        generator: { invalidProp: 'value' },
      };

      const result = loader.validate(invalidConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid configuration');
      }
    });

    test('handles null/undefined input', () => {
      const result1 = loader.validate(null);
      const result2 = loader.validate(undefined);

      expect(result1.ok).toBe(false);
      expect(result2.ok).toBe(false);
    });

    test('validates config with naming.transform string expression', () => {
      const validConfig = {
        generator: {
          naming: {
            transform:
              "(typeName) => typeName.charAt(0).toLowerCase() + typeName.replace(/Asset$/, '').slice(1)",
          },
        },
        targets: [{ file: 'test.ts' }],
      };

      const result = loader.validate(validConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.generator?.naming?.transform).toBe(
          validConfig.generator.naming.transform,
        );
      }
    });

    test('validates config with naming.factoryTransform string expression', () => {
      const validConfig = {
        generator: {
          naming: {
            factoryTransform: "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()",
          },
        },
        targets: [{ file: 'test.ts' }],
      };

      const result = loader.validate(validConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.generator?.naming?.factoryTransform).toBe(
          validConfig.generator.naming.factoryTransform,
        );
      }
    });

    test('validates config with all naming options', () => {
      const validConfig = {
        generator: {
          naming: {
            convention: 'camelCase' as const,
            suffix: '.builder',
            transform: '(typeName) => typeName.toLowerCase()',
            factoryTransform: "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()",
          },
        },
        targets: [{ file: 'test.ts' }],
      };

      const result = loader.validate(validConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.generator?.naming).toEqual(validConfig.generator.naming);
      }
    });
  });
});
