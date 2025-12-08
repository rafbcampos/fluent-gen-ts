/**
 * Shared service container for CLI commands.
 * Provides a centralized way to create and manage services used across commands.
 */

import { ConfigLoader } from '../config.js';
import { PluginService } from '../services/plugin-service.js';
import { GeneratorService } from '../services/generator-service.js';
import { TaskRunner } from '../services/task-runner.js';
import { FileService } from '../services/file-service.js';
import { InteractiveService } from '../services/interactive-service.js';

/**
 * Core services used by all commands
 */
export interface CoreCommandServices {
  readonly configLoader: ConfigLoader;
  readonly pluginService: PluginService;
  readonly generatorService: GeneratorService;
}

/**
 * Extended services for batch operations
 */
export interface BatchCommandServices extends CoreCommandServices {
  readonly taskRunner: TaskRunner;
}

/**
 * Extended services for scan operations
 */
export interface ScanCommandServices extends CoreCommandServices {
  readonly fileService: FileService;
  readonly interactiveService: InteractiveService;
}

/**
 * Creates the core services used by most commands.
 * Use this factory function to ensure consistent service instantiation.
 */
export function createCoreCommandServices(): CoreCommandServices {
  return {
    configLoader: new ConfigLoader(),
    pluginService: new PluginService(),
    generatorService: new GeneratorService(),
  };
}

/**
 * Creates services required for batch command execution.
 */
export function createBatchCommandServices(): BatchCommandServices {
  return {
    ...createCoreCommandServices(),
    taskRunner: new TaskRunner(),
  };
}

/**
 * Creates services required for scan command execution.
 */
export function createScanCommandServices(): ScanCommandServices {
  return {
    ...createCoreCommandServices(),
    fileService: new FileService(),
    interactiveService: new InteractiveService(),
  };
}
