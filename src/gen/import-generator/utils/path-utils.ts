import path from 'node:path';

export const looksLikePackagePath = (filePath: string): boolean => {
  const normalizedPath = path.normalize(filePath);
  const parts = normalizedPath.split(path.sep);

  return parts.some(
    part => part === 'node_modules' || part.startsWith('.pnpm') || part.includes('@'),
  );
};

export const extractPotentialPackageImports = (filePath: string): string[] => {
  const potentialPaths: string[] = [];
  const normalizedPath = path.normalize(filePath);
  const parts = normalizedPath.split(path.sep);

  const packageDirIndices = parts
    .map((part, index) => {
      if (part === 'node_modules' || part.startsWith('.pnpm')) {
        return index;
      }
      return -1;
    })
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

  if (parts[0] && parts[0].length > 0 && parts[0].charAt(0) === '@') {
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } else {
    return parts[0] || null;
  }

  return null;
};

export const extractPackageNameFromParts = (parts: string[]): string | null => {
  if (parts.length === 0) {
    return null;
  }

  if (parts[0] && parts[0].length > 0 && parts[0].charAt(0) === '@') {
    if (parts.length >= 2) {
      const scopedPackage = `${parts[0]}/${parts[1]}`;

      if (parts.length > 2) {
        const subPath = cleanSubPath(parts.slice(2).join('/'));
        if (subPath) {
          return `${scopedPackage}/${subPath}`;
        }
      }
      return scopedPackage;
    }
  } else {
    const packageName = parts[0];
    if (packageName) {
      if (parts.length > 1) {
        // Special handling for React-style subpath imports
        const subPathParts = parts.slice(1);
        const lastPart = subPathParts[subPathParts.length - 1] || '';

        // If it's a .d.ts file that matches a known React-style import pattern, clean it
        if (lastPart.endsWith('.d.ts') && subPathParts.length === 1) {
          const withoutExt = lastPart.replace(/\.d\.ts$/, '');
          // For React jsx-runtime.d.ts, this should be cleaned to just the package
          if (withoutExt === 'jsx-runtime') {
            return packageName;
          }
        }

        const subPath = cleanSubPath(parts.slice(1).join('/'));
        if (subPath) {
          return `${packageName}/${subPath}`;
        }
      }
      return packageName;
    }
  }

  return null;
};

export const cleanSubPath = (subPath: string): string => {
  if (!subPath) {
    return '';
  }

  const withoutExt = subPath.replace(/\.(d\.ts|ts|js)$/, '');
  const cleaned = withoutExt.replace(/\/index$|^index$/, '');

  return cleaned === '.' ? '' : cleaned;
};

export const resolveRelativeImportPath = (
  sourceFilePath: string,
  importSpecifier: string,
): string | null => {
  try {
    // Validate inputs
    if (!sourceFilePath || typeof sourceFilePath !== 'string' || sourceFilePath.trim() === '') {
      return null;
    }
    if (!importSpecifier || typeof importSpecifier !== 'string') {
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
    for (const ext of extensions) {
      const pathWithExt = resolvedPath + ext;
      return pathWithExt;
    }

    for (const ext of extensions) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      return indexPath;
    }

    return resolvedPath + '.ts';
  } catch {
    return null;
  }
};

export const createRelativeImportPath = (outputDir: string, sourceFile: string): string => {
  try {
    // Validate inputs
    if (!outputDir || typeof outputDir !== 'string' || outputDir.trim() === '') {
      console.warn(`Invalid output directory: ${outputDir}`);
      return sourceFile;
    }
    if (!sourceFile || typeof sourceFile !== 'string') {
      console.warn(`Invalid source file: ${sourceFile}`);
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
