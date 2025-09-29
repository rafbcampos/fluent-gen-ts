import type { TypeInfo, GenericParam } from '../core/types.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';

/**
 * Tracks generic type parameters through the resolution process.
 * This allows us to bubble up unresolved generics to the builder generation phase.
 *
 * Supports hierarchical contexts for nested generic scopes and provides
 * circular constraint detection to prevent invalid type definitions.
 *
 * @example
 * ```typescript
 * const context = new GenericContext();
 *
 * // Register a generic parameter
 * const result = context.registerGenericParam({
 *   param: { name: 'T', constraint: { kind: TypeKind.Primitive, name: 'string' } }
 * });
 *
 * // Set a concrete type for the parameter
 * context.setTypeArgument({ paramName: 'T', type: { kind: TypeKind.Primitive, name: 'string' } });
 *
 * // Check resolved type
 * const resolved = context.getResolvedType('T');
 * ```
 */
export class GenericContext {
  private readonly genericParams = new Map<string, GenericParam>();
  private readonly typeArguments = new Map<string, TypeInfo>();
  private readonly parentContext: GenericContext | undefined;
  private allGenericParamsCache: GenericParam[] | undefined;
  private isAllGenericParamsCacheDirty = true;

  /**
   * Creates a new GenericContext.
   *
   * @param params - Optional configuration object
   * @param params.parentContext - Parent context for hierarchical generic scopes
   */
  constructor(params?: { parentContext?: GenericContext }) {
    this.parentContext = params?.parentContext;
  }

  /**
   * Register a generic parameter with its constraints and defaults.
   * Validates the parameter name and checks for circular constraints.
   *
   * @param params - Parameters object
   * @param params.param - The generic parameter to register
   * @returns Result indicating success or failure with error details
   *
   * @example
   * ```typescript
   * const result = context.registerGenericParam({
   *   param: {
   *     name: 'T',
   *     constraint: { kind: TypeKind.Reference, name: 'BaseClass' },
   *     default: { kind: TypeKind.Primitive, name: 'any' }
   *   }
   * });
   * ```
   */
  registerGenericParam(params: { param: GenericParam }): Result<void> {
    const { param } = params;

    const validationResult = this.validateGenericParam(param);
    if (!validationResult.ok) {
      return validationResult;
    }

    this.genericParams.set(param.name, param);
    this.invalidateCache();

    return ok(undefined);
  }

