import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher } from '../matcher-base.js';
import { hasLiteralValue, getLiteralValue } from '../type-guards.js';

/**
 * Matcher for literal types
 */
export class LiteralMatcher extends BaseTypeMatcher {
  constructor(private readonly value: string | number | boolean) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Literal) {
      return false;
    }

    if (!hasLiteralValue(typeInfo)) {
      return false;
    }

    const literalValue = getLiteralValue(typeInfo);
    return literalValue === this.value;
  }

  describe(): string {
    return `literal(${JSON.stringify(this.value)})`;
  }
}

/**
 * Creates a matcher for literal types with specific values.
 *
 * @param value - The literal value to match (string, number, or boolean)
 * @returns A TypeMatcher for the specific literal value
 *
 * @example
 * ```typescript
 * literal('success') // Matches the literal string 'success'
 * literal(42) // Matches the literal number 42
 * literal(true) // Matches the literal boolean true
 * ```
 */
export const literal = (value: string | number | boolean) => new LiteralMatcher(value);
