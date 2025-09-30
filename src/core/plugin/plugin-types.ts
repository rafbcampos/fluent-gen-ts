import type { Result } from '../result.js';
import type { TypeInfo, PropertyInfo, ResolvedType, GeneratorOptions } from '../types.js';
import type { Type, Symbol } from 'ts-morph';
import type { TypeDeepTransformer } from './type-matcher/index.js';

/**
 * Generic type for values that can be static or dynamically generated from context
 *
 * @example
 * ```typescript
 * // Static value
 * const staticCode: StaticOrDynamic<string, BuilderContext> = "return {};";
 *
 * // Dynamic value based on context
 * const dynamicCode: StaticOrDynamic<string, BuilderContext> =
 *   (context) => `return new ${context.builderName}();`;
 * ```
 */
export type StaticOrDynamic<TValue, TContext> = TValue | ((context: TContext) => TValue);

/**
 * Base import properties shared by all import types
 * @internal
 */
interface BaseImportProperties {
  readonly imports: readonly string[];
  readonly isTypeOnly?: boolean;
  readonly isDefault?: boolean;
  readonly defaultName?: string;
}

/**
 * Represents an internal project import
 */
export interface InternalImport extends BaseImportProperties {
  readonly kind: 'internal';
  readonly path: string;
}

/**
 * Represents an external package import
 */
export interface ExternalImport extends BaseImportProperties {
  readonly kind: 'external';
  readonly package: string;
}

/**
 * Union type for all import types
 */
export type Import = InternalImport | ExternalImport;

/**
 * Import requirements for a plugin
 */
export interface PluginImports {
  readonly imports: readonly Import[];
}

/**
 * Base context with common properties
 */
export interface BaseContext {
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
}

/**
 * Context with builder information
 */
export interface BuilderContextInfo extends BaseContext {
  readonly builderName: string;
}

/**
 * Context with generic parameters
 */
export interface GenericsContextInfo {
  readonly genericParams: string;
  readonly genericConstraints: string;
}

/**
 * Parse context
 */
export interface ParseContext {
  readonly sourceFile: string;
  readonly typeName: string;
}

/**
 * Resolve context
 */
export interface ResolveContext {
  readonly type: Type;
  readonly symbol?: Symbol;
  readonly sourceFile?: string;
  readonly typeName?: string;
}

/**
 * Generate context
 */
export interface GenerateContext {
  readonly resolvedType: ResolvedType;
  readonly options: GeneratorOptions;
}

/**
 * Build method context
 */
export interface BuildMethodContext extends BuilderContextInfo, GenericsContextInfo {
  readonly buildMethodCode: string;
  readonly properties: readonly PropertyInfo[];
  readonly options: GeneratorOptions;
  readonly resolvedType: ResolvedType;
}

/**
 * Type matcher for fluent type checking and analysis
 *
 * Provides a fluent API for checking and analyzing TypeScript types in plugin contexts.
 * This interface allows plugins to make decisions based on type characteristics.
 *
 * @example
 * ```typescript
 * // Check if type is a specific primitive
 * if (context.type.isPrimitive('string', 'number')) {
 *   // Handle string or number types
 * }
 *
 * // Check complex object types
 * if (context.type.isObject('User').withProperty('id', m => m.primitive('string'))) {
 *   // Handle User objects with string id property
 * }
 * ```
 */
export interface TypeMatcherInterface {
  /** Check if type is one of the specified primitive types */
  isPrimitive(...names: string[]): boolean;
  /** Get an object type matcher for fluent checking */
  isObject(name?: string): ObjectTypeMatcher;
  /** Get an array type matcher for fluent checking */
  isArray(): ArrayTypeMatcher;
  /** Get a union type matcher for fluent checking */
  isUnion(): UnionTypeMatcher;
  /** Get an intersection type matcher for fluent checking */
  isIntersection(): IntersectionTypeMatcher;
  /** Check if type is a reference to a named type */
  isReference(name?: string): boolean;
  /** Check if type is or contains generics */
  isGeneric(name?: string): boolean;
  /** Check if type matches a custom type matcher */
  matches(matcher: TypeMatcher): boolean;
  /** Get string representation of the type */
  toString(): string;
  /** Get a deep type transformer for recursive type transformations */
  transformDeep(): TypeDeepTransformer;
  /** Check if type contains a matching type at any depth */
  containsDeep(matcher: TypeMatcher): boolean;
  /** Find all types matching the given matcher at any depth */
  findDeep(matcher: TypeMatcher): import('../types.js').TypeInfo[];
}

