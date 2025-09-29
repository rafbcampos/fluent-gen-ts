import { Project, SourceFile, Type, ts } from 'ts-morph';
import type { ProjectOptions } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import { TypeResolutionCache } from '../core/cache.js';
import { PluginManager, HookType } from '../core/plugin/index.js';
import { PackageResolver } from '../core/package-resolver.js';
import path from 'node:path';

import type { MonorepoConfig } from '../core/package-resolver.js';

export interface ParserOptions {
  readonly tsConfigPath?: string;
  readonly cache?: TypeResolutionCache;
  readonly pluginManager?: PluginManager;
  readonly monorepoConfig?: MonorepoConfig;
}

interface TypeDeclaration {
  getType(): Type;
}

type TypeFinder = (name: string) => TypeDeclaration | undefined;

interface FindTypeParams {
  readonly sourceFile: SourceFile;
  readonly typeName: string;
}

interface TypeFinderContext {
  readonly sourceFile: SourceFile;
  readonly typeName: string;
  readonly cacheKey: string;
}

type CachedType = Type | undefined;
type CachedSourceFile = SourceFile | undefined;

export class TypeScriptParser {
  private readonly project: Project;
  private readonly cache: TypeResolutionCache;
  private readonly pluginManager: PluginManager;
  private readonly packageResolver: PackageResolver;
  private readonly monorepoConfig: MonorepoConfig | undefined;

  constructor(options: ParserOptions = {}) {
    const projectOptions: ProjectOptions = {
      ...(options.tsConfigPath && { tsConfigFilePath: options.tsConfigPath }),
      skipAddingFilesFromTsConfig: !options.tsConfigPath,
      compilerOptions: {
        allowJs: false,
        declaration: true,
        emitDeclarationOnly: false,
        noEmit: true,
        skipLibCheck: true,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        ...(options.tsConfigPath && {
          baseUrl: path.dirname(options.tsConfigPath),
          paths: {
            '*': ['node_modules/*', '*/node_modules/*'],
          },
        }),
      },
    };

    this.project = new Project(projectOptions);

    this.cache = options.cache ?? new TypeResolutionCache();
    this.pluginManager = options.pluginManager ?? new PluginManager();
    this.packageResolver = new PackageResolver();
    this.monorepoConfig = options.monorepoConfig;
  }

  /**
   * Load external dependencies into the TypeScript project for better resolution
   * Uses robust package resolution that handles monorepo scenarios including
   * pnpm workspaces, yarn workspaces, and hoisted dependencies
   *
   * @param packageNames Array of package names to load (e.g., ['@my-org/pkg'])
   * @param projectRoot The root directory to search for node_modules
   */
  async loadExternalDependencies(
    packageNames: string[],
    projectRoot: string,
  ): Promise<Result<{ loadedPackages: string[]; failedPackages: string[]; warnings: string[] }>> {
    try {
      const packageManager = await this.packageResolver.detectPackageManager(projectRoot);
      const loadedPackages: string[] = [];
      const failedPackages: string[] = [];
      const warnings: string[] = [];

      for (const packageName of packageNames) {
        const resolveResult = await this.packageResolver.resolvePackage({
          packageName,
          startPath: projectRoot,
          packageManager,
          ...(this.monorepoConfig !== undefined && { monorepoConfig: this.monorepoConfig }),
        });

        if (!resolveResult.ok) {
          failedPackages.push(packageName);
          warnings.push(
            `Failed to resolve package '${packageName}': ${resolveResult.error.message}`,
          );
          continue;
        }

        const resolvedPackage = resolveResult.value;

        let typesLoaded = false;

        // Load primary types entry if available
        if (resolvedPackage.typesPath) {
          try {
            this.project.addSourceFileAtPath(resolvedPackage.typesPath);
            typesLoaded = true;
          } catch (error) {
            warnings.push(`Failed to load types from ${resolvedPackage.typesPath}: ${error}`);
          }
        }

        // Load declaration files as fallback or supplement
        if (resolvedPackage.declarationFiles.length > 0) {
          let filesLoaded = 0;
          for (const dtsFile of resolvedPackage.declarationFiles) {
            try {
              this.project.addSourceFileAtPath(dtsFile);
              filesLoaded++;
            } catch {
              warnings.push(`Failed to load declaration file ${dtsFile}`);
            }
          }

          if (filesLoaded > 0) {
            typesLoaded = true;
          }
        }

        if (typesLoaded) {
          loadedPackages.push(packageName);
        } else {
          failedPackages.push(packageName);
          warnings.push(`No TypeScript definitions found for package '${packageName}'`);
        }
      }

      return ok({ loadedPackages, failedPackages, warnings });
    } catch (error) {
      return err(new Error(`Failed to load external dependencies: ${error}`));
    }
  }

