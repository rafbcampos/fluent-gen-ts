import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher, type TypeMatcher, matchExactly } from '../matcher-base.js';
import { hasUnionTypes } from '../type-guards.js';

/**
 * Union type matcher with fluent API
 */
export interface UnionTypeMatcher extends TypeMatcher {
  containing(matcher: TypeMatcher): UnionTypeMatcher;
  exact(...matchers: TypeMatcher[]): UnionTypeMatcher;
}

/**
 * Matcher for union types
 */
export class UnionMatcher extends BaseTypeMatcher implements UnionTypeMatcher {
  private containingMatchers: TypeMatcher[] = [];
  private exactMatchers: TypeMatcher[] = [];

  /**
   * Adds a containment constraint - the union must contain a type matching this matcher.
   *
   * @param matcher - Type matcher that must be contained in the union
   * @returns This UnionTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * union().containing(primitive('string')) // Union that contains string
   * union().containing(primitive('string')).containing(primitive('number')) // Union containing both string and number
   * ```
   */
  containing(matcher: TypeMatcher): UnionTypeMatcher {
    this.containingMatchers.push(matcher);
    return this;
  }

  /**
   * Sets exact matching constraints - the union must match exactly these matchers (no more, no less).
   *
   * @param matchers - Array of type matchers that must exactly match the union types
   * @returns This UnionTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * union().exact(primitive('string'), primitive('number')) // Union of exactly string | number
   * union().exact(primitive('string'), literal('null')) // Union of exactly string | null
   * ```
   */
  exact(...matchers: TypeMatcher[]): UnionTypeMatcher {
    this.exactMatchers = matchers;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Union) {
      return false;
    }

    if (!hasUnionTypes(typeInfo)) {
      return false;
    }

    // Check containing matchers
    for (const matcher of this.containingMatchers) {
      const hasMatch = typeInfo.unionTypes.some(t => matcher.match(t));
      if (!hasMatch) {
        return false;
      }
    }

    // Check exact matchers - if no exact matchers specified, match any union
    if (this.exactMatchers.length > 0) {
      if (!matchExactly(typeInfo.unionTypes, this.exactMatchers)) {
        return false;
      }
    }

    return true;
  }

  describe(): string {
    const parts: string[] = ['union'];
    for (const matcher of this.containingMatchers) {
      parts.push(`.containing(${matcher.describe()})`);
    }
    if (this.exactMatchers.length > 0) {
      const matchers = this.exactMatchers.map(m => m.describe()).join(', ');
      parts.push(`.exact(${matchers})`);
    }
    return parts.join('');
  }
}

/**
 * Creates a matcher for union types with containment or exact matching constraints.
 *
 * @returns A UnionTypeMatcher for further configuration
 *
 * @example
 * ```typescript
 * union().containing(primitive('string')).containing(primitive('number'))
 * union().exact(primitive('string'), primitive('null'))
 * ```
 */
export const union = () => new UnionMatcher();
