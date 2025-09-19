import chalk from "chalk";
import path from "node:path";
import type { FluentGen } from "../../gen/index.js";
import { isOk } from "../../core/result.js";
import type { Target } from "../config.js";
import type { Task, TaskWithResult, GenerateTask, ScanTask } from "../types.js";
import { FileService } from "./file-service.js";

export interface TaskRunnerOptions {
  parallel?: boolean;
  dryRun?: boolean;
  onProgress?: (message: string) => void;
}

export interface TaskRunResult {
  successCount: number;
  failCount: number;
  results: TaskWithResult[];
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

  async runTasks(
    tasks: Task[],
    generator: FluentGen,
    options: TaskRunnerOptions = {},
  ): Promise<TaskRunResult> {
    const { parallel = false, dryRun = false, onProgress } = options;

    // Group tasks by output directory and determine which can be batched
    const taskGroups = this.groupTasksByOutputDir(tasks);
    const { batchGroups, individualTasks } = this.categorizeTaskGroups(taskGroups);

    if (parallel) {
      return this.runParallel(
        batchGroups,
        individualTasks,
        generator,
        dryRun,
        onProgress,
      );
    } else {
      return this.runSequential(
        batchGroups,
        individualTasks,
        generator,
        dryRun,
        onProgress,
      );
    }
  }

