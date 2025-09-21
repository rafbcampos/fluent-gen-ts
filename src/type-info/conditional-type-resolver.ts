import { Type, ts } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { TypeInfo } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import type { GenericContext } from './generic-context.js';

export interface ConditionalTypeResolverOptions {
  readonly maxDepth?: number;
  readonly genericContext?: GenericContext;
}

export interface ResolveConditionalTypeParams {
  readonly type: Type;
  readonly depth?: number;
}

/**
 * Handles conditional types that haven't been resolved by TypeScript.
 *
 * In most cases, TypeScript will have already resolved conditional types
 * to their result (e.g., `T extends string ? true : false` becomes `true`
 * when T is string). This resolver only handles edge cases where the
 * conditional depends on unresolved generic parameters.
 */
export class ConditionalTypeResolver {
  private readonly maxDepth: number;
  private readonly genericContext: GenericContext | undefined;

  constructor(options: ConditionalTypeResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
    this.genericContext = options.genericContext;
  }

  async resolveConditionalType(
    params: ResolveConditionalTypeParams,
  ): Promise<Result<TypeInfo | null>> {
    const { type, depth = 0 } = params;

    if (depth > this.maxDepth) {
      return err(new Error(`Max conditional type resolution depth exceeded`));
    }

    // Most conditional types are already resolved by TypeScript.
    // We only need to handle unresolved cases (e.g., dependent on generic parameters).
    if (!this.isUnresolvedConditionalType(type)) {
      return ok(null);
    }

    // For unresolved conditionals, return as generic for builder generation
    return this.handleUnresolvedConditional(type);
  }

  private isUnresolvedConditionalType(type: Type): boolean {
    // Check using TypeScript's Conditional flag
    const tsType = type.compilerType as ts.Type;
    return !!(tsType.flags & ts.TypeFlags.Conditional);
  }

  private handleUnresolvedConditional(type: Type): Result<TypeInfo | null> {
    // For unresolved conditional types that depend on generic parameters,
    // we preserve them as generics that will be resolved at instantiation time.
    // This allows the builder to be generic: Builder<T> where T is the unresolved conditional.

    const typeText = type.getText();

    // Extract generic parameters from the conditional type if possible
    // The type text might be something like "T extends string ? number : boolean"
    // We want to identify T as a generic parameter

    // Since this conditional depends on unresolved generics, we return it as a Generic type
    // that preserves the conditional nature in its metadata
    const typeInfo: TypeInfo = {
      kind: TypeKind.Generic,
      name: typeText,
      // Mark this as a conditional type for downstream processing
      // The builder generator can use this to create appropriate generic constraints
    };

    // If we have a generic context, register this as an unresolved generic
    if (this.genericContext) {
      // Extract the generic parameter name from the conditional
      // For simple cases like "T extends ...", the check type is T
      const genericParamMatch = typeText.match(/^(\w+)\s+extends/);
      if (genericParamMatch && genericParamMatch[1]) {
        const paramName = genericParamMatch[1];

        // Check if this is already a known generic parameter
        if (this.genericContext.isGenericParam(paramName)) {
          // It's already tracked, just return the generic reference
          return ok({
            kind: TypeKind.Generic,
            name: paramName,
          });
        }
      }
    }

    return ok(typeInfo);
  }
}
