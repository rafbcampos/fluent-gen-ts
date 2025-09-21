import type { Result } from '../core/result.js';

export interface GenerateOptions {
  output?: string;
  config?: string;
  tsconfig?: string;
  plugins?: string[];
  defaults?: boolean;
  comments?: boolean;
  dryRun?: boolean;
}

export interface BatchOptions {
  config?: string;
  plugins?: string[];
  dryRun?: boolean;
  parallel?: boolean;
}

export interface ScanOptions {
  output?: string;
  config?: string;
  plugins?: string[];
  exclude?: string[];
  types?: string;
  interactive?: boolean;
  dryRun?: boolean;
  ignorePrivate?: boolean;
}

export interface InitOptions {
  overwrite?: boolean;
}

export interface CommandOptions {
  tsConfigPath?: string;
  outputDir?: string;
  fileName?: string;
  useDefaults?: boolean;
  addComments?: boolean;
  contextType?: string;
  importPath?: string;
}

export type GenerateTask = {
  type: 'generate';
  file: string;
  typeName: string;
  outputFile: string | undefined;
};

export type ScanTask = {
  type: 'scan';
  file: string;
  outputFile: string | undefined;
};

export type Task = GenerateTask | ScanTask;

export type TaskWithResult = Task & {
  result: Result<string> | Result<Map<string, string>>;
};
