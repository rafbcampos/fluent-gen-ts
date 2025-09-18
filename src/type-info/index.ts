import { TypeScriptParser } from "./parser.js";
import { TypeResolver } from "./resolver.js";
import type { Result } from "../core/result.js";
import { ok } from "../core/result.js";
import type { ResolvedType, TypeInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";
import { TypeResolutionCache } from "../core/cache.js";
import { PluginManager } from "../core/plugin.js";
import path from "node:path";

// Type guards for better type safety
const isObjectTypeInfo = (
  info: TypeInfo,
): info is Extract<TypeInfo, { kind: TypeKind.Object }> => {
  return info.kind === TypeKind.Object;
};

const isArrayTypeInfo = (
  info: TypeInfo,
): info is Extract<TypeInfo, { kind: TypeKind.Array }> => {
  return info.kind === TypeKind.Array;
};

const isUnionTypeInfo = (
  info: TypeInfo,
): info is Extract<TypeInfo, { kind: TypeKind.Union }> => {
  return info.kind === TypeKind.Union;
};

const isIntersectionTypeInfo = (
  info: TypeInfo,
): info is Extract<TypeInfo, { kind: TypeKind.Intersection }> => {
  return info.kind === TypeKind.Intersection;
};

const isReferenceTypeInfo = (
  info: TypeInfo,
): info is Extract<TypeInfo, { kind: TypeKind.Reference }> => {
  return info.kind === TypeKind.Reference;
};

export interface TypeExtractorOptions {
  tsConfigPath?: string;
  cache?: TypeResolutionCache;
  pluginManager?: PluginManager;
  maxDepth?: number;
}

export class TypeExtractor {
  private readonly parser: TypeScriptParser;
  private readonly resolver: TypeResolver;
  private readonly cache: TypeResolutionCache;
  private readonly pluginManager: PluginManager;

  constructor(options: TypeExtractorOptions = {}) {
    this.cache = options.cache ?? new TypeResolutionCache();
    this.pluginManager = options.pluginManager ?? new PluginManager();

    this.parser = new TypeScriptParser({
      ...(options.tsConfigPath && { tsConfigPath: options.tsConfigPath }),
      cache: this.cache,
      pluginManager: this.pluginManager,
    });

    this.resolver = new TypeResolver({
      ...(options.maxDepth && { maxDepth: options.maxDepth }),
      cache: this.cache,
      pluginManager: this.pluginManager,
    });
  }

  async extractType(
    filePath: string,
    typeName: string,
  ): Promise<Result<ResolvedType>> {
    const absolutePath = path.resolve(filePath);

    const sourceFileResult = await this.parser.parseFile(absolutePath);
    if (!sourceFileResult.ok) {
      return sourceFileResult;
    }

    const sourceFile = sourceFileResult.value;

    // Normal type resolution
    const typeResult = await this.parser.findType(sourceFile, typeName);
    if (!typeResult.ok) {
      return typeResult;
    }

    const type = typeResult.value;

    const typeInfoResult = await this.resolver.resolveType(type);
    if (!typeInfoResult.ok) {
      return typeInfoResult;
    }

    const importsResult = await this.parser.resolveImports(sourceFile);
    if (!importsResult.ok) {
      return importsResult;
    }

    const imports = Array.from(importsResult.value.keys());

    const dependencies = await this.resolveDependencies(
      typeInfoResult.value,
      sourceFile.getFilePath(),
    );

    if (!dependencies.ok) {
      return dependencies;
    }

    const resolvedType: ResolvedType = {
      sourceFile: absolutePath,
      name: typeName,
      typeInfo: typeInfoResult.value,
      imports,
      dependencies: dependencies.value,
    };

    return ok(resolvedType);
  }

  async extractMultiple(
    filePath: string,
    typeNames: string[],
  ): Promise<Result<ResolvedType[]>> {
    const results: ResolvedType[] = [];

    for (const typeName of typeNames) {
      const result = await this.extractType(filePath, typeName);
      if (!result.ok) {
        return result;
      }
      results.push(result.value);
    }

    return ok(results);
  }

  async scanFile(filePath: string): Promise<Result<string[]>> {
    const sourceFileResult = await this.parser.parseFile(filePath);
    if (!sourceFileResult.ok) {
      return sourceFileResult;
    }

    const sourceFile = sourceFileResult.value;
    const typeNames: string[] = [];

    for (const interfaceDecl of sourceFile.getInterfaces()) {
      typeNames.push(interfaceDecl.getName());
    }

    for (const typeAlias of sourceFile.getTypeAliases()) {
      const type = typeAlias.getType();
      if (type.isObject() || type.isInterface()) {
        typeNames.push(typeAlias.getName());
      }
    }

    return ok(typeNames);
  }

  private async resolveDependencies(
    typeInfo: TypeInfo,
    sourceFile: string,
  ): Promise<Result<ResolvedType[]>> {
    const dependencies: ResolvedType[] = [];
    const visited = new Set<string>();

    const collectDependencies = async (
      info: TypeInfo,
    ): Promise<Result<void>> => {
      if (isObjectTypeInfo(info)) {
        for (const prop of info.properties) {
          const result = await collectDependencies(prop.type);
          if (!result.ok) return result;
        }
      } else if (isArrayTypeInfo(info)) {
        const result = await collectDependencies(info.elementType);
        if (!result.ok) return result;
      } else if (isUnionTypeInfo(info)) {
        for (const unionType of info.unionTypes) {
          const result = await collectDependencies(unionType);
          if (!result.ok) return result;
        }
      } else if (isIntersectionTypeInfo(info)) {
        for (const intersectionType of info.intersectionTypes) {
          const result = await collectDependencies(intersectionType);
          if (!result.ok) return result;
        }
      } else if (isReferenceTypeInfo(info)) {
        if (!visited.has(info.name)) {
          visited.add(info.name);

          const depResult = await this.extractType(sourceFile, info.name);
          if (depResult.ok) {
            dependencies.push(depResult.value);
            const subResult = await collectDependencies(
              depResult.value.typeInfo,
            );
            if (!subResult.ok) return subResult;
          }
        }
      }

      return ok(undefined);
    };

    const result = await collectDependencies(typeInfo);
    if (!result.ok) return result;

    return ok(dependencies);
  }


  clearCache(): void {
    this.cache.clear();
    this.resolver.clearVisited();
  }
}

export { TypeScriptParser } from "./parser.js";
export { TypeResolver } from "./resolver.js";
export * from "../core/types.js";
export * from "../core/result.js";
