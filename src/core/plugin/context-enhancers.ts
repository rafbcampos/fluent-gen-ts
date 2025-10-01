import type { TypeInfo, PropertyInfo, ResolvedType, GeneratorOptions } from '../types.js';
import { TypeKind } from '../types.js';
import type { Type, Symbol } from 'ts-morph';
import type {
  ParseContext,
  ResolveContext,
  GenerateContext,
  PropertyMethodContext,
  BuilderContext,
  ValueContext,
  BuildMethodContext,
  TypeMatcherInterface,
  TypeMatcher,
  ObjectTypeMatcher,
  ArrayTypeMatcher,
  UnionTypeMatcher,
  IntersectionTypeMatcher,
  TypeMatcherBuilder,
} from './plugin-types.js';
import {
  createTypeMatcher,
  TypeDeepTransformer,
  containsTypeDeep,
  findTypesDeep,
} from './type-matcher/index.js';
import {
  isObjectTypeInfo,
  isUnionTypeInfo,
  isIntersectionTypeInfo,
  isArrayTypeInfo,
  isPrimitiveTypeInfo,
} from '../../type-info/type-guards.js';

/**
 * Performs exact matching between a list of types and matchers (order-independent).
 * Each type must match exactly one matcher, and each matcher must match exactly one type.
 * @param types - Array of TypeInfo objects to match against
 * @param matchers - Array of TypeMatcher objects to match with
 * @returns True if there's a perfect 1:1 match between all types and matchers
 */
function exactMatchTypes(types: TypeInfo[], matchers: TypeMatcher[]): boolean {
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
    if (!found) return false;
  }
  return true;
}

/**
 * Converts a delimited string to PascalCase.
 * @param str - The string to convert
 * @param delimiter - The delimiter to split on (e.g., '-' for kebab-case, '_' for snake_case)
 * @returns The PascalCase string
 * @example toPascalCase('foo-bar', '-') // Returns 'FooBar'
 */
