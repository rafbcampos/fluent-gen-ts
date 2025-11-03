import type { Type } from 'ts-morph';
import type { Result } from '../../core/result.js';
import { ok, err } from '../../core/result.js';
import { formatError } from '../../core/utils/error-utils.js';
import type { TypeInfo } from '../../core/types.js';
import { TypeKind } from '../../core/types.js';
import { TypeResolutionCache } from '../../core/cache.js';
import { PluginManager, HookType } from '../../core/plugin/index.js';
import type { ResolveContext } from '../../core/plugin/plugin-types.js';
import { UtilityTypeExpander } from '../utility-type-expander.js';
import { MappedTypeResolver } from '../mapped-type-resolver.js';
import { ConditionalTypeResolver } from '../conditional-type-resolver.js';
import { TemplateLiteralResolver } from '../template-literal-resolver.js';
import { GenericContext } from '../generic-context.js';
import type { ResolverOptions } from './resolver-options.js';
import { ResolutionContextImpl } from './core/resolver-context.js';
import { CacheManager } from './core/cache-manager.js';
import { PrimitiveResolver } from './resolvers/primitive-resolver.js';
import { ArrayResolver } from './resolvers/array-resolver.js';
import { UnionResolver } from './resolvers/union-resolver.js';
import { EnumResolver } from './resolvers/enum-resolver.js';
import { OperatorResolver } from './resolvers/operator-resolver.js';
import { GenericResolver } from './resolvers/generic-resolver.js';
import { ObjectResolver } from './resolvers/object-resolver.js';
import { BuiltInDetector } from './built-in/built-in-detector.js';
import { BuiltInResolver } from './built-in/built-in-resolver.js';

/**
 * Core type resolver that orchestrates the resolution of TypeScript types to TypeInfo objects.
 *
 * This class serves as the main entry point for type resolution, coordinating multiple specialized
 * resolvers to handle different type kinds (primitives, arrays, objects, unions, etc.). It provides
 * caching, circular reference detection, and plugin support through hooks.
 *
 * @example
 * ```typescript
 * const resolver = new TypeResolver({
 *   maxDepth: 50,
 *   expandUtilityTypes: true,
 *   pluginManager: new PluginManager()
 * });
 *
 * const result = await resolver.resolveType(someType);
 * if (result.ok) {
 *   console.log('Resolved type:', result.value);
 * }
 * ```
 */
export class TypeResolver {
  private readonly context: ResolutionContextImpl;
  private readonly cacheManager: CacheManager;
  private readonly pluginManager: PluginManager;
  private readonly utilityTypeExpander: UtilityTypeExpander;
  private readonly mappedTypeResolver: MappedTypeResolver;
  private readonly conditionalTypeResolver: ConditionalTypeResolver;
  private readonly templateLiteralResolver: TemplateLiteralResolver;
  private readonly expandUtilityTypes: boolean;
  private readonly resolveMappedTypes: boolean;
  private readonly resolveConditionalTypes: boolean;
  private readonly resolveTemplateLiterals: boolean;
  private genericContext: GenericContext;

  private readonly primitiveResolver: PrimitiveResolver;
  private readonly arrayResolver: ArrayResolver;
  private readonly unionResolver: UnionResolver;
  private readonly enumResolver: EnumResolver;
  private readonly operatorResolver: OperatorResolver;
  private readonly genericResolver: GenericResolver;
  private readonly objectResolver: ObjectResolver;
  private readonly builtInDetector: BuiltInDetector;
  private readonly builtInResolver: BuiltInResolver;