  private async runParallel(
    batchGroups: BatchTaskGroup[],
    individualTasks: Task[],
    generator: FluentGen,
    dryRun: boolean,
    onProgress?: (message: string) => void,
  ): Promise<TaskRunResult> {
    const totalOperations = batchGroups.length + individualTasks.length;
    onProgress?.(`Processing ${totalOperations} operations in parallel...`);

    const allPromises = [
      ...batchGroups.map((group) => this.executeBatchGroup(group, generator, dryRun)),
      ...individualTasks.map((task) => this.executeTask(task, generator, dryRun)),
    ];

    const results = await Promise.allSettled(allPromises);

    let successCount = 0;
    let failCount = 0;
    const taskResults: TaskWithResult[] = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const taskWithResults = Array.isArray(result.value) ? result.value : [result.value];
        taskResults.push(...taskWithResults);

        taskWithResults.forEach((taskWithResult) => {
          if ("ok" in taskWithResult.result && taskWithResult.result.ok) {
            successCount++;
          } else {
            failCount++;
          }
        });
      } else {
        failCount++;
        console.error(chalk.yellow(`  ⚠ Failed: ${result.reason}`));
        // We can't easily create a proper TaskWithResult here without more context
        // This will be handled by the sequential fallback behavior
      }
    });

    return { successCount, failCount, results: taskResults };
  }

  private async runSequential(
    batchGroups: BatchTaskGroup[],
    individualTasks: Task[],
    generator: FluentGen,
    dryRun: boolean,
    onProgress?: (message: string) => void,
  ): Promise<TaskRunResult> {
    let successCount = 0;
    let failCount = 0;
    const taskResults: TaskWithResult[] = [];

    // Process batch groups first
    for (const group of batchGroups) {
      onProgress?.(
        `Processing batch ${chalk.cyan(group.file)} - ${chalk.cyan(group.typeNames.join(", "))}...`,
      );

      const batchResults = await this.executeBatchGroup(group, generator, dryRun);
      taskResults.push(...batchResults);

      batchResults.forEach((taskWithResult) => {
        if ("ok" in taskWithResult.result && taskWithResult.result.ok) {
          successCount++;
        } else {
          failCount++;
          const error =
            "error" in taskWithResult.result
              ? taskWithResult.result.error
              : new Error("Unknown error");
          console.error(chalk.yellow(`  ⚠ Failed to generate batch: ${error.message}`));
        }
      });
    }

    // Process individual tasks
    for (const task of individualTasks) {
      if (task.type === "generate") {
        onProgress?.(
          `Processing ${chalk.cyan(task.file)} - ${chalk.cyan(task.typeName)}...`,
        );
      } else {
        onProgress?.(`Scanning ${chalk.cyan(task.file)}...`);
      }

      const taskWithResult = await this.executeTask(task, generator, dryRun);
      taskResults.push(taskWithResult);

      if ("ok" in taskWithResult.result && taskWithResult.result.ok) {
        successCount++;
      } else {
        failCount++;
        const error =
          "error" in taskWithResult.result
            ? taskWithResult.result.error
            : new Error("Unknown error");
        const errorMessage =
          task.type === "generate"
            ? `Failed to generate ${task.typeName}: ${error.message}`
            : `Failed to scan ${task.file}: ${error.message}`;
        console.error(chalk.yellow(`  ⚠ ${errorMessage}`));
      }
    }

    return { successCount, failCount, results: taskResults };
  }

  private async executeTask(
    task: Task,
    generator: FluentGen,
    dryRun: boolean,
  ): Promise<TaskWithResult> {
    if (task.type === "generate") {
      return this.executeGenerateTask(task, generator, dryRun);
    } else {
      return this.executeScanTask(task, generator, dryRun);
    }
  }

  private async executeGenerateTask(
    task: GenerateTask,
    generator: FluentGen,
    dryRun: boolean,
  ): Promise<TaskWithResult> {
    const result = await generator.generateBuilder(task.file, task.typeName);

    if (isOk(result) && !dryRun && task.outputFile) {
      const outputPath = this.fileService.resolveOutputPath(task.outputFile, {
        type: task.typeName.toLowerCase(),
        file: path.basename(task.file, ".ts"),
      });
      await this.fileService.writeOutput(outputPath, result.value);
    }

    return { ...task, result };
  }

  private async executeScanTask(
    task: ScanTask,
    generator: FluentGen,
    dryRun: boolean,
  ): Promise<TaskWithResult> {
    const result = await generator.scanAndGenerate(task.file);

    if (isOk(result) && !dryRun && task.outputFile) {
      for (const [key, code] of result.value) {
        const keyParts = key.split(":");
        if (keyParts.length === 2) {
          const [file, type] = keyParts as [string, string];
          const outputPath = this.fileService.resolveOutputPath(
            task.outputFile,
            {
              file: path.basename(file, ".ts"),
              type: type.toLowerCase(),
            },
          );
          await this.fileService.writeOutput(outputPath, code);
        }
      }
    }

    return { ...task, result };
  }

  private groupTasksByOutputDir(tasks: Task[]): TaskGroup[] {
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
        type: task.type === "generate" ? task.typeName.toLowerCase() : "scan",
        file: path.basename(task.file, ".ts"),
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

  private categorizeTaskGroups(taskGroups: TaskGroup[]): {
    batchGroups: BatchTaskGroup[];
    individualTasks: Task[];
  } {
    const batchGroups: BatchTaskGroup[] = [];
    const individualTasks: Task[] = [];

    for (const group of taskGroups) {
      if (group.outputDir.startsWith("__individual__")) {
        // These are tasks without output files or that should be processed individually
        individualTasks.push(...group.tasks);
        continue;
      }

      // Group generate tasks by file for batch processing
      const generateTasksByFile = new Map<string, GenerateTask[]>();
      const otherTasks: Task[] = [];

      for (const task of group.tasks) {
        if (task.type === "generate") {
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
            typeNames: tasks.map((t) => t.typeName),
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

    return { batchGroups, individualTasks };
  }

  private async executeBatchGroup(
    group: BatchTaskGroup,
    generator: FluentGen,
    dryRun: boolean,
  ): Promise<TaskWithResult[]> {
    const result = await generator.generateMultiple(group.file, group.typeNames);

    if (!isOk(result)) {
      // If batch generation fails, return failed results for all tasks
      return group.tasks.map((task) => ({
        ...task,
        result,
      }));
    }

    // Write files if not dry run
    if (!dryRun) {
      const outputMap = new Map<string, string>();

      for (const [fileName, code] of result.value) {
        if (fileName === "common.ts") {
          const commonPath = path.join(group.outputDir, "common.ts");
          outputMap.set(commonPath, code);
        } else {
          // Find the corresponding task for this type
          const typeName = path.basename(fileName, ".ts");
          const task = group.tasks.find((t) =>
            t.typeName.toLowerCase() === typeName.toLowerCase()
          );

          if (task && task.outputFile) {
            const outputPath = this.fileService.resolveOutputPath(task.outputFile, {
              type: task.typeName.toLowerCase(),
              file: path.basename(task.file, ".ts"),
            });
            outputMap.set(outputPath, code);
          }
        }
      }

      await this.fileService.writeOutputBatch(outputMap);
    }

    // Return success results for all tasks in the batch
    return group.tasks.map((task) => ({
      ...task,
      result: { ok: true, value: "Generated successfully" },
    }));
  }

  createTasksFromTargets(targets: Target[]): Task[] {
    return targets.flatMap((target): Task[] => {
      if (target.types && target.types.length > 0) {
        return target.types.map(
          (typeName): GenerateTask => ({
            type: "generate",
            file: target.file,
            typeName,
            outputFile: target.outputFile,
          }),
        );
      } else {
        return [
          {
            type: "scan",
            file: target.file,
            outputFile: target.outputFile,
          },
        ];
      }
    });
  }
}

