import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TypeDefinitionFinder } from '../type-definition-finder.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('TypeDefinitionFinder', () => {
  let finder: TypeDefinitionFinder;
  let tempDir: string;
  let counter = 0;

  beforeEach(() => {
    finder = new TypeDefinitionFinder();
    tempDir = path.join(os.tmpdir(), `type-finder-test-${Date.now()}-${counter++}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    finder.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createTestFile = (filePath: string, content: string) => {
    const fullPath = path.join(tempDir, filePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content);
    return fullPath;
  };

  test('should find interface declaration in the same file', () => {
    const filePath = createTestFile(
      'test.ts',
      `
      export interface User {
        id: string;
        name: string;
      }
    `,
    );

    const result = finder.findTypeSourceFile('User', filePath);
    expect(result).toBe(filePath);
  });

  test('should find type alias declaration', () => {
    const filePath = createTestFile(
      'test.ts',
      `
      export type Status = 'active' | 'inactive';
    `,
    );

    const result = finder.findTypeSourceFile('Status', filePath);
    expect(result).toBe(filePath);
  });

  test('should find class declaration used as type', () => {
    const filePath = createTestFile(
      'test.ts',
      `
      export class UserModel {
        id: string;
        name: string;
      }
    `,
    );

    const result = finder.findTypeSourceFile('UserModel', filePath);
    expect(result).toBe(filePath);
  });

  test('should find type through relative imports', () => {
    const typeFilePath = createTestFile(
      'types.ts',
      `
      export interface Product {
        id: string;
        price: number;
      }
    `,
    );

    const mainFilePath = createTestFile(
      'main.ts',
      `
      import { Product } from './types';
    `,
    );

    const result = finder.findTypeSourceFile('Product', mainFilePath);
    expect(result).toBe(typeFilePath);
  });

  test('should handle circular imports without infinite loop', () => {
    const fileAPath = createTestFile(
      'a.ts',
      `
      import { TypeB } from './b';
      export interface TypeA {
        b: TypeB;
      }
    `,
    );

    const fileBPath = createTestFile(
      'b.ts',
      `
      import { TypeA } from './a';
      export interface TypeB {
        a: TypeA;
      }
    `,
    );

    const result = finder.findTypeSourceFile('TypeB', fileAPath);
    expect(result).toBe(fileBPath);
  });

  test('should return null for non-existent type', () => {
    const filePath = createTestFile(
      'test.ts',
      `
      export interface User {
        id: string;
      }
    `,
    );

    const result = finder.findTypeSourceFile('NonExistentType', filePath);
    expect(result).toBeNull();
  });

  test('should return null for invalid inputs', () => {
    const filePath = createTestFile('test.ts', '');

    expect(finder.findTypeSourceFile('', filePath)).toBeNull();
    expect(finder.findTypeSourceFile('Type', '')).toBeNull();
    expect(finder.findTypeSourceFile('', '')).toBeNull();
  });

  test('should use cache for repeated lookups', () => {
    const filePath = createTestFile(
      'test.ts',
      `
      export interface CachedType {
        id: string;
      }
    `,
    );

    // First call
    const result1 = finder.findTypeSourceFile('CachedType', filePath);
    expect(result1).toBe(filePath);

    // Delete the file to ensure cache is being used
    fs.unlinkSync(filePath);

    // Second call should use cache
    const result2 = finder.findTypeSourceFile('CachedType', filePath);
    expect(result2).toBe(filePath);
  });

  test('should handle index.ts imports', () => {
    const indexPath = createTestFile(
      'types/index.ts',
      `
      export interface IndexType {
        value: string;
      }
    `,
    );

    const mainPath = createTestFile(
      'main.ts',
      `
      import { IndexType } from './types';
    `,
    );

    const result = finder.findTypeSourceFile('IndexType', mainPath);
    expect(result).toBe(indexPath);
  });

  test('should handle .js extension in imports', () => {
    const typeFilePath = createTestFile(
      'types.ts',
      `
      export type Config = {
        port: number;
      };
    `,
    );

    const mainPath = createTestFile(
      'main.ts',
      `
      import { Config } from './types.js';
    `,
    );

    const result = finder.findTypeSourceFile('Config', mainPath);
    expect(result).toBe(typeFilePath);
  });

  test('should not follow non-relative imports', () => {
    const mainPath = createTestFile(
      'main.ts',
      `
      import { Express } from 'express';
      export type App = Express;
    `,
    );

    const result = finder.findTypeSourceFile('Express', mainPath);
    expect(result).toBeNull();
  });

  test('should find types in re-exports', () => {
    createTestFile(
      'original.ts',
      `
      export interface Original {
        id: string;
      }
    `,
    );

    const reExportPath = createTestFile(
      'reexport.ts',
      `
      export { Original } from './original';
    `,
    );

    const mainPath = createTestFile(
      'main.ts',
      `
      import { Original } from './reexport';
    `,
    );

    const result = finder.findTypeSourceFile('Original', mainPath);
    // Should find it in the re-export file
    expect(result).toBe(reExportPath);
  });

  test('should handle complex circular dependencies', () => {
    const fileAPath = createTestFile(
      'a.ts',
      `
      import { TypeB } from './b';
      import { TypeC } from './c';
      export interface TypeA {
        b: TypeB;
        c: TypeC;
      }
    `,
    );

    createTestFile(
      'b.ts',
      `
      import { TypeC } from './c';
      export interface TypeB {
        c: TypeC;
      }
    `,
    );

    const fileCPath = createTestFile(
      'c.ts',
      `
      import { TypeA } from './a';
      export interface TypeC {
        a: TypeA;
      }
    `,
    );

    // Should find TypeC despite circular dependencies
    const result = finder.findTypeSourceFile('TypeC', fileAPath);
    expect(result).toBe(fileCPath);
  });

  test('dispose should clear all internal state', () => {
    const filePath = createTestFile(
      'test.ts',
      `
      export interface DisposableType {
        id: string;
      }
    `,
    );

    // First lookup
    finder.findTypeSourceFile('DisposableType', filePath);

    // Dispose
    finder.dispose();

    // Delete the file
    fs.unlinkSync(filePath);

    // After dispose, should not use cache and return null for missing file
    const result = finder.findTypeSourceFile('DisposableType', filePath);
    expect(result).toBeNull();
  });
});
