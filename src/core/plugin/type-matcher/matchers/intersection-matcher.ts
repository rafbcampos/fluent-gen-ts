import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher, type TypeMatcher, matchExactly } from '../matcher-base.js';
import { getIntersectionTypes } from '../type-guards.js';

/**
 * Intersection type matcher with fluent API
 */
export interface IntersectionTypeMatcher extends TypeMatcher {
  including(matcher: TypeMatcher): IntersectionTypeMatcher;
  exact(...matchers: TypeMatcher[]): IntersectionTypeMatcher;
}

/**
 * Matcher for intersection types
 */
export class IntersectionMatcher extends BaseTypeMatcher implements IntersectionTypeMatcher {
  private includingMatchers: TypeMatcher[] = [];
  private exactMatchers: TypeMatcher[] = [];

  /**
   * Adds an inclusion constraint - the intersection must include a type matching this matcher.
   *
   * @param matcher - Type matcher that must be included in the intersection
   * @returns This IntersectionTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * intersection().including(object('Base')) // Intersection that includes Base
   * intersection().including(object('Base')).including(object('Mixin')) // Intersection including both Base and Mixin
   * ```
   */
  including(matcher: TypeMatcher): IntersectionTypeMatcher {
    this.includingMatchers.push(matcher);
    return this;
  }

  /**
   * Sets exact matching constraints - the intersection must match exactly these matchers (no more, no less).
   *
   * @param matchers - Array of type matchers that must exactly match the intersection types
   * @returns This IntersectionTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * intersection().exact(object('A'), object('B')) // Intersection of exactly A & B
   * intersection().exact(object('Base'), object('Mixin')) // Intersection of exactly Base & Mixin
   * ```
   */
  exact(...matchers: TypeMatcher[]): IntersectionTypeMatcher {
    this.exactMatchers = matchers;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Intersection) {
      return false;
    }

    const intersectionTypes = getIntersectionTypes(typeInfo);
    if (!intersectionTypes) {
      return false;
    }

    // Check including matchers
    for (const matcher of this.includingMatchers) {
      const hasMatch = intersectionTypes.some(t => matcher.match(t));
      if (!hasMatch) {
        return false;
      }
    }

    // Check exact matchers - if no exact matchers specified, match any intersection
    if (this.exactMatchers.length > 0) {
      if (!matchExactly(intersectionTypes, this.exactMatchers)) {
        return false;
      }
    }

    return true;
  }

  describe(): string {
    const parts: string[] = ['intersection'];
    for (const matcher of this.includingMatchers) {
      parts.push(`.including(${matcher.describe()})`);
    }
    if (this.exactMatchers.length > 0) {
      const matchers = this.exactMatchers.map(m => m.describe()).join(', ');
      parts.push(`.exact(${matchers})`);
    }
    return parts.join('');
  }
}

/**
 * Creates a matcher for intersection types with inclusion or exact matching constraints.
 *
 * @returns An IntersectionTypeMatcher for further configuration
 *
 * @example
 * ```typescript
 * intersection().including(object('Base')).including(object('Mixin'))
 * intersection().exact(object('A'), object('B'))
 * ```
 */
export const intersection = () => new IntersectionMatcher();
