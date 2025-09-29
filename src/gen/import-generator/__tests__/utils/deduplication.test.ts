import { describe, test, expect, vi } from 'vitest';
import {
  deduplicateImports,
  extractImportedTypes,
  extractModulesFromNamedImports,
  resolveImportConflicts,
} from '../../utils/deduplication.js';

describe('deduplication utilities', () => {
  describe('deduplicateImports', () => {
    test('removes exact duplicate imports', () => {
      const imports = [
        'import type { User } from "./types.js";',
        'import type { User } from "./types.js";',
        'import { api } from "./api.js";',
      ];
      const result = deduplicateImports(imports);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        'import type { User } from "./types.js";',
        'import { api } from "./api.js";',
      ]);
    });

    test('removes semantic duplicates - same type from different imports', () => {
      const imports = [
        'import type { User } from "./types.js";',
        'import type { User, Profile } from "./other.js";', // User is duplicate
      ];
      const result = deduplicateImports(imports);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('import type { User } from "./types.js";');
    });

    test('preserves different types from same module', () => {
      const imports = [
        'import type { User } from "./types.js";',
        'import type { Profile } from "./types.js";',
      ];
      const result = deduplicateImports(imports);
      expect(result).toHaveLength(2);
    });

    test('handles mixed type and value imports correctly', () => {
      const imports = [
        'import type { User } from "react";',
        'import { useState } from "react";',
        'import type { FC } from "react";',
      ];
      const result = deduplicateImports(imports);
      expect(result).toHaveLength(3); // All should be preserved as they're different types
    });

    test('removes whitespace-only and empty imports', () => {
      const imports = [
        'import type { User } from "./types.js";',
        '',
        '   ',
        'import { api } from "./api.js";',
        null as any,
        undefined as any,
      ];
      const result = deduplicateImports(imports);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        'import type { User } from "./types.js";',
        'import { api } from "./api.js";',
      ]);
    });

    test('handles complex import scenarios', () => {
      const imports = [
        'import type { User, Profile } from "./types.js";',
        'import { createUser } from "./utils.js";',
        'import type { User } from "./other.js";', // Duplicate User
        'import type { Settings } from "./types.js";',
        'import { api, createUser } from "./api.js";', // Duplicate createUser
      ];
      const result = deduplicateImports(imports);
      expect(result).toHaveLength(3);
      expect(result).toContain('import type { User, Profile } from "./types.js";');
      expect(result).toContain('import { createUser } from "./utils.js";');
      expect(result).toContain('import type { Settings } from "./types.js";');
    });

    test('handles non-array input gracefully', () => {
      const result = deduplicateImports(null as any);
      expect(result).toEqual([]);
    });

    test('preserves import order for non-duplicates', () => {
      const imports = [
        'import type { A } from "./a.js";',
        'import type { B } from "./b.js";',
        'import type { C } from "./c.js";',
      ];
      const result = deduplicateImports(imports);
      expect(result).toEqual(imports);
    });

    test('handles performance efficiently with many duplicates', () => {
      const imports: string[] = [];
      // Add many duplicate imports
      for (let i = 0; i < 100; i++) {
        imports.push('import type { User } from "./types.js";');
        imports.push('import { Component } from "react";');
      }

      const startTime = performance.now();
      const result = deduplicateImports(imports);
      const endTime = performance.now();

      // Should only keep first occurrences
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('import type { User } from "./types.js";');
      expect(result[1]).toBe('import { Component } from "react";');

      // Should complete quickly (less than 10ms for 200 imports)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('extractImportedTypes', () => {
    test('extracts types from type-only imports', () => {
      const statement = 'import type { User, Profile, Settings } from "./types.js";';
      const result = extractImportedTypes(statement);
      expect(result).toEqual(['User', 'Profile', 'Settings']);
    });

    test('extracts types from mixed imports', () => {
      const statement = 'import { useState, type User, useEffect, type Profile } from "react";';
      const result = extractImportedTypes(statement);
      expect(result).toEqual(['User', 'Profile']);
    });

    test('identifies capitalized imports as types', () => {
      const statement = 'import { useState, Component, useEffect } from "react";';
      const result = extractImportedTypes(statement);
      expect(result).toEqual(['Component']); // Only Component is capitalized
    });

    test('handles whitespace and formatting variations', () => {
      const statement = `import type {
        User,
        Profile,
        Settings
      } from "./types.js";`;
      const result = extractImportedTypes(statement);
      expect(result).toEqual(['User', 'Profile', 'Settings']);
    });

    test('ignores non-type imports', () => {
      const statement = 'import { api, createUser, deleteUser } from "./utils.js";';
      const result = extractImportedTypes(statement);
      expect(result).toEqual([]); // No capitalized names
    });

    test('handles malformed import statements', () => {
      expect(extractImportedTypes('not an import statement')).toEqual([]);
      expect(extractImportedTypes('import from "module";')).toEqual([]);
      expect(extractImportedTypes('')).toEqual([]);
    });

    test('extracts only valid type names', () => {
      const statement = 'import { type User, type profile, Type123, type } from "module";';
      const result = extractImportedTypes(statement);
      // The filtering happens through validateTypeName, which we've mocked to accept only capitalized names
      expect(result).toContain('User');
      expect(result).toContain('Type123'); // Starts with capital
      expect(result).not.toContain('profile'); // Lowercase
    });

    test('handles complex mixed scenarios', () => {
      const statement =
        'import React, { useState, type FC, Component, type ReactNode } from "react";';
      const result = extractImportedTypes(statement);
      expect(result).toEqual(['FC', 'Component', 'ReactNode']);
    });
  });

  describe('extractModulesFromNamedImports', () => {
    test('extracts modules from type-only imports', () => {
      const imports = `
        import type { User } from "./types.js";
        import type { API } from "@company/api";
      `;
      const result = extractModulesFromNamedImports(imports);
      expect(result.has('./types.js')).toBe(true);
      expect(result.has('@company/api')).toBe(true);
    });

    test('correctly identifies type imports with improved regex', () => {
      const imports = `
        import { Helper, utils } from "./helpers.js";
        import { Component } from "react";
        import { helper } from "./utils.js";
      `;
      const result = extractModulesFromNamedImports(imports);
      // Helper and Component start with capital letters (likely types)
      expect(result.has('./helpers.js')).toBe(true);
      expect(result.has('react')).toBe(true);
      // helper is lowercase - not a type
      expect(result.has('./utils.js')).toBe(false);
    });

    test('handles edge cases with explicit type keyword correctly', () => {
      const imports = `
        import { type UserType, utils } from "./mixed.js";
        import { typeHelper } from "./utils.js";
      `;
      const result = extractModulesFromNamedImports(imports);
      // Has explicit type keyword
      expect(result.has('./mixed.js')).toBe(true);
      // 'typeHelper' starts with 'type' but not as a keyword
      expect(result.has('./utils.js')).toBe(false);
    });

    test('extracts modules from mixed imports with types', () => {
      const imports = `
        import { useState, Component } from "react";
        import { api, type APIResponse } from "./api.js";
      `;
      const result = extractModulesFromNamedImports(imports);
      expect(result.has('react')).toBe(true);
      expect(result.has('./api.js')).toBe(true);
    });

    test('ignores modules without type indicators', () => {
      const imports = `
        import { api, utils, helpers } from "./utils.js";
        import { config } from "./config.js";
      `;
      const result = extractModulesFromNamedImports(imports);
      expect(result.size).toBe(0);
    });

    test('handles various quotation marks', () => {
      const imports = `
        import type { User } from './types.js';
        import type { API } from "@company/api";
        import { type Config } from "config";
      `;
      const result = extractModulesFromNamedImports(imports);
      expect(result.has('./types.js')).toBe(true);
      expect(result.has('@company/api')).toBe(true);
      expect(result.has('config')).toBe(true);
    });

    test('handles multiline imports', () => {
      const imports = `
        import type {
          User,
          Profile
        } from "./types.js";
      `;
      const result = extractModulesFromNamedImports(imports);
      expect(result.has('./types.js')).toBe(true);
    });

    test('truncates overly long input and warns', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const longImports = 'import type { User } from "module";'.repeat(1000);

      extractModulesFromNamedImports(longImports);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Import statements string too long, truncating for safety',
      );

      consoleSpy.mockRestore();
    });

    test('handles complex real-world scenarios', () => {
      const imports = `
        import React, { useState, useEffect, type FC } from 'react';
        import { api } from './api.js';
        import type { User, Profile } from './types.js';
        import { type Config, DEFAULT_CONFIG } from '@company/config';
        import * as utils from './utils.js';
      `;
      const result = extractModulesFromNamedImports(imports);

      expect(result.has('react')).toBe(true); // has type FC
      expect(result.has('./types.js')).toBe(true); // type-only import
      expect(result.has('@company/config')).toBe(true); // has type Config
      expect(result.has('./api.js')).toBe(false); // no types
      expect(result.has('./utils.js')).toBe(false); // namespace import, no named types
    });

    test('processes truncated input correctly without re-checking length', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Create a valid import that will still be valid after truncation
      const validImport = 'import type { User } from "module";';
      const padding = 'a'.repeat(10000); // Just padding that won't affect the regex
      const veryLongImports = validImport + padding;

      const result = extractModulesFromNamedImports(veryLongImports);

      // Should have warned once
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Import statements string too long, truncating for safety',
      );

      // Should still process the truncated content
      expect(result.has('module')).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('resolveImportConflicts', () => {
    test('removes conflicting types from local types', () => {
      const categories = {
        localTypes: new Set(['User', 'Profile', 'Settings']),
        relativeImports: new Map([['./other.js', new Set(['Config'])]]),
        externalTypes: new Map([
          ['User', '@types/user'],
          ['Profile', '@company/types'],
        ]),
      };

      resolveImportConflicts(categories);

      expect(categories.localTypes.has('User')).toBe(false);
      expect(categories.localTypes.has('Profile')).toBe(false);
      expect(categories.localTypes.has('Settings')).toBe(true); // No conflict
    });

    test('removes conflicting types from relative imports', () => {
      const categories = {
        localTypes: new Set(['Settings']),
        relativeImports: new Map([
          ['./types.js', new Set(['User', 'Profile'])],
          ['./other.js', new Set(['Config', 'User'])], // User conflicts
        ]),
        externalTypes: new Map([['User', '@types/user']]),
      };

      resolveImportConflicts(categories);

      expect(categories.relativeImports.get('./types.js')?.has('User')).toBe(false);
      expect(categories.relativeImports.get('./types.js')?.has('Profile')).toBe(true);
      expect(categories.relativeImports.get('./other.js')?.has('User')).toBe(false);
      expect(categories.relativeImports.get('./other.js')?.has('Config')).toBe(true);
    });

    test('removes empty relative import entries', () => {
      const categories = {
        localTypes: new Set([]),
        relativeImports: new Map([
          ['./conflict.js', new Set(['User', 'Profile'])], // All will conflict
          ['./keep.js', new Set(['Settings'])], // Will remain
        ]),
        externalTypes: new Map([
          ['User', '@types/user'],
          ['Profile', '@company/types'],
        ]),
      };

      resolveImportConflicts(categories);

      expect(categories.relativeImports.has('./conflict.js')).toBe(false);
      expect(categories.relativeImports.has('./keep.js')).toBe(true);
    });

    test('preserves external types as authoritative', () => {
      const categories = {
        localTypes: new Set(['User']),
        relativeImports: new Map([['./types.js', new Set(['User'])]]),
        externalTypes: new Map([['User', '@types/user']]),
      };

      const originalExternalSize = categories.externalTypes.size;
      resolveImportConflicts(categories);

      expect(categories.externalTypes.size).toBe(originalExternalSize);
      expect(categories.externalTypes.has('User')).toBe(true);
    });

    test('handles complex multi-conflict scenarios', () => {
      const categories = {
        localTypes: new Set(['User', 'Profile', 'Settings', 'Config']),
        relativeImports: new Map([
          ['./types.js', new Set(['User', 'Profile', 'LocalType'])],
          ['./other.js', new Set(['Config', 'AnotherLocal'])],
        ]),
        externalTypes: new Map([
          ['User', '@types/user'],
          ['Config', '@company/config'],
        ]),
      };

      resolveImportConflicts(categories);

      // Local types should lose conflicts
      expect(categories.localTypes.has('User')).toBe(false);
      expect(categories.localTypes.has('Config')).toBe(false);
      expect(categories.localTypes.has('Profile')).toBe(true);
      expect(categories.localTypes.has('Settings')).toBe(true);

      // Relative imports should lose conflicts
      expect(categories.relativeImports.get('./types.js')?.has('User')).toBe(false);
      expect(categories.relativeImports.get('./types.js')?.has('Profile')).toBe(true);
      expect(categories.relativeImports.get('./types.js')?.has('LocalType')).toBe(true);

      expect(categories.relativeImports.get('./other.js')?.has('Config')).toBe(false);
      expect(categories.relativeImports.get('./other.js')?.has('AnotherLocal')).toBe(true);
    });

    test('handles empty categories', () => {
      const categories: Parameters<typeof resolveImportConflicts>[0] = {
        localTypes: new Set(),
        relativeImports: new Map(),
        externalTypes: new Map(),
      };

      expect(() => resolveImportConflicts(categories)).not.toThrow();
    });
  });
});
