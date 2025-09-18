import { Project, SourceFile, Type } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { TypeResolutionCache } from "../core/cache.js";
import { PluginManager, HookType } from "../core/plugin.js";
import path from "node:path";

export interface ParserOptions {
  readonly tsConfigPath?: string;
  readonly cache?: TypeResolutionCache;
  readonly pluginManager?: PluginManager;
}

export class TypeScriptParser {
  private readonly project: Project;
  private readonly cache: TypeResolutionCache;
  private readonly pluginManager: PluginManager;

  constructor(options: ParserOptions = {}) {
    this.project = new Project({
      ...(options.tsConfigPath && { tsConfigFilePath: options.tsConfigPath }),
      skipAddingFilesFromTsConfig: !options.tsConfigPath,
    });

    this.cache = options.cache ?? new TypeResolutionCache();
    this.pluginManager = options.pluginManager ?? new PluginManager();
  }

  async parseFile(filePath: string): Promise<Result<SourceFile>> {
    try {
      const absolutePath = path.resolve(filePath);

      const cached = this.cache.getFile(absolutePath) as SourceFile | undefined;
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

  async findType(
    sourceFile: SourceFile,
    typeName: string,
  ): Promise<Result<Type>> {
    const cacheKey = this.cache.getCacheKey(sourceFile.getFilePath(), typeName);
    const cached = this.cache.getType(cacheKey) as Type | undefined;
    if (cached) {
      return ok(cached);
    }

    const hookResult = await this.pluginManager.executeHook(
      HookType.BeforeParse,
      { sourceFile: sourceFile.getFilePath(), typeName },
    );

    if (!hookResult.ok) {
      return hookResult;
    }

    const interfaceDecl = sourceFile.getInterface(typeName);
    if (interfaceDecl) {
      const type = interfaceDecl.getType();
      this.cache.setType(cacheKey, type);

      const afterHook = await this.pluginManager.executeHook(
        HookType.AfterParse,
        { sourceFile: sourceFile.getFilePath(), typeName },
        type,
      );

      return afterHook.ok ? ok(type) : afterHook;
    }

    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      const type = typeAlias.getType();
      this.cache.setType(cacheKey, type);

      const afterHook = await this.pluginManager.executeHook(
        HookType.AfterParse,
        { sourceFile: sourceFile.getFilePath(), typeName },
        type,
      );

      return afterHook.ok ? ok(type) : afterHook;
    }

    const enumDecl = sourceFile.getEnum(typeName);
    if (enumDecl) {
      const type = enumDecl.getType();
      this.cache.setType(cacheKey, type);

      const afterHook = await this.pluginManager.executeHook(
        HookType.AfterParse,
        { sourceFile: sourceFile.getFilePath(), typeName },
        type,
      );

      return afterHook.ok ? ok(type) : afterHook;
    }

    const classDecl = sourceFile.getClass(typeName);
    if (classDecl) {
      const type = classDecl.getType();
      this.cache.setType(cacheKey, type);

      const afterHook = await this.pluginManager.executeHook(
        HookType.AfterParse,
        { sourceFile: sourceFile.getFilePath(), typeName },
        type,
      );

      return afterHook.ok ? ok(type) : afterHook;
    }

    // Look for types inside module declarations
    for (const moduleDecl of sourceFile.getModules()) {
      const interfaceDecl = moduleDecl.getInterface(typeName);
      if (interfaceDecl) {
        const type = interfaceDecl.getType();
        this.cache.setType(cacheKey, type);

        const afterHook = await this.pluginManager.executeHook(
          HookType.AfterParse,
          { sourceFile: sourceFile.getFilePath(), typeName },
          type,
        );

        return afterHook.ok ? ok(type) : afterHook;
      }

      const typeAlias = moduleDecl.getTypeAlias(typeName);
      if (typeAlias) {
        const type = typeAlias.getType();
        this.cache.setType(cacheKey, type);

        const afterHook = await this.pluginManager.executeHook(
          HookType.AfterParse,
          { sourceFile: sourceFile.getFilePath(), typeName },
          type,
        );

        return afterHook.ok ? ok(type) : afterHook;
      }

      const enumDecl = moduleDecl.getEnum(typeName);
      if (enumDecl) {
        const type = enumDecl.getType();
        this.cache.setType(cacheKey, type);

        const afterHook = await this.pluginManager.executeHook(
          HookType.AfterParse,
          { sourceFile: sourceFile.getFilePath(), typeName },
          type,
        );

        return afterHook.ok ? ok(type) : afterHook;
      }

      const classDecl = moduleDecl.getClass(typeName);
      if (classDecl) {
        const type = classDecl.getType();
        this.cache.setType(cacheKey, type);

        const afterHook = await this.pluginManager.executeHook(
          HookType.AfterParse,
          { sourceFile: sourceFile.getFilePath(), typeName },
          type,
        );

        return afterHook.ok ? ok(type) : afterHook;
      }
    }

    return err(
      new Error(`Type '${typeName}' not found in ${sourceFile.getFilePath()}`),
    );
  }

  async resolveImports(
    sourceFile: SourceFile,
  ): Promise<Result<Map<string, SourceFile>>> {
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

}
