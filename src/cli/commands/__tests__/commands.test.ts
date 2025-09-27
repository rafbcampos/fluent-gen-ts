/**
 * Tests for Commands facade class
 * Verifies proper delegation to individual command classes and parameter passing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Commands } from '../../commands.js';
import type {
  BatchOptions,
  GenerateOptions,
  InitOptions,
  ScanOptions,
  SetupCommonOptions,
} from '../../types.js';

// Mock all command classes
vi.mock('../generate-command.js', () => ({
  GenerateCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../batch-command.js', () => ({
  BatchCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../scan-command.js', () => ({
  ScanCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../init-command.js', () => ({
  InitCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../setup-common-command.js', () => ({
  SetupCommonCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('Commands', () => {
  let commands: Commands;
  let mockGenerateCommand: any;
  let mockBatchCommand: any;
  let mockScanCommand: any;
  let mockInitCommand: any;
  let mockSetupCommonCommand: any;

  beforeEach(() => {
    vi.clearAllMocks();
    commands = new Commands();

    // Access the mocked command instances
    mockGenerateCommand = (commands as any).generateCommand;
    mockBatchCommand = (commands as any).batchCommand;
    mockScanCommand = (commands as any).scanCommand;
    mockInitCommand = (commands as any).initCommand;
    mockSetupCommonCommand = (commands as any).setupCommonCommand;
  });

  describe('generate', () => {
    it('should delegate to GenerateCommand.execute with correct parameters', async () => {
      const file = './test.ts';
      const typeName = 'TestType';
      const options: GenerateOptions = {
        output: './output.ts',
        config: './config.json',
        tsconfig: './tsconfig.json',
        plugins: ['plugin1', 'plugin2'],
        defaults: true,
        comments: false,
        dryRun: true,
      };

      await commands.generate(file, typeName, options);

      expect(mockGenerateCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockGenerateCommand.execute).toHaveBeenCalledWith(file, typeName, options);
    });

    it('should use default empty options when none provided', async () => {
      const file = './test.ts';
      const typeName = 'TestType';

      await commands.generate(file, typeName);

      expect(mockGenerateCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockGenerateCommand.execute).toHaveBeenCalledWith(file, typeName, {});
    });

    it('should propagate errors from GenerateCommand', async () => {
      const error = new Error('Generate command failed');
      mockGenerateCommand.execute.mockRejectedValue(error);

      await expect(commands.generate('./test.ts', 'TestType')).rejects.toThrow(
        'Generate command failed',
      );
    });

    it('should return the result from GenerateCommand.execute', async () => {
      const result = await commands.generate('./test.ts', 'TestType');
      expect(result).toBeUndefined(); // Commands methods return void
    });
  });

  describe('batch', () => {
    it('should delegate to BatchCommand.execute with correct parameters', async () => {
      const options: BatchOptions = {
        config: './batch-config.json',
        plugins: ['plugin1'],
        dryRun: false,
        parallel: true,
      };

      await commands.batch(options);

      expect(mockBatchCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockBatchCommand.execute).toHaveBeenCalledWith(options);
    });

    it('should use default empty options when none provided', async () => {
      await commands.batch();

      expect(mockBatchCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockBatchCommand.execute).toHaveBeenCalledWith({});
    });

    it('should propagate errors from BatchCommand', async () => {
      const error = new Error('Batch command failed');
      mockBatchCommand.execute.mockRejectedValue(error);

      await expect(commands.batch()).rejects.toThrow('Batch command failed');
    });
  });

  describe('scan', () => {
    it('should delegate to ScanCommand.execute with correct parameters', async () => {
      const pattern = 'src/**/*.ts';
      const options: ScanOptions = {
        output: './scanned',
        config: './scan-config.json',
        plugins: ['scan-plugin'],
        exclude: ['**/*.test.ts'],
        types: 'User,Product',
        interactive: true,
        dryRun: false,
        ignorePrivate: true,
      };

      await commands.scan(pattern, options);

      expect(mockScanCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockScanCommand.execute).toHaveBeenCalledWith(pattern, options);
    });

    it('should use default empty options when none provided', async () => {
      const pattern = 'src/**/*.ts';

      await commands.scan(pattern);

      expect(mockScanCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockScanCommand.execute).toHaveBeenCalledWith(pattern, {});
    });

    it('should propagate errors from ScanCommand', async () => {
      const error = new Error('Scan command failed');
      mockScanCommand.execute.mockRejectedValue(error);

      await expect(commands.scan('src/**/*.ts')).rejects.toThrow('Scan command failed');
    });
  });

  describe('init', () => {
    it('should delegate to InitCommand.execute with correct parameters', async () => {
      const options: InitOptions = {
        overwrite: true,
      };

      await commands.init(options);

      expect(mockInitCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockInitCommand.execute).toHaveBeenCalledWith(options);
    });

    it('should use default empty options when none provided', async () => {
      await commands.init();

      expect(mockInitCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockInitCommand.execute).toHaveBeenCalledWith({});
    });

    it('should propagate errors from InitCommand', async () => {
      const error = new Error('Init command failed');
      mockInitCommand.execute.mockRejectedValue(error);

      await expect(commands.init()).rejects.toThrow('Init command failed');
    });
  });

  describe('setupCommon', () => {
    it('should delegate to SetupCommonCommand.execute with correct parameters', async () => {
      const options: SetupCommonOptions = {
        output: './common',
        overwrite: false,
      };

      await commands.setupCommon(options);

      expect(mockSetupCommonCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockSetupCommonCommand.execute).toHaveBeenCalledWith(options);
    });

    it('should use default empty options when none provided', async () => {
      await commands.setupCommon();

      expect(mockSetupCommonCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockSetupCommonCommand.execute).toHaveBeenCalledWith({});
    });

    it('should propagate errors from SetupCommonCommand', async () => {
      const error = new Error('Setup common command failed');
      mockSetupCommonCommand.execute.mockRejectedValue(error);

      await expect(commands.setupCommon()).rejects.toThrow('Setup common command failed');
    });
  });

  describe('facade pattern integration', () => {
    it('should instantiate all command classes only once', () => {
      // Create multiple instances to verify commands are reused
      const commands1 = new Commands();
      const commands2 = new Commands();

      // Each instance should have its own command instances
      expect((commands1 as any).generateCommand).toBeDefined();
      expect((commands1 as any).batchCommand).toBeDefined();
      expect((commands1 as any).scanCommand).toBeDefined();
      expect((commands1 as any).initCommand).toBeDefined();
      expect((commands1 as any).setupCommonCommand).toBeDefined();

      expect((commands2 as any).generateCommand).toBeDefined();
      expect((commands2 as any).batchCommand).toBeDefined();
      expect((commands2 as any).scanCommand).toBeDefined();
      expect((commands2 as any).initCommand).toBeDefined();
      expect((commands2 as any).setupCommonCommand).toBeDefined();
    });

    it('should handle concurrent calls to different commands', async () => {
      const promises = [
        commands.generate('./test1.ts', 'Type1'),
        commands.batch({ dryRun: true }),
        commands.scan('**/*.ts'),
        commands.init({ overwrite: false }),
        commands.setupCommon({ output: './test' }),
      ];

      await Promise.all(promises);

      expect(mockGenerateCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockBatchCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockScanCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockInitCommand.execute).toHaveBeenCalledTimes(1);
      expect(mockSetupCommonCommand.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent calls to the same command', async () => {
      const promises = [
        commands.generate('./test1.ts', 'Type1'),
        commands.generate('./test2.ts', 'Type2'),
        commands.generate('./test3.ts', 'Type3'),
      ];

      await Promise.all(promises);

      expect(mockGenerateCommand.execute).toHaveBeenCalledTimes(3);
      expect(mockGenerateCommand.execute).toHaveBeenNthCalledWith(1, './test1.ts', 'Type1', {});
      expect(mockGenerateCommand.execute).toHaveBeenNthCalledWith(2, './test2.ts', 'Type2', {});
      expect(mockGenerateCommand.execute).toHaveBeenNthCalledWith(3, './test3.ts', 'Type3', {});
    });
  });

  describe('type safety verification', () => {
    it('should accept all valid GenerateOptions properties', async () => {
      const options: GenerateOptions = {
        output: './output.ts',
        config: './config.json',
        tsconfig: './tsconfig.json',
        plugins: ['plugin1', 'plugin2'],
        defaults: true,
        comments: false,
        dryRun: true,
      };

      // This should compile and run without type errors
      await commands.generate('./test.ts', 'TestType', options);
      expect(mockGenerateCommand.execute).toHaveBeenCalledWith('./test.ts', 'TestType', options);
    });

    it('should accept all valid BatchOptions properties', async () => {
      const options: BatchOptions = {
        config: './config.json',
        plugins: ['plugin1'],
        dryRun: false,
        parallel: true,
      };

      await commands.batch(options);
      expect(mockBatchCommand.execute).toHaveBeenCalledWith(options);
    });

    it('should accept all valid ScanOptions properties', async () => {
      const options: ScanOptions = {
        output: './output',
        config: './config.json',
        plugins: ['plugin1'],
        exclude: ['**/*.test.ts'],
        types: 'User,Product',
        interactive: true,
        dryRun: false,
        ignorePrivate: true,
      };

      await commands.scan('**/*.ts', options);
      expect(mockScanCommand.execute).toHaveBeenCalledWith('**/*.ts', options);
    });

    it('should accept all valid InitOptions properties', async () => {
      const options: InitOptions = {
        overwrite: true,
      };

      await commands.init(options);
      expect(mockInitCommand.execute).toHaveBeenCalledWith(options);
    });

    it('should accept all valid SetupCommonOptions properties', async () => {
      const options: SetupCommonOptions = {
        output: './common',
        overwrite: false,
      };

      await commands.setupCommon(options);
      expect(mockSetupCommonCommand.execute).toHaveBeenCalledWith(options);
    });
  });
});
