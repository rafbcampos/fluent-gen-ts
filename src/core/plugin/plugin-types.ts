import type { Result } from '../result.js';
import type { TypeInfo, PropertyInfo, ResolvedType, GeneratorOptions } from '../types.js';
import type { Type, Symbol } from 'ts-morph';

/**
 * Represents an internal project import
 */
export interface InternalImport {
  readonly kind: 'internal';
  readonly path: string;
  readonly imports: readonly string[];
  readonly isTypeOnly?: boolean;
  readonly isDefault?: boolean;
  readonly defaultName?: string;
}

/**
 * Represents an external package import
 */
export interface ExternalImport {
  readonly kind: 'external';
  readonly package: string;
  readonly imports: readonly string[];
  readonly isTypeOnly?: boolean;
  readonly isDefault?: boolean;
  readonly defaultName?: string;
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
  readonly symbol?: Symbol | undefined;
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
 * Type matcher for fluent type checking
 */
export interface TypeMatcherInterface {
  isPrimitive(...names: string[]): boolean;
  isObject(name?: string): ObjectTypeMatcher;
  isArray(): ArrayTypeMatcher;
  isUnion(): UnionTypeMatcher;
  isIntersection(): IntersectionTypeMatcher;
  isReference(name?: string): boolean;
  isGeneric(name?: string): boolean;
  matches(matcher: TypeMatcher): boolean;
  toString(): string;
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
 * Import transformation context
 */
export interface ImportTransformContext {
  readonly imports: readonly string[];
  readonly resolvedType: ResolvedType;
  readonly isGeneratingMultiple: boolean;
  readonly hasExistingCommon: boolean;
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
 * Plugin interface with structured imports
 */
export interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly imports?: PluginImports;

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
  readonly code: string | ((context: BuildMethodContext) => string);
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
  readonly returnType: string | ((context: BuilderContext) => string);
  readonly implementation: string | ((context: BuilderContext) => string);
  readonly jsDoc?: string;
}
