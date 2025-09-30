import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher } from '../matcher-base.js';
import { hasName } from '../type-guards.js';

/**
 * Matcher for reference types
 */
export class ReferenceMatcher extends BaseTypeMatcher {
  constructor(private readonly name?: string) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Reference) {
      return false;
    }

    if (this.name && (!hasName(typeInfo) || typeInfo.name !== this.name)) {
      return false;
    }

    return true;
  }

  describe(): string {
    return this.name ? `reference(${this.name})` : 'reference';
  }
}

/**
 * Creates a matcher for reference types (type aliases, imported types).
 *
 * @param name - Optional reference type name to match
 * @returns A TypeMatcher for reference types
 *
 * @example
 * ```typescript
 * reference('MyType') // Matches references to MyType
 * reference() // Matches any reference type
 * ```
 */
export const reference = (name?: string) => new ReferenceMatcher(name);
