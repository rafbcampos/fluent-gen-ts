/**
 * Tests for DiscoveryService
 * Verifies file discovery, pattern validation, and interface extraction functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from '../discovery-service.js';
import { isOk } from '../../../core/result.js';
import type { MockedFunction } from 'vitest';

// Mock dependencies
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

vi.mock('../../../type-info/index.js', () => ({
  TypeExtractor: vi.fn().mockImplementation(() => ({
    scanFile: vi.fn(),
  })),
}));

vi.mock('../../../core/result.js', () => ({
  isOk: vi.fn(),
}));

describe('DiscoveryService', () => {
  let discoveryService: DiscoveryService;
  let mockGlob: MockedFunction<typeof import('glob').glob>;
  let mockScanFile: MockedFunction<
    (file: string) => Promise<{ ok: boolean; value?: string[]; error?: string }>
  >;
  let mockIsOk: MockedFunction<typeof import('../../../core/result.js').isOk>;

  beforeEach(async () => {
    vi.clearAllMocks();
    discoveryService = new DiscoveryService();

    // Get the mocked functions
    const { glob } = await import('glob');
    mockGlob = vi.mocked(glob);

    mockIsOk = vi.mocked(isOk);
    mockScanFile = (
      discoveryService as unknown as {
        typeExtractor: {
          scanFile: MockedFunction<
            (file: string) => Promise<{ ok: boolean; value?: string[]; error?: string }>
          >;
        };
      }
    ).typeExtractor.scanFile;
  });

  describe('discoverFiles', () => {
    it('should discover TypeScript files from glob patterns', async () => {
      const patterns = ['src/**/*.ts', 'lib/**/*.ts'];
      const globResults: string[][] = [
        ['src/file1.ts', 'src/file2.js', 'src/file3.ts'],
        ['lib/file4.ts', 'lib/file5.tsx'],
      ];

      mockGlob.mockResolvedValueOnce(globResults[0]!).mockResolvedValueOnce(globResults[1]!);

      const result = await discoveryService.discoverFiles(patterns);

      expect(result).toEqual(
        ['lib/file4.ts', 'lib/file5.tsx', 'src/file1.ts', 'src/file3.ts'].sort(),
      );
      expect(mockGlob).toHaveBeenCalledTimes(2);
      expect(mockGlob).toHaveBeenCalledWith('src/**/*.ts');
      expect(mockGlob).toHaveBeenCalledWith('lib/**/*.ts');
    });

    it('should include both .ts and .tsx files', async () => {
      const patterns = ['src/**/*'];
      mockGlob.mockResolvedValue(['file1.ts', 'file2.tsx', 'file3.js', 'file4.ts']);

      const result = await discoveryService.discoverFiles(patterns);

      expect(result).toEqual(['file1.ts', 'file2.tsx', 'file4.ts']);
    });

    it('should handle empty patterns array', async () => {
      const result = await discoveryService.discoverFiles([]);
      expect(result).toEqual([]);
      expect(mockGlob).not.toHaveBeenCalled();
    });

    it('should trim whitespace from patterns', async () => {
      const patterns = ['  src/**/*.ts  ', '\tlib/**/*.ts\n'];
      mockGlob.mockResolvedValue(['file1.ts']);

      await discoveryService.discoverFiles(patterns);

      expect(mockGlob).toHaveBeenCalledWith('src/**/*.ts');
      expect(mockGlob).toHaveBeenCalledWith('lib/**/*.ts');
    });

    it('should handle glob errors gracefully', async () => {
      const patterns = ['invalid-pattern', 'valid/**/*.ts'];
      mockGlob
        .mockRejectedValueOnce(new Error('Invalid glob pattern'))
        .mockResolvedValueOnce(['file1.ts']);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await discoveryService.discoverFiles(patterns);

      expect(result).toEqual(['file1.ts']);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: Failed to process pattern "invalid-pattern": Invalid glob pattern',
      );

      consoleSpy.mockRestore();
    });

    it('should deduplicate files from multiple patterns', async () => {
      const patterns = ['src/**/*.ts', 'src/specific/*.ts'];
      mockGlob
        .mockResolvedValueOnce(['src/file1.ts', 'src/specific/file2.ts'])
        .mockResolvedValueOnce(['src/specific/file2.ts', 'src/specific/file3.ts']);

      const result = await discoveryService.discoverFiles(patterns);

      expect(result).toEqual(
        ['src/file1.ts', 'src/specific/file2.ts', 'src/specific/file3.ts'].sort(),
      );
    });
  });

  describe('discoverInterfaces', () => {
    it('should extract interfaces from TypeScript files', async () => {
      const files = ['file1.ts', 'file2.ts'];
      const scanResults: string[][] = [['Interface1', 'Interface2'], ['Interface3']];

      mockScanFile
        .mockResolvedValueOnce({ ok: true, value: scanResults[0]! })
        .mockResolvedValueOnce({ ok: true, value: scanResults[1]! });

      mockIsOk.mockReturnValueOnce(true).mockReturnValueOnce(true);

      const result = await discoveryService.discoverInterfaces(files);

      expect(result).toEqual([
        { file: 'file1.ts', name: 'Interface1', displayName: 'file1.ts:Interface1' },
        { file: 'file1.ts', name: 'Interface2', displayName: 'file1.ts:Interface2' },
        { file: 'file2.ts', name: 'Interface3', displayName: 'file2.ts:Interface3' },
      ]);
    });

    it('should handle scan failures gracefully', async () => {
      const files = ['file1.ts', 'file2.ts'];
      mockScanFile
        .mockRejectedValueOnce(new Error('Scan failed'))
        .mockResolvedValueOnce({ ok: true, value: ['Interface1'] });

      mockIsOk.mockReturnValue(true);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await discoveryService.discoverInterfaces(files);

      expect(result).toEqual([
        { file: 'file2.ts', name: 'Interface1', displayName: 'file2.ts:Interface1' },
      ]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: Failed to scan file "file1.ts": Scan failed',
      );

      consoleSpy.mockRestore();
    });

    it('should handle unsuccessful scan results', async () => {
      const files = ['file1.ts'];
      mockScanFile.mockResolvedValue({ ok: false, error: 'Parse error' });
      mockIsOk.mockReturnValue(false);

      const result = await discoveryService.discoverInterfaces(files);

      expect(result).toEqual([]);
    });

    it('should handle empty files array', async () => {
      const result = await discoveryService.discoverInterfaces([]);
      expect(result).toEqual([]);
      expect(mockScanFile).not.toHaveBeenCalled();
    });
  });

  describe('discoverAll', () => {
    it('should combine file discovery and interface extraction', async () => {
      const patterns = ['src/**/*.ts'];
      mockGlob.mockResolvedValue(['file1.ts']);
      mockScanFile.mockResolvedValue({ ok: true, value: ['Interface1'] });
      mockIsOk.mockReturnValue(true);

      const result = await discoveryService.discoverAll(patterns);

      expect(result.files).toEqual(['file1.ts']);
      expect(result.interfaces).toEqual([
        { file: 'file1.ts', name: 'Interface1', displayName: 'file1.ts:Interface1' },
      ]);
    });
  });

  describe('validatePatterns', () => {
    it('should validate patterns containing .ts', () => {
      const patterns = ['src/**/*.ts', 'invalid-pattern', 'lib/*.ts'];
      const result = discoveryService.validatePatterns(patterns);

      expect(result.valid).toEqual(['src/**/*.ts', 'lib/*.ts']);
      expect(result.invalid).toEqual(['invalid-pattern']);
    });

    it('should validate patterns containing wildcards', () => {
      const patterns = ['src/**/*', 'src/specific/*', 'invalid-pattern'];
      const result = discoveryService.validatePatterns(patterns);

      expect(result.valid).toEqual(['src/**/*', 'src/specific/*']);
      expect(result.invalid).toEqual(['invalid-pattern']);
    });

    it('should handle empty and whitespace-only patterns', () => {
      const patterns = ['', '  ', '\t', 'src/**/*.ts'];
      const result = discoveryService.validatePatterns(patterns);

      expect(result.valid).toEqual(['src/**/*.ts']);
      expect(result.invalid).toEqual([]);
    });

    it('should trim patterns before validation', () => {
      const patterns = ['  src/**/*.ts  ', '\tlib/**/*\n'];
      const result = discoveryService.validatePatterns(patterns);

      expect(result.valid).toEqual(['src/**/*.ts', 'lib/**/*']);
      expect(result.invalid).toEqual([]);
    });

    it('should properly validate glob patterns and TypeScript file patterns', () => {
      const patterns = [
        'src/file.json',
        'config.yaml',
        '**/*.{ts,tsx}',
        'src/index',
        'src/**/*.ts',
        '*.tsx',
      ];
      const result = discoveryService.validatePatterns(patterns);

      expect(result.valid).toEqual(['**/*.{ts,tsx}', 'src/**/*.ts', '*.tsx']);
      expect(result.invalid).toEqual(['src/file.json', 'config.yaml', 'src/index']);
    });
  });

  describe('parsePatterns', () => {
    it('should parse comma-separated patterns', () => {
      const input = 'src/**/*.ts,lib/**/*.ts,test/**/*.ts';
      const result = discoveryService.parsePatterns(input);

      expect(result).toEqual(['src/**/*.ts', 'lib/**/*.ts', 'test/**/*.ts']);
    });

    it('should trim whitespace from parsed patterns', () => {
      const input = ' src/**/*.ts , lib/**/*.ts , test/**/*.ts ';
      const result = discoveryService.parsePatterns(input);

      expect(result).toEqual(['src/**/*.ts', 'lib/**/*.ts', 'test/**/*.ts']);
    });

    it('should filter out empty patterns', () => {
      const input = 'src/**/*.ts,,lib/**/*.ts,';
      const result = discoveryService.parsePatterns(input);

      expect(result).toEqual(['src/**/*.ts', 'lib/**/*.ts']);
    });

    it('should handle empty input', () => {
      const result = discoveryService.parsePatterns('');
      expect(result).toEqual([]);
    });

    it('should handle single pattern without commas', () => {
      const input = 'src/**/*.ts';
      const result = discoveryService.parsePatterns(input);

      expect(result).toEqual(['src/**/*.ts']);
    });
  });
});
