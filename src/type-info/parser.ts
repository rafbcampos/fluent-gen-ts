import { Project, SourceFile, Type, ts } from 'ts-morph';
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
  private readonly monorepoConfig?: MonorepoConfig;

  constructor(options: ParserOptions = {}) {
    const projectOptions: any = {
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
    if (options.monorepoConfig !== undefined) {
      (this as unknown as { monorepoConfig?: MonorepoConfig }).monorepoConfig =
        options.monorepoConfig;
    }
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
  ): Promise<Result<void>> {
    try {
      const packageManager = await this.packageResolver.detectPackageManager(projectRoot);
      const loadedPackages: string[] = [];
      const failedPackages: string[] = [];

      for (const packageName of packageNames) {
        console.log(`Resolving package: ${packageName}`);

        const resolveResult = await this.packageResolver.resolvePackage({
          packageName,
          startPath: projectRoot,
          packageManager,
          ...(this.monorepoConfig !== undefined && { monorepoConfig: this.monorepoConfig }),
        });

        if (!resolveResult.ok) {
          console.warn(
            `Failed to resolve package '${packageName}': ${resolveResult.error.message}`,
          );
          failedPackages.push(packageName);
          continue;
        }

        const resolvedPackage = resolveResult.value;
        console.log(
          `Package '${packageName}' resolved from ${resolvedPackage.resolvedFrom} at: ${resolvedPackage.path}`,
        );

        let typesLoaded = false;

        // Load primary types entry if available
        if (resolvedPackage.typesPath) {
          try {
            console.log(`Loading types from: ${resolvedPackage.typesPath}`);
            this.project.addSourceFileAtPath(resolvedPackage.typesPath);
            typesLoaded = true;
          } catch (error) {
            console.warn(`Failed to load types from ${resolvedPackage.typesPath}: ${error}`);
          }
        }

        // Load declaration files as fallback or supplement
        if (resolvedPackage.declarationFiles.length > 0) {
          let filesLoaded = 0;
          for (const dtsFile of resolvedPackage.declarationFiles) {
            try {
              this.project.addSourceFileAtPath(dtsFile);
              filesLoaded++;
            } catch (error) {
              console.warn(`Failed to load declaration file ${dtsFile}: ${error}`);
            }
          }

          if (filesLoaded > 0) {
            console.log(`Loaded ${filesLoaded} declaration files for package '${packageName}'`);
            typesLoaded = true;
          }
        }

        if (typesLoaded) {
          loadedPackages.push(packageName);
        } else {
          console.warn(`No TypeScript definitions found for package '${packageName}'`);
          failedPackages.push(packageName);
        }
      }

      // Log summary
      if (loadedPackages.length > 0) {
        console.log(`Successfully loaded external dependencies: ${loadedPackages.join(', ')}`);
      }
      if (failedPackages.length > 0) {
        console.warn(`Failed to load external dependencies: ${failedPackages.join(', ')}`);
      }

      return ok(undefined);
    } catch (error) {
      return err(new Error(`Failed to load external dependencies: ${error}`));
    }
  }

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

  getProject(): Project {
    return this.project;
  }

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
    return value != null && typeof value === 'object' && 'getFilePath' in value;
  }

  private isType(value: unknown): value is Type {
    return value != null && typeof value === 'object' && 'getSymbol' in value;
  }

  private async findTypeInSourceFile(
    context: TypeFinderContext,
  ): Promise<Result<Type> | undefined> {
    const { sourceFile } = context;
    const typeFinders: TypeFinder[] = [
      name => sourceFile.getInterface(name),
      name => sourceFile.getTypeAlias(name),
      name => sourceFile.getEnum(name),
      name => sourceFile.getClass(name),
    ];

    return this.tryTypeFinders({ typeFinders, context });
  }

  private async findTypeInModules(context: TypeFinderContext): Promise<Result<Type> | undefined> {
    const { sourceFile } = context;

    for (const moduleDecl of sourceFile.getModules()) {
      const typeFinders: TypeFinder[] = [
        name => moduleDecl.getInterface(name),
        name => moduleDecl.getTypeAlias(name),
        name => moduleDecl.getEnum(name),
        name => moduleDecl.getClass(name),
      ];

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
}