/**
 * Property method context with type utilities
 */
export interface PropertyMethodContext extends BuilderContextInfo {
  readonly property: PropertyInfo;
  readonly propertyType: TypeInfo;
  readonly originalTypeString: string;

  // Type utilities
  readonly type: TypeMatcherInterface;

  // Helper methods
  hasGeneric(name: string): boolean;
  getGenericConstraint(name: string): string | undefined;
  isOptional(): boolean;
  isReadonly(): boolean;
  getPropertyPath(): string[];
  getMethodName(): string;
}

/**
 * Builder context for custom methods
 */
export interface BuilderContext extends BuilderContextInfo, GenericsContextInfo {
  readonly properties: readonly PropertyInfo[];

  // Helper methods
  hasProperty(name: string): boolean;
  getProperty(name: string): PropertyInfo | undefined;
  getRequiredProperties(): readonly PropertyInfo[];
  getOptionalProperties(): readonly PropertyInfo[];
}

/**
 * Value context
 */
export interface ValueContext {
  readonly property: string;
  readonly valueVariable: string;
  readonly type: TypeInfo;
  readonly isOptional: boolean;

  // Type utilities
  readonly typeChecker: TypeMatcherInterface;
}

/**
 * Property method transformation result
 */
export interface PropertyMethodTransform {
  readonly parameterType?: string;
  readonly extractValue?: string;
  readonly validate?: string;
}

/**
 * Custom method definition
 */
export interface CustomMethod {
  readonly name: string;
  readonly signature: string;
  readonly implementation: string;
  readonly jsDoc?: string;
}

/**
 * Value transformation result
 */
export interface ValueTransform {
  readonly condition?: string;
  readonly transform: string;
}

/**
 * Represents a structured import statement with parsed components
 */
export interface StructuredImport {
  /** The module path or package name */
  readonly source: string;
  /** Named imports (e.g., { Foo, Bar }) */
  readonly namedImports: readonly StructuredNamedImport[];
  /** Default import name (e.g., React in 'import React from "react"') */
  readonly defaultImport?: string;
  /** Namespace import name (e.g., utils in 'import * as utils from "./utils"') */
  readonly namespaceImport?: string;
  /** Whether this is a type-only import */
  readonly isTypeOnly: boolean;
  /** Whether this is a side-effect import (e.g., 'import "./styles.css"') */
  readonly isSideEffect: boolean;
}

/**
 * Represents a named import with optional type-only flag
 */
export interface StructuredNamedImport {
  /** The imported name */
  readonly name: string;
  /** The alias if using 'as' syntax */
  readonly alias?: string;
  /** Whether this specific import is type-only */
  readonly isTypeOnly?: boolean;
}

/**
 * Enhanced import transformation context with structured imports
 */
export interface ImportTransformContext {
  /** Structured import objects for easy manipulation */
  readonly imports: readonly StructuredImport[];
  /** The resolved type being generated */
  readonly resolvedType: ResolvedType;
  /** Whether generating multiple builders */
  readonly isGeneratingMultiple: boolean;
  /** Whether common imports file exists */
  readonly hasExistingCommon: boolean;
  /** Helper utilities for common transformations */
  readonly utils: ImportTransformUtils;
}

/**
 * Utility functions for import transformations
 */
export interface ImportTransformUtils {
  /** Transform relative imports to monorepo package imports */
  transformRelativeToMonorepo(
    imports: readonly StructuredImport[],
    mapping: RelativeToMonorepoMapping,
  ): readonly StructuredImport[];
  /** Create a new structured import */
  createImport(source: string, options?: CreateImportOptions): StructuredImport;
  /** Merge imports from the same source */
  mergeImports(imports: readonly StructuredImport[]): readonly StructuredImport[];
  /** Filter imports by source pattern */
  filterImports(
    imports: readonly StructuredImport[],
    predicate: (imp: StructuredImport) => boolean,
  ): readonly StructuredImport[];
  /** Replace import sources using pattern matching */
  replaceSource(
    imports: readonly StructuredImport[],
    options: { from: string | RegExp; to: string },
  ): readonly StructuredImport[];
}

