/**
 * Default value generation utilities
 * Generates appropriate default values for TypeScript types
 */

import type { TypeInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";
import { PrimitiveType } from "./types.js";

/**
 * Configuration for default value generation
 */
export interface DefaultGeneratorConfig {
  /** Whether to use default values */
  readonly useDefaults: boolean;
  /** Custom default generators by type */
  readonly customDefaults?: Map<string, () => string>;
  /** Maximum depth for recursive default generation */
  readonly maxDepth?: number;
  /** Track visited types to prevent infinite recursion */
  readonly visitedTypes?: Set<string>;
}

/**
 * Generates default values for TypeScript types
 */
export class DefaultValueGenerator {
  /**
   * Generates a defaults object for a type
   * @param typeInfo - The type information
   * @param config - Default generation configuration
   * @param depth - Current recursion depth
   */
  generateDefaultsObject(
    typeInfo: TypeInfo,
    config: DefaultGeneratorConfig,
    depth = 0,
  ): string | null {
    if (!config.useDefaults || !this.isObjectType(typeInfo)) {
      return null;
    }

    const maxDepth = config.maxDepth ?? 5;
    if (depth > maxDepth) {
      return "{}";
    }

    const visited = config.visitedTypes ?? new Set<string>();
    const typeKey = this.getTypeKey(typeInfo);

    // Check for circular references
    if (visited.has(typeKey)) {
      return "{}";
    }

    visited.add(typeKey);
    const defaults: string[] = [];

    for (const prop of typeInfo.properties) {
      // Only generate defaults for required properties
      if (prop.optional) continue;

      const defaultValue = this.getDefaultValueForType(
        prop.type,
        { ...config, visitedTypes: visited },
        depth + 1,
      );

      if (defaultValue !== "undefined") {
        defaults.push(this.formatDefaultProperty(prop.name, defaultValue));
      }
    }

    visited.delete(typeKey);

    if (defaults.length === 0) return null;
    return `{ ${defaults.join(", ")} }`;
  }

  /**
   * Generates default value for a specific type
   * @param typeInfo - The type to generate a default for
   * @param config - Default generation configuration
   * @param depth - Current recursion depth
   */
  getDefaultValueForType(
    typeInfo: TypeInfo,
    config?: DefaultGeneratorConfig,
    depth = 0,
  ): string {
    // Check for custom defaults first
    if (config?.customDefaults && typeInfo.kind === TypeKind.Primitive) {
      const customDefault = config.customDefaults.get(typeInfo.name);
      if (customDefault) {
        return customDefault();
      }
    }

    const maxDepth = config?.maxDepth ?? 5;
    if (depth > maxDepth) {
      // Return safe defaults at max depth
      switch (typeInfo.kind) {
        case TypeKind.Object:
        case TypeKind.Reference:
        case TypeKind.Intersection:
          return "{}";
        case TypeKind.Array:
        case TypeKind.Tuple:
          return "[]";
        default:
          return "undefined";
      }
    }

    switch (typeInfo.kind) {
      case TypeKind.Primitive:
        return this.getPrimitiveDefault(typeInfo.name);

      case TypeKind.Array:
        // Generate array with default element if possible
        if (depth < maxDepth - 1) {
          const elementDefault = this.getDefaultValueForType(
            typeInfo.elementType,
            config,
            depth + 1,
          );
          // Only generate non-empty array for primitives and literals
          if (
            elementDefault !== "undefined" &&
            elementDefault !== "{}" &&
            elementDefault !== "[]" &&
            (typeInfo.elementType.kind === TypeKind.Primitive ||
              typeInfo.elementType.kind === TypeKind.Literal)
          ) {
            return `[${elementDefault}]`;
          }
        }
        return "[]";

      case TypeKind.Function:
        return "() => undefined";

      case TypeKind.Literal:
        return this.getLiteralDefault(typeInfo);

      case TypeKind.Union:
        return this.getUnionDefault(typeInfo, config, depth);

      case TypeKind.Object:
        // Generate nested object defaults
        if (this.isObjectType(typeInfo) && typeInfo.properties.length > 0) {
          const objectDefaults = this.generateObjectDefaults(
            typeInfo,
            config,
            depth + 1,
          );
          return objectDefaults || "{}";
        }
        return "{}";

      case TypeKind.Reference:
        // For references, try to generate a minimal valid object
        // This would need access to the referenced type definition
        // For now, return empty object
        return "{}";

      case TypeKind.Generic:
        return "undefined";

      case TypeKind.Tuple:
        // Generate tuple with default elements
        if (depth < maxDepth - 1 && this.isTupleType(typeInfo)) {
          const defaults = typeInfo.elements.map((element) =>
            this.getDefaultValueForType(element, config, depth + 1),
          );
          return `[${defaults.join(", ")}]`;
        }
        return "[]";

      case TypeKind.Intersection:
        // For intersections, merge defaults from all types
        if (this.isIntersectionType(typeInfo) && typeInfo.intersectionTypes) {
          const merged = this.mergeIntersectionDefaults(
            typeInfo.intersectionTypes,
            config,
            depth + 1,
          );
          return merged || "{}";
        }
        return "{}";

      case TypeKind.Enum:
        // Return first enum value if available
        if (this.isEnumType(typeInfo) && typeInfo.values && typeInfo.values.length > 0) {
          const firstValue = typeInfo.values[0];
          return typeof firstValue === "string"
            ? `"${firstValue}"`
            : String(firstValue);
        }
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
  private getLiteralDefault(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Literal }>,
  ): string {
    return typeof typeInfo.literal === "string"
      ? `"${typeInfo.literal}"`
      : String(typeInfo.literal);
  }

  /**
   * Gets default value for union types
   */
  private getUnionDefault(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Union }>,
    config?: DefaultGeneratorConfig,
    depth = 0,
  ): string {
    // For unions, pick the first non-undefined type
    if (typeInfo.unionTypes && typeInfo.unionTypes.length > 0) {
      const firstNonUndefined = typeInfo.unionTypes.find(
        (t) => !(t.kind === TypeKind.Primitive && t.name === "undefined"),
      );
      if (firstNonUndefined) {
        return this.getDefaultValueForType(firstNonUndefined, config, depth);
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
   * Generates defaults for an object type
   */
  private generateObjectDefaults(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>,
    config?: DefaultGeneratorConfig,
    depth = 0,
  ): string | null {
    const defaults: string[] = [];
    const visited = config?.visitedTypes ?? new Set<string>();

    for (const prop of typeInfo.properties) {
      if (prop.optional) continue;

      const defaultValue = this.getDefaultValueForType(
        prop.type,
        { ...config, visitedTypes: visited } as DefaultGeneratorConfig,
        depth,
      );

      if (defaultValue !== "undefined") {
        defaults.push(this.formatDefaultProperty(prop.name, defaultValue));
      }
    }

    if (defaults.length === 0) return null;
    return `{ ${defaults.join(", ")} }`;
  }

  /**
   * Merges defaults from intersection types
   */
  private mergeIntersectionDefaults(
    types: readonly TypeInfo[],
    config?: DefaultGeneratorConfig,
    depth = 0,
  ): string | null {
    const allDefaults: Record<string, string> = {};

    for (const type of types) {
      if (type.kind === TypeKind.Object && this.isObjectType(type)) {
        // Collect properties directly instead of parsing strings
        for (const prop of type.properties) {
          if (prop.optional) continue;

          const defaultValue = this.getDefaultValueForType(
            prop.type,
            config,
            depth,
          );

          if (defaultValue !== "undefined") {
            allDefaults[prop.name] = defaultValue;
          }
        }
      }
    }

    if (Object.keys(allDefaults).length === 0) return null;

    const props = Object.entries(allDefaults).map(
      ([key, value]) => this.formatDefaultProperty(key, value),
    );

    return `{ ${props.join(", ")} }`;
  }

  /**
   * Gets a unique key for a type to track circular references
   */
  private getTypeKey(typeInfo: TypeInfo): string {
    if (typeInfo.kind === TypeKind.Object && "name" in typeInfo) {
      return `${typeInfo.kind}:${typeInfo.name}`;
    }
    if (typeInfo.kind === TypeKind.Reference && "name" in typeInfo) {
      return `${typeInfo.kind}:${typeInfo.name}`;
    }
    return `${typeInfo.kind}:anonymous`;
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
   * Type guard to check if typeInfo is a tuple type
   */
  private isTupleType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Tuple }> {
    return typeInfo.kind === TypeKind.Tuple;
  }

  /**
   * Type guard to check if typeInfo is an intersection type
   */
  private isIntersectionType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Intersection }> {
    return typeInfo.kind === TypeKind.Intersection;
  }

  /**
   * Type guard to check if typeInfo is an enum type
   */
  private isEnumType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Enum }> {
    return typeInfo.kind === TypeKind.Enum;
  }
}

