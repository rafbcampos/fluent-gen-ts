/**
 * Type string generation utilities
 * Converts TypeInfo structures to TypeScript type strings
 */

import type { TypeInfo, PropertyInfo, GenericParam } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import { isValidImportableTypeName } from './types.js';

/**
 * Configuration options for TypeStringGenerator
 */
export interface TypeStringGeneratorOptions {
  /** Name of the FluentBuilder type to use */
  readonly builderTypeName?: string;
  /** Name of the base build context type to use */
  readonly contextTypeName?: string;
  /** Whether to include builder types for object properties */
  readonly includeBuilderTypes?: boolean;
}

/**
 * Generates TypeScript type strings from TypeInfo structures
 */
export class TypeStringGenerator {
  private readonly options: Required<TypeStringGeneratorOptions>;

  constructor(options: TypeStringGeneratorOptions = {}) {
    this.options = {
      builderTypeName: options.builderTypeName ?? 'FluentBuilder',
      contextTypeName: options.contextTypeName ?? 'BaseBuildContext',
      includeBuilderTypes: options.includeBuilderTypes ?? true,
    };
  }
  /**
   * Converts TypeInfo to a TypeScript type string
   * @param typeInfo - The type information to convert
   */
  typeInfoToString(typeInfo: TypeInfo): string {
    switch (typeInfo.kind) {
      case TypeKind.Primitive:
        return this.handlePrimitiveType(typeInfo);
      case TypeKind.Array:
        return `Array<${this.typeInfoToString(typeInfo.elementType)}>`;
      case TypeKind.Union:
        return this.handleUnionType(typeInfo);
      case TypeKind.Intersection:
        return this.handleIntersectionType(typeInfo);
      case TypeKind.Literal:
        return this.handleLiteralType(typeInfo);
      case TypeKind.Object:
        return this.handleObjectType(typeInfo);
      case TypeKind.Reference:
        return typeInfo.name;
      case TypeKind.Generic:
        if (typeInfo.typeArguments && typeInfo.typeArguments.length > 0) {
          const args = typeInfo.typeArguments.map(arg => this.typeInfoToString(arg)).join(', ');
          return `${typeInfo.name}<${args}>`;
        }
        return typeInfo.name;
      case TypeKind.Function:
        return typeInfo.name ?? 'Function';
      case TypeKind.Tuple:
        return `[${typeInfo.elements.map(element => this.typeInfoToString(element)).join(', ')}]`;
      case TypeKind.Enum:
        return typeInfo.name;
      case TypeKind.Keyof:
        return this.handleKeyofType(typeInfo);
      case TypeKind.Typeof:
        return this.handleTypeofType(typeInfo);
      case TypeKind.Index:
        return this.handleIndexType(typeInfo);
      case TypeKind.Conditional:
        return this.handleConditionalType(typeInfo);
      case TypeKind.Unknown:
        return 'unknown';
      case TypeKind.Never:
        return 'never';
      default:
        return 'unknown';
    }
  }

  /**
   * Gets the property type string with optional builder support
   * @param prop - The property information
   */
  getPropertyType(prop: PropertyInfo): string {
    const baseType = this.getCleanPropertyType(prop);

    // Handle arrays with nested builders
    if (prop.type.kind === TypeKind.Array) {
      const elementBuilderType = this.getBuilderTypeIfApplicable(prop.type.elementType);
      if (elementBuilderType) {
        // Generate array type that accepts both plain objects and builders
        const elementType = this.typeInfoToString(prop.type.elementType);
        return `Array<${elementType} | ${elementBuilderType}>`;
      }

      // Handle arrays of anonymous objects with nested builders
      if (
        this.isObjectType(prop.type.elementType) &&
        this.hasNestedBuildableTypes(prop.type.elementType)
      ) {
        const elementType = this.getAnonymousObjectTypeWithBuilders(prop.type.elementType);
        return `Array<${elementType}>`;
      }
    }

    // Handle tuples with nested builders
    if (prop.type.kind === TypeKind.Tuple) {
      const tupleElements = prop.type.elements.map(element => {
        const elementTypeStr = this.typeInfoToString(element);
        const elementBuilder = this.getBuilderTypeIfApplicable(element);
        return elementBuilder ? `${elementTypeStr} | ${elementBuilder}` : elementTypeStr;
      });
      return `[${tupleElements.join(', ')}]`;
    }

    // Handle anonymous objects with nested builders
    if (this.isObjectType(prop.type) && this.hasNestedBuildableTypes(prop.type)) {
      return this.getAnonymousObjectTypeWithBuilders(prop.type);
    }

    // Handle direct builder types
    const builderType = this.getBuilderTypeIfApplicable(prop.type);
    return builderType ? `${baseType} | ${builderType}` : baseType;
  }

