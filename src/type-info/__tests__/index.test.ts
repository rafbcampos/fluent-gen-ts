import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { TypeExtractor } from '../index.js';
import { TypeResolutionCache } from '../../core/cache.js';
import { PluginManager } from '../../core/plugin/index.js';
import path from 'node:path';
import { writeFile, unlink, mkdir } from 'node:fs/promises';

describe('TypeExtractor', () => {
  const testDir = path.join(process.cwd(), 'test-temp');
  const testFile = path.join(testDir, 'test-types.ts');

  beforeEach(async () => {
    // Create test directory
    try {
      await mkdir(testDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Create a test TypeScript file
    const testContent = `
export interface User {
  /** User identifier */
  id: string;
  /** User full name */
  name: string;
  /** User age */
  age?: number;
  /** User address */
  address: Address;
}

export interface Address {
  /** Street address */
  street: string;
  /** City name */
  city: string;
  /** Country code */
  country: string;
}

export interface Profile {
  /** Associated user */
  user: User;
  /** Biography text */
  bio?: string;
  /** Profile settings */
  settings: Record<string, unknown>;
}

export type UserType = "admin" | "user" | "guest";

export type StringOrNumber = string | number;

export interface GenericContainer<T = string> {
  value: T;
  metadata: Record<string, unknown>;
}
`;

    await writeFile(testFile, testContent);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await unlink(testFile);
    } catch {
      // File might not exist
    }
  });

  describe('constructor', () => {
    test('should create TypeExtractor with default options', () => {
      const extractor = new TypeExtractor();
      expect(extractor).toBeInstanceOf(TypeExtractor);
    });

    test('should create TypeExtractor with custom options', () => {
      const cache = new TypeResolutionCache();
      const pluginManager = new PluginManager();

      const extractor = new TypeExtractor({
        cache,
        pluginManager,
        maxDepth: 5,
      });

      expect(extractor).toBeInstanceOf(TypeExtractor);
    });

    test('should throw error for invalid maxDepth', () => {
      expect(() => new TypeExtractor({ maxDepth: 0 })).toThrow(
        'maxDepth must be between 1 and 100',
      );
      expect(() => new TypeExtractor({ maxDepth: 101 })).toThrow(
        'maxDepth must be between 1 and 100',
      );
    });

    test('should throw error for invalid tsConfigPath', () => {
      expect(() => new TypeExtractor({ tsConfigPath: '' })).toThrow(
        'tsConfigPath must be a non-empty string',
      );
      expect(() => new TypeExtractor({ tsConfigPath: '   ' })).toThrow(
        'tsConfigPath must be a non-empty string',
      );
    });
  });

  describe('extractType', () => {
    let extractor: TypeExtractor;

    beforeEach(() => {
      extractor = new TypeExtractor();
    });

    test('should extract a simple interface', async () => {
      const result = await extractor.extractType(testFile, 'Address');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Address');
        expect(result.value.typeInfo.kind).toBe('object');

        if (result.value.typeInfo.kind === 'object') {
          expect(result.value.typeInfo.properties).toHaveLength(3);

          const streetProp = result.value.typeInfo.properties.find(p => p.name === 'street');
          expect(streetProp).toBeDefined();
          expect(streetProp?.type.kind).toBe('primitive');
          expect(streetProp?.jsDoc).toBe('Street address');
        }
      }
    });

    test('should extract interface with nested types', async () => {
      const result = await extractor.extractType(testFile, 'User');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('User');
        expect(result.value.typeInfo.kind).toBe('object');

        if (result.value.typeInfo.kind === 'object') {
          const addressProp = result.value.typeInfo.properties.find(p => p.name === 'address');
          expect(addressProp).toBeDefined();
          expect(addressProp?.type.kind).toBe('object');
        }
      }
    });

    test('should extract union type', async () => {
      const result = await extractor.extractType(testFile, 'UserType');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('UserType');
        expect(result.value.typeInfo.kind).toBe('union');
      }
    });

    test('should extract generic interface', async () => {
      const result = await extractor.extractType(testFile, 'GenericContainer');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('GenericContainer');
        expect(result.value.typeInfo.kind).toBe('object');
      }
    });

    test('should return error for non-existent file', async () => {
      const result = await extractor.extractType('/non/existent/file.ts', 'User');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('does not exist or is not readable');
      }
    });

    test('should return error for non-existent type', async () => {
      const result = await extractor.extractType(testFile, 'NonExistentType');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("Type 'NonExistentType' not found");
      }
    });

    test('should validate file path', async () => {
      const result = await extractor.extractType('', 'User');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('filePath must be a non-empty string');
      }
    });

    test('should validate file extension', async () => {
      const result = await extractor.extractType('test.js', 'User');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(
          'filePath must be a TypeScript file (.ts, .tsx, or .d.ts)',
        );
      }
    });

    test('should validate type name', async () => {
      const result = await extractor.extractType(testFile, '');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('typeName must be a non-empty string');
      }
    });

    test('should validate type name format', async () => {
      const result = await extractor.extractType(testFile, '123Invalid');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('is not a valid TypeScript identifier');
      }
    });
  });

  describe('extractMultiple', () => {
    let extractor: TypeExtractor;

    beforeEach(() => {
      extractor = new TypeExtractor();
    });

    test('should extract multiple types in parallel', async () => {
      const typeNames = ['User', 'Address', 'Profile'];
      const result = await extractor.extractMultiple(testFile, typeNames);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);

        const names = result.value.map(r => r.name);
        expect(names).toContain('User');
        expect(names).toContain('Address');
        expect(names).toContain('Profile');
      }
    });

    test('should handle empty array', async () => {
      const result = await extractor.extractMultiple(testFile, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    test('should return error if any type fails', async () => {
      const typeNames = ['User', 'NonExistentType', 'Address'];
      const result = await extractor.extractMultiple(testFile, typeNames);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("Type 'NonExistentType' not found");
      }
    });

    test('should validate type names array', async () => {
      // Test with non-array input (testing the runtime type checking)
      const result = await extractor.extractMultiple(
        testFile,
        'not-an-array' as unknown as string[],
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('typeNames must be an array');
      }
    });

    test('should validate each type name in array', async () => {
      const result = await extractor.extractMultiple(testFile, ['User', '123Invalid']);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('is not a valid TypeScript identifier');
      }
    });
  });

  describe('scanFile', () => {
    let extractor: TypeExtractor;

    beforeEach(() => {
      extractor = new TypeExtractor();
    });

    test('should scan file and return all available types', async () => {
      const result = await extractor.scanFile(testFile);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('User');
        expect(result.value).toContain('Address');
        expect(result.value).toContain('Profile');
        expect(result.value).toContain('UserType');
        expect(result.value).toContain('StringOrNumber');
        expect(result.value).toContain('GenericContainer');
      }
    });

    test('should return error for non-existent file', async () => {
      const result = await extractor.scanFile('/non/existent/file.ts');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('does not exist or is not readable');
      }
    });

    test('should validate file path', async () => {
      const result = await extractor.scanFile('');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('filePath must be a non-empty string');
      }
    });
  });

  describe('clearCache', () => {
    test('should clear cache without errors', () => {
      const extractor = new TypeExtractor();
      expect(() => extractor.clearCache()).not.toThrow();
    });
  });

  describe('performance', () => {
    test('extractMultiple should work correctly', async () => {
      const extractor = new TypeExtractor();
      const typeNames = ['User', 'Address', 'Profile'];

      // Test parallel extraction (extractMultiple)
      const parallelResult = await extractor.extractMultiple(testFile, typeNames);

      // Test sequential extraction for comparison
      const sequentialResults = [];
      for (const typeName of typeNames) {
        const result = await extractor.extractType(testFile, typeName);
        sequentialResults.push(result);
      }

      expect(parallelResult.ok).toBe(true);
      expect(sequentialResults.every(r => r.ok)).toBe(true);

      // Both approaches should produce the same results
      if (parallelResult.ok) {
        expect(parallelResult.value).toHaveLength(typeNames.length);

        const parallelNames = parallelResult.value.map(r => r.name).sort();
        const sequentialNames = sequentialResults
          .filter(r => r.ok)
          .map(r => (r as { ok: true; value: { name: string } }).value.name)
          .sort();

        expect(parallelNames).toEqual(sequentialNames);
      }
    });
  });

  describe('error handling', () => {
    test('should handle malformed TypeScript file gracefully', async () => {
      const malformedFile = path.join(testDir, 'malformed.ts');

      await writeFile(
        malformedFile,
        `
        interface User {
          id: string
          // Missing closing brace
      `,
      );

      const extractor = new TypeExtractor();
      const result = await extractor.extractType(malformedFile, 'User');

      // Should handle the error gracefully, either finding the type despite syntax issues
      // or returning a meaningful error message
      if (!result.ok) {
        expect(result.error.message).toBeDefined();
        expect(typeof result.error.message).toBe('string');
      }

      try {
        await unlink(malformedFile);
      } catch {
        // Cleanup
      }
    });
  });
});
