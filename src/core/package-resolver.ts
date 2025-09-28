import path from 'node:path';
import fs from 'node:fs';
import type { Result } from './result.js';
import { ok, err } from './result.js';

export interface PackageManager {
  type: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  lockFile: string;
  workspaceSupport: boolean;
}

export interface MonorepoConfig {
  enabled: boolean;
  workspaceRoot?: string;
  dependencyResolutionStrategy?: 'auto' | 'workspace-root' | 'hoisted' | 'local-only';
  customPaths?: string[];
}

export interface PackageResolutionOptions {
  packageName: string;
  startPath: string;
  packageManager?: PackageManager;
  monorepoConfig?: MonorepoConfig;
}

export interface ResolvedPackage {
  path: string;
  packageJsonPath: string;
  typesPath?: string;
  declarationFiles: string[];
  isSymlink: boolean;
  resolvedFrom: 'local' | 'hoisted' | 'pnpm-store' | 'workspace-root';
}

interface PackageJson {
  name?: string;
  version?: string;
  types?: string;
  typings?: string;
  workspaces?: string[] | { packages: string[] };
  private?: boolean;
  [key: string]: unknown;
}

/**
 * Robust package resolver that handles monorepo scenarios including
 * pnpm workspaces, yarn workspaces, and various node_modules structures
 */
export class PackageResolver {
  private readonly maxTraversalDepth = 10;

  /**
   * Traverses up the directory tree from startPath, invoking callback at each level.
   * Stops when callback returns a non-null value or when reaching the filesystem root.
   *
   * @param startPath - Starting directory path
   * @param callback - Function called at each directory level
   * @returns Result from callback or null if not found
   */
  private traverseUpDirectories<T>(
    startPath: string,
    callback: (currentPath: string) => T | null,
  ): T | null {
    let currentPath = path.resolve(startPath);

    for (let i = 0; i < this.maxTraversalDepth; i++) {
      const result = callback(currentPath);
      if (result !== null) {
        return result;
      }

      const parent = path.dirname(currentPath);
      if (parent === currentPath) break;
      currentPath = parent;
    }

    return null;
  }

  /**
   * Async version of traverseUpDirectories.
   * Traverses up the directory tree from startPath, invoking async callback at each level.
   *
   * @param startPath - Starting directory path
   * @param callback - Async function called at each directory level
   * @returns Result from callback or null if not found
   */
  private async traverseUpDirectoriesAsync<T>(
    startPath: string,
    callback: (currentPath: string) => Promise<T | null>,
  ): Promise<T | null> {
    let currentPath = path.resolve(startPath);

    for (let i = 0; i < this.maxTraversalDepth; i++) {
      const result = await callback(currentPath);
      if (result !== null) {
        return result;
      }

      const parent = path.dirname(currentPath);
      if (parent === currentPath) break;
      currentPath = parent;
    }

    return null;
  }

  /**
   * Resolves a package following Node.js module resolution algorithm
   * with monorepo-aware enhancements and user configuration.
   *
   * @param options - Resolution options
   * @param options.packageName - Name of the package to resolve
   * @param options.startPath - Directory to start resolution from
   * @param options.packageManager - Package manager info (auto-detected if not provided)
   * @param options.monorepoConfig - Monorepo configuration for custom resolution strategies
   * @returns Result containing resolved package info or error
   */
  async resolvePackage({
    packageName,
    startPath,
    packageManager,
    monorepoConfig,
  }: PackageResolutionOptions): Promise<Result<ResolvedPackage>> {
    try {
      const detectedPackageManager = packageManager || (await this.detectPackageManager(startPath));

      // If user provided custom paths, try those first
      if (monorepoConfig?.customPaths) {
        for (const customPath of monorepoConfig.customPaths) {
          const result = await this.resolveFromCustomPath(packageName, customPath);
          if (result.ok) {
            return result;
          }
        }
      }

      // Use user-specified strategy or auto-detect
      const strategies = this.buildResolutionStrategies({
        packageName,
        startPath,
        detectedPackageManager,
        ...(monorepoConfig !== undefined && { monorepoConfig }),
      });

      for (const strategy of strategies) {
        const result = await strategy();
        if (result.ok) {
          return result;
        }
      }

      return err(new Error(`Package '${packageName}' not found from ${startPath}`));
    } catch (error) {
      return err(new Error(`Failed to resolve package '${packageName}': ${error}`));
    }
  }