  /**
   * Creates a new TypeResolver instance with the specified options.
   *
   * @param options - Configuration options for the resolver
   * @param options.maxDepth - Maximum recursion depth (default: 30)
   * @param options.cache - Type resolution cache instance
   * @param options.pluginManager - Plugin manager for hooks
   * @param options.expandUtilityTypes - Whether to expand utility types (default: true)
   * @param options.resolveMappedTypes - Whether to resolve mapped types (default: true)
   * @param options.resolveConditionalTypes - Whether to resolve conditional types (default: true)
   * @param options.resolveTemplateLiterals - Whether to resolve template literals (default: true)
   */
  constructor(options: ResolverOptions = {}) {
    const maxDepth = options.maxDepth ?? 30;
    const cache = options.cache ?? new TypeResolutionCache();

    this.context = new ResolutionContextImpl(maxDepth);
    this.cacheManager = new CacheManager(cache);
    this.pluginManager = options.pluginManager ?? new PluginManager();
    this.expandUtilityTypes = options.expandUtilityTypes ?? true;
    this.resolveMappedTypes = options.resolveMappedTypes ?? true;
    this.resolveConditionalTypes = options.resolveConditionalTypes ?? true;
    this.resolveTemplateLiterals = options.resolveTemplateLiterals ?? true;

    this.utilityTypeExpander = new UtilityTypeExpander({ maxDepth });
    this.mappedTypeResolver = new MappedTypeResolver({ maxDepth });
    this.conditionalTypeResolver = new ConditionalTypeResolver({ maxDepth });
    this.templateLiteralResolver = new TemplateLiteralResolver({ maxDepth });
    this.genericContext = new GenericContext();

    const resolveTypeFn = this.resolveType.bind(this);
    this.primitiveResolver = new PrimitiveResolver();
    this.arrayResolver = new ArrayResolver(resolveTypeFn);
    this.unionResolver = new UnionResolver(resolveTypeFn);
    this.enumResolver = new EnumResolver();
    this.operatorResolver = new OperatorResolver();
    this.genericResolver = new GenericResolver(resolveTypeFn);
    this.objectResolver = new ObjectResolver(resolveTypeFn, this.pluginManager);
    this.builtInDetector = new BuiltInDetector();
    this.builtInResolver = new BuiltInResolver(resolveTypeFn);
  }

  /**
   * Resolves a TypeScript Type to a TypeInfo object.
   *
   * This is the main public method that orchestrates the type resolution process.
   * It handles caching, circular reference detection, plugin hooks, and delegates to
   * appropriate specialized resolvers.
   *
   * @param type - The TypeScript Type to resolve
   * @param depth - Current recursion depth (default: 0)
   * @param context - Generic context for type parameter resolution
   * @returns Promise resolving to Result containing TypeInfo or error
   *
   * @example
   * ```typescript
   * const result = await resolver.resolveType(stringType);
   * if (result.ok) {
   *   console.log('Type kind:', result.value.kind); // 'primitive'
   *   console.log('Type name:', result.value.name); // 'string'
   * }
   * ```
   */
  async resolveType(type: Type, depth = 0, context?: GenericContext): Promise<Result<TypeInfo>> {
    const ctx = context ?? this.genericContext;

    if (this.context.exceedsMaxDepth(depth)) {
      return err(new Error(`Max resolution depth (${this.context.maxDepth}) exceeded`));
    }

    const typeString = type.getText();
    const cacheKey = this.cacheManager.generateKey({ typeString, context: ctx });

    const cachedResult = this.cacheManager.get(cacheKey);
    if (cachedResult) {
      return ok(cachedResult);
    }

    if (this.context.isVisited(typeString)) {
      return ok({
        kind: TypeKind.Reference,
        name: typeString,
      });
    }

    this.context.markVisited(typeString);

    try {
      const resolveContext = this.createResolveContext(type);

      const hookResult = await this.pluginManager.executeHook({
        hookType: HookType.BeforeResolve,
        input: resolveContext,
      });

      if (!hookResult.ok) {
        return hookResult;
      }

      const specializedResult = await this.trySpecializedResolvers({ type, depth, context: ctx });
      if (specializedResult) {
        return this.finalizeResolution({
          typeInfo: specializedResult,
          type,
          typeString,
          cacheKey,
        });
      }

      const typeInfo = await this.resolveTypeCore({ type, depth, context: ctx });
      if (!typeInfo.ok) return typeInfo;

      return this.finalizeResolution({
        typeInfo: typeInfo.value,
        type,
        typeString,
        cacheKey,
      });
    } catch (error) {
      this.context.unmarkVisited(typeString);
      return err(new Error(`Failed to resolve type: ${formatError(error)}`));
    }
  }

  private extractSuccessfulResult<T>(result: Result<T | null>): T | null {
    return result.ok && result.value ? result.value : null;
  }

  private createResolveContext(type: Type): ResolveContext {
    const symbol = type.getSymbol();
    return {
      type,
      ...(symbol && { symbol }),
    };
  }

