import type { TypeInfo } from '../types.js';
import { TypeKind } from '../types.js';
import type {
  TypeMatcher,
  TypeMatcherBuilder,
  ObjectTypeMatcher,
  ArrayTypeMatcher,
  UnionTypeMatcher,
  IntersectionTypeMatcher,
} from './plugin-types.js';

/**
 * Utility function for exact matching of types against matchers
 */
function matchExactly(types: TypeInfo[], matchers: TypeMatcher[]): boolean {
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

/**
 * Utility function to resolve a matcher that could be a function or TypeMatcher
 */
function resolveMatcher(
  matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher),
): TypeMatcher {
  if (typeof matcher === 'function') {
    return matcher(new TypeMatcherBuilderImpl());
  }
  return matcher;
}

/**
 * Type guards for common TypeInfo property checks
 */
function hasName(typeInfo: TypeInfo): typeInfo is TypeInfo & { name: string } {
  return 'name' in typeInfo && typeof typeInfo.name === 'string';
}

function hasProperties(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { properties: Array<{ name: string; type: TypeInfo }> } {
  return 'properties' in typeInfo && Array.isArray(typeInfo.properties);
}

function hasGenericParams(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { genericParams: TypeInfo[] } {
  return 'genericParams' in typeInfo && Array.isArray(typeInfo.genericParams);
}

function hasUnionTypes(typeInfo: TypeInfo): typeInfo is TypeInfo & { unionTypes: TypeInfo[] } {
  return 'unionTypes' in typeInfo && Array.isArray(typeInfo.unionTypes);
}

function hasElementType(typeInfo: TypeInfo): typeInfo is TypeInfo & { elementType: TypeInfo } {
  return 'elementType' in typeInfo && typeInfo.elementType != null;
}

function hasLiteralValue(
  typeInfo: TypeInfo,
): typeInfo is TypeInfo & { value?: unknown; literal?: unknown } {
  return 'value' in typeInfo || 'literal' in typeInfo;
}

function getIntersectionTypes(typeInfo: TypeInfo): TypeInfo[] | null {
  if ('types' in typeInfo && Array.isArray(typeInfo.types)) {
    return typeInfo.types;
  }
  if ('intersectionTypes' in typeInfo && Array.isArray(typeInfo.intersectionTypes)) {
    return typeInfo.intersectionTypes;
  }
  return null;
}

function getLiteralValue(typeInfo: TypeInfo): unknown {
  if ('value' in typeInfo) return typeInfo.value;
  if ('literal' in typeInfo) return typeInfo.literal;
  return undefined;
}

/**
 * Base implementation for type matchers
 */
abstract class BaseTypeMatcher implements TypeMatcher {
  abstract match(typeInfo: TypeInfo): boolean;
  abstract describe(): string;
}

/**
 * Matcher for primitive types
 */
class PrimitiveMatcher extends BaseTypeMatcher {
  constructor(private readonly names: string[]) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Primitive) {
      return false;
    }

    if (this.names.length === 0) {
      return true; // Match any primitive
    }

    return hasName(typeInfo) && this.names.includes(typeInfo.name);
  }

  describe(): string {
    if (this.names.length === 0) {
      return 'primitive';
    }
    return `primitive(${this.names.join(' | ')})`;
  }
}

/**
 * Matcher for object types
 */
class ObjectMatcher extends BaseTypeMatcher implements ObjectTypeMatcher {
  private name?: string;
  private genericName?: string;
  private requiredProperties: Map<string, TypeMatcher | undefined> = new Map();

  constructor(name?: string) {
    super();
    if (name) this.name = name;
  }

  /**
   * Adds a generic parameter constraint to this object matcher.
   *
   * @param name - Optional generic parameter name. If provided, matches objects with this specific generic.
   *               If empty string, matches objects with any generic. If undefined, no generic constraint.
   * @returns This ObjectTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * object('Array').withGeneric('T') // Matches Array<T>
   * object('Map').withGeneric() // Matches Map with any generics
   * ```
   */
  withGeneric(name?: string): ObjectTypeMatcher {
    if (name) this.genericName = name;
    return this;
  }

  /**
   * Adds a required property constraint to this object matcher.
   *
   * @param name - The property name that must exist on the object
   * @param type - Optional type matcher for the property's type
   * @returns This ObjectTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * object('User').withProperty('id', primitive('string'))
   * object().withProperty('name') // Any object with a 'name' property
   * ```
   */
  withProperty(name: string, type?: TypeMatcher): ObjectTypeMatcher {
    this.requiredProperties.set(name, type);
    return this;
  }

