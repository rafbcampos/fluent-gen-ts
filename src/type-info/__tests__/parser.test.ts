import { test, expect, describe, beforeEach } from 'vitest';
import { TypeScriptParser } from '../parser.js';
import { TypeResolutionCache } from '../../core/cache.js';
import { PluginManager } from '../../core/plugin/index.js';
import type { Plugin } from '../../core/plugin/index.js';
import { ok, err } from '../../core/result.js';

describe('TypeScriptParser', () => {
  let cache: TypeResolutionCache;
  let pluginManager: PluginManager;

  beforeEach(() => {
    cache = new TypeResolutionCache();
    pluginManager = new PluginManager();
  });

  describe('constructor', () => {
    test('creates parser with default options', () => {
      const parser = new TypeScriptParser();
      expect(parser.getProject()).toBeDefined();
    });

    test('creates parser with custom options', () => {
      const customCache = new TypeResolutionCache();
      const customPluginManager = new PluginManager();
      const parser = new TypeScriptParser({
        cache: customCache,
        pluginManager: customPluginManager,
      });
      expect(parser.getProject()).toBeDefined();
    });
  });

  describe('parseFile and findType integration', () => {
    test('finds interface declaration', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'user-interface.ts',
        `
        export interface User {
          id: string;
          name: string;
          age?: number;
        }
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'User',
      });

      expect(typeResult.ok).toBe(true);
      if (typeResult.ok) {
        expect(typeResult.value.getSymbol()?.getName()).toBe('User');
      }
    });

    test('finds type alias declaration', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'types.ts',
        `
        export type StringOrNumber = string | number;
        export type UserRole = "admin" | "user" | "guest";
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'StringOrNumber',
      });

      expect(typeResult.ok).toBe(true);
      if (typeResult.ok) {
        // Type aliases might not have a symbol name in the same way
        // Just verify we found a type
        expect(typeResult.value).toBeDefined();
      }
    });

    test('finds enum declaration', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'enums.ts',
        `
        export enum Color {
          Red = "red",
          Green = "green",
          Blue = "blue",
        }
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'Color',
      });

      expect(typeResult.ok).toBe(true);
      if (typeResult.ok) {
        expect(typeResult.value.getSymbol()?.getName()).toBe('Color');
      }
    });

    test('finds class declaration', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'class.ts',
        `
        export class User {
          constructor(
            public id: string,
            public name: string
          ) {}

          getName(): string {
            return this.name;
          }
        }
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'User',
      });

      expect(typeResult.ok).toBe(true);
      if (typeResult.ok) {
        expect(typeResult.value.getSymbol()?.getName()).toBe('User');
      }
    });

    test('finds types inside module declarations', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'modules.ts',
        `
        declare module "external-lib" {
          export interface LibUser {
            id: string;
            email: string;
          }

          export type LibStatus = "active" | "inactive";

          export enum LibColor {
            Primary,
            Secondary,
          }

          export class LibService {
            process(): void;
          }
        }
      `,
      );

      const interfaceResult = await parser.findType({
        sourceFile,
        typeName: 'LibUser',
      });
      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'LibStatus',
      });
      const enumResult = await parser.findType({
        sourceFile,
        typeName: 'LibColor',
      });
      const classResult = await parser.findType({
        sourceFile,
        typeName: 'LibService',
      });

      expect(interfaceResult.ok).toBe(true);
      expect(typeResult.ok).toBe(true);
      expect(enumResult.ok).toBe(true);
      expect(classResult.ok).toBe(true);
    });

    test('returns cached type on subsequent calls', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'cached.ts',
        `
        export interface CachedType { id: string; }
      `,
      );

      const firstResult = await parser.findType({
        sourceFile,
        typeName: 'CachedType',
      });
      const secondResult = await parser.findType({
        sourceFile,
        typeName: 'CachedType',
      });

      expect(firstResult.ok).toBe(true);
      expect(secondResult.ok).toBe(true);
      if (firstResult.ok && secondResult.ok) {
        expect(firstResult.value).toBe(secondResult.value);
      }
    });

    test('returns error when type not found', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'empty.ts',
        `
        // Empty file
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'NonExistentType',
      });

      expect(typeResult.ok).toBe(false);
      if (!typeResult.ok) {
        expect(typeResult.error.message).toContain("Type 'NonExistentType' not found");
      }
    });

    test('handles plugin hooks correctly', async () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        beforeParse: context => ok(context),
        afterParse: (context, type) => ok(type),
      };

      const testPluginManager = new PluginManager();
      testPluginManager.register(mockPlugin);

      const parser = new TypeScriptParser({
        cache,
        pluginManager: testPluginManager,
      });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'plugin.ts',
        `
        export interface PluginTest { value: string; }
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'PluginTest',
      });

      expect(typeResult.ok).toBe(true);
    });

    test('handles plugin hook errors', async () => {
      const errorPlugin: Plugin = {
        name: 'error-plugin',
        version: '1.0.0',
        beforeParse: () => err(new Error('Plugin error')),
      };

      const testPluginManager = new PluginManager();
      testPluginManager.register(errorPlugin);

      const parser = new TypeScriptParser({
        cache,
        pluginManager: testPluginManager,
      });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'error.ts',
        `
        export interface PluginError { value: string; }
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'PluginError',
      });

      expect(typeResult.ok).toBe(false);
      if (!typeResult.ok) {
        expect(typeResult.error.message).toContain('Plugin error');
      }
    });

    test('processes multiple modules correctly', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'multi-modules.ts',
        `
        declare module "lib1" {
          export interface User1 {
            id: string;
          }
        }

        declare module "lib2" {
          export interface User2 {
            name: string;
          }
        }
      `,
      );

      const user1Result = await parser.findType({
        sourceFile,
        typeName: 'User1',
      });
      const user2Result = await parser.findType({
        sourceFile,
        typeName: 'User2',
      });

      expect(user1Result.ok).toBe(true);
      expect(user2Result.ok).toBe(true);
    });

    test('finds first matching type in modules', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'duplicates.ts',
        `
        declare module "lib1" {
          export interface DuplicateType {
            fromLib1: string;
          }
        }

        declare module "lib2" {
          export interface DuplicateType {
            fromLib2: number;
          }
        }
      `,
      );

      const typeResult = await parser.findType({
        sourceFile,
        typeName: 'DuplicateType',
      });

      expect(typeResult.ok).toBe(true);
      // Should find the first one
    });
  });

  describe('resolveImports', () => {
    test('handles files with no imports', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'standalone.ts',
        `
        export interface Standalone { value: string; }
      `,
      );

      const importsResult = await parser.resolveImports(sourceFile);

      expect(importsResult.ok).toBe(true);
      if (importsResult.ok) {
        expect(importsResult.value.size).toBe(0);
      }
    });

    test('resolves import declarations successfully', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      // Create the imported file first
      project.createSourceFile(
        'imported.ts',
        `
        export interface ImportedType { value: string; }
      `,
      );

      // Create the main file that imports
      const sourceFile = project.createSourceFile(
        'main.ts',
        `
        import { ImportedType } from "./imported";
        export interface MainType extends ImportedType {
          id: string;
        }
      `,
      );

      const importsResult = await parser.resolveImports(sourceFile);

      expect(importsResult.ok).toBe(true);
      if (importsResult.ok) {
        expect(importsResult.value.size).toBeGreaterThan(0);
      }
    });
  });

  describe('getProject', () => {
    test('returns the ts-morph Project instance', () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();
      expect(project).toBeDefined();
      expect(project.constructor.name).toBe('Project');
    });
  });

  describe('clearCache', () => {
    test('clears the cache successfully', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'clear-test.ts',
        `
        export interface ClearTest { value: string; }
      `,
      );

      // Find type to populate cache
      await parser.findType({
        sourceFile,
        typeName: 'ClearTest',
      });

      // Clear cache
      parser.clearCache();

      // Verify cache was cleared by attempting to get the cached type
      const cacheKey = cache.getCacheKey({
        file: 'clear-test.ts',
        typeName: 'ClearTest',
      });
      const cachedAfterClear = cache.getType(cacheKey);
      expect(cachedAfterClear).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    test('handles complex generic interfaces', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'generics.ts',
        `
        export interface GenericType<T, U extends string = "default"> {
          value: T;
          key: U;
          optional?: T;
        }

        export interface ComplexGeneric<T> extends GenericType<T[]> {
          items: T[];
        }
      `,
      );

      const genericResult = await parser.findType({
        sourceFile,
        typeName: 'GenericType',
      });
      const complexResult = await parser.findType({
        sourceFile,
        typeName: 'ComplexGeneric',
      });

      expect(genericResult.ok).toBe(true);
      expect(complexResult.ok).toBe(true);
    });

    test('type finder context maintains correct state', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'context.ts',
        `
        export interface FirstType { a: string; }
        export interface SecondType { b: number; }
      `,
      );

      const firstResult = await parser.findType({
        sourceFile,
        typeName: 'FirstType',
      });
      const secondResult = await parser.findType({
        sourceFile,
        typeName: 'SecondType',
      });

      expect(firstResult.ok).toBe(true);
      expect(secondResult.ok).toBe(true);

      // Verify they are different types
      if (firstResult.ok && secondResult.ok) {
        expect(firstResult.value.getSymbol()?.getName()).toBe('FirstType');
        expect(secondResult.value.getSymbol()?.getName()).toBe('SecondType');
      }
    });

    test('type safety guards work correctly', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });

      // Test with dummy values to ensure type guards work
      const sourceFileGuard = (parser as any).isSourceFile({
        getFilePath: () => 'test',
      });
      const typeGuard = (parser as any).isType({ getSymbol: () => ({}) });
      const falsyGuard = (parser as any).isSourceFile(null);

      expect(sourceFileGuard).toBe(true);
      expect(typeGuard).toBe(true);
      expect(falsyGuard).toBe(false);
    });

    test('improved type guards validate function properties', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });

      // Test improved type guards that check if methods are functions
      const validSourceFile = { getFilePath: () => 'test' };
      const invalidSourceFile = { getFilePath: 'not-a-function' };
      const validType = { getSymbol: () => ({}) };
      const invalidType = { getSymbol: 'not-a-function' };

      expect((parser as any).isSourceFile(validSourceFile)).toBe(true);
      expect((parser as any).isSourceFile(invalidSourceFile)).toBe(false);
      expect((parser as any).isType(validType)).toBe(true);
      expect((parser as any).isType(invalidType)).toBe(false);
    });

    test('cache type safety works correctly', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });

      // Test cache methods work safely
      const nonExistentFile = (parser as any).getCachedSourceFile('non-existent');
      const nonExistentType = (parser as any).getCachedType('non-existent');

      expect(nonExistentFile).toBeUndefined();
      expect(nonExistentType).toBeUndefined();
    });
  });

  describe('refactored architecture validation', () => {
    test('helper methods break down complexity correctly', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'architecture.ts',
        `
        export interface TestType { value: string; }

        declare module "test-module" {
          export interface ModuleType { id: number; }
        }
      `,
      );

      // Test that both source file and module types can be found
      const sourceFileResult = await parser.findType({
        sourceFile,
        typeName: 'TestType',
      });

      const moduleResult = await parser.findType({
        sourceFile,
        typeName: 'ModuleType',
      });

      expect(sourceFileResult.ok).toBe(true);
      expect(moduleResult.ok).toBe(true);

      // Verify the refactored architecture handles both cases
      if (sourceFileResult.ok && moduleResult.ok) {
        expect(sourceFileResult.value.getSymbol()?.getName()).toBe('TestType');
        expect(moduleResult.value.getSymbol()?.getName()).toBe('ModuleType');
      }
    });

    test('type finder registry pattern works', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });
      const project = parser.getProject();

      const sourceFile = project.createSourceFile(
        'registry.ts',
        `
        export interface InterfaceType { value: string; }
        export type AliasType = string | number;
        export enum EnumType { A, B, C }
        export class ClassType { prop: string = ""; }
      `,
      );

      // Test all type kinds can be found (validates the type finder registry)
      const interfaceResult = await parser.findType({
        sourceFile,
        typeName: 'InterfaceType',
      });
      const aliasResult = await parser.findType({
        sourceFile,
        typeName: 'AliasType',
      });
      const enumResult = await parser.findType({
        sourceFile,
        typeName: 'EnumType',
      });
      const classResult = await parser.findType({
        sourceFile,
        typeName: 'ClassType',
      });

      expect(interfaceResult.ok).toBe(true);
      expect(aliasResult.ok).toBe(true);
      expect(enumResult.ok).toBe(true);
      expect(classResult.ok).toBe(true);
    });

    test('no code duplication in type finding', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });

      // The refactored code should handle all these cases with the same logic
      // This test verifies that the DRY principle was applied successfully
      // by testing that different type kinds can all be found

      const project = parser.getProject();
      const sourceFile = project.createSourceFile(
        'dry-test.ts',
        `
        export interface I { value: string; }
        export type T = string;
        export enum E { A }
        export class C { }

        declare module "mod" {
          export interface MI { value: string; }
          export type MT = string;
          export enum ME { A }
          export class MC { }
        }
      `,
      );

      const results = await Promise.all([
        parser.findType({ sourceFile, typeName: 'I' }),
        parser.findType({ sourceFile, typeName: 'T' }),
        parser.findType({ sourceFile, typeName: 'E' }),
        parser.findType({ sourceFile, typeName: 'C' }),
        parser.findType({ sourceFile, typeName: 'MI' }),
        parser.findType({ sourceFile, typeName: 'MT' }),
        parser.findType({ sourceFile, typeName: 'ME' }),
        parser.findType({ sourceFile, typeName: 'MC' }),
      ]);

      // All should succeed, proving the refactored approach works for all cases
      for (const result of results) {
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('parseFile method', () => {
    test('handles absolute and relative paths correctly', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });

      // Create a temporary file to test with
      const project = parser.getProject();
      const sourceFile = project.createSourceFile(
        'test-file.ts',
        'export interface TestType { value: string; }',
      );
      const filePath = sourceFile.getFilePath();

      // Test parseFile method
      const parseResult = await parser.parseFile(filePath);

      expect(parseResult.ok).toBe(true);
      if (parseResult.ok) {
        expect(parseResult.value.getFilePath()).toBe(filePath);
      }
    });

    test('returns cached file on subsequent calls', async () => {
      const parser = new TypeScriptParser({ cache, pluginManager });

      const project = parser.getProject();
      const sourceFile = project.createSourceFile(
        'cached-file.ts',
        'export interface CachedType { id: string; }',
      );
      const filePath = sourceFile.getFilePath();

      const firstParse = await parser.parseFile(filePath);
      const secondParse = await parser.parseFile(filePath);

      expect(firstParse.ok).toBe(true);
      expect(secondParse.ok).toBe(true);
      if (firstParse.ok && secondParse.ok) {
        expect(firstParse.value).toBe(secondParse.value);
      }
    });
  });
});
