import { describe, test, expect } from 'vitest';
import { ImportManager, createImportManager } from '../plugin-import-manager.js';

describe('Plugin Import Manager', () => {
  describe('constructor and factory', () => {
    test('should create import manager with constructor', () => {
      const manager = new ImportManager();
      expect(manager).toBeInstanceOf(ImportManager);
    });

    test('should create import manager with factory function', () => {
      const manager = createImportManager();
      expect(manager).toBeInstanceOf(ImportManager);
    });

    test('should start with empty imports', () => {
      const manager = new ImportManager();
      const imports = manager.getImports();
      expect(imports).toEqual([]);
    });
  });

  describe('internal imports', () => {
    test('should add internal import with single named import', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', 'User');

      const imports = manager.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User'],
      });
    });

    test('should add internal import with multiple named imports', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', ['User', 'Address', 'Product']);

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User', 'Address', 'Product'],
      });
    });

    test('should add internal import with type-only option', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', 'User', { typeOnly: true });

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User'],
        isTypeOnly: true,
      });
    });

    test('should add internal import with default option', () => {
      const manager = new ImportManager();
      manager.addInternal('../utils.js', [], { isDefault: true, defaultName: 'utils' });

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../utils.js',
        imports: [],
        isDefault: true,
        defaultName: 'utils',
      });
    });

    test('should add internal import with all options', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', 'User', {
        typeOnly: true,
        isDefault: false,
        defaultName: 'UserType',
      });

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User'],
        isTypeOnly: true,
        isDefault: false,
        defaultName: 'UserType',
      });
    });

    test('should chain internal import calls fluently', () => {
      const manager = new ImportManager();
      const result = manager
        .addInternal('../types.js', 'User')
        .addInternal('../utils.js', 'helper');

      expect(result).toBe(manager);
      expect(manager.getImports()).toHaveLength(2);
    });
  });

  describe('external imports', () => {
    test('should add external import with single named import', () => {
      const manager = new ImportManager();
      manager.addExternal('lodash', 'merge');

      const imports = manager.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({
        kind: 'external',
        package: 'lodash',
        imports: ['merge'],
      });
    });

    test('should add external import with multiple named imports', () => {
      const manager = new ImportManager();
      manager.addExternal('@player-ui/types', ['Asset', 'Flow', 'Node']);

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'external',
        package: '@player-ui/types',
        imports: ['Asset', 'Flow', 'Node'],
      });
    });

    test('should add external import with type-only option', () => {
      const manager = new ImportManager();
      manager.addExternal('@types/node', 'Process', { typeOnly: true });

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'external',
        package: '@types/node',
        imports: ['Process'],
        isTypeOnly: true,
      });
    });

    test('should add external import with default option', () => {
      const manager = new ImportManager();
      manager.addExternal('express', [], { isDefault: true, defaultName: 'express' });

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'external',
        package: 'express',
        imports: [],
        isDefault: true,
        defaultName: 'express',
      });
    });

    test('should chain external import calls fluently', () => {
      const manager = new ImportManager();
      const result = manager.addExternal('lodash', 'merge').addExternal('uuid', 'v4');

      expect(result).toBe(manager);
      expect(manager.getImports()).toHaveLength(2);
    });
  });

  describe('convenience methods', () => {
    test('should add internal default import', () => {
      const manager = new ImportManager();
      manager.addInternalDefault('../utils.js', 'utils');

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../utils.js',
        imports: [],
        isDefault: true,
        defaultName: 'utils',
      });
    });

    test('should add external default import', () => {
      const manager = new ImportManager();
      manager.addExternalDefault('express', 'express');

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'external',
        package: 'express',
        imports: [],
        isDefault: true,
        defaultName: 'express',
      });
    });

    test('should add internal type-only imports', () => {
      const manager = new ImportManager();
      manager.addInternalTypes('../types.js', ['User', 'Product']);

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User', 'Product'],
        isTypeOnly: true,
      });
    });

    test('should add external type-only imports', () => {
      const manager = new ImportManager();
      manager.addExternalTypes('@types/express', ['Request', 'Response']);

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'external',
        package: '@types/express',
        imports: ['Request', 'Response'],
        isTypeOnly: true,
      });
    });

    test('should add internal type-only imports with single string', () => {
      const manager = new ImportManager();
      manager.addInternalTypes('../types.js', 'User');

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User'],
        isTypeOnly: true,
      });
    });

    test('should chain convenience method calls', () => {
      const manager = new ImportManager();
      const result = manager
        .addInternalDefault('../utils.js', 'utils')
        .addExternalDefault('lodash', '_')
        .addInternalTypes('../types.js', 'User')
        .addExternalTypes('@types/node', 'Process');

      expect(result).toBe(manager);
      expect(manager.getImports()).toHaveLength(4);
    });
  });

  describe('mixed imports', () => {
    test('should handle mixed internal and external imports', () => {
      const manager = new ImportManager();
      manager
        .addInternal('../types.js', 'User')
        .addExternal('lodash', 'merge')
        .addInternalTypes('../interfaces.js', 'Config')
        .addExternalDefault('express', 'app');

      const imports = manager.getImports();
      expect(imports).toHaveLength(4);

      const internalImports = imports.filter(imp => imp.kind === 'internal');
      const externalImports = imports.filter(imp => imp.kind === 'external');

      expect(internalImports).toHaveLength(2);
      expect(externalImports).toHaveLength(2);
    });

    test('should preserve import order', () => {
      const manager = new ImportManager();
      manager
        .addExternal('first', 'first')
        .addInternal('../second.js', 'second')
        .addExternal('third', 'third');

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'external',
        package: 'first',
        imports: ['first'],
      });
      expect(imports[1]).toEqual({
        kind: 'internal',
        path: '../second.js',
        imports: ['second'],
      });
      expect(imports[2]).toEqual({
        kind: 'external',
        package: 'third',
        imports: ['third'],
      });
    });
  });

  describe('deduplication', () => {
    test('should deduplicate identical imports', () => {
      const manager = new ImportManager();
      manager
        .addInternal('../types.js', 'User')
        .addInternal('../types.js', 'User')
        .addExternal('lodash', 'merge')
        .addExternal('lodash', 'merge');

      const deduplicated = manager.deduplicate();
      const imports = deduplicated.getImports();

      expect(imports).toHaveLength(2);
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User'],
      });
      expect(imports[1]).toEqual({
        kind: 'external',
        package: 'lodash',
        imports: ['merge'],
      });
    });

    test('should merge imports from same source', () => {
      const manager = new ImportManager();
      manager
        .addInternal('../types.js', 'User')
        .addInternal('../types.js', 'Product')
        .addExternal('lodash', 'merge')
        .addExternal('lodash', 'cloneDeep');

      const deduplicated = manager.deduplicate();
      const imports = deduplicated.getImports();

      expect(imports).toHaveLength(2);

      const internalImport = imports.find(imp => imp.kind === 'internal');
      if (internalImport && internalImport.kind === 'internal') {
        expect(internalImport.imports).toEqual(expect.arrayContaining(['User', 'Product']));
      }

      const externalImport = imports.find(imp => imp.kind === 'external');
      if (externalImport && externalImport.kind === 'external') {
        expect(externalImport.imports).toEqual(expect.arrayContaining(['merge', 'cloneDeep']));
      }
    });

    test('should keep type-only and regular imports separate during deduplication', () => {
      const manager = new ImportManager();
      manager
        .addInternal('../types.js', 'User', { typeOnly: true })
        .addInternal('../types.js', 'Product', { typeOnly: false });

      const deduplicated = manager.deduplicate();
      const imports = deduplicated.getImports();

      // Should have 2 separate imports - one type-only, one regular
      expect(imports).toHaveLength(2);

      const typeOnlyImport = imports.find(imp => imp.isTypeOnly === true);
      const regularImport = imports.find(imp => imp.isTypeOnly === false);

      expect(typeOnlyImport).toBeDefined();
      if (typeOnlyImport) {
        expect(typeOnlyImport.imports).toEqual(['User']);
      }

      expect(regularImport).toBeDefined();
      if (regularImport) {
        expect(regularImport.imports).toEqual(['Product']);
      }
    });

    test('should return new ImportManager instance', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', 'User');

      const deduplicated = manager.deduplicate();

      expect(deduplicated).not.toBe(manager);
      expect(deduplicated).toBeInstanceOf(ImportManager);
    });

    test('should handle empty imports during deduplication', () => {
      const manager = new ImportManager();
      const deduplicated = manager.deduplicate();

      expect(deduplicated.getImports()).toEqual([]);
    });
  });

  describe('import statement generation', () => {
    test('should generate basic import statements', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', ['User', 'Product']).addExternal('lodash', 'merge');

      const statements = manager.toImportStatements();

      expect(statements).toHaveLength(2);
      expect(statements).toContain("import { User, Product } from '../types.js';");
      expect(statements).toContain("import { merge } from 'lodash';");
    });

    test('should generate type-only import statements', () => {
      const manager = new ImportManager();
      manager.addInternalTypes('../types.js', 'User');

      const statements = manager.toImportStatements();
      expect(statements).toContain("import type { User } from '../types.js';");
    });

    test('should generate separate statements for type-only and regular imports from same source', () => {
      const manager = new ImportManager();
      manager
        .addInternal('../types.js', 'User', { typeOnly: true })
        .addInternal('../types.js', 'createUser', { typeOnly: false });

      const statements = manager.toImportStatements();

      expect(statements).toHaveLength(2);
      expect(statements).toContain("import type { User } from '../types.js';");
      expect(statements).toContain("import { createUser } from '../types.js';");
    });

    test('should generate default import statements', () => {
      const manager = new ImportManager();
      manager.addInternalDefault('../utils.js', 'utils').addExternalDefault('express', 'express');

      const statements = manager.toImportStatements();
      expect(statements).toContain("import utils from '../utils.js';");
      expect(statements).toContain("import express from 'express';");
    });

    test('should generate mixed import statements', () => {
      const manager = new ImportManager();
      manager.addExternal('express', ['Request', 'Response'], {
        isDefault: true,
        defaultName: 'express',
      });

      const statements = manager.toImportStatements();
      expect(statements).toContain("import express, { Request, Response } from 'express';");
    });

    test('should handle empty imports gracefully', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', []);

      const statements = manager.toImportStatements();
      expect(statements).toContain("import '../types.js';");
    });

    test('should sort imports by type (internal first, then external)', () => {
      const manager = new ImportManager();
      manager
        .addExternal('lodash', 'merge')
        .addInternal('../types.js', 'User')
        .addExternal('uuid', 'v4')
        .addInternal('../utils.js', 'helper');

      const statements = manager.toImportStatements();

      const internalIndex = statements.findIndex(s => s.includes('../'));
      const externalIndex = statements.findIndex(s => !s.includes('../') && s.includes('lodash'));

      expect(internalIndex).toBeLessThan(externalIndex);
    });

    test('should generate statements without duplicates after deduplication', () => {
      const manager = new ImportManager();
      manager
        .addInternal('../types.js', 'User')
        .addInternal('../types.js', 'User')
        .addInternal('../types.js', 'Product');

      const deduplicated = manager.deduplicate();
      const statements = deduplicated.toImportStatements();

      expect(statements).toHaveLength(1);
      expect(statements[0]).toBe("import { User, Product } from '../types.js';");
    });
  });

  describe('plugin imports conversion', () => {
    test('should convert to PluginImports format', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', 'User').addExternal('lodash', 'merge');

      const pluginImports = manager.toPluginImports();

      expect(pluginImports).toEqual({
        imports: [
          {
            kind: 'internal',
            path: '../types.js',
            imports: ['User'],
          },
          {
            kind: 'external',
            package: 'lodash',
            imports: ['merge'],
          },
        ],
      });
    });

    test('should convert empty imports to PluginImports', () => {
      const manager = new ImportManager();
      const pluginImports = manager.toPluginImports();

      expect(pluginImports).toEqual({
        imports: [],
      });
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty string imports', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', '');

      const imports = manager.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]!.imports).toEqual(['']);
    });

    test('should handle special characters in paths and package names', () => {
      const manager = new ImportManager();
      manager
        .addInternal('../types-special.js', 'User')
        .addExternal('@scope/package-name', 'helper');

      const imports = manager.getImports();
      expect(imports).toHaveLength(2);
      const internalImport = imports.find(imp => imp.kind === 'internal');
      const externalImport = imports.find(imp => imp.kind === 'external');
      expect(internalImport?.path).toBe('../types-special.js');
      expect(externalImport?.package).toBe('@scope/package-name');
    });

    test('should handle duplicate names from different sources', () => {
      const manager = new ImportManager();
      manager.addInternal('../user.js', 'User').addExternal('@types/user', 'User');

      const imports = manager.getImports();
      expect(imports).toHaveLength(2);
      expect(imports[0]!.imports).toEqual(['User']);
      expect(imports[1]!.imports).toEqual(['User']);
    });

    test('should preserve option values when explicitly set to false', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', 'User', {
        typeOnly: false,
        isDefault: false,
      });

      const imports = manager.getImports();
      expect(imports).toHaveLength(1);
      expect(imports[0]!.isTypeOnly).toBe(false);
      expect(imports[0]!.isDefault).toBe(false);
    });

    test('should handle undefined options gracefully', () => {
      const manager = new ImportManager();
      manager.addInternal('../types.js', 'User', {});

      const imports = manager.getImports();
      expect(imports[0]).toEqual({
        kind: 'internal',
        path: '../types.js',
        imports: ['User'],
      });
      expect(imports).toHaveLength(1);
      expect(imports[0]!.isTypeOnly).toBeUndefined();
      expect(imports[0]!.isDefault).toBeUndefined();
      expect(imports[0]!.defaultName).toBeUndefined();
    });
  });

  describe('fluent API chaining', () => {
    test('should support complex fluent chains', () => {
      const manager = createImportManager()
        .addInternalTypes('../types.js', ['User', 'Product'])
        .addExternalTypes('@player-ui/types', ['Asset', 'Flow'])
        .addInternalDefault('../utils.js', 'utils')
        .addExternalDefault('lodash', '_')
        .addInternal('../helpers.js', 'format', { typeOnly: false })
        .addExternal('uuid', 'v4');

      expect(manager.getImports()).toHaveLength(6);

      const statements = manager.toImportStatements();
      expect(statements).toContain("import type { User, Product } from '../types.js';");
      expect(statements).toContain("import type { Asset, Flow } from '@player-ui/types';");
      expect(statements).toContain("import utils from '../utils.js';");
      expect(statements).toContain("import _ from 'lodash';");
      expect(statements).toContain("import { format } from '../helpers.js';");
      expect(statements).toContain("import { v4 } from 'uuid';");
    });

    test('should maintain method chaining through deduplication', () => {
      const result = createImportManager()
        .addInternal('../types.js', 'User')
        .addInternal('../types.js', 'User')
        .deduplicate()
        .addExternal('lodash', 'merge');

      expect(result).toBeInstanceOf(ImportManager);
      expect(result.getImports()).toHaveLength(2);
    });
  });
});
