import type { ResolvedType, TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { Result } from '../../../core/result.js';
import type {
  TypeImportCategories,
  TypeCategorizationOptions,
  GenericParamCategorizationOptions,
} from '../types.js';
import { validateTypeName, isGlobalType } from '../utils/validation.js';
import { resolveImportConflicts } from '../utils/deduplication.js';
import { looksLikePackagePath } from '../utils/path-utils.js';
import { DependencyResolver } from '../resolvers/dependency-resolver.js';
import { PackageResolver } from '../resolvers/package-resolver.js';
import { ok, err } from '../../../core/result.js';

export class TypeImportsGenerator {
  private readonly dependencyResolver = new DependencyResolver();
  private readonly packageResolver = new PackageResolver();

  generateTypeImports(resolvedType: ResolvedType, outputDir?: string): Result<string, Error> {
    try {
      if (!resolvedType?.name) {
        return err(new Error('Invalid resolved type or missing name'));
      }

      const categories: TypeImportCategories = {
        localTypes: new Set([resolvedType.name]),
        relativeImports: new Map(),
        externalTypes: new Map(),
      };

      this.processMainType(resolvedType, categories);
      this.processTransitiveDependencies(resolvedType, categories);
      this.processDirectDependencies(resolvedType, categories);

      resolveImportConflicts(categories);

      const importStatements = this.generateImportStatements(categories, resolvedType, outputDir);

      if (importStatements.length === 0) {
        return err(new Error('No valid importable types found'));
      }

      return ok(importStatements.join('\n'));
    } catch (error) {
      return err(new Error(`Failed to generate type imports: ${error}`));
    }
  }

  dispose(): void {
    this.dependencyResolver.dispose();
  }

  private processMainType(resolvedType: ResolvedType, categories: TypeImportCategories): void {
    if (this.isObjectType(resolvedType.typeInfo)) {
      for (const prop of resolvedType.typeInfo.properties) {
        this.categorizeTypesFromTypeInfo({
          typeInfo: prop.type,
          mainSourceFile: resolvedType.sourceFile,
          categories,
        });
      }

      if (resolvedType.typeInfo.genericParams) {
        for (const param of resolvedType.typeInfo.genericParams) {
          this.categorizeTypesFromGenericParam({
            param,
            mainSourceFile: resolvedType.sourceFile,
            categories,
          });
        }
      }
    }
  }

  private processTransitiveDependencies(
    resolvedType: ResolvedType,
    categories: TypeImportCategories,
  ): void {
    const transitiveDependencies =
      this.dependencyResolver.discoverTransitiveDependencies(resolvedType);

    for (const dep of transitiveDependencies) {
      this.categorizeTypeBySource(
        dep.typeName,
        dep.sourceFile,
        resolvedType.sourceFile,
        categories,
      );
    }
  }

  private processDirectDependencies(
    resolvedType: ResolvedType,
    categories: TypeImportCategories,
  ): void {
    if (resolvedType.dependencies?.length) {
      for (const dependency of resolvedType.dependencies) {
        if (dependency.name && validateTypeName(dependency.name)) {
          this.categorizeTypeBySource(
            dependency.name,
            dependency.sourceFile,
            resolvedType.sourceFile,
            categories,
          );
        }
      }
    }
  }

  private categorizeTypesFromTypeInfo(options: TypeCategorizationOptions): void {
    const { typeInfo, mainSourceFile, categories } = options;

    if (!typeInfo) return;

    if (this.isObjectType(typeInfo) && typeInfo.name && validateTypeName(typeInfo.name)) {
      this.categorizeTypeBySource(typeInfo.name, typeInfo.sourceFile, mainSourceFile, categories);

      for (const prop of typeInfo.properties) {
        this.categorizeTypesFromTypeInfo({
          typeInfo: prop.type,
          mainSourceFile,
          categories,
        });
      }
      return;
    }

    this.processNestedTypeStructures(typeInfo, mainSourceFile, categories);
  }

  private processNestedTypeStructures(
    typeInfo: TypeInfo,
    mainSourceFile: string,
    categories: TypeImportCategories,
  ): void {
    if (typeInfo.kind === TypeKind.Array) {
      this.categorizeTypesFromTypeInfo({
        typeInfo: typeInfo.elementType,
        mainSourceFile,
        categories,
      });
      return;
    }

    if (typeInfo.kind === TypeKind.Union) {
      for (const unionType of typeInfo.unionTypes) {
        this.categorizeTypesFromTypeInfo({
          typeInfo: unionType,
          mainSourceFile,
          categories,
        });
      }
      return;
    }

    if (typeInfo.kind === TypeKind.Intersection) {
      for (const intersectionType of typeInfo.intersectionTypes) {
        this.categorizeTypesFromTypeInfo({
          typeInfo: intersectionType,
          mainSourceFile,
          categories,
        });
      }
      return;
    }

    if ('typeArguments' in typeInfo && typeInfo.typeArguments) {
      for (const arg of typeInfo.typeArguments) {
        this.categorizeTypesFromTypeInfo({
          typeInfo: arg,
          mainSourceFile,
          categories,
        });
      }
    }
  }

  private categorizeTypesFromGenericParam(options: GenericParamCategorizationOptions): void {
    const { param, mainSourceFile, categories } = options;

    if (!param) return;

    if (param.constraint) {
      this.categorizeTypesFromTypeInfo({
        typeInfo: param.constraint,
        mainSourceFile,
        categories,
      });
    }

    if (param.default) {
      this.categorizeTypesFromTypeInfo({
        typeInfo: param.default,
        mainSourceFile,
        categories,
      });
    }
  }

  private categorizeTypeBySource(
    typeName: string,
    typeSourceFile: string | undefined,
    mainSourceFile: string,
    categories: TypeImportCategories,
  ): void {
    if (!typeName || isGlobalType(typeName)) {
      return;
    }

    if (!typeSourceFile) {
      categories.localTypes.add(typeName);
      return;
    }

    const looksLikePackage = looksLikePackagePath(typeSourceFile);

    if (looksLikePackage) {
      categories.externalTypes.set(typeName, typeSourceFile);
    } else if (typeSourceFile === mainSourceFile) {
      categories.localTypes.add(typeName);
    } else {
      if (!categories.relativeImports.has(typeSourceFile)) {
        categories.relativeImports.set(typeSourceFile, new Set());
      }
      categories.relativeImports.get(typeSourceFile)!.add(typeName);
    }
  }

  private generateImportStatements(
    categories: TypeImportCategories,
    resolvedType: ResolvedType,
    outputDir?: string,
  ): string[] {
    const importStatements: string[] = [];

    // Generate local imports (same file as main type)
    if (categories.localTypes.size > 0) {
      const uniqueLocalTypes = Array.from(categories.localTypes).filter(validateTypeName);
      if (uniqueLocalTypes.length > 0) {
        const importPath = this.packageResolver.resolveImportPath(resolvedType, outputDir);
        importStatements.push(
          `import type { ${uniqueLocalTypes.join(', ')} } from "${importPath}";`,
        );
      }
    }

    // Generate relative imports (other local files)
    for (const [sourceFile, types] of categories.relativeImports) {
      const uniqueTypes = Array.from(types).filter(validateTypeName);
      if (uniqueTypes.length > 0) {
        const importPath = this.packageResolver.resolveImportPath(
          { ...resolvedType, sourceFile },
          outputDir,
        );
        importStatements.push(`import type { ${uniqueTypes.join(', ')} } from "${importPath}";`);
      }
    }

    // Generate external imports (node_modules)
    if (categories.externalTypes.size > 0) {
      const externalImportsResult = this.packageResolver.generateExternalTypeImports(
        categories.externalTypes,
      );
      if (externalImportsResult.ok && externalImportsResult.value.length > 0) {
        importStatements.push(...externalImportsResult.value);
      }
    }

    return importStatements;
  }

  private isObjectType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> {
    return typeInfo.kind === TypeKind.Object;
  }
}