  /**
   * Gets the clean property type string without builder support
   * @param prop - The property information
   */
  private getCleanPropertyType(prop: PropertyInfo): string {
    let baseType = this.typeInfoToString(prop.type);

    // For optional properties, remove undefined from union types
    if (prop.optional) {
      baseType = this.removeUndefinedFromType(prop, baseType);
    }

    return baseType;
  }

  /**
   * Gets the builder type string if applicable for the given type
   * @param typeInfo - The type information
   * @returns Builder type string or null if not applicable
   */
  private getBuilderTypeIfApplicable(typeInfo: TypeInfo): string | null {
    if (!this.options.includeBuilderTypes) {
      return null;
    }

    if (this.isObjectType(typeInfo) && typeInfo.name && isValidImportableTypeName(typeInfo.name)) {
      // For resolved generic instantiations, reconstruct the original generic signature
      // (e.g., PagedData<User>) instead of the expanded structure
      let builderTypeString = typeInfo.name;

      if (typeInfo.typeArguments && typeInfo.typeArguments.length > 0) {
        // Reconstruct generic signature: TypeName<Arg1, Arg2, ...>
        const typeArgStrings = typeInfo.typeArguments.map(arg => this.typeInfoToString(arg));
        builderTypeString = `${typeInfo.name}<${typeArgStrings.join(', ')}>`;
      }

      return `${this.options.builderTypeName}<${builderTypeString}, ${this.options.contextTypeName}>`;
    }
    return null;
  }

  /**
   * Formats generic parameters with constraints and defaults
   * @param params - The generic parameters
   */
  formatGenericParams(params?: readonly GenericParam[]): string {
    if (!params || params.length === 0) return '';

    const formatted = params.map(p => {
      let param = p.name;
      if (p.constraint) {
        param += ` extends ${this.typeInfoToString(p.constraint)}`;
      }
      if (p.default) {
        param += ` = ${this.typeInfoToString(p.default)}`;
      }
      return param;
    });

    return `<${formatted.join(', ')}>`;
  }

  /**
   * Formats generic constraints without defaults
   * @param params - The generic parameters
   */
  formatGenericConstraints(params?: readonly GenericParam[]): string {
    if (!params || params.length === 0) return '';
    return `<${params.map(p => p.name).join(', ')}>`;
  }

