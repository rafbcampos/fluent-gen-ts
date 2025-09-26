import chalk from 'chalk';
import path from 'node:path';
import type { FluentGen } from '../../gen/index.js';
import { isOk } from '../../core/result.js';
import type { Target, GeneratorConfig } from '../config.js';
import type { Task, TaskWithResult, GenerateTask, ScanTask } from '../types.js';
import { FileService } from './file-service.js';
import { NamingService } from './naming-service.js';
import type { FileNamingConfig } from './naming-service.js';

export interface TaskRunnerOptions {
  parallel?: boolean;
  dryRun?: boolean;
  generateCommonFile?: boolean;
  onProgress?: (message: string) => void;
  generatorConfig?: GeneratorConfig;
}

export interface TaskRunResult {
  successCount: number;
  failCount: number;
  results: TaskWithResult[];
  errors: string[];
}

export interface TaskGroup {
  outputDir: string;
  tasks: Task[];
}

export interface BatchTaskGroup {
  file: string;
  typeNames: string[];
  outputDir: string;
  tasks: GenerateTask[];
}

export class TaskRunner {
  private fileService = new FileService();
  private namingService = new NamingService();

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

    // Group tasks by output directory and determine which can be batched
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
    // If user provided a custom transform function, use that
    if (config?.naming?.transform) {
      try {
        // Safely evaluate the transform function
        const transformFn = new Function(
          'typeName',
          `return (${config.naming.transform})(typeName)`,
        );
        return transformFn(typeName);
      } catch (error) {
        console.warn(
          `Warning: Invalid naming transform function, falling back to default: ${error}`,
        );
      }
    }

    // Fall back to predefined naming conventions
    const namingConfig: FileNamingConfig = {
      convention: config?.naming?.convention ?? 'camelCase',
      suffix: config?.naming?.suffix ?? '', // Don't add suffix here since outputFile template already has .builder.ts
    };

    // Use naming service to format just the type name part
    const baseFileName = this.namingService.formatFileName(typeName, namingConfig);
    // Remove any .ts extension and return just the formatted type name
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
          if ('ok' in taskWithResult.result && taskWithResult.result.ok) {
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

    // Process batch groups first
    for (const group of batchGroups) {
      const displayMessage =
        group.file === '__multi_file__'
          ? `Generating ${chalk.cyan(group.typeNames.length)} type(s) in batch...`
          : `Generating from ${chalk.cyan(group.file)} (${chalk.cyan(group.typeNames.length)} type(s))...`;
      onProgress?.(displayMessage);

      const batchResults = await this.executeBatchGroup(group, generator, dryRun, generatorConfig);
      taskResults.push(...batchResults);

      batchResults.forEach(taskWithResult => {
        if ('ok' in taskWithResult.result && taskWithResult.result.ok) {
          successCount++;
        } else {
          failCount++;
          const error =
            'error' in taskWithResult.result
              ? taskWithResult.result.error
              : new Error('Unknown error');
          errors.push(`Failed to generate batch: ${error.message}`);
        }
      });
    }

    // Process individual tasks
    for (const task of individualTasks) {
      if (task.type === 'generate') {
        onProgress?.(`Generating ${chalk.cyan(task.typeName)}...`);
      } else {
        onProgress?.(`Scanning ${chalk.cyan(task.file)}...`);
      }

      const taskWithResult = await this.executeTask(task, generator, dryRun, generatorConfig);
      taskResults.push(taskWithResult);

      if ('ok' in taskWithResult.result && taskWithResult.result.ok) {
        successCount++;
      } else {
        failCount++;
        const error =
          'error' in taskWithResult.result
            ? taskWithResult.result.error
            : new Error('Unknown error');
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
        if (keyParts.length === 2) {
          const [file, type] = keyParts as [string, string];
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

    for (const task of tasks) {
      if (!task.outputFile) {
        // If no output file specified, treat as individual task
        const key = `__individual__${Math.random()}`;
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

      if (!groups.has(outputDir)) {
        groups.set(outputDir, []);
      }
      groups.get(outputDir)!.push(task);
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
        // These are tasks without output files or that should be processed individually
        individualTasks.push(...group.tasks);
        continue;
      }

      // If generateCommonFile is enabled, batch all generate tasks in the same output dir
      if (generateCommonFile) {
        const allGenerateTasks = group.tasks.filter(
          (task): task is GenerateTask => task.type === 'generate',
        );
        const otherTasks = group.tasks.filter(task => task.type !== 'generate');

        if (allGenerateTasks.length > 0) {
          // Create a multi-file batch group
          const fileTypeMap = new Map<string, GenerateTask[]>();
          for (const task of allGenerateTasks) {
            if (!fileTypeMap.has(task.file)) {
              fileTypeMap.set(task.file, []);
            }
            fileTypeMap.get(task.file)!.push(task);
          }

          // Create a special batch group that spans multiple files
          batchGroups.push({
            file: '__multi_file__', // Special marker for multi-file batch
            typeNames: allGenerateTasks.map(t => t.typeName),
            outputDir: group.outputDir,
            tasks: allGenerateTasks,
          });
        }

        individualTasks.push(...otherTasks);
      } else {
        // Original behavior: Group generate tasks by file for batch processing
        const generateTasksByFile = new Map<string, GenerateTask[]>();
        const otherTasks: Task[] = [];

        for (const task of group.tasks) {
          if (task.type === 'generate') {
            if (!generateTasksByFile.has(task.file)) {
              generateTasksByFile.set(task.file, []);
            }
            generateTasksByFile.get(task.file)!.push(task);
          } else {
            otherTasks.push(task);
          }
        }

        // Convert groups with multiple types into batch groups
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

        // Add other tasks (scan, etc.) as individual tasks
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

    // Check if this is a multi-file batch
    if (group.file === '__multi_file__') {
      // Build the file-to-types map for multi-file generation
      const fileTypeMap = new Map<string, string[]>();
      for (const task of group.tasks) {
        if (!fileTypeMap.has(task.file)) {
          fileTypeMap.set(task.file, []);
        }
        fileTypeMap.get(task.file)!.push(task.typeName);
      }
      result = await generator.generateMultipleFromFiles(fileTypeMap);
    } else {
      // Original single-file batch
      result = await generator.generateMultiple(group.file, group.typeNames);
    }

    if (!isOk(result)) {
      // If batch generation fails, return failed results for all tasks
      return group.tasks.map(task => ({
        ...task,
        result,
      }));
    }

    // Write files if not dry run
    if (!dryRun) {
      const outputMap = new Map<string, string>();
      const builderFilePaths: string[] = [];

      for (const [fileName, code] of result.value) {
        if (fileName === 'common.ts') {
          const commonPath = path.join(group.outputDir, 'common.ts');
          outputMap.set(commonPath, code);
        } else {
          // Find the corresponding task for this type
          const typeName = path.basename(fileName, '.builder.ts');
          const task = group.tasks.find(t => t.typeName === typeName);

          if (task && task.outputFile) {
            const outputPath = this.fileService.resolveOutputPath(task.outputFile, {
              type: this.formatTypeName(task.typeName, generatorConfig),
              file: path.basename(task.file, '.ts'),
            });
            outputMap.set(outputPath, code);

            // Track builder files for barrel export (use relative path)
            const fileName = path.basename(outputPath);
            builderFilePaths.push(fileName);
          }
        }
      }

      // Generate barrel export index.ts
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

    // Return success results for all tasks in the batch
    return group.tasks.map(task => ({
      ...task,
      result: { ok: true, value: 'Generated successfully' },
    }));
  }

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
