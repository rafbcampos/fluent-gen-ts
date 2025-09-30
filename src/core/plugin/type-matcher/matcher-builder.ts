import type { TypeMatcher } from './matcher-base.js';
import { primitive } from './matchers/primitive-matcher.js';
import { object, type ObjectTypeMatcher } from './matchers/object-matcher.js';
import { array, type ArrayTypeMatcher } from './matchers/array-matcher.js';
import { union, type UnionTypeMatcher } from './matchers/union-matcher.js';
import { intersection, type IntersectionTypeMatcher } from './matchers/intersection-matcher.js';
import { reference } from './matchers/reference-matcher.js';
import { generic } from './matchers/generic-matcher.js';
import { literal } from './matchers/literal-matcher.js';
import { any, never } from './matchers/special-matchers.js';
import { or, and, not } from './matchers/logical-matchers.js';

/**
 * Type matcher builder interface
 */
export interface TypeMatcherBuilder {
  primitive(...names: string[]): TypeMatcher;
  object(name?: string): ObjectTypeMatcher;
  array(): ArrayTypeMatcher;
  union(): UnionTypeMatcher;
  intersection(): IntersectionTypeMatcher;
  reference(name?: string): TypeMatcher;
  generic(name?: string): TypeMatcher;
  any(): TypeMatcher;
  never(): TypeMatcher;
  literal(value: string | number | boolean): TypeMatcher;
  or(...matchers: TypeMatcher[]): TypeMatcher;
  and(...matchers: TypeMatcher[]): TypeMatcher;
  not(matcher: TypeMatcher): TypeMatcher;
}

/**
 * Implementation of TypeMatcherBuilder
 */
class TypeMatcherBuilderImpl implements TypeMatcherBuilder {
  primitive(...names: string[]): TypeMatcher {
    return primitive(...names);
  }

  object(name?: string): ObjectTypeMatcher {
    return object(name);
  }

  array(): ArrayTypeMatcher {
    return array();
  }

  union(): UnionTypeMatcher {
    return union();
  }

  intersection(): IntersectionTypeMatcher {
    return intersection();
  }

  reference(name?: string): TypeMatcher {
    return reference(name);
  }

  generic(name?: string): TypeMatcher {
    return generic(name);
  }

  any(): TypeMatcher {
    return any();
  }

  never(): TypeMatcher {
    return never();
  }

  literal(value: string | number | boolean): TypeMatcher {
    return literal(value);
  }

  or(...matchers: TypeMatcher[]): TypeMatcher {
    return or(...matchers);
  }

  and(...matchers: TypeMatcher[]): TypeMatcher {
    return and(...matchers);
  }

  not(matcher: TypeMatcher): TypeMatcher {
    return not(matcher);
  }
}

/**
 * Creates a new type matcher builder for composing complex matchers
 *
 * @returns A TypeMatcherBuilder instance
 *
 * @example
 * ```typescript
 * const m = createTypeMatcher();
 * const matcher = m.union()
 *   .containing(m.primitive('string'))
 *   .containing(m.object('User'));
 * ```
 */
export function createTypeMatcher(): TypeMatcherBuilder {
  return new TypeMatcherBuilderImpl();
}
