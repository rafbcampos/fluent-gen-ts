import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher } from '../matcher-base.js';
import { hasName } from '../type-guards.js';

/**
 * Matcher for generic types
 */
export class GenericMatcher extends BaseTypeMatcher {
  constructor(private readonly name?: string) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Generic) {
      return false;
    }

    if (this.name && (!hasName(typeInfo) || typeInfo.name !== this.name)) {
      return false;
    }

    return true;
  }

  describe(): string {
    return this.name ? `generic(${this.name})` : 'generic';
  }
}

/**
 * Creates a matcher for generic type parameters.
 *
 * @param name - Optional generic parameter name to match
 * @returns A TypeMatcher for generic types
 *
 * @example
 * ```typescript
 * generic('T') // Matches generic parameter T
 * generic() // Matches any generic parameter
 * ```
 */
export const generic = (name?: string) => new GenericMatcher(name);
