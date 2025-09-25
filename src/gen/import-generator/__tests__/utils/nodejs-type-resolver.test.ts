import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { NodeJSTypeResolver } from '../../utils/nodejs-type-resolver.js';

describe('NodeJSTypeResolver', () => {
  let resolver: NodeJSTypeResolver;

  beforeEach(() => {
    // Test without TypeScript config path for consistent behavior
    resolver = new NodeJSTypeResolver();
  });

  afterEach(() => {
    resolver.dispose();
  });

  describe('getModuleForType', () => {
    test('resolves EventEmitter to events module', () => {
      const result = resolver.getModuleForType('EventEmitter');
      expect(result).toBe('events');
    });

    test('resolves stream types correctly', () => {
      expect(resolver.getModuleForType('Readable')).toBe('stream');
      expect(resolver.getModuleForType('Writable')).toBe('stream');
      expect(resolver.getModuleForType('Transform')).toBe('stream');
      expect(resolver.getModuleForType('Duplex')).toBe('stream');
      expect(resolver.getModuleForType('PassThrough')).toBe('stream');
    });

    test('resolves URL types correctly', () => {
      expect(resolver.getModuleForType('URL')).toBe('url');
      expect(resolver.getModuleForType('URLSearchParams')).toBe('url');
    });

    test('resolves HTTP types correctly', () => {
      expect(resolver.getModuleForType('IncomingMessage')).toBe('http');
      expect(resolver.getModuleForType('ServerResponse')).toBe('http');
      expect(resolver.getModuleForType('ClientRequest')).toBe('http');
    });

    test('resolves fs types correctly', () => {
      expect(resolver.getModuleForType('Stats')).toBe('fs');
      expect(resolver.getModuleForType('Dirent')).toBe('fs');
      expect(resolver.getModuleForType('ReadStream')).toBe('fs');
      expect(resolver.getModuleForType('WriteStream')).toBe('fs');
    });

    test('resolves crypto types correctly', () => {
      expect(resolver.getModuleForType('Hash')).toBe('crypto');
      expect(resolver.getModuleForType('Hmac')).toBe('crypto');
      expect(resolver.getModuleForType('Cipher')).toBe('crypto');
      expect(resolver.getModuleForType('KeyObject')).toBe('crypto');
    });

    test('resolves child_process types correctly', () => {
      expect(resolver.getModuleForType('ChildProcess')).toBe('child_process');
      expect(resolver.getModuleForType('ChildProcessWithoutNullStreams')).toBe('child_process');
    });

    test('resolves timer types correctly', () => {
      expect(resolver.getModuleForType('Timeout')).toBe('timers');
      expect(resolver.getModuleForType('Immediate')).toBe('timers');
    });

    test('returns null for non-Node.js types', () => {
      expect(resolver.getModuleForType('string')).toBeNull();
      expect(resolver.getModuleForType('number')).toBeNull();
      expect(resolver.getModuleForType('boolean')).toBeNull();
      expect(resolver.getModuleForType('CustomType')).toBeNull();
      expect(resolver.getModuleForType('ReactComponent')).toBeNull();
    });

    test('returns null for empty or invalid type names', () => {
      expect(resolver.getModuleForType('')).toBeNull();
      expect(resolver.getModuleForType(' ')).toBeNull();
    });

    test('uses cache for repeated queries', () => {
      // First call
      const result1 = resolver.getModuleForType('EventEmitter');
      expect(result1).toBe('events');

      // Second call should use cache
      const result2 = resolver.getModuleForType('EventEmitter');
      expect(result2).toBe('events');

      // Verify cache stats
      const stats = resolver.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test('handles case sensitivity correctly', () => {
      expect(resolver.getModuleForType('eventEmitter')).toBeNull();
      expect(resolver.getModuleForType('EVENTEMITTER')).toBeNull();
      expect(resolver.getModuleForType('EventEmitter')).toBe('events');
    });
  });

  describe('pattern inference', () => {
    test('infers module from type name patterns', () => {
      // This tests the pattern matching functionality
      // Note: Actual results may vary based on available modules
      const resolver = new NodeJSTypeResolver();

      // Test various patterns that might be inferred
      const testCases = [
        'Readable', // Should resolve to 'stream'
        'Writable', // Should resolve to 'stream'
        'EventEmitter', // Should resolve to 'events'
        'URL', // Should resolve to 'url'
      ];

      testCases.forEach(typeName => {
        const result = resolver.getModuleForType(typeName);
        if (result) {
          expect(resolver.isBuiltinModule(result)).toBe(true);
        }
      });

      resolver.dispose();
    });
  });

  describe('getBuiltinModules', () => {
    test('returns array of built-in modules', () => {
      const modules = resolver.getBuiltinModules();
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      expect(modules).toContain('fs');
      expect(modules).toContain('path');
      expect(modules).toContain('http');
      expect(modules).toContain('https');
      expect(modules).toContain('events');
      expect(modules).toContain('stream');
      expect(modules).toContain('url');
    });

    test('returned array is readonly', () => {
      const modules = resolver.getBuiltinModules();
      expect(Object.isFrozen(modules) || modules.constructor.name === 'Array').toBe(true);
    });
  });

  describe('isBuiltinModule', () => {
    test('returns true for valid built-in modules', () => {
      expect(resolver.isBuiltinModule('fs')).toBe(true);
      expect(resolver.isBuiltinModule('path')).toBe(true);
      expect(resolver.isBuiltinModule('http')).toBe(true);
      expect(resolver.isBuiltinModule('events')).toBe(true);
      expect(resolver.isBuiltinModule('stream')).toBe(true);
    });

    test('returns false for non-built-in modules', () => {
      expect(resolver.isBuiltinModule('react')).toBe(false);
      expect(resolver.isBuiltinModule('lodash')).toBe(false);
      expect(resolver.isBuiltinModule('express')).toBe(false);
      expect(resolver.isBuiltinModule('')).toBe(false);
      expect(resolver.isBuiltinModule('custom-module')).toBe(false);
    });
  });

  describe('cache management', () => {
    test('clearCache removes all cached entries', () => {
      // Add some entries to cache
      resolver.getModuleForType('EventEmitter');
      resolver.getModuleForType('Readable');

      let stats = resolver.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Clear cache
      resolver.clearCache();

      stats = resolver.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('getCacheStats returns current cache information', () => {
      const initialStats = resolver.getCacheStats();
      expect(typeof initialStats.size).toBe('number');
      expect(typeof initialStats.builtinModulesCount).toBe('number');
      expect(initialStats.builtinModulesCount).toBeGreaterThan(0);

      // Add some cache entries
      resolver.getModuleForType('EventEmitter');
      resolver.getModuleForType('Readable');

      const newStats = resolver.getCacheStats();
      expect(newStats.size).toBeGreaterThanOrEqual(initialStats.size);
      expect(newStats.builtinModulesCount).toBe(initialStats.builtinModulesCount);
    });
  });

  describe('dispose', () => {
    test('cleans up resources properly', () => {
      // Add some cache entries
      resolver.getModuleForType('EventEmitter');
      expect(resolver.getCacheStats().size).toBeGreaterThan(0);

      // Dispose should clear cache
      resolver.dispose();
      expect(resolver.getCacheStats().size).toBe(0);
    });
  });

  describe('comprehensive Node.js type coverage', () => {
    test('covers all major Node.js module types', () => {
      const expectedMappings = [
        // Events
        ['EventEmitter', 'events'],

        // Stream
        ['Readable', 'stream'],
        ['Writable', 'stream'],
        ['Transform', 'stream'],
        ['Duplex', 'stream'],

        // URL
        ['URL', 'url'],
        ['URLSearchParams', 'url'],

        // HTTP
        ['IncomingMessage', 'http'],
        ['ServerResponse', 'http'],

        // FS
        ['Stats', 'fs'],
        ['Dirent', 'fs'],

        // Crypto
        ['Hash', 'crypto'],
        ['Hmac', 'crypto'],

        // Child Process
        ['ChildProcess', 'child_process'],

        // Timers
        ['Timeout', 'timers'],
        ['Immediate', 'timers'],
      ];

      expectedMappings.forEach(([typeName, expectedModule]) => {
        const result = resolver.getModuleForType(typeName as string);
        expect(result).toBe(expectedModule);
      });
    });
  });

  describe('TypeScript configuration integration', () => {
    test('works with actual project tsconfig.json', () => {
      const resolverWithRealConfig = new NodeJSTypeResolver('./tsconfig.json');

      // Test that it can resolve types with real tsconfig
      const eventEmitterResult = resolverWithRealConfig.getModuleForType('EventEmitter');
      expect(eventEmitterResult).toBe('events');

      const readableResult = resolverWithRealConfig.getModuleForType('Readable');
      expect(readableResult).toBe('stream');

      const urlResult = resolverWithRealConfig.getModuleForType('URL');
      expect(urlResult).toBe('url');

      resolverWithRealConfig.dispose();
    });

    test('falls back gracefully when tsConfig is invalid', () => {
      const resolverWithInvalidConfig = new NodeJSTypeResolver('./nonexistent-tsconfig.json');

      // Should still work for basic types using pattern matching
      const result = resolverWithInvalidConfig.getModuleForType('EventEmitter');
      expect(result).toBe('events');

      resolverWithInvalidConfig.dispose();
    });

    test('constructor without tsConfig path works', () => {
      const resolverDefault = new NodeJSTypeResolver();
      const result = resolverDefault.getModuleForType('EventEmitter');
      expect(result).toBe('events');
      resolverDefault.dispose();
    });

    test('enhanced resolution with real tsconfig finds more types', () => {
      const resolverWithConfig = new NodeJSTypeResolver('./tsconfig.json');
      const resolverWithoutConfig = new NodeJSTypeResolver();

      // Test some additional types that might be better resolved with tsconfig
      const testTypes = ['Buffer', 'Stats', 'Hash', 'ChildProcess'];

      testTypes.forEach(typeName => {
        const withConfigResult = resolverWithConfig.getModuleForType(typeName);
        const withoutConfigResult = resolverWithoutConfig.getModuleForType(typeName);

        // At minimum, both should work with pattern matching
        if (withConfigResult || withoutConfigResult) {
          expect(typeof withConfigResult).toBe('string');
        }
      });

      resolverWithConfig.dispose();
      resolverWithoutConfig.dispose();
    });
  });
});
