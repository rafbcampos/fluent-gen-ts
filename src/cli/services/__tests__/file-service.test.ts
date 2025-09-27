/**
 * Tests for FileService
 * Verifies file operations, configuration management, and path resolution functionality
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import { FileService } from '../file-service.js';
import type { Config } from '../../config.js';

// Mock file system operations
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('FileService', () => {
  let fileService: FileService;
  let mockWriteFile: ReturnType<typeof vi.fn>;
  let mockMkdir: ReturnType<typeof vi.fn>;
  let mockExistsSync: ReturnType<typeof vi.fn>;
  let mockWriteFileSync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fileService = new FileService();

    mockWriteFile = vi.mocked(writeFile);
    mockMkdir = vi.mocked(mkdir);
    mockExistsSync = vi.mocked(existsSync);
    mockWriteFileSync = vi.mocked(writeFileSync);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('writeOutput', () => {
    it('should create directory and write file', async () => {
      const outputPath = '/path/to/output.ts';
      const content = 'export const test = true;';

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await fileService.writeOutput(outputPath, content);

      expect(mockMkdir).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(outputPath, content, 'utf-8');
    });

    it('should handle directory creation failure', async () => {
      const outputPath = '/path/to/output.ts';
      const content = 'test content';
      const error = new Error('Permission denied');

      mockMkdir.mockRejectedValue(error);

      await expect(fileService.writeOutput(outputPath, content)).rejects.toThrow(error);
    });

    it('should handle file writing failure', async () => {
      const outputPath = '/path/to/output.ts';
      const content = 'test content';
      const error = new Error('Disk full');

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockRejectedValue(error);

      await expect(fileService.writeOutput(outputPath, content)).rejects.toThrow(error);
    });
  });

  describe('writeOutputBatch', () => {
    it('should write multiple files in parallel', async () => {
      const outputs = new Map([
        ['/path/to/file1.ts', 'content1'],
        ['/path/to/file2.ts', 'content2'],
        ['/path/to/file3.ts', 'content3'],
      ]);

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await fileService.writeOutputBatch(outputs);

      expect(mockWriteFile).toHaveBeenCalledTimes(3);
      expect(mockWriteFile).toHaveBeenCalledWith('/path/to/file1.ts', 'content1', 'utf-8');
      expect(mockWriteFile).toHaveBeenCalledWith('/path/to/file2.ts', 'content2', 'utf-8');
      expect(mockWriteFile).toHaveBeenCalledWith('/path/to/file3.ts', 'content3', 'utf-8');
    });

    it('should handle empty outputs map', async () => {
      const outputs = new Map<string, string>();

      await fileService.writeOutputBatch(outputs);

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockMkdir).not.toHaveBeenCalled();
    });

    it('should fail if any file write fails', async () => {
      const outputs = new Map([
        ['/path/to/file1.ts', 'content1'],
        ['/path/to/file2.ts', 'content2'],
      ]);
      const error = new Error('Write failed');

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);

      await expect(fileService.writeOutputBatch(outputs)).rejects.toThrow(error);
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', () => {
      mockExistsSync.mockReturnValue(true);

      const result = fileService.fileExists('/path/to/file.ts');

      expect(result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/path/to/file.ts');
    });

    it('should return false when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = fileService.fileExists('/path/to/nonexistent.ts');

      expect(result).toBe(false);
      expect(mockExistsSync).toHaveBeenCalledWith('/path/to/nonexistent.ts');
    });
  });

  describe('directoryExists', () => {
    it('should return true when directory exists', () => {
      mockExistsSync.mockReturnValue(true);

      const result = fileService.directoryExists('/path/to/dir');

      expect(result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/path/to/dir');
    });

    it('should return false when directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = fileService.directoryExists('/path/to/nonexistent');

      expect(result).toBe(false);
      expect(mockExistsSync).toHaveBeenCalledWith('/path/to/nonexistent');
    });
  });

  describe('resolveOutputPath', () => {
    it('should replace single template variables', () => {
      const template = 'output/{type}/{name}.ts';
      const replacements = { type: 'interfaces', name: 'User' };

      const result = fileService.resolveOutputPath(template, replacements);

      expect(result).toBe('output/interfaces/User.ts');
    });

    it('should replace multiple occurrences of the same variable', () => {
      const template = '{name}/{name}.{name}.ts';
      const replacements = { name: 'Test' };

      const result = fileService.resolveOutputPath(template, replacements);

      expect(result).toBe('Test/Test.Test.ts');
    });

    it('should handle multiple different variables', () => {
      const template = '{dir}/{type}/{name}.{ext}';
      const replacements = {
        dir: 'src',
        type: 'models',
        name: 'User',
        ext: 'ts',
      };

      const result = fileService.resolveOutputPath(template, replacements);

      expect(result).toBe('src/models/User.ts');
    });

    it('should handle empty replacements', () => {
      const template = 'output/file.ts';
      const replacements = {};

      const result = fileService.resolveOutputPath(template, replacements);

      expect(result).toBe('output/file.ts');
    });

    it('should handle variables not in template', () => {
      const template = 'output/{name}.ts';
      const replacements = { name: 'User', extra: 'ignored' };

      const result = fileService.resolveOutputPath(template, replacements);

      expect(result).toBe('output/User.ts');
    });

    it('should handle missing variables in replacements', () => {
      const template = 'output/{name}/{missing}.ts';
      const replacements = { name: 'User' };

      const result = fileService.resolveOutputPath(template, replacements);

      expect(result).toBe('output/User/{missing}.ts');
    });
  });

  describe('writeConfigFile', () => {
    const mockConfig: Config = {
      generator: { outputDir: './dist' },
      patterns: ['src/**/*.ts'],
    };

    it('should write JSON format by default', () => {
      const configPath = '/path/to/config.json';

      fileService.writeConfigFile(configPath, mockConfig, 'json');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        configPath,
        JSON.stringify(mockConfig, null, 2),
      );
    });

    it('should write JavaScript module format', () => {
      const configPath = '/path/to/config.js';
      const expectedContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};\n`;

      fileService.writeConfigFile(configPath, mockConfig, 'js');

      expect(mockWriteFileSync).toHaveBeenCalledWith(configPath, expectedContent);
    });

    it('should write CommonJS format', () => {
      const configPath = '/path/to/config.cjs';
      const expectedContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};\n`;

      fileService.writeConfigFile(configPath, mockConfig, 'cjs');

      expect(mockWriteFileSync).toHaveBeenCalledWith(configPath, expectedContent);
    });

    it('should handle write errors', () => {
      const configPath = '/path/to/config.json';
      const error = new Error('Write failed');

      mockWriteFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => fileService.writeConfigFile(configPath, mockConfig, 'json')).toThrow(error);
    });
  });

  describe('getConfigFileName', () => {
    it('should return JSON filename by default', () => {
      const result = fileService.getConfigFileName();
      expect(result).toBe('.fluentgenrc.json');
    });

    it('should return JSON filename explicitly', () => {
      const result = fileService.getConfigFileName('json');
      expect(result).toBe('.fluentgenrc.json');
    });

    it('should return JavaScript config filename', () => {
      const result = fileService.getConfigFileName('js');
      expect(result).toBe('fluentgen.config.js');
    });

    it('should return CommonJS config filename', () => {
      const result = fileService.getConfigFileName('cjs');
      expect(result).toBe('fluentgen.config.cjs');
    });
  });

  describe('findExistingConfig', () => {
    it('should return first existing config file', () => {
      mockExistsSync
        .mockReturnValueOnce(false) // .fluentgenrc.json
        .mockReturnValueOnce(true); // .fluentgenrc.yaml

      const result = fileService.findExistingConfig();

      expect(result).toBe('.fluentgenrc.yaml');
      expect(mockExistsSync).toHaveBeenCalledTimes(2);
    });

    it('should return undefined if no config files exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = fileService.findExistingConfig();

      expect(result).toBeUndefined();
      expect(mockExistsSync).toHaveBeenCalledTimes(7); // All config file types
    });

    it('should prioritize JSON config first', () => {
      mockExistsSync.mockReturnValueOnce(true);

      const result = fileService.findExistingConfig();

      expect(result).toBe('.fluentgenrc.json');
      expect(mockExistsSync).toHaveBeenCalledTimes(1);
    });

    it('should check all config file types in order', () => {
      mockExistsSync.mockReturnValue(false);

      fileService.findExistingConfig();

      expect(mockExistsSync).toHaveBeenNthCalledWith(1, '.fluentgenrc.json');
      expect(mockExistsSync).toHaveBeenNthCalledWith(2, '.fluentgenrc.yaml');
      expect(mockExistsSync).toHaveBeenNthCalledWith(3, '.fluentgenrc.yml');
      expect(mockExistsSync).toHaveBeenNthCalledWith(4, '.fluentgenrc.js');
      expect(mockExistsSync).toHaveBeenNthCalledWith(5, '.fluentgenrc.cjs');
      expect(mockExistsSync).toHaveBeenNthCalledWith(6, 'fluentgen.config.js');
      expect(mockExistsSync).toHaveBeenNthCalledWith(7, 'fluentgen.config.cjs');
    });
  });

  describe('validateTsConfigPath', () => {
    it('should return true for empty path', () => {
      const result = fileService.validateTsConfigPath('');
      expect(result).toBe(true);
    });

    it('should return true for falsy path', () => {
      expect(fileService.validateTsConfigPath('')).toBe(true);
      expect(fileService.validateTsConfigPath(null as any)).toBe(true);
      expect(fileService.validateTsConfigPath(undefined as any)).toBe(true);
    });

    it('should return true when file exists', () => {
      mockExistsSync.mockReturnValue(true);

      const result = fileService.validateTsConfigPath('./tsconfig.json');

      expect(result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('./tsconfig.json');
    });

    it('should return false when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = fileService.validateTsConfigPath('./missing-tsconfig.json');

      expect(result).toBe(false);
      expect(mockExistsSync).toHaveBeenCalledWith('./missing-tsconfig.json');
    });
  });

  describe('extractTypeName', () => {
    it('should extract simple type name', () => {
      const result = fileService.extractTypeName('/path/to/User.ts');
      expect(result).toBe('User');
    });

    it('should extract type name from compound filename', () => {
      const result = fileService.extractTypeName('/path/to/User.builder.ts');
      expect(result).toBe('User');
    });

    it('should handle filename with multiple dots', () => {
      const result = fileService.extractTypeName('/path/to/Complex.Type.Name.ts');
      expect(result).toBe('Complex');
    });

    it('should handle filename without dots', () => {
      const result = fileService.extractTypeName('/path/to/SimpleType.ts');
      expect(result).toBe('SimpleType');
    });

    it('should handle edge case with only extension', () => {
      const result = fileService.extractTypeName('/path/to/.ts');
      expect(result).toBe('.ts');
    });

    it('should handle filename without extension', () => {
      const result = fileService.extractTypeName('/path/to/NoExtension');
      expect(result).toBe('NoExtension');
    });
  });
});
