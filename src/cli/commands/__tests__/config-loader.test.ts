import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ConfigLoader } from '../../config.js';

describe('ConfigLoader', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
  });

  describe('load', () => {
    test('handles missing config gracefully', () => {
      const mockExplorer = {
        search: vi.fn().mockReturnValue(null),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = loader.load();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({});
      }
    });

    test('handles invalid config object', () => {
      const mockExplorer = {
        search: vi.fn().mockReturnValue({
          config: { invalid: 'property' },
        }),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = loader.load();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid configuration');
      }
    });

    test('handles explorer error when specific path provided', () => {
      const mockExplorer = {
        search: vi.fn(),
        load: vi.fn().mockImplementation(() => {
          throw new Error('File not found');
        }),
      };
      (loader as any).explorer = mockExplorer;

      const result = loader.load('/nonexistent/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to load configuration');
      }
    });

    test('handles non-Error thrown objects', () => {
      const mockExplorer = {
        search: vi.fn(),
        load: vi.fn().mockImplementation(() => {
          throw 'string error';
        }),
      };
      (loader as any).explorer = mockExplorer;

      const result = loader.load('/some/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to load configuration: string error');
      }
    });

    test('handles valid config', () => {
      const validConfig = {
        outputDir: './output',
        useDefaults: true,
      };
      const mockExplorer = {
        search: vi.fn().mockReturnValue({
          config: { generator: validConfig },
        }),
        load: vi.fn(),
      };
      (loader as any).explorer = mockExplorer;

      const result = loader.load();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.generator).toEqual(validConfig);
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
  });
});
