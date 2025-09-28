import { describe, test, expect, beforeEach } from 'vitest';
import { ImportParser, ImportSerializer, ImportTransformUtilsImpl } from '../import-transformer.js';
import type { StructuredImport, RelativeToMonorepoMapping } from '../plugin-types.js';

describe('ImportParser', () => {
  describe('parseImport', () => {
    test('parses simple named imports', () => {
      const result = ImportParser.parseImport('import { Foo, Bar } from "./module.js";');

      expect(result).toEqual({
        source: './module.js',
        namedImports: [{ name: 'Foo' }, { name: 'Bar' }],
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('parses type-only imports', () => {
      const result = ImportParser.parseImport(
        'import type { User, Profile } from "@types/user.js";',
      );

      expect(result).toEqual({
        source: '@types/user.js',
        namedImports: [
          { name: 'User', isTypeOnly: true },
          { name: 'Profile', isTypeOnly: true },
        ],
        isTypeOnly: true,
        isSideEffect: false,
      });
    });

    test('parses mixed imports with default', () => {
      const result = ImportParser.parseImport('import React, { useState, type FC } from "react";');

      expect(result).toEqual({
        source: 'react',
        namedImports: [{ name: 'useState' }, { name: 'FC', isTypeOnly: true }],
        defaultImport: 'React',
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('parses default import only', () => {
      const result = ImportParser.parseImport('import React from "react";');

      expect(result).toEqual({
        source: 'react',
        namedImports: [],
        defaultImport: 'React',
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('parses namespace imports', () => {
      const result = ImportParser.parseImport('import * as utils from "./utils.js";');

      expect(result).toEqual({
        source: './utils.js',
        namedImports: [],
        namespaceImport: 'utils',
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('parses type-only namespace imports', () => {
      const result = ImportParser.parseImport('import type * as Types from "./types.js";');

      expect(result).toEqual({
        source: './types.js',
        namedImports: [],
        namespaceImport: 'Types',
        isTypeOnly: true,
        isSideEffect: false,
      });
    });

    test('parses side-effect imports', () => {
      const result = ImportParser.parseImport('import "./styles.css";');

      expect(result).toEqual({
        source: './styles.css',
        namedImports: [],
        isTypeOnly: false,
        isSideEffect: true,
      });
    });

    test('parses imports with aliases', () => {
      const result = ImportParser.parseImport(
        'import { foo as bar, baz as qux } from "./module.js";',
      );

      expect(result).toEqual({
        source: './module.js',
        namedImports: [
          { name: 'foo', alias: 'bar' },
          { name: 'baz', alias: 'qux' },
        ],
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('handles imports without semicolon', () => {
      const result = ImportParser.parseImport('import { Foo } from "./module.js"');

      expect(result).toEqual({
        source: './module.js',
        namedImports: [{ name: 'Foo' }],
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('throws error on invalid import statement', () => {
      expect(() => {
        ImportParser.parseImport('invalid import statement');
      }).toThrow('Invalid import statement');
    });
  });

  describe('parseImports', () => {
    test('parses multiple import statements', () => {
      const imports = [
        'import { A } from "./a.js";',
        'import type { B } from "./b.js";',
        'import React from "react";',
      ];

      const result = ImportParser.parseImports(imports);

      expect(result).toHaveLength(3);
      expect(result[0]?.namedImports[0]?.name).toBe('A');
      expect(result[1]?.isTypeOnly).toBe(true);
      expect(result[2]?.defaultImport).toBe('React');
    });

    test('filters out empty statements', () => {
      const imports = ['import { A } from "./a.js";', '', '   ', 'import { B } from "./b.js";'];

      const result = ImportParser.parseImports(imports);

      expect(result).toHaveLength(2);
    });
  });
});

describe('ImportSerializer', () => {
  describe('serializeImport', () => {
    test('serializes simple named imports', () => {
      const structuredImport: StructuredImport = {
        source: './module.js',
        namedImports: [{ name: 'Foo' }, { name: 'Bar' }],
        isTypeOnly: false,
        isSideEffect: false,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import { Foo, Bar } from "./module.js";');
    });

    test('serializes type-only imports', () => {
      const structuredImport: StructuredImport = {
        source: './types.js',
        namedImports: [
          { name: 'User', isTypeOnly: true },
          { name: 'Profile', isTypeOnly: true },
        ],
        isTypeOnly: true,
        isSideEffect: false,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import type { User, Profile } from "./types.js";');
    });

    test('serializes mixed imports with default', () => {
      const structuredImport: StructuredImport = {
        source: 'react',
        namedImports: [{ name: 'useState' }, { name: 'FC', isTypeOnly: true }],
        defaultImport: 'React',
        isTypeOnly: false,
        isSideEffect: false,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import React, { useState, type FC } from "react";');
    });

    test('serializes default import only', () => {
      const structuredImport: StructuredImport = {
        source: 'react',
        namedImports: [],
        defaultImport: 'React',
        isTypeOnly: false,
        isSideEffect: false,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import React from "react";');
    });

    test('serializes namespace imports', () => {
      const structuredImport: StructuredImport = {
        source: './utils.js',
        namedImports: [],
        namespaceImport: 'utils',
        isTypeOnly: false,
        isSideEffect: false,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import * as utils from "./utils.js";');
    });

    test('serializes type-only namespace imports', () => {
      const structuredImport: StructuredImport = {
        source: './types.js',
        namedImports: [],
        namespaceImport: 'Types',
        isTypeOnly: true,
        isSideEffect: false,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import type * as Types from "./types.js";');
    });

    test('serializes side-effect imports', () => {
      const structuredImport: StructuredImport = {
        source: './styles.css',
        namedImports: [],
        isTypeOnly: false,
        isSideEffect: true,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import "./styles.css";');
    });

    test('serializes imports with aliases', () => {
      const structuredImport: StructuredImport = {
        source: './module.js',
        namedImports: [
          { name: 'foo', alias: 'bar' },
          { name: 'baz', alias: 'qux' },
        ],
        isTypeOnly: false,
        isSideEffect: false,
      };

      const result = ImportSerializer.serializeImport(structuredImport);
      expect(result).toBe('import { foo as bar, baz as qux } from "./module.js";');
    });

    test('throws error on invalid structured import', () => {
      const invalidImport: StructuredImport = {
        source: './module.js',
        namedImports: [],
        isTypeOnly: false,
        isSideEffect: false,
      };

      expect(() => {
        ImportSerializer.serializeImport(invalidImport);
      }).toThrow('Invalid structured import: no imports specified');
    });
  });
});

describe('ImportTransformUtilsImpl', () => {
  let utils: ImportTransformUtilsImpl;

  beforeEach(() => {
    utils = new ImportTransformUtilsImpl();
  });

  describe('createImport', () => {
    test('creates simple import', () => {
      const result = utils.createImport('./module.js', {
        namedImports: ['Foo', 'Bar'],
      });

      expect(result).toEqual({
        source: './module.js',
        namedImports: [{ name: 'Foo' }, { name: 'Bar' }],
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('creates import with all options', () => {
      const result = utils.createImport('react', {
        defaultImport: 'React',
        namedImports: ['useState', { name: 'FC', isTypeOnly: true }],
        isTypeOnly: false,
      });

      expect(result).toEqual({
        source: 'react',
        namedImports: [{ name: 'useState' }, { name: 'FC', isTypeOnly: true }],
        defaultImport: 'React',
        isTypeOnly: false,
        isSideEffect: false,
      });
    });
  });

  describe('mergeImports', () => {
    test('merges imports from same source', () => {
      const imports: StructuredImport[] = [
        {
          source: './module.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
        {
          source: './module.js',
          namedImports: [{ name: 'B' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.mergeImports(imports);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        source: './module.js',
        namedImports: [{ name: 'A' }, { name: 'B' }],
        isTypeOnly: false,
        isSideEffect: false,
      });
    });

    test('prevents duplicate named imports', () => {
      const imports: StructuredImport[] = [
        {
          source: './module.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
        {
          source: './module.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.mergeImports(imports);

      expect(result).toHaveLength(1);
      expect(result[0]?.namedImports).toHaveLength(1);
      expect(result[0]?.namedImports[0]?.name).toBe('A');
    });

    test('merges default imports correctly', () => {
      const imports: StructuredImport[] = [
        {
          source: './module.js',
          namedImports: [{ name: 'A' }],
          defaultImport: 'Default',
          isTypeOnly: false,
          isSideEffect: false,
        },
        {
          source: './module.js',
          namedImports: [{ name: 'B' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.mergeImports(imports);

      expect(result).toHaveLength(1);
      expect(result[0]?.defaultImport).toBe('Default');
      expect(result[0]?.namedImports).toHaveLength(2);
    });

    test('preserves isSideEffect when merging', () => {
      const imports: StructuredImport[] = [
        {
          source: './module.js',
          namedImports: [],
          isTypeOnly: false,
          isSideEffect: true,
        },
        {
          source: './module.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.mergeImports(imports);

      expect(result).toHaveLength(1);
      expect(result[0]?.isSideEffect).toBe(true);
    });

    test('handles type-only merging correctly', () => {
      const imports: StructuredImport[] = [
        {
          source: './module.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
        {
          source: './module.js',
          namedImports: [{ name: 'B' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.mergeImports(imports);

      expect(result).toHaveLength(1);
      expect(result[0]?.isTypeOnly).toBe(false);
    });
  });

  describe('transformRelativeToMonorepo', () => {
    test('transforms relative imports to monorepo imports', () => {
      const imports: StructuredImport[] = [
        {
          source: '../../../types/User.js',
          namedImports: [{ name: 'User' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
        {
          source: '@external/package',
          namedImports: [{ name: 'External' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const mapping: RelativeToMonorepoMapping = {
        pathMappings: [
          {
            pattern: '../../../types/',
            replacement: '@my-org/types/',
          },
        ],
      };

      const result = utils.transformRelativeToMonorepo(imports, mapping);

      expect(result).toHaveLength(2);
      expect(result[0]?.source).toBe('@my-org/types/User.js');
      expect(result[1]?.source).toBe('@external/package');
    });

    test('does not match similar but different paths', () => {
      const imports: StructuredImport[] = [
        {
          source: './my-types/User.js',
          namedImports: [{ name: 'User' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
        {
          source: './types/User.js',
          namedImports: [{ name: 'User' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
      ];

      const mapping: RelativeToMonorepoMapping = {
        pathMappings: [
          {
            pattern: './types/',
            replacement: '@my-org/types/',
          },
        ],
      };

      const result = utils.transformRelativeToMonorepo(imports, mapping);

      expect(result[0]?.source).toBe('./my-types/User.js');
      expect(result[1]?.source).toBe('@my-org/types/User.js');
    });

    test('only matches pattern at start of path, not in middle', () => {
      const imports: StructuredImport[] = [
        {
          source: './components/types/User.js',
          namedImports: [{ name: 'User' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
        {
          source: './types/User.js',
          namedImports: [{ name: 'User' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
      ];

      const mapping: RelativeToMonorepoMapping = {
        pathMappings: [
          {
            pattern: './types/',
            replacement: '@my-org/types/',
          },
        ],
      };

      const result = utils.transformRelativeToMonorepo(imports, mapping);

      expect(result[0]?.source).toBe('./components/types/User.js');
      expect(result[1]?.source).toBe('@my-org/types/User.js');
    });

    test('handles RegExp patterns', () => {
      const imports: StructuredImport[] = [
        {
          source: '../types.js',
          namedImports: [{ name: 'Type' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
      ];

      const mapping: RelativeToMonorepoMapping = {
        pathMappings: [
          {
            pattern: '\\.\\./types\\.js$',
            isRegex: true,
            replacement: '@my-org/types',
          },
        ],
      };

      const result = utils.transformRelativeToMonorepo(imports, mapping);

      expect(result[0]?.source).toBe('@my-org/types');
    });

    test('uses first matching pattern when multiple patterns match', () => {
      const imports: StructuredImport[] = [
        {
          source: './types/User.js',
          namedImports: [{ name: 'User' }],
          isTypeOnly: true,
          isSideEffect: false,
        },
      ];

      const mapping: RelativeToMonorepoMapping = {
        pathMappings: [
          {
            pattern: './types/',
            replacement: '@my-org/types/',
          },
          {
            pattern: './types/User.js',
            replacement: '@my-org/users/User.js',
          },
        ],
      };

      const result = utils.transformRelativeToMonorepo(imports, mapping);

      expect(result[0]?.source).toBe('@my-org/types/User.js');
    });
  });

  describe('replaceSource', () => {
    test('replaces source with string pattern', () => {
      const imports: StructuredImport[] = [
        {
          source: './old-module.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.replaceSource(imports, {
        from: './old-module.js',
        to: './new-module.js',
      });

      expect(result[0]?.source).toBe('./new-module.js');
    });

    test('replaces source with RegExp pattern', () => {
      const imports: StructuredImport[] = [
        {
          source: './old-module.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.replaceSource(imports, { from: /old/, to: 'new' });

      expect(result[0]?.source).toBe('./new-module.js');
    });
  });

  describe('filterImports', () => {
    test('filters imports by predicate', () => {
      const imports: StructuredImport[] = [
        {
          source: './internal.js',
          namedImports: [{ name: 'A' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
        {
          source: '@external/package',
          namedImports: [{ name: 'B' }],
          isTypeOnly: false,
          isSideEffect: false,
        },
      ];

      const result = utils.filterImports(imports, imp => imp.source.startsWith('./'));

      expect(result).toHaveLength(1);
      expect(result[0]?.source).toBe('./internal.js');
    });
  });
});

describe('Round-trip conversion', () => {
  test('parse then serialize should preserve original', () => {
    const original = 'import React, { useState, type FC } from "react";';
    const parsed = ImportParser.parseImport(original);
    const serialized = ImportSerializer.serializeImport(parsed);

    expect(serialized).toBe(original);
  });

  test('handles complex imports correctly', () => {
    const imports = [
      'import type { User, Profile } from "./types.js";',
      'import React, { useState, useEffect } from "react";',
      'import * as utils from "./utils.js";',
      'import "./styles.css";',
    ];

    for (const importStmt of imports) {
      const parsed = ImportParser.parseImport(importStmt);
      const serialized = ImportSerializer.serializeImport(parsed);
      expect(serialized).toBe(importStmt);
    }
  });
});
