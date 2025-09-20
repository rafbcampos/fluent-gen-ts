import type { TypeInfo, GenericParam } from "../core/types.js";

/**
 * Tracks generic type parameters through the resolution process.
 * This allows us to bubble up unresolved generics to the builder generation phase.
 */
export class GenericContext {
  private readonly genericParams = new Map<string, GenericParam>();
  private readonly typeArguments = new Map<string, TypeInfo>();
  private readonly parentContext: GenericContext | undefined;

  constructor(parentContext?: GenericContext) {
    this.parentContext = parentContext;
  }

  /**
   * Register a generic parameter with its constraints and defaults
   */
  registerGenericParam(param: GenericParam): void {
    this.genericParams.set(param.name, param);
  }

  /**
   * Register multiple generic parameters
   */
  registerGenericParams(params: readonly GenericParam[]): void {
    for (const param of params) {
      this.registerGenericParam(param);
    }
  }

  /**
   * Set a type argument for a generic parameter
   */
  setTypeArgument(paramName: string, type: TypeInfo): void {
    this.typeArguments.set(paramName, type);
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
    return new GenericContext(this);
  }

  /**
   * Merge generics from another context
   */
  merge(other: GenericContext): void {
    for (const [name, param] of other.genericParams) {
      if (!this.genericParams.has(name)) {
        this.genericParams.set(name, param);
      }
    }

    for (const [name, type] of other.typeArguments) {
      if (!this.typeArguments.has(name)) {
        this.typeArguments.set(name, type);
      }
    }
  }

  /**
   * Check if a type name refers to a generic parameter
   */
  isGenericParam(typeName: string): boolean {
    return this.genericParams.has(typeName) ||
           (this.parentContext?.isGenericParam(typeName) ?? false);
  }

  /**
   * Get all generic parameters (including from parent contexts)
   */
  getAllGenericParams(): GenericParam[] {
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

    return Array.from(allParams.values());
  }

  /**
   * Clone the context for independent resolution branches
   */
  clone(): GenericContext {
    const cloned = new GenericContext(this.parentContext);

    for (const [name, param] of this.genericParams) {
      cloned.genericParams.set(name, param);
    }

    for (const [name, type] of this.typeArguments) {
      cloned.typeArguments.set(name, type);
    }

    return cloned;
  }
}