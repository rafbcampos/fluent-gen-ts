import type { ResolvedType, TypeInfo, GenericParam } from '../../core/types.js';
import type { PluginManager } from '../../core/plugin/index.js';
import type { Result } from '../../core/result.js';

export interface ImportGeneratorConfig {
  readonly isGeneratingMultiple: boolean;
  readonly hasExistingCommon?: boolean;
  readonly commonImportPath: string;
  readonly pluginManager?: PluginManager;
  readonly outputDir?: string;
}

export interface TypeImportCategories {
  readonly localTypes: Set<string>;
  readonly relativeImports: Map<string, Set<string>>;
  readonly externalTypes: Map<string, string>;
}

export interface DependencyInfo {
  readonly typeName: string;
  readonly sourceFile: string;
}

export interface ImportGenerationContext {
  readonly resolvedType: ResolvedType;
  readonly config: ImportGeneratorConfig;
  readonly outputDir?: string;
}

export interface NodeJSTypeMapping {
  readonly module: string;
  readonly types: Set<string>;
}

export interface PackageImportInfo {
  readonly moduleName: string;
  readonly importPath: string;
  readonly isScoped: boolean;
  readonly subPath?: string;
}

export interface ImportDeduplicationResult {
  readonly deduplicated: string[];
  readonly conflicts: Map<string, string[]>;
}

export interface TypeCategorizationOptions {
  readonly typeInfo: TypeInfo;
  readonly mainSourceFile: string;
  readonly categories: TypeImportCategories;
}

export interface GenericParamCategorizationOptions {
  readonly param: GenericParam;
  readonly mainSourceFile: string;
  readonly categories: TypeImportCategories;
}

export type ImportValidationResult = Result<boolean, string>;

export type ImportGenerationResult = Promise<Result<string, Error>>;

export type ModuleImportsResult = Result<string[], Error>;
