/**
 * Default value generation utilities
 * Generates appropriate default values for TypeScript types
 */

import type { TypeInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";
import { PrimitiveType } from "./types.js";
import { TypeStringGenerator } from "./type-string-generator.js";

/**
 * Configuration for default value generation
 */
export interface DefaultGeneratorConfig {
  /** Whether to use default values */
  readonly useDefaults: boolean;
  /** Custom default generators by type */
  readonly customDefaults?: Map<string, () => string>;
}

/**
 * Generates default values for TypeScript types
 */
export class DefaultValueGenerator {
  private readonly typeStringGenerator = new TypeStringGenerator();

  /**
   * Generates a defaults object for a type
   * @param typeInfo - The type information
   * @param config - Default generation configuration
   */
  generateDefaultsObject(typeInfo: TypeInfo, config: DefaultGeneratorConfig): string | null {
    if (!config.useDefaults || !this.isObjectType(typeInfo)) {
      return null;
    }

    const defaults: string[] = [];

    for (const prop of typeInfo.properties) {
      // Only generate defaults for required properties
      if (prop.optional) continue;

      // Skip object and reference types that would cause TypeScript issues
      if (this.shouldSkipDefault(prop.type)) {
        continue;
      }

      const defaultValue = this.getDefaultValueForType(prop.type, config);
      if (defaultValue !== "undefined") {
        defaults.push(this.formatDefaultProperty(prop.name, defaultValue));
      }
    }

    if (defaults.length === 0) return null;
    return `{ ${defaults.join(", ")} }`;
  }

  /**
   * Generates default value for a specific type
   * @param typeInfo - The type to generate a default for
   * @param config - Default generation configuration
   */
  getDefaultValueForType(typeInfo: TypeInfo, config?: DefaultGeneratorConfig): string {
    // Check for custom defaults first
    if (config?.customDefaults && typeInfo.kind === TypeKind.Primitive) {
      const customDefault = config.customDefaults.get(typeInfo.name);
      if (customDefault) {
        return customDefault();
      }
    }

    switch (typeInfo.kind) {
      case TypeKind.Primitive:
        return this.getPrimitiveDefault(typeInfo.name);
      case TypeKind.Array:
        return "[]";
      case TypeKind.Function:
        return "() => undefined";
      case TypeKind.Literal:
        return this.getLiteralDefault(typeInfo);
      case TypeKind.Union:
        return this.getUnionDefault(typeInfo);
      case TypeKind.Object:
        return "{}";
      case TypeKind.Reference:
        return "{}";
      case TypeKind.Generic:
        return "undefined";
      case TypeKind.Tuple:
        return "[]";
      case TypeKind.Intersection:
        return "{}";
      case TypeKind.Enum:
        return "undefined";
      case TypeKind.Unknown:
      default:
        return "undefined";
    }
  }

  /**
   * Gets default value for primitive types
   */
  private getPrimitiveDefault(name: string): string {
    switch (name) {
      case PrimitiveType.String:
        return '""';
      case PrimitiveType.Number:
        return "0";
      case PrimitiveType.Boolean:
        return "false";
      case PrimitiveType.BigInt:
        return "BigInt(0)";
      case PrimitiveType.Symbol:
        return "Symbol()";
      case PrimitiveType.Undefined:
      case PrimitiveType.Null:
      case PrimitiveType.Void:
      case PrimitiveType.Never:
      case PrimitiveType.Any:
      case PrimitiveType.Unknown:
      default:
        return "undefined";
    }
  }

  /**
   * Gets default value for literal types
   */
  private getLiteralDefault(typeInfo: Extract<TypeInfo, { kind: TypeKind.Literal }>): string {
    return typeof typeInfo.literal === "string"
      ? `"${typeInfo.literal}"`
      : String(typeInfo.literal);
  }

  /**
   * Gets default value for union types
   */
  private getUnionDefault(typeInfo: Extract<TypeInfo, { kind: TypeKind.Union }>): string {
    // For unions, pick the first non-undefined type
    if (typeInfo.unionTypes && typeInfo.unionTypes.length > 0) {
      const firstNonUndefined = typeInfo.unionTypes.find(
        (t) => !(t.kind === TypeKind.Primitive && t.name === "undefined"),
      );
      if (firstNonUndefined) {
        return this.getDefaultValueForType(firstNonUndefined);
      }
    }
    return "undefined";
  }

  /**
   * Formats a property for the defaults object
   */
  private formatDefaultProperty(name: string, value: string): string {
    // Use bracket notation for hyphenated property names
    if (name.includes("-")) {
      return `["${name}"]: ${value}`;
    }
    return `${name}: ${value}`;
  }

  /**
   * Determines if a type should skip default generation
   */
  private shouldSkipDefault(type: TypeInfo): boolean {
    return (
      type.kind === TypeKind.Object ||
      type.kind === TypeKind.Reference
    );
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