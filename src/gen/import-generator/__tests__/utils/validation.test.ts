import { describe, test, expect, vi } from 'vitest';
import { isErr } from '../../../../core/result.js';
import {
  validateImportPath,
  validateTypeName,
  isGlobalType,
  validateImportStatements,
  sanitizeImportStatements,
} from '../../utils/validation.js';

describe('validation utilities', () => {
  describe('validateImportPath', () => {
    test('accepts valid relative paths', () => {
      const result = validateImportPath('./types.js');
      expect(result.ok).toBe(true);
    });

    test('accepts valid module paths', () => {
      const result = validateImportPath('@types/node');
      expect(result.ok).toBe(true);
    });

    test('accepts scoped packages', () => {
      const result = validateImportPath('@company/utils/types');
      expect(result.ok).toBe(true);
    });

    test('rejects empty string', () => {
      const result = validateImportPath('');
      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error).toContain('empty');
      }
    });

    test('rejects whitespace-only string', () => {
      const result = validateImportPath('   ');
      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error).toContain('empty or whitespace-only');
      }
    });

    test('rejects non-string input', () => {
      const result = validateImportPath(null as any);
      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error).toContain('non-empty string');
      }
    });

    test('rejects extremely long paths', () => {
      const longPath = 'a'.repeat(1001);
      const result = validateImportPath(longPath);
      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error).toContain('maximum allowed length');
      }
    });

    test('accepts paths at maximum length boundary', () => {
      const maxPath = 'a'.repeat(1000);
      const result = validateImportPath(maxPath);
      expect(result.ok).toBe(true);
    });
  });

  describe('validateTypeName', () => {
    test('accepts valid PascalCase type names', () => {
      expect(validateTypeName('UserProfile')).toBe(true);
      expect(validateTypeName('APIResponse')).toBe(true);
      expect(validateTypeName('UUID')).toBe(true);
    });

    test('accepts valid interface names', () => {
      expect(validateTypeName('IUserService')).toBe(true);
      expect(validateTypeName('BaseConfig')).toBe(true);
    });

    test('accepts generic type names', () => {
      expect(validateTypeName('Result')).toBe(true);
      expect(validateTypeName('Option')).toBe(true);
    });

    test('rejects empty string', () => {
      expect(validateTypeName('')).toBe(false);
    });

    test('rejects whitespace-only string', () => {
      expect(validateTypeName('   ')).toBe(false);
    });

    test('rejects non-string input', () => {
      expect(validateTypeName(null as any)).toBe(false);
      expect(validateTypeName(undefined as any)).toBe(false);
      expect(validateTypeName(123 as any)).toBe(false);
    });

    test('rejects lowercase names (following isValidImportableTypeName)', () => {
      expect(validateTypeName('userProfile')).toBe(false);
      expect(validateTypeName('config')).toBe(false);
    });

    test('rejects names with special characters', () => {
      expect(validateTypeName('User-Profile')).toBe(false);
      expect(validateTypeName('User.Profile')).toBe(false);
      expect(validateTypeName('User Profile')).toBe(false);
    });

    test('rejects names starting with numbers', () => {
      expect(validateTypeName('1UserProfile')).toBe(false);
    });
  });

  describe('isGlobalType', () => {
    test('identifies built-in global constructors', () => {
      expect(isGlobalType('Array')).toBe(true);
      expect(isGlobalType('Object')).toBe(true);
      expect(isGlobalType('Date')).toBe(true);
      expect(isGlobalType('Promise')).toBe(true);
      expect(isGlobalType('Error')).toBe(true);
      expect(isGlobalType('RegExp')).toBe(true);
      expect(isGlobalType('Map')).toBe(true);
      expect(isGlobalType('Set')).toBe(true);
    });

    test('identifies global utility functions as global', () => {
      expect(isGlobalType('parseInt')).toBe(true);
      expect(isGlobalType('parseFloat')).toBe(true);
      expect(isGlobalType('isNaN')).toBe(true);
      expect(isGlobalType('isFinite')).toBe(true);
    });

    test('rejects custom types', () => {
      expect(isGlobalType('UserProfile')).toBe(false);
      expect(isGlobalType('CustomError')).toBe(false);
      expect(isGlobalType('APIResponse')).toBe(false);
    });

    test('rejects non-existent globals', () => {
      expect(isGlobalType('NonExistentType')).toBe(false);
      expect(isGlobalType('FakeGlobal')).toBe(false);
    });

    test('handles empty and invalid input', () => {
      expect(isGlobalType('')).toBe(false);
      expect(isGlobalType('   ')).toBe(false);
      expect(isGlobalType(null as any)).toBe(false);
      expect(isGlobalType(undefined as any)).toBe(false);
    });

    test('handles edge case global property access', () => {
      // Testing edge cases where globalThis access might throw
      expect(isGlobalType('constructor')).toBe(false); // constructor is inherited, not a direct globalThis property
      expect(isGlobalType('toString')).toBe(false); // toString is not a function directly on globalThis
    });
  });

  describe('validateImportStatements', () => {
    test('accepts valid import statements', () => {
      const imports = `import { UserProfile } from './types.js';
import type { APIResponse } from '@company/api';`;
      const result = validateImportStatements(imports);
      expect(result.ok).toBe(true);
    });

    test('accepts empty import statements', () => {
      const result = validateImportStatements('');
      expect(result.ok).toBe(true);
    });

    test('accepts complex import statements', () => {
      const imports = `import React, { Component, useState } from 'react';
import type { FC, ReactNode } from 'react';
import * as fs from 'node:fs';
import type { ReadStream, WriteStream } from 'node:fs';`;
      const result = validateImportStatements(imports);
      expect(result.ok).toBe(true);
    });

    test('rejects non-string input', () => {
      const result = validateImportStatements(null as any);
      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error).toContain('must be a string');
      }
    });

    test('rejects extremely long import statements', () => {
      const longImports = 'import { ' + 'VeryLongTypeName, '.repeat(500) + ' } from "module";';
      const result = validateImportStatements(longImports);
      expect(result.ok).toBe(false);
      if (isErr(result)) {
        expect(result.error).toContain('too long');
      }
    });

    test('accepts import statements at maximum length boundary', () => {
      const imports = 'a'.repeat(8000);
      const result = validateImportStatements(imports);
      expect(result.ok).toBe(true);
    });
  });

  describe('sanitizeImportStatements', () => {
    test('returns original string when within limits', () => {
      const imports = `import { UserProfile } from './types.js';`;
      expect(sanitizeImportStatements(imports)).toBe(imports);
    });

    test('truncates extremely long strings', () => {
      const longImports = 'a'.repeat(15000);
      const result = sanitizeImportStatements(longImports);
      expect(result.length).toBe(8000);
      expect(result).toBe('a'.repeat(8000));
    });

    test('logs warning for truncated strings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const longImports = 'a'.repeat(15000);

      sanitizeImportStatements(longImports);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Import statements string too long, truncating for safety',
      );

      consoleSpy.mockRestore();
    });

    test('preserves meaningful content when truncating', () => {
      const importStart = 'import { UserProfile, APIResponse } from "./types.js";';
      const padding = 'a'.repeat(15000 - importStart.length);
      const longImports = importStart + padding;

      const result = sanitizeImportStatements(longImports);
      expect(result.startsWith(importStart)).toBe(true);
      expect(result.length).toBe(8000);
    });
  });
});
