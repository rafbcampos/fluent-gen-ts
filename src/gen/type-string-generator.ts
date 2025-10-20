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
   * @throws Error if typeInfo is malformed
   */
  typeInfoToString(typeInfo: TypeInfo): string {
    // Validate input in development mode
    if (process.env.NODE_ENV !== 'production') {
      this.validateTypeInfo(typeInfo);
    }
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
        const genericArgs = this.formatTypeArguments(typeInfo.typeArguments);
        return `${typeInfo.name}${genericArgs}`;
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
        // This should never happen with well-formed TypeInfo
        // Log or throw in development to catch missing cases
        if (process.env.NODE_ENV !== 'production') {
          // Use type assertion here since we're in the default case of an exhaustive switch
          // This means we've encountered an unexpected TypeKind value
          const unknownTypeInfo = typeInfo as TypeInfo & { kind: unknown };
          console.warn(`Unhandled TypeKind: ${unknownTypeInfo.kind}`);
        }
        return 'unknown';
    }
  }

  /**
   * Gets the property type string with optional builder support
   * @param prop - The property information
   * @throws Error if prop is malformed
   */
  getPropertyType(prop: PropertyInfo): string {
    if (!prop) {
      throw new Error('PropertyInfo cannot be null or undefined');
    }
    if (!prop.type) {
      throw new Error('PropertyInfo must have a type property');
    }
    if (typeof prop.name !== 'string' || prop.name.trim() === '') {
      throw new Error('PropertyInfo must have a valid name');
    }
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

      const typeArgs = this.formatTypeArguments(typeInfo.typeArguments);
      if (typeArgs) {
        // Reconstruct generic signature: TypeName<Arg1, Arg2, ...>
        builderTypeString = `${typeInfo.name}${typeArgs}`;
      } else if (typeInfo.unresolvedGenerics && typeInfo.unresolvedGenerics.length > 0) {
        // If there are unresolved generics, include them as type arguments
        const genericArgs = typeInfo.unresolvedGenerics.map(g => g.name).join(', ');
        builderTypeString = `${typeInfo.name}<${genericArgs}>`;
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
   * Formats type arguments for generic types
   * @param typeArguments - The type arguments to format
   * @returns Formatted type arguments string like "<T, U>" or empty string if no args
   */
  private formatTypeArguments(typeArguments?: readonly TypeInfo[]): string {
    if (!typeArguments || typeArguments.length === 0) {
      return '';
    }
    const args = typeArguments.map(arg => this.typeInfoToString(arg)).join(', ');
    return `<${args}>`;
  }

  /**
   * Type guard to check if typeInfo is a union type.
   */
  private isUnionType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Union }> {
    return typeInfo.kind === TypeKind.Union;
  }

  /**
   * Type guard to check if typeInfo is an intersection type.
   */
  private isIntersectionType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Intersection }> {
    return typeInfo.kind === TypeKind.Intersection;
  }

  /**
   * Type guard to check if typeInfo is an array type.
   */
  private isArrayType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Array }> {
    return typeInfo.kind === TypeKind.Array;
  }

  /**
   * Type guard to check if typeInfo is a tuple type.
   */
  private isTupleType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Tuple }> {
    return typeInfo.kind === TypeKind.Tuple;
  }

  /**
   * Validates that a TypeInfo object has the minimum required structure.
   * @param typeInfo - The type information to validate
   * @throws Error if the typeInfo is invalid
   */
  private validateTypeInfo(typeInfo: TypeInfo): void {
    if (!typeInfo) {
      throw new Error('TypeInfo cannot be null or undefined');
    }
    if (!typeInfo.kind) {
      throw new Error('TypeInfo must have a kind property');
    }

    // Validate specific requirements based on type kind
    switch (typeInfo.kind) {
      case TypeKind.Union:
        if (this.isUnionType(typeInfo) && !Array.isArray(typeInfo.unionTypes)) {
          throw new Error('Union type must have unionTypes array');
        }
        break;
      case TypeKind.Intersection:
        if (this.isIntersectionType(typeInfo) && !Array.isArray(typeInfo.intersectionTypes)) {
          throw new Error('Intersection type must have intersectionTypes array');
        }
        break;
      case TypeKind.Array:
        if (this.isArrayType(typeInfo) && !typeInfo.elementType) {
          throw new Error('Array type must have elementType');
        }
        break;
      case TypeKind.Tuple:
        if (this.isTupleType(typeInfo) && !Array.isArray(typeInfo.elements)) {
          throw new Error('Tuple type must have elements array');
        }
        break;
    }
  }

  /**
   * Handles primitive type conversion.
   * Primitive types (string, number, boolean, etc.) are returned as-is.
   *
   * @param typeInfo - The primitive type information
   * @returns The primitive type name (e.g., "string", "number", "boolean")
   */
  private handlePrimitiveType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Primitive }>): string {
    return typeInfo.name;
  }

  /**
   * Handles union type conversion
   */
  private handleUnionType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Union }>): string {
    if (!typeInfo.unionTypes || typeInfo.unionTypes.length === 0) {
      return 'never';
    }
    return typeInfo.unionTypes.map(t => this.typeInfoToString(t)).join(' | ');
  }

  /**
   * Handles intersection type conversion
   */
  private handleIntersectionType(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Intersection }>,
  ): string {
    if (!typeInfo.intersectionTypes || typeInfo.intersectionTypes.length === 0) {
      return 'unknown';
    }
    return typeInfo.intersectionTypes.map(t => this.typeInfoToString(t)).join(' & ');
  }

  /**
   * Handles literal type conversion.
   * Converts JavaScript literal values to their TypeScript literal type representation.
   *
   * @param typeInfo - The literal type information
   * @returns Properly formatted literal type string
   *
   * @example
   * // String literal: "hello" -> '"hello"'
   * // Number literal: 42 -> "42"
   * // Boolean literal: true -> "true"
   */
  private handleLiteralType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Literal }>): string {
    return typeof typeInfo.literal === 'string'
      ? `"${typeInfo.literal}"`
      : String(typeInfo.literal);
  }

  /**
   * Handles object type conversion.
   * For named object types (like User, Address), returns the type name with generic arguments if present.
   * For internal TypeScript types (like __type), returns the generic "object" type.
   *
   * @param typeInfo - The object type information
   * @returns Formatted object type string
   *
   * @example
   * // Named type: "User" -> "User"
   * // Generic type: "PagedData<User>" -> "PagedData<User>"
   * // Internal type: "__type" -> "object"
   */
  private handleObjectType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>): string {
    // For internal TypeScript types like "__type", check if it's an anonymous object with properties
    if (!typeInfo.name || !isValidImportableTypeName(typeInfo.name)) {
      // If it has properties, generate inline object type
      if (typeInfo.properties && typeInfo.properties.length > 0) {
        const propertyStrings = typeInfo.properties.map(prop => {
          const propType = this.typeInfoToString(prop.type);
          const optional = prop.optional ? '?' : '';
          return `${prop.name}${optional}: ${propType}`;
        });
        return `{ ${propertyStrings.join('; ')} }`;
      }
      // Otherwise, use generic "object" type
      return 'object';
    }

    // For resolved generic instantiations, reconstruct the original generic signature
    const typeArgs = this.formatTypeArguments(typeInfo.typeArguments);
    if (typeArgs) {
      return `${typeInfo.name}${typeArgs}`;
    }

    // If there are unresolved generics, include them as type arguments
    // unresolvedGenerics is an array of GenericParam objects
    if (typeInfo.unresolvedGenerics && typeInfo.unresolvedGenerics.length > 0) {
      const genericArgs = typeInfo.unresolvedGenerics.map(g => g.name).join(', ');
      return `${typeInfo.name}<${genericArgs}>`;
    }

    return typeInfo.name;
  }

  /**
   * Removes undefined from union types for optional properties.
   * Since optional properties are marked with '?', we don't need undefined in the type union.
   *
   * @param prop - The property information containing type and optional flag
   * @param baseType - The base type string (used as fallback if not a union or no changes needed)
   * @returns Type string with undefined removed from union if applicable
   *
   * @example
   * // For optional property with type: string | undefined
   * // Returns: "string" (undefined removed since property is marked optional)
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
   * Type guard to check if typeInfo is an object type.
   * This is used throughout the code to safely access object-specific properties
   * like 'name' and 'properties' after confirming the type kind.
   *
   * @param typeInfo - The type information to check
   * @returns True if the type is an object type, with proper type narrowing
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

    // Check if properties have buildable types
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
  /**
   * Checks if a property name needs quotes in TypeScript type definitions
   * @param name - The property name to check
   * @returns True if the property name needs quotes
   */
  private needsQuotes(name: string): boolean {
    // Valid TypeScript identifier: starts with letter/$/_, followed by letter/digit/$/_
    return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
  }

  /**
   * Formats a property name with quotes if needed
   * @param name - The property name to format
   * @returns Formatted property name
   */
  private formatPropertyName(name: string): string {
    return this.needsQuotes(name) ? `"${name}"` : name;
  }

  private getAnonymousObjectTypeWithBuilders(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>,
  ): string {
    if (!typeInfo.properties || typeInfo.properties.length === 0) {
      return 'object';
    }

    const propertyStrings = typeInfo.properties.map(prop => {
      const propName = this.formatPropertyName(prop.name);
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
