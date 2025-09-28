// Main programmatic API
export { FluentGen } from './gen/index.js';
export type { FluentGenOptions } from './gen/index.js';

// Code generation
export { BuilderGenerator } from './gen/index.js';
export type { GeneratorConfig } from './gen/index.js';

// Type extraction and analysis
export { TypeExtractor } from './type-info/index.js';
export type { TypeExtractorOptions } from './type-info/index.js';

// Core types for programmatic usage
export type {
  TypeInfo,
  PropertyInfo,
  TypeKind,
  ResolvedType,
  GenericParam,
  IndexSignature,
  GeneratorOptions,
} from './core/types.js';

// Result handling
export { ok, err, isOk, isErr } from './core/result.js';
export type { Result } from './core/result.js';

// Plugin system - barrel export everything
export * from './core/plugin/index.js';

// Runtime utilities for generated builders
export {
  FLUENT_BUILDER_SYMBOL,
  isFluentBuilder,
  isBuilderArray,
  createNestedContext,
  resolveValue,
} from './gen/builder-utilities.js';
export type {
  FluentBuilder,
  BaseBuildContext,
  NestedContextGenerator,
  NestedContextParams,
} from './gen/builder-utilities.js';
