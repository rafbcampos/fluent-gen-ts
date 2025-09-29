import type { ResolvedType, TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { NodeJSTypeMapping } from '../types.js';
import { NodeJSTypeResolver } from '../utils/nodejs-type-resolver.js';

type TypeCollector = (typeName: string, module: string) => void;

/**
 * Generator for Node.js built-in module imports.
 *
 * This class analyzes TypeScript type information and generates appropriate
 * import statements for Node.js built-in types (e.g., EventEmitter from 'events',
 * Readable from 'stream', etc.).
 *
 * @example
 * ```ts
 * const generator = new NodeJSImportsGenerator('./tsconfig.json');
 * const resolvedType = {
 *   name: 'MyType',
 *   sourceFile: '/path/to/file.ts',
 *   typeInfo: {
 *     kind: TypeKind.Object,
 *     properties: [
 *       { name: 'emitter', type: { kind: TypeKind.Primitive, name: 'EventEmitter' }, optional: false, readonly: false }
 *     ]
 *   },
 *   imports: [],
 *   dependencies: []
 * };
 *
 * const imports = generator.generateNodeJSImports(resolvedType);
 * // Returns: ['import { EventEmitter } from "events";']
 * ```
 */
export class NodeJSImportsGenerator {
  private readonly typeResolver: NodeJSTypeResolver;

  /**
   * Creates a new NodeJSImportsGenerator instance.
   *
   * @param tsConfigPath - Optional path to a TypeScript configuration file.
   *                      When provided, enables enhanced type resolution using
   *                      the project's type definitions.
   */
  constructor(tsConfigPath?: string) {
    this.typeResolver = new NodeJSTypeResolver(tsConfigPath);
  }

  /**
   * Generates import statements for Node.js built-in types found in the resolved type.
   *
   * Scans the type information recursively to find all Node.js built-in types,
   * groups them by module, and generates appropriate import statements.
   * Types are alphabetically sorted within each import statement for consistency.
   *
   * @param resolvedType - The resolved type information to analyze
   * @returns An array of import statement strings, one per Node.js module
   *
   * @example
   * ```ts
   * const imports = generator.generateNodeJSImports(resolvedType);
   * // Example output:
   * // [
   * //   'import { EventEmitter } from "events";',
   * //   'import { Readable, Writable } from "stream";'
   * // ]
   * ```
   */
  generateNodeJSImports(resolvedType: ResolvedType): string[] {
    const nodeJSTypeMapping: Record<string, NodeJSTypeMapping> = {};

    const addType: TypeCollector = (typeName, module) => {
      if (!nodeJSTypeMapping[module]) {
        nodeJSTypeMapping[module] = { module, types: new Set() };
      }
      nodeJSTypeMapping[module].types.add(typeName);
    };

    this.scanForNodeJSTypes(resolvedType.typeInfo, addType);

    const imports: string[] = [];
    for (const { module, types } of Object.values(nodeJSTypeMapping)) {
      const typeList = Array.from(types).sort().join(', ');
      imports.push(`import { ${typeList} } from "${module}";`);
    }

    return imports;
  }

  private scanForNodeJSTypes(typeInfo: TypeInfo, addType: TypeCollector): void {
    if (typeInfo.kind === TypeKind.Primitive) {
      this.handlePrimitiveType(typeInfo.name, addType);
    }

    this.scanNestedTypes(typeInfo, addType);
  }

  private handlePrimitiveType(typeName: string, addType: TypeCollector): void {
    const module = this.typeResolver.getModuleForType(typeName);
    if (module) {
      addType(typeName, module);
    }
  }

  private scanNestedTypes(typeInfo: TypeInfo, addType: TypeCollector): void {
    // Handle object properties
    if (typeInfo.kind === TypeKind.Object && 'properties' in typeInfo && typeInfo.properties) {
      this.scanTypeCollection(
        typeInfo.properties.map(p => p.type),
        addType,
      );
    }

    // Handle array elements
    if (typeInfo.kind === TypeKind.Array && 'elementType' in typeInfo && typeInfo.elementType) {
      this.scanForNodeJSTypes(typeInfo.elementType, addType);
    }

    // Handle union members
    if (typeInfo.kind === TypeKind.Union && 'unionTypes' in typeInfo && typeInfo.unionTypes) {
      this.scanTypeCollection(typeInfo.unionTypes, addType);
    }

    // Handle generic type arguments
    if ('typeArguments' in typeInfo && typeInfo.typeArguments) {
      this.scanTypeCollection(typeInfo.typeArguments, addType);
    }
  }

  private scanTypeCollection(types: readonly TypeInfo[], addType: TypeCollector): void {
    for (const type of types) {
      this.scanForNodeJSTypes(type, addType);
    }
  }
}
