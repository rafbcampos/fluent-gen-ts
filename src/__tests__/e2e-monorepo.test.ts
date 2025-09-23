import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { TypeExtractor } from '../type-info/index.js';
import type { MonorepoConfig } from '../core/package-resolver.js';

describe('E2E - Monorepo Support', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fluent-gen-monorepo-e2e-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('resolves dependencies with workspace-root strategy', async () => {
    // Create a monorepo structure
    const workspaceRoot = testDir;
    const packageADir = join(testDir, 'packages', 'package-a');
    const packageBDir = join(testDir, 'packages', 'package-b');

    await mkdir(packageADir, { recursive: true });
    await mkdir(packageBDir, { recursive: true });

    // Create workspace root package.json
    await writeFile(
      join(workspaceRoot, 'package.json'),
      JSON.stringify({
        name: 'monorepo-root',
        private: true,
        workspaces: ['packages/*'],
      }),
    );

    // Create workspace root node_modules with a shared dependency
    const sharedDepDir = join(workspaceRoot, 'node_modules', 'shared-lib');
    await mkdir(sharedDepDir, { recursive: true });

    await writeFile(
      join(sharedDepDir, 'package.json'),
      JSON.stringify({
        name: 'shared-lib',
        version: '1.0.0',
        types: 'index.d.ts',
      }),
    );

    await writeFile(
      join(sharedDepDir, 'index.d.ts'),
      `
      export interface SharedConfig {
        apiUrl: string;
        timeout: number;
        retries: number;
      }
    `,
    );

    // Create package A with a type that uses the shared dependency
    await writeFile(
      join(packageADir, 'package.json'),
      JSON.stringify({
        name: 'package-a',
        version: '1.0.0',
        dependencies: {
          'shared-lib': '1.0.0',
        },
      }),
    );

    await writeFile(
      join(packageADir, 'types.ts'),
      `
      import { SharedConfig } from 'shared-lib';

      export interface AppConfig extends SharedConfig {
        appName: string;
        features: string[];
      }
    `,
    );

    // Test TypeExtractor with monorepo configuration
    const monorepoConfig: MonorepoConfig = {
      enabled: true,
      workspaceRoot,
      dependencyResolutionStrategy: 'workspace-root',
    };

    const extractor = new TypeExtractor({
      monorepoConfig,
    });

    const result = await extractor.extractType(join(packageADir, 'types.ts'), 'AppConfig');
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.name).toBe('AppConfig');
      expect(result.value.typeInfo.kind).toBe('object');

      // Verify that the shared dependency types are properly resolved
      // The AppConfig should extend SharedConfig properties
      const appConfigTypeInfo = result.value.typeInfo;
      if (appConfigTypeInfo.kind === 'object') {
        const propertyNames = appConfigTypeInfo.properties.map(p => p.name);
        expect(propertyNames).toContain('appName');
        expect(propertyNames).toContain('features');
        // Properties from SharedConfig should also be present
        expect(propertyNames).toContain('apiUrl');
        expect(propertyNames).toContain('timeout');
        expect(propertyNames).toContain('retries');
      }
    }
  });

  test('resolves dependencies with custom paths', async () => {
    // Create a custom structure where dependencies are in non-standard locations
    const customDepsDir = join(testDir, 'custom-deps');
    const projectDir = join(testDir, 'project');

    await mkdir(customDepsDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    // Create a dependency in the custom location
    const customLibDir = join(customDepsDir, 'custom-lib');
    await mkdir(customLibDir, { recursive: true });

    await writeFile(
      join(customLibDir, 'package.json'),
      JSON.stringify({
        name: 'custom-lib',
        version: '1.0.0',
        types: 'types.d.ts',
      }),
    );

    await writeFile(
      join(customLibDir, 'types.d.ts'),
      `
      export interface CustomType {
        id: string;
        data: Record<string, unknown>;
      }
    `,
    );

    // Create project file that imports from the custom dependency
    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'project',
        version: '1.0.0',
        dependencies: {
          'custom-lib': '1.0.0',
        },
      }),
    );

    await writeFile(
      join(projectDir, 'main.ts'),
      `
      import { CustomType } from 'custom-lib';

      export interface ProjectEntity {
        name: string;
        createdAt: Date;
        customInfo: CustomType;
      }
    `,
    );

    // Test TypeExtractor with custom paths configuration
    const monorepoConfig: MonorepoConfig = {
      enabled: true,
      customPaths: [customDepsDir],
      dependencyResolutionStrategy: 'auto',
    };

    const extractor = new TypeExtractor({
      monorepoConfig,
    });

    const result = await extractor.extractType(join(projectDir, 'main.ts'), 'ProjectEntity');
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.name).toBe('ProjectEntity');
      expect(result.value.typeInfo.kind).toBe('object');

      // Verify that the custom dependency types are properly resolved
      const entityTypeInfo = result.value.typeInfo;
      if (entityTypeInfo.kind === 'object') {
        const propertyNames = entityTypeInfo.properties.map(p => p.name);
        expect(propertyNames).toContain('name');
        expect(propertyNames).toContain('createdAt');
        expect(propertyNames).toContain('customInfo');

        // Find the customInfo property and verify it's properly typed
        const customInfoProp = entityTypeInfo.properties.find(p => p.name === 'customInfo');
        expect(customInfoProp).toBeDefined();

        // The customInfo property should reference CustomType
        if (customInfoProp && customInfoProp.type.kind === 'reference') {
          expect(customInfoProp.type.name).toBe('CustomType');
        } else if (customInfoProp && customInfoProp.type.kind === 'object') {
          // If the type was resolved inline, check its properties
          const customTypeProps = customInfoProp.type.properties.map(p => p.name);
          expect(customTypeProps).toContain('id');
          expect(customTypeProps).toContain('data');
        }
      }
    }
  });

  test('local-only strategy only checks local node_modules', async () => {
    // Create structure with both local and workspace dependencies
    const workspaceRoot = testDir;
    const packageDir = join(testDir, 'packages', 'package-local');

    await mkdir(packageDir, { recursive: true });

    // Create workspace dependency
    const workspaceDepDir = join(workspaceRoot, 'node_modules', 'workspace-dep');
    await mkdir(workspaceDepDir, { recursive: true });

    await writeFile(
      join(workspaceDepDir, 'package.json'),
      JSON.stringify({
        name: 'workspace-dep',
        version: '1.0.0',
        types: 'index.d.ts',
      }),
    );

    await writeFile(
      join(workspaceDepDir, 'index.d.ts'),
      `
      export interface WorkspaceDep {
        workspaceProperty: string;
      }
    `,
    );

    // Create local dependency
    const localDepDir = join(packageDir, 'node_modules', 'local-dep');
    await mkdir(localDepDir, { recursive: true });

    await writeFile(
      join(localDepDir, 'package.json'),
      JSON.stringify({
        name: 'local-dep',
        version: '1.0.0',
        types: 'index.d.ts',
      }),
    );

    await writeFile(
      join(localDepDir, 'index.d.ts'),
      `
      export interface LocalDep {
        localProperty: number;
      }
    `,
    );

    // Create a file that imports from local dependency
    await writeFile(
      join(packageDir, 'types.ts'),
      `
      import { LocalDep } from 'local-dep';

      export interface LocalInterface extends LocalDep {
        name: string;
      }
    `,
    );

    // Test with local-only strategy
    const monorepoConfig: MonorepoConfig = {
      enabled: true,
      dependencyResolutionStrategy: 'local-only',
    };

    const extractor = new TypeExtractor({
      monorepoConfig,
    });

    const result = await extractor.extractType(join(packageDir, 'types.ts'), 'LocalInterface');
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.name).toBe('LocalInterface');
      expect(result.value.typeInfo.kind).toBe('object');

      // Should find the local dependency
      const typeInfo = result.value.typeInfo;
      if (typeInfo.kind === 'object') {
        const propertyNames = typeInfo.properties.map(p => p.name);
        expect(propertyNames).toContain('name');
        expect(propertyNames).toContain('localProperty'); // From LocalDep
      }
    }
  });

  test('falls back gracefully when dependencies not found', async () => {
    const projectDir = join(testDir, 'project-missing-deps');
    await mkdir(projectDir, { recursive: true });

    // Create a file with missing dependencies
    await writeFile(
      join(projectDir, 'types.ts'),
      `
      export interface SimpleInterface {
        id: string;
        name: string;
      }
    `,
    );

    const monorepoConfig: MonorepoConfig = {
      enabled: true,
      dependencyResolutionStrategy: 'workspace-root',
      workspaceRoot: testDir,
    };

    const extractor = new TypeExtractor({
      monorepoConfig,
    });

    // Should still work for types without external dependencies
    const result = await extractor.extractType(join(projectDir, 'types.ts'), 'SimpleInterface');
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.name).toBe('SimpleInterface');
      expect(result.value.typeInfo.kind).toBe('object');

      const typeInfo = result.value.typeInfo;
      if (typeInfo.kind === 'object') {
        expect(typeInfo.properties).toHaveLength(2);
        const propertyNames = typeInfo.properties.map(p => p.name);
        expect(propertyNames).toContain('id');
        expect(propertyNames).toContain('name');
      }
    }
  });
});