/**
 * Options for creating structured imports
 */
export interface CreateImportOptions {
  /** Named imports to include */
  namedImports?: readonly (string | StructuredNamedImport)[];
  /** Default import name */
  defaultImport?: string;
  /** Namespace import name */
  namespaceImport?: string;
  /** Whether this is a type-only import */
  isTypeOnly?: boolean;
  /** Whether this is a side-effect import */
  isSideEffect?: boolean;
}

/**
 * Pattern matching rule for relative import transformation
 */
export interface PathMappingRule {
  /** The pattern to match - can be exact string or regex pattern */
  readonly pattern: string;
  /** Whether the pattern should be treated as a regular expression */
  readonly isRegex?: boolean;
  /** The replacement package name */
  readonly replacement: string;
}

/**
 * Configuration for transforming relative imports to monorepo imports
 */
export interface RelativeToMonorepoMapping {
  /** Array of path mapping rules */
  readonly pathMappings: readonly PathMappingRule[];
  /** Base directory for resolving relative paths */
  readonly baseDir?: string;
}

export const HookType = {
  BeforeParse: 'beforeParse',
  AfterParse: 'afterParse',
  BeforeResolve: 'beforeResolve',
  AfterResolve: 'afterResolve',
  BeforeGenerate: 'beforeGenerate',
  AfterGenerate: 'afterGenerate',
  TransformType: 'transformType',
  TransformProperty: 'transformProperty',
  TransformBuildMethod: 'transformBuildMethod',
  TransformPropertyMethod: 'transformPropertyMethod',
  AddCustomMethods: 'addCustomMethods',
  TransformValue: 'transformValue',
  TransformImports: 'transformImports',
} as const;

export type HookTypeValue = (typeof HookType)[keyof typeof HookType];

/**
 * Plugin hook map
 */
export interface PluginHookMap {
  [HookType.BeforeParse]: (context: ParseContext) => Result<ParseContext>;
  [HookType.AfterParse]: (context: ParseContext, type: Type) => Result<Type>;
  [HookType.BeforeResolve]: (context: ResolveContext) => Result<ResolveContext>;
  [HookType.AfterResolve]: (context: ResolveContext, typeInfo: TypeInfo) => Result<TypeInfo>;
  [HookType.BeforeGenerate]: (context: GenerateContext) => Result<GenerateContext>;
  [HookType.AfterGenerate]: (code: string, context: GenerateContext) => Result<string>;
  [HookType.TransformType]: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>;
  [HookType.TransformProperty]: (property: PropertyInfo) => Result<PropertyInfo>;
  [HookType.TransformBuildMethod]: (context: BuildMethodContext) => Result<string>;
  [HookType.TransformPropertyMethod]: (
    context: PropertyMethodContext,
  ) => Result<PropertyMethodTransform>;
  [HookType.AddCustomMethods]: (context: BuilderContext) => Result<readonly CustomMethod[]>;
  [HookType.TransformValue]: (context: ValueContext) => Result<ValueTransform | null>;
  [HookType.TransformImports]: (context: ImportTransformContext) => Result<ImportTransformContext>;
}

/**
 * Base type matcher interface
 */
export interface TypeMatcher {
  match(typeInfo: TypeInfo): boolean;
  describe(): string;
}

/**
 * Object type matcher with fluent API
 */
export interface ObjectTypeMatcher extends TypeMatcher {
  withGeneric(name?: string): ObjectTypeMatcher;
  withProperty(name: string, type?: TypeMatcher): ObjectTypeMatcher;
  withProperties(...names: string[]): ObjectTypeMatcher;
}

/**
 * Array type matcher with fluent API
 */
export interface ArrayTypeMatcher extends TypeMatcher {
  of(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): ArrayTypeMatcher;
}

/**
 * Union type matcher with fluent API
 */
export interface UnionTypeMatcher extends TypeMatcher {
  containing(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): UnionTypeMatcher;
  exact(...matchers: TypeMatcher[]): UnionTypeMatcher;
}

/**
 * Intersection type matcher with fluent API
 */
export interface IntersectionTypeMatcher extends TypeMatcher {
  including(
    matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher),
  ): IntersectionTypeMatcher;
  exact(...matchers: TypeMatcher[]): IntersectionTypeMatcher;
}