  /**
   * Parse a TypeScript file and return the SourceFile object
   *
   * @param filePath Absolute or relative path to the TypeScript file
   * @returns Result containing the parsed SourceFile or an error
   * @example
   * ```typescript
   * const result = await parser.parseFile('./src/types.ts');
   * if (result.ok) {
   *   console.log(`Parsed ${result.value.getFilePath()}`);
   * }
   * ```
   */
  async parseFile(filePath: string): Promise<Result<SourceFile>> {
    try {
      const absolutePath = path.resolve(filePath);

      const cached = this.getCachedSourceFile(absolutePath);
      if (cached) {
        return ok(cached);
      }

      const sourceFile = this.project.addSourceFileAtPath(absolutePath);
      this.cache.setFile(absolutePath, sourceFile);

      return ok(sourceFile);
    } catch (error) {
      return err(new Error(`Failed to parse file: ${error}`));
    }
  }

  /**
   * Find a specific type declaration within a source file
   *
   * Searches for interfaces, type aliases, enums, and classes in the source file
   * and its modules. Uses caching for performance and executes plugin hooks.
   *
   * @param params Object containing sourceFile and typeName
   * @param params.sourceFile The SourceFile to search in
   * @param params.typeName The name of the type to find
   * @returns Result containing the found Type or an error
   * @example
   * ```typescript
   * const result = await parser.findType({ sourceFile, typeName: 'UserInterface' });
   * if (result.ok) {
   *   const type = result.value;
   *   console.log(`Found type: ${type.getSymbol()?.getName()}`);
   * }
   * ```
   */
  async findType({ sourceFile, typeName }: FindTypeParams): Promise<Result<Type>> {
    const cacheKey = this.cache.getCacheKey({
      file: sourceFile.getFilePath(),
      typeName,
    });
    const cached = this.getCachedType(cacheKey);
    if (cached) {
      return ok(cached);
    }

    const hookResult = await this.pluginManager.executeHook({
      hookType: HookType.BeforeParse,
      input: { sourceFile: sourceFile.getFilePath(), typeName },
    });

    if (!hookResult.ok) {
      return hookResult;
    }

    const context: TypeFinderContext = { sourceFile, typeName, cacheKey };

    const foundType =
      (await this.findTypeInSourceFile(context)) ?? (await this.findTypeInModules(context));

    if (foundType) {
      return foundType;
    }

    return err(new Error(`Type '${typeName}' not found in ${sourceFile.getFilePath()}`));
  }

