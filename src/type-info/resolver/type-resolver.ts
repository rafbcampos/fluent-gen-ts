import type { Type } from 'ts-morph';
import type { Result } from '../../core/result.js';
import { ok, err } from '../../core/result.js';
import type { TypeInfo } from '../../core/types.js';
import { TypeKind } from '../../core/types.js';
import { TypeResolutionCache } from '../../core/cache.js';
import { PluginManager, HookType } from '../../core/plugin/index.js';
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
      const hookResult = await this.pluginManager.executeHook({
        hookType: HookType.BeforeResolve,
        input: { type, symbol: type.getSymbol() },
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
      return err(new Error(`Failed to resolve type: ${error}`));
    }
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
      if (result.ok && result.value) {
        return result.value;
      }
    }

    if (this.resolveConditionalTypes) {
      const result = await this.conditionalTypeResolver.resolveConditionalType({
        type,
        depth,
      });
      if (result.ok && result.value) {
        return result.value;
      }
    }

    if (this.resolveMappedTypes) {
      const result = await this.mappedTypeResolver.resolveMappedType({
        type,
        resolveType: (t, d) => this.resolveType(t, d, context),
        depth,
      });
      if (result.ok && result.value) {
        return result.value;
      }
    }

    if (this.resolveTemplateLiterals) {
      const result = await this.templateLiteralResolver.resolveTemplateLiteral({
        type,
        resolveType: (t, d) => this.resolveType(t, d, context),
        depth,
      });
      if (result.ok && result.value) {
        return result.value;
      }
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

    const afterHook = await this.pluginManager.executeHook({
      hookType: HookType.AfterResolve,
      input: { type, symbol: type.getSymbol() },
      additionalArgs: [typeInfo],
    });

    this.context.unmarkVisited(typeString);

    if (afterHook.ok) {
      this.cacheManager.set(cacheKey, typeInfo);
      return ok(typeInfo);
    }

    return afterHook;
  }

  clearVisited(): void {
    this.context.resetState();
  }

  resetState(): void {
    this.context.resetState();
    this.resetGenericContext();
  }

  getGenericContext(): GenericContext {
    return this.genericContext;
  }

  resetGenericContext(): void {
    this.genericContext = new GenericContext();
  }
}
