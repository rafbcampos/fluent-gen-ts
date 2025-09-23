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

/**
 * Robust package resolver that handles monorepo scenarios including
 * pnpm workspaces, yarn workspaces, and various node_modules structures
 */
export class PackageResolver {
  private readonly maxTraversalDepth = 10;

  /**
   * Resolves a package following Node.js module resolution algorithm
   * with monorepo-aware enhancements and user configuration
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
   * Builds resolution strategies based on user configuration
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
   * Gets the automatic resolution strategies (original behavior)
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
   * Detects the package manager used in the project
   */
  async detectPackageManager(startPath: string): Promise<PackageManager> {
    let currentPath = path.resolve(startPath);

    for (let i = 0; i < this.maxTraversalDepth; i++) {
      const pnpmLock = path.join(currentPath, 'pnpm-lock.yaml');
      const yarnLock = path.join(currentPath, 'yarn.lock');
      const npmLock = path.join(currentPath, 'package-lock.json');

      if (fs.existsSync(pnpmLock)) {
        return { type: 'pnpm', lockFile: pnpmLock, workspaceSupport: true };
      }
      if (fs.existsSync(yarnLock)) {
        return { type: 'yarn', lockFile: yarnLock, workspaceSupport: true };
      }
      if (fs.existsSync(npmLock)) {
        return { type: 'npm', lockFile: npmLock, workspaceSupport: false };
      }

      const parent = path.dirname(currentPath);
      if (parent === currentPath) break;
      currentPath = parent;
    }

    return { type: 'unknown', lockFile: '', workspaceSupport: false };
  }

  /**
   * Resolves package from local node_modules (standard resolution)
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
   * Resolves package from hoisted dependencies (walks up directory tree)
   */
  private async resolveHoisted(
    packageName: string,
    startPath: string,
  ): Promise<Result<ResolvedPackage>> {
    let currentPath = path.resolve(startPath);

    for (let i = 0; i < this.maxTraversalDepth; i++) {
      const nodeModulesPath = path.join(currentPath, 'node_modules', packageName);

      if (fs.existsSync(nodeModulesPath)) {
        const result = await this.analyzePackage(nodeModulesPath, 'hoisted');
        if (result.ok) {
          return result;
        }
      }

      const parent = path.dirname(currentPath);
      if (parent === currentPath) break;
      currentPath = parent;
    }

    return err(new Error(`Package not found in hoisted dependencies`));
  }

  /**
   * Resolves package from pnpm store (handles .pnpm symlinks)
   */
  private async resolvePnpmStore(
    packageName: string,
    startPath: string,
    packageManager: PackageManager,
  ): Promise<Result<ResolvedPackage>> {
    if (packageManager.type !== 'pnpm') {
      return err(new Error(`Not a pnpm project`));
    }

    let currentPath = path.resolve(startPath);

    for (let i = 0; i < this.maxTraversalDepth; i++) {
      // Check for pnpm store in node_modules/.pnpm
      const pnpmStorePath = path.join(currentPath, 'node_modules', '.pnpm');

      if (fs.existsSync(pnpmStorePath)) {
        // pnpm stores packages in format: package@version/node_modules/package
        const result = await this.searchPnpmStore(pnpmStorePath, packageName);
        if (result.ok) {
          return result;
        }
      }

      const parent = path.dirname(currentPath);
      if (parent === currentPath) break;
      currentPath = parent;
    }

    return err(new Error(`Package not found in pnpm store`));
  }

  /**
   * Searches for package in pnpm store structure
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
   * Checks if a pnpm store entry name corresponds to the target package
   */
  private isPnpmEntryForPackage(entryName: string, packageName: string): boolean {
    // Remove version suffix (everything after @version)
    const withoutVersion = entryName.replace(/@[^@]+$/, '');

    // Handle scoped packages (@scope/package becomes @scope+package in pnpm store)
    const normalizedEntry = withoutVersion.replace(/\+/g, '/');

    return normalizedEntry === packageName;
  }

  /**
   * Resolves package from workspace root
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

    const nodeModulesPath = path.join(workspaceRoot.value, 'node_modules', packageName);

    if (!fs.existsSync(nodeModulesPath)) {
      return err(new Error(`Package not found in workspace root`));
    }

    return this.analyzePackage(nodeModulesPath, 'workspace-root');
  }

  /**
   * Resolves package from a user-specified workspace root
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
   * Resolves package from a custom path
   */
  private async resolveFromCustomPath(
    packageName: string,
    customPath: string,
  ): Promise<Result<ResolvedPackage>> {
    // Custom path can be either a direct path to the package or a node_modules directory
    let packagePath: string;

    if (customPath.endsWith(packageName)) {
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
   * Finds the workspace root by locating the workspace configuration
   */
  private async findWorkspaceRoot(
    startPath: string,
    packageManager: PackageManager,
  ): Promise<Result<string>> {
    let currentPath = path.resolve(startPath);

    for (let i = 0; i < this.maxTraversalDepth; i++) {
      const packageJsonPath = path.join(currentPath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

          // Check for workspace configuration
          if (this.hasWorkspaceConfig(packageJson, packageManager)) {
            return ok(currentPath);
          }
        } catch {
          // Continue searching if package.json is invalid
        }
      }

      const parent = path.dirname(currentPath);
      if (parent === currentPath) break;
      currentPath = parent;
    }

    return err(new Error(`Workspace root not found`));
  }

  /**
   * Checks if package.json has workspace configuration
   */
  private hasWorkspaceConfig(packageJson: any, packageManager: PackageManager): boolean {
    switch (packageManager.type) {
      case 'pnpm':
        return (
          packageJson.workspaces ||
          fs.existsSync(path.dirname(packageManager.lockFile) + '/pnpm-workspace.yaml')
        );
      case 'yarn':
        return packageJson.workspaces || packageJson.private === true;
      default:
        return false;
    }
  }

  /**
   * Analyzes a resolved package path and extracts type information
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

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const isSymlink = fs.lstatSync(packagePath).isSymbolicLink();

      // Find types entry point
      const typesPath = this.findTypesEntry(packagePath, packageJson);

      // Find all declaration files
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
   * Finds the types entry point from package.json
   */
  private findTypesEntry(packagePath: string, packageJson: any): string | undefined {
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
   * Finds all declaration files in the package
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
   * Synchronous fallback for finding declaration files
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
