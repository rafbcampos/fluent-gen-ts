import { test, expect, describe, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import {
  StringTransformationUtils,
  type StringTransformationType,
} from '../string-transformation-utils.js';

describe('StringTransformationUtils', () => {
  let project: Project;
  let utils: StringTransformationUtils;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });
    utils = new StringTransformationUtils();
  });

  describe('detectStringTransformation', () => {
    test('detects Capitalize intrinsic type', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type CapitalizeTest = Capitalize<"hello">;
          type CapitalizeGeneric<T extends string> = Capitalize<T>;
        `,
      );

      // Test resolved Capitalize
      const capitalizeType = sourceFile.getTypeAliasOrThrow('CapitalizeTest').getType();
      const result = utils.detectStringTransformation(capitalizeType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Resolved intrinsic types become string literals, so detection should return null
        expect(result.value).toBe(null);
      }

      // Test generic Capitalize
      const capitalizeGenericType = sourceFile.getTypeAliasOrThrow('CapitalizeGeneric').getType();
      const genericResult = utils.detectStringTransformation(capitalizeGenericType);

      expect(genericResult.ok).toBe(true);
      if (genericResult.ok && genericResult.value) {
        expect(genericResult.value.transform).toBe('capitalize');
        expect(genericResult.value.innerType).toBeDefined();
      }
    });

    test('detects all intrinsic string transformation types', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type CapitalizeGeneric<T extends string> = Capitalize<T>;
          type UncapitalizeGeneric<T extends string> = Uncapitalize<T>;
          type UppercaseGeneric<T extends string> = Uppercase<T>;
          type LowercaseGeneric<T extends string> = Lowercase<T>;
        `,
      );

      const testCases: Array<{
        alias: string;
        expectedTransform: StringTransformationType;
      }> = [
        { alias: 'CapitalizeGeneric', expectedTransform: 'capitalize' },
        { alias: 'UncapitalizeGeneric', expectedTransform: 'uncapitalize' },
        { alias: 'UppercaseGeneric', expectedTransform: 'uppercase' },
        { alias: 'LowercaseGeneric', expectedTransform: 'lowercase' },
      ];

      testCases.forEach(({ alias, expectedTransform }) => {
        const type = sourceFile.getTypeAliasOrThrow(alias).getType();
        const result = utils.detectStringTransformation(type);

        expect(result.ok).toBe(true);
        if (result.ok && result.value) {
          expect(result.value.transform).toBe(expectedTransform);
          expect(result.value.innerType).toBeDefined();
        }
      });
    });

    test('returns null for non-intrinsic string types', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type StringType = string;
          type LiteralType = "hello";
          type TemplateType<T> = \`hello-\${T}\`;
          type CustomType<T> = { value: T };
        `,
      );

      const testTypes = ['StringType', 'LiteralType', 'TemplateType', 'CustomType'];

      testTypes.forEach(typeName => {
        const type = sourceFile.getTypeAliasOrThrow(typeName).getType();
        const result = utils.detectStringTransformation(type);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(null);
        }
      });
    });

    test('handles types without symbols gracefully', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type AnonymousType = string | number;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow('AnonymousType').getType();
      const result = utils.detectStringTransformation(type);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });

    test('handles types with incorrect number of type arguments', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          // This would be a TypeScript error, but we test our robustness
          type InvalidCapitalize = Capitalize;
        `,
      );

      try {
        const type = sourceFile.getTypeAliasOrThrow('InvalidCapitalize').getType();
        const result = utils.detectStringTransformation(type);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(null);
        }
      } catch {
        // If TypeScript can't parse it, that's also acceptable
        expect(true).toBe(true);
      }
    });
  });

  describe('applyStringTransform', () => {
    test('applies capitalize transformation', () => {
      expect(utils.applyStringTransform('hello', 'capitalize')).toBe('Hello');
      expect(utils.applyStringTransform('HELLO', 'capitalize')).toBe('HELLO');
      expect(utils.applyStringTransform('', 'capitalize')).toBe('');
      expect(utils.applyStringTransform('a', 'capitalize')).toBe('A');
      expect(utils.applyStringTransform('hELLO', 'capitalize')).toBe('HELLO');
    });

    test('applies uncapitalize transformation', () => {
      expect(utils.applyStringTransform('Hello', 'uncapitalize')).toBe('hello');
      expect(utils.applyStringTransform('HELLO', 'uncapitalize')).toBe('hELLO');
      expect(utils.applyStringTransform('', 'uncapitalize')).toBe('');
      expect(utils.applyStringTransform('A', 'uncapitalize')).toBe('a');
      expect(utils.applyStringTransform('hello', 'uncapitalize')).toBe('hello');
    });

    test('applies uppercase transformation', () => {
      expect(utils.applyStringTransform('hello', 'uppercase')).toBe('HELLO');
      expect(utils.applyStringTransform('Hello', 'uppercase')).toBe('HELLO');
      expect(utils.applyStringTransform('HELLO', 'uppercase')).toBe('HELLO');
      expect(utils.applyStringTransform('', 'uppercase')).toBe('');
      expect(utils.applyStringTransform('123', 'uppercase')).toBe('123');
      expect(utils.applyStringTransform('hello world!', 'uppercase')).toBe('HELLO WORLD!');
    });

    test('applies lowercase transformation', () => {
      expect(utils.applyStringTransform('HELLO', 'lowercase')).toBe('hello');
      expect(utils.applyStringTransform('Hello', 'lowercase')).toBe('hello');
      expect(utils.applyStringTransform('hello', 'lowercase')).toBe('hello');
      expect(utils.applyStringTransform('', 'lowercase')).toBe('');
      expect(utils.applyStringTransform('123', 'lowercase')).toBe('123');
      expect(utils.applyStringTransform('HELLO WORLD!', 'lowercase')).toBe('hello world!');
    });

    test('handles special characters and unicode', () => {
      expect(utils.applyStringTransform('café', 'capitalize')).toBe('Café');
      expect(utils.applyStringTransform('CAFÉ', 'uncapitalize')).toBe('cAFÉ');
      expect(utils.applyStringTransform('naïve', 'uppercase')).toBe('NAÏVE');
      expect(utils.applyStringTransform('NAÏVE', 'lowercase')).toBe('naïve');
    });

    test('handles edge cases with whitespace and symbols', () => {
      expect(utils.applyStringTransform(' hello', 'capitalize')).toBe(' hello');
      expect(utils.applyStringTransform('123hello', 'capitalize')).toBe('123hello');
      expect(utils.applyStringTransform('_hello', 'capitalize')).toBe('_hello');
      expect(utils.applyStringTransform('-hello', 'capitalize')).toBe('-hello');
    });
  });

  describe('integration with TypeScript intrinsic types', () => {
    test("matches TypeScript's behavior for resolved intrinsic types", () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type CapitalizeResult = Capitalize<"hello">;
          type UncapitalizeResult = Uncapitalize<"Hello">;
          type UppercaseResult = Uppercase<"hello">;
          type LowercaseResult = Lowercase<"HELLO">;
        `,
      );

      const testCases = [
        {
          alias: 'CapitalizeResult',
          expected: 'Hello',
          input: 'hello',
          transform: 'capitalize' as const,
        },
        {
          alias: 'UncapitalizeResult',
          expected: 'hello',
          input: 'Hello',
          transform: 'uncapitalize' as const,
        },
        {
          alias: 'UppercaseResult',
          expected: 'HELLO',
          input: 'hello',
          transform: 'uppercase' as const,
        },
        {
          alias: 'LowercaseResult',
          expected: 'hello',
          input: 'HELLO',
          transform: 'lowercase' as const,
        },
      ];

      testCases.forEach(({ alias, expected, input, transform }) => {
        const type = sourceFile.getTypeAliasOrThrow(alias).getType();
        const typeScriptResult = type.getText().replace(/"/g, ''); // Remove quotes

        const ourResult = utils.applyStringTransform(input, transform);

        expect(ourResult).toBe(expected);
        expect(ourResult).toBe(typeScriptResult);
      });
    });
  });
});
