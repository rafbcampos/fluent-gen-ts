import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PackageResolver } from '../../resolvers/package-resolver.js';
import type { ResolvedType } from '../../../../core/types.js';
import { TypeKind } from '../../../../core/types.js';
import { isErr } from '../../../../core/result.js';
import { ImportResolver } from '../../../../core/import-resolver.js';

// Mock the ImportResolver
vi.mock('../../../../core/import-resolver.js', () => ({
  ImportResolver: vi.fn(() => ({
    resolve: vi.fn(),
    formatImportPath: vi.fn(),
  })),
}));

describe('PackageResolver', () => {
  let resolver: PackageResolver;
  let mockImportResolver: {
    resolve: ReturnType<typeof vi.fn>;
    formatImportPath: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockImportResolver = {
      resolve: vi.fn(),
      formatImportPath: vi.fn(),
    };
    (ImportResolver as any).mockImplementation(() => mockImportResolver);
    resolver = new PackageResolver();
  });

  describe('generateModuleImports', () => {
    test('generates namespace imports for valid node modules', () => {
      const resolvedType = createResolvedType({
        imports: ['react', 'lodash'],
      });

      mockImportResolver.resolve
        .mockReturnValueOnce({
          ok: true,
          value: { isNodeModule: true, moduleName: 'React' },
        })
        .mockReturnValueOnce({
          ok: true,
          value: { isNodeModule: true, moduleName: 'Lodash' },
        });

      mockImportResolver.formatImportPath
        .mockReturnValueOnce('react')
        .mockReturnValueOnce('lodash');

      const result = resolver.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value).toContain('import type * as React from "react";');
        expect(result.value).toContain('import type * as Lodash from "lodash";');
      }
    });

    test('excludes modules in excludeModules set', () => {
      const resolvedType = createResolvedType({
        imports: ['react', 'lodash', 'axios'],
      });

      mockImportResolver.resolve.mockReturnValue({
        ok: true,
        value: { isNodeModule: true, moduleName: 'React' },
      });

      mockImportResolver.formatImportPath
        .mockReturnValueOnce('react')
        .mockReturnValueOnce('lodash')
        .mockReturnValueOnce('axios');

      const excludeModules = new Set(['react', 'axios']);
      const result = resolver.generateModuleImports(resolvedType, excludeModules);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toContain('lodash');
      }
    });

    test('skips non-node modules', () => {
      const resolvedType = createResolvedType({
        imports: ['./local', 'react'],
      });

      mockImportResolver.resolve
        .mockReturnValueOnce({
          ok: true,
          value: { isNodeModule: false },
        })
        .mockReturnValueOnce({
          ok: true,
          value: { isNodeModule: true, moduleName: 'React' },
        });

      mockImportResolver.formatImportPath.mockReturnValueOnce('react');

      const result = resolver.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toContain('react');
      }
    });

    test('skips invalid import paths', () => {
      const resolvedType = createResolvedType({
        imports: ['', '   ', null as any, 'react'],
      });

      mockImportResolver.resolve.mockReturnValueOnce({
        ok: true,
        value: { isNodeModule: true, moduleName: 'React' },
      });

      mockImportResolver.formatImportPath.mockReturnValueOnce('react');

      const result = resolver.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toContain('react');
      }
    });

    test('handles import resolution errors', () => {
      const resolvedType = createResolvedType({
        imports: ['invalid-module'],
      });

      mockImportResolver.resolve.mockReturnValueOnce({
        ok: false,
        error: new Error('Resolution failed'),
      });

      const result = resolver.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    test('returns error for invalid resolved type', () => {
      const result = resolver.generateModuleImports(null as any);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid resolved type');
      }
    });

    test('returns error for non-array imports', () => {
      const resolvedType = createResolvedType({
        imports: 'not-an-array' as any,
      });

      const result = resolver.generateModuleImports(resolvedType);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid resolved type');
      }
    });
  });

  describe('generateExternalTypeImports', () => {
    test('groups types by module correctly', () => {
      const externalTypes = new Map([
        ['User', '/node_modules/react/index.d.ts'],
        ['Component', '/node_modules/react/index.d.ts'],
        ['Observable', '/node_modules/rxjs/index.d.ts'],
        ['Subject', '/node_modules/rxjs/Subject.d.ts'], // Should still group under rxjs
      ]);

      const result = resolver.generateExternalTypeImports(externalTypes);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value.join('\n')).toContain('User');
        expect(result.value.join('\n')).toContain('Component');
        expect(result.value.join('\n')).toContain('Observable');
        expect(result.value.join('\n')).toContain('Subject');
      }
    });

    test('handles pnpm structure', () => {
      const externalTypes = new Map([
        ['User', '/.pnpm/react@18.0.0/node_modules/react/index.d.ts'],
        ['Observable', '/.pnpm/rxjs@7.0.0/node_modules/rxjs/index.d.ts'],
      ]);

      const result = resolver.generateExternalTypeImports(externalTypes);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value.join('\n')).toContain('User');
        expect(result.value.join('\n')).toContain('Observable');
      }
    });

    test('handles scoped packages', () => {
      const externalTypes = new Map([
        ['Config', '/node_modules/@types/node/index.d.ts'],
        ['Server', '/node_modules/@company/server/index.d.ts'],
      ]);

      const result = resolver.generateExternalTypeImports(externalTypes);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value).toContain('import type { Config } from "@types/node";');
        expect(result.value).toContain('import type { Server } from "@company/server";');
      }
    });

    test('deduplicates types within same module', () => {
      const externalTypes = new Map([
        ['User', '/node_modules/react/index.d.ts'],
        ['Component', '/node_modules/react/index.d.ts'],
      ]);

      const result = resolver.generateExternalTypeImports(externalTypes);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value.join('\n')).toContain('User');
        expect(result.value.join('\n')).toContain('Component');
      }
    });

    test('sorts types alphabetically', () => {
      const externalTypes = new Map([
        ['ZComponent', '/node_modules/react/index.d.ts'],
        ['AComponent', '/node_modules/react/index.d.ts'],
        ['MComponent', '/node_modules/react/index.d.ts'],
      ]);

      const result = resolver.generateExternalTypeImports(externalTypes);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const imports = result.value.join('\n');
        expect(imports).toContain('AComponent');
        expect(imports).toContain('MComponent');
        expect(imports).toContain('ZComponent');
        // Check that A comes before M comes before Z
        expect(imports.indexOf('AComponent')).toBeLessThan(imports.indexOf('MComponent'));
        expect(imports.indexOf('MComponent')).toBeLessThan(imports.indexOf('ZComponent'));
      }
    });

    test('handles modules that cannot be extracted', () => {
      const externalTypes = new Map([
        ['Unknown', '/some/weird/path/without/node_modules'],
        ['Valid', '/node_modules/react/index.d.ts'],
      ]);

      const result = resolver.generateExternalTypeImports(externalTypes);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const imports = result.value.join('\n');
        expect(imports).toContain('Valid');
        // Unknown should be filtered out because module name cannot be extracted
        expect(imports).not.toContain('Unknown');
      }
    });

    test('returns error on exception', () => {
      // Create a Map that throws when iterated
      const externalTypes = new Map();
      Object.defineProperty(externalTypes, Symbol.iterator, {
        value: () => {
          throw new Error('Iterator error');
        },
      });

      const result = resolver.generateExternalTypeImports(externalTypes);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Failed to generate external type imports');
      }
    });
  });

  describe('resolveImportPath', () => {
    test('resolves package paths using import resolver', () => {
      const resolvedType = createResolvedType({
        sourceFile: '/node_modules/react/index.d.ts',
      });

      mockImportResolver.resolve.mockReturnValueOnce({
        ok: true,
        value: { isNodeModule: true },
      });

      mockImportResolver.formatImportPath.mockReturnValueOnce('react');

      const result = resolver.resolveImportPath(resolvedType, '/project/dist');

      expect(result).toBe('react');
      expect(mockImportResolver.resolve).toHaveBeenCalledWith({
        importPath: 'react',
      });
    });

    test('creates relative path for local files', () => {
      const resolvedType = createResolvedType({
        sourceFile: '/project/src/types.ts',
      });

      const result = resolver.resolveImportPath(resolvedType, '/project/dist');

      expect(result).toBe('../src/types.js');
    });

    test('returns source file path as fallback', () => {
      const resolvedType = createResolvedType({
        sourceFile: '/some/unknown/path.ts',
      });

      // Mock the import resolver to fail
      mockImportResolver.resolve.mockReturnValueOnce({
        ok: false,
        error: new Error('Failed to resolve'),
      });

      const result = resolver.resolveImportPath(resolvedType);

      expect(result).toBe('/some/unknown/path.ts');
    });

    test('throws error for invalid input', () => {
      expect(() => {
        resolver.resolveImportPath(null as any);
      }).toThrow('Invalid resolved type or source file path');

      expect(() => {
        resolver.resolveImportPath({
          sourceFile: null,
        } as any);
      }).toThrow('Invalid resolved type or source file path');
    });
  });

  describe('shouldPreserveNamedImports', () => {
    test('returns true for node modules', () => {
      mockImportResolver.resolve.mockReturnValueOnce({
        ok: true,
        value: { isNodeModule: true },
      });

      const result = resolver.shouldPreserveNamedImports('react', createResolvedType());

      expect(result).toBe(true);
    });

    test('returns false for non-node modules', () => {
      mockImportResolver.resolve.mockReturnValueOnce({
        ok: true,
        value: { isNodeModule: false },
      });

      const result = resolver.shouldPreserveNamedImports('./local', createResolvedType());

      expect(result).toBe(false);
    });

    test('returns false for resolution failures', () => {
      mockImportResolver.resolve.mockReturnValueOnce({
        ok: false,
        error: new Error('Failed to resolve'),
      });

      const result = resolver.shouldPreserveNamedImports('invalid', createResolvedType());

      expect(result).toBe(false);
    });

    test('returns false for invalid input', () => {
      expect(resolver.shouldPreserveNamedImports('', createResolvedType())).toBe(false);
      expect(resolver.shouldPreserveNamedImports('path', null as any)).toBe(false);
    });
  });

  // Helper function
  function createResolvedType(overrides: Partial<ResolvedType> = {}): ResolvedType {
    return {
      name: 'TestType',
      sourceFile: '/test/types.ts',
      typeInfo: { kind: TypeKind.Primitive, name: 'string' },
      imports: [],
      dependencies: [],
      ...overrides,
    };
  }
});
