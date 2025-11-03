import path from 'node:path';

const normalizeAndSplitPath = (filePath: string): string[] => {
  const normalizedPath = path.normalize(filePath);
  return normalizedPath.split(path.sep);
};

const isPackageDirectory = (part: string): boolean => {
  return part === 'node_modules' || part.startsWith('.pnpm');
};

const looksLikePackagePart = (part: string): boolean => {
  return isPackageDirectory(part) || part.includes('@');
};

/**
 * Cleans a subpath by removing file extensions and index references.
 * Used to convert TypeScript declaration file paths to clean import subpaths.
 *
 * @param subPath - The subpath to clean (e.g., 'http/client.d.ts')
 * @returns Cleaned subpath suitable for imports (e.g., 'http/client')
 *
 * @example
 * ```ts
 * cleanSubPath('types.d.ts') // Returns: 'types'
 * cleanSubPath('lib/index.ts') // Returns: 'lib'
 * cleanSubPath('utils/helpers/index.d.ts') // Returns: 'utils/helpers'
 * cleanSubPath('index') // Returns: ''
 * cleanSubPath('') // Returns: ''
 * ```
 */
export const cleanSubPath = (subPath: string): string => {
  if (!subPath) {
    return '';
  }

  const withoutExt = subPath.replace(/\.(d\.ts|ts|js)$/, '');
  const cleaned = withoutExt.replace(/\/index$|^index$/, '');

  return cleaned === '.' ? '' : cleaned;
};

const isValidString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim() !== '';
};

const buildScopedPackageName = (parts: string[], includeSubPath = false): string | null => {
  if (parts.length === 0) return null;

  if (parts[0] && parts[0].startsWith('@')) {
    if (parts.length >= 2) {
      const scopedPackage = `${parts[0]}/${parts[1]}`;

      if (includeSubPath && parts.length > 2) {
        const subPath = cleanSubPath(parts.slice(2).join('/'));
        return subPath ? `${scopedPackage}/${subPath}` : scopedPackage;
      }
      return scopedPackage;
    }
    return null;
  }

  // Regular package
  const packageName = parts[0];
  if (!packageName) return null;

  if (includeSubPath && parts.length > 1) {
    const subPath = cleanSubPath(parts.slice(1).join('/'));
    return subPath ? `${packageName}/${subPath}` : packageName;
  }
  return packageName;
};

/**
 * Determines if a file path appears to be from a package (node_modules, pnpm, or contains scoped packages).
 *
 * @param filePath - The file path to analyze
 * @returns True if the path looks like it belongs to a package, false otherwise
 *
 * @example
 * ```ts
 * looksLikePackagePath('/project/node_modules/react/index.d.ts') // true
 * looksLikePackagePath('/project/src/components/Button.ts') // false
 * looksLikePackagePath('/project/.pnpm/react@18.0.0/index.d.ts') // true
 * ```
 */
export const looksLikePackagePath = (filePath: string): boolean => {
  const parts = normalizeAndSplitPath(filePath);
  return parts.some(looksLikePackagePart);
};

/**
 * Extracts potential package import names from a file path within package directories.
 * This function handles complex scenarios like nested node_modules, pnpm structures,
 * and scoped packages with subpaths.
 *
 * @param filePath - The file path to extract package names from
 * @returns Array of potential package import strings, including clean names and subpaths
 *
 * @example
 * ```ts
 * // Simple package extraction
 * extractPotentialPackageImports('/project/node_modules/react/index.d.ts')
 * // Returns: ['react']
 *
 * // Scoped package with subpaths
 * extractPotentialPackageImports('/project/node_modules/@company/utils/http/client.d.ts')
 * // Returns: ['@company/utils', '@company/utils/http/client', '@company/utils/http']
 *
 * // PNPM structure
 * extractPotentialPackageImports('/project/.pnpm/@types+node@20.0.0/node_modules/@types/node/fs.d.ts')
 * // Returns: ['@types/node', '@types/node/fs', ...]
 * ```
 */
export const extractPotentialPackageImports = (filePath: string): string[] => {
  const potentialPaths: string[] = [];
  const parts = normalizeAndSplitPath(filePath);

  const packageDirIndices = parts
    .map((part, index) => (isPackageDirectory(part) ? index : -1))
    .filter(index => index !== -1);

  for (const dirIndex of packageDirIndices) {
    if (dirIndex < parts.length - 1) {
      const afterPackageDir = parts.slice(dirIndex + 1);

      // First try clean extraction for simple cases
      const cleanExtracted = extractCleanPackageName(afterPackageDir);
      if (cleanExtracted && !potentialPaths.includes(cleanExtracted)) {
        potentialPaths.push(cleanExtracted);
      }

      // Then try full path extraction for subpath cases
      const fullExtracted = extractPackageNameFromParts(afterPackageDir);
      if (
        fullExtracted &&
        fullExtracted !== cleanExtracted &&
        !potentialPaths.includes(fullExtracted)
      ) {
        potentialPaths.push(fullExtracted);

        // For scoped packages with subpaths, also add intermediate paths
        if (fullExtracted.includes('/')) {
          const pathParts = fullExtracted.split('/');
          if (pathParts[0] && pathParts[0].startsWith('@') && pathParts.length > 2) {
            // For @company/utils/http/client -> also add @company/utils/http
            for (let i = 2; i < pathParts.length; i++) {
              const intermediatePath = pathParts.slice(0, i + 1).join('/');
              if (!potentialPaths.includes(intermediatePath)) {
                potentialPaths.push(intermediatePath);
              }
            }
          }
        }
      }
    }
  }

  return potentialPaths;
};

