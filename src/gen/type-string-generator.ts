/**
 * Type string generation utilities
 * Converts TypeInfo structures to TypeScript type strings
 */

import type { TypeInfo, PropertyInfo, GenericParam } from "../core/types.js";
import { TypeKind } from "../core/types.js";
import { isValidImportableTypeName, isPrimitiveTypeName } from "./types.js";

/**
 * Generates TypeScript type strings from TypeInfo structures
 */
export class TypeStringGenerator {
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
        return typeInfo.name;
      case TypeKind.Function:
        return typeInfo.name ?? "Function";
      case TypeKind.Tuple:
        return `[${typeInfo.elements.map(element => this.typeInfoToString(element)).join(", ")}]`;
      case TypeKind.Enum:
        return typeInfo.name;
      case TypeKind.Unknown:
        return "unknown";
      default:
        return "unknown";
    }
  }

  /**
   * Gets the property type string with optional builder support
   * @param prop - The property information
   */
  getPropertyType(prop: PropertyInfo): string {
    let baseType = this.typeInfoToString(prop.type);

    // For optional properties, remove undefined from union types
    if (prop.optional) {
      baseType = this.removeUndefinedFromType(prop, baseType);
    }

    // Add builder support for object types
    if (this.isObjectType(prop.type) && prop.type.name && isValidImportableTypeName(prop.type.name)) {
      const builderType = `FluentBuilder<${prop.type.name}, BaseBuildContext>`;
      return `${baseType} | ${builderType}`;
    }

    return baseType;
  }

  /**
   * Formats generic parameters with constraints and defaults
   * @param params - The generic parameters
   */
  formatGenericParams(params?: readonly GenericParam[]): string {
    if (!params || params.length === 0) return "";

    const formatted = params.map((p) => {
      let param = p.name;
      if (p.constraint) {
        param += ` extends ${this.typeInfoToString(p.constraint)}`;
      }
      if (p.default) {
        param += ` = ${this.typeInfoToString(p.default)}`;
      }
      return param;
    });

    return `<${formatted.join(", ")}>`;
  }

  /**
   * Formats generic constraints without defaults
   * @param params - The generic parameters
   */
  formatGenericConstraints(params?: readonly GenericParam[]): string {
    if (!params || params.length === 0) return "";
    return `<${params.map((p) => p.name).join(", ")}>`;
  }

  /**
   * Handles primitive type conversion
   */
  private handlePrimitiveType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Primitive }>): string {
    // Use proper type classification
    if (isPrimitiveTypeName(typeInfo.name)) {
      return typeInfo.name;
    }
    return typeInfo.name;
  }

  /**
   * Handles union type conversion
   */
  private handleUnionType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Union }>): string {
    return typeInfo.unionTypes
      .map((t) => this.typeInfoToString(t))
      .join(" | ");
  }

  /**
   * Handles intersection type conversion
   */
  private handleIntersectionType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Intersection }>): string {
    return typeInfo.intersectionTypes
      .map((t) => this.typeInfoToString(t))
      .join(" & ");
  }

  /**
   * Handles literal type conversion
   */
  private handleLiteralType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Literal }>): string {
    return typeof typeInfo.literal === "string"
      ? `"${typeInfo.literal}"`
      : String(typeInfo.literal);
  }

  /**
   * Handles object type conversion
   */
  private handleObjectType(typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>): string {
    // For internal TypeScript types like "__type", use "object" instead
    return typeInfo.name && isValidImportableTypeName(typeInfo.name)
      ? typeInfo.name
      : "object";
  }

  /**
   * Removes undefined from union types for optional properties
   */
  private removeUndefinedFromType(prop: PropertyInfo, baseType: string): string {
    if (prop.type.kind === TypeKind.Union) {
      const nonUndefinedTypes = prop.type.unionTypes?.filter(
        (t) => !(t.kind === TypeKind.Primitive && t.name === "undefined"),
      );
      if (nonUndefinedTypes && nonUndefinedTypes.length > 0) {
        return nonUndefinedTypes
          .map((t) => this.typeInfoToString(t))
          .join(" | ");
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
}