  /**
   * Resolve all import declarations in a source file to their corresponding SourceFile objects
   *
   * @param sourceFile The SourceFile to resolve imports for
   * @returns Result containing a Map of module specifier to resolved SourceFile, or an error
   * @example
   * ```typescript
   * const result = await parser.resolveImports(sourceFile);
   * if (result.ok) {
   *   for (const [specifier, resolvedFile] of result.value) {
   *     console.log(`${specifier} -> ${resolvedFile.getFilePath()}`);
   *   }
   * }
   * ```
   */
  async resolveImports(sourceFile: SourceFile): Promise<Result<Map<string, SourceFile>>> {
    const imports = new Map<string, SourceFile>();

    try {
      for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        const resolvedModule = importDecl.getModuleSpecifierSourceFile();

        if (resolvedModule) {
          imports.set(moduleSpecifier, resolvedModule);
        }
      }

      return ok(imports);
    } catch (error) {
      return err(new Error(`Failed to resolve imports: ${error}`));
    }
  }

  /**
   * Get the underlying ts-morph Project instance
   *
   * @returns The ts-morph Project instance used by this parser
   * @example
   * ```typescript
   * const project = parser.getProject();
   * const sourceFiles = project.getSourceFiles();
   * ```
   */
  getProject(): Project {
    return this.project;
  }

  /**
   * Clear all cached source files and types
   *
   * Useful when you want to force re-parsing of files or free up memory.
   * Note that this will clear both file and type caches.
   *
   * @example
   * ```typescript
   * parser.clearCache();
   * // All subsequent parseFile and findType calls will re-parse from disk
   * ```
   */
  clearCache(): void {
    this.cache.clear();
  }

  private getCachedSourceFile(path: string): CachedSourceFile {
    const cached = this.cache.getFile(path);
    return this.isSourceFile(cached) ? cached : undefined;
  }

  private getCachedType(cacheKey: string): CachedType {
    const cached = this.cache.getType(cacheKey);
    return this.isType(cached) ? cached : undefined;
  }

  private isSourceFile(value: unknown): value is SourceFile {
    return (
      value != null &&
      typeof value === 'object' &&
      'getFilePath' in value &&
      typeof (value as any).getFilePath === 'function'
    );
  }

  private isType(value: unknown): value is Type {
    return (
      value != null &&
      typeof value === 'object' &&
      'getSymbol' in value &&
      typeof (value as any).getSymbol === 'function'
    );
  }

  private async findTypeInSourceFile(
    context: TypeFinderContext,
  ): Promise<Result<Type> | undefined> {
    const { sourceFile } = context;
    const typeFinders = this.createTypeFinders(sourceFile);

    return this.tryTypeFinders({ typeFinders, context });
  }

  private async findTypeInModules(context: TypeFinderContext): Promise<Result<Type> | undefined> {
    const { sourceFile } = context;

    for (const moduleDecl of sourceFile.getModules()) {
      const typeFinders = this.createTypeFinders(moduleDecl);

      const found = await this.tryTypeFinders({ typeFinders, context });
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  private async tryTypeFinders({
    typeFinders,
    context,
  }: {
    readonly typeFinders: readonly TypeFinder[];
    readonly context: TypeFinderContext;
  }): Promise<Result<Type> | undefined> {
    const { typeName } = context;

    for (const finder of typeFinders) {
      const declaration = finder(typeName);
      if (declaration) {
        return this.processTypeDeclaration({ declaration, context });
      }
    }

    return undefined;
  }

  private async processTypeDeclaration({
    declaration,
    context,
  }: {
    readonly declaration: TypeDeclaration;
    readonly context: TypeFinderContext;
  }): Promise<Result<Type>> {
    const { sourceFile, typeName, cacheKey } = context;
    const type = declaration.getType();
    this.cache.setType(cacheKey, type);

    const afterHook = await this.pluginManager.executeHook({
      hookType: HookType.AfterParse,
      input: { sourceFile: sourceFile.getFilePath(), typeName },
      additionalArgs: [type],
    });

    return afterHook.ok ? ok(type) : afterHook;
  }

  private createTypeFinders(container: {
    getInterface(name: string): TypeDeclaration | undefined;
    getTypeAlias(name: string): TypeDeclaration | undefined;
    getEnum(name: string): TypeDeclaration | undefined;
    getClass(name: string): TypeDeclaration | undefined;
  }): TypeFinder[] {
    return [
      name => container.getInterface(name),
      name => container.getTypeAlias(name),
      name => container.getEnum(name),
      name => container.getClass(name),
    ];
  }
}
