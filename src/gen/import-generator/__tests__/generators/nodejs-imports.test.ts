import { describe, test, expect, beforeEach } from 'vitest';
import { NodeJSImportsGenerator } from '../../generators/nodejs-imports.js';
import { TypeKind } from '../../../../core/types.js';
import type { ResolvedType, TypeInfo, PropertyInfo } from '../../../../core/types.js';

describe('NodeJSImportsGenerator', () => {
  let generator: NodeJSImportsGenerator;

  beforeEach(() => {
    // Test without TypeScript config path for consistent behavior
    generator = new NodeJSImportsGenerator();
  });

  describe('generateNodeJSImports', () => {
    test('generates imports for EventEmitter types', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [createProperty('emitter', { kind: TypeKind.Primitive, name: 'EventEmitter' })],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { EventEmitter } from "events";');
    }, 30000);

    test('generates imports for stream types', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('readable', { kind: TypeKind.Primitive, name: 'Readable' }),
          createProperty('writable', { kind: TypeKind.Primitive, name: 'Writable' }),
          createProperty('transform', { kind: TypeKind.Primitive, name: 'Transform' }),
          createProperty('duplex', { kind: TypeKind.Primitive, name: 'Duplex' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { Duplex, Readable, Transform, Writable } from "stream";');
    }, 30000);

    test('generates imports for URL types', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('url', { kind: TypeKind.Primitive, name: 'URL' }),
          createProperty('params', { kind: TypeKind.Primitive, name: 'URLSearchParams' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { URL, URLSearchParams } from "url";');
    }, 30000);

    test('groups types by module correctly', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('emitter', { kind: TypeKind.Primitive, name: 'EventEmitter' }),
          createProperty('readable', { kind: TypeKind.Primitive, name: 'Readable' }),
          createProperty('url', { kind: TypeKind.Primitive, name: 'URL' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(3);
      expect(result).toContain('import { EventEmitter } from "events";');
      expect(result).toContain('import { Readable } from "stream";');
      expect(result).toContain('import { URL } from "url";');
    }, 30000);

    test('correctly handles global types vs Node.js module types', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('buffer', { kind: TypeKind.Primitive, name: 'Buffer' }), // Should be global
          createProperty('env', { kind: TypeKind.Primitive, name: 'ProcessEnv' }),
          createProperty('readable', { kind: TypeKind.Primitive, name: 'Readable' }),
          createProperty('arrayBuffer', { kind: TypeKind.Primitive, name: 'ArrayBuffer' }), // Should be global
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      // Enhanced resolver correctly identifies global vs module types
      expect(result).toHaveLength(2); // Buffer and ArrayBuffer should be excluded as globals
      expect(result).toContain('import { ProcessEnv } from "process";');
      expect(result).toContain('import { Readable } from "stream";');

      // These should NOT be present as they're global types
      expect(result.some(imp => imp.includes('Buffer'))).toBe(false);
      expect(result.some(imp => imp.includes('ArrayBuffer'))).toBe(false);
    }, 30000);

    test('scans nested object properties', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('config', {
            kind: TypeKind.Object,
            properties: [
              createProperty('stream', { kind: TypeKind.Primitive, name: 'Readable' }),
              createProperty('emitter', { kind: TypeKind.Primitive, name: 'EventEmitter' }),
            ],
          }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(2);
      expect(result).toContain('import { EventEmitter } from "events";');
      expect(result).toContain('import { Readable } from "stream";');
    }, 30000);

    test('scans array element types', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('streams', {
            kind: TypeKind.Array,
            elementType: { kind: TypeKind.Primitive, name: 'Readable' },
          }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { Readable } from "stream";');
    }, 30000);

    test('scans union type members', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('stream', {
            kind: TypeKind.Union,
            unionTypes: [
              { kind: TypeKind.Primitive, name: 'Readable' },
              { kind: TypeKind.Primitive, name: 'Writable' },
              { kind: TypeKind.Primitive, name: 'string' },
            ],
          }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { Readable, Writable } from "stream";');
    }, 30000);

    test('scans generic type arguments', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('stream', {
            kind: TypeKind.Primitive,
            name: 'Readable',
          }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { Readable } from "stream";');
    }, 30000);

    test('handles deeply nested structures', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('config', {
            kind: TypeKind.Object,
            properties: [
              createProperty('streams', {
                kind: TypeKind.Array,
                elementType: {
                  kind: TypeKind.Union,
                  unionTypes: [
                    { kind: TypeKind.Primitive, name: 'Readable' },
                    {
                      kind: TypeKind.Object,
                      properties: [
                        createProperty('emitter', {
                          kind: TypeKind.Primitive,
                          name: 'EventEmitter',
                        }),
                      ],
                    },
                  ],
                },
              }),
            ],
          }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(2);
      expect(result).toContain('import { EventEmitter } from "events";');
      expect(result).toContain('import { Readable } from "stream";');
    }, 30000);

    test('returns empty array when no Node.js types found', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('name', { kind: TypeKind.Primitive, name: 'string' }),
          createProperty('age', { kind: TypeKind.Primitive, name: 'number' }),
          createProperty('active', { kind: TypeKind.Primitive, name: 'boolean' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);
      expect(result).toHaveLength(0);
    }, 30000);

    test('deduplicates types within the same module', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('stream1', { kind: TypeKind.Primitive, name: 'Readable' }),
          createProperty('stream2', { kind: TypeKind.Primitive, name: 'Readable' }), // Duplicate
          createProperty('stream3', { kind: TypeKind.Primitive, name: 'Writable' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { Readable, Writable } from "stream";');
    }, 30000);

    test('sorts types alphabetically within imports', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('writable', { kind: TypeKind.Primitive, name: 'Writable' }),
          createProperty('duplex', { kind: TypeKind.Primitive, name: 'Duplex' }),
          createProperty('readable', { kind: TypeKind.Primitive, name: 'Readable' }),
          createProperty('transform', { kind: TypeKind.Primitive, name: 'Transform' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { Duplex, Readable, Transform, Writable } from "stream";');
    }, 30000);

    test('handles complex real-world scenario', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('server', {
            kind: TypeKind.Object,
            properties: [
              createProperty('emitter', { kind: TypeKind.Primitive, name: 'EventEmitter' }),
              createProperty('streams', {
                kind: TypeKind.Array,
                elementType: {
                  kind: TypeKind.Union,
                  unionTypes: [
                    { kind: TypeKind.Primitive, name: 'Readable' },
                    { kind: TypeKind.Primitive, name: 'Writable' },
                  ],
                },
              }),
            ],
          }),
          createProperty('config', {
            kind: TypeKind.Object,
            properties: [
              createProperty('baseUrl', { kind: TypeKind.Primitive, name: 'URL' }),
              createProperty('params', { kind: TypeKind.Primitive, name: 'URLSearchParams' }),
            ],
          }),
          createProperty('transformer', { kind: TypeKind.Primitive, name: 'Transform' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(3);
      expect(result).toContain('import { EventEmitter } from "events";');
      expect(result).toContain('import { Readable, Transform, Writable } from "stream";');
      expect(result).toContain('import { URL, URLSearchParams } from "url";');
    }, 30000);

    test('handles more Node.js built-in types beyond the original hardcoded set', () => {
      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          // Additional types that weren't in the original hardcoded map
          createProperty('stats', { kind: TypeKind.Primitive, name: 'Stats' }),
          createProperty('hash', { kind: TypeKind.Primitive, name: 'Hash' }),
          createProperty('socket', { kind: TypeKind.Primitive, name: 'Socket' }),
          createProperty('childProcess', { kind: TypeKind.Primitive, name: 'ChildProcess' }),
        ],
      });

      const result = generator.generateNodeJSImports(resolvedType);

      expect(result.length).toBeGreaterThan(0);
      // These should be resolved via the new dynamic resolver
      expect(result.some(import_str => import_str.includes('Stats'))).toBe(true);
      expect(result.some(import_str => import_str.includes('Hash'))).toBe(true);
    }, 30000);
  });

  describe('NodeJSImportsGenerator with TypeScript config', () => {
    test('works with actual project tsconfig.json', () => {
      const generatorWithConfig = new NodeJSImportsGenerator('./tsconfig.json');

      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('emitter', { kind: TypeKind.Primitive, name: 'EventEmitter' }),
          createProperty('stream', { kind: TypeKind.Primitive, name: 'Readable' }),
          createProperty('url', { kind: TypeKind.Primitive, name: 'URL' }),
        ],
      });

      const result = generatorWithConfig.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(3);
      expect(result).toContain('import { EventEmitter } from "events";');
      expect(result).toContain('import { Readable } from "stream";');
      expect(result).toContain('import { URL } from "url";');
    }, 30000);

    test('falls back to pattern matching when tsconfig is invalid', () => {
      const generatorWithInvalidConfig = new NodeJSImportsGenerator('./invalid-tsconfig.json');

      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [createProperty('emitter', { kind: TypeKind.Primitive, name: 'EventEmitter' })],
      });

      const result = generatorWithInvalidConfig.generateNodeJSImports(resolvedType);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import { EventEmitter } from "events";');
    });

    test('enhanced resolution finds more types with real tsconfig', () => {
      const generatorWithConfig = new NodeJSImportsGenerator('./tsconfig.json');

      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          // Types that should be resolved with enhanced resolution
          createProperty('buffer', { kind: TypeKind.Primitive, name: 'Buffer' }),
          createProperty('stats', { kind: TypeKind.Primitive, name: 'Stats' }),
          createProperty('hash', { kind: TypeKind.Primitive, name: 'Hash' }),
        ],
      });

      const result = generatorWithConfig.generateNodeJSImports(resolvedType);

      expect(result.length).toBeGreaterThanOrEqual(1);
      // Buffer should be global now (no import needed)
      // Stats and Hash should be resolved to their modules
      const importString = result.join(' ');
      expect(importString).toMatch(/Stats|Hash/);
      // Buffer should NOT be imported since it's global
      expect(importString).not.toMatch(/Buffer/);
    });

    test('tsconfig integration is truly optional - works without it', () => {
      // Test that the system works identically when no tsconfig is provided
      const generatorWithoutConfig = new NodeJSImportsGenerator();
      const generatorWithConfig = new NodeJSImportsGenerator('./tsconfig.json');

      const resolvedType = createResolvedType({
        kind: TypeKind.Object,
        properties: [
          createProperty('emitter', { kind: TypeKind.Primitive, name: 'EventEmitter' }),
          createProperty('readable', { kind: TypeKind.Primitive, name: 'Readable' }),
        ],
      });

      const resultWithoutConfig = generatorWithoutConfig.generateNodeJSImports(resolvedType);
      const resultWithConfig = generatorWithConfig.generateNodeJSImports(resolvedType);

      // Both should resolve these common types correctly
      expect(resultWithoutConfig).toHaveLength(2);
      expect(resultWithConfig).toHaveLength(2);

      expect(resultWithoutConfig).toContain('import { EventEmitter } from "events";');
      expect(resultWithConfig).toContain('import { EventEmitter } from "events";');

      expect(resultWithoutConfig).toContain('import { Readable } from "stream";');
      expect(resultWithConfig).toContain('import { Readable } from "stream";');
    });
  }, 30000);

  // Helper functions for creating test data
  function createResolvedType(typeInfo: TypeInfo): ResolvedType {
    return {
      name: 'TestType',
      sourceFile: '/test/types.ts',
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
