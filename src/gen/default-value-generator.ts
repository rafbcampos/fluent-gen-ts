import type { PropertyInfo, TypeInfo } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import { PrimitiveType } from './types.js';

export interface DefaultGeneratorConfig {
  readonly useDefaults: boolean;
  readonly customDefaults?: Map<string, () => string>;
  readonly maxDepth?: number;
  readonly visitedTypes?: Set<string>;
}

interface GenerationContext {
  readonly config: DefaultGeneratorConfig;
  readonly depth: number;
  readonly visited: Set<string>;
}

export class DefaultValueGenerator {
  /**
   * Generates a defaults object for object types with required properties.
   * @param params.typeInfo - The type to generate defaults for
   * @param params.config - Configuration for default generation
   * @param params.depth - Current recursion depth (default: 0)
   * @returns A string representation of the defaults object, or null if not applicable
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
   * Generates a default value for any TypeScript type.
   * @param params.typeInfo - The type to generate a default for
   * @param params.config - Optional configuration for custom defaults and depth limits
   * @param params.depth - Current recursion depth (default: 0)
   * @param params.contextPath - Optional path for tracking nested properties
   * @returns A string representation of the default value
   */
  getDefaultValueForType(params: {
    readonly typeInfo: TypeInfo;
    readonly config?: DefaultGeneratorConfig;
    readonly depth?: number;
    readonly contextPath?: string;
  }): string {
    const { typeInfo, config, depth = 0, contextPath } = params;

    const customDefault = this.getCustomDefault(typeInfo, config);
    if (customDefault !== null) {
      return customDefault;
    }

    const maxDepth = config?.maxDepth ?? 5;
    if (depth > maxDepth) {
      return this.getMaxDepthDefault(typeInfo.kind);
    }

    return this.generateDefaultByKind({
      typeInfo,
      ...(config !== undefined && { config }),
      depth,
      maxDepth,
      ...(contextPath !== undefined && { contextPath }),
    });
  }