  /**
   * Handles primitive type conversion
   */
  private handlePrimitiveType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Primitive }>): string {
    return typeInfo.name;
  }

  /**
   * Handles union type conversion
   */
  private handleUnionType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Union }>): string {
    return typeInfo.unionTypes.map(t => this.typeInfoToString(t)).join(' | ');
  }

  /**
   * Handles intersection type conversion
   */
  private handleIntersectionType(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Intersection }>,
  ): string {
    return typeInfo.intersectionTypes.map(t => this.typeInfoToString(t)).join(' & ');
  }

  /**
   * Handles literal type conversion
   */
  private handleLiteralType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Literal }>): string {
    return typeof typeInfo.literal === 'string'
      ? `"${typeInfo.literal}"`
      : String(typeInfo.literal);
  }

  /**
   * Handles object type conversion
   */
  private handleObjectType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>): string {
    // For internal TypeScript types like "__type", use "object" instead
    if (!typeInfo.name || !isValidImportableTypeName(typeInfo.name)) {
      return 'object';
    }

    // For resolved generic instantiations, reconstruct the original generic signature
    if (typeInfo.typeArguments && typeInfo.typeArguments.length > 0) {
      const typeArgStrings = typeInfo.typeArguments.map(arg => this.typeInfoToString(arg));
      return `${typeInfo.name}<${typeArgStrings.join(', ')}>`;
    }

    return typeInfo.name;
  }

  /**
   * Removes undefined from union types for optional properties
   */
  private removeUndefinedFromType(prop: PropertyInfo, baseType: string): string {
    if (prop.type.kind === TypeKind.Union) {
      const nonUndefinedTypes = prop.type.unionTypes?.filter(
        t => !(t.kind === TypeKind.Primitive && t.name === 'undefined'),
      );
      if (nonUndefinedTypes && nonUndefinedTypes.length > 0) {
        return nonUndefinedTypes.map(t => this.typeInfoToString(t)).join(' | ');
      }
    }
    return baseType;
  }

  /**
   * Type guard to check if typeInfo is an object type
   */
  private isObjectType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> {
    return typeInfo.kind === TypeKind.Object;
  }

  /**
   * Handles keyof type conversion
   */
  private handleKeyofType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Keyof }>): string {
    return `keyof ${this.typeInfoToString(typeInfo.target)}`;
  }

  /**
   * Handles typeof type conversion
   */
  private handleTypeofType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Typeof }>): string {
    return `typeof ${this.typeInfoToString(typeInfo.target)}`;
  }

  /**
   * Handles index access type conversion
   */
  private handleIndexType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Index }>): string {
    return `${this.typeInfoToString(typeInfo.object)}[${this.typeInfoToString(typeInfo.index)}]`;
  }

  /**
   * Handles conditional type conversion
   */
  private handleConditionalType(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Conditional }>,
  ): string {
    const checkType = this.typeInfoToString(typeInfo.checkType);
    const extendsType = this.typeInfoToString(typeInfo.extendsType);
    const trueType = this.typeInfoToString(typeInfo.trueType);
    const falseType = this.typeInfoToString(typeInfo.falseType);
    return `${checkType} extends ${extendsType} ? ${trueType} : ${falseType}`;
  }

  /**
   * Checks if an object type has nested types that can have builders
   * @param typeInfo - The object type to check
   * @returns True if it has nested buildable types
   */
  private hasNestedBuildableTypes(typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>): boolean {
    if (!this.options.includeBuilderTypes) {
      return false;
    }

    // Only process anonymous objects (invalid names like __type)
    if (typeInfo.name && isValidImportableTypeName(typeInfo.name)) {
      return false;
    }

    // Check if any properties have buildable types
    return typeInfo.properties?.some(prop => this.isTypeBuilderEligible(prop.type)) ?? false;
  }

  /**
   * Checks if a type is eligible for builder generation
   * @param typeInfo - The type to check
   * @returns True if the type can have a builder
   */
  private isTypeBuilderEligible(typeInfo: TypeInfo): boolean {
    if (typeInfo.kind === TypeKind.Object) {
      // Named object types are eligible
      if (typeInfo.name && isValidImportableTypeName(typeInfo.name)) {
        return true;
      }
      // Anonymous objects with properties are also eligible
      return typeInfo.properties && typeInfo.properties.length > 0;
    }
    return false;
  }

  /**
   * Generates the type string for anonymous objects with builder support
   * @param typeInfo - The anonymous object type
   * @returns Type string with builder alternatives for eligible properties
   */
  private getAnonymousObjectTypeWithBuilders(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>,
  ): string {
    if (!typeInfo.properties || typeInfo.properties.length === 0) {
      return 'object';
    }

    const propertyStrings = typeInfo.properties.map(prop => {
      const propName = prop.name;
      let propType = this.typeInfoToString(prop.type);

      // Add builder alternative for eligible types
      if (this.isTypeBuilderEligible(prop.type)) {
        if (
          this.isObjectType(prop.type) &&
          prop.type.name &&
          isValidImportableTypeName(prop.type.name)
        ) {
          // Named object type - use existing logic
          const builderType = this.getBuilderTypeIfApplicable(prop.type);
          if (builderType) {
            propType = `${propType} | ${builderType}`;
          }
        } else if (this.isObjectType(prop.type) && prop.type.properties) {
          // Anonymous nested object - recurse
          const nestedType = this.getAnonymousObjectTypeWithBuilders(prop.type);
          propType = nestedType;
        }
      }

      const optionalMarker = prop.optional ? '?' : '';
      return `${propName}${optionalMarker}: ${propType}`;
    });

    return `{ ${propertyStrings.join('; ')} }`;
  }
}
