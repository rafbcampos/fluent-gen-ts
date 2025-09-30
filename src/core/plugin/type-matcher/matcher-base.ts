import type { TypeInfo } from '../../types.js';

/**
 * Base type matcher interface
 */
export interface TypeMatcher {
  match(typeInfo: TypeInfo): boolean;
  describe(): string;
}

/**
 * Base implementation for type matchers
 */
export abstract class BaseTypeMatcher implements TypeMatcher {
  abstract match(typeInfo: TypeInfo): boolean;
  abstract describe(): string;
}

/**
 * Utility function for exact matching of types against matchers
 */
export function matchExactly(types: TypeInfo[], matchers: TypeMatcher[]): boolean {
  if (types.length !== matchers.length) {
    return false;
  }

  const usedMatchers = new Set<number>();
  for (const type of types) {
    let found = false;
    for (let i = 0; i < matchers.length; i++) {
      if (!usedMatchers.has(i) && matchers[i]?.match(type)) {
        usedMatchers.add(i);
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}
