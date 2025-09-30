import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher } from '../matcher-base.js';
import { hasName } from '../type-guards.js';

/**
 * Matcher for primitive types
 */
export class PrimitiveMatcher extends BaseTypeMatcher {
  constructor(private readonly names: string[]) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Primitive) {
      return false;
    }

    if (this.names.length === 0) {
      return true; // Match any primitive
    }

    return hasName(typeInfo) && this.names.includes(typeInfo.name);
  }

  describe(): string {
    if (this.names.length === 0) {
      return 'primitive';
    }
    return `primitive(${this.names.join(' | ')})`;
  }
}

/**
 * Creates a matcher for primitive types (string, number, boolean, etc.).
 *
 * @param names - Optional specific primitive type names to match. If empty, matches any primitive.
 * @returns A TypeMatcher for primitive types
 *
 * @example
 * ```typescript
 * primitive('string', 'number') // Matches string or number
 * primitive() // Matches any primitive type
 * ```
 */
export const primitive = (...names: string[]) => new PrimitiveMatcher(names);
