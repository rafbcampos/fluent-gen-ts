import chalk from 'chalk';
import path from 'node:path';
import type { FluentGen } from '../../gen/index.js';
import { isOk } from '../../core/result.js';
import { formatError } from '../../core/utils/error-utils.js';
import type { Target, GeneratorConfig } from '../config.js';
import type { Task, TaskWithResult, GenerateTask, ScanTask } from '../types.js';
import { FileService } from './file-service.js';
import { NamingService } from './naming-service.js';
import type { FileNamingConfig } from './naming-service.js';

/**
 * Configuration options for task execution.
 */
export interface TaskRunnerOptions {
  /** Whether to run tasks in parallel. Defaults to false. */
  parallel?: boolean;
  /** Whether to perform a dry run without writing files. Defaults to false. */
  dryRun?: boolean;
  /** Whether to generate a common file for shared code. Defaults to false. */
  generateCommonFile?: boolean;
  /** Callback function to report progress messages. */
  onProgress?: (message: string) => void;
  /** Generator configuration for naming conventions and other settings. */
  generatorConfig?: GeneratorConfig;
}

/**
 * Result of running a collection of tasks.
 */
export interface TaskRunResult {
  /** Number of tasks that completed successfully. */
  successCount: number;
  /** Number of tasks that failed. */
  failCount: number;
  /** Array of tasks with their execution results. */
  results: TaskWithResult[];
  /** Array of error messages from failed tasks. */
  errors: string[];
}

/**
 * A group of tasks that share the same output directory.
 */
export interface TaskGroup {
  /** The output directory for all tasks in this group. */
  outputDir: string;
  /** The tasks in this group. */
  tasks: Task[];
}

/**
 * A group of generate tasks that can be processed together in a batch.
 */
export interface BatchTaskGroup {
  /** The source file path, or '__multi_file__' for multi-file batches. */
  file: string;
  /** The type names to generate in this batch. */
  typeNames: string[];
  /** The output directory for generated files. */
  outputDir: string;
  /** The generate tasks in this batch. */
  tasks: GenerateTask[];
}

/**
 * Manages the execution of code generation tasks.
 *
 * Handles task grouping, batching, parallel/sequential execution,
 * and file writing with proper naming conventions.
 */
export class TaskRunner {
  private fileService = new FileService();
  private namingService = new NamingService();

  private isTaskSuccess(taskWithResult: TaskWithResult): boolean {
    return 'ok' in taskWithResult.result && taskWithResult.result.ok;
  }

  private extractError(taskWithResult: TaskWithResult): Error {
    return 'error' in taskWithResult.result
      ? taskWithResult.result.error
      : new Error('Unknown error');
  }

  private getOrCreateMapEntry<K, V>(map: Map<K, V[]>, key: K): V[] {
    if (!map.has(key)) {
      map.set(key, []);
    }
    return map.get(key)!;
  }

  /**
   * Executes a collection of tasks using the provided generator.
   *
   * Tasks are grouped by output directory and can be executed in parallel or sequentially.
   * Generate tasks from the same source file may be batched together for efficiency.
   *
   * @param tasks - The tasks to execute
   * @param generator - The FluentGen instance to use for code generation
   * @param options - Configuration options for task execution
   * @returns A promise that resolves to the execution results
   */
  async runTasks(
    tasks: Task[],
    generator: FluentGen,
    options: TaskRunnerOptions = {},
  ): Promise<TaskRunResult> {
    const {
      parallel = false,
      dryRun = false,
      generateCommonFile = false,
      onProgress,
      generatorConfig,
    } = options;

    const taskGroups = this.groupTasksByOutputDir(tasks, generatorConfig);
    const { batchGroups, individualTasks } = this.categorizeTaskGroups(
      taskGroups,
      generateCommonFile,
    );

    if (parallel) {
      return this.runParallel(
        batchGroups,
        individualTasks,
        generator,
        dryRun,
        onProgress,
        generatorConfig,
      );
    } else {
      return this.runSequential(
        batchGroups,
        individualTasks,
        generator,
        dryRun,
        onProgress,
        generatorConfig,
      );
    }
  }

