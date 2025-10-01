import type { ResolvedType, TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { Result } from '../../../core/result.js';
import type {
  TypeImportCategories,
  TypeCategorizationOptions,
  GenericParamCategorizationOptions,
} from '../types.js';
import { validateTypeName, isNonImportableType } from '../utils/validation.js';
import { resolveImportConflicts } from '../utils/deduplication.js';
import { looksLikePackagePath } from '../utils/path-utils.js';
import { DependencyResolver } from '../resolvers/dependency-resolver.js';
import { PackageResolver } from '../resolvers/package-resolver.js';
import { TypeDefinitionFinder } from '../resolvers/type-definition-finder.js';
import { ok, err } from '../../../core/result.js';

/**
 * Generates TypeScript import statements for all types referenced by a given resolved type.
 * This includes local types, relative imports from other files, and external package imports.
 */
export class TypeImportsGenerator {
  private readonly dependencyResolver = new DependencyResolver();
  private readonly packageResolver = new PackageResolver();
  private readonly typeDefinitionFinder = new TypeDefinitionFinder();

  /**
   * Generates import statements for all types referenced by the given resolved type.
   *
   * @param resolvedType - The type to generate imports for
   * @param outputDir - Optional output directory for resolving relative paths
   * @returns A result containing the generated import statements or an error
   *
   * @example
   * ```typescript
   * const generator = new TypeImportsGenerator();
   * const result = generator.generateTypeImports(userType, './dist');
   * if (result.ok) {
   *   console.log(result.value); // "import type { User, Profile } from './types.js';"
   * }
   * ```
   */
  generateTypeImports(resolvedType: ResolvedType, outputDir?: string): Result<string, Error> {
    try {
      if (!resolvedType) {
        return err(new Error('Cannot generate imports: resolved type is null or undefined'));
      }

      if (!resolvedType.name) {
        return err(
          new Error(
            `Cannot generate imports: resolved type is missing required 'name' property. ` +
              `Source file: ${resolvedType.sourceFile || 'unknown'}`,
          ),
        );
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
        return err(
          new Error(
            `No valid importable types found for '${resolvedType.name}' ` +
              `from '${resolvedType.sourceFile}'. This may indicate that the type has no dependencies ` +
              `or all dependencies are global types.`,
          ),
        );
      }

      return ok(importStatements.join('\n'));
    } catch (error) {
      const errorContext = resolvedType?.name
        ? `Failed to generate type imports for '${resolvedType.name}' from '${resolvedType.sourceFile || 'unknown'}'`
        : 'Failed to generate type imports for unknown type';

      return err(
        new Error(`${errorContext}: ${error instanceof Error ? error.message : String(error)}`),
      );
    }
  }

  /**
   * Cleanup method to dispose of internal resources.
   * Should be called when the generator is no longer needed.
   */
  dispose(): void {
    this.dependencyResolver.dispose();
    this.packageResolver.dispose();
    this.typeDefinitionFinder.dispose();
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

    if (this.isObjectType(typeInfo)) {
      this.processObjectType(typeInfo, mainSourceFile, categories);
      return;
    }

    this.processNestedTypeStructures(typeInfo, mainSourceFile, categories);
  }

  /**
   * Processes object types, handling both named types and their properties.
   */
  private processObjectType(
    typeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>,
    mainSourceFile: string,
    categories: TypeImportCategories,
  ): void {
    // Process named objects
    if (typeInfo.name && validateTypeName(typeInfo.name)) {
      const sourceFile = this.resolveTypeSourceFile(typeInfo, mainSourceFile);
      this.categorizeTypeBySource(typeInfo.name, sourceFile, mainSourceFile, categories);
    }

    // Process all object properties, even for unnamed objects
    for (const prop of typeInfo.properties) {
      const propTypeInfo = this.enhanceNestedTypeInfo(prop.type, typeInfo, mainSourceFile);
      this.categorizeTypesFromTypeInfo({
        typeInfo: propTypeInfo,
        mainSourceFile,
        categories,
      });
    }
  }

  /**
   * Resolves the source file for a type, attempting to find it if missing.
   */
  private resolveTypeSourceFile(
    typeInfo: { sourceFile?: string; name?: string },
    mainSourceFile: string,
  ): string | undefined {
    if (typeInfo.sourceFile) {
      return typeInfo.sourceFile;
    }

    if (!typeInfo.name) {
      return undefined;
    }

    const foundSource = this.typeDefinitionFinder.findTypeSourceFile(typeInfo.name, mainSourceFile);
    return foundSource ?? undefined;
  }

  /**
   * Enhances nested type info by attempting to resolve missing source files.
   */
  private enhanceNestedTypeInfo(
    propTypeInfo: TypeInfo,
    parentTypeInfo: Extract<TypeInfo, { kind: TypeKind.Object }>,
    mainSourceFile: string,
  ): TypeInfo {
    if (
      this.isObjectType(propTypeInfo) &&
      !propTypeInfo.sourceFile &&
      propTypeInfo.name &&
      validateTypeName(propTypeInfo.name)
    ) {
      const hintSourceFile = parentTypeInfo.sourceFile || mainSourceFile;
      const nestedSource = this.typeDefinitionFinder.findTypeSourceFile(
        propTypeInfo.name,
        hintSourceFile,
      );

      if (nestedSource) {
        return {
          ...propTypeInfo,
          sourceFile: nestedSource,
        };
      }
    }

    return propTypeInfo;
  }

  private processNestedTypeStructures(
    typeInfo: TypeInfo,
    mainSourceFile: string,
    categories: TypeImportCategories,
  ): void {
    switch (typeInfo.kind) {
      case TypeKind.Array:
        this.categorizeTypesFromTypeInfo({
          typeInfo: typeInfo.elementType,
          mainSourceFile,
          categories,
        });
        break;

      case TypeKind.Union:
        this.processTypeCollection(typeInfo.unionTypes, mainSourceFile, categories);
        break;

      case TypeKind.Intersection:
        this.processTypeCollection(typeInfo.intersectionTypes, mainSourceFile, categories);
        break;

      default:
        // Handle generic type arguments for any type that might have them
        if ('typeArguments' in typeInfo && typeInfo.typeArguments) {
          this.processTypeCollection(typeInfo.typeArguments, mainSourceFile, categories);
        }
        break;
    }
  }

  /**
   * Processes a collection of types, extracting imports from each.
   */
  private processTypeCollection(
    types: readonly TypeInfo[],
    mainSourceFile: string,
    categories: TypeImportCategories,
  ): void {
    for (const type of types) {
      this.categorizeTypesFromTypeInfo({
        typeInfo: type,
        mainSourceFile,
        categories,
      });
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
    if (!typeName || isNonImportableType(typeName)) {
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
      const existingTypes = categories.relativeImports.get(typeSourceFile);
      if (existingTypes) {
        existingTypes.add(typeName);
      } else {
        categories.relativeImports.set(typeSourceFile, new Set([typeName]));
      }
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
