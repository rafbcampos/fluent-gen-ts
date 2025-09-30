/**
 * Type Matcher - Domain-agnostic type matching and transformation utilities
 *
 * This module provides powerful type matching and deep transformation capabilities
 * for TypeScript type structures.
 */

// Core types
export type { TypeMatcher } from './matcher-base.js';
export type { TypeMatcherBuilder } from './matcher-builder.js';

// Matcher interfaces
export type { ObjectTypeMatcher } from './matchers/object-matcher.js';
export type { ArrayTypeMatcher } from './matchers/array-matcher.js';
export type { UnionTypeMatcher } from './matchers/union-matcher.js';
export type { IntersectionTypeMatcher } from './matchers/intersection-matcher.js';

// Factory functions for creating matchers
export { primitive } from './matchers/primitive-matcher.js';
export { object } from './matchers/object-matcher.js';
export { array } from './matchers/array-matcher.js';
export { union } from './matchers/union-matcher.js';
export { intersection } from './matchers/intersection-matcher.js';
export { reference } from './matchers/reference-matcher.js';
export { generic } from './matchers/generic-matcher.js';
export { literal } from './matchers/literal-matcher.js';
export { any, never } from './matchers/special-matchers.js';
export { or, and, not } from './matchers/logical-matchers.js';

// Matcher builder
export { createTypeMatcher } from './matcher-builder.js';

// Transformation utilities
export { typeInfoToString } from './transformation/type-to-string.js';
export { transformTypeDeep, type TypeTransformer } from './transformation/transform-deep.js';
export { containsTypeDeep, findTypesDeep } from './transformation/deep-matching.js';
export {
  TypeDeepTransformer,
  type TypeTransformContext,
} from './transformation/deep-transformer.js';

// Re-export from base for convenience
export { BaseTypeMatcher, matchExactly } from './matcher-base.js';
