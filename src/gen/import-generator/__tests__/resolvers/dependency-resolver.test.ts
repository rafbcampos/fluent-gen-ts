import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TypeKind } from '../../../../core/types.js';
import { DependencyResolver } from '../../resolvers/dependency-resolver.js';
import type { ResolvedType } from '../../../../core/types.js';
import { Project } from 'ts-morph';

// Mock ts-morph
vi.mock('ts-morph', () => ({
  Project: vi.fn(),
}));

// Mock path utils functions
vi.mock('../../utils/path-utils.js', () => ({
  looksLikePackagePath: vi.fn((path: string) => path.includes('node_modules')),
  resolveRelativeImportPath: vi.fn((_sourcePath: string, importPath: string) => {
    if (importPath === './types') return '/project/src/types.ts';
    if (importPath === '../utils') return '/project/utils.ts';
    if (importPath === '../shared') return '/project/shared.ts';
    if (importPath === './b') return '/project/src/b.ts';
    if (importPath === './a') return '/project/src/a.ts';
    if (importPath === './c') return '/project/src/c.ts';
    if (importPath === './d') return '/project/src/d.ts';
    if (importPath === './e') return '/project/src/e.ts';
    if (importPath === './f') return '/project/src/f.ts';
    // Clean up the path to remove ./ prefix
    const cleanPath = importPath.replace(/^\.\//, '');
    return `/project/src/${cleanPath}.ts`;
  }),
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
  validateTypeName: vi.fn((name: string) => /^[A-Z]/.test(name)),
}));

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;
  let mockProject: {
    addSourceFileAtPath: ReturnType<typeof vi.fn>;
    getSourceFiles: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockProject = {
      addSourceFileAtPath: vi.fn(),
      getSourceFiles: vi.fn(() => [
        {
          forget: vi.fn(),
        },
      ]),
    };

    (Project as any).mockImplementation(() => mockProject);
    resolver = new DependencyResolver();
  });

  afterEach(() => {
    resolver.dispose();
  });

  describe('discoverTransitiveDependencies', () => {
    test('discovers dependencies from import declarations', () => {
      const resolvedType = createResolvedType('/project/src/index.ts');

      const mockIndexSourceFile = createMockSourceFile([
        createMockImportDeclaration('./types', ['User', 'Profile']),
        createMockImportDeclaration('../utils', ['helpers']),
      ]);

      const mockEmptySourceFile = createMockSourceFile([]);

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/index.ts') return mockIndexSourceFile;
        return mockEmptySourceFile; // Transitive files have no imports
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        typeName: 'User',
        sourceFile: '/project/src/types.ts',
      });
      expect(result).toContainEqual({
        typeName: 'Profile',
        sourceFile: '/project/src/types.ts',
      });
    });

    test('excludes package paths from analysis', () => {
      const resolvedType = createResolvedType('/node_modules/react/index.d.ts');

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(0);
      expect(mockProject.addSourceFileAtPath).not.toHaveBeenCalled();
    });

    test('handles type-only imports', () => {
      const resolvedType = createResolvedType('/project/src/index.ts');

      const mockDefaultImport = { getText: () => 'DefaultType' };
      const mockImportDecl = {
        getModuleSpecifierValue: () => './types',
        getNamedImports: () => [],
        isTypeOnly: () => true,
        getDefaultImport: () => mockDefaultImport,
      };

      const mockIndexSourceFile = {
        getImportDeclarations: () => [mockImportDecl],
      };

      const mockEmptySourceFile = createMockSourceFile([]);

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/index.ts') return mockIndexSourceFile;
        return mockEmptySourceFile; // Transitive files have no imports
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        typeName: 'DefaultType',
        sourceFile: '/project/src/types.ts',
      });
    });

    test('handles default imports in regular (non-type-only) imports', () => {
      const resolvedType = createResolvedType('/project/src/index.ts');

      const mockDefaultImport = { getText: () => 'Component' };
      const mockImportDecl = {
        getModuleSpecifierValue: () => './component',
        getNamedImports: () => [],
        isTypeOnly: () => false, // Regular import, not type-only
        getDefaultImport: () => mockDefaultImport,
      };

      const mockIndexSourceFile = {
        getImportDeclarations: () => [mockImportDecl],
      };

      const mockEmptySourceFile = createMockSourceFile([]);

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/index.ts') return mockIndexSourceFile;
        return mockEmptySourceFile; // Transitive files have no imports
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        typeName: 'Component',
        sourceFile: '/project/src/component.ts',
      });
    });

    test('skips external module imports', () => {
      const resolvedType = createResolvedType('/project/src/index.ts');

      const mockIndexSourceFile = createMockSourceFile([
        createMockImportDeclaration('react', ['Component']),
        createMockImportDeclaration('./types', ['User']),
        createMockImportDeclaration('lodash', ['map']),
      ]);

      const mockEmptySourceFile = createMockSourceFile([]);

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/index.ts') return mockIndexSourceFile;
        return mockEmptySourceFile; // Transitive files have no imports
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      // Should only include local imports (./types)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        typeName: 'User',
        sourceFile: '/project/src/types.ts',
      });
    });

    test('follows transitive dependencies recursively', () => {
      const resolvedType = createResolvedType('/project/src/index.ts');

      // First file imports from ./types
      const mockIndexFile = createMockSourceFile([
        createMockImportDeclaration('./types', ['User']),
      ]);

      // Types file imports from ../shared
      const mockTypesFile = createMockSourceFile([
        createMockImportDeclaration('../shared', ['BaseEntity']),
      ]);

      // Shared file (no more imports)
      const mockSharedFile = createMockSourceFile([]);

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/index.ts') return mockIndexFile;
        if (path === '/project/src/types.ts') return mockTypesFile;
        if (path === '/project/shared.ts') return mockSharedFile;
        throw new Error(`Unexpected path: ${path}`);
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        typeName: 'User',
        sourceFile: '/project/src/types.ts',
      });
      expect(result).toContainEqual({
        typeName: 'BaseEntity',
        sourceFile: '/project/shared.ts',
      });

      expect(mockProject.addSourceFileAtPath).toHaveBeenCalledTimes(3);
    });

    test('prevents infinite recursion with circular dependencies', () => {
      const resolvedType = createResolvedType('/project/src/a.ts');

      // a.ts imports from ./b
      const mockAFile = createMockSourceFile([createMockImportDeclaration('./b', ['TypeB'])]);

      // b.ts imports from ./a (circular)
      const mockBFile = createMockSourceFile([createMockImportDeclaration('./a', ['TypeA'])]);

      let callCount = 0;
      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        callCount++;
        if (path === '/project/src/a.ts') return mockAFile;
        if (path === '/project/src/b.ts') return mockBFile;
        throw new Error(`Unexpected path: ${path}`);
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        typeName: 'TypeB',
        sourceFile: '/project/src/b.ts',
      });
      expect(result).toContainEqual({
        typeName: 'TypeA',
        sourceFile: '/project/src/a.ts',
      });

      // Should only be called once for each file due to visited tracking
      expect(callCount).toBe(2);
    });

    test('filters out invalid type names', () => {
      const resolvedType = createResolvedType('/project/src/index.ts');

      const mockIndexSourceFile = createMockSourceFile([
        createMockImportDeclaration('./types', ['User', 'lowercase', 'API', 'invalid-name']),
      ]);

      const mockEmptySourceFile = createMockSourceFile([]);

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/index.ts') return mockIndexSourceFile;
        return mockEmptySourceFile; // Transitive files have no imports
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      // Only 'User' and 'API' should be valid (start with capital letter)
      expect(result).toHaveLength(2);
      expect(result.map(d => d.typeName)).toContain('User');
      expect(result.map(d => d.typeName)).toContain('API');
      expect(result.map(d => d.typeName)).not.toContain('lowercase');
      expect(result.map(d => d.typeName)).not.toContain('invalid-name');
    });

    test('handles file analysis errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const resolvedType = createResolvedType('/project/src/index.ts');

      mockProject.addSourceFileAtPath.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error analyzing file /project/src/index.ts:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    test('handles project creation errors gracefully', () => {
      (Project as any).mockImplementation(() => {
        throw new Error('Project creation failed');
      });

      const resolvedType = createResolvedType('/project/src/index.ts');
      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(0);
    });

    test('reuses project instance across calls', () => {
      const resolvedType1 = createResolvedType('/project/src/a.ts');
      const resolvedType2 = createResolvedType('/project/src/b.ts');

      mockProject.addSourceFileAtPath.mockReturnValue(createMockSourceFile([]));

      resolver.discoverTransitiveDependencies(resolvedType1);
      resolver.discoverTransitiveDependencies(resolvedType2);

      // Project constructor should only be called once
      expect(Project).toHaveBeenCalledTimes(1);
    });

    test('returns empty array when no imports found', () => {
      const resolvedType = createResolvedType('/project/src/empty.ts');

      const mockSourceFile = createMockSourceFile([]);
      mockProject.addSourceFileAtPath.mockReturnValue(mockSourceFile);

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      expect(result).toHaveLength(0);
    });

    test('handles deep transitive dependency chains correctly', () => {
      // This test validates the critical user-reported issue with deep transitive dependencies
      // Chain: a.ts -> B -> C -> D -> E (5 levels deep)
      const resolvedType = createResolvedType('/project/src/a.ts');

      // Mock file structures for deep dependency chain
      const mockAFile = createMockSourceFile([createMockImportDeclaration('./b', ['B'])]);

      const mockBFile = createMockSourceFile([createMockImportDeclaration('./c', ['C'])]);

      const mockCFile = createMockSourceFile([createMockImportDeclaration('./d', ['D'])]);

      const mockDFile = createMockSourceFile([createMockImportDeclaration('./e', ['E'])]);

      const mockEFile = createMockSourceFile([]); // Terminal file

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/a.ts') return mockAFile;
        if (path === '/project/src/b.ts') return mockBFile;
        if (path === '/project/src/c.ts') return mockCFile;
        if (path === '/project/src/d.ts') return mockDFile;
        if (path === '/project/src/e.ts') return mockEFile;
        return createMockSourceFile([]); // Default empty
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      // Should discover all transitive dependencies: B, C, D, E
      expect(result).toHaveLength(4);
      expect(result).toContainEqual({
        typeName: 'B',
        sourceFile: '/project/src/b.ts',
      });
      expect(result).toContainEqual({
        typeName: 'C',
        sourceFile: '/project/src/c.ts',
      });
      expect(result).toContainEqual({
        typeName: 'D',
        sourceFile: '/project/src/d.ts',
      });
      expect(result).toContainEqual({
        typeName: 'E',
        sourceFile: '/project/src/e.ts',
      });

      // Verify all files were analyzed (visited tracking)
      expect(mockProject.addSourceFileAtPath).toHaveBeenCalledTimes(5);
      expect(mockProject.addSourceFileAtPath).toHaveBeenCalledWith('/project/src/a.ts');
      expect(mockProject.addSourceFileAtPath).toHaveBeenCalledWith('/project/src/b.ts');
      expect(mockProject.addSourceFileAtPath).toHaveBeenCalledWith('/project/src/c.ts');
      expect(mockProject.addSourceFileAtPath).toHaveBeenCalledWith('/project/src/d.ts');
      expect(mockProject.addSourceFileAtPath).toHaveBeenCalledWith('/project/src/e.ts');
    });

    test('handles complex branching transitive dependencies', () => {
      // Tests multiple import branches from single file
      // a.ts -> [B, C], b.ts -> [D], c.ts -> [E, F]
      const resolvedType = createResolvedType('/project/src/a.ts');

      const mockAFile = createMockSourceFile([
        createMockImportDeclaration('./b', ['B']),
        createMockImportDeclaration('./c', ['C']),
      ]);

      const mockBFile = createMockSourceFile([createMockImportDeclaration('./d', ['D'])]);

      const mockCFile = createMockSourceFile([
        createMockImportDeclaration('./e', ['E']),
        createMockImportDeclaration('./f', ['F']),
      ]);

      const mockDFile = createMockSourceFile([]);
      const mockEFile = createMockSourceFile([]);
      const mockFFile = createMockSourceFile([]);

      mockProject.addSourceFileAtPath.mockImplementation((path: string) => {
        if (path === '/project/src/a.ts') return mockAFile;
        if (path === '/project/src/b.ts') return mockBFile;
        if (path === '/project/src/c.ts') return mockCFile;
        if (path === '/project/src/d.ts') return mockDFile;
        if (path === '/project/src/e.ts') return mockEFile;
        if (path === '/project/src/f.ts') return mockFFile;
        return createMockSourceFile([]);
      });

      const result = resolver.discoverTransitiveDependencies(resolvedType);

      // Should discover all dependencies across branches
      expect(result).toHaveLength(5); // B, C, D, E, F
      expect(result).toContainEqual({
        typeName: 'B',
        sourceFile: '/project/src/b.ts',
      });
      expect(result).toContainEqual({
        typeName: 'C',
        sourceFile: '/project/src/c.ts',
      });
      expect(result).toContainEqual({
        typeName: 'D',
        sourceFile: '/project/src/d.ts',
      });
      expect(result).toContainEqual({
        typeName: 'E',
        sourceFile: '/project/src/e.ts',
      });
      expect(result).toContainEqual({
        typeName: 'F',
        sourceFile: '/project/src/f.ts',
      });
    });
  });

  describe('dispose', () => {
    test('clears project reference', () => {
      const resolvedType = createResolvedType('/project/src/index.ts');
      mockProject.addSourceFileAtPath.mockReturnValue(createMockSourceFile([]));

      // Initialize project
      resolver.discoverTransitiveDependencies(resolvedType);

      // Dispose
      resolver.dispose();

      // Next call should create new project
      resolver.discoverTransitiveDependencies(resolvedType);

      expect(Project).toHaveBeenCalledTimes(2);
    });

    test('handles dispose when project is undefined', () => {
      expect(() => resolver.dispose()).not.toThrow();
    });
  });

  // Helper functions
  function createResolvedType(sourceFile: string): ResolvedType {
    return {
      name: 'TestType',
      sourceFile,
      typeInfo: { kind: TypeKind.Primitive, name: 'string' },
      imports: [],
      dependencies: [],
    };
  }

  function createMockImportDeclaration(moduleSpecifier: string, namedImports: string[]) {
    return {
      getModuleSpecifierValue: () => moduleSpecifier,
      getNamedImports: () => namedImports.map(name => ({ getName: () => name })),
      isTypeOnly: () => false,
      getDefaultImport: () => null,
    };
  }

  function createMockSourceFile(importDeclarations: any[]) {
    return {
      getImportDeclarations: () => importDeclarations,
    };
  }
});
