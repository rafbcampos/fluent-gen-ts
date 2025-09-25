import { describe, test, expect, vi } from 'vitest';
import {
  looksLikePackagePath,
  extractPotentialPackageImports,
  extractPackageNameFromParts,
  cleanSubPath,
  resolveRelativeImportPath,
  createRelativeImportPath,
} from '../../utils/path-utils.js';

describe('path utilities', () => {
  describe('looksLikePackagePath', () => {
    test('identifies node_modules paths', () => {
      expect(looksLikePackagePath('/project/node_modules/react/index.d.ts')).toBe(true);
      expect(looksLikePackagePath('/deep/nested/node_modules/@types/node/index.d.ts')).toBe(true);
    });

    test('identifies pnpm paths', () => {
      expect(
        looksLikePackagePath('/project/.pnpm/react@18.2.0/node_modules/react/index.d.ts'),
      ).toBe(true);
      expect(
        looksLikePackagePath('/.pnpm/@types+node@20.0.0/node_modules/@types/node/index.d.ts'),
      ).toBe(true);
    });

    test('identifies scoped package indicators', () => {
      expect(looksLikePackagePath('/project/packages/@company/utils/types.d.ts')).toBe(true);
      expect(looksLikePackagePath('/some/path/@scope/package/index.ts')).toBe(true);
    });

    test('rejects regular project paths', () => {
      expect(looksLikePackagePath('/project/src/types.ts')).toBe(false);
      expect(looksLikePackagePath('/home/user/project/utils/helpers.ts')).toBe(false);
      expect(looksLikePackagePath('./relative/path/types.ts')).toBe(false);
    });

    test('rejects paths that only contain partial indicators', () => {
      expect(looksLikePackagePath('/project/src/node-modules-like/types.ts')).toBe(false);
      expect(looksLikePackagePath('/project/pnpm-like/types.ts')).toBe(false);
    });
  });

  describe('extractPotentialPackageImports', () => {
    test('extracts from node_modules paths', () => {
      const result = extractPotentialPackageImports('/project/node_modules/react/index.d.ts');
      expect(result).toContain('react');
    });

    test('extracts from nested node_modules', () => {
      const result = extractPotentialPackageImports(
        '/project/node_modules/react/node_modules/scheduler/index.d.ts',
      );
      console.log('Nested node_modules result:', result);
      expect(result).toContain('react');
      expect(result).toContain('scheduler');
    });

    test('extracts scoped packages', () => {
      const result = extractPotentialPackageImports('/project/node_modules/@types/node/index.d.ts');
      expect(result).toContain('@types/node');
    });

    test('extracts from pnpm structure', () => {
      const result = extractPotentialPackageImports(
        '/project/.pnpm/@types+node@20.0.0/node_modules/@types/node/fs.d.ts',
      );
      console.log('PNPM result:', result);
      expect(result).toContain('@types/node');
    });

    test('handles complex pnpm paths', () => {
      const result = extractPotentialPackageImports(
        '/project/.pnpm/react@18.2.0_typescript@5.0.0/node_modules/react/jsx-runtime.d.ts',
      );
      expect(result).toContain('react');
    });

    test('extracts subpaths correctly', () => {
      const result = extractPotentialPackageImports(
        '/project/node_modules/@company/utils/http/client.d.ts',
      );
      console.log('Subpaths result:', result);
      expect(result).toContain('@company/utils/http');
      expect(result).toContain('@company/utils');
    });

    test('returns empty array for non-package paths', () => {
      const result = extractPotentialPackageImports('/project/src/types.ts');
      expect(result).toHaveLength(0);
    });
  });

  describe('extractPackageNameFromParts', () => {
    test('extracts regular package names', () => {
      expect(extractPackageNameFromParts(['react', 'index.d.ts'])).toBe('react');
      expect(extractPackageNameFromParts(['lodash', 'lib', 'index.d.ts'])).toBe('lodash/lib');
    });

    test('extracts scoped package names', () => {
      expect(extractPackageNameFromParts(['@types', 'node', 'index.d.ts'])).toBe('@types/node');
      expect(extractPackageNameFromParts(['@company', 'utils', 'http', 'client.d.ts'])).toBe(
        '@company/utils/http/client',
      );
    });

    test('cleans subpaths correctly', () => {
      expect(extractPackageNameFromParts(['react', 'jsx-runtime.d.ts'])).toBe('react');
      expect(extractPackageNameFromParts(['lodash', 'lib', 'index.d.ts'])).toBe('lodash/lib');
    });

    test('handles incomplete scoped packages', () => {
      expect(extractPackageNameFromParts(['@types'])).toBeNull();
      expect(extractPackageNameFromParts(['@incomplete'])).toBeNull();
    });

    test('returns null for empty input', () => {
      expect(extractPackageNameFromParts([])).toBeNull();
    });

    test('preserves meaningful subpaths', () => {
      expect(extractPackageNameFromParts(['@company', 'utils', 'http', 'client'])).toBe(
        '@company/utils/http/client',
      );
      expect(extractPackageNameFromParts(['react', 'jsx-runtime'])).toBe('react/jsx-runtime');
    });

    test('removes index references', () => {
      expect(extractPackageNameFromParts(['react', 'index'])).toBe('react');
      expect(extractPackageNameFromParts(['@types', 'node', 'fs', 'index'])).toBe('@types/node/fs');
    });
  });

  describe('cleanSubPath', () => {
    test('removes TypeScript file extensions', () => {
      expect(cleanSubPath('types.d.ts')).toBe('types');
      expect(cleanSubPath('index.ts')).toBe('');
      expect(cleanSubPath('utils.js')).toBe('utils');
    });

    test('removes index file references', () => {
      expect(cleanSubPath('lib/index')).toBe('lib');
      expect(cleanSubPath('index')).toBe('');
      expect(cleanSubPath('/index')).toBe('');
    });

    test('handles complex paths', () => {
      expect(cleanSubPath('http/client.d.ts')).toBe('http/client');
      expect(cleanSubPath('utils/helpers/index.ts')).toBe('utils/helpers');
    });

    test('handles empty and invalid input', () => {
      expect(cleanSubPath('')).toBe('');
      expect(cleanSubPath('.')).toBe('');
    });

    test('preserves meaningful paths', () => {
      expect(cleanSubPath('jsx-runtime')).toBe('jsx-runtime');
      expect(cleanSubPath('types/global')).toBe('types/global');
    });
  });

  describe('resolveRelativeImportPath', () => {
    test('resolves relative paths correctly', () => {
      const result = resolveRelativeImportPath(
        '/project/src/components/Button.ts',
        '../types/Props',
      );
      expect(result).toBe('/project/src/types/Props.ts');
    });

    test('handles .js imports by converting to .ts', () => {
      const result = resolveRelativeImportPath('/project/src/index.ts', './utils.js');
      expect(result).toBe('/project/src/utils.ts');
    });

    test('preserves existing TypeScript extensions', () => {
      const result = resolveRelativeImportPath('/project/src/index.ts', './types.d.ts');
      expect(result).toBe('/project/src/types.d.ts');
    });

    test('adds .ts extension for extensionless imports', () => {
      const result = resolveRelativeImportPath('/project/src/index.ts', './utils');
      expect(result).toBe('/project/src/utils.ts');
    });

    test('handles directory-level imports', () => {
      const result = resolveRelativeImportPath('/project/src/index.ts', './components');
      expect(result).toBe('/project/src/components.ts');
    });

    test('handles nested relative paths', () => {
      const result = resolveRelativeImportPath('/project/src/deep/nested/file.ts', '../../utils');
      expect(result).toBe('/project/src/utils.ts');
    });

    test('returns null for invalid paths', () => {
      const result = resolveRelativeImportPath('', './invalid');
      expect(result).toBeNull();
    });

    test('handles parent directory traversal', () => {
      const result = resolveRelativeImportPath(
        '/project/src/components/ui/Button.ts',
        '../../../lib/utils',
      );
      expect(result).toBe('/project/lib/utils.ts');
    });
  });

  describe('createRelativeImportPath', () => {
    test('creates relative paths from output directory', () => {
      const result = createRelativeImportPath('/project/dist', '/project/src/types.ts');
      expect(result).toBe('../src/types.js');
    });

    test('ensures paths start with ./ for same directory', () => {
      const result = createRelativeImportPath('/project/dist', '/project/dist/types.ts');
      expect(result).toBe('./types.js');
    });

    test('converts .ts extensions to .js', () => {
      const result = createRelativeImportPath('/project/dist', '/project/src/utils.ts');
      expect(result).toBe('../src/utils.js');
    });

    test('handles nested output directories', () => {
      const result = createRelativeImportPath('/project/dist/esm', '/project/src/types.ts');
      expect(result).toBe('../../src/types.js');
    });

    test('handles complex relative paths', () => {
      const result = createRelativeImportPath(
        '/project/packages/core/dist',
        '/project/packages/shared/types.ts',
      );
      expect(result).toBe('../../shared/types.js');
    });

    test('handles errors gracefully', () => {
      // Mock console.warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = createRelativeImportPath('', '/invalid/path.ts');
      expect(result).toBe('/invalid/path.ts');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('handles paths that already start with ./', () => {
      const result = createRelativeImportPath('/project/dist', '/project/dist/subdir/types.ts');
      expect(result).toBe('./subdir/types.js');
    });

    test('handles paths with special characters', () => {
      const result = createRelativeImportPath('/project/dist', '/project/src/my-types.ts');
      expect(result).toBe('../src/my-types.js');
    });
  });
});
