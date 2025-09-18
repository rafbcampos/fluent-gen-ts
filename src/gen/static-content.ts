/**
 * Static content exports for fluent builder generation
 * Re-exports utilities and templates from separate modules
 */

// Re-export builder utilities
export {
  FLUENT_BUILDER_SYMBOL,
  type BaseBuildContext,
  type FluentBuilder,
  isFluentBuilder,
  isBuilderArray,
  createNestedContext,
  resolveValue,
  FluentBuilderBase,
  createInspectMethod,
} from "./builder-utilities.js";

// Re-export template generators
export {
  getCommonFileTemplate,
  getSingleFileUtilitiesTemplate,
} from "./template-generator.js";