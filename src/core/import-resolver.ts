import path from 'node:path';
import type { Result } from './result.js';
import { ok, err } from './result.js';

export interface ImportInfo {
  readonly isRelative: boolean;
  readonly isNodeModule: boolean;
  readonly moduleName: string;
  readonly packageName?: string | undefined;
  readonly scopedPackage?: string | undefined;
  readonly subPath?: string | undefined;
}

export interface ImportResolutionOptions {
  readonly importPath: string;
}

export interface FormatImportPathOptions {
  readonly info: ImportInfo;
  readonly sourceFilePath: string;
}

/**
 * Validation result for import paths
 */
interface ImportPathValidation {
  readonly isValid: boolean;
  readonly errorMessage?: string;
}

export class ImportResolver {
  resolve({ importPath }: ImportResolutionOptions): Result<ImportInfo> {
    try {
      const validation = this.validateImportPath(importPath);
      if (!validation.isValid) {
        return err(new Error(validation.errorMessage || 'Invalid import path'));
      }

      const isRelative = this.isRelativePath(importPath);
      const isAbsolute = path.isAbsolute(importPath);
      const isNodeModule = !isRelative && !isAbsolute && !this.isWindowsPath(importPath);

      if (isRelative) {
        return this.resolveRelativeImport(importPath);
      }

      if (isNodeModule) {
        return this.resolveNodeModule(importPath);
      }

      // Handle absolute paths and other cases
      return this.resolveAbsoluteOrOtherPath(importPath);
    } catch (error) {
      return err(new Error(`Failed to resolve import: ${error}`));
    }
  }

  /**
   * Validates an import path for basic correctness
   */
  private validateImportPath(importPath: string): ImportPathValidation {
    if (typeof importPath !== 'string') {
      return { isValid: false, errorMessage: 'Import path must be a string' };
    }

    if (importPath.trim() === '') {
      return { isValid: false, errorMessage: 'Import path cannot be empty' };
    }

    // Check for incomplete scoped packages
    if (importPath === '@' || (importPath.startsWith('@') && !importPath.includes('/'))) {
      return {
        isValid: false,
        errorMessage: `Invalid scoped package: ${importPath}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Checks if a path is a relative import
   */
  private isRelativePath(importPath: string): boolean {
    return (
      importPath.startsWith('./') ||
      importPath.startsWith('../') ||
      importPath === '.' ||
      importPath === '..'
    );
  }

  /**
   * Checks if a path looks like a Windows absolute path
   */
  private isWindowsPath(importPath: string): boolean {
    return /^[A-Za-z]:[/\\]/.test(importPath);
  }

  /**
   * Resolves a relative import path
   */
  private resolveRelativeImport(importPath: string): Result<ImportInfo> {
    return ok({
      isRelative: true,
      isNodeModule: false,
      moduleName: this.extractModuleName(importPath),
    });
  }

  /**
   * Resolves absolute paths and other non-standard imports
   */
  private resolveAbsoluteOrOtherPath(importPath: string): Result<ImportInfo> {
    return ok({
      isRelative: false,
      isNodeModule: false,
      moduleName: this.extractModuleName(importPath),
    });
  }

  /**
   * Resolves a node module import path
   */
  private resolveNodeModule(importPath: string): Result<ImportInfo> {
    // Clean up trailing slashes for consistent processing
    const cleanedPath = importPath.replace(/\/$/, '');
    const parts = cleanedPath.split('/');

    let packageName: string;
    let scopedPackage: string | undefined = undefined;
    let subPath: string | undefined = undefined;

    if (cleanedPath.startsWith('@')) {
      if (parts.length < 2 || parts[1] === '') {
        return err(new Error(`Invalid scoped package: ${importPath}`));
      }
      scopedPackage = parts[0];
      packageName = `${parts[0]}/${parts[1]}`;
      if (parts.length > 2) {
        subPath = parts.slice(2).join('/');
      }
    } else {
      const firstPart = parts[0];
      if (!firstPart) {
        return err(new Error(`Invalid package name: ${importPath}`));
      }
      packageName = firstPart;
      if (parts.length > 1) {
        subPath = parts.slice(1).join('/');
      }
    }

    const moduleName = this.extractNodeModuleName({
      packageName,
      ...(subPath !== undefined && { subPath }),
    });

    const result: ImportInfo = {
      isRelative: false,
      isNodeModule: true,
      moduleName,
      packageName,
      scopedPackage,
      subPath,
    };

    return ok(result);
  }

  /**
   * Extracts a module name from node module information
   * Uses a consistent strategy for all packages regardless of scope
   */
  private extractNodeModuleName({
    packageName,
    subPath,
  }: {
    packageName: string;
    subPath?: string;
  }): string {
    if (subPath) {
      const subModuleName = path.basename(subPath, path.extname(subPath));
      return this.toValidIdentifier(subModuleName);
    }

    const lastPart = packageName.split('/').pop();
    if (!lastPart) {
      return 'Module';
    }
    return this.toValidIdentifier(lastPart);
  }

  private extractModuleName(importPath: string): string {
    const baseName = path.basename(importPath, path.extname(importPath));
    return this.toValidIdentifier(baseName);
  }

  private toValidIdentifier(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, '_');

    if (/^[0-9]/.test(cleaned)) {
      return `_${cleaned}`;
    }

    return cleaned || 'Module';
  }

  /**
   * Formats an import path for code generation
   * Uses consistent formatting for all package types
   */
  formatImportPath({ info, sourceFilePath }: FormatImportPathOptions): string {
    if (info.isNodeModule) {
      return this.formatNodeModuleImport(info);
    }

    if (info.isRelative) {
      return this.formatRelativeImport({ info, sourceFilePath });
    }

    return info.moduleName;
  }

  /**
   * Formats node module imports
   */
  private formatNodeModuleImport(info: ImportInfo): string {
    if (!info.packageName) {
      return info.moduleName;
    }

    return info.packageName + (info.subPath ? `/${info.subPath}` : '');
  }

  /**
   * Formats relative imports
   */
  private formatRelativeImport({
    info,
    sourceFilePath,
  }: {
    info: ImportInfo;
    sourceFilePath: string;
  }): string {
    const resolvedPath = path.resolve(path.dirname(sourceFilePath), info.moduleName);
    const ext = path.extname(resolvedPath);

    if (ext === '.ts' || ext === '.tsx') {
      return resolvedPath.replace(/\.(ts|tsx)$/, '.js');
    }

    return resolvedPath;
  }
}
