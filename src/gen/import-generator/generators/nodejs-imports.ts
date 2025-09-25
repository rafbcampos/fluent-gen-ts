import type { ResolvedType, TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { NodeJSTypeMapping } from '../types.js';
import { NodeJSTypeResolver } from '../utils/nodejs-type-resolver.js';

export class NodeJSImportsGenerator {
  private readonly typeResolver: NodeJSTypeResolver;

  constructor(tsConfigPath?: string) {
    this.typeResolver = new NodeJSTypeResolver(tsConfigPath);
  }

  generateNodeJSImports(resolvedType: ResolvedType): string[] {
    const nodeJSTypeMapping: Record<string, NodeJSTypeMapping> = {};

    const addType = (typeName: string, module: string): void => {
      if (!nodeJSTypeMapping[module]) {
        nodeJSTypeMapping[module] = { module, types: new Set() };
      }
      nodeJSTypeMapping[module].types.add(typeName);
    };

    this.scanForNodeJSTypes(resolvedType.typeInfo, addType);

    const imports: string[] = [];
    Object.values(nodeJSTypeMapping).forEach(({ module, types }) => {
      const typeList = Array.from(types).sort().join(', ');
      imports.push(`import { ${typeList} } from "${module}";`);
    });

    return imports;
  }

  private scanForNodeJSTypes(
    typeInfo: TypeInfo,
    addType: (typeName: string, module: string) => void,
  ): void {
    if (typeInfo.kind === 'primitive') {
      this.handlePrimitiveType(typeInfo.name, addType);
    }

    this.scanNestedTypes(typeInfo, addType);
  }

  private handlePrimitiveType(
    typeName: string,
    addType: (typeName: string, module: string) => void,
  ): void {
    const module = this.typeResolver.getModuleForType(typeName);
    if (module) {
      addType(typeName, module);
    }
  }

  private scanNestedTypes(
    typeInfo: TypeInfo,
    addType: (typeName: string, module: string) => void,
  ): void {
    if (typeInfo.kind === 'object' && 'properties' in typeInfo && typeInfo.properties) {
      for (const prop of typeInfo.properties) {
        this.scanForNodeJSTypes(prop.type, addType);
      }
    }

    if (typeInfo.kind === TypeKind.Array && 'elementType' in typeInfo && typeInfo.elementType) {
      this.scanForNodeJSTypes(typeInfo.elementType, addType);
    }

    if (typeInfo.kind === TypeKind.Union && 'unionTypes' in typeInfo && typeInfo.unionTypes) {
      for (const member of typeInfo.unionTypes) {
        this.scanForNodeJSTypes(member, addType);
      }
    }

    if ('typeArguments' in typeInfo && typeInfo.typeArguments) {
      for (const arg of typeInfo.typeArguments) {
        this.scanForNodeJSTypes(arg, addType);
      }
    }
  }
}
