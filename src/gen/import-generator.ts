/**
 * Import generation utilities for builder code
 * Handles import statement generation and path resolution
 */

import path from 'node:path';
import type { ResolvedType, TypeInfo, GenericParam } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import type { PluginManager, ImportTransformContext } from '../core/plugin/index.js';
import { HookType } from '../core/plugin/index.js';
import { ImportResolver } from '../core/import-resolver.js';
import { isValidImportableTypeName } from './types.js';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { Project } from 'ts-morph';

/**
 * Configuration for import generation
 */
export interface ImportGeneratorConfig {
  /** Whether generating multiple files */
  readonly isGeneratingMultiple: boolean;
  /** Whether common.ts file exists in output directory */
  readonly hasExistingCommon?: boolean;
  /** Path to common utilities */
  readonly commonImportPath: string;
  /** Plugin manager for additional imports */
  readonly pluginManager?: PluginManager;
  /** Output directory for generated files */
  readonly outputDir?: string;
}

/**
 * Generates import statements for builder files
 */
export class ImportGenerator {
  private readonly importResolver = new ImportResolver();
  private currentOutputDir?: string;
  private project?: Project;

  /**
   * Generates imports for Node.js built-in types
   * @param resolvedType - The resolved type information
   */
  generateNodeJSImports(resolvedType: ResolvedType): string[] {
    const imports: string[] = [];
    const nodeJSTypeMapping: Record<string, { module: string; types: Set<string> }> = {};

    // Helper function to add type to mapping
    const addType = (typeName: string, module: string) => {
      if (!nodeJSTypeMapping[module]) {
        nodeJSTypeMapping[module] = { module, types: new Set() };
      }
      nodeJSTypeMapping[module].types.add(typeName);
    };

    // Recursively scan for Node.js built-in types
    const scanForNodeJSTypes = (typeInfo: TypeInfo) => {
      if (typeInfo.kind === 'primitive') {
        switch (typeInfo.name) {
          case 'EventEmitter':
            addType('EventEmitter', 'events');
            break;
          case 'Readable':
          case 'Writable':
          case 'Transform':
          case 'Duplex':
            addType(typeInfo.name, 'stream');
            break;
          case 'URL':
          case 'URLSearchParams':
            addType(typeInfo.name, 'url');
            break;
          case 'Buffer':
            // Buffer is global in Node.js, no import needed
            break;
          case 'ProcessEnv':
            // ProcessEnv is part of NodeJS namespace - no additional import needed
            break;
        }
      }

      // Recursively scan object properties
      if (typeInfo.kind === 'object' && 'properties' in typeInfo && typeInfo.properties) {
        for (const prop of typeInfo.properties) {
          scanForNodeJSTypes(prop.type);
        }
      }

      // Recursively scan array elements
      if (typeInfo.kind === TypeKind.Array && 'elementType' in typeInfo && typeInfo.elementType) {
        scanForNodeJSTypes(typeInfo.elementType);
      }

      // Recursively scan union members
      if (typeInfo.kind === TypeKind.Union && 'unionTypes' in typeInfo && typeInfo.unionTypes) {
        for (const member of typeInfo.unionTypes) {
          scanForNodeJSTypes(member);
        }
      }

      // Recursively scan generic type arguments
      if ('typeArguments' in typeInfo && typeInfo.typeArguments) {
        for (const arg of typeInfo.typeArguments) {
          scanForNodeJSTypes(arg);
        }
      }
    };

    // Scan the main type info
    scanForNodeJSTypes(resolvedType.typeInfo);

    // Generate import statements
    Object.values(nodeJSTypeMapping).forEach(({ module, types }) => {
      const typeList = Array.from(types).sort().join(', ');
      imports.push(`import { ${typeList} } from "${module}";`);
    });

    return imports;
  }

