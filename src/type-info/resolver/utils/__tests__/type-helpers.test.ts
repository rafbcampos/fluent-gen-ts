import { test, expect, describe } from 'vitest';
import { isTypeAlias, extractTypeName } from '../type-helpers.js';
import { Project } from 'ts-morph';

describe('type-helpers', () => {
  describe('isTypeAlias', () => {
    test('returns true for type alias symbols', () => {
      const project = new Project();
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type StringAlias = string;
        export type UserType = { name: string };
      `,
      );

      const stringAliasSymbol = sourceFile.getTypeAliasOrThrow('StringAlias').getSymbol()!;
      const userTypeSymbol = sourceFile.getTypeAliasOrThrow('UserType').getSymbol()!;

      expect(isTypeAlias(stringAliasSymbol)).toBe(true);
      expect(isTypeAlias(userTypeSymbol)).toBe(true);
    });

    test('returns false for interface symbols', () => {
      const project = new Project();
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          name: string;
        }
      `,
      );

      const interfaceSymbol = sourceFile.getInterfaceOrThrow('User').getSymbol()!;
      expect(isTypeAlias(interfaceSymbol)).toBe(false);
    });

    test('returns false for class symbols', () => {
      const project = new Project();
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        class UserClass {
          name: string = '';
        }
      `,
      );

      const classSymbol = sourceFile.getClassOrThrow('UserClass').getSymbol()!;
      expect(isTypeAlias(classSymbol)).toBe(false);
    });

    test('returns false for symbols with no declarations', () => {
      const project = new Project();
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const user = { name: 'test' };
      `,
      );

      // Get a symbol that might not have type alias declarations
      const varSymbol = sourceFile.getVariableDeclarationOrThrow('user').getSymbol()!;
      expect(isTypeAlias(varSymbol)).toBe(false);
    });
  });

  describe('extractTypeName', () => {
    test('returns symbol name when available and not __type', () => {
      const project = new Project();
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          name: string;
        }
      `,
      );

      const interfaceSymbol = sourceFile.getInterfaceOrThrow('User').getSymbol()!;
      const result = extractTypeName({
        symbol: interfaceSymbol,
        typeText: 'User',
      });

      expect(result).toBe('User');
    });

    test('extracts type name from typeText when symbol name is __type', () => {
      const project = new Project();
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const obj = { name: 'test' } as any;
      `,
      );

      const symbol = sourceFile.getVariableDeclarationOrThrow('obj').getSymbol()!;
      // Mock the symbol to return __type
      const mockSymbol = {
        getName: () => '__type',
        getDeclarations: symbol.getDeclarations.bind(symbol),
      };

      const result = extractTypeName({
        symbol: mockSymbol as any,
        typeText: 'SomeModule.UserType<string>',
      });

      expect(result).toBe('UserType');
    });

    test('handles typeText with generic parameters', () => {
      const result = extractTypeName({
        symbol: undefined,
        typeText: 'MyNamespace.GenericType<string, number>',
      });

      expect(result).toBe('unknown'); // symbol is undefined, so it fallbacks
    });

    test('handles edge cases in regex matching', () => {
      const mockSymbol = {
        getName: () => '__type',
        getDeclarations: () => [],
      };

      // Test various typeText patterns
      const testCases = [
        { typeText: 'Module.TypeName<T>', expected: 'TypeName' },
        { typeText: 'Module.TypeName', expected: 'TypeName' },
        { typeText: 'Module.Type123', expected: 'Type123' },
        { typeText: 'Module.type_name', expected: 'unknown' }, // lowercase start
        { typeText: 'Module.Type_Name', expected: 'unknown' }, // underscore not supported
        { typeText: 'Module.Type-Name', expected: 'unknown' }, // dash not supported
        { typeText: 'TypeWithoutModule', expected: 'unknown' }, // no dot prefix
        { typeText: '.TypeStartWithDot<T>', expected: 'TypeStartWithDot' },
        { typeText: 'Module.', expected: 'unknown' }, // empty type name
        { typeText: 'Module.123Type', expected: 'unknown' }, // starts with number
      ];

      testCases.forEach(({ typeText, expected }) => {
        const result = extractTypeName({
          symbol: mockSymbol as any,
          typeText,
        });
        expect(result).toBe(expected);
      });
    });

    test('returns unknown when symbol is undefined and no regex match', () => {
      const result = extractTypeName({
        symbol: undefined,
        typeText: 'NoModulePrefix',
      });

      expect(result).toBe('unknown');
    });

    test('returns unknown when symbol name is falsy', () => {
      const mockSymbol = {
        getName: () => '',
        getDeclarations: () => [],
      };

      const result = extractTypeName({
        symbol: mockSymbol as any,
        typeText: 'Module.TypeName',
      });

      expect(result).toBe('unknown');
    });
  });
});
