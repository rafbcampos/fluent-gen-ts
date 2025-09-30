import { TypeKind } from '../../../types.js';
import type { TypeInfo } from '../../../types.js';
import { BaseTypeMatcher, type TypeMatcher } from '../matcher-base.js';
import { hasName, hasProperties, hasGenericParams } from '../type-guards.js';

/**
 * Object type matcher with fluent API
 */
export interface ObjectTypeMatcher extends TypeMatcher {
  withGeneric(name?: string): ObjectTypeMatcher;
  withProperty(name: string, type?: TypeMatcher): ObjectTypeMatcher;
  withProperties(...names: string[]): ObjectTypeMatcher;
}

/**
 * Matcher for object types
 */
export class ObjectMatcher extends BaseTypeMatcher implements ObjectTypeMatcher {
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