  private getCustomDefault(typeInfo: TypeInfo, config?: DefaultGeneratorConfig): string | null {
    if (config?.customDefaults && typeInfo.kind === TypeKind.Primitive) {
      const customDefault = config.customDefaults.get(typeInfo.name);
      if (customDefault) {
        return customDefault();
      }
    }
    return null;
  }

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
          ...(config !== undefined && { config }),
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
          ...(config !== undefined && { config }),
          depth,
        });

      case TypeKind.Object:
        return this.getObjectDefault({
          typeInfo,
          ...(config !== undefined && { config }),
          depth,
          ...(contextPath !== undefined && { contextPath }),
        });

      case TypeKind.Reference:
        return '{}';

      case TypeKind.Generic:
        return this.getGenericDefault({
          typeInfo,
          ...(config !== undefined && { config }),
          depth,
        });

      case TypeKind.Tuple:
        return this.getTupleDefault({
          typeInfo,
          ...(config !== undefined && { config }),
          depth,
          maxDepth,
        });

      case TypeKind.Intersection:
        return this.getIntersectionDefault({
          typeInfo,
          ...(config !== undefined && { config }),
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

  private escapeString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private shouldGenerateNonEmptyArray(elementDefault: string, elementType: TypeInfo): boolean {
    return (
      elementDefault !== 'undefined' &&
      elementDefault !== '{}' &&
      elementDefault !== '[]' &&
      (elementType.kind === TypeKind.Primitive || elementType.kind === TypeKind.Literal)
    );
  }

  private getArrayDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Array }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
    readonly maxDepth: number;
  }): string {
    const { typeInfo, config, depth, maxDepth } = params;

    if (depth < maxDepth) {
      const elementDefault = this.getDefaultValueForType({
        typeInfo: typeInfo.elementType,
        ...(config !== undefined && { config }),
        depth: depth + 1,
      });
      if (this.shouldGenerateNonEmptyArray(elementDefault, typeInfo.elementType)) {
        return `[${elementDefault}]`;
      }
    }
    return '[]';
  }

  private getObjectDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
    readonly contextPath?: string;
  }): string {
    const { typeInfo, config, depth, contextPath } = params;

    if ('name' in typeInfo && typeof typeInfo.name === 'string') {
      if (this.isGlobalTypeConstructor(typeInfo.name)) {
        return this.getGlobalTypeDefault(typeInfo.name);
      }
    }

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

  private getTupleDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Tuple }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
    readonly maxDepth: number;
  }): string {
    const { typeInfo, config, depth, maxDepth } = params;

    if (depth < maxDepth && this.isTupleType(typeInfo)) {
      const defaults = typeInfo.elements.map(element =>
        this.getDefaultValueForType({
          typeInfo: element,
          ...(config !== undefined && { config }),
          depth: depth + 1,
        }),
      );
      return `[${defaults.join(', ')}]`;
    }
    return '[]';
  }

  private getIntersectionDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Intersection }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
  }): string {
    const { typeInfo, config, depth } = params;

    if (this.isIntersectionType(typeInfo) && typeInfo.intersectionTypes) {
      const merged = this.mergeIntersectionDefaults({
        types: typeInfo.intersectionTypes,
        ...(config !== undefined && { config }),
        depth: depth + 1,
      });
      return merged || '{}';
    }
    return '{}';
  }

  private getGenericDefault(params: {
    readonly typeInfo: Extract<TypeInfo, { kind: TypeKind.Generic }>;
    readonly config?: DefaultGeneratorConfig;
    readonly depth: number;
  }): string {
    const { typeInfo, config, depth } = params;

    if (this.isGenericType(typeInfo)) {
      switch (typeInfo.name) {
        case 'Promise':
          if (typeInfo.typeArguments && typeInfo.typeArguments.length > 0) {
            const firstTypeArg = typeInfo.typeArguments[0];
            if (firstTypeArg) {
              const innerDefault = this.getDefaultValueForType({
                typeInfo: firstTypeArg,
                ...(config !== undefined && { config }),
                depth: depth + 1,
              });
              return `Promise.resolve(${innerDefault})`;
            }
          }
          return 'Promise.resolve(undefined)';

        case 'Array':
          if (typeInfo.typeArguments && typeInfo.typeArguments.length > 0) {
            const firstTypeArg = typeInfo.typeArguments[0];
            if (firstTypeArg) {
              const elementDefault = this.getDefaultValueForType({
                typeInfo: firstTypeArg,
                ...(config !== undefined && { config }),
                depth: depth + 1,
              });
              if (this.shouldGenerateNonEmptyArray(elementDefault, firstTypeArg)) {
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

        case 'EventEmitter':
          return 'new EventEmitter()';

        default:
          if (this.isNodeBuiltInType(typeInfo.name)) {
            return this.getNodeBuiltInDefault(typeInfo.name);
          }
          if (this.isGlobalTypeConstructor(typeInfo.name)) {
            return this.getGlobalTypeDefault(typeInfo.name);
          }
          return 'undefined';
      }
    }

    return 'undefined';
  }

  private getEnumDefault(typeInfo: Extract<TypeInfo, { kind: TypeKind.Enum }>): string {
    if (this.isEnumType(typeInfo) && typeInfo.values && typeInfo.values.length > 0) {
      const firstValue = typeInfo.values[0];
      if (typeof firstValue === 'string') {
        return `"${this.escapeString(firstValue)}"`;
      }
      return String(firstValue);
    }
    return 'undefined';
  }

  private getPrimitiveDefault(name: string): string {
    if (this.isNodeBuiltInType(name)) {
      return this.getNodeBuiltInDefault(name);
    }

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

  private isNodeBuiltInType(typeName: string): boolean {
    if (typeof typeName !== 'string' || typeName.trim() === '') {
      return false;
    }

    if (typeName.startsWith('NodeJS.')) {
      return this.isNodeJSNamespaceType(typeName);
    }

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

  private isNodeJSNamespaceType(typeName: string): boolean {
    const nodeJSNamespaceTypes = [
      'NodeJS.ProcessEnv',
      'NodeJS.Dict',
      'NodeJS.ArrayBufferView',
      'NodeJS.Process',
    ];
    return nodeJSNamespaceTypes.includes(typeName);
  }

  private getNodeBuiltInDefault(typeName: string): string {
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

  private isGlobalTypeConstructor(typeName: string): boolean {
    if (typeof typeName !== 'string' || typeName.trim() === '') {
      return false;
    }

    try {
      if (!(typeName in globalThis)) {
        return false;
      }
      const value = globalThis[typeName as keyof typeof globalThis];
      return typeof value === 'function';
    } catch {
      return false;
    }
  }

  private getGlobalTypeDefault(typeName: string): string {
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
        try {
          if (typeName in globalThis) {
            const globalType = globalThis[typeName as keyof typeof globalThis];
            if (typeof globalType === 'function') {
              return `new ${typeName}()`;
            }
          }
          return 'undefined';
        } catch {
          return 'undefined';
        }
    }
  }

  private getLiteralDefault(typeInfo: Extract<TypeInfo, { kind: TypeKind.Literal }>): string {
    const { literal } = typeInfo;
    if (typeof literal === 'string') {
      return `"${this.escapeString(literal)}"`;
    }
    if (typeof literal === 'bigint') {
      return `BigInt(${literal})`;
    }
    if (typeof literal === 'boolean' || typeof literal === 'number') {
      return String(literal);
    }
    if (literal === null) {
      return 'null';
    }
    return 'undefined';
  }

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
          ...(config !== undefined && { config }),
          depth,
        });
      }
    }
    return 'undefined';
  }

  private formatDefaultProperty(params: { readonly name: string; readonly value: string }): string {
    const { name, value } = params;
    if (this.needsBracketNotation(name)) {
      return `["${this.escapeString(name)}"]: ${value}`;
    }
    return `${name}: ${value}`;
  }

  private needsBracketNotation(name: string): boolean {
    return /[-.\s]/.test(name) || /^\d/.test(name);
  }

  private generateObjectPropertiesDefaults(params: {
    readonly properties: readonly PropertyInfo[];
    readonly context: GenerationContext;
    readonly typeInfo: TypeInfo;
    readonly contextPath?: string;
  }): string | null {
    const { properties, context, typeInfo, contextPath } = params;
    const { visited, config, depth } = context;
    const typeKey = this.getTypeKey(typeInfo, contextPath);

    if (visited.has(typeKey)) {
      return null;
    }

    visited.add(typeKey);
    const defaults: string[] = [];

    for (const prop of properties) {
      if (prop.optional) continue;

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

  private mergeIntersectionDefaults(params: {
    readonly types: readonly TypeInfo[];
    readonly config?: DefaultGeneratorConfig;
    readonly depth?: number;
  }): string | null {
    const { types, config, depth = 0 } = params;
    const allDefaults: Record<string, string> = {};

    for (const type of types) {
      if (type.kind === TypeKind.Object && this.isObjectType(type)) {
        for (const prop of type.properties) {
          if (prop.optional) continue;

          const defaultValue = this.getDefaultValueForType({
            typeInfo: prop.type,
            ...(config !== undefined && { config }),
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

  private getTypeKey(typeInfo: TypeInfo, context?: string): string {
    if (typeInfo.kind === TypeKind.Object && 'name' in typeInfo) {
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

  private isObjectType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> {
    return typeInfo.kind === TypeKind.Object;
  }

  private isTupleType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Tuple }> {
    return typeInfo.kind === TypeKind.Tuple;
  }

  private isIntersectionType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Intersection }> {
    return typeInfo.kind === TypeKind.Intersection;
  }

  private isEnumType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Enum }> {
    return typeInfo.kind === TypeKind.Enum;
  }

  private isGenericType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Generic }> {
    return typeInfo.kind === TypeKind.Generic;
  }
}