  /**
   * Builds resolution strategies based on user configuration.
   * Returns ordered array of resolution functions to try in sequence.
   *
   * @param params - Strategy building parameters
   * @returns Array of resolution strategy functions
   */
  private buildResolutionStrategies({
    packageName,
    startPath,
    detectedPackageManager,
    monorepoConfig,
  }: {
    packageName: string;
    startPath: string;
    detectedPackageManager: PackageManager;
    monorepoConfig?: MonorepoConfig;
  }): Array<() => Promise<Result<ResolvedPackage>>> {
    const strategy = monorepoConfig?.dependencyResolutionStrategy || 'auto';

    switch (strategy) {
      case 'local-only':
        return [() => this.resolveLocal(packageName, startPath)];

      case 'workspace-root':
        if (monorepoConfig?.workspaceRoot) {
          return [
            () => this.resolveFromWorkspaceRoot(packageName, monorepoConfig.workspaceRoot!),
            () => this.resolveLocal(packageName, startPath),
          ];
        }
        // Fallback to auto if no workspace root specified
        return this.getAutoStrategies(packageName, startPath, detectedPackageManager);

      case 'hoisted':
        return [
          () => this.resolveHoisted(packageName, startPath),
          () => this.resolveLocal(packageName, startPath),
        ];

      case 'auto':
      default:
        return this.getAutoStrategies(packageName, startPath, detectedPackageManager);
    }
  }

  /**
   * Gets the automatic resolution strategies in order of precedence:
   * 1. Local node_modules
   * 2. Hoisted dependencies
   * 3. pnpm store
   * 4. Workspace root
   *
   * @param packageName - Name of the package
   * @param startPath - Starting directory
   * @param detectedPackageManager - Detected package manager
   * @returns Array of resolution strategy functions
   */
  private getAutoStrategies(
    packageName: string,
    startPath: string,
    detectedPackageManager: PackageManager,
  ): Array<() => Promise<Result<ResolvedPackage>>> {
    return [
      () => this.resolveLocal(packageName, startPath),
      () => this.resolveHoisted(packageName, startPath),
      () => this.resolvePnpmStore(packageName, startPath, detectedPackageManager),
      () => this.resolveWorkspaceRoot(packageName, startPath, detectedPackageManager),
    ];
  }

  /**
   * Detects the package manager by searching for lock files.
   * Checks for pnpm-lock.yaml, yarn.lock, and package-lock.json.
   *
   * @param startPath - Directory to start detection from
   * @returns Package manager info with type and workspace support
   */
  async detectPackageManager(startPath: string): Promise<PackageManager> {
    const result = this.traverseUpDirectories(startPath, currentPath => {
      const pnpmLock = path.join(currentPath, 'pnpm-lock.yaml');
      const yarnLock = path.join(currentPath, 'yarn.lock');
      const npmLock = path.join(currentPath, 'package-lock.json');

      if (fs.existsSync(pnpmLock)) {
        return { type: 'pnpm' as const, lockFile: pnpmLock, workspaceSupport: true };
      }
      if (fs.existsSync(yarnLock)) {
        return { type: 'yarn' as const, lockFile: yarnLock, workspaceSupport: true };
      }
      if (fs.existsSync(npmLock)) {
        return { type: 'npm' as const, lockFile: npmLock, workspaceSupport: false };
      }

      return null;
    });

    return result ?? { type: 'unknown', lockFile: '', workspaceSupport: false };
  }

  /**
   * Resolves package from local node_modules directory.
   * This is the standard Node.js resolution for direct dependencies.
   *
   * @param packageName - Name of the package
   * @param startPath - Directory containing node_modules
   * @returns Result with resolved package or error
   */
  private async resolveLocal(
    packageName: string,
    startPath: string,
  ): Promise<Result<ResolvedPackage>> {
    const nodeModulesPath = path.join(startPath, 'node_modules', packageName);

    if (!fs.existsSync(nodeModulesPath)) {
      return err(new Error(`Package not found in local node_modules`));
    }

    return this.analyzePackage(nodeModulesPath, 'local');
  }

  /**
   * Resolves package from hoisted dependencies by walking up the directory tree.
   * Searches each parent directory's node_modules until package is found.
   *
   * @param packageName - Name of the package
   * @param startPath - Directory to start search from
   * @returns Result with resolved package or error
   */
  private async resolveHoisted(
    packageName: string,
    startPath: string,
  ): Promise<Result<ResolvedPackage>> {
    const result = await this.traverseUpDirectoriesAsync(startPath, async currentPath => {
      const nodeModulesPath = path.join(currentPath, 'node_modules', packageName);

      if (fs.existsSync(nodeModulesPath)) {
        const analysisResult = await this.analyzePackage(nodeModulesPath, 'hoisted');
        if (analysisResult.ok) {
          return analysisResult;
        }
      }

      return null;
    });

    return result ?? err(new Error(`Package not found in hoisted dependencies`));
  }

