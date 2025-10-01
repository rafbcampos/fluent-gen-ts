/**
 * Tests for TaskRunner
 * Verifies task execution, grouping, batching, and parallel/sequential processing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskRunner } from '../task-runner.js';
import type { Task, GenerateTask, ScanTask } from '../../types.js';
import type { Target, GeneratorConfig } from '../../config.js';
import type { FluentGen } from '../../../gen/index.js';
import { ok, err } from '../../../core/result.js';

describe('TaskRunner', () => {
  let taskRunner: TaskRunner;

  beforeEach(() => {
    taskRunner = new TaskRunner();
  });

  describe('createTasksFromTargets', () => {
    it('should create GenerateTask for each type in target', () => {
      const targets: Target[] = [
        {
          file: 'src/types.ts',
          types: ['User', 'Product'],
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const tasks = taskRunner.createTasksFromTargets(targets);

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toEqual({
        type: 'generate',
        file: 'src/types.ts',
        typeName: 'User',
        outputFile: 'src/builders/{{type}}.builder.ts',
      });
      expect(tasks[1]).toEqual({
        type: 'generate',
        file: 'src/types.ts',
        typeName: 'Product',
        outputFile: 'src/builders/{{type}}.builder.ts',
      });
    });

    it('should create ScanTask when target has no types', () => {
      const targets: Target[] = [
        {
          file: 'src/types.ts',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const tasks = taskRunner.createTasksFromTargets(targets);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual({
        type: 'scan',
        file: 'src/types.ts',
        outputFile: 'src/builders/{{type}}.builder.ts',
      });
    });

    it('should create ScanTask when target has empty types array', () => {
      const targets: Target[] = [
        {
          file: 'src/types.ts',
          types: [],
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const tasks = taskRunner.createTasksFromTargets(targets);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual({
        type: 'scan',
        file: 'src/types.ts',
        outputFile: 'src/builders/{{type}}.builder.ts',
      });
    });

    it('should handle multiple targets', () => {
      const targets: Target[] = [
        {
          file: 'src/user.ts',
          types: ['User'],
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
        {
          file: 'src/product.ts',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const tasks = taskRunner.createTasksFromTargets(targets);

      expect(tasks).toHaveLength(2);
      expect(tasks[0]?.type).toBe('generate');
      expect(tasks[1]?.type).toBe('scan');
    });

    it('should handle targets without outputFile', () => {
      const targets: Target[] = [
        {
          file: 'src/types.ts',
          types: ['User'],
        },
      ];

      const tasks = taskRunner.createTasksFromTargets(targets);

      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      if (task?.type === 'generate') {
        expect(task.outputFile).toBeUndefined();
      } else {
        throw new Error('Expected generate task');
      }
    });
  });

  describe('runTasks - sequential execution', () => {
    it('should execute generate tasks sequentially and return results', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: undefined,
        },
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'Product',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: false,
      });

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(2);
      expect(mockGenerator.generateBuilder).toHaveBeenCalledTimes(2);
    });

    it('should handle task failures in sequential execution', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: undefined,
        },
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'Product',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi
          .fn()
          .mockResolvedValueOnce(ok('success'))
          .mockResolvedValueOnce(err(new Error('Generation failed'))),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: false,
      });

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Generation failed');
    });

    it('should execute scan tasks sequentially', async () => {
      const tasks: ScanTask[] = [
        {
          type: 'scan',
          file: 'src/types.ts',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'scanAndGenerate'> = {
        scanAndGenerate: vi
          .fn()
          .mockResolvedValue(ok(new Map([['types.ts:User', 'generated code']]))),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: false,
      });

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(0);
      expect(mockGenerator.scanAndGenerate).toHaveBeenCalledWith('src/types.ts');
    });

    it('should call onProgress callback during sequential execution', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const onProgress = vi.fn();
      await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: false,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('runTasks - parallel execution', () => {
    it('should execute tasks in parallel', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: undefined,
        },
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'Product',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: true,
      });

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(0);
    });

    it('should handle failures in parallel execution', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: undefined,
        },
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'Product',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi
          .fn()
          .mockResolvedValueOnce(ok('success'))
          .mockResolvedValueOnce(err(new Error('Failed'))),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: true,
      });

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(1);
    });

    it('should call onProgress callback during parallel execution', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const onProgress = vi.fn();
      await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: true,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('runTasks - batching with generateCommonFile', () => {
    it('should batch tasks from same file when generateCommonFile is true', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'Product',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateMultipleFromFiles'> = {
        generateMultipleFromFiles: vi.fn().mockResolvedValue(
          ok(
            new Map([
              ['user.builder.ts', 'user code'],
              ['product.builder.ts', 'product code'],
              ['common.ts', 'common code'],
            ]),
          ),
        ),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: false,
        generateCommonFile: true,
        dryRun: true,
      });

      expect(result.successCount).toBe(2);
      expect(mockGenerator.generateMultipleFromFiles).toHaveBeenCalled();
    });

    it('should create multi-file batch when generateCommonFile is true', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/user.ts',
          typeName: 'User',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
        {
          type: 'generate',
          file: 'src/product.ts',
          typeName: 'Product',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateMultipleFromFiles'> = {
        generateMultipleFromFiles: vi.fn().mockResolvedValue(
          ok(
            new Map([
              ['user.builder.ts', 'user code'],
              ['product.builder.ts', 'product code'],
              ['common.ts', 'common code'],
            ]),
          ),
        ),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: false,
        generateCommonFile: true,
        dryRun: true,
      });

      expect(result.successCount).toBe(2);
    });
  });

  describe('runTasks - dryRun mode', () => {
    it('should not write files in dry run mode', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, { dryRun: true });

      expect(result.successCount).toBe(1);
      expect(mockGenerator.generateBuilder).toHaveBeenCalled();
    });
  });

  describe('runTasks - naming conventions', () => {
    it('should apply naming convention from generatorConfig', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'UserAccount',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const generatorConfig: GeneratorConfig = {
        naming: {
          convention: 'kebab-case',
        },
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        dryRun: true,
        generatorConfig,
      });

      expect(result.successCount).toBe(1);
    });

    it('should apply naming suffix from generatorConfig', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const generatorConfig: GeneratorConfig = {
        naming: {
          suffix: '.gen',
        },
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        dryRun: true,
        generatorConfig,
      });

      expect(result.successCount).toBe(1);
    });

    it('should handle custom transform function in naming config', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'UserAsset',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const generatorConfig: GeneratorConfig = {
        naming: {
          transform: "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()",
        },
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        dryRun: true,
        generatorConfig,
      });

      expect(result.successCount).toBe(1);
    });

    it('should fallback to default naming when transform function is invalid', async () => {
      const tasks: GenerateTask[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: 'src/builders/{{type}}.builder.ts',
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
      };

      const generatorConfig: GeneratorConfig = {
        naming: {
          transform: 'invalid javascript code',
        },
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        dryRun: true,
        generatorConfig,
      });

      expect(result.successCount).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('runTasks - mixed task types', () => {
    it('should handle mix of generate and scan tasks', async () => {
      const tasks: Task[] = [
        {
          type: 'generate',
          file: 'src/types.ts',
          typeName: 'User',
          outputFile: undefined,
        },
        {
          type: 'scan',
          file: 'src/models.ts',
          outputFile: undefined,
        },
      ];

      const mockGenerator: Pick<FluentGen, 'generateBuilder' | 'scanAndGenerate'> = {
        generateBuilder: vi.fn().mockResolvedValue(ok('generated code')),
        scanAndGenerate: vi
          .fn()
          .mockResolvedValue(ok(new Map([['models.ts:Model', 'model code']]))),
      };

      const result = await taskRunner.runTasks(tasks, mockGenerator as FluentGen, {
        parallel: false,
      });

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(0);
      expect(mockGenerator.generateBuilder).toHaveBeenCalledTimes(1);
      expect(mockGenerator.scanAndGenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe('runTasks - empty task list', () => {
    it('should handle empty task list', async () => {
      const mockGenerator: Pick<FluentGen, 'generateBuilder'> = {
        generateBuilder: vi.fn(),
      };

      const result = await taskRunner.runTasks([], mockGenerator as FluentGen, {});

      expect(result.successCount).toBe(0);
      expect(result.failCount).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
