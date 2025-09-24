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
} from './plugin-types.js';
import { createTypeMatcher } from './type-matcher.js';
import {
  isObjectTypeInfo,
  isUnionTypeInfo,
  isIntersectionTypeInfo,
  isArrayTypeInfo,
  isPrimitiveTypeInfo,
} from '../../type-info/type-guards.js';

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

  isObject(name?: string): any {
    if (!isObjectTypeInfo(this.typeInfo)) {
      return {
        withGeneric: () => false,
        withProperty: () => false,
        withProperties: () => false,
        match: () => false,
        describe: () => 'not-object',
      };
    }

    if (name && 'name' in this.typeInfo && this.typeInfo.name !== name) {
      return {
        withGeneric: () => false,
        withProperty: () => false,
        withProperties: () => false,
        match: () => false,
        describe: () => `not-object(${name})`,
      };
    }

    // Return a chainable object for further checks
    const objectType = this.typeInfo;
    return {
      withGeneric: (genericName?: string) => {
        if (!('genericParams' in objectType) || !Array.isArray(objectType.genericParams)) {
          return false;
        }

        if (genericName === undefined) {
          return objectType.genericParams.length > 0;
        }

        return objectType.genericParams.some(
          param => 'name' in param && param.name === genericName,
        );
      },
      withProperty: (propName: string, typeMatcher?: TypeMatcher) => {
        if (!('properties' in objectType) || !Array.isArray(objectType.properties)) {
          return false;
        }

        const prop = objectType.properties.find((p: any) => p.name === propName);
        if (!prop) {
          return false;
        }

        if (typeMatcher) {
          return typeMatcher.match(prop.type);
        }

        return true;
      },
      withProperties: (...propNames: string[]) => {
        if (!('properties' in objectType) || !Array.isArray(objectType.properties)) {
          return false;
        }

        return propNames.every(name => objectType.properties.some((p: any) => p.name === name));
      },
    };
  }

  isArray(): any {
    if (!isArrayTypeInfo(this.typeInfo)) {
      return {
        of: () => false,
        match: () => false,
        describe: () => 'not-array',
      };
    }

    const arrayType = this.typeInfo;
    return {
      of: (matcher: TypeMatcher | ((m: any) => TypeMatcher)) => {
        if (!('elementType' in arrayType) || !arrayType.elementType) {
          return false;
        }

        const actualMatcher =
          typeof matcher === 'function' ? matcher(createTypeMatcher()) : matcher;

        return actualMatcher.match(arrayType.elementType);
      },
    };
  }

  isUnion(): any {
    if (!isUnionTypeInfo(this.typeInfo)) {
      return {
        containing: () => false,
        exact: () => false,
        match: () => false,
        describe: () => 'not-union',
      };
    }

    const unionType = this.typeInfo;
    return {
      containing: (matcher: TypeMatcher | ((m: any) => TypeMatcher)) => {
        if (!('unionTypes' in unionType) || !Array.isArray(unionType.unionTypes)) {
          return false;
        }

        const actualMatcher =
          typeof matcher === 'function' ? matcher(createTypeMatcher()) : matcher;

        return unionType.unionTypes.some((t: any) => actualMatcher.match(t));
      },
      exact: (...matchers: TypeMatcher[]) => {
        if (!('unionTypes' in unionType) || !Array.isArray(unionType.unionTypes)) {
          return false;
        }

        if (unionType.unionTypes.length !== matchers.length) {
          return false;
        }

        const usedMatchers = new Set<number>();
        for (const ut of unionType.unionTypes) {
          let found = false;
          for (let i = 0; i < matchers.length; i++) {
            const matcher = matchers[i];
            if (!usedMatchers.has(i) && matcher && matcher.match(ut)) {
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
      },
    };
  }

  isIntersection(): any {
    if (!isIntersectionTypeInfo(this.typeInfo)) {
      return {
        including: () => false,
        exact: () => false,
        match: () => false,
        describe: () => 'not-intersection',
      };
    }

    const intersectionType = this.typeInfo;
    return {
      including: (matcher: TypeMatcher | ((m: any) => TypeMatcher)) => {
        if (!('types' in intersectionType) || !Array.isArray(intersectionType.types)) {
          return false;
        }

        const actualMatcher =
          typeof matcher === 'function' ? matcher(createTypeMatcher()) : matcher;

        return intersectionType.types.some((t: any) => actualMatcher.match(t));
      },
      exact: (...matchers: TypeMatcher[]) => {
        if (!('types' in intersectionType) || !Array.isArray(intersectionType.types)) {
          return false;
        }

        if (intersectionType.types.length !== matchers.length) {
          return false;
        }

        const usedMatchers = new Set<number>();
        for (const it of intersectionType.types) {
          let found = false;
          for (let i = 0; i < matchers.length; i++) {
            const matcher = matchers[i];
            if (!usedMatchers.has(i) && matcher && matcher.match(it)) {
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
      },
    };
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
}

/**
 * Enhance parse context
 */
export function enhanceParseContext(sourceFile: string, typeName: string): ParseContext {
  return {
    sourceFile,
    typeName,
  };
}

/**
 * Enhance resolve context
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
 * Enhance generate context
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
 * Enhance property method context with helper methods
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
      // Convert property name to method name (camelCase)
      const name = property.name;

      // Handle kebab-case
      if (name.includes('-')) {
        return (
          'with' +
          name
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('')
        );
      }

      // Handle snake_case
      if (name.includes('_')) {
        return (
          'with' +
          name
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('')
        );
      }

      // Regular camelCase
      return 'with' + name.charAt(0).toUpperCase() + name.slice(1);
    },
  };
}

/**
 * Enhance builder context with helper methods
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
 * Enhance value context with type utilities
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
 * Enhance build method context
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