  private async trySpecializedResolvers(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<TypeInfo | null> {
    const { type, depth, context } = params;

    if (this.expandUtilityTypes) {
      const result = await this.utilityTypeExpander.expandUtilityType({
        type,
        resolveType: (t, d) => this.resolveType(t, d, context),
        depth,
        genericContext: context,
      });
      const typeInfo = this.extractSuccessfulResult(result);
      if (typeInfo) return typeInfo;
    }

    if (this.resolveConditionalTypes) {
      const result = await this.conditionalTypeResolver.resolveConditionalType({
        type,
        depth,
      });
      const typeInfo = this.extractSuccessfulResult(result);
      if (typeInfo) return typeInfo;
    }

    if (this.resolveMappedTypes) {
      const result = await this.mappedTypeResolver.resolveMappedType({
        type,
        resolveType: (t, d) => this.resolveType(t, d, context),
        depth,
      });
      const typeInfo = this.extractSuccessfulResult(result);
      if (typeInfo) return typeInfo;
    }

    if (this.resolveTemplateLiterals) {
      const result = await this.templateLiteralResolver.resolveTemplateLiteral({
        type,
        resolveType: (t, d) => this.resolveType(t, d, context),
        depth,
      });
      const typeInfo = this.extractSuccessfulResult(result);
      if (typeInfo) return typeInfo;
    }

    return null;
  }

  private async resolveTypeCore(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;

    const primitiveResult = this.primitiveResolver.resolvePrimitive({ type });
    if (primitiveResult) {
      return primitiveResult;
    }

    const literalResult = this.primitiveResolver.resolveLiteral({ type });
    if (literalResult) {
      return literalResult;
    }

    if (type.isTypeParameter()) {
      return this.genericResolver.resolveTypeParameter({ type, depth, context });
    }

    if (type.isArray()) {
      return this.arrayResolver.resolveArray({ type, depth, context });
    }

    if (type.isTuple()) {
      return this.arrayResolver.resolveTuple({ type, depth, context });
    }

    if (type.isEnum()) {
      return this.enumResolver.resolveEnum({ type });
    }

    if (type.isUnion()) {
      return this.unionResolver.resolveUnion({ type, depth, context });
    }

    if (type.isIntersection()) {
      return this.unionResolver.resolveIntersection({ type, depth, context });
    }

    if (this.operatorResolver.isKeyofType(type)) {
      return this.operatorResolver.resolveKeyof({ type });
    }

    if (this.operatorResolver.isTypeofType(type)) {
      return this.operatorResolver.resolveTypeof({ type });
    }

    if (this.operatorResolver.isIndexAccessType(type)) {
      return this.operatorResolver.resolveIndexAccess({ type });
    }

    if (this.builtInDetector.isNodeJSBuiltInType(type)) {
      return this.builtInResolver.resolveNodeJSBuiltInType({ type });
    }

    if (this.builtInDetector.isBuiltInType(type)) {
      return this.builtInResolver.resolveBuiltInType({ type, depth, context });
    }

    if (type.isObject() || type.isInterface()) {
      return this.objectResolver.resolveObject({ type, depth, context });
    }

    return ok({ kind: TypeKind.Unknown });
  }

  private async finalizeResolution(params: {
    typeInfo: TypeInfo;
    type: Type;
    typeString: string;
    cacheKey: string;
  }): Promise<Result<TypeInfo>> {
    const { typeInfo, type, typeString, cacheKey } = params;

    const resolveContext = this.createResolveContext(type);

    const afterHook = await this.pluginManager.executeHook({
      hookType: HookType.AfterResolve,
      input: resolveContext,
      additionalArgs: [typeInfo],
    });

    this.context.unmarkVisited(typeString);

    if (afterHook.ok) {
      this.cacheManager.set(cacheKey, typeInfo);
      return ok(typeInfo);
    }

    return afterHook;
  }

  /**
   * Clears the visited types tracking.
   *
   * This method resets the circular reference detection state, allowing types
   * that were previously marked as visited to be processed again.
   */
  clearVisited(): void {
    this.context.resetState();
  }

  /**
   * Resets the entire resolver state.
   *
   * This method clears both the visited types tracking and the generic context,
   * essentially returning the resolver to its initial state.
   */
  resetState(): void {
    this.context.resetState();
    this.resetGenericContext();
  }

  /**
   * Gets the current generic context.
   *
   * The generic context tracks type parameter mappings during resolution,
   * allowing proper handling of generic types and their instantiations.
   *
   * @returns The current GenericContext instance
   */
  getGenericContext(): GenericContext {
    return this.genericContext;
  }

  /**
   * Resets the generic context to a fresh instance.
   *
   * This clears all type parameter mappings and starts with a clean context.
   */
  resetGenericContext(): void {
    this.genericContext = new GenericContext();
  }
}