/**
 * Type matcher builder for creating complex matchers
 */
export interface TypeMatcherBuilder {
  primitive(...names: string[]): TypeMatcher;
  object(name?: string): ObjectTypeMatcher;
  array(): ArrayTypeMatcher;
  union(): UnionTypeMatcher;
  intersection(): IntersectionTypeMatcher;
  reference(name?: string): TypeMatcher;
  generic(name?: string): TypeMatcher;
  any(): TypeMatcher;
  never(): TypeMatcher;
  literal(value: string | number | boolean): TypeMatcher;
  or(...matchers: TypeMatcher[]): TypeMatcher;
  and(...matchers: TypeMatcher[]): TypeMatcher;
  not(matcher: TypeMatcher): TypeMatcher;
}

/**
 * Plugin interface for extending code generation behavior
 *
 * Plugins provide hooks into various stages of the generation pipeline,
 * allowing customization of parsing, type resolution, and code generation.
 *
 * @example
 * ```typescript
 * const myPlugin: Plugin = {
 *   name: 'my-custom-plugin',
 *   version: '1.0.0',
 *   description: 'Adds custom validation methods',
 *
 *   // Transform property methods to add validation
 *   transformPropertyMethod: (context) => {
 *     if (context.type.isPrimitive('string')) {
 *       return ok({
 *         parameterType: 'string | ValidatedString',
 *         validate: 'validateString(value)'
 *       });
 *     }
 *     return ok({});
 *   }
 * };
 * ```
 */
export interface Plugin {
  /** Unique identifier for the plugin */
  readonly name: string;
  /** Semantic version of the plugin */
  readonly version: string;
  /** Human-readable description of plugin functionality */
  readonly description?: string;
  /** Import requirements for generated code */
  readonly imports?: PluginImports;

  // Context customization (code generation only)
  /**
   * Custom context type name to use in generated builders (e.g., 'MyDomainContext')
   * This is used during code generation to specify the context type in builder signatures.
   *
   * Note: Runtime context generator behavior should be provided by users via
   * `__nestedContextGenerator__` in their context objects, not through plugins.
   */
  readonly contextTypeName?: string;

  // Lifecycle hooks
  beforeParse?: PluginHookMap['beforeParse'];
  afterParse?: PluginHookMap['afterParse'];
  beforeResolve?: PluginHookMap['beforeResolve'];
  afterResolve?: PluginHookMap['afterResolve'];
  beforeGenerate?: PluginHookMap['beforeGenerate'];
  afterGenerate?: PluginHookMap['afterGenerate'];

  // Transformation hooks
  transformType?: PluginHookMap['transformType'];
  transformProperty?: PluginHookMap['transformProperty'];
  transformBuildMethod?: PluginHookMap['transformBuildMethod'];
  transformPropertyMethod?: PluginHookMap['transformPropertyMethod'];
  addCustomMethods?: PluginHookMap['addCustomMethods'];
  transformValue?: PluginHookMap['transformValue'];
  transformImports?: PluginHookMap['transformImports'];
}

/**
 * Property method transform rule
 */
export interface PropertyMethodTransformRule {
  readonly predicate: (context: PropertyMethodContext) => boolean;
  readonly transform: PropertyMethodTransform;
}

/**
 * Value transform rule
 */
export interface ValueTransformRule {
  readonly predicate: (context: ValueContext) => boolean;
  readonly transform: ValueTransform;
}

/**
 * Build method transformation
 */
export interface BuildMethodTransformation {
  readonly type: 'insertBefore' | 'insertAfter' | 'replace' | 'wrap';
  readonly marker?: string | RegExp;
  readonly code: StaticOrDynamic<string, BuildMethodContext>;
  readonly replacement?: string | ((match: string, context: BuildMethodContext) => string);
}

/**
 * Method parameter definition
 */
export interface MethodParameter {
  readonly name: string;
  readonly type: string;
  readonly isOptional?: boolean;
  readonly defaultValue?: string;
}

/**
 * Custom method definition for builder
 */
export interface CustomMethodDefinition {
  readonly name: string;
  readonly parameters: readonly MethodParameter[];
  readonly returnType: StaticOrDynamic<string, BuilderContext>;
  readonly implementation: StaticOrDynamic<string, BuilderContext>;
  readonly jsDoc?: string;
}
