import path from 'node:path';
import type { Result } from './result.js';
import { ok, err } from './result.js';
import { formatError } from './utils/error-utils.js';

/**
 * Information about a resolved import path.
 *
 * @property isRelative - Whether the import is a relative path (e.g., './utils')
 * @property isNodeModule - Whether the import is a node_modules package
 * @property moduleName - Valid JavaScript identifier extracted from the import
 * @property originalPath - The original import path as provided
 * @property packageName - Full package name for node modules (e.g., '@babel/core')
 * @property scopedPackage - Scope portion for scoped packages (e.g., '@babel')
 * @property subPath - Subpath within a package (e.g., 'get' from 'lodash/get')
 */
export interface ImportInfo {
  readonly isRelative: boolean;
  readonly isNodeModule: boolean;
  readonly moduleName: string;
  readonly originalPath: string;
  readonly packageName?: string | undefined;
  readonly scopedPackage?: string | undefined;
  readonly subPath?: string | undefined;
}

/**
 * Options for resolving an import path.
 *
 * @property importPath - The import path to resolve
 */
export interface ImportResolutionOptions {
  readonly importPath: string;
}

/**
 * Options for formatting an import path for code generation.
 *
 * @property info - Import information from resolve()
 * @property sourceFilePath - Path to the file containing the import
 */
export interface FormatImportPathOptions {
  readonly info: ImportInfo;
  readonly sourceFilePath: string;
}

interface ImportPathValidation {
  readonly isValid: boolean;
  readonly errorMessage?: string;
}

/**
 * Resolves and analyzes import paths for TypeScript/JavaScript modules.
 *
 * Handles:
 * - Relative imports (./file, ../dir/file)
 * - Node modules (lodash, @babel/core)
 * - Scoped packages with subpaths (@types/node/fs)
 * - Absolute paths and Windows paths
 */
export class ImportResolver {
  /**
   * Resolves an import path into structured information.
   *
   * @param options - Resolution options
   * @returns Result containing ImportInfo on success, Error on failure
   *
   * @example
   * ```ts
   * const resolver = new ImportResolver();
   * const result = resolver.resolve({ importPath: '@babel/core' });
   * if (isOk(result)) {
   *   console.log(result.value.packageName); // '@babel/core'
   *   console.log(result.value.moduleName);  // 'core'
   * }
   * ```
   */
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

      return this.resolveAbsoluteOrOtherPath(importPath);
    } catch (error) {
      return err(new Error(`Failed to resolve import: ${formatError(error)}`));
    }
  }

  private validateImportPath(importPath: string): ImportPathValidation {
    if (typeof importPath !== 'string') {
      return { isValid: false, errorMessage: 'Import path must be a string' };
    }

    if (importPath.trim() === '') {
      return { isValid: false, errorMessage: 'Import path cannot be empty' };
    }

    if (importPath === '@' || (importPath.startsWith('@') && !importPath.includes('/'))) {
      return {
        isValid: false,
        errorMessage: `Invalid scoped package: ${importPath}`,
      };
    }

    return { isValid: true };
  }

  private isRelativePath(importPath: string): boolean {
    return (
      importPath.startsWith('./') ||
      importPath.startsWith('../') ||
      importPath === '.' ||
      importPath === '..'
    );
  }

  private isWindowsPath(importPath: string): boolean {
    return /^[A-Za-z]:[/\\]/.test(importPath);
  }

  private resolveRelativeImport(importPath: string): Result<ImportInfo> {
    return ok({
      isRelative: true,
      isNodeModule: false,
      moduleName: this.extractModuleName(importPath),
      originalPath: importPath,
    });
  }

  private resolveAbsoluteOrOtherPath(importPath: string): Result<ImportInfo> {
    return ok({
      isRelative: false,
      isNodeModule: false,
      moduleName: this.extractModuleName(importPath),
      originalPath: importPath,
    });
  }

  private resolveNodeModule(importPath: string): Result<ImportInfo> {
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
      originalPath: importPath,
      packageName,
      scopedPackage,
      subPath,
    };

    return ok(result);
  }

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
   * Formats an import path for code generation.
   *
   * For node modules, returns the package name with subpath.
   * For relative imports, converts to absolute path and replaces .ts/.tsx with .js.
   *
   * @param options - Formatting options
   * @returns Formatted import path suitable for code generation
   *
   * @example
   * ```ts
   * const resolver = new ImportResolver();
   * const result = resolver.resolve({ importPath: './utils.ts' });
   * if (isOk(result)) {
   *   const formatted = resolver.formatImportPath({
   *     info: result.value,
   *     sourceFilePath: '/src/components/Button.ts'
   *   });
   *   console.log(formatted); // '/src/components/utils.js'
   * }
   * ```
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

  private formatNodeModuleImport(info: ImportInfo): string {
    if (!info.packageName) {
      return info.moduleName;
    }

    return info.packageName + (info.subPath ? `/${info.subPath}` : '');
  }

  private formatRelativeImport({
    info,
    sourceFilePath,
  }: {
    info: ImportInfo;
    sourceFilePath: string;
  }): string {
    const resolvedPath = path.resolve(path.dirname(sourceFilePath), info.originalPath);
    const ext = path.extname(resolvedPath);

    if (ext === '.ts' || ext === '.tsx') {
      return resolvedPath.replace(/\.(ts|tsx)$/, '.js');
    }

    return resolvedPath;
  }
}
