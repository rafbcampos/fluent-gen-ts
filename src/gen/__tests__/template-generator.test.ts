import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getCommonFileTemplate, getSingleFileUtilitiesTemplate } from '../template-generator.js';

// Mock fs module
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock url module
vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);
const mockFileURLToPath = vi.mocked(fileURLToPath);

describe('template-generator', () => {
  const mockBuilderUtilitiesContent = `/**
 * Runtime utilities for fluent builders
 */

export const FLUENT_BUILDER_SYMBOL = Symbol.for("fluent-builder");

export interface BaseBuildContext {
  readonly parentId?: string;
}

export interface FluentBuilder<T, C extends BaseBuildContext = BaseBuildContext> {
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  build(context?: C): T;
}

export function isFluentBuilder<T = unknown>(value: unknown): value is FluentBuilder<T> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  return true;
}

export class FluentBuilderBase<T> {
  readonly [FLUENT_BUILDER_SYMBOL] = true;

  abstract build(): T;
}

export function createInspectMethod(builderName: string, properties: Record<string, unknown>): string {
  return \`\${builderName} { properties: \${JSON.stringify(properties, null, 2)} }\`;
}`;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockFileURLToPath.mockReturnValue('/mock/path/template-generator.js');
    mockReadFileSync.mockReturnValue(mockBuilderUtilitiesContent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCommonFileTemplate', () => {
    test('reads builder utilities file and creates common template', () => {
      const expectedPath = join('/mock/path', 'builder-utilities.ts');

      const result = getCommonFileTemplate();

      expect(mockFileURLToPath).toHaveBeenCalledWith(
        expect.stringContaining('src/gen/template-generator.ts'),
      );
      expect(mockReadFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');

      expect(result).toContain('Common utilities for fluent builders');
      expect(result).toContain(mockBuilderUtilitiesContent);
      expect(result).toContain('FLUENT_BUILDER_SYMBOL');
      expect(result).toContain('export'); // Should preserve export keywords
    });

    test('handles file reading errors gracefully', () => {
      const mockError = new Error('File not found');
      mockReadFileSync.mockImplementation(() => {
        throw mockError;
      });

      expect(() => getCommonFileTemplate()).toThrow(
        'Failed to read builder-utilities.ts: File not found',
      );
    });

    test('handles non-Error exceptions', () => {
      mockReadFileSync.mockImplementation(() => {
        throw 'String error';
      });

      expect(() => getCommonFileTemplate()).toThrow(
        'Failed to read builder-utilities.ts: String error',
      );
    });

    test('uses correct file path resolution', () => {
      const mockCurrentDir = '/some/deep/directory/structure';
      mockFileURLToPath.mockReturnValue(`${mockCurrentDir}/template-generator.js`);

      getCommonFileTemplate();

      const expectedPath = join(mockCurrentDir, 'builder-utilities.ts');
      expect(mockReadFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');
    });

    test('preserves all content from builder utilities', () => {
      const complexContent = `// Comments should be preserved
export const SYMBOL = Symbol.for("test");

export interface ComplexInterface<T extends string = "default"> {
  readonly [key: string]: unknown;
  method(): T;
}

export class ComplexClass {
  private field = "private";

  public method() {
    return this.field;
  }
}

// More comments
export function complexFunction<T>(param: T): T {
  return param;
}`;

      mockReadFileSync.mockReturnValue(complexContent);

      const result = getCommonFileTemplate();

      expect(result).toContain(complexContent);
      expect(result).toContain('// Comments should be preserved');
      expect(result).toContain('export const SYMBOL');
      expect(result).toContain('export interface ComplexInterface');
      expect(result).toContain('export class ComplexClass');
      expect(result).toContain('export function complexFunction');
    });

    test('includes proper header comment', () => {
      const result = getCommonFileTemplate();

      expect(result.trim()).toMatch(
        /^\/\*\*\s*\n\s*\*\s*Common utilities for fluent builders\s*\n\s*\*\//,
      );
    });
  });

  describe('getSingleFileUtilitiesTemplate', () => {
    test('reads builder utilities file and removes export keywords', () => {
      const contentWithExports = `export const FLUENT_BUILDER_SYMBOL = Symbol.for("fluent-builder");

export interface BaseBuildContext {
  readonly parentId?: string;
}

export function isFluentBuilder(value: unknown): boolean {
  return true;
}

export class FluentBuilderBase<T> {
  abstract build(): T;
}`;

      mockReadFileSync.mockReturnValue(contentWithExports);

      const result = getSingleFileUtilitiesTemplate();

      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('builder-utilities.ts'),
        'utf8',
      );

      // Should not contain export keywords at start of lines
      expect(result).not.toMatch(/^export /m);

      // Should contain the actual declarations without export
      expect(result).toContain('const FLUENT_BUILDER_SYMBOL');
      expect(result).toContain('interface BaseBuildContext');
      expect(result).toContain('function isFluentBuilder');
      expect(result).toContain('class FluentBuilderBase');
    });

    test('handles complex export patterns', () => {
      const contentWithComplexExports = `// Regular export
export const simple = "value";

// Export with type annotation
export const typed: string = "value";

// Export function
export function myFunction() {
  return "test";
}

// Export interface
export interface MyInterface {
  prop: string;
}

// Export class
export class MyClass {
  method() {}
}

// Export type
export type MyType = string;

// Default export (should not be affected by regex)
export default class DefaultClass {}

// Re-export
export { something } from "./other";

// Export all
export * from "./another";

// Not at start of line (should not be affected)
const notExport = "export this should remain";`;

      mockReadFileSync.mockReturnValue(contentWithComplexExports);

      const result = getSingleFileUtilitiesTemplate();

      // Regular exports should be removed
      expect(result).not.toMatch(/^export const simple/m);
      expect(result).not.toMatch(/^export const typed/m);
      expect(result).not.toMatch(/^export function myFunction/m);
      expect(result).not.toMatch(/^export interface MyInterface/m);
      expect(result).not.toMatch(/^export class MyClass/m);
      expect(result).not.toMatch(/^export type MyType/m);
      expect(result).not.toMatch(/^export default class DefaultClass/m);
      expect(result).not.toMatch(/^export \{ something \}/m);
      expect(result).not.toMatch(/^export \* from/m);

      // Should contain declarations without export
      expect(result).toContain('const simple = "value"');
      expect(result).toContain('const typed: string = "value"');
      expect(result).toContain('function myFunction()');
      expect(result).toContain('interface MyInterface');
      expect(result).toContain('class MyClass');
      expect(result).toContain('type MyType = string');
      expect(result).toContain('default class DefaultClass');

      // Non-export uses should remain
      expect(result).toContain('export this should remain');
    });

    test('handles edge cases in export removal', () => {
      const edgeCaseContent = `export const multiline = {
  prop: "value",
  another: "value"
};

export function
multilineFunction() {
  return true;
}

export
interface SpacedInterface {
  prop: string;
}

// export commented out export should remain
/* export block commented export should remain */

const regularCode = "export keyword in string should remain";`;

      mockReadFileSync.mockReturnValue(edgeCaseContent);

      const result = getSingleFileUtilitiesTemplate();

      // Multiline exports should be handled - regex only removes 'export ' at start of lines
      expect(result).toContain('const multiline = {');
      expect(result).toContain('function\nmultilineFunction()');
      expect(result).toContain('\ninterface SpacedInterface');

      // Comments should remain unchanged
      expect(result).toContain('// export commented out export should remain');
      expect(result).toContain('/* export block commented export should remain */');
      expect(result).toContain('export keyword in string should remain');
    });

    test('handles file reading errors', () => {
      const mockError = new Error('Permission denied');
      mockReadFileSync.mockImplementation(() => {
        throw mockError;
      });

      expect(() => getSingleFileUtilitiesTemplate()).toThrow(
        'Failed to read builder-utilities.ts: Permission denied',
      );
    });

    test('preserves whitespace and formatting', () => {
      const contentWithWhitespace = `

export const spaced = "value";


export function withSpacing() {
  return true;
}

  export const indented = "value";
\texport const tabbed = "value";
`;

      mockReadFileSync.mockReturnValue(contentWithWhitespace);

      const result = getSingleFileUtilitiesTemplate();

      // Should preserve general structure but remove export keywords
      expect(result).toContain('\n\nconst spaced = "value";\n\n');
      expect(result).toContain('function withSpacing()');
      // The regex doesn't remove indented exports - it only matches start of line
      expect(result).toContain('  export const indented = "value"'); // Preserves export with leading spaces
      expect(result).toContain('\texport const tabbed = "value"'); // Preserves export with leading tabs
    });

    test('includes newline at the beginning', () => {
      const result = getSingleFileUtilitiesTemplate();

      expect(result).toMatch(/^\s*\n/);
    });
  });

  describe('file path resolution', () => {
    test('resolves path correctly from different file locations', () => {
      const testCases = [
        '/absolute/path/to/template-generator.js',
        '/different/deep/path/template-generator.js',
        '/shallow/template-generator.js',
        '/path/with spaces/template-generator.js',
      ];

      testCases.forEach(mockPath => {
        vi.clearAllMocks();
        mockFileURLToPath.mockReturnValue(mockPath);

        getCommonFileTemplate();

        const expectedDir = dirname(mockPath);
        const expectedPath = join(expectedDir, 'builder-utilities.ts');
        expect(mockReadFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');
      });
    });

    test('handles import.meta.url correctly', () => {
      getCommonFileTemplate();

      // Should call fileURLToPath with a string URL
      expect(mockFileURLToPath).toHaveBeenCalledWith(
        expect.stringContaining('/src/gen/template-generator.ts'),
      );

      const urlArg = mockFileURLToPath.mock.calls[0]?.[0] as string;
      expect(typeof urlArg).toBe('string');
      expect(urlArg).toMatch(/\/template-generator\.ts$/);
    });
  });

  describe('integration scenarios', () => {
    test('both functions work with same file content', () => {
      const commonTemplate = getCommonFileTemplate();
      const singleFileTemplate = getSingleFileUtilitiesTemplate();

      // Both should read the same file
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);

      // Common template should have exports
      expect(commonTemplate).toContain('export const FLUENT_BUILDER_SYMBOL');
      expect(commonTemplate).toContain('export interface BaseBuildContext');

      // Single file template should not have exports
      expect(singleFileTemplate).not.toMatch(/^export /m);
      expect(singleFileTemplate).toContain('const FLUENT_BUILDER_SYMBOL');
      expect(singleFileTemplate).toContain('interface BaseBuildContext');
    });

    test('handles empty file content', () => {
      mockReadFileSync.mockReturnValue('');

      const commonTemplate = getCommonFileTemplate();
      const singleFileTemplate = getSingleFileUtilitiesTemplate();

      expect(commonTemplate).toContain('Common utilities for fluent builders');
      expect(singleFileTemplate).toContain('\n'); // Should still have newline
    });

    test('handles file with only comments', () => {
      const commentOnlyContent = `/**
 * File header comment
 */

// Line comment
/* Block comment */`;

      mockReadFileSync.mockReturnValue(commentOnlyContent);

      const commonTemplate = getCommonFileTemplate();
      const singleFileTemplate = getSingleFileUtilitiesTemplate();

      expect(commonTemplate).toContain(commentOnlyContent);
      expect(singleFileTemplate).toContain(commentOnlyContent);
    });
  });

  describe('error handling and edge cases', () => {
    test('handles very large file content', () => {
      const largeContent = 'export const large = "' + 'a'.repeat(100000) + '";';
      mockReadFileSync.mockReturnValue(largeContent);

      const result = getSingleFileUtilitiesTemplate();

      expect(result).toContain('const large = "');
      expect(result.length).toBeGreaterThan(100000);
    });

    test('handles special characters in file content', () => {
      const specialContent = `export const special = "Special chars: üñíçödé 🎉 \n\t\r";
export const regex = /export\\s+/g;
export const template = \`export in template \${value}\`;`;

      mockReadFileSync.mockReturnValue(specialContent);

      const result = getSingleFileUtilitiesTemplate();

      expect(result).toContain('const special = "Special chars: üñíçödé 🎉 \n\t\r"');
      expect(result).toContain('const regex = /export\\s+/g');
      expect(result).toContain('const template = `export in template ${value}`');
    });

    test('handles malformed export statements', () => {
      const malformedContent = `export // incomplete
export; // empty
export {} // empty object
export const; // incomplete const
export function; // incomplete function`;

      mockReadFileSync.mockReturnValue(malformedContent);

      const result = getSingleFileUtilitiesTemplate();

      // Should remove the export keywords even from malformed statements
      expect(result).toContain('// incomplete');
      expect(result).toContain('; // empty');
      expect(result).toContain('{} // empty object');
      expect(result).toContain('const; // incomplete const');
      expect(result).toContain('function; // incomplete function');
    });

    test('handles filesystem errors with detailed messages', () => {
      const detailedError = new Error(
        "ENOENT: no such file or directory, open '/path/to/builder-utilities.ts'",
      );
      detailedError.name = 'ENOENT';
      (detailedError as any).code = 'ENOENT';

      mockReadFileSync.mockImplementation(() => {
        throw detailedError;
      });

      expect(() => getCommonFileTemplate()).toThrow(
        "Failed to read builder-utilities.ts: ENOENT: no such file or directory, open '/path/to/builder-utilities.ts'",
      );
    });
  });
});
