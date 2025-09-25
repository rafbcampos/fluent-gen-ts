import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TypeImportsGenerator } from '../../generators/type-imports.js';
import { TypeKind } from '../../../../core/types.js';
import type { ResolvedType, TypeInfo, PropertyInfo, GenericParam } from '../../../../core/types.js';
import { isErr } from '../../../../core/result.js';

// Mock the dependencies
vi.mock('../../resolvers/dependency-resolver.js', () => ({
  DependencyResolver: vi.fn(() => ({
    discoverTransitiveDependencies: vi.fn(() => []),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../resolvers/package-resolver.js', () => ({
  PackageResolver: vi.fn(() => ({
    generateExternalTypeImports: vi.fn(),
    resolveImportPath: vi.fn(),
    shouldPreserveNamedImports: vi.fn(),
  })),
}));

vi.mock('../../utils/validation.js', () => ({
  validateTypeName: vi.fn((name: string) => /^[A-Z]/.test(name)),
  isGlobalType: vi.fn((name: string) => ['Array', 'Date', 'Promise'].includes(name)),
}));

vi.mock('../../utils/path-utils.js', () => ({
  looksLikePackagePath: vi.fn((path: string) => path.includes('node_modules')),
}));

vi.mock('../../utils/deduplication.js', () => ({
  resolveImportConflicts: vi.fn(),
}));

describe('TypeImportsGenerator', () => {
  let generator: TypeImportsGenerator;
  let mockDependencyResolver: any;
  let mockPackageResolver: any;

  beforeEach(async () => {
    mockDependencyResolver = {
      discoverTransitiveDependencies: vi.fn(() => []),
      dispose: vi.fn(),
    };

    mockPackageResolver = {
      generateExternalTypeImports: vi.fn(() => ({ ok: true, value: [] })),
      resolveImportPath: vi.fn((type, _outputDir) => type.sourceFile.replace('.ts', '.js')),
      shouldPreserveNamedImports: vi.fn(() => false),
    };

    const { DependencyResolver } = vi.mocked(
      await import('../../resolvers/dependency-resolver.js'),
    );
    const { PackageResolver } = vi.mocked(await import('../../resolvers/package-resolver.js'));

    (DependencyResolver as any).mockImplementation(() => mockDependencyResolver);
    (PackageResolver as any).mockImplementation(() => mockPackageResolver);

    generator = new TypeImportsGenerator();
  });

  afterEach(() => {
    generator.dispose();
  });

  describe('generateTypeImports', () => {
    test('generates local type imports', () => {
      const resolvedType = createResolvedType('User', '/project/src/types.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('name', { kind: TypeKind.Primitive, name: 'string' }),
          createProperty('profile', {
            kind: TypeKind.Object,
            name: 'Profile',
            sourceFile: '/project/src/types.ts',
            properties: [],
          }),
        ],
      });

      const result = generator.generateTypeImports(resolvedType, '/project/dist');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('import type { User, Profile } from');
      }
    });

    test('generates relative imports for different local files', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('profile', {
            kind: TypeKind.Object,
            name: 'Profile',
            sourceFile: '/project/src/profile.ts',
            properties: [],
          }),
        ],
      });

      mockPackageResolver.resolveImportPath
        .mockReturnValueOnce('/project/dist/user.js') // For User
        .mockReturnValueOnce('/project/dist/profile.js'); // For Profile

      const result = generator.generateTypeImports(resolvedType, '/project/dist');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatchInlineSnapshot(`
          "import type { User } from "/project/dist/user.js";
          import type { Profile } from "/project/dist/profile.js";"
        `);
      }
    });

    test('generates external imports for node_modules types', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('component', {
            kind: TypeKind.Object,
            name: 'Component',
            sourceFile: '/node_modules/react/index.d.ts',
            properties: [],
          }),
        ],
      });

      mockPackageResolver.generateExternalTypeImports.mockReturnValue({
        ok: true,
        value: ['import type { Component } from "react";'],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('import type { Component } from "react";');
      }
    });

    test('handles mixed local, relative, and external types', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          // Local type
          createProperty('settings', {
            kind: TypeKind.Object,
            name: 'UserSettings',
            sourceFile: '/project/src/user.ts',
            properties: [],
          }),
          // Relative type
          createProperty('profile', {
            kind: TypeKind.Object,
            name: 'Profile',
            sourceFile: '/project/src/profile.ts',
            properties: [],
          }),
          // External type
          createProperty('component', {
            kind: TypeKind.Object,
            name: 'Component',
            sourceFile: '/node_modules/react/index.d.ts',
            properties: [],
          }),
        ],
      });

      mockPackageResolver.generateExternalTypeImports.mockReturnValue({
        ok: true,
        value: ['import type { Component } from "react";'],
      });

      mockPackageResolver.resolveImportPath
        .mockReturnValueOnce('user.js') // For User and UserSettings
        .mockReturnValueOnce('profile.js'); // For Profile

      const result = generator.generateTypeImports(resolvedType, '/project/dist');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('import type { User, UserSettings }'); // Local
        expect(result.value).toContain('import type { Profile }'); // Relative
        expect(result.value).toContain('import type { Component } from "react";'); // External
      }
    });

    test('processes array element types', () => {
      const resolvedType = createResolvedType('UserList', '/project/src/types.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('users', {
            kind: TypeKind.Array,
            elementType: {
              kind: TypeKind.Object,
              name: 'User',
              sourceFile: '/project/src/user.ts',
              properties: [],
            },
          }),
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('User');
      }
    });

    test('processes union type members', () => {
      const resolvedType = createResolvedType('Status', '/project/src/types.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('value', {
            kind: TypeKind.Union,
            unionTypes: [
              {
                kind: TypeKind.Object,
                name: 'SuccessStatus',
                sourceFile: '/project/src/success.ts',
                properties: [],
              },
              {
                kind: TypeKind.Object,
                name: 'ErrorStatus',
                sourceFile: '/project/src/error.ts',
                properties: [],
              },
            ],
          }),
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('SuccessStatus');
        expect(result.value).toContain('ErrorStatus');
      }
    });

    test('processes intersection type members', () => {
      const resolvedType = createResolvedType('Extended', '/project/src/types.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('value', {
            kind: TypeKind.Intersection,
            intersectionTypes: [
              {
                kind: TypeKind.Object,
                name: 'Base',
                sourceFile: '/project/src/base.ts',
                properties: [],
              },
              {
                kind: TypeKind.Object,
                name: 'Mixin',
                sourceFile: '/project/src/mixin.ts',
                properties: [],
              },
            ],
          }),
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('Base');
        expect(result.value).toContain('Mixin');
      }
    });

    test('processes generic type arguments', () => {
      const resolvedType = createResolvedType('Container', '/project/src/types.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('items', {
            kind: TypeKind.Array,
            elementType: {
              kind: TypeKind.Object,
              name: 'Item',
              sourceFile: '/project/src/item.ts',
              properties: [],
            },
          }),
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('Item');
      }
    });

    test('processes generic parameters with constraints', () => {
      const genericParam: GenericParam = {
        name: 'T',
        constraint: {
          kind: TypeKind.Object,
          name: 'Constraint',
          sourceFile: '/project/src/constraint.ts',
          properties: [],
        },
      };

      const resolvedType = createResolvedType('Generic', '/project/src/types.ts', {
        kind: TypeKind.Object,
        properties: [],
        genericParams: [genericParam],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('Constraint');
      }
    });

    test('processes generic parameters with defaults', () => {
      const genericParam: GenericParam = {
        name: 'T',
        default: {
          kind: TypeKind.Object,
          name: 'DefaultType',
          sourceFile: '/project/src/default.ts',
          properties: [],
        },
      };

      const resolvedType = createResolvedType('Generic', '/project/src/types.ts', {
        kind: TypeKind.Object,
        properties: [],
        genericParams: [genericParam],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('DefaultType');
      }
    });

    test('includes transitive dependencies from dependency resolver', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [],
      });

      mockDependencyResolver.discoverTransitiveDependencies.mockReturnValue([
        { typeName: 'BaseEntity', sourceFile: '/project/src/base.ts' },
        { typeName: 'Validator', sourceFile: '/project/src/validator.ts' },
      ]);

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('BaseEntity');
        expect(result.value).toContain('Validator');
      }
    });

    test('includes direct dependencies from resolved type', () => {
      const resolvedType: ResolvedType = {
        name: 'User',
        sourceFile: '/project/src/user.ts',
        typeInfo: {
          kind: TypeKind.Object,
          properties: [],
        },
        imports: [],
        dependencies: [
          {
            name: 'DirectDep',
            sourceFile: '/project/src/direct.ts',
            typeInfo: { kind: TypeKind.Primitive, name: 'string' },
            imports: [],
            dependencies: [],
          },
        ],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('DirectDep');
      }
    });

    test('ignores global types', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('date', { kind: TypeKind.Primitive, name: 'Date' }), // Global type
          createProperty('name', { kind: TypeKind.Primitive, name: 'string' }),
          createProperty('profile', {
            kind: TypeKind.Object,
            name: 'Profile',
            sourceFile: '/project/src/profile.ts',
            properties: [],
          }),
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toContain('Date');
        expect(result.value).toContain('Profile');
      }
    });

    test('ignores types without source files (treated as local)', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('profile', {
            kind: TypeKind.Object,
            name: 'InlineProfile',
            properties: [],
          }), // No sourceFile
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should be treated as local to User
        expect(result.value).toContain('import type { User, InlineProfile }');
      }
    });

    test('filters out invalid type names', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('profile', {
            kind: TypeKind.Object,
            name: 'Profile',
            sourceFile: '/project/src/profile.ts',
            properties: [],
          }),
          createProperty('invalid', {
            kind: TypeKind.Object,
            name: 'lowercase',
            sourceFile: '/project/src/invalid.ts',
            properties: [],
          }), // Invalid name
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('Profile');
        expect(result.value).not.toContain('lowercase');
      }
    });

    test('returns error for invalid resolved type', () => {
      const result = generator.generateTypeImports(null as any);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('Invalid resolved type');
      }
    });

    test('returns error for resolved type without name', () => {
      const resolvedType = createResolvedType('', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error.message).toContain('missing name');
      }
    });

    test('generates local import when no external dependencies found', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('value', { kind: TypeKind.Primitive, name: 'string' }), // No importable types
        ],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should generate import for the main type itself
        expect(result.value).toContain('import type { User }');
        expect(result.value).toContain('from "/project/src/user.js"');
      }
    });

    test('handles external type import generation errors', () => {
      const resolvedType = createResolvedType('User', '/project/src/user.ts', {
        kind: TypeKind.Object,
        properties: [
          createProperty('component', {
            kind: TypeKind.Object,
            name: 'Component',
            sourceFile: '/node_modules/react/index.d.ts',
            properties: [],
          }),
        ],
      });

      mockPackageResolver.generateExternalTypeImports.mockReturnValue({
        ok: false,
        error: new Error('External import error'),
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should still work, just without external imports
        expect(result.value).toContain('User');
      }
    });

    test('complex real-world scenario with nested structures', () => {
      const resolvedType = createResolvedType('APIResponse', '/project/src/api.ts', {
        kind: TypeKind.Object,
        properties: [
          // Local type
          createProperty('metadata', {
            kind: TypeKind.Object,
            name: 'ResponseMetadata',
            sourceFile: '/project/src/api.ts',
            properties: [],
          }),
          // Relative type
          createProperty('user', {
            kind: TypeKind.Object,
            name: 'User',
            sourceFile: '/project/src/user.ts',
            properties: [],
          }),
          // External type
          createProperty('request', {
            kind: TypeKind.Object,
            name: 'Request',
            sourceFile: '/node_modules/@types/express/index.d.ts',
            properties: [],
          }),
          // Nested array with union
          createProperty('items', {
            kind: TypeKind.Array,
            elementType: {
              kind: TypeKind.Union,
              unionTypes: [
                {
                  kind: TypeKind.Object,
                  name: 'Item',
                  sourceFile: '/project/src/item.ts',
                  properties: [],
                },
                {
                  kind: TypeKind.Object,
                  name: 'Product',
                  sourceFile: '/project/src/product.ts',
                  properties: [],
                },
              ],
            },
          }),
        ],
        genericParams: [
          {
            name: 'T',
            constraint: {
              kind: TypeKind.Object,
              name: 'Serializable',
              sourceFile: '/project/src/serializable.ts',
              properties: [],
            },
          },
        ],
      });

      mockPackageResolver.generateExternalTypeImports.mockReturnValue({
        ok: true,
        value: ['import type { Request } from "@types/express";'],
      });

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should contain all the different categories
        expect(result.value).toContain('APIResponse, ResponseMetadata'); // Local
        expect(result.value).toContain('User'); // Relative
        expect(result.value).toContain('Item'); // Relative
        expect(result.value).toContain('Product'); // Relative
        expect(result.value).toContain('Serializable'); // Relative
        expect(result.value).toContain('Request'); // External
        expect(result.value).toContain('@types/express'); // External
      }
    });
  });

  describe('dispose', () => {
    test('calls dispose on dependency resolver', () => {
      generator.dispose();
      expect(mockDependencyResolver.dispose).toHaveBeenCalled();
    });
  });

  // Helper functions
  function createResolvedType(name: string, sourceFile: string, typeInfo: TypeInfo): ResolvedType {
    return {
      name,
      sourceFile,
      typeInfo,
      imports: [],
      dependencies: [],
    };
  }

  function createProperty(name: string, type: TypeInfo): PropertyInfo {
    return {
      name,
      type,
      optional: false,
      readonly: false,
    };
  }
});