  /**
   * Extracts module names from named import statements
   * @param importStatements - String containing import statements
   */
  private extractModulesFromNamedImports(importStatements: string): Set<string> {
    const modules = new Set<string>();

    // Add input length validation to prevent ReDoS attacks
    if (importStatements.length > 10000) {
      console.warn('Import statements string too long, truncating for safety');
      importStatements = importStatements.substring(0, 10000);
    }

    // Capture:
    // 1. import type { ... } from "module"
    // 2. import type { ... } from 'module'
    // 3. import type {\n  ...\n} from "module" (multiline)
    // 4. import type  {  ...  }  from  "module" (extra whitespace)
    const namedTypeImportRegex = /import\s+type\s+\{\s*[^}]+\s*\}\s+from\s+["']([^"']+)["']/gm;

    // Safe replacement for mixed imports - completely avoids ReDoS vulnerability
    // Uses simple line-by-line processing instead of complex regex patterns
    const mixedImportRegex = /import\s+\{[^}]+\}\s+from\s+["']([^"']+)["']/gm;

    // Process type-only named imports
    let match;
    while ((match = namedTypeImportRegex.exec(importStatements)) !== null) {
      if (match[1]) {
        modules.add(match[1]);
      }
    }

    // Process mixed imports that likely contain types (starting with capital letters)
    while ((match = mixedImportRegex.exec(importStatements)) !== null) {
      if (match[1] && match[0]) {
        // Extract the import content between braces
        const braceStart = match[0].indexOf('{');
        const braceEnd = match[0].indexOf('}');
        if (braceStart !== -1 && braceEnd !== -1) {
          const importContent = match[0].substring(braceStart + 1, braceEnd);

          // Check if import contains type keywords or capitalized identifiers
          if (/(?:type\s+\w+|[A-Z]\w*)/.test(importContent)) {
            modules.add(match[1]);
          }
        }
      }
    }

    return modules;
  }

  /**
   * Generates module imports from resolved type dependencies
   * @param resolvedType - The resolved type information
   * @param excludeModules - Set of module names to exclude from namespace imports
   */
  generateModuleImports(
    resolvedType: ResolvedType,
    excludeModules?: Set<string>,
  ): Result<string[]> {
    try {
      if (!resolvedType || !Array.isArray(resolvedType.imports)) {
        return err(new Error('Invalid resolved type or imports array'));
      }

      const moduleImports: string[] = [];

      for (const imp of resolvedType.imports) {
        if (typeof imp !== 'string' || imp.trim() === '') {
          continue; // Skip invalid import paths
        }

        const resolveResult = this.importResolver.resolve({
          importPath: imp,
        });

        if (resolveResult.ok && resolveResult.value.isNodeModule) {
          const importInfo = resolveResult.value;
          const formattedPath = this.importResolver.formatImportPath({
            info: importInfo,
            sourceFilePath: resolvedType.sourceFile,
          });

          // Skip namespace import if this module already has named imports
          if (!excludeModules || !excludeModules.has(formattedPath)) {
            moduleImports.push(
              `import type * as ${importInfo.moduleName} from "${formattedPath}";`,
            );
          }
        }
      }

      return ok(moduleImports);
    } catch (error) {
      return err(new Error(`Failed to generate module imports: ${error}`));
    }
  }

  /**
   * Generates common utility imports for builder files
   * @param config - Import generation configuration
   */
  generateCommonImports(config: ImportGeneratorConfig): string {
    // Generate common imports if:
    // 1. Generating multiple files (isGeneratingMultiple), OR
    // 2. Single file generation but common.ts exists (hasExistingCommon)
    if (!config || (!config.isGeneratingMultiple && !config.hasExistingCommon)) {
      return '';
    }

    if (typeof config.commonImportPath !== 'string' || config.commonImportPath.trim() === '') {
      throw new Error('Invalid common import path provided');
    }

    return `import type {
  FluentBuilder,
  BaseBuildContext,
} from "${config.commonImportPath}";
import {
  FluentBuilderBase,
  createInspectMethod
} from "${config.commonImportPath}";`;
  }

  /**
   * Generates external type imports as named imports
   * @param externalTypes - Map of type name to source file
   */
  private generateExternalTypeImports(externalTypes: Map<string, string>): Result<string> {
    try {
      // Group types by their source module
      const moduleToTypes = new Map<string, string[]>();

      for (const [typeName, sourceFile] of externalTypes) {
        let moduleName: string | undefined;

        // Try pnpm structure first
        const pnpmMatch = sourceFile.match(
          /\.pnpm\/([^@]+@[^/]+)\/node_modules\/([^/]+(?:\/[^/]+)?)/,
        );
        if (pnpmMatch && pnpmMatch[2]) {
          moduleName = pnpmMatch[2];
        } else {
          // Try regular node_modules structure - find the last occurrence
          const matches = Array.from(sourceFile.matchAll(/node_modules\/([^/]+(?:\/[^/]+)?)/g));
          const lastMatch = matches[matches.length - 1];
          if (lastMatch && lastMatch[1]) {
            moduleName = lastMatch[1];
          }
        }

        if (moduleName) {
          if (!moduleToTypes.has(moduleName)) {
            moduleToTypes.set(moduleName, []);
          }
          const typeList = moduleToTypes.get(moduleName);
          if (typeList) {
            typeList.push(typeName);
          }
        }
      }

      // Generate import statements
      const imports: string[] = [];
      for (const [moduleName, types] of moduleToTypes) {
        const uniqueTypes = Array.from(new Set(types)).sort();
        imports.push(`import type { ${uniqueTypes.join(', ')} } from "${moduleName}";`);
      }

      return ok(imports.join('\n'));
    } catch (error) {
      return err(new Error(`Failed to generate external type imports: ${error}`));
    }
  }

  /**
   * Generates all imports including plugin imports
   * @param resolvedType - The resolved type information
   * @param config - Import generation configuration
   */
  async generateAllImports({
    resolvedType,
    config,
  }: {
    resolvedType: ResolvedType;
    config: ImportGeneratorConfig;
  }): Promise<Result<string>> {
    try {
      if (!resolvedType || !config) {
        return err(new Error('Invalid resolved type or configuration'));
      }

      // Set the current output directory for relative path resolution
      this.currentOutputDir = config.outputDir || '';

      const imports: string[] = [];

      // Add common imports
      const commonImports = this.generateCommonImports(config);
      if (commonImports) {
        imports.push(commonImports);
      }

      // Add Node.js built-in type imports
      const nodeImports = this.generateNodeJSImports(resolvedType);
      if (nodeImports.length > 0) {
        imports.push(...nodeImports);
      }

      // First, generate type imports to see which modules have named imports
      const typeImportsResult = this.generateTypeImports(resolvedType);
      if (!typeImportsResult.ok) {
        return typeImportsResult;
      }

      // Extract module names that have named imports to avoid namespace duplicates
      let namedImportModules = this.extractModulesFromNamedImports(typeImportsResult.value || '');

      // Also check for any existing named imports in the current imports array
      // This handles cases where user's source files already have selective imports
      if (resolvedType.imports && Array.isArray(resolvedType.imports)) {
        for (const importPath of resolvedType.imports) {
          if (typeof importPath === 'string' && importPath.trim() !== '') {
            // If this looks like a module that might have named imports, add it to exclusions
            // We're being conservative here - if there's any doubt, preserve user's intent
            if (this.shouldPreserveNamedImports(importPath, resolvedType)) {
              namedImportModules.add(importPath);
            }
          }
        }
      }

      // Add module imports only for modules that don't have named imports
      const moduleImportsResult = this.generateModuleImports(resolvedType, namedImportModules);
      if (!moduleImportsResult.ok) {
        return moduleImportsResult;
      }
      imports.push(...moduleImportsResult.value);

      // Add the type imports
      imports.push(typeImportsResult.value);

      // Add plugin imports if available
      if (config.pluginManager) {
        const pluginImports = config.pluginManager.getRequiredImports();

        // Add plugin import statements
        const pluginImportStatements = pluginImports.toImportStatements();
        imports.push(...pluginImportStatements);
      }

      // Deduplicate imports
      let uniqueImports = this.deduplicateImports(imports);

      // Apply plugin transformations to imports
      if (config.pluginManager) {
        const transformContext: ImportTransformContext = {
          imports: uniqueImports,
          resolvedType,
          isGeneratingMultiple: config.isGeneratingMultiple,
          hasExistingCommon: config.hasExistingCommon ?? false,
        };

        const transformResult = await config.pluginManager.executeHook({
          hookType: HookType.TransformImports,
          input: transformContext,
        });

        if (transformResult.ok) {
          uniqueImports = [...transformResult.value.imports];
        }
      }

      return ok(uniqueImports.join('\n'));
    } catch (error) {
      return err(new Error(`Failed to generate all imports: ${error}`));
    }
  }

  /**
   * Deduplicates import statements
   */
  private deduplicateImports(imports: string[]): string[] {
    if (!Array.isArray(imports)) {
      return [];
    }

    const seen = new Set<string>();
    const deduplicated: string[] = [];

    for (const imp of imports) {
      if (typeof imp !== 'string') {
        continue;
      }

      const normalized = imp.trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(imp);
      }
    }

    return deduplicated;
  }

  /**
   * Generates type imports from source files
   * @param resolvedType - The resolved type information
   */
  generateTypeImports(resolvedType: ResolvedType): Result<string> {
    try {
      if (!resolvedType || !resolvedType.name) {
        return err(new Error('Invalid resolved type or missing name'));
      }

      // Three categories of imports:
      // 1. Local types - from the same file as the main type
      // 2. Relative types - from other local files in the project
      // 3. External types - from node_modules packages
      const localTypes = new Set<string>([resolvedType.name]);
      const relativeImports = new Map<string, Set<string>>(); // sourceFile -> types
      const externalTypes = new Map<string, string>(); // type -> sourceFile

      // Process nested types in the main type
      if (this.isObjectType(resolvedType.typeInfo)) {
        for (const prop of resolvedType.typeInfo.properties) {
          this.categorizeTypesFromTypeInfo(
            prop.type,
            resolvedType.sourceFile,
            localTypes,
            relativeImports,
            externalTypes,
          );
        }
      }

      // Process generic constraint types
      if (this.isObjectType(resolvedType.typeInfo) && resolvedType.typeInfo.genericParams) {
        for (const param of resolvedType.typeInfo.genericParams) {
          this.categorizeTypesFromGenericParam(
            param,
            resolvedType.sourceFile,
            localTypes,
            relativeImports,
            externalTypes,
          );
        }
      }

      // Process transitive dependencies using ts-morph to discover imported types
      const transitiveDependencies = this.discoverTransitiveDependencies(resolvedType);

      for (const dep of transitiveDependencies) {
        this.categorizeTypeBySource(
          dep.typeName,
          dep.sourceFile,
          resolvedType.sourceFile,
          localTypes,
          relativeImports,
          externalTypes,
        );
      }

      // Also process direct dependencies from TypeScript resolution
      if (resolvedType.dependencies && resolvedType.dependencies.length > 0) {
        for (const dependency of resolvedType.dependencies) {
          if (dependency.name && isValidImportableTypeName(dependency.name)) {
            this.categorizeTypeBySource(
              dependency.name,
              dependency.sourceFile,
              resolvedType.sourceFile,
              localTypes,
              relativeImports,
              externalTypes,
            );
          }
        }
      }

      // Resolve import conflicts - prefer external over local re-exports
      this.resolveImportConflicts(localTypes, relativeImports, externalTypes);

      // Generate import statements
      const importStatements: string[] = [];

      // 1. Generate local imports (same file as main type)
      if (localTypes.size > 0) {
        const uniqueLocalTypes = Array.from(localTypes).filter(isValidImportableTypeName);
        if (uniqueLocalTypes.length > 0) {
          const importPath = this.resolveImportPath(resolvedType, this.currentOutputDir);
          const localImportStatement = `import type { ${uniqueLocalTypes.join(', ')} } from "${importPath}";`;
          importStatements.push(localImportStatement);
        }
      }

      // 2. Generate relative imports (other local files)
      for (const [sourceFile, types] of relativeImports) {
        const uniqueTypes = Array.from(types).filter(isValidImportableTypeName);
        if (uniqueTypes.length > 0) {
          const importPath = this.resolveImportPath(
            { ...resolvedType, sourceFile },
            this.currentOutputDir,
          );
          const relativeImportStatement = `import type { ${uniqueTypes.join(', ')} } from "${importPath}";`;
          importStatements.push(relativeImportStatement);
        }
      }

      // 3. Generate external imports (node_modules)
      if (externalTypes.size > 0) {
        const externalImportsResult = this.generateExternalTypeImports(externalTypes);
        if (externalImportsResult.ok && externalImportsResult.value) {
          importStatements.push(externalImportsResult.value);
        }
      }

      if (importStatements.length === 0) {
        return err(new Error('No valid importable types found'));
      }

      return ok(importStatements.join('\n'));
    } catch (error) {
      return err(new Error(`Failed to generate type imports: ${error}`));
    }
  }

  /**
   * Categorizes types from TypeInfo into local, relative, and external imports
   */
  private categorizeTypesFromTypeInfo(
    typeInfo: TypeInfo,
    mainSourceFile: string,
    localTypes: Set<string>,
    relativeImports: Map<string, Set<string>>,
    externalTypes: Map<string, string>,
  ): void {
    if (!typeInfo) return;

    // Handle object types with names
    if (this.isObjectType(typeInfo) && typeInfo.name && isValidImportableTypeName(typeInfo.name)) {
      this.categorizeTypeBySource(
        typeInfo.name,
        typeInfo.sourceFile,
        mainSourceFile,
        localTypes,
        relativeImports,
        externalTypes,
      );

      // Recursively process properties
      for (const prop of typeInfo.properties) {
        this.categorizeTypesFromTypeInfo(
          prop.type,
          mainSourceFile,
          localTypes,
          relativeImports,
          externalTypes,
        );
      }
      return;
    }

    // Handle array types
    if (typeInfo.kind === TypeKind.Array) {
      this.categorizeTypesFromTypeInfo(
        typeInfo.elementType,
        mainSourceFile,
        localTypes,
        relativeImports,
        externalTypes,
      );
      return;
    }

    // Handle union types
    if (typeInfo.kind === TypeKind.Union) {
      for (const unionType of typeInfo.unionTypes) {
        this.categorizeTypesFromTypeInfo(
          unionType,
          mainSourceFile,
          localTypes,
          relativeImports,
          externalTypes,
        );
      }
      return;
    }

    // Handle intersection types
    if (typeInfo.kind === TypeKind.Intersection) {
      for (const intersectionType of typeInfo.intersectionTypes) {
        this.categorizeTypesFromTypeInfo(
          intersectionType,
          mainSourceFile,
          localTypes,
          relativeImports,
          externalTypes,
        );
      }
      return;
    }

    // Handle generic types with type arguments
    if ('typeArguments' in typeInfo && typeInfo.typeArguments) {
      for (const arg of typeInfo.typeArguments) {
        this.categorizeTypesFromTypeInfo(
          arg,
          mainSourceFile,
          localTypes,
          relativeImports,
          externalTypes,
        );
      }
    }
  }

  /**
   * Categorizes types from generic parameters
   */
  private categorizeTypesFromGenericParam(
    param: GenericParam,
    mainSourceFile: string,
    localTypes: Set<string>,
    relativeImports: Map<string, Set<string>>,
    externalTypes: Map<string, string>,
  ): void {
    if (!param) return;

    if (param.constraint) {
      this.categorizeTypesFromTypeInfo(
        param.constraint,
        mainSourceFile,
        localTypes,
        relativeImports,
        externalTypes,
      );
    }

    if (param.default) {
      this.categorizeTypesFromTypeInfo(
        param.default,
        mainSourceFile,
        localTypes,
        relativeImports,
        externalTypes,
      );
    }
  }

  /**
   * Discovers transitive dependencies using ts-morph to analyze source files directly
   * This helps find dependencies that TypeScript might have inlined during resolution
   */
  private discoverTransitiveDependencies(
    resolvedType: ResolvedType,
  ): Array<{ typeName: string; sourceFile: string }> {
    try {
      if (!this.project) {
        this.project = new Project({
          useInMemoryFileSystem: false,
          skipFileDependencyResolution: true,
        });
      }

      const dependencies: Array<{ typeName: string; sourceFile: string }> = [];
      const visited = new Set<string>();

      const analyzeFile = (filePath: string) => {
        if (visited.has(filePath) || !filePath || this.looksLikePackagePath(filePath)) {
          return;
        }
        visited.add(filePath);

        try {
          const sourceFile = this.project!.addSourceFileAtPath(filePath);

          // Get all import declarations
          const imports = sourceFile.getImportDeclarations();

          for (const importDecl of imports) {
            const moduleSpecifier = importDecl.getModuleSpecifierValue();

            // Skip external packages for now - they're handled elsewhere
            if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
              continue;
            }

            // Resolve the import path to absolute path
            const resolvedPath = this.resolveRelativeImportPath(filePath, moduleSpecifier);
            if (!resolvedPath) continue;

            // Get imported type names
            const namedImports = importDecl.getNamedImports();
            for (const namedImport of namedImports) {
              const importName = namedImport.getName();
              if (isValidImportableTypeName(importName)) {
                dependencies.push({
                  typeName: importName,
                  sourceFile: resolvedPath,
                });

                // Recursively analyze imported file
                analyzeFile(resolvedPath);
              }
            }

            // Handle type-only imports
            if (importDecl.isTypeOnly()) {
              const defaultImport = importDecl.getDefaultImport();
              if (defaultImport && isValidImportableTypeName(defaultImport.getText())) {
                dependencies.push({
                  typeName: defaultImport.getText(),
                  sourceFile: resolvedPath,
                });
              }
            }
          }
        } catch (error) {
          console.warn(`Error analyzing file ${filePath}:`, error);
          // Silently ignore file analysis errors - the file may not exist or be accessible
          // This is expected behavior when dealing with .js imports that reference .ts files
        }
      };

      // Start analysis from the main source file
      analyzeFile(resolvedType.sourceFile);

      return dependencies;
    } catch {
      // Return empty array on analysis failure - this is a fallback mechanism
      return [];
    }
  }

  /**
   * Resolves a relative import path to absolute path
   */
  private resolveRelativeImportPath(
    sourceFilePath: string,
    importSpecifier: string,
  ): string | null {
    try {
      const sourceDir = path.dirname(sourceFilePath);

      // Handle .js imports by converting to .ts
      let actualImportSpecifier = importSpecifier;
      if (importSpecifier.endsWith('.js')) {
        actualImportSpecifier = importSpecifier.replace(/\.js$/, '.ts');
      }

      let resolvedPath = path.resolve(sourceDir, actualImportSpecifier);

      // If the import specifier already has an extension, use it directly
      if (
        actualImportSpecifier.endsWith('.ts') ||
        actualImportSpecifier.endsWith('.tsx') ||
        actualImportSpecifier.endsWith('.d.ts')
      ) {
        return resolvedPath;
      }

      // Try common TypeScript file extensions
      const extensions = ['.ts', '.tsx', '.d.ts'];
      for (const ext of extensions) {
        const pathWithExt = resolvedPath + ext;
        return pathWithExt; // Return the first attempt for now
      }

      // Try index file
      for (const ext of extensions) {
        const indexPath = path.join(resolvedPath, `index${ext}`);
        return indexPath; // Return the first attempt for now
      }

      return resolvedPath + '.ts'; // Default fallback
    } catch {
      return null;
    }
  }

  /**
   * Categorizes a single type by its source file into one of three categories
   */
  private categorizeTypeBySource(
    typeName: string,
    typeSourceFile: string | undefined,
    mainSourceFile: string,
    localTypes: Set<string>,
    relativeImports: Map<string, Set<string>>,
    externalTypes: Map<string, string>,
  ): void {
    if (!typeName || this.isGlobalType(typeName)) {
      return;
    }

    if (!typeSourceFile) {
      // If no source file, assume it's local to the main type
      localTypes.add(typeName);
      return;
    }

    // Determine import category
    const looksLikePackage = this.looksLikePackagePath(typeSourceFile);

    if (looksLikePackage) {
      // External package import
      externalTypes.set(typeName, typeSourceFile);
    } else if (typeSourceFile === mainSourceFile) {
      // Local to the same file
      localTypes.add(typeName);
    } else {
      // Relative import from another local file
      if (!relativeImports.has(typeSourceFile)) {
        relativeImports.set(typeSourceFile, new Set());
      }
      relativeImports.get(typeSourceFile)!.add(typeName);
    }
  }

  /**
   * Resolves the import path for a type
   * For local files, returns relative path from output directory
   * For package files, attempts to resolve to proper import specifier
   */
  private resolveImportPath(resolvedType: ResolvedType, outputDir?: string): string {
    if (!resolvedType || typeof resolvedType.sourceFile !== 'string') {
      throw new Error('Invalid resolved type or source file path');
    }

    const sourceFile = resolvedType.sourceFile;

    // Check if this appears to be a package-related path
    // by looking for common package manager directory structures
    if (this.looksLikePackagePath(sourceFile)) {
      const potentialImportPaths = this.extractPotentialPackageImports(sourceFile);

      // Try each potential import path
      for (const importPath of potentialImportPaths) {
        const resolveResult = this.importResolver.resolve({ importPath });

        if (resolveResult.ok && resolveResult.value.isNodeModule) {
          return this.importResolver.formatImportPath({
            info: resolveResult.value,
            sourceFilePath: sourceFile,
          });
        }
      }
    }

    // For local files, calculate relative path from output directory
    if (outputDir && !this.looksLikePackagePath(sourceFile)) {
      try {
        const relativePath = path.relative(outputDir, sourceFile);
        // Remove .ts extension and add .js extension for ES modules
        const jsPath = relativePath.replace(/\.ts$/, '.js');
        // Ensure relative path starts with ./ or ../
        return jsPath.startsWith('.') ? jsPath : `./${jsPath}`;
      } catch (error) {
        console.warn(`Failed to resolve relative path for ${sourceFile}:`, error);
      }
    }

    // For local files or when package resolution fails, return the source file path
    return sourceFile;
  }

  /**
   * Determines if a file path looks like it could be from a package
   * Uses heuristics to detect package manager structures
   */
  private looksLikePackagePath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const parts = normalizedPath.split(path.sep);

    // Look for common package manager indicators
    return parts.some(
      part => part === 'node_modules' || part.startsWith('.pnpm') || part.includes('@'), // Often indicates scoped packages
    );
  }

  /**
   * Extracts potential package import paths from a file path
   * Tries to handle different package manager structures
   */
  private extractPotentialPackageImports(filePath: string): string[] {
    const potentialPaths: string[] = [];
    const normalizedPath = path.normalize(filePath);
    const parts = normalizedPath.split(path.sep);

    // Find package manager directory indices
    const packageDirIndices = parts
      .map((part, index) => {
        if (part === 'node_modules' || part.startsWith('.pnpm')) {
          return index;
        }
        return -1;
      })
      .filter(index => index !== -1);

    // Extract potential package paths from each package directory
    for (const dirIndex of packageDirIndices) {
      if (dirIndex < parts.length - 1) {
        const afterPackageDir = parts.slice(dirIndex + 1);
        const extracted = this.extractPackageNameFromParts(afterPackageDir);
        if (extracted) {
          potentialPaths.push(extracted);
        }
      }
    }

    return potentialPaths;
  }

  /**
   * Extracts package name from path parts after a package directory
   */
  private extractPackageNameFromParts(parts: string[]): string | null {
    if (parts.length === 0) {
      return null;
    }

    // Handle scoped packages
    if (parts[0] && parts[0].length > 0 && parts[0].charAt(0) === '@') {
      if (parts.length >= 2) {
        const scopedPackage = `${parts[0]}/${parts[1]}`;

        // For scoped packages, include subpath if meaningful
        if (parts.length > 2) {
          const subPath = this.cleanSubPath(parts.slice(2).join('/'));
          if (subPath) {
            return `${scopedPackage}/${subPath}`;
          }
        }
        return scopedPackage;
      }
    } else {
      // Regular package
      const packageName = parts[0];
      if (packageName) {
        // Include subpath if meaningful
        if (parts.length > 1) {
          const subPath = this.cleanSubPath(parts.slice(1).join('/'));
          if (subPath) {
            return `${packageName}/${subPath}`;
          }
        }
        return packageName;
      }
    }

    return null;
  }

  /**
   * Cleans a subpath by removing file extensions and index references
   */
  private cleanSubPath(subPath: string): string {
    if (!subPath) {
      return '';
    }

    // Remove file extensions
    const withoutExt = subPath.replace(/\.(d\.ts|ts|js)$/, '');

    // Remove index file references
    const cleaned = withoutExt.replace(/\/index$|^index$/, '');

    return cleaned === '.' ? '' : cleaned;
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
   * Checks if a type is a global type that doesn't need importing
   * Uses globalThis to detect built-in types and global constructors
   */
  private isGlobalType(typeName: string): boolean {
    if (typeof typeName !== 'string' || typeName.trim() === '') {
      return false;
    }

    try {
      // Check if the type exists as a property of globalThis
      // This covers built-in constructors like Date, Array, Object, etc.
      return typeName in globalThis && typeof (globalThis as any)[typeName] === 'function';
    } catch {
      // If there's any error accessing globalThis, assume it's not global
      return false;
    }
  }

  /**
   * Determines if we should preserve named imports for a given module path
   * This helps prevent converting user's selective imports to namespace imports
   */
  private shouldPreserveNamedImports(importPath: string, resolvedType: ResolvedType): boolean {
    if (!importPath || !resolvedType) {
      return false;
    }

    // Check if this is an external module (not relative path)
    const resolveResult = this.importResolver.resolve({ importPath });
    if (!resolveResult.ok || !resolveResult.value.isNodeModule) {
      return false;
    }

    // If the resolved type has external types from this module, assume named imports
    // This is conservative - we err on the side of preserving user intent
    return true;
  }

  /**
   * Resolves conflicts when the same type name appears in multiple import categories.
   * Strategy: Prefer external packages over local re-exports for the same type.
   */
  private resolveImportConflicts(
    localTypes: Set<string>,
    relativeImports: Map<string, Set<string>>,
    externalTypes: Map<string, string>,
  ): void {
    // Find all type names that appear in external types
    const externalTypeNames = new Set(externalTypes.keys());

    // Remove conflicting types from localTypes
    for (const typeName of externalTypeNames) {
      if (localTypes.has(typeName)) {
        localTypes.delete(typeName);
      }
    }

    // Remove conflicting types from relativeImports
    for (const [sourceFile, types] of relativeImports) {
      const typesToRemove: string[] = [];
      for (const typeName of types) {
        if (externalTypeNames.has(typeName)) {
          typesToRemove.push(typeName);
        }
      }

      // Remove the conflicting types
      for (const typeName of typesToRemove) {
        types.delete(typeName);
      }

      // If the source file has no more types, remove it entirely
      if (types.size === 0) {
        relativeImports.delete(sourceFile);
      }
    }
  }
}
