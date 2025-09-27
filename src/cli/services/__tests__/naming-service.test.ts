/**
 * Tests for NamingService
 * Verifies string conversion functionality, file naming conventions, and edge case handling
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { NamingService } from '../naming-service.js';
import type { FileNamingConfig } from '../naming-service.js';

describe('NamingService', () => {
  let namingService: NamingService;

  beforeEach(() => {
    namingService = new NamingService();
  });

  describe('formatFileName', () => {
    const testCases: Array<{
      typeName: string;
      config: FileNamingConfig;
      expected: string;
      description: string;
    }> = [
      {
        typeName: 'UserProfile',
        config: { convention: 'camelCase', suffix: 'builder' },
        expected: 'userProfile.builder.ts',
        description: 'should format camelCase with suffix',
      },
      {
        typeName: 'UserProfile',
        config: { convention: 'kebab-case', suffix: 'model' },
        expected: 'user-profile.model.ts',
        description: 'should format kebab-case with suffix',
      },
      {
        typeName: 'UserProfile',
        config: { convention: 'snake_case', suffix: '' },
        expected: 'user_profile.ts',
        description: 'should format snake_case without suffix',
      },
      {
        typeName: 'UserProfile',
        config: { convention: 'PascalCase', suffix: 'interface' },
        expected: 'UserProfile.interface.ts',
        description: 'should format PascalCase with suffix',
      },
    ];

    testCases.forEach(({ typeName, config, expected, description }) => {
      it(description, () => {
        const result = namingService.formatFileName(typeName, config);
        expect(result).toBe(expected);
      });
    });

    describe('edge cases', () => {
      it('should handle empty string input', () => {
        const config: FileNamingConfig = { convention: 'camelCase', suffix: 'builder' };
        const result = namingService.formatFileName('', config);
        expect(result).toBe('.builder.ts');
      });

      it('should handle single character input', () => {
        const config: FileNamingConfig = { convention: 'kebab-case', suffix: 'model' };
        const result = namingService.formatFileName('A', config);
        expect(result).toBe('a.model.ts');
      });

      it('should handle consecutive uppercase letters', () => {
        const config: FileNamingConfig = { convention: 'kebab-case', suffix: '' };
        const result = namingService.formatFileName('XMLHttpRequest', config);
        expect(result).toBe('xml-http-request.ts');
      });

      it('should handle numbers in type name', () => {
        const config: FileNamingConfig = { convention: 'kebab-case', suffix: '' };
        const result = namingService.formatFileName('User123Profile', config);
        expect(result).toBe('user123-profile.ts');
      });

      it('should handle special characters gracefully', () => {
        const config: FileNamingConfig = { convention: 'camelCase', suffix: '' };
        const result = namingService.formatFileName('User_Profile', config);
        expect(result).toBe('user_Profile.ts');
      });
    });
  });

  describe('getFileNamePreview', () => {
    it('should return preview with "UserProfile" example', () => {
      const config: FileNamingConfig = { convention: 'kebab-case', suffix: 'builder' };
      const result = namingService.getFileNamePreview(config);
      expect(result).toBe('Example: user-profile.builder.ts');
    });

    it('should handle empty suffix in preview', () => {
      const config: FileNamingConfig = { convention: 'camelCase', suffix: '' };
      const result = namingService.getFileNamePreview(config);
      expect(result).toBe('Example: userProfile.ts');
    });
  });

  describe('getConventionChoices', () => {
    it('should return all naming convention choices', () => {
      const choices = namingService.getConventionChoices();

      expect(choices).toHaveLength(4);
      expect(choices).toEqual([
        { name: 'camelCase (userProfile.builder.ts)', value: 'camelCase' },
        { name: 'kebab-case (user-profile.builder.ts)', value: 'kebab-case' },
        { name: 'snake_case (user_profile.builder.ts)', value: 'snake_case' },
        { name: 'PascalCase (UserProfile.builder.ts)', value: 'PascalCase' },
      ]);
    });

    it('should have consistent examples with actual formatting', () => {
      const choices = namingService.getConventionChoices();
      const testTypeName = 'UserProfile';
      const testSuffix = 'builder';

      choices.forEach(choice => {
        const config: FileNamingConfig = { convention: choice.value, suffix: testSuffix };
        const actualFormat = namingService.formatFileName(testTypeName, config);

        // Extract the example from the choice name
        const exampleMatch = choice.name.match(/\(([^)]+)\)/);
        const example = exampleMatch ? exampleMatch[1] : '';

        expect(actualFormat).toBe(example);
      });
    });
  });

  describe('conversion methods', () => {
    describe('toCamelCase', () => {
      const testCases = [
        { input: 'UserProfile', expected: 'userProfile' },
        { input: 'user', expected: 'user' },
        { input: 'A', expected: 'a' },
        { input: '', expected: '' },
        { input: 'XMLHttpRequest', expected: 'xMLHttpRequest' },
      ];

      testCases.forEach(({ input, expected }) => {
        it(`should convert "${input}" to "${expected}"`, () => {
          // Access private method through public API
          const config: FileNamingConfig = { convention: 'camelCase', suffix: '' };
          const result = namingService.formatFileName(input, config);
          const expectedFile = `${expected}.ts`;
          expect(result).toBe(expectedFile);
        });
      });
    });

    describe('toKebabCase', () => {
      const testCases = [
        { input: 'UserProfile', expected: 'user-profile' },
        { input: 'user', expected: 'user' },
        { input: 'A', expected: 'a' },
        { input: '', expected: '' },
        { input: 'XMLHttpRequest', expected: 'xml-http-request' },
        { input: 'APIKey', expected: 'api-key' },
      ];

      testCases.forEach(({ input, expected }) => {
        it(`should convert "${input}" to "${expected}"`, () => {
          const config: FileNamingConfig = { convention: 'kebab-case', suffix: '' };
          const result = namingService.formatFileName(input, config);
          const expectedFile = `${expected}.ts`;
          expect(result).toBe(expectedFile);
        });
      });
    });

    describe('toSnakeCase', () => {
      const testCases = [
        { input: 'UserProfile', expected: 'user_profile' },
        { input: 'user', expected: 'user' },
        { input: 'A', expected: 'a' },
        { input: '', expected: '' },
        { input: 'XMLHttpRequest', expected: 'xml_http_request' },
        { input: 'APIKey', expected: 'api_key' },
      ];

      testCases.forEach(({ input, expected }) => {
        it(`should convert "${input}" to "${expected}"`, () => {
          const config: FileNamingConfig = { convention: 'snake_case', suffix: '' };
          const result = namingService.formatFileName(input, config);
          const expectedFile = `${expected}.ts`;
          expect(result).toBe(expectedFile);
        });
      });
    });

    describe('toPascalCase', () => {
      const testCases = [
        { input: 'userProfile', expected: 'UserProfile' },
        { input: 'user', expected: 'User' },
        { input: 'a', expected: 'A' },
        { input: '', expected: '' },
        { input: 'XMLHttpRequest', expected: 'XMLHttpRequest' },
      ];

      testCases.forEach(({ input, expected }) => {
        it(`should convert "${input}" to "${expected}"`, () => {
          const config: FileNamingConfig = { convention: 'PascalCase', suffix: '' };
          const result = namingService.formatFileName(input, config);
          const expectedFile = `${expected}.ts`;
          expect(result).toBe(expectedFile);
        });
      });
    });
  });
});