  /**
   * Adds multiple required property constraints to this object matcher.
   *
   * @param names - Property names that must exist on the object
   * @returns This ObjectTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * object('User').withProperties('id', 'name', 'email')
   * ```
   */
  withProperties(...names: string[]): ObjectTypeMatcher {
    for (const name of names) {
      this.requiredProperties.set(name, undefined);
    }
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Object) {
      return false;
    }

    // Check name if specified
    if (this.name) {
      if (!hasName(typeInfo) || typeInfo.name !== this.name) {
        return false;
      }
    }

    // Check generic if specified
    if (this.genericName !== undefined) {
      const genericParams = hasGenericParams(typeInfo) ? typeInfo.genericParams : [];
      const hasGenericParam = genericParams.length > 0;

      if (this.genericName) {
        // Expecting a specific generic name
        if (!hasGenericParam) {
          return false; // Expected generic but found none
        }
        const hasMatchingGeneric = genericParams.some(
          param => 'name' in param && param.name === this.genericName,
        );
        if (!hasMatchingGeneric) {
          return false;
        }
      } else {
        // Expecting any generic (genericName === '')
        if (!hasGenericParam) {
          return false; // Expected any generic but found none
        }
      }
    }

    // Check required properties
    if (this.requiredProperties.size > 0) {
      if (!hasProperties(typeInfo)) {
        return false; // Required properties specified but no properties available
      }
      for (const [propName, propTypeMatcher] of this.requiredProperties) {
        const prop = typeInfo.properties.find(p => p.name === propName);
        if (!prop) {
          return false;
        }
        if (propTypeMatcher && !propTypeMatcher.match(prop.type)) {
          return false;
        }
      }
    }

    return true;
  }

  describe(): string {
    const parts: string[] = ['object'];
    if (this.name) {
      parts.push(`(${this.name})`);
    }
    if (this.genericName !== undefined) {
      parts.push(` with generic ${this.genericName || 'any'}`);
    }
    if (this.requiredProperties.size > 0) {
      const props = Array.from(this.requiredProperties.keys());
      parts.push(` with properties ${props.join(', ')}`);
    }
    return parts.join('');
  }
}

/**
 * Matcher for array types
 */
class ArrayMatcher extends BaseTypeMatcher implements ArrayTypeMatcher {
  private elementMatcher?: TypeMatcher;

