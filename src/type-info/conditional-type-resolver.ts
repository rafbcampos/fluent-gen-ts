import { Type, ts } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { TypeInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";

export interface ConditionalTypeResolverOptions {
  readonly maxDepth?: number;
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

  constructor(options: ConditionalTypeResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
  }

  async resolveConditionalType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth = 0,
  ): Promise<Result<TypeInfo | null>> {
    if (depth > this.maxDepth) {
      return err(new Error(`Max conditional type resolution depth exceeded`));
    }

    // Most conditional types are already resolved by TypeScript.
    // We only need to handle unresolved cases (e.g., dependent on generic parameters).
    if (!this.isUnresolvedConditionalType(type)) {
      return ok(null);
    }

    // For unresolved conditional types, we can't determine which branch to take.
    // Return a union of both possibilities or mark as unknown.
    return this.handleUnresolvedConditional(type, resolveType, depth);
  }

  private isUnresolvedConditionalType(type: Type): boolean {
    // If the type has properties or is a primitive/literal, it's already resolved
    if (
      type.getProperties().length > 0 ||
      type.isLiteral() ||
      type.isString() ||
      type.isNumber() ||
      type.isBoolean()
    ) {
      return false;
    }

    // Check if this looks like an unresolved conditional (contains type parameters)
    const typeText = type.getText();
    const symbol = type.getSymbol();
    const symbolName = symbol?.getName();

    // Check for patterns that indicate unresolved conditionals:
    // - Type alias that contains type parameters (e.g., "IsArray<T>")
    // - Contains angle brackets indicating generic usage
    // - Not a built-in type
    if (symbolName && typeText.includes("<") && typeText.includes(">")) {
      // But exclude already resolved utility types
      if (symbolName === "__type" || symbolName === "Anonymous") {
        return false;
      }

      // Check using TypeScript's internal flags as a fallback
      const tsType = type.compilerType as ts.Type;
      if (tsType && "flags" in tsType) {
        // TypeScript TypeFlags.Conditional = 16777216
        return (tsType.flags & 16777216) !== 0;
      }

      return true;
    }

    return false;
  }

  private async handleUnresolvedConditional(
    type: Type,
    _resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    _depth: number,
  ): Promise<Result<TypeInfo | null>> {
    // For unresolved conditional types that depend on generic parameters,
    // we can't determine which branch will be taken at code generation time.
    // Builders need to handle this at the generic instantiation level.

    const typeText = type.getText();
    const symbol = type.getSymbol();

    // Return a generic type info that preserves the conditional nature
    return ok({
      kind: TypeKind.Generic,
      name: symbol?.getName() || typeText,
      // The actual resolution would happen when the generic is instantiated
    });
  }
}

