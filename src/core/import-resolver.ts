import path from "node:path";
import type { Result } from "./result.js";
import { ok, err } from "./result.js";

export interface ImportInfo {
  readonly isRelative: boolean;
  readonly isNodeModule: boolean;
  readonly isTypeDefinition: boolean;
  readonly moduleName: string;
  readonly packageName?: string | undefined;
  readonly scopedPackage?: string | undefined;
  readonly subPath?: string | undefined;
}

export interface ImportResolutionOptions {
  readonly sourceFile: string;
  readonly importPath: string;
}

export class ImportResolver {
  resolve({ importPath }: ImportResolutionOptions): Result<ImportInfo> {
    try {
      const isRelative = this.isRelativePath(importPath);
      const isNodeModule = !isRelative && !path.isAbsolute(importPath);

      if (isRelative) {
        return ok({
          isRelative: true,
          isNodeModule: false,
          isTypeDefinition: false,
          moduleName: this.extractModuleName(importPath),
        });
      }

      if (isNodeModule) {
        return this.resolveNodeModule(importPath);
      }

      return ok({
        isRelative: false,
        isNodeModule: false,
        isTypeDefinition: false,
        moduleName: this.extractModuleName(importPath),
      });
    } catch (error) {
      return err(new Error(`Failed to resolve import: ${error}`));
    }
  }

  private isRelativePath(importPath: string): boolean {
    return (
      importPath.startsWith("./") ||
      importPath.startsWith("../") ||
      importPath === "." ||
      importPath === ".."
    );
  }

  private resolveNodeModule(importPath: string): Result<ImportInfo> {
    const parts = importPath.split("/");
    let packageName: string;
    let scopedPackage: string | undefined = undefined;
    let subPath: string | undefined = undefined;

    if (importPath.startsWith("@")) {
      if (parts.length < 2) {
        return err(new Error(`Invalid scoped package: ${importPath}`));
      }
      scopedPackage = parts[0];
      packageName = `${parts[0]}/${parts[1]}`;
      if (parts.length > 2) {
        subPath = parts.slice(2).join("/");
      }
    } else {
      packageName = parts[0] || "";
      if (parts.length > 1) {
        subPath = parts.slice(1).join("/");
      }
    }

    const isTypeDefinition = this.isTypeDefinitionPackage(packageName);
    const moduleName = this.extractNodeModuleName(packageName, subPath);

    const result: ImportInfo = {
      isRelative: false,
      isNodeModule: true,
      isTypeDefinition,
      moduleName,
      packageName: packageName || undefined,
      scopedPackage,
      subPath,
    };

    return ok(result);
  }

  private isTypeDefinitionPackage(packageName: string): boolean {
    return packageName.startsWith("@types/");
  }

  private extractNodeModuleName(packageName: string, subPath?: string): string {
    if (this.isTypeDefinitionPackage(packageName)) {
      const baseModule = packageName.replace("@types/", "");
      return subPath || baseModule;
    }

    if (subPath) {
      const subModuleName = path.basename(subPath, path.extname(subPath));
      return this.toValidIdentifier(subModuleName);
    }

    const lastPart = packageName.split("/").pop() || "Module";
    return this.toValidIdentifier(lastPart);
  }

  private extractModuleName(importPath: string): string {
    const baseName = path.basename(importPath, path.extname(importPath));
    return this.toValidIdentifier(baseName);
  }

  private toValidIdentifier(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, "_");

    if (/^[0-9]/.test(cleaned)) {
      return `_${cleaned}`;
    }

    return cleaned || "Module";
  }

  formatImportPath(info: ImportInfo, sourceFilePath: string): string {
    if (info.isTypeDefinition && info.packageName) {
      const runtimeModule = info.packageName.replace("@types/", "");

      if (runtimeModule === "node" && info.subPath) {
        return `node:${info.subPath.replace(/\.d$/, "")}`;
      }

      return runtimeModule;
    }

    if (info.isNodeModule && info.packageName) {
      return info.packageName + (info.subPath ? `/${info.subPath}` : "");
    }

    if (info.isRelative) {
      const resolvedPath = path.resolve(
        path.dirname(sourceFilePath),
        info.moduleName,
      );
      const ext = path.extname(resolvedPath);

      if (ext === ".ts" || ext === ".tsx") {
        return resolvedPath.replace(/\.(ts|tsx)$/, ".js");
      }

      return resolvedPath;
    }

    return info.moduleName;
  }
}
