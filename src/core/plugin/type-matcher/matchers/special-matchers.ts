import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher } from '../matcher-base.js';

/**
 * Matcher that matches any type
 */
export class AnyMatcher extends BaseTypeMatcher {
  match(_typeInfo: TypeInfo): boolean {
    return true;
  }

  describe(): string {
    return 'any';
  }
}

/**
 * Matcher for never type
 */
export class NeverMatcher extends BaseTypeMatcher {
  match(typeInfo: TypeInfo): boolean {
    return typeInfo.kind === TypeKind.Never;
  }

  describe(): string {
    return 'never';
  }
}

/**
 * Creates a matcher that matches any type.
 *
 * @returns A TypeMatcher that always matches
 *
 * @example
 * ```typescript
 * any() // Matches any type including primitives, objects, arrays, etc.
 * ```
 */
export const any = () => new AnyMatcher();

/**
 * Creates a matcher for the never type.
 *
 * @returns A TypeMatcher for the never type
 *
 * @example
 * ```typescript
 * never() // Matches the never type
 * ```
 */
export const never = () => new NeverMatcher();
