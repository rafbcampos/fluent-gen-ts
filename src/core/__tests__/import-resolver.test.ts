import { test, expect, describe, beforeEach } from 'vitest';
import { ImportResolver } from '../import-resolver.js';
import { isOk, isErr } from '../result.js';

describe('ImportResolver', () => {
  let resolver: ImportResolver;

  beforeEach(() => {
    resolver = new ImportResolver();
  });

  describe('resolve', () => {
    describe('relative imports', () => {
      test('resolves relative file imports', () => {
        const result = resolver.resolve({
          importPath: './utils',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: true,
            isNodeModule: false,
            moduleName: 'utils',
            originalPath: './utils',
            packageName: undefined,
            scopedPackage: undefined,
            subPath: undefined,
          });
        }
      });

      test('resolves parent directory imports', () => {
        const result = resolver.resolve({
          importPath: '../types',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: true,
            isNodeModule: false,
            moduleName: 'types',
            originalPath: '../types',
            packageName: undefined,
            scopedPackage: undefined,
            subPath: undefined,
          });
        }
      });

      test('resolves deep relative imports', () => {
        const result = resolver.resolve({
          importPath: '../../shared/constants',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.isRelative).toBe(true);
          expect(result.value.moduleName).toBe('constants');
        }
      });

      test('resolves current directory import', () => {
        const result = resolver.resolve({
          importPath: '.',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.isRelative).toBe(true);
          expect(result.value.moduleName).toBe('_');
        }
      });

      test('resolves parent directory shorthand', () => {
        const result = resolver.resolve({
          importPath: '..',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.isRelative).toBe(true);
          expect(result.value.moduleName).toBe('__');
        }
      });
    });

    describe('node module imports', () => {
      test('resolves simple package imports', () => {
        const result = resolver.resolve({
          importPath: 'lodash',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: false,
            isNodeModule: true,
            moduleName: 'lodash',
            originalPath: 'lodash',
            packageName: 'lodash',
            scopedPackage: undefined,
            subPath: undefined,
          });
        }
      });

      test('resolves package imports with subpaths', () => {
        const result = resolver.resolve({
          importPath: 'lodash/get',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: false,
            isNodeModule: true,
            moduleName: 'get',
            originalPath: 'lodash/get',
            packageName: 'lodash',
            scopedPackage: undefined,
            subPath: 'get',
          });
        }
      });

      test('resolves package imports with deep subpaths', () => {
        const result = resolver.resolve({
          importPath: 'ts-morph/lib/ts-morph',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: false,
            isNodeModule: true,
            moduleName: 'ts_morph',
            originalPath: 'ts-morph/lib/ts-morph',
            packageName: 'ts-morph',
            scopedPackage: undefined,
            subPath: 'lib/ts-morph',
          });
        }
      });

      test('handles package names with special characters', () => {
        const testCases = [
          {
            importPath: 'package-with-dashes',
            expectedModuleName: 'package_with_dashes',
          },
          {
            importPath: 'package_with_underscores',
            expectedModuleName: 'package_with_underscores',
          },
          {
            importPath: 'package.with.dots',
            expectedModuleName: 'package_with_dots',
          },
          { importPath: '123-package', expectedModuleName: '_123_package' },
        ];

        for (const { importPath, expectedModuleName } of testCases) {
          const result = resolver.resolve({
            importPath,
          });

          expect(isOk(result)).toBe(true);
          if (isOk(result)) {
            expect(result.value.moduleName).toBe(expectedModuleName);
            expect(result.value.packageName).toBe(importPath);
          }
        }
      });

      test('resolves Node.js protocol imports', () => {
        const testCases = ['node:fs', 'node:path', 'node:crypto'];

        for (const importPath of testCases) {
          const result = resolver.resolve({
            importPath,
          });

          expect(isOk(result)).toBe(true);
          if (isOk(result)) {
            expect(result.value.isNodeModule).toBe(true);
            expect(result.value.packageName).toBe(importPath);
            expect(result.value.moduleName).toBe(importPath.replace(':', '_'));
          }
        }
      });
    });

    describe('scoped package imports', () => {
      test('resolves scoped packages', () => {
        const result = resolver.resolve({
          importPath: '@babel/core',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: false,
            isNodeModule: true,
            moduleName: 'core',
            originalPath: '@babel/core',
            packageName: '@babel/core',
            scopedPackage: '@babel',
            subPath: undefined,
          });
        }
      });

      test('resolves scoped packages with subpaths', () => {
        const result = resolver.resolve({
          importPath: '@scope/package/submodule',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: false,
            isNodeModule: true,
            moduleName: 'submodule',
            originalPath: '@scope/package/submodule',
            packageName: '@scope/package',
            scopedPackage: '@scope',
            subPath: 'submodule',
          });
        }
      });

      test('resolves scoped packages with special characters', () => {
        const result = resolver.resolve({
          importPath: '@babel/preset-env',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.moduleName).toBe('preset_env');
          expect(result.value.packageName).toBe('@babel/preset-env');
          expect(result.value.scopedPackage).toBe('@babel');
        }
      });
    });

    describe('scoped package imports (including @types)', () => {
      test('resolves @types/node as regular scoped package', () => {
        const result = resolver.resolve({
          importPath: '@types/node',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: false,
            isNodeModule: true,
            moduleName: 'node',
            originalPath: '@types/node',
            packageName: '@types/node',
            scopedPackage: '@types',
            subPath: undefined,
          });
        }
      });

      test('resolves @types/node/fs as regular scoped package with subpath', () => {
        const result = resolver.resolve({
          importPath: '@types/node/fs',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({
            isRelative: false,
            isNodeModule: true,
            moduleName: 'fs',
            originalPath: '@types/node/fs',
            packageName: '@types/node',
            scopedPackage: '@types',
            subPath: 'fs',
          });
        }
      });

      test('resolves @types/react/jsx-runtime as regular scoped package', () => {
        const result = resolver.resolve({
          importPath: '@types/react/jsx-runtime',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.moduleName).toBe('jsx_runtime');
          expect(result.value.packageName).toBe('@types/react');
          expect(result.value.subPath).toBe('jsx-runtime');
        }
      });
    });

    describe('absolute and other path types', () => {
      test('resolves absolute paths as non-node-modules', () => {
        const result = resolver.resolve({
          importPath: '/absolute/path',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.isRelative).toBe(false);
          expect(result.value.isNodeModule).toBe(false);
          expect(result.value.moduleName).toBe('path');
        }
      });

      test('handles Windows absolute paths correctly', () => {
        const result = resolver.resolve({
          importPath: 'C:\\windows\\path',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.isRelative).toBe(false);
          expect(result.value.isNodeModule).toBe(false);
          expect(result.value.moduleName).toBe('C__windows_path');
        }
      });
    });

    describe('edge cases and cleanup', () => {
      test('handles trailing slashes in package names', () => {
        const result = resolver.resolve({
          importPath: 'package/',
        });

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.packageName).toBe('package');
          expect(result.value.subPath).toBe(undefined);
        }
      });

      test('normalizes module names to valid identifiers', () => {
        const testCases = [
          { input: 'module-name', expected: 'module_name' },
          { input: 'module.name', expected: 'module_name' },
          { input: '123module', expected: '_123module' },
          { input: 'module@version', expected: 'module_version' },
        ];

        for (const { input, expected } of testCases) {
          const result = resolver.resolve({
            importPath: input,
          });

          expect(isOk(result)).toBe(true);
          if (isOk(result)) {
            expect(result.value.moduleName).toBe(expected);
          }
        }
      });
    });
  });

  describe('error cases', () => {
    test('rejects empty import paths', () => {
      const result = resolver.resolve({
        importPath: '',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Import path cannot be empty');
      }
    });

    test('rejects whitespace-only import paths', () => {
      const result = resolver.resolve({
        importPath: '   ',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Import path cannot be empty');
      }
    });

    test('rejects incomplete scoped packages', () => {
      const invalidCases = ['@', '@scope'];

      for (const importPath of invalidCases) {
        const result = resolver.resolve({
          importPath,
        });

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toBe(`Invalid scoped package: ${importPath}`);
        }
      }
    });

    test('rejects malformed scoped packages with trailing slash only', () => {
      const result = resolver.resolve({
        importPath: '@scope/',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Invalid scoped package: @scope/');
      }
    });

    test('validates input types', () => {
      // This test ensures type safety at runtime
      const result = resolver.resolve({
        importPath: null as any,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Import path must be a string');
      }
    });
  });

  describe('formatImportPath', () => {
    describe('scoped package formatting', () => {
      test('formats @types/node as scoped package', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'node',
          originalPath: '@types/node',
          packageName: '@types/node' as const,
          scopedPackage: '@types' as const,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('@types/node');
      });

      test('formats @types/node/fs as scoped package with subpath', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'fs',
          originalPath: '@types/node/fs',
          packageName: '@types/node' as const,
          scopedPackage: '@types' as const,
          subPath: 'fs' as const,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('@types/node/fs');
      });

      test('formats @types/react as scoped package', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'react',
          originalPath: '@types/react',
          packageName: '@types/react' as const,
          scopedPackage: '@types' as const,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('@types/react');
      });
    });

    describe('node module formatting', () => {
      test('formats simple packages', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'lodash',
          originalPath: 'lodash',
          packageName: 'lodash' as const,
          scopedPackage: undefined,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('lodash');
      });

      test('formats packages with subpaths', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'get',
          originalPath: 'lodash/get',
          packageName: 'lodash' as const,
          scopedPackage: undefined,
          subPath: 'get' as const,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('lodash/get');
      });

      test('formats scoped packages', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'core',
          originalPath: '@babel/core',
          packageName: '@babel/core' as const,
          scopedPackage: '@babel' as const,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('@babel/core');
      });

      test('formats scoped packages with subpaths', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'submodule',
          originalPath: '@scope/package/submodule',
          packageName: '@scope/package' as const,
          scopedPackage: '@scope' as const,
          subPath: 'submodule' as const,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('@scope/package/submodule');
      });
    });

    describe('relative path formatting', () => {
      test('formats relative paths', () => {
        const info = {
          isRelative: true,
          isNodeModule: false,
          moduleName: 'utils',
          originalPath: './utils',
          packageName: undefined,
          scopedPackage: undefined,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/components/Button.ts',
        });

        expect(formatted).toBe('/src/components/utils');
      });

      test('converts TypeScript extensions to JavaScript', () => {
        const info = {
          isRelative: true,
          isNodeModule: false,
          moduleName: 'utils',
          originalPath: './utils.ts',
          packageName: undefined,
          scopedPackage: undefined,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/components/Button.ts',
        });

        expect(formatted).toBe('/src/components/utils.js');
      });

      test('converts TypeScript React extensions', () => {
        const info = {
          isRelative: true,
          isNodeModule: false,
          moduleName: 'Component',
          originalPath: './Component.tsx',
          packageName: undefined,
          scopedPackage: undefined,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/components/Button.tsx',
        });

        expect(formatted).toBe('/src/components/Component.js');
      });
    });

    describe('fallback formatting', () => {
      test('falls back to module name for unknown types', () => {
        const info = {
          isRelative: false,
          isNodeModule: false,
          moduleName: 'someModule',
          originalPath: '/absolute/someModule',
          packageName: undefined,
          scopedPackage: undefined,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('someModule');
      });

      test('handles missing package names gracefully', () => {
        const info = {
          isRelative: false,
          isNodeModule: true,
          moduleName: 'fallbackModule',
          originalPath: 'fallbackModule',
          packageName: undefined,
          scopedPackage: undefined,
          subPath: undefined,
        };

        const formatted = resolver.formatImportPath({
          info,
          sourceFilePath: '/src/test.ts',
        });

        expect(formatted).toBe('fallbackModule');
      });
    });
  });

  describe('bug verification tests', () => {
    test('formats deep relative imports correctly', () => {
      const resolveResult = resolver.resolve({
        importPath: './utils/helpers/format',
      });

      expect(isOk(resolveResult)).toBe(true);
      if (isOk(resolveResult)) {
        const formatted = resolver.formatImportPath({
          info: resolveResult.value,
          sourceFilePath: '/src/components/Button.ts',
        });

        expect(formatted).toBe('/src/components/utils/helpers/format');
      }
    });
  });

  describe('integration scenarios', () => {
    test('handles complex real-world import scenarios', () => {
      const testCases = [
        {
          name: 'React component with types',
          importPath: '@types/react/jsx-runtime',
          expectedModuleName: 'jsx_runtime',
          expectedFormatted: '@types/react/jsx-runtime',
        },
        {
          name: 'Deep Node.js builtin',
          importPath: '@types/node/fs/promises',
          expectedModuleName: 'promises',
          expectedFormatted: '@types/node/fs/promises',
        },
        {
          name: 'Scoped package with deep path',
          importPath: '@babel/plugin-transform-runtime/lib/definitions',
          expectedModuleName: 'definitions',
          expectedFormatted: '@babel/plugin-transform-runtime/lib/definitions',
        },
      ];

      for (const { name, importPath, expectedModuleName, expectedFormatted } of testCases) {
        const result = resolver.resolve({
          importPath,
        });

        expect(isOk(result), `${name} should resolve successfully`).toBe(true);
        if (isOk(result)) {
          expect(result.value.moduleName).toBe(expectedModuleName);

          const formatted = resolver.formatImportPath({
            info: result.value,
            sourceFilePath: '/src/test.ts',
          });
          expect(formatted).toBe(expectedFormatted);
        }
      }
    });

    test('maintains consistency across resolve and format operations', () => {
      const importPaths = [
        './relative',
        'lodash',
        '@types/node',
        '@babel/core',
        'react/jsx-runtime',
        '@types/react/jsx-runtime',
      ];

      for (const importPath of importPaths) {
        const resolveResult = resolver.resolve({
          importPath,
        });

        expect(isOk(resolveResult), `${importPath} should resolve`).toBe(true);
        if (isOk(resolveResult)) {
          // Format operation should not throw
          expect(() => {
            resolver.formatImportPath({
              info: resolveResult.value,
              sourceFilePath: '/src/test.ts',
            });
          }).not.toThrow();
        }
      }
    });
  });
});
