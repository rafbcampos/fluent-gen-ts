/**
 * Default value generation utilities
 * Generates appropriate default values for TypeScript types
 */

import type { TypeInfo } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import { PrimitiveType } from './types.js';

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

interface GenerationContext {
  readonly config: DefaultGeneratorConfig;
  readonly depth: number;
  readonly visited: Set<string>;
}

/**
 * Generates default values for TypeScript types
 */
export class DefaultValueGenerator {
  /**
   * Generates a defaults object for a type
   */
  generateDefaultsObject(params: {
    readonly typeInfo: TypeInfo;
    readonly config: DefaultGeneratorConfig;
    readonly depth?: number;
  }): string | null {
    const { typeInfo, config, depth = 0 } = params;
    if (!config.useDefaults || !this.isObjectType(typeInfo)) {
      return null;
    }

    const maxDepth = config.maxDepth ?? 5;
    if (depth > maxDepth) {
      return '{}';
    }

    const context: GenerationContext = {
      config,
      depth,
      visited: config.visitedTypes ?? new Set<string>(),
    };

    const defaults = this.generateObjectPropertiesDefaults({
      properties: typeInfo.properties,
      context,
      typeInfo,
    });

    return defaults ? `{ ${defaults} }` : null;
  }

  /**
   * Generates default value for a specific type
   */
  getDefaultValueForType(params: {
    readonly typeInfo: TypeInfo;
    readonly config?: DefaultGeneratorConfig;
    readonly depth?: number;
    readonly contextPath?: string;
  }): string {
    const { typeInfo, config, depth = 0, contextPath } = params;

    // Check for custom defaults first
    const customDefault = this.getCustomDefault(typeInfo, config);
    if (customDefault !== null) {
      return customDefault;
    }

    // Check max depth
    const maxDepth = config?.maxDepth ?? 5;
    if (depth > maxDepth) {
      return this.getMaxDepthDefault(typeInfo.kind);
    }

    // Generate defaults based on type kind
    return this.generateDefaultByKind({
      typeInfo,
      ...(config && { config }),
      depth,
      maxDepth,
      ...(contextPath !== undefined && { contextPath }),
    });
  }

  /**
   * Gets custom default if configured
   */
  private getCustomDefault(typeInfo: TypeInfo, config?: DefaultGeneratorConfig): string | null {
    if (config?.customDefaults && typeInfo.kind === TypeKind.Primitive) {
      const customDefault = config.customDefaults.get(typeInfo.name);
      if (customDefault) {
        return customDefault();
      }
    }
    return null;
  }

  /**
   * Gets default value when max depth is exceeded
   */
  private getMaxDepthDefault(kind: TypeKind): string {
    switch (kind) {
      case TypeKind.Object:
      case TypeKind.Reference:
      case TypeKind.Intersection:
        return '{}';
      case TypeKind.Array:
      case TypeKind.Tuple:
        return '[]';
      default:
        return 'undefined';
    }
  }

  /**
   * Generates default value based on type kind
   */
  private generateDefaultByKind(params: {
    readonly typeInfo: TypeInfo;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
    readonly maxDepth: number;
    readonly contextPath?: string;
  }): string {
    const { typeInfo, config, depth, maxDepth, contextPath } = params;

    switch (typeInfo.kind) {
      case TypeKind.Primitive:
        return this.getPrimitiveDefault(typeInfo.name);

      case TypeKind.Array:
        return this.getArrayDefault({
          typeInfo,
          ...(config && { config }),
          depth,
          maxDepth,
        });

      case TypeKind.Function:
        return '() => undefined';

      case TypeKind.Literal:
        return this.getLiteralDefault(typeInfo);

      case TypeKind.Union:
        return this.getUnionDefault({
          typeInfo,
          ...(config && { config }),
          depth,
        });

      case TypeKind.Object:
        return this.getObjectDefault({
          typeInfo,
          ...(config && { config }),
          depth,
          ...(contextPath !== undefined && { contextPath }),
        });

      case TypeKind.Reference:
        // For references, try to generate a minimal valid object
        // This would need access to the referenced type definition
        // For now, return empty object
        return '{}';

      case TypeKind.Generic:
        return this.getGenericDefault({
          typeInfo,
          ...(config && { config }),
          depth,
        });

      case TypeKind.Tuple:
        return this.getTupleDefault({
          typeInfo,
          ...(config && { config }),
          depth,
          maxDepth,
        });

      case TypeKind.Intersection:
        return this.getIntersectionDefault({
          typeInfo,
          ...(config && { config }),
          depth,
        });

      case TypeKind.Enum:
        return this.getEnumDefault(typeInfo);

      case TypeKind.Keyof:
      case TypeKind.Typeof:
      case TypeKind.Index:
      case TypeKind.Conditional:
      case TypeKind.Unknown:
      case TypeKind.Never:
      default:
        return 'undefined';
    }
  }