  /**
   * Register multiple generic parameters in a single operation.
   * All parameters are validated before any are registered (atomic operation).
   *
   * @param params - Parameters object
   * @param params.params - Array of generic parameters to register
   * @returns Result indicating success or failure with error details
   *
   * @example
   * ```typescript
   * const result = context.registerGenericParams({
   *   params: [
   *     { name: 'T', constraint: { kind: TypeKind.Primitive, name: 'string' } },
   *     { name: 'U', default: { kind: TypeKind.Primitive, name: 'number' } }
   *   ]
   * });
   * ```
   */
  registerGenericParams(params: { params: readonly GenericParam[] }): Result<void> {
    const { params: genericParams } = params;

    // Validate all parameters first
    for (const param of genericParams) {
      const validationResult = this.validateGenericParam(param);
      if (!validationResult.ok) {
        return validationResult;
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
   * Set a concrete type argument for a generic parameter.
   * The parameter must be registered before setting its type argument.
   *
   * @param params - Parameters object
   * @param params.paramName - Name of the generic parameter
   * @param params.type - Concrete type to assign to the parameter
   * @returns Result indicating success or failure with error details
   *
   * @example
   * ```typescript
   * const result = context.setTypeArgument({
   *   paramName: 'T',
   *   type: { kind: TypeKind.Primitive, name: 'string' }
   * });
   * ```
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
   * Get the resolved concrete type for a generic parameter.
   * Returns undefined if the parameter has no concrete type assignment.
   * Does not return default types - use getDefaultType() for that.
   *
   * @param paramName - Name of the generic parameter
   * @returns Concrete type if assigned, undefined otherwise
   *
   * @example
   * ```typescript
   * const resolved = context.getResolvedType('T');
   * if (resolved) {
   *   console.log('T is resolved to:', resolved);
   * }
   * ```
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
   * Get the definition of a registered generic parameter.
   * Searches the current context and parent contexts.
   *
   * @param paramName - Name of the generic parameter
   * @returns Parameter definition if found, undefined otherwise
   */
  getGenericParam(paramName: string): GenericParam | undefined {
    const param = this.genericParams.get(paramName);
    if (param) return param;

    // Check parent context
    return this.parentContext?.getGenericParam(paramName);
  }

  /**
   * Get the default type for a generic parameter if specified.
   *
   * @param paramName - Name of the generic parameter
   * @returns Default type if specified, undefined otherwise
   */
  getDefaultType(paramName: string): TypeInfo | undefined {
    const param = this.getGenericParam(paramName);
    return param?.default;
  }

  /**
   * Get all generic parameters that don't have concrete type arguments.
   * This is useful for identifying which generics need to be preserved
   * in builder generation.
   *
   * @returns Array of unresolved generic parameters
   *
   * @example
   * ```typescript
   * const unresolved = context.getUnresolvedGenerics();
   * console.log('Unresolved generics:', unresolved.map(p => p.name));
   * ```
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
   * Create a child context for nested type resolution.
   * Child contexts inherit parameters from parent but can override them.
   *
   * @returns New child context with this context as parent
   *
   * @example
   * ```typescript
   * const parent = new GenericContext();
   * parent.registerGenericParam({ param: { name: 'T' } });
   *
   * const child = parent.createChildContext();
   * child.registerGenericParam({ param: { name: 'U' } });
   *
   * // Child can see both T and U
   * console.log(child.isGenericParam('T')); // true
   * console.log(child.isGenericParam('U')); // true
   * ```
   */
  createChildContext(): GenericContext {
    return new GenericContext({ parentContext: this });
  }

  /**
   * Merge generic parameters and type arguments from another context.
   * Provides different strategies for handling conflicts.
   *
   * @param params - Parameters object
   * @param params.other - Context to merge from
   * @param params.strategy - Conflict resolution strategy:
   *   - 'keep-existing': Keep existing values (default)
   *   - 'overwrite': Replace existing values with new ones
   *   - 'error-on-conflict': Return error if conflicts exist
   * @returns Result indicating success or failure with error details
   *
   * @example
   * ```typescript
   * const context1 = new GenericContext();
   * const context2 = new GenericContext();
   *
   * context1.registerGenericParam({ param: { name: 'T' } });
   * context2.registerGenericParam({ param: { name: 'U' } });
   *
   * const result = context1.merge({ other: context2 });
   * // context1 now has both T and U
   * ```
   */
  merge(params: {
    other: GenericContext;
    strategy?: 'keep-existing' | 'overwrite' | 'error-on-conflict';
  }): Result<void> {
    const { other, strategy = 'keep-existing' } = params;

    // Merge generic parameters
    const paramResult = this.mergeMap(
      other.genericParams,
      this.genericParams,
      strategy,
      'generic parameter',
    );
    if (!paramResult.ok) {
      return paramResult;
    }

    // Merge type arguments
    const argResult = this.mergeMap(
      other.typeArguments,
      this.typeArguments,
      strategy,
      'type argument',
    );
    if (!argResult.ok) {
      return argResult;
    }

    this.invalidateCache();

    return ok(undefined);
  }

  /**
   * Check if a type name refers to a registered generic parameter.
   * Searches current context and parent contexts.
   *
   * @param typeName - Type name to check
   * @returns True if the name refers to a generic parameter
   */
  isGenericParam(typeName: string): boolean {
    return (
      this.genericParams.has(typeName) || (this.parentContext?.isGenericParam(typeName) ?? false)
    );
  }

  /**
   * Get all generic parameters including those from parent contexts.
   * Returns a flattened array with child parameters overriding parent parameters
   * when names conflict. Uses caching for performance when no parent context exists.
   *
   * @returns Array of all generic parameters in the context hierarchy
   *
   * @example
   * ```typescript
   * const parent = new GenericContext();
   * parent.registerGenericParam({ param: { name: 'T' } });
   *
   * const child = parent.createChildContext();
   * child.registerGenericParam({ param: { name: 'U' } });
   *
   * const allParams = child.getAllGenericParams();
   * console.log(allParams.map(p => p.name)); // ['T', 'U']
   * ```
   */
  getAllGenericParams(): GenericParam[] {
    // Only use cache if we have no parent context to avoid stale data from parent changes
    if (!this.parentContext && !this.isAllGenericParamsCacheDirty && this.allGenericParamsCache) {
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

    const result = Array.from(allParams.values());

    // Only cache if we have no parent context
    if (!this.parentContext) {
      this.allGenericParamsCache = result;
      this.isAllGenericParamsCacheDirty = false;
    }

    return result;
  }

  /**
   * Clone the context for independent resolution branches.
   * Creates a shallow copy with the same parent context but independent state.
   *
   * @returns Cloned context with same parent but independent parameters and type arguments
   *
   * @example
   * ```typescript
   * const original = new GenericContext();
   * original.registerGenericParam({ param: { name: 'T' } });
   *
   * const cloned = original.clone();
   * cloned.setTypeArgument({ paramName: 'T', type: stringType });
   *
   * // Original is unaffected by changes to clone
   * console.log(original.getResolvedType('T')); // undefined
   * console.log(cloned.getResolvedType('T')); // stringType
   * ```
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
   * Validate a generic parameter for common validation rules
   */
  private validateGenericParam(param: GenericParam): Result<void> {
    if (!param.name || typeof param.name !== 'string') {
      return err(new Error('Generic parameter name must be a non-empty string'));
    }

    // Check for circular reference in constraints
    if (param.constraint && this.hasCircularConstraint(param.name, param.constraint)) {
      return err(new Error(`Circular constraint detected for parameter '${param.name}'`));
    }

    return ok(undefined);
  }

  /**
   * Helper method to merge two maps with conflict resolution
   */
  private mergeMap<T>(
    sourceMap: Map<string, T>,
    targetMap: Map<string, T>,
    strategy: 'keep-existing' | 'overwrite' | 'error-on-conflict',
    itemType: string,
  ): Result<void> {
    for (const [name, item] of sourceMap) {
      const existing = targetMap.get(name);
      if (existing) {
        if (strategy === 'error-on-conflict') {
          return err(new Error(`Conflicting ${itemType} '${name}' found during merge`));
        } else if (strategy === 'overwrite') {
          targetMap.set(name, item);
        }
        // keep-existing: do nothing
      } else {
        targetMap.set(name, item);
      }
    }

    return ok(undefined);
  }

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
  private hasCircularConstraint(paramName: string, constraint: TypeInfo): boolean {
    // Check direct self-reference
    if (constraint.kind === 'reference' && constraint.name === paramName) {
      return true;
    }

    // For reference types, check if we would create a cycle
    if (constraint.kind === 'reference') {
      const constraintTarget = constraint.name;

      // Check if the constraint target already transitively depends on this parameter
      return this.wouldCreateCycle(paramName, constraintTarget, new Set());
    }

    return false;
  }

  /**
   * Check if making paramName depend on targetName would create a cycle
   */
  private wouldCreateCycle(
    paramName: string,
    targetName: string,
    visited = new Set<string>(),
  ): boolean {
    // If targetName depends on paramName (directly or transitively), adding paramName -> targetName creates a cycle
    return this.dependsOn(targetName, paramName, visited);
  }

  /**
   * Check if paramA transitively depends on paramB
   */
  private dependsOn(paramA: string, paramB: string, visited = new Set<string>()): boolean {
    if (paramA === paramB) {
      return true;
    }

    if (visited.has(paramA)) {
      return false; // Prevent infinite recursion
    }

    visited.add(paramA);

    const param = this.genericParams.get(paramA);
    if (!param || !param.constraint || param.constraint.kind !== 'reference') {
      return false;
    }

    // Check if paramA's constraint depends on paramB
    return this.dependsOn(param.constraint.name, paramB, visited);
  }
}
