import { test, expect, describe, beforeEach } from 'vitest';
import { ImportGenerator, type ImportGeneratorConfig } from '../import-generator.js';
import { PluginManager } from '../../core/plugin.js';
import {
  TypeKind,
  type ResolvedType,
  type PropertyInfo,
  type GenericParam,
} from '../../core/types.js';

describe('ImportGenerator', () => {
  let generator: ImportGenerator;

  beforeEach(() => {
    generator = new ImportGenerator();
  });

  describe('constructor', () => {
    test('creates generator with default ImportResolver', () => {
      expect(generator).toBeDefined();
    });
  });

  describe('generateModuleImports', () => {
    test('generates imports for node modules', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/types.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: ['react', '@types/node', 'lodash'],
        dependencies: [],
      };

      const result = generator.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toContain('import type * as react from "react"');
        expect(result.value[1]).toContain('import type * as node from "@types/node"');
        expect(result.value[2]).toContain('import type * as lodash from "lodash"');
      }
    });

    test('filters out relative imports', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/types.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: ['react', './types', '../utils'],
        dependencies: [],
      };

      const result = generator.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toContain('import type * as react from "react"');
      }
    });

    test('handles empty imports array', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/types.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    test('handles invalid imports gracefully', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/types.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: ['react', '', '   ', '@types/node'],
        dependencies: [],
      };

      const result = generator.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toContain('import type * as react from "react"');
        expect(result.value[1]).toContain('import type * as node from "@types/node"');
      }
    });

    test('returns error for invalid input', () => {
      const invalidResolvedType = null as any;

      const result = generator.generateModuleImports(invalidResolvedType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid resolved type');
      }
    });

    test('returns error for missing imports array', () => {
      const resolvedType = {
        sourceFile: '/project/src/types.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        dependencies: [],
      } as any;

      const result = generator.generateModuleImports(resolvedType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid resolved type or imports array');
      }
    });
  });

  describe('generateCommonImports', () => {
    test('generates common imports when generating multiple files', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        commonImportPath: './common',
      };

      const result = generator.generateCommonImports(config);

      expect(result).toContain('import {');
      expect(result).toContain('FluentBuilder,');
      expect(result).toContain('FluentBuilderBase,');
      expect(result).toContain('BaseBuildContext,');
      expect(result).toContain('FLUENT_BUILDER_SYMBOL,');
      expect(result).toContain('createInspectMethod');
      expect(result).toContain('} from "./common";');
    });

    test('returns empty string when not generating multiple files', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: false,
        commonImportPath: './common',
      };

      const result = generator.generateCommonImports(config);

      expect(result).toBe('');
    });

    test('throws error for invalid common import path', () => {
      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        commonImportPath: '',
      };

      expect(() => generator.generateCommonImports(config)).toThrow('Invalid common import path');
    });

    test('handles null config', () => {
      const result = generator.generateCommonImports(null as any);
      expect(result).toBe('');
    });
  });

  describe('generateTypeImports', () => {
    test('generates basic type import', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('import type { User } from "/project/src/user.ts";');
      }
    });

    test('includes nested object types', () => {
      const properties: PropertyInfo[] = [
        {
          name: 'id',
          type: { kind: TypeKind.Primitive, name: 'string' },
          optional: false,
          readonly: false,
        },
        {
          name: 'address',
          type: { kind: TypeKind.Object, name: 'Address', properties: [] },
          optional: false,
          readonly: false,
        },
      ];

      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('User, Address');
      }
    });

    test('includes generic constraint types', () => {
      const genericParams: GenericParam[] = [
        {
          name: 'T',
          constraint: { kind: TypeKind.Reference, name: 'BaseType' },
          default: { kind: TypeKind.Reference, name: 'DefaultType' },
        },
      ];

      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: {
          kind: TypeKind.Object,
          name: 'User',
          properties: [],
          genericParams,
        },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('User, BaseType, DefaultType');
      }
    });

    test('deduplicates type names', () => {
      const properties: PropertyInfo[] = [
        {
          name: 'user1',
          type: { kind: TypeKind.Object, name: 'User', properties: [] },
          optional: false,
          readonly: false,
        },
        {
          name: 'user2',
          type: { kind: TypeKind.Object, name: 'User', properties: [] },
          optional: false,
          readonly: false,
        },
      ];

      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should only contain User once in the import statement (deduplicated)
        const matches = result.value.match(/User/g);
        expect(matches).toHaveLength(1); // Only once due to deduplication
        expect(result.value).toBe('import type { User } from "/project/src/user.ts";');
      }
    });

    test('filters out invalid type names', () => {
      const properties: PropertyInfo[] = [
        {
          name: 'id',
          type: { kind: TypeKind.Primitive, name: 'string' },
          optional: false,
          readonly: false,
        },
        {
          name: 'data',
          type: { kind: TypeKind.Object, name: '__type', properties: [] },
          optional: false,
          readonly: false,
        },
      ];

      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('User');
        expect(result.value).not.toContain('__type');
      }
    });

    test('handles node_modules paths correctly', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/node_modules/@types/react/index.d.ts',
        name: 'ReactNode',
        typeInfo: { kind: TypeKind.Reference, name: 'ReactNode' },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('from "@types/react"');
      }
    });

    test('returns error for invalid input', () => {
      const result = generator.generateTypeImports(null as any);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid resolved type');
      }
    });

    test('returns error when no valid types found', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: '__internal',
        typeInfo: { kind: TypeKind.Object, name: '__internal', properties: [] },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No valid importable types found');
      }
    });
  });

  describe('generateAllImports', () => {
    test('combines all import types successfully', () => {
      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: ['react'],
        dependencies: [],
      };

      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: true,
        commonImportPath: './common',
      };

      const result = generator.generateAllImports({ resolvedType, config });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('FluentBuilder');
        expect(result.value).toContain('import type * as react from "react"');
        expect(result.value).toContain('import type { User } from "/project/src/user.ts"');
      }
    });

    test('includes plugin imports', () => {
      const pluginManager = new PluginManager();
      pluginManager.register({
        name: 'test-plugin',
        version: '1.0.0',
        imports: {
          runtime: ["import { helper } from 'helper-lib';"],
          types: ["import type { HelperType } from 'helper-lib';"],
        },
      });

      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: [],
        dependencies: [],
      };

      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: false,
        commonImportPath: './common',
        pluginManager,
      };

      const result = generator.generateAllImports({ resolvedType, config });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('helper');
        expect(result.value).toContain('HelperType');
      }
    });

    test('handles errors from module imports', () => {
      const invalidResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
        imports: null, // Invalid imports
        dependencies: [],
      } as any;

      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: false,
        commonImportPath: './common',
      };

      const result = generator.generateAllImports({
        resolvedType: invalidResolvedType,
        config,
      });

      expect(result.ok).toBe(false);
    });

    test('handles errors from type imports', () => {
      const invalidResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: '__invalid',
        typeInfo: {
          kind: TypeKind.Object as const,
          name: '__invalid',
          properties: [],
        },
        imports: [],
        dependencies: [],
      };

      const config: ImportGeneratorConfig = {
        isGeneratingMultiple: false,
        commonImportPath: './common',
      };

      const result = generator.generateAllImports({
        resolvedType: invalidResolvedType,
        config,
      });

      expect(result.ok).toBe(false);
    });

    test('returns error for invalid input', () => {
      const result = generator.generateAllImports({
        resolvedType: null as any,
        config: null as any,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid resolved type or configuration');
      }
    });
  });

  describe('deduplicateImports', () => {
    test('removes duplicate imports', () => {
      const imports = [
        'import type { User } from "./user";',
        'import type { User } from "./user";',
        'import type { Address } from "./address";',
      ];

      const result = (generator as any).deduplicateImports(imports);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('import type { User } from "./user";');
      expect(result[1]).toBe('import type { Address } from "./address";');
    });

    test('trims whitespace before deduplication', () => {
      const imports = [
        'import type { User } from "./user";',
        '  import type { User } from "./user";  ',
        'import type { Address } from "./address";',
      ];

      const result = (generator as any).deduplicateImports(imports);

      expect(result).toHaveLength(2);
    });

    test('filters out empty strings', () => {
      const imports = [
        'import type { User } from "./user";',
        '',
        '   ',
        'import type { Address } from "./address";',
      ];

      const result = (generator as any).deduplicateImports(imports);

      expect(result).toHaveLength(2);
    });

    test('handles invalid input gracefully', () => {
      const result1 = (generator as any).deduplicateImports(null);
      expect(result1).toEqual([]);

      const result2 = (generator as any).deduplicateImports([1, 2, 'valid']);
      expect(result2).toEqual(['valid']);
    });
  });

  describe('edge cases', () => {
    test('handles Windows-style paths', () => {
      const resolvedType: ResolvedType = {
        sourceFile: 'C:\\project\\node_modules\\@types\\node\\index.d.ts',
        name: 'Buffer',
        typeInfo: { kind: TypeKind.Reference, name: 'Buffer' },
        imports: [],
        dependencies: [],
      };

      const result = generator.generateTypeImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should handle Windows paths correctly
        expect(result.value).toBeDefined();
      }
    });

    test('handles very long import lists', () => {
      const manyImports = Array.from({ length: 100 }, (_, i) => `package-${i}`);

      const resolvedType: ResolvedType = {
        sourceFile: '/project/src/user.ts',
        name: 'User',
        typeInfo: {
          kind: TypeKind.Object as const,
          name: 'User',
          properties: [],
        },
        imports: manyImports,
        dependencies: [],
      };

      const result = generator.generateModuleImports(resolvedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(100);
      }
    });
  });
});
