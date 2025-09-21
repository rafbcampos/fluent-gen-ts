import type { TypeInfo, GenericParam } from '../core/types.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';

/**
 * Tracks generic type parameters through the resolution process.
 * This allows us to bubble up unresolved generics to the builder generation phase.
 */
export class GenericContext {
  private readonly genericParams = new Map<string, GenericParam>();
  private readonly typeArguments = new Map<string, TypeInfo>();
  private readonly parentContext: GenericContext | undefined;
  private allGenericParamsCache: GenericParam[] | undefined;
  private isAllGenericParamsCacheDirty = true;

  constructor(params?: { parentContext?: GenericContext }) {
    this.parentContext = params?.parentContext;
  }

  /**
   * Register a generic parameter with its constraints and defaults
   */
  registerGenericParam(params: { param: GenericParam }): Result<void> {
    const { param } = params;

    if (!param.name || typeof param.name !== 'string') {
      return err(new Error('Generic parameter name must be a non-empty string'));
    }

    // Check for circular reference in constraints
    if (param.constraint && this.hasCircularConstraint(param.name, param.constraint)) {
      return err(new Error(`Circular constraint detected for parameter '${param.name}'`));
    }

    this.genericParams.set(param.name, param);
    this.invalidateCache();

    return ok(undefined);
  }

  /**
   * Register multiple generic parameters
   */
  registerGenericParams(params: { params: readonly GenericParam[] }): Result<void> {
    const { params: genericParams } = params;

    // Validate all parameters first
    for (const param of genericParams) {
      if (!param.name || typeof param.name !== 'string') {
        return err(new Error('Generic parameter name must be a non-empty string'));
      }

      if (param.constraint && this.hasCircularConstraint(param.name, param.constraint)) {
        return err(new Error(`Circular constraint detected for parameter '${param.name}'`));
      }
    }

    // If all are valid, register them all
    for (const param of genericParams) {
      this.genericParams.set(param.name, param);
    }

    this.invalidateCache();
    return ok(undefined);
  }

  /**
   * Set a type argument for a generic parameter
   */
  setTypeArgument(params: { paramName: string; type: TypeInfo }): Result<void> {
    const { paramName, type } = params;

    if (!paramName || typeof paramName !== 'string') {
      return err(new Error('Parameter name must be a non-empty string'));
    }

    if (!this.isGenericParam(paramName)) {
      return err(new Error(`Parameter '${paramName}' is not registered in this context`));
    }

    this.typeArguments.set(paramName, type);
    return ok(undefined);
  }

  /**
   * Get the resolved type for a generic parameter
   */
  getResolvedType(paramName: string): TypeInfo | undefined {
    // First check if we have a concrete type argument
    const typeArg = this.typeArguments.get(paramName);
    if (typeArg) return typeArg;

    // Check parent context
    if (this.parentContext) {
      const parentResolved = this.parentContext.getResolvedType(paramName);
      if (parentResolved) return parentResolved;
    }

    // Don't automatically resolve to default - let the caller decide
    // This preserves generic parameters in builder generation
    return undefined;
  }

  /**
   * Get a generic parameter definition
   */
  getGenericParam(paramName: string): GenericParam | undefined {
    const param = this.genericParams.get(paramName);
    if (param) return param;

    // Check parent context
    return this.parentContext?.getGenericParam(paramName);
  }

  /**
   * Get the default type for a generic parameter if available
   */
  getDefaultType(paramName: string): TypeInfo | undefined {
    const param = this.getGenericParam(paramName);
    return param?.default;
  }

  /**
   * Get all unresolved generic parameters
   */
  getUnresolvedGenerics(): GenericParam[] {
    const unresolved: GenericParam[] = [];

    for (const [name, param] of this.genericParams) {
      if (!this.typeArguments.has(name)) {
        unresolved.push(param);
      }
    }

    return unresolved;
  }

  /**
   * Create a child context for nested type resolution
   */
  createChildContext(): GenericContext {
    return new GenericContext({ parentContext: this });
  }

  /**
   * Merge generics from another context
   */
  merge(params: {
    other: GenericContext;
    strategy?: 'keep-existing' | 'overwrite' | 'error-on-conflict';
  }): Result<void> {
    const { other, strategy = 'keep-existing' } = params;

    const conflicts: string[] = [];

    // Check for parameter conflicts
    for (const [name, param] of other.genericParams) {
      const existing = this.genericParams.get(name);
      if (existing) {
        conflicts.push(name);

        if (strategy === 'error-on-conflict') {
          return err(new Error(`Conflicting generic parameter '${name}' found during merge`));
        } else if (strategy === 'overwrite') {
          this.genericParams.set(name, param);
        }
        // keep-existing: do nothing
      } else {
        this.genericParams.set(name, param);
      }
    }

    // Check for type argument conflicts
    for (const [name, type] of other.typeArguments) {
      const existing = this.typeArguments.get(name);
      if (existing) {
        if (strategy === 'error-on-conflict') {
          return err(new Error(`Conflicting type argument '${name}' found during merge`));
        } else if (strategy === 'overwrite') {
          this.typeArguments.set(name, type);
        }
        // keep-existing: do nothing
      } else {
        this.typeArguments.set(name, type);
      }
    }

    this.invalidateCache();

    return ok(undefined);
  }

  /**
   * Check if a type name refers to a generic parameter
   */
  isGenericParam(typeName: string): boolean {
    return (
      this.genericParams.has(typeName) || (this.parentContext?.isGenericParam(typeName) ?? false)
    );
  }

  /**
   * Get all generic parameters (including from parent contexts)
   * Uses caching for performance optimization
   */
  getAllGenericParams(): GenericParam[] {
    if (!this.isAllGenericParamsCacheDirty && this.allGenericParamsCache) {
      return this.allGenericParamsCache;
    }

    const allParams = new Map<string, GenericParam>();

    // Start with parent context params
    if (this.parentContext) {
      const parentParams = this.parentContext.getAllGenericParams();
      for (const param of parentParams) {
        allParams.set(param.name, param);
      }
    }

    // Override with our params
    for (const [name, param] of this.genericParams) {
      allParams.set(name, param);
    }

    this.allGenericParamsCache = Array.from(allParams.values());
    this.isAllGenericParamsCacheDirty = false;

    return this.allGenericParamsCache;
  }

  /**
   * Clone the context for independent resolution branches
   */
  clone(): GenericContext {
    const cloned = this.parentContext
      ? new GenericContext({ parentContext: this.parentContext })
      : new GenericContext();

    for (const [name, param] of this.genericParams) {
      cloned.genericParams.set(name, param);
    }

    for (const [name, type] of this.typeArguments) {
      cloned.typeArguments.set(name, type);
    }

    return cloned;
  }

  /**
   * Private helper methods
   */

  /**
   * Invalidate the cache when parameters change
   */
  private invalidateCache(): void {
    this.isAllGenericParamsCacheDirty = true;
    this.allGenericParamsCache = undefined;
  }

  /**
   * Check for circular constraints in generic parameters
   */
  private hasCircularConstraint(
    paramName: string,
    constraint: TypeInfo,
    visited = new Set<string>(),
  ): boolean {
    if (visited.has(paramName)) {
      return true;
    }

    visited.add(paramName);

    // For now, we only check basic reference types for circularity
    // In a full implementation, this would recursively check all constraint types
    if (constraint.kind === 'reference' && constraint.name === paramName) {
      return true;
    }

    // Check if constraint references any previously visited parameters
    if (constraint.kind === 'reference' && visited.has(constraint.name)) {
      return true;
    }

    return false;
  }
}