function toPascalCase(str: string, delimiter: string): string {
  return str
    .split(delimiter)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Capitalizes the first letter of a string.
 * @param str - The string to capitalize
 * @returns The capitalized string
 * @example capitalize('foo') // Returns 'Foo'
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * ObjectTypeMatcher implementation for TypeMatcherWrapper.
 * Provides chainable API for validating object types with generics and properties.
 */
class WrapperObjectTypeMatcher implements ObjectTypeMatcher {
  private genericCheck?: string;
  private propertyChecks = new Map<string, TypeMatcher | undefined>();
  private propertyNameChecks: string[] = [];

  constructor(
    private readonly typeInfo: TypeInfo,
    private readonly expectedName?: string,
  ) {}

  withGeneric(name?: string): ObjectTypeMatcher {
    this.genericCheck = name ?? '';
    return this;
  }

  withProperty(name: string, type?: TypeMatcher): ObjectTypeMatcher {
    this.propertyChecks.set(name, type);
    return this;
  }

  withProperties(...names: string[]): ObjectTypeMatcher {
    this.propertyNameChecks.push(...names);
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (!isObjectTypeInfo(typeInfo)) {
      return false;
    }

    if (this.expectedName && 'name' in typeInfo && typeInfo.name !== this.expectedName) {
      return false;
    }

    if (this.genericCheck !== undefined && 'genericParams' in typeInfo) {
      const hasGeneric = Array.isArray(typeInfo.genericParams) && typeInfo.genericParams.length > 0;
      if (this.genericCheck === '') {
        if (!hasGeneric) return false;
      } else if (
        !hasGeneric ||
        !typeInfo.genericParams.some(p => 'name' in p && p.name === this.genericCheck)
      ) {
        return false;
      }
    }

    if (this.propertyChecks.size > 0 && 'properties' in typeInfo) {
      for (const [propName, propMatcher] of this.propertyChecks) {
        const prop = typeInfo.properties.find((p: PropertyInfo) => p.name === propName);
        if (!prop) return false;
        if (propMatcher && !propMatcher.match(prop.type)) return false;
      }
    }

    if (this.propertyNameChecks.length > 0 && 'properties' in typeInfo) {
      for (const propName of this.propertyNameChecks) {
        if (!typeInfo.properties.some((p: PropertyInfo) => p.name === propName)) {
          return false;
        }
      }
    }

    return true;
  }

  describe(): string {
    const parts = ['object'];
    if ('name' in this.typeInfo && this.typeInfo.name) {
      parts.push(`(${this.typeInfo.name})`);
    }
    if (this.genericCheck !== undefined) {
      parts.push(` with generic ${this.genericCheck || 'any'}`);
    }
    if (this.propertyChecks.size > 0) {
      parts.push(` with properties ${Array.from(this.propertyChecks.keys()).join(', ')}`);
    }
    if (this.propertyNameChecks.length > 0) {
      parts.push(` with properties ${this.propertyNameChecks.join(', ')}`);
    }
    return parts.join('');
  }
}

/**
 * ArrayTypeMatcher implementation for TypeMatcherWrapper.
 * Provides chainable API for validating array types and their element types.
 */
class WrapperArrayTypeMatcher implements ArrayTypeMatcher {
  private elementMatcher?: TypeMatcher;

  constructor(private readonly typeInfo: TypeInfo) {}

  of(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): ArrayTypeMatcher {
    this.elementMatcher = typeof matcher === 'function' ? matcher(createTypeMatcher()) : matcher;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (!isArrayTypeInfo(typeInfo)) {
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
 * UnionTypeMatcher implementation for TypeMatcherWrapper.
 * Provides chainable API for validating union types with containing or exact matching.
 */
class WrapperUnionTypeMatcher implements UnionTypeMatcher {
  private containingMatchers: TypeMatcher[] = [];
  private exactMatchers: TypeMatcher[] = [];

  constructor(private readonly typeInfo: TypeInfo) {}

  containing(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): UnionTypeMatcher {
    const resolved = typeof matcher === 'function' ? matcher(createTypeMatcher()) : matcher;
    this.containingMatchers.push(resolved);
    return this;
  }

  exact(...matchers: TypeMatcher[]): UnionTypeMatcher {
    this.exactMatchers = matchers;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (
      !isUnionTypeInfo(typeInfo) ||
      !('unionTypes' in typeInfo) ||
      !Array.isArray(typeInfo.unionTypes)
    ) {
      return false;
    }

    for (const matcher of this.containingMatchers) {
      if (!typeInfo.unionTypes.some((t: TypeInfo) => matcher.match(t))) {
        return false;
      }
    }

    if (this.exactMatchers.length > 0) {
      return exactMatchTypes(typeInfo.unionTypes, this.exactMatchers);
    }

    return true;
  }

  describe(): string {
    if (this.exactMatchers.length > 0) {
      return `union of exactly [${this.exactMatchers.map(m => m.describe()).join(', ')}]`;
    }
    if (this.containingMatchers.length > 0) {
      return `union containing [${this.containingMatchers.map(m => m.describe()).join(', ')}]`;
    }
    return 'union';
  }
}

/**
 * IntersectionTypeMatcher implementation for TypeMatcherWrapper.
 * Provides chainable API for validating intersection types with including or exact matching.
 */
class WrapperIntersectionTypeMatcher implements IntersectionTypeMatcher {
  private includingMatchers: TypeMatcher[] = [];
  private exactMatchers: TypeMatcher[] = [];

  constructor(private readonly typeInfo: TypeInfo) {}

  including(
    matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher),
  ): IntersectionTypeMatcher {
    const resolved = typeof matcher === 'function' ? matcher(createTypeMatcher()) : matcher;
    this.includingMatchers.push(resolved);
    return this;
  }

  exact(...matchers: TypeMatcher[]): IntersectionTypeMatcher {
    this.exactMatchers = matchers;
    return this;
  }

  match(typeInfo: TypeInfo): boolean {
    if (
      !isIntersectionTypeInfo(typeInfo) ||
      !('intersectionTypes' in typeInfo) ||
      !Array.isArray(typeInfo.intersectionTypes)
    ) {
      return false;
    }

    for (const matcher of this.includingMatchers) {
      if (!typeInfo.intersectionTypes.some((t: TypeInfo) => matcher.match(t))) {
        return false;
      }
    }

    if (this.exactMatchers.length > 0) {
      return exactMatchTypes(typeInfo.intersectionTypes, this.exactMatchers);
    }

    return true;
  }

  describe(): string {
    if (this.exactMatchers.length > 0) {
      return `intersection of exactly [${this.exactMatchers.map(m => m.describe()).join(', ')}]`;
    }
    if (this.includingMatchers.length > 0) {
      return `intersection including [${this.includingMatchers.map(m => m.describe()).join(', ')}]`;
    }
    return 'intersection';
  }
}

/**
 * Implementation of TypeMatcherInterface for enhanced contexts
 */
class TypeMatcherWrapper implements TypeMatcherInterface {
  constructor(private readonly typeInfo: TypeInfo) {}

  isPrimitive(...names: string[]): boolean {
    if (!isPrimitiveTypeInfo(this.typeInfo)) {
      return false;
    }

    if (names.length === 0) {
      return true;
    }

    return names.includes(this.typeInfo.name);
  }

  isObject(name?: string): ObjectTypeMatcher {
    return new WrapperObjectTypeMatcher(this.typeInfo, name);
  }

  isArray(): ArrayTypeMatcher {
    return new WrapperArrayTypeMatcher(this.typeInfo);
  }

  isUnion(): UnionTypeMatcher {
    return new WrapperUnionTypeMatcher(this.typeInfo);
  }

  isIntersection(): IntersectionTypeMatcher {
    return new WrapperIntersectionTypeMatcher(this.typeInfo);
  }

  isReference(name?: string): boolean {
    if (this.typeInfo.kind !== TypeKind.Reference) {
      return false;
    }

    if (name && 'name' in this.typeInfo && this.typeInfo.name !== name) {
      return false;
    }

    return true;
  }

  isGeneric(name?: string): boolean {
    if (this.typeInfo.kind !== TypeKind.Generic) {
      return false;
    }

    if (name && 'name' in this.typeInfo && this.typeInfo.name !== name) {
      return false;
    }

    return true;
  }

  matches(matcher: TypeMatcher): boolean {
    return matcher.match(this.typeInfo);
  }

  toString(): string {
    if ('name' in this.typeInfo && typeof this.typeInfo.name === 'string') {
      return this.typeInfo.name;
    }
    return this.typeInfo.kind;
  }

  transformDeep(): TypeDeepTransformer {
    return new TypeDeepTransformer(this.typeInfo);
  }

  containsDeep(matcher: TypeMatcher): boolean {
    return containsTypeDeep(this.typeInfo, matcher);
  }

  findDeep(matcher: TypeMatcher): TypeInfo[] {
    return findTypesDeep(this.typeInfo, matcher);
  }
}

/**
 * Creates an enhanced parse context with source file and type information.
 * @param sourceFile - Path to the source file being parsed
 * @param typeName - Name of the type being parsed
 * @returns Enhanced ParseContext object
 */
export function enhanceParseContext(sourceFile: string, typeName: string): ParseContext {
  return {
    sourceFile,
    typeName,
  };
}

/**
 * Creates an enhanced resolve context with type information and optional metadata.
 * @param type - The ts-morph Type being resolved
 * @param symbol - Optional symbol associated with the type
 * @param sourceFile - Optional source file path
 * @param typeName - Optional type name
 * @returns Enhanced ResolveContext object with only defined optional fields
 */
export function enhanceResolveContext(
  type: Type,
  symbol?: Symbol,
  sourceFile?: string,
  typeName?: string,
): ResolveContext {
  return {
    type,
    ...(symbol ? { symbol } : {}),
    ...(sourceFile ? { sourceFile } : {}),
    ...(typeName ? { typeName } : {}),
  };
}

/**
 * Creates an enhanced generate context with resolved type and generator options.
 * @param resolvedType - The resolved type information
 * @param options - Generator configuration options
 * @returns Enhanced GenerateContext object
 */
export function enhanceGenerateContext(
  resolvedType: ResolvedType,
  options: GeneratorOptions,
): GenerateContext {
  return {
    resolvedType,
    options,
  };
}

/**
 * Creates an enhanced property method context with type checking and helper utilities.
 * @param property - The property information
 * @param propertyType - Type information for the property
 * @param builderName - Name of the builder class
 * @param typeName - Name of the type being built
 * @param typeInfo - Complete type information
 * @param originalTypeString - Original TypeScript type string
 * @param genericParams - Optional generic parameter definitions
 * @returns Enhanced PropertyMethodContext with type matchers and helper methods
 */
export function enhancePropertyMethodContext(
  property: PropertyInfo,
  propertyType: TypeInfo,
  builderName: string,
  typeName: string,
  typeInfo: TypeInfo,
  originalTypeString: string,
  genericParams?: Array<{ name: string; constraint?: string }>,
): PropertyMethodContext {
  const type = new TypeMatcherWrapper(propertyType);

  return {
    property,
    propertyType,
    builderName,
    typeName,
    typeInfo,
    originalTypeString,
    type,

    hasGeneric(name: string): boolean {
      if (!genericParams) {
        return false;
      }
      return genericParams.some(param => param.name === name);
    },

    getGenericConstraint(name: string): string | undefined {
      if (!genericParams) {
        return undefined;
      }
      const param = genericParams.find(p => p.name === name);
      return param?.constraint;
    },

    isOptional(): boolean {
      return property.optional || false;
    },

    isReadonly(): boolean {
      return property.readonly || false;
    },

    getPropertyPath(): string[] {
      // For nested properties, return the path
      // This is a simplified implementation
      return [property.name];
    },

    getMethodName(): string {
      const name = property.name;

      if (name.includes('-')) {
        return 'with' + toPascalCase(name, '-');
      }

      if (name.includes('_')) {
        return 'with' + toPascalCase(name, '_');
      }

      return 'with' + capitalize(name);
    },
  };
}

/**
 * Creates an enhanced builder context with property access helpers.
 * @param typeName - Name of the type being built
 * @param typeInfo - Complete type information
 * @param builderName - Name of the builder class
 * @param properties - Array of property definitions
 * @param genericParams - Generic parameter string (e.g., '<T, U>')
 * @param genericConstraints - Generic constraint string (e.g., '<T extends Foo, U>')
 * @returns Enhanced BuilderContext with property filtering methods
 */
export function enhanceBuilderContext(
  typeName: string,
  typeInfo: TypeInfo,
  builderName: string,
  properties: readonly PropertyInfo[],
  genericParams: string,
  genericConstraints: string,
): BuilderContext {
  return {
    typeName,
    typeInfo,
    builderName,
    properties,
    genericParams,
    genericConstraints,

    hasProperty(name: string): boolean {
      return properties.some(p => p.name === name);
    },

    getProperty(name: string): PropertyInfo | undefined {
      return properties.find(p => p.name === name);
    },

    getRequiredProperties(): readonly PropertyInfo[] {
      return properties.filter(p => !p.optional);
    },

    getOptionalProperties(): readonly PropertyInfo[] {
      return properties.filter(p => p.optional);
    },
  };
}

/**
 * Creates an enhanced value context with type checking utilities.
 * @param property - Property name
 * @param valueVariable - Variable name for the value
 * @param type - Type information for the value
 * @param isOptional - Whether the value is optional
 * @returns Enhanced ValueContext with type checker
 */
export function enhanceValueContext(
  property: string,
  valueVariable: string,
  type: TypeInfo,
  isOptional: boolean,
): ValueContext {
  const typeChecker = new TypeMatcherWrapper(type);

  return {
    property,
    valueVariable,
    type,
    isOptional,
    typeChecker,
  };
}

/**
 * Creates an enhanced build method context with complete build information.
 * @param typeName - Name of the type being built
 * @param typeInfo - Complete type information
 * @param builderName - Name of the builder class
 * @param buildMethodCode - Generated code for the build method
 * @param properties - Array of property definitions
 * @param options - Generator configuration options
 * @param resolvedType - The resolved type information
 * @param genericParams - Generic parameter string
 * @param genericConstraints - Generic constraint string
 * @returns Enhanced BuildMethodContext with all build-related information
 */
export function enhanceBuildMethodContext(
  typeName: string,
  typeInfo: TypeInfo,
  builderName: string,
  buildMethodCode: string,
  properties: readonly PropertyInfo[],
  options: GeneratorOptions,
  resolvedType: ResolvedType,
  genericParams: string,
  genericConstraints: string,
): BuildMethodContext {
  return {
    typeName,
    typeInfo,
    builderName,
    buildMethodCode,
    properties,
    options,
    resolvedType,
    genericParams,
    genericConstraints,
  };
}