  /**
   * Resolves package from pnpm store structure.
   * Searches node_modules/.pnpm for package@version directories.
   *
   * @param packageName - Name of the package
   * @param startPath - Directory to start search from
   * @param packageManager - Must be pnpm type
   * @returns Result with resolved package or error
   */
  private async resolvePnpmStore(
    packageName: string,
    startPath: string,
    packageManager: PackageManager,
  ): Promise<Result<ResolvedPackage>> {
    if (packageManager.type !== 'pnpm') {
      return err(new Error(`Not a pnpm project`));
    }

    const result = await this.traverseUpDirectoriesAsync(startPath, async currentPath => {
      const pnpmStorePath = path.join(currentPath, 'node_modules', '.pnpm');

      if (fs.existsSync(pnpmStorePath)) {
        const storeResult = await this.searchPnpmStore(pnpmStorePath, packageName);
        if (storeResult.ok) {
          return storeResult;
        }
      }

      return null;
    });

    return result ?? err(new Error(`Package not found in pnpm store`));
  }

  /**
   * Searches for package in pnpm store directory.
   * Handles both regular and scoped package naming conventions.
   *
   * @param pnpmStorePath - Path to .pnpm directory
   * @param packageName - Name of the package
   * @returns Result with resolved package or error
   */
  private async searchPnpmStore(
    pnpmStorePath: string,
    packageName: string,
  ): Promise<Result<ResolvedPackage>> {
    try {
      const entries = fs.readdirSync(pnpmStorePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // pnpm store format: package@version or @scope+package@version
          const entryName = entry.name;

          // Check if this entry corresponds to our package
          if (this.isPnpmEntryForPackage(entryName, packageName)) {
            const packagePath = path.join(pnpmStorePath, entryName, 'node_modules', packageName);

            if (fs.existsSync(packagePath)) {
              return this.analyzePackage(packagePath, 'pnpm-store');
            }
          }
        }
      }

      return err(new Error(`Package not found in pnpm store`));
    } catch (error) {
      return err(new Error(`Failed to search pnpm store: ${error}`));
    }
  }

  /**
   * Checks if a pnpm store entry name matches the target package.
   * Handles version suffixes and scoped package naming (@scope+package).
   *
   * @param entryName - Directory name from .pnpm store
   * @param packageName - Target package name
   * @returns True if entry matches package
   * @example
   * isPnpmEntryForPackage('react@18.0.0', 'react') // => true
   * isPnpmEntryForPackage('@types+node@20.0.0', '@types/node') // => true
   */
  private isPnpmEntryForPackage(entryName: string, packageName: string): boolean {
    // Remove version suffix (everything after @version)
    const withoutVersion = entryName.replace(/@[^@]+$/, '');

    // Handle scoped packages (@scope/package becomes @scope+package in pnpm store)
    const normalizedEntry = withoutVersion.replace(/\+/g, '/');

    return normalizedEntry === packageName;
  }

  /**
   * Resolves package from workspace root by first finding the workspace,
   * then looking in its node_modules.
   *
   * @param packageName - Name of the package
   * @param startPath - Directory to start search from
   * @param packageManager - Package manager with workspace support
   * @returns Result with resolved package or error
   */
  private async resolveWorkspaceRoot(
    packageName: string,
    startPath: string,
    packageManager: PackageManager,
  ): Promise<Result<ResolvedPackage>> {
    if (!packageManager.workspaceSupport) {
      return err(new Error(`Package manager doesn't support workspaces`));
    }

    const workspaceRoot = await this.findWorkspaceRoot(startPath, packageManager);
    if (!workspaceRoot.ok) {
      return workspaceRoot;
    }

    return this.resolveFromWorkspaceRoot(packageName, workspaceRoot.value);
  }

  /**
   * Resolves package from a user-specified workspace root path.
   *
   * @param packageName - Name of the package
   * @param workspaceRoot - Absolute path to workspace root
   * @returns Result with resolved package or error
   */
  private async resolveFromWorkspaceRoot(
    packageName: string,
    workspaceRoot: string,
  ): Promise<Result<ResolvedPackage>> {
    const nodeModulesPath = path.join(workspaceRoot, 'node_modules', packageName);

    if (!fs.existsSync(nodeModulesPath)) {
      return err(new Error(`Package not found in specified workspace root`));
    }

    return this.analyzePackage(nodeModulesPath, 'workspace-root');
  }

  /**
   * Resolves package from a custom path provided by user.
   * Path can be either direct to package or to a node_modules directory.
   *
   * @param packageName - Name of the package
   * @param customPath - Custom path to search
   * @returns Result with resolved package or error
   */
  private async resolveFromCustomPath(
    packageName: string,
    customPath: string,
  ): Promise<Result<ResolvedPackage>> {
    let packagePath: string;

    if (path.basename(customPath) === packageName) {
      packagePath = customPath;
    } else {
      packagePath = path.join(customPath, packageName);
    }

    if (!fs.existsSync(packagePath)) {
      return err(new Error(`Package not found in custom path`));
    }

    return this.analyzePackage(packagePath, 'local');
  }

  /**
   * Finds workspace root by searching for workspace configuration.
   * Looks for workspaces field in package.json or workspace config files.
   *
   * @param startPath - Directory to start search from
   * @param packageManager - Package manager to check workspace config for
   * @returns Result with workspace root path or error
   */
  private async findWorkspaceRoot(
    startPath: string,
    packageManager: PackageManager,
  ): Promise<Result<string>> {
    const result = this.traverseUpDirectories(startPath, currentPath => {
      const packageJsonPath = path.join(currentPath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

          if (this.hasWorkspaceConfig(packageJson, packageManager)) {
            return ok(currentPath);
          }
        } catch {
          return null;
        }
      }

      return null;
    });

    return result ?? err(new Error(`Workspace root not found`));
  }

  /**
   * Checks if package.json contains workspace configuration.
   * Checks for workspaces field and package manager specific config files.
   *
   * @param packageJson - Parsed package.json content
   * @param packageManager - Package manager to check config for
   * @returns True if workspace configuration is present
   */
  private hasWorkspaceConfig(packageJson: PackageJson, packageManager: PackageManager): boolean {
    switch (packageManager.type) {
      case 'pnpm':
        return (
          !!packageJson.workspaces ||
          fs.existsSync(path.join(path.dirname(packageManager.lockFile), 'pnpm-workspace.yaml'))
        );
      case 'yarn':
        return !!packageJson.workspaces || packageJson.private === true;
      default:
        return false;
    }
  }

  /**
   * Analyzes a resolved package path and extracts TypeScript type information.
   * Reads package.json, detects symlinks, and finds declaration files.
   *
   * @param packagePath - Absolute path to package directory
   * @param resolvedFrom - Source of resolution (local, hoisted, etc.)
   * @returns Result with package analysis or error
   */
  private async analyzePackage(
    packagePath: string,
    resolvedFrom: ResolvedPackage['resolvedFrom'],
  ): Promise<Result<ResolvedPackage>> {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        return err(new Error(`No package.json found at ${packagePath}`));
      }

      const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const isSymlink = fs.lstatSync(packagePath).isSymbolicLink();

      const typesPath = this.findTypesEntry(packagePath, packageJson);

      const declarationFiles = await this.findDeclarationFiles(packagePath);

      const resolvedPackage: ResolvedPackage = {
        path: packagePath,
        packageJsonPath,
        ...(typesPath !== undefined && { typesPath }),
        declarationFiles,
        isSymlink,
        resolvedFrom,
      };

      return ok(resolvedPackage);
    } catch (error) {
      return err(new Error(`Failed to analyze package at ${packagePath}: ${error}`));
    }
  }

  /**
   * Finds the TypeScript types entry point from package.json.
   * Checks both 'types' and 'typings' fields.
   *
   * @param packagePath - Path to package directory
   * @param packageJson - Parsed package.json
   * @returns Absolute path to types file or undefined
   */
  private findTypesEntry(packagePath: string, packageJson: PackageJson): string | undefined {
    const typesEntry = packageJson.types || packageJson.typings;

    if (typesEntry) {
      const typesPath = path.resolve(packagePath, typesEntry);
      if (fs.existsSync(typesPath)) {
        return typesPath;
      }
    }

    return undefined;
  }

  /**
   * Finds all TypeScript declaration files (.d.ts) in the package.
   * Uses glob if available, falls back to sync traversal.
   *
   * @param packagePath - Path to package directory
   * @returns Array of absolute paths to declaration files
   */
  private async findDeclarationFiles(packagePath: string): Promise<string[]> {
    const declarationFiles: string[] = [];

    try {
      const { glob } = await import('glob');
      const dtsFiles = await glob(`${packagePath}/**/*.d.ts`, {
        ignore: ['**/node_modules/**'],
        absolute: true,
      });

      declarationFiles.push(...dtsFiles);
    } catch {
      // Fallback to simple fs traversal if glob fails
      this.findDeclarationFilesSync(packagePath, declarationFiles);
    }

    return declarationFiles;
  }

  /**
   * Synchronous fallback for finding declaration files via directory traversal.
   * Recursively searches directories, skipping node_modules.
   *
   * @param dir - Directory to search
   * @param result - Accumulator array for found files
   */
  private findDeclarationFilesSync(dir: string, result: string[]): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && entry.name !== 'node_modules') {
          this.findDeclarationFilesSync(fullPath, result);
        } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
          result.push(fullPath);
        }
      }
    } catch {
      // Ignore errors and continue
    }
  }
}