  private formatTypeName(typeName: string, config?: GeneratorConfig): string {
    if (config?.naming?.transform) {
      try {
        // oxlint-disable-next-line typescript-eslint/no-implied-eval -- Intentionally executing user-provided transform function from config file
        const transformFn = new Function(
          'typeName',
          `return (${config.naming.transform})(typeName)`,
        );
        return transformFn(typeName) as string;
      } catch (error) {
        console.warn(
          `Warning: Invalid naming transform function, falling back to default: ${formatError(error)}`,
        );
      }
    }

    const namingConfig: FileNamingConfig = {
      convention: config?.naming?.convention ?? 'camelCase',
      suffix: config?.naming?.suffix ?? '',
    };

    const baseFileName = this.namingService.formatFileName(typeName, namingConfig);
    return baseFileName.replace(/\.ts$/, '').replace(/\.builder$/, '');
  }

  private async runParallel(
    batchGroups: BatchTaskGroup[],
    individualTasks: Task[],
    generator: FluentGen,
    dryRun: boolean,
    onProgress?: (message: string) => void,
    generatorConfig?: GeneratorConfig,
  ): Promise<TaskRunResult> {
    const totalOperations = batchGroups.length + individualTasks.length;
    onProgress?.(`Processing ${totalOperations} operations in parallel...`);

    const allPromises = [
      ...batchGroups.map(group =>
        this.executeBatchGroup(group, generator, dryRun, generatorConfig),
      ),
      ...individualTasks.map(task => this.executeTask(task, generator, dryRun, generatorConfig)),
    ];

    const results = await Promise.allSettled(allPromises);

    let successCount = 0;
    let failCount = 0;
    const taskResults: TaskWithResult[] = [];
    const errors: string[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const taskWithResults = Array.isArray(result.value) ? result.value : [result.value];
        taskResults.push(...taskWithResults);

        taskWithResults.forEach(taskWithResult => {
          if (this.isTaskSuccess(taskWithResult)) {
            successCount++;
          } else {
            failCount++;
          }
        });
      } else {
        failCount++;
        errors.push(`Failed: ${result.reason}`);
      }
    });

    return { successCount, failCount, results: taskResults, errors };
  }

  private async runSequential(
    batchGroups: BatchTaskGroup[],
    individualTasks: Task[],
    generator: FluentGen,
    dryRun: boolean,
    onProgress?: (message: string) => void,
    generatorConfig?: GeneratorConfig,
  ): Promise<TaskRunResult> {
    let successCount = 0;
    let failCount = 0;
    const taskResults: TaskWithResult[] = [];
    const errors: string[] = [];

    for (const group of batchGroups) {
      const displayMessage =
        group.file === '__multi_file__'
          ? `Generating ${chalk.cyan(group.typeNames.length)} type(s) in batch...`
          : `Generating from ${chalk.cyan(group.file)} (${chalk.cyan(group.typeNames.length)} type(s))...`;
      onProgress?.(displayMessage);

      const batchResults = await this.executeBatchGroup(group, generator, dryRun, generatorConfig);
      taskResults.push(...batchResults);

      batchResults.forEach(taskWithResult => {
        if (this.isTaskSuccess(taskWithResult)) {
          successCount++;
        } else {
          failCount++;
          const error = this.extractError(taskWithResult);
          errors.push(`Failed to generate batch: ${error.message}`);
        }
      });
    }

    for (const task of individualTasks) {
      if (task.type === 'generate') {
        onProgress?.(`Generating ${chalk.cyan(task.typeName)}...`);
      } else {
        onProgress?.(`Scanning ${chalk.cyan(task.file)}...`);
      }

      const taskWithResult = await this.executeTask(task, generator, dryRun, generatorConfig);
      taskResults.push(taskWithResult);

      if (this.isTaskSuccess(taskWithResult)) {
        successCount++;
      } else {
        failCount++;
        const error = this.extractError(taskWithResult);
        const errorMessage =
          task.type === 'generate'
            ? `Failed to generate ${task.typeName}: ${error.message}`
            : `Failed to scan ${task.file}: ${error.message}`;
        errors.push(errorMessage);
      }
    }

    return { successCount, failCount, results: taskResults, errors };
  }

  private async executeTask(
    task: Task,
    generator: FluentGen,
    dryRun: boolean,
    generatorConfig?: GeneratorConfig,
  ): Promise<TaskWithResult> {
    if (task.type === 'generate') {
      return this.executeGenerateTask(task, generator, dryRun, generatorConfig);
    } else {
      return this.executeScanTask(task, generator, dryRun, generatorConfig);
    }
  }

  private async executeGenerateTask(
    task: GenerateTask,
    generator: FluentGen,
    dryRun: boolean,
    generatorConfig?: GeneratorConfig,
  ): Promise<TaskWithResult> {
    const result = await generator.generateBuilder(task.file, task.typeName);

    if (isOk(result) && !dryRun && task.outputFile) {
      const outputPath = this.fileService.resolveOutputPath(task.outputFile, {
        type: this.formatTypeName(task.typeName, generatorConfig),
        file: path.basename(task.file, '.ts'),
      });
      await this.fileService.writeOutput(outputPath, result.value);
    }

    return { ...task, result };
  }

  private async executeScanTask(
    task: ScanTask,
    generator: FluentGen,
    dryRun: boolean,
    generatorConfig?: GeneratorConfig,
  ): Promise<TaskWithResult> {
    const result = await generator.scanAndGenerate(task.file);

    if (isOk(result) && !dryRun && task.outputFile) {
      for (const [key, code] of result.value) {
        const keyParts = key.split(':');
        if (keyParts.length === 2 && keyParts[0] && keyParts[1]) {
          const file = keyParts[0];
          const type = keyParts[1];
          const outputPath = this.fileService.resolveOutputPath(task.outputFile, {
            file: path.basename(file, '.ts'),
            type: this.formatTypeName(type, generatorConfig),
          });
          await this.fileService.writeOutput(outputPath, code);
        }
      }
    }

    return { ...task, result };
  }

  private groupTasksByOutputDir(tasks: Task[], generatorConfig?: GeneratorConfig): TaskGroup[] {
    const groups = new Map<string, Task[]>();
    let individualTaskCounter = 0;

    for (const task of tasks) {
      if (!task.outputFile) {
        const key = `__individual__${individualTaskCounter++}`;
        groups.set(key, [task]);
        continue;
      }

      // Resolve output directory from the template
      const outputPath = this.fileService.resolveOutputPath(task.outputFile, {
        type:
          task.type === 'generate' ? this.formatTypeName(task.typeName, generatorConfig) : 'scan',
        file: path.basename(task.file, '.ts'),
      });
      const outputDir = path.dirname(outputPath);
      this.getOrCreateMapEntry(groups, outputDir).push(task);
    }

    return Array.from(groups.entries()).map(([outputDir, tasks]) => ({
      outputDir,
      tasks,
    }));
  }

  private categorizeTaskGroups(
    taskGroups: TaskGroup[],
    generateCommonFile: boolean,
  ): {
    batchGroups: BatchTaskGroup[];
    individualTasks: Task[];
  } {
    const batchGroups: BatchTaskGroup[] = [];
    const individualTasks: Task[] = [];

    for (const group of taskGroups) {
      if (group.outputDir.startsWith('__individual__')) {
        individualTasks.push(...group.tasks);
        continue;
      }

      if (generateCommonFile) {
        const allGenerateTasks = group.tasks.filter(
          (task): task is GenerateTask => task.type === 'generate',
        );
        const otherTasks = group.tasks.filter(task => task.type !== 'generate');

        if (allGenerateTasks.length > 0) {
          const fileTypeMap = new Map<string, GenerateTask[]>();
          for (const task of allGenerateTasks) {
            this.getOrCreateMapEntry(fileTypeMap, task.file).push(task);
          }

          batchGroups.push({
            file: '__multi_file__',
            typeNames: allGenerateTasks.map(t => t.typeName),
            outputDir: group.outputDir,
            tasks: allGenerateTasks,
          });
        }

        individualTasks.push(...otherTasks);
      } else {
        const generateTasksByFile = new Map<string, GenerateTask[]>();
        const otherTasks: Task[] = [];

        for (const task of group.tasks) {
          if (task.type === 'generate') {
            this.getOrCreateMapEntry(generateTasksByFile, task.file).push(task);
          } else {
            otherTasks.push(task);
          }
        }

        for (const [file, tasks] of generateTasksByFile) {
          if (tasks.length > 1) {
            batchGroups.push({
              file,
              typeNames: tasks.map(t => t.typeName),
              outputDir: group.outputDir,
              tasks,
            });
          } else {
            individualTasks.push(...tasks);
          }
        }

        individualTasks.push(...otherTasks);
      }
    }

    return { batchGroups, individualTasks };
  }

  private async executeBatchGroup(
    group: BatchTaskGroup,
    generator: FluentGen,
    dryRun: boolean,
    generatorConfig?: GeneratorConfig,
  ): Promise<TaskWithResult[]> {
    let result;

    if (group.file === '__multi_file__') {
      const fileTypeMap = new Map<string, string[]>();
      for (const task of group.tasks) {
        this.getOrCreateMapEntry(fileTypeMap, task.file).push(task.typeName);
      }
      result = await generator.generateMultipleFromFiles(fileTypeMap);
    } else {
      result = await generator.generateMultiple(group.file, group.typeNames);
    }

    if (!isOk(result)) {
      return group.tasks.map(task => ({
        ...task,
        result,
      }));
    }

    if (!dryRun) {
      const outputMap = new Map<string, string>();
      const builderFilePaths: string[] = [];

      for (const [fileName, code] of result.value) {
        if (fileName === 'common.ts') {
          const commonPath = path.join(group.outputDir, 'common.ts');
          outputMap.set(commonPath, code);
        } else {
          const typeName = path.basename(fileName, '.builder.ts');
          const task = group.tasks.find(t => t.typeName === typeName);

          if (!task) {
            console.warn(`Warning: Could not find task for type ${typeName}`);
            continue;
          }

          if (task.outputFile) {
            const outputPath = this.fileService.resolveOutputPath(task.outputFile, {
              type: this.formatTypeName(task.typeName, generatorConfig),
              file: path.basename(task.file, '.ts'),
            });
            outputMap.set(outputPath, code);

            const fileName = path.basename(outputPath);
            builderFilePaths.push(fileName);
          }
        }
      }

      if (builderFilePaths.length > 0) {
        const indexContent =
          builderFilePaths
            .map(fileName => {
              const importPath = `./${fileName.replace('.ts', '.js')}`;
              return `export * from '${importPath}';`;
            })
            .join('\n') + '\n';

        const indexPath = path.join(group.outputDir, 'index.ts');
        outputMap.set(indexPath, indexContent);
      }

      await this.fileService.writeOutputBatch(outputMap);
    }

    return group.tasks.map(task => ({
      ...task,
      result: { ok: true, value: 'Generated successfully' },
    }));
  }

  /**
   * Converts target configurations into executable tasks.
   *
   * If a target specifies type names, creates a GenerateTask for each type.
   * Otherwise, creates a ScanTask to discover types automatically.
   *
   * @param targets - Array of target configurations from the config file
   * @returns Array of tasks ready for execution
   */
  createTasksFromTargets(targets: Target[]): Task[] {
    return targets.flatMap((target): Task[] => {
      if (target.types && target.types.length > 0) {
        return target.types.map(
          (typeName): GenerateTask => ({
            type: 'generate',
            file: target.file,
            typeName,
            outputFile: target.outputFile,
          }),
        );
      } else {
        return [
          {
            type: 'scan',
            file: target.file,
            outputFile: target.outputFile,
          },
        ];
      }
    });
  }
}
