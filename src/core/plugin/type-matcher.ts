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

    return (
      'name' in typeInfo && typeof typeInfo.name === 'string' && this.names.includes(typeInfo.name)
    );
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

  withGeneric(name?: string): ObjectTypeMatcher {
    if (name) this.genericName = name;
    return this;
  }

  withProperty(name: string, type?: TypeMatcher): ObjectTypeMatcher {
    this.requiredProperties.set(name, type);
    return this;
  }

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
      if (!('name' in typeInfo) || typeInfo.name !== this.name) {
        return false;
      }
    }

    // Check generic if specified
    if (this.genericName !== undefined) {
      const hasGeneric =
        'genericParams' in typeInfo &&
        Array.isArray(typeInfo.genericParams) &&
        typeInfo.genericParams.length > 0;

      if (this.genericName) {
        // Expecting a specific generic name
        if (!hasGeneric) {
          return false; // Expected generic but found none
        }
        const hasMatchingGeneric = typeInfo.genericParams.some(
          param => 'name' in param && param.name === this.genericName,
        );
        if (!hasMatchingGeneric) {
          return false;
        }
      } else {
        // Expecting any generic (genericName === '')
        if (!hasGeneric) {
          return false; // Expected any generic but found none
        }
      }
    }

    // Check required properties
    if (
      this.requiredProperties.size > 0 &&
      'properties' in typeInfo &&
      Array.isArray(typeInfo.properties)
    ) {
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

  of(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): ArrayTypeMatcher {
    if (typeof matcher === 'function') {
      this.elementMatcher = matcher(new TypeMatcherBuilderImpl());
    } else {
      this.elementMatcher = matcher;
    }
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Array) {
      return false;
    }

    if (this.elementMatcher && 'elementType' in typeInfo && typeInfo.elementType) {
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

  containing(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): UnionTypeMatcher {
    if (typeof matcher === 'function') {
      this.containingMatchers.push(matcher(new TypeMatcherBuilderImpl()));
    } else {
      this.containingMatchers.push(matcher);
    }
    return this;
  }

  exact(...matchers: TypeMatcher[]): UnionTypeMatcher {
    this.exactMatchers = matchers;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Union) {
      return false;
    }

    if (!('unionTypes' in typeInfo) || !Array.isArray(typeInfo.unionTypes)) {
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
      if (typeInfo.unionTypes.length !== this.exactMatchers.length) {
        return false;
      }

      // Each union type must match exactly one matcher
      const usedMatchers = new Set<number>();
      for (const unionType of typeInfo.unionTypes) {
        let found = false;
        for (let i = 0; i < this.exactMatchers.length; i++) {
          if (!usedMatchers.has(i) && this.exactMatchers[i]?.match(unionType)) {
            usedMatchers.add(i);
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
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

  including(
    matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher),
  ): IntersectionTypeMatcher {
    if (typeof matcher === 'function') {
      this.includingMatchers.push(matcher(new TypeMatcherBuilderImpl()));
    } else {
      this.includingMatchers.push(matcher);
    }
    return this;
  }

  exact(...matchers: TypeMatcher[]): IntersectionTypeMatcher {
    this.exactMatchers = matchers;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind !== TypeKind.Intersection) {
      return false;
    }

    const intersectionTypes =
      ('types' in typeInfo && typeInfo.types) ||
      ('intersectionTypes' in typeInfo && typeInfo.intersectionTypes);

    if (!Array.isArray(intersectionTypes)) {
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
      if (intersectionTypes.length !== this.exactMatchers.length) {
        return false;
      }

      // Each intersection type must match exactly one matcher
      const usedMatchers = new Set<number>();
      for (const intersectionType of intersectionTypes) {
        let found = false;
        for (let i = 0; i < this.exactMatchers.length; i++) {
          if (!usedMatchers.has(i) && this.exactMatchers[i]?.match(intersectionType)) {
            usedMatchers.add(i);
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
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

    if (this.name && 'name' in typeInfo && typeInfo.name !== this.name) {
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

    if (this.name && 'name' in typeInfo && typeInfo.name !== this.name) {
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

    const literalValue =
      ('value' in typeInfo && typeInfo.value) || ('literal' in typeInfo && typeInfo.literal);
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
 * Create a new type matcher builder
 */
export function createTypeMatcher(): TypeMatcherBuilder {
  return new TypeMatcherBuilderImpl();
}

/**
 * Convenience exports for creating matchers directly
 */
export const primitive = (...names: string[]) => new PrimitiveMatcher(names);
export const object = (name?: string) => new ObjectMatcher(name);
export const array = () => new ArrayMatcher();
export const union = () => new UnionMatcher();
export const intersection = () => new IntersectionMatcher();
export const reference = (name?: string) => new ReferenceMatcher(name);
export const generic = (name?: string) => new GenericMatcher(name);
export const any = () => new AnyMatcher();
export const never = () => new NeverMatcher();
export const literal = (value: string | number | boolean) => new LiteralMatcher(value);
export const or = (...matchers: TypeMatcher[]) => new OrMatcher(matchers);
export const and = (...matchers: TypeMatcher[]) => new AndMatcher(matchers);
export const not = (matcher: TypeMatcher) => new NotMatcher(matcher);
