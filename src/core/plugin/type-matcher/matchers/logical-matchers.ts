import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher, type TypeMatcher } from '../matcher-base.js';

/**
 * Logical OR matcher
 */
export class OrMatcher extends BaseTypeMatcher {
  constructor(private readonly matchers: TypeMatcher[]) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    return this.matchers.some(m => m.match(typeInfo));
  }

  describe(): string {
    const descriptions = this.matchers.map(m => m.describe()).join(' or ');
    return `(${descriptions})`;
  }
}

/**
 * Logical AND matcher
 */
export class AndMatcher extends BaseTypeMatcher {
  constructor(private readonly matchers: TypeMatcher[]) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    return this.matchers.every(m => m.match(typeInfo));
  }

  describe(): string {
    const descriptions = this.matchers.map(m => m.describe()).join(' and ');
    return `(${descriptions})`;
  }
}

/**
 * Logical NOT matcher
 */
export class NotMatcher extends BaseTypeMatcher {
  constructor(private readonly matcher: TypeMatcher) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    return !this.matcher.match(typeInfo);
  }

  describe(): string {
    return `not(${this.matcher.describe()})`;
  }
}

/**
 * Creates a logical OR matcher that matches if any of the provided matchers match.
 *
 * @param matchers - Array of matchers to combine with OR logic
 * @returns A TypeMatcher using OR logic
 *
 * @example
 * ```typescript
 * or(primitive('string'), primitive('number')) // Matches string OR number
 * or(object('User'), object('Admin')) // Matches User OR Admin objects
 * ```
 */
export const or = (...matchers: TypeMatcher[]) => new OrMatcher(matchers);

/**
 * Creates a logical AND matcher that matches only if all provided matchers match.
 *
 * @param matchers - Array of matchers to combine with AND logic
 * @returns A TypeMatcher using AND logic
 *
 * @example
 * ```typescript
 * and(object(), not(primitive())) // Matches objects that are not primitives
 * ```
 */
export const and = (...matchers: TypeMatcher[]) => new AndMatcher(matchers);

/**
 * Creates a logical NOT matcher that matches when the provided matcher does not match.
 *
 * @param matcher - The matcher to negate
 * @returns A TypeMatcher using NOT logic
 *
 * @example
 * ```typescript
 * not(primitive('string')) // Matches any type except string
 * not(object('User')) // Matches any type except User objects
 * ```
 */
export const not = (matcher: TypeMatcher) => new NotMatcher(matcher);
