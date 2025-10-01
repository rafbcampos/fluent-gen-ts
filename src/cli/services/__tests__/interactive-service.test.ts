import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import inquirer from 'inquirer';
import { InteractiveService } from '../interactive-service.js';
import type { DiscoveredInterface } from '../discovery-service.js';

type SeparatorInstance = InstanceType<typeof inquirer.Separator>;

describe('InteractiveService', () => {
  let service: InteractiveService;
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new InteractiveService();
    testDir = join(process.cwd(), 'test-temp', `interactive-service-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    consoleLogSpy.mockRestore();
  });

  describe('groupInterfacesByFile', () => {
    it('should handle empty interfaces array', () => {
      const result = (service as any).groupInterfacesByFile([]);
      expect(result).toEqual([]);
    });

    it('should group interfaces by file correctly', () => {
      const interfaces: DiscoveredInterface[] = [
        {
          name: 'Interface1',
          file: 'file1.ts',
          displayName: 'file1.ts:Interface1',
        },
        {
          name: 'Interface2',
          file: 'file1.ts',
          displayName: 'file1.ts:Interface2',
        },
        {
          name: 'Interface3',
          file: 'file2.ts',
          displayName: 'file2.ts:Interface3',
        },
      ];

      const result = (service as any).groupInterfacesByFile(interfaces);

      // Verify the structure is correct and doesn't cause runtime errors
      expect(result.length).toBeGreaterThan(0);

      // Check that file separators are included
      const separators = result.filter(
        (
          item: SeparatorInstance | { name: string; value: DiscoveredInterface },
        ): item is SeparatorInstance => item instanceof inquirer.Separator,
      );
      expect(separators.length).toBeGreaterThan(0);

      // Check that interface choices are included
      const choices = result.filter(
        (
          item: SeparatorInstance | { name: string; value: DiscoveredInterface },
        ): item is { name: string; value: DiscoveredInterface } =>
          !(item instanceof inquirer.Separator) && 'name' in item && 'value' in item,
      );
      expect(choices.length).toBe(3); // Three interfaces
    });

    it('should handle interfaces with duplicate file names', () => {
      const interfaces: DiscoveredInterface[] = [
        {
          name: 'Interface1',
          file: 'same-file.ts',
          displayName: 'same-file.ts:Interface1',
        },
        {
          name: 'Interface2',
          file: 'same-file.ts',
          displayName: 'same-file.ts:Interface2',
        },
      ];

      // This should not throw an error even with the non-null assertion
      const result = (service as any).groupInterfacesByFile(interfaces);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('askInterfaceSelection', () => {
    it('should throw error when no interfaces provided', async () => {
      await expect(service.askInterfaceSelection([])).rejects.toThrow(
        'No interfaces found in the specified files.',
      );
    });
  });

  describe('parseCommaSeparatedInput', () => {
    it('should parse comma-separated values correctly', () => {
      const input = 'path1, path2, path3';
      const result = (service as any).parseCommaSeparatedInput(input);

      expect(result).toEqual(['path1', 'path2', 'path3']);
    });

    it('should trim whitespace from values', () => {
      const input = '  path1  ,  path2  ,  path3  ';
      const result = (service as any).parseCommaSeparatedInput(input);

      expect(result).toEqual(['path1', 'path2', 'path3']);
    });

    it('should filter out empty values', () => {
      const input = 'path1,,path2,,,path3';
      const result = (service as any).parseCommaSeparatedInput(input);

      expect(result).toEqual(['path1', 'path2', 'path3']);
    });

    it('should handle single value without commas', () => {
      const input = 'single-path';
      const result = (service as any).parseCommaSeparatedInput(input);

      expect(result).toEqual(['single-path']);
    });

    it('should return empty array for empty string', () => {
      const input = '';
      const result = (service as any).parseCommaSeparatedInput(input);

      expect(result).toEqual([]);
    });

    it('should handle values with special characters', () => {
      const input = './src/**/*.ts, ../lib/**/*.ts';
      const result = (service as any).parseCommaSeparatedInput(input);

      expect(result).toEqual(['./src/**/*.ts', '../lib/**/*.ts']);
    });
  });

  describe('validatePaths', () => {
    it('should return true when all paths pass validation', () => {
      const paths = [testDir];
      const validateFn = (path: string) => existsSync(path);
      const result = (service as any).validatePaths(paths, validateFn, 'Path not found');

      expect(result).toBe(true);
    });

    it('should return error message when validation fails', () => {
      const nonExistentPath = join(testDir, 'non-existent');
      const paths = [nonExistentPath];
      const validateFn = (path: string) => existsSync(path);
      const result = (service as any).validatePaths(paths, validateFn, 'Path not found');

      expect(result).toBe(`Path not found: ${nonExistentPath}`);
    });

    it('should return error message for first failing path', () => {
      const existingPath = testDir;
      const nonExistentPath1 = join(testDir, 'non-existent-1');
      const nonExistentPath2 = join(testDir, 'non-existent-2');
      const paths = [existingPath, nonExistentPath1, nonExistentPath2];
      const validateFn = (path: string) => existsSync(path);
      const result = (service as any).validatePaths(paths, validateFn, 'Path not found');

      expect(result).toBe(`Path not found: ${nonExistentPath1}`);
    });

    it('should return error message when paths array is empty', () => {
      const paths: string[] = [];
      const validateFn = () => true;
      const result = (service as any).validatePaths(paths, validateFn, 'Error');

      expect(result).toBe('Please provide at least one path.');
    });

    it('should validate multiple paths successfully', () => {
      const dir1 = join(testDir, 'dir1');
      const dir2 = join(testDir, 'dir2');
      mkdirSync(dir1, { recursive: true });
      mkdirSync(dir2, { recursive: true });

      const paths = [dir1, dir2];
      const validateFn = (path: string) => existsSync(path);
      const result = (service as any).validatePaths(paths, validateFn, 'Path not found');

      expect(result).toBe(true);
    });
  });

  describe('ensureStringArray', () => {
    it('should return array as-is when all elements are strings', () => {
      const input = ['path1', 'path2', 'path3'];
      const result = (service as any).ensureStringArray(input);

      expect(result).toEqual(['path1', 'path2', 'path3']);
    });

    it('should filter out non-string elements from array', () => {
      const input = ['path1', 123, 'path2', null, 'path3', undefined];
      const result = (service as any).ensureStringArray(input);

      expect(result).toEqual(['path1', 'path2', 'path3']);
    });

    it('should convert single string to array', () => {
      const input = 'single-path';
      const result = (service as any).ensureStringArray(input);

      expect(result).toEqual(['single-path']);
    });

    it('should return empty array for null', () => {
      const input = null;
      const result = (service as any).ensureStringArray(input);

      expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const input = undefined;
      const result = (service as any).ensureStringArray(input);

      expect(result).toEqual([]);
    });

    it('should return empty array for number', () => {
      const input = 123;
      const result = (service as any).ensureStringArray(input);

      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const input: unknown[] = [];
      const result = (service as any).ensureStringArray(input);

      expect(result).toEqual([]);
    });
  });

  describe('showFileNamePreview', () => {
    it('should display file name preview with kebab-case convention', () => {
      service.showFileNamePreview({
        convention: 'kebab-case',
        suffix: 'builder',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('user-profile.builder.ts'),
      );
    });

    it('should display file name preview with camelCase convention', () => {
      service.showFileNamePreview({
        convention: 'camelCase',
        suffix: 'builder',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('userProfile.builder.ts'));
    });

    it('should display file name preview with snake_case convention', () => {
      service.showFileNamePreview({
        convention: 'snake_case',
        suffix: 'builder',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('user_profile.builder.ts'),
      );
    });

    it('should display file name preview with PascalCase convention', () => {
      service.showFileNamePreview({
        convention: 'PascalCase',
        suffix: 'builder',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('UserProfile.builder.ts'));
    });

    it('should include emoji in preview', () => {
      service.showFileNamePreview({
        convention: 'kebab-case',
        suffix: 'builder',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📝'));
    });

    it('should respect custom suffix', () => {
      service.showFileNamePreview({
        convention: 'kebab-case',
        suffix: 'factory',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('.factory.ts'));
    });
  });
});
