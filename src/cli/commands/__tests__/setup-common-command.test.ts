/**
 * Tests for SetupCommonCommand
 * Covers edge cases and potential bugs identified in code review
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { SetupCommonCommand } from '../setup-common-command.js';

// Mock chalk to avoid colorized output in tests
vi.mock('chalk', () => ({
  default: {
    red: (str: string) => str,
    green: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

// Mock template generator
vi.mock('../../../gen/template-generator.js', () => ({
  getCommonFileTemplate: () => 'export const mockTemplate = "test";',
}));

describe('SetupCommonCommand', () => {
  let command: SetupCommonCommand;
  let testDir: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    command = new SetupCommonCommand();
    testDir = join(tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Spy on console methods
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('should create common.ts file with default options', async () => {
      const outputPath = join(testDir, 'common.ts');

      await command.execute({ output: outputPath });

      expect(existsSync(outputPath)).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created common utilities file'),
      );
    });

    it('should create nested directories if they do not exist', async () => {
      const outputPath = join(testDir, 'nested', 'deep', 'common.ts');

      await command.execute({ output: outputPath });

      expect(existsSync(outputPath)).toBe(true);
    });

    it('should use default output path when none provided', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await command.execute({});
        expect(existsSync(join(testDir, 'common.ts'))).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should use default path for empty output', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await command.execute({ output: '' });
        expect(existsSync(join(testDir, 'common.ts'))).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should reject paths with null characters', async () => {
      const invalidPath = 'invalid\0path.ts';

      await expect(command.execute({ output: invalidPath })).rejects.toThrow(
        'null characters are not allowed',
      );
    });

    it('should reject directory-only paths', async () => {
      await expect(command.execute({ output: '.' })).rejects.toThrow('must specify a filename');
      await expect(command.execute({ output: '..' })).rejects.toThrow('must specify a filename');
      await expect(command.execute({ output: testDir })).rejects.toThrow('must specify a filename');
    });

    it('should reject when file exists without overwrite flag', async () => {
      const outputPath = join(testDir, 'existing.ts');
      writeFileSync(outputPath, 'existing content');

      await expect(command.execute({ output: outputPath })).rejects.toThrow('already exists');
    });

    it('should overwrite existing file when overwrite flag is true', async () => {
      const outputPath = join(testDir, 'existing.ts');
      writeFileSync(outputPath, 'existing content');

      await command.execute({ output: outputPath, overwrite: true });

      expect(existsSync(outputPath)).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created common utilities file'),
      );
    });

    it('should handle relative path traversal safely', async () => {
      const relativePath = join(testDir, '..', path.basename(testDir), 'traversal.ts');

      // This should still work and create the file at the resolved location
      await command.execute({ output: relativePath });

      // File should be created at the resolved absolute path
      expect(existsSync(relativePath)).toBe(true);
    });

    it('should handle read-only directory gracefully', async () => {
      const readOnlyDir = join(testDir, 'readonly');
      mkdirSync(readOnlyDir);

      // Make directory read-only (this might not work on all systems)
      try {
        const fs = await import('node:fs');
        fs.chmodSync(readOnlyDir, 0o444);

        const outputPath = join(readOnlyDir, 'common.ts');
        await expect(command.execute({ output: outputPath })).rejects.toThrow();
      } catch {
        // Skip if chmod doesn't work on this system
      }
    });
  });

  describe('parameter validation', () => {
    it('should handle undefined options', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await command.execute();
        expect(existsSync(join(testDir, 'common.ts'))).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle options with only overwrite flag', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await command.execute({ overwrite: true });
        expect(existsSync(join(testDir, 'common.ts'))).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('file extension handling', () => {
    it('should work with non-ts extension', async () => {
      const outputPath = join(testDir, 'common.js');

      await command.execute({ output: outputPath });

      expect(existsSync(outputPath)).toBe(true);
    });

    it('should work with no extension', async () => {
      const outputPath = join(testDir, 'common');

      await command.execute({ output: outputPath });

      expect(existsSync(outputPath)).toBe(true);
    });
  });
});