  /**
   * Adds an element type constraint to this array matcher.
   *
   * @param matcher - Type matcher for array elements, or a function that builds one
   * @returns This ArrayTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * array().of(primitive('string')) // Array of strings
   * array().of(object('User')) // Array of User objects
   * array().of(m => m.union().containing(m.primitive('string'))) // Array of unions containing string
   * ```
   */
  of(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): ArrayTypeMatcher {
    this.elementMatcher = resolveMatcher(matcher);
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
 * Matcher for union types
 */
class UnionMatcher extends BaseTypeMatcher implements UnionTypeMatcher {
  private containingMatchers: TypeMatcher[] = [];
  private exactMatchers: TypeMatcher[] = [];

  /**
   * Adds a containment constraint - the union must contain a type matching this matcher.
   *
   * @param matcher - Type matcher that must be contained in the union, or a function that builds one
   * @returns This UnionTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * union().containing(primitive('string')) // Union that contains string
   * union().containing(primitive('string')).containing(primitive('number')) // Union containing both string and number
   * ```
   */
  containing(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): UnionTypeMatcher {
    this.containingMatchers.push(resolveMatcher(matcher));
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
 * Matcher for intersection types
 */
class IntersectionMatcher extends BaseTypeMatcher implements IntersectionTypeMatcher {
  private includingMatchers: TypeMatcher[] = [];
  private exactMatchers: TypeMatcher[] = [];

  /**
   * Adds an inclusion constraint - the intersection must include a type matching this matcher.
   *
   * @param matcher - Type matcher that must be included in the intersection, or a function that builds one
   * @returns This IntersectionTypeMatcher for method chaining
   *
   * @example
   * ```typescript
   * intersection().including(object('Base')) // Intersection that includes Base
   * intersection().including(object('Base')).including(object('Mixin')) // Intersection including both Base and Mixin
   * ```
   */
  including(
    matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher),
  ): IntersectionTypeMatcher {
    this.includingMatchers.push(resolveMatcher(matcher));
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
 * Matcher for reference types
 */
class ReferenceMatcher extends BaseTypeMatcher {
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
 * Matcher for generic types
 */
class GenericMatcher extends BaseTypeMatcher {
  constructor(private readonly name?: string) {
    super();
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Generic) {
      return false;
    }

    if (this.name && (!hasName(typeInfo) || typeInfo.name !== this.name)) {
      return false;
    }

    return true;
  }

  describe(): string {
    return this.name ? `generic(${this.name})` : 'generic';
  }
}

/**
 * Matcher for literal types
 */
class LiteralMatcher extends BaseTypeMatcher {
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
 * Matcher that matches any type
 */
class AnyMatcher extends BaseTypeMatcher {
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
class NeverMatcher extends BaseTypeMatcher {
  match(typeInfo: TypeInfo): boolean {
    return typeInfo.kind === TypeKind.Never;
  }

  describe(): string {
    return 'never';
  }
}

/**
 * Logical OR matcher
 */
class OrMatcher extends BaseTypeMatcher {
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
class AndMatcher extends BaseTypeMatcher {
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
class NotMatcher extends BaseTypeMatcher {
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
 * Implementation of TypeMatcherBuilder
 */
class TypeMatcherBuilderImpl implements TypeMatcherBuilder {
  primitive(...names: string[]): TypeMatcher {
    return new PrimitiveMatcher(names);
  }

  object(name?: string): ObjectTypeMatcher {
    return new ObjectMatcher(name);
  }

  array(): ArrayTypeMatcher {
    return new ArrayMatcher();
  }

  union(): UnionTypeMatcher {
    return new UnionMatcher();
  }

  intersection(): IntersectionTypeMatcher {
    return new IntersectionMatcher();
  }

  reference(name?: string): TypeMatcher {
    return new ReferenceMatcher(name);
  }

  generic(name?: string): TypeMatcher {
    return new GenericMatcher(name);
  }

  any(): TypeMatcher {
    return new AnyMatcher();
  }

  never(): TypeMatcher {
    return new NeverMatcher();
  }

  literal(value: string | number | boolean): TypeMatcher {
    return new LiteralMatcher(value);
  }

  or(...matchers: TypeMatcher[]): TypeMatcher {
    return new OrMatcher(matchers);
  }

  and(...matchers: TypeMatcher[]): TypeMatcher {
    return new AndMatcher(matchers);
  }

  not(matcher: TypeMatcher): TypeMatcher {
    return new NotMatcher(matcher);
  }
}

/**
 * Create a new type matcher builder for constructing complex type matching patterns.
 *
 * @returns A new TypeMatcherBuilder instance for creating type matchers
 *
 * @example
 * ```typescript
 * const matcher = createTypeMatcher()
 *   .object('User')
 *   .withProperty('id', createTypeMatcher().primitive('string'))
 *   .withProperty('age', createTypeMatcher().primitive('number'));
 * ```
 */
export function createTypeMatcher(): TypeMatcherBuilder {
  return new TypeMatcherBuilderImpl();
}

/**
 * Convenience exports for creating matchers directly
 */

/**
 * Creates a matcher for primitive types (string, number, boolean, etc.).
 *
 * @param names - Optional specific primitive type names to match. If empty, matches any primitive.
 * @returns A TypeMatcher for primitive types
 *
 * @example
 * ```typescript
 * primitive('string', 'number') // Matches string or number
 * primitive() // Matches any primitive type
 * ```
 */
export const primitive = (...names: string[]) => new PrimitiveMatcher(names);

/**
 * Creates a matcher for object types with optional name and property constraints.
 *
 * @param name - Optional object type name to match
 * @returns An ObjectTypeMatcher for further configuration
 *
 * @example
 * ```typescript
 * object('User').withProperty('id', primitive('string'))
 * object().withProperties('name', 'email') // Any object with these properties
 * ```
 */
export const object = (name?: string) => new ObjectMatcher(name);

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

/**
 * Creates a matcher for generic type parameters.
 *
 * @param name - Optional generic parameter name to match
 * @returns A TypeMatcher for generic types
 *
 * @example
 * ```typescript
 * generic('T') // Matches generic parameter T
 * generic() // Matches any generic parameter
 * ```
 */
export const generic = (name?: string) => new GenericMatcher(name);

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
