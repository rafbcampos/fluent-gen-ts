import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher, type TypeMatcher } from '../matcher-base.js';
import { hasElementType } from '../type-guards.js';

/**
 * Array type matcher with fluent API
 */
export interface ArrayTypeMatcher extends TypeMatcher {
  of(matcher: TypeMatcher): ArrayTypeMatcher;
}

/**
 * Matcher for array types
 */
export class ArrayMatcher extends BaseTypeMatcher implements ArrayTypeMatcher {
  private elementMatcher?: TypeMatcher;

  /**
   * Adds an element type constraint to this array matcher.
   *
   * @param matcher - Type matcher for array elements
   * @returns This ArrayTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * array().of(primitive('string')) // Array of strings
   * array().of(object('User')) // Array of User objects
   * ```
   */
  of(matcher: TypeMatcher): ArrayTypeMatcher {
    this.elementMatcher = matcher;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Array) {
      return false;
    }

    if (this.elementMatcher) {
      if (!hasElementType(typeInfo)) {
        return false; // Element matcher specified but no element type available
      }
      return this.elementMatcher.match(typeInfo.elementType);
    }

    return true;
  }

  describe(): string {
    if (this.elementMatcher) {
      return `array of ${this.elementMatcher.describe()}`;
    }
    return 'array';
  }
}

/**
 * Creates a matcher for array types with optional element type constraints.
 *
 * @returns An ArrayTypeMatcher for further configuration
 *
 * @example
 * ```typescript
 * array().of(primitive('string')) // Array of strings
 * array() // Any array type
 * ```
 */
export const array = () => new ArrayMatcher();