  /**
   * Gets default value for array types
   */
  private getArrayDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Array }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
    readonly maxDepth: number;
  }): string {
    const { typeInfo, config, depth, maxDepth } = params;

    // Generate array with default element if possible
    if (depth < maxDepth - 1) {
      const elementDefault = this.getDefaultValueForType({
        typeInfo: typeInfo.elementType,
        ...(config && { config }),
        depth: depth + 1,
      });
      // Only generate non-empty array for primitives and literals
      if (
        elementDefault !== 'undefined' &&
        elementDefault !== '{}' &&
        elementDefault !== '[]' &&
        (typeInfo.elementType.kind === TypeKind.Primitive ||
          typeInfo.elementType.kind === TypeKind.Literal)
      ) {
        return `[${elementDefault}]`;
      }
    }
    return '[]';
  }

  /**
   * Gets default value for object types
   */
  private getObjectDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
    readonly contextPath?: string;
  }): string {
    const { typeInfo, config, depth, contextPath } = params;

    // Check if this object type represents a global constructor
    if ('name' in typeInfo && typeof typeInfo.name === 'string') {
      if (this.isGlobalTypeConstructor(typeInfo.name)) {
        return this.getGlobalTypeDefault(typeInfo.name);
      }
    }

    // Generate nested object defaults
    if (this.isObjectType(typeInfo) && typeInfo.properties.length > 0) {
      const context: GenerationContext = {
        config: config ?? { useDefaults: true },
        depth: depth + 1,
        visited: config?.visitedTypes ?? new Set<string>(),
      };
      const defaults = this.generateObjectPropertiesDefaults({
        properties: typeInfo.properties,
        context,
        typeInfo,
        ...(contextPath !== undefined && { contextPath }),
      });
      return defaults ? `{ ${defaults} }` : '{}';
    }
    return '{}';
  }

  /**
   * Gets default value for tuple types
   */
  private getTupleDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Tuple }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
    readonly maxDepth: number;
  }): string {
    const { typeInfo, config, depth, maxDepth } = params;

    // Generate tuple with default elements
    if (depth < maxDepth - 1 && this.isTupleType(typeInfo)) {
      const defaults = typeInfo.elements.map(element =>
        this.getDefaultValueForType({
          typeInfo: element,
          ...(config && { config }),
          depth: depth + 1,
        }),
      );
      return `[${defaults.join(', ')}]`;
    }
    return '[]';
  }

  /**
   * Gets default value for intersection types
   */
  private getIntersectionDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Intersection }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
  }): string {
    const { typeInfo, config, depth } = params;

    // For intersections, merge defaults from all types
    if (this.isIntersectionType(typeInfo) && typeInfo.intersectionTypes) {
      const merged = this.mergeIntersectionDefaults({
        types: typeInfo.intersectionTypes,
        ...(config && { config }),
        depth: depth + 1,
      });
      return merged || '{}';
    }
    return '{}';
  }

  /**
   * Gets default value for generic types
   */
  private getGenericDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Generic }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
  }): string {
    const { typeInfo, config, depth } = params;

    // Handle specific generic types
    if (this.isGenericType(typeInfo)) {
      switch (typeInfo.name) {
        case 'Promise':
          // Generate Promise.resolve with appropriate type argument default
          if (typeInfo.typeArguments && typeInfo.typeArguments.length > 0) {
            const firstTypeArg = typeInfo.typeArguments[0];
            if (firstTypeArg) {
              const innerDefault = this.getDefaultValueForType({
                typeInfo: firstTypeArg,
                ...(config && { config }),
                depth: depth + 1,
              });
              return `Promise.resolve(${innerDefault})`;
            }
          }
          return 'Promise.resolve(undefined)';

        case 'Array':
          // Handle Array<T> generic
          if (typeInfo.typeArguments && typeInfo.typeArguments.length > 0) {
            const firstTypeArg = typeInfo.typeArguments[0];
            if (firstTypeArg) {
              const elementDefault = this.getDefaultValueForType({
                typeInfo: firstTypeArg,
                ...(config && { config }),
                depth: depth + 1,
              });
              // Only generate non-empty array for primitives and literals
              if (
                elementDefault !== 'undefined' &&
                elementDefault !== '{}' &&
                elementDefault !== '[]' &&
                (firstTypeArg.kind === TypeKind.Primitive || firstTypeArg.kind === TypeKind.Literal)
              ) {
                return `[${elementDefault}]`;
              }
            }
          }
          return '[]';

        case 'Map':
          return 'new Map()';

        case 'Set':
          return 'new Set()';

        case 'WeakMap':
          return 'new WeakMap()';

        case 'WeakSet':
          return 'new WeakSet()';

        // Node.js built-in generic types
        case 'EventEmitter':
          return 'new EventEmitter()';

        default:
          // For other generics, check if it's a Node.js built-in type
          if (this.isNodeBuiltInType(typeInfo.name)) {
            return this.getNodeBuiltInDefault(typeInfo.name);
          }
          // For other generics, check if it's a global constructor
          if (this.isGlobalTypeConstructor(typeInfo.name)) {
            return this.getGlobalTypeDefault(typeInfo.name);
          }
          return 'undefined';
      }
    }

    return 'undefined';
  }

  /**
   * Gets default value for enum types
   */
  private getEnumDefault(typeInfo: Extract<TypeInfo, { kind: TypeKind.Enum }>): string {
    // Return first enum value if available
    if (this.isEnumType(typeInfo) && typeInfo.values && typeInfo.values.length > 0) {
      const firstValue = typeInfo.values[0];
      return typeof firstValue === 'string' ? `"${firstValue}"` : String(firstValue);
    }
    return 'undefined';
  }

  /**
   * Gets default value for primitive types
   */
  private getPrimitiveDefault(name: string): string {
    // Check if this is a Node.js built-in type first (priority over global types)
    if (this.isNodeBuiltInType(name)) {
      return this.getNodeBuiltInDefault(name);
    }

    // Check if this is a global type constructor
    if (this.isGlobalTypeConstructor(name)) {
      return this.getGlobalTypeDefault(name);
    }

    switch (name) {
      case PrimitiveType.String:
        return '""';
      case PrimitiveType.Number:
        return '0';
      case PrimitiveType.Boolean:
        return 'false';
      case PrimitiveType.BigInt:
        return 'BigInt(0)';
      case PrimitiveType.Symbol:
        return 'Symbol()';
      case PrimitiveType.Object:
        return '{}';
      case PrimitiveType.Null:
        return 'null';
      case PrimitiveType.Never:
        // Never types should not exist as properties
        return 'undefined';
      case PrimitiveType.Undefined:
      case PrimitiveType.Void:
      case PrimitiveType.Any:
      case PrimitiveType.Unknown:
      default:
        return 'undefined';
    }
  }

  /**
   * Checks if a type name is a Node.js built-in type
   */
  private isNodeBuiltInType(typeName: string): boolean {
    if (typeof typeName !== 'string' || typeName.trim() === '') {
      return false;
    }

    // Handle NodeJS namespace types
    if (typeName.startsWith('NodeJS.')) {
      return this.isNodeJSNamespaceType(typeName);
    }

    // Node.js built-in types that need special handling
    const nodeBuiltInTypes = [
      'EventEmitter',
      'Readable',
      'Writable',
      'Transform',
      'Duplex',
      'URL',
      'URLSearchParams',
      'Buffer',
    ];

    return nodeBuiltInTypes.includes(typeName);
  }

  /**
   * Checks if a type is a NodeJS namespace type
   */
  private isNodeJSNamespaceType(typeName: string): boolean {
    const nodeJSNamespaceTypes = [
      'NodeJS.ProcessEnv',
      'NodeJS.Dict',
      'NodeJS.ArrayBufferView',
      'NodeJS.Process',
    ];
    return nodeJSNamespaceTypes.includes(typeName);
  }

  /**
   * Gets appropriate default value for Node.js built-in types
   */
  private getNodeBuiltInDefault(typeName: string): string {
    // Handle NodeJS namespace types
    if (typeName.startsWith('NodeJS.')) {
      switch (typeName) {
        case 'NodeJS.ProcessEnv':
          return 'process.env';
        case 'NodeJS.Dict':
          return '{}';
        default:
          return 'undefined';
      }
    }

    // Handle regular Node.js types
    switch (typeName) {
      case 'EventEmitter':
        return 'new EventEmitter()';
      case 'Readable':
        return 'new Readable()';
      case 'Writable':
        return 'new Writable()';
      case 'Transform':
        return 'new Transform()';
      case 'Duplex':
        return 'new Duplex()';
      case 'URL':
        return 'new URL("http://example.com")';
      case 'URLSearchParams':
        return 'new URLSearchParams()';
      case 'Buffer':
        return 'Buffer.alloc(0)';
      default:
        return 'undefined';
    }
  }

  /**
   * Checks if a type name is a global constructor that doesn't need importing
   */
  private isGlobalTypeConstructor(typeName: string): boolean {
    if (typeof typeName !== 'string' || typeName.trim() === '') {
      return false;
    }

    try {
      return typeName in globalThis && typeof (globalThis as any)[typeName] === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Gets appropriate default value for global types
   */
  private getGlobalTypeDefault(typeName: string): string {
    // For Date and other global constructors, use constructor call with appropriate parameters
    switch (typeName) {
      case 'Date':
        return 'new Date()';
      case 'RegExp':
        return 'new RegExp("")';
      case 'Error':
        return 'new Error()';
      case 'Array':
        return '[]';
      case 'Object':
        return '{}';
      case 'Map':
        return 'new Map()';
      case 'Set':
        return 'new Set()';
      case 'WeakMap':
        return 'new WeakMap()';
      case 'WeakSet':
        return 'new WeakSet()';
      case 'Promise':
        return 'Promise.resolve(undefined)';
      default:
        // For other global constructors, try a basic constructor call
        try {
          // Check if it exists in globalThis and is a constructor
          if (typeName in globalThis) {
            const globalType = (globalThis as any)[typeName];
            if (typeof globalType === 'function') {
              return `new ${typeName}()`;
            }
          }
        } catch {
          // If constructor fails, fall back to undefined
        }
        return 'undefined';
    }
  }

  /**
   * Gets default value for literal types
   */
  private getLiteralDefault(typeInfo: Extract<TypeInfo, { kind: TypeKind.Literal }>): string {
    return typeof typeInfo.literal === 'string'
      ? `"${typeInfo.literal}"`
      : String(typeInfo.literal);
  }

  /**
   * Gets default value for union types
   */
  private getUnionDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Union }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth?: number;
  }): string {
    const { typeInfo, config, depth = 0 } = params;

    if (typeInfo.unionTypes && typeInfo.unionTypes.length > 0) {
      // For nullable unions (T | null), prefer null as the default
      const nullType = typeInfo.unionTypes.find(
        t => t.kind === TypeKind.Primitive && t.name === 'null',
      );
      if (nullType) {
        return 'null';
      }

      // For other unions, pick the first non-undefined type
      const firstNonUndefined = typeInfo.unionTypes.find(
        t => !(t.kind === TypeKind.Primitive && t.name === 'undefined'),
      );
      if (firstNonUndefined) {
        return this.getDefaultValueForType({
          typeInfo: firstNonUndefined,
          ...(config && { config }),
          depth,
        });
      }
    }
    return 'undefined';
  }

  /**
   * Formats a property for the defaults object
   */
  private formatDefaultProperty(params: { readonly name: string; readonly value: string }): string {
    const { name, value } = params;
    // Use bracket notation for special characters in property names
    if (this.needsBracketNotation(name)) {
      return `["${name}"]: ${value}`;
    }
    return `${name}: ${value}`;
  }

  /**
   * Checks if a property name needs bracket notation
   */
  private needsBracketNotation(name: string): boolean {
    // Check for special characters that require bracket notation
    return /[-.\s]/.test(name) || /^\d/.test(name);
  }

  /**
   * Generates defaults for object properties (shared logic)
   */
  private generateObjectPropertiesDefaults(params: {
    readonly properties: readonly any[];
    readonly context: GenerationContext;
    readonly typeInfo: TypeInfo;
    readonly contextPath?: string;
  }): string | null {
    const { properties, context, typeInfo, contextPath } = params;
    const { visited, config, depth } = context;
    const typeKey = this.getTypeKey(typeInfo, contextPath);

    // Check for circular references
    if (visited.has(typeKey)) {
      return null;
    }

    visited.add(typeKey);
    const defaults: string[] = [];

    for (const prop of properties) {
      // Only generate defaults for required properties
      if (prop.optional) continue;

      // Build context path for nested properties
      const propContextPath = contextPath ? `${contextPath}.${prop.name}` : prop.name;

      const defaultValue = this.getDefaultValueForType({
        typeInfo: prop.type,
        config: { ...config, visitedTypes: visited },
        depth: depth + 1,
        contextPath: propContextPath,
      });

      if (defaultValue !== 'undefined' && defaultValue !== '__NEVER_TYPE__') {
        defaults.push(
          this.formatDefaultProperty({
            name: prop.name,
            value: defaultValue,
          }),
        );
      }
    }

    visited.delete(typeKey);

    return defaults.length > 0 ? defaults.join(', ') : null;
  }

  /**
   * Merges defaults from intersection types
   */
  private mergeIntersectionDefaults(params: {
    readonly types: readonly TypeInfo[];
    readonly config?: DefaultGeneratorConfig;
    readonly depth?: number;
  }): string | null {
    const { types, config, depth = 0 } = params;
    const allDefaults: Record<string, string> = {};

    for (const type of types) {
      if (type.kind === TypeKind.Object && this.isObjectType(type)) {
        // Collect properties directly instead of parsing strings
        for (const prop of type.properties) {
          if (prop.optional) continue;

          const defaultValue = this.getDefaultValueForType({
            typeInfo: prop.type,
            ...(config && { config }),
            depth,
          });

          if (defaultValue !== 'undefined') {
            allDefaults[prop.name] = defaultValue;
          }
        }
      }
    }

    if (Object.keys(allDefaults).length === 0) return null;

    const props = Object.entries(allDefaults).map(([key, value]) =>
      this.formatDefaultProperty({ name: key, value }),
    );

    return `{ ${props.join(', ')} }`;
  }

  /**
   * Gets a unique key for a type to track circular references
   */
  private getTypeKey(typeInfo: TypeInfo, context?: string): string {
    if (typeInfo.kind === TypeKind.Object && 'name' in typeInfo) {
      // For __type objects (anonymous resolved types), include context to make them unique
      if (typeInfo.name === '__type' && context) {
        return `${typeInfo.kind}:${typeInfo.name}:${context}`;
      }
      return `${typeInfo.kind}:${typeInfo.name}`;
    }
    if (typeInfo.kind === TypeKind.Reference && 'name' in typeInfo) {
      return `${typeInfo.kind}:${typeInfo.name}`;
    }
    return `${typeInfo.kind}:anonymous${context ? `:${context}` : ''}`;
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
  private isTupleType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Tuple }> {
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
  private isEnumType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Enum }> {
    return typeInfo.kind === TypeKind.Enum;
  }

  /**
   * Type guard to check if typeInfo is a generic type
   */
  private isGenericType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Generic }> {
    return typeInfo.kind === TypeKind.Generic;
  }
}