// Extract clean package name for import resolution (used by extractPotentialPackageImports)
const extractCleanPackageName = (parts: string[]): string | null => {
  if (parts.length === 0) {
    return null;
  }

  // Handle PNPM versioning structure - extract clean package name
  if (parts[0] && parts[0].includes('@') && parts[0].includes('+')) {
    // PNPM format: @types+node@20.0.0/node_modules/@types/node/fs.d.ts
    // Look for the actual package in node_modules
    const nodeModulesIndex = parts.findIndex(part => part === 'node_modules');
    if (nodeModulesIndex !== -1 && nodeModulesIndex + 1 < parts.length) {
      return extractCleanPackageName(parts.slice(nodeModulesIndex + 1));
    }
  }

  return buildScopedPackageName(parts, false);
};

/**
 * Extracts a package name from an array of path parts, handling scoped packages
 * and subpaths with special React-style jsx-runtime handling.
 *
 * @param parts - Array of path parts (e.g., from splitting a normalized path)
 * @returns The extracted package name with optional subpath, or null if invalid
 *
 * @example
 * ```ts
 * // Regular package
 * extractPackageNameFromParts(['lodash', 'lib', 'index.d.ts'])
 * // Returns: 'lodash/lib'
 *
 * // Scoped package
 * extractPackageNameFromParts(['@types', 'node', 'fs', 'index.d.ts'])
 * // Returns: '@types/node/fs'
 *
 * // React jsx-runtime special case
 * extractPackageNameFromParts(['react', 'jsx-runtime.d.ts'])
 * // Returns: 'react'
 * ```
 */
export const extractPackageNameFromParts = (parts: string[]): string | null => {
  if (parts.length === 0) {
    return null;
  }

  // Special handling for React-style jsx-runtime pattern
  if (parts.length === 2 && parts[1] && parts[1].endsWith('.d.ts')) {
    const withoutExt = parts[1].replace(/\.d\.ts$/, '');
    if (withoutExt === 'jsx-runtime') {
      return parts[0] || null;
    }
  }

  return buildScopedPackageName(parts, true);
};

/**
 * Resolves a relative import specifier from a source file to an absolute TypeScript file path.
 * Handles .js to .ts conversion and adds appropriate TypeScript extensions.
 *
 * @param sourceFilePath - The absolute path of the source file making the import
 * @param importSpecifier - The relative import specifier (e.g., '../utils', './types.js')
 * @returns Absolute path to the imported TypeScript file, or null if invalid inputs
 *
 * @example
 * ```ts
 * // Basic relative import
 * resolveRelativeImportPath('/project/src/components/Button.ts', '../utils/helpers')
 * // Returns: '/project/src/utils/helpers.ts'
 *
 * // Converting .js to .ts
 * resolveRelativeImportPath('/project/src/index.ts', './utils.js')
 * // Returns: '/project/src/utils.ts'
 *
 * // Preserving existing extensions
 * resolveRelativeImportPath('/project/src/index.ts', './types.d.ts')
 * // Returns: '/project/src/types.d.ts'
 * ```
 */
export const resolveRelativeImportPath = (
  sourceFilePath: string,
  importSpecifier: string,
): string | null => {
  try {
    // Validate inputs
    if (!isValidString(sourceFilePath) || !isValidString(importSpecifier)) {
      return null;
    }

    const sourceDir = path.dirname(sourceFilePath);

    let actualImportSpecifier = importSpecifier;
    if (importSpecifier.endsWith('.js')) {
      actualImportSpecifier = importSpecifier.replace(/\.js$/, '.ts');
    }

    let resolvedPath = path.resolve(sourceDir, actualImportSpecifier);

    if (
      actualImportSpecifier.endsWith('.ts') ||
      actualImportSpecifier.endsWith('.tsx') ||
      actualImportSpecifier.endsWith('.d.ts')
    ) {
      return resolvedPath;
    }

    const extensions = ['.ts', '.tsx', '.d.ts'];

    // Try direct file with extensions
    return resolvedPath + extensions[0];
  } catch {
    return null;
  }
};

/**
 * Creates a relative import path from an output directory to a source file.
 * Converts TypeScript extensions to JavaScript and ensures paths start with './' when needed.
 *
 * @param outputDir - The absolute path of the output directory
 * @param sourceFile - The absolute path of the source file to import
 * @returns Relative import path suitable for JavaScript imports
 *
 * @example
 * ```ts
 * // Cross-directory import
 * createRelativeImportPath('/project/dist', '/project/src/types.ts')
 * // Returns: '../src/types.js'
 *
 * // Same directory import
 * createRelativeImportPath('/project/dist', '/project/dist/types.ts')
 * // Returns: './types.js'
 *
 * // Nested output directory
 * createRelativeImportPath('/project/dist/esm', '/project/src/utils.ts')
 * // Returns: '../../src/utils.js'
 * ```
 */
export const createRelativeImportPath = (outputDir: string, sourceFile: string): string => {
  try {
    // Validate inputs
    if (outputDir.trim() === '') {
      console.warn(`Invalid output directory: ${String(outputDir)}`);
      return sourceFile;
    }
    if (sourceFile.trim() === '') {
      console.warn(`Invalid source file: ${String(sourceFile)}`);
      return sourceFile;
    }

    const relativePath = path.relative(outputDir, sourceFile);
    const jsPath = relativePath.replace(/\.ts$/, '.js');
    return jsPath.startsWith('.') ? jsPath : `./${jsPath}`;
  } catch (error) {
    console.warn(`Failed to resolve relative path for ${sourceFile}:`, error);
    return sourceFile;
  }
};
