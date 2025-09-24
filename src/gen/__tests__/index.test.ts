import { describe, test, expect, beforeEach, vi } from 'vitest';
import { FluentGen } from '../index.js';
import { TypeExtractor } from '../../type-info/index.js';
import { BuilderGenerator } from '../generator.js';
import { PluginManager } from '../../core/plugin/index.js';
import { ok, err } from '../../core/result.js';
import type { ResolvedType } from '../../core/types.js';
import { TypeKind } from '../../core/types.js';
import type { Plugin } from '../../core/plugin/index.js';

// Mock the dependencies
vi.mock('../../type-info/index.js');
vi.mock('../generator.js');
vi.mock('../../core/plugin/index.js');
vi.mock('node:fs/promises');
vi.mock('node:path');
vi.mock('glob');

describe('FluentGen', () => {
  let mockTypeExtractor: TypeExtractor;
  let mockBuilderGenerator: BuilderGenerator;
  let mockPluginManager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create proper mock objects
    mockTypeExtractor = {
      extractType: vi.fn(),
      scanFile: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as TypeExtractor;

    mockBuilderGenerator = {
      generate: vi.fn(),
      setGeneratingMultiple: vi.fn(),
      generateCommonFile: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as BuilderGenerator;

    mockPluginManager = {
      register: vi.fn(),
    } as unknown as PluginManager;

    // Mock constructors
    vi.mocked(TypeExtractor).mockImplementation(() => mockTypeExtractor);
    vi.mocked(BuilderGenerator).mockImplementation(() => mockBuilderGenerator);
    vi.mocked(PluginManager).mockImplementation(() => mockPluginManager);
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      const fluentGen = new FluentGen();
      expect(fluentGen).toBeDefined();
      expect(TypeExtractor).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginManager: mockPluginManager,
        }),
      );
      expect(BuilderGenerator).toHaveBeenCalledWith({}, mockPluginManager);
    });

    test('should create instance with custom options', () => {
      const options = {
        outputDir: './custom',
        fileName: 'custom.ts',
        tsConfigPath: './tsconfig.json',
        useDefaults: false,
        contextType: 'CustomContext',
        addComments: false,
        maxDepth: 5,
      };

      const fluentGen = new FluentGen(options);
      expect(fluentGen).toBeDefined();
      expect(TypeExtractor).toHaveBeenCalledWith(
        expect.objectContaining({
          tsConfigPath: './tsconfig.json',
          maxDepth: 5,
          pluginManager: mockPluginManager,
        }),
      );
      expect(BuilderGenerator).toHaveBeenCalledWith(
        expect.objectContaining({
          useDefaults: false,
          contextType: 'CustomContext',
          addComments: false,
        }),
        mockPluginManager,
      );
    });

    test('should throw error for invalid outputDir', () => {
      expect(() => new FluentGen({ outputDir: '' })).toThrow(
        'Invalid FluentGen options: outputDir must be a non-empty string if provided',
      );
    });

    test('should throw error for invalid fileName', () => {
      expect(() => new FluentGen({ fileName: '' })).toThrow(
        'Invalid FluentGen options: fileName must be a non-empty string if provided',
      );
    });

    test('should throw error for invalid maxDepth', () => {
      expect(() => new FluentGen({ maxDepth: 0 })).toThrow(
        'Invalid FluentGen options: maxDepth must be between 1 and 100',
      );
      expect(() => new FluentGen({ maxDepth: 101 })).toThrow(
        'Invalid FluentGen options: maxDepth must be between 1 and 100',
      );
    });

    test('should throw error for invalid tsConfigPath', () => {
      expect(() => new FluentGen({ tsConfigPath: '' })).toThrow(
        'Invalid FluentGen options: tsConfigPath must be a non-empty string if provided',
      );
    });
  });

  describe('generateBuilder', () => {
    let fluentGen: FluentGen;

    beforeEach(() => {
      fluentGen = new FluentGen();
    });

    test('should generate builder successfully', async () => {
      const mockResolvedType: ResolvedType = {
        sourceFile: '/test/file.ts',
        name: 'User',
        typeInfo: {
          kind: TypeKind.Object,
          properties: [],
          genericParams: [],
        },
        imports: [],
        dependencies: [],
      };

      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(ok(mockResolvedType));
      vi.mocked(mockBuilderGenerator.generate).mockResolvedValue(ok('generated code'));

      const result = await fluentGen.generateBuilder('/test/file.ts', 'User');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('generated code');
      }
      expect(mockTypeExtractor.extractType).toHaveBeenCalledWith('/test/file.ts', 'User');
      expect(mockBuilderGenerator.generate).toHaveBeenCalledWith(mockResolvedType);
    });

    test('should return error for invalid filePath', async () => {
      const result = await fluentGen.generateBuilder('', 'User');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('filePath must be a non-empty string');
      }
    });

    test('should return error for invalid file extension', async () => {
      const result = await fluentGen.generateBuilder('/test/file.js', 'User');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(
          'filePath must be a TypeScript file (.ts, .tsx, or .d.ts)',
        );
      }
    });

    test('should return error for invalid typeName', async () => {
      const result = await fluentGen.generateBuilder('/test/file.ts', '');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('typeName must be a non-empty string');
      }
    });

    test('should return error for invalid TypeScript identifier', async () => {
      const result = await fluentGen.generateBuilder('/test/file.ts', '123Invalid');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(
          "typeName '123Invalid' is not a valid TypeScript identifier",
        );
      }
    });

    test('should return error when extractor fails', async () => {
      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(
        err(new Error('Extraction failed')),
      );

      const result = await fluentGen.generateBuilder('/test/file.ts', 'User');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Extraction failed');
      }
    });

    test('should return error when generator fails', async () => {
      const mockResolvedType: ResolvedType = {
        sourceFile: '/test/file.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [], genericParams: [] },
        imports: [],
        dependencies: [],
      };

      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(ok(mockResolvedType));
      vi.mocked(mockBuilderGenerator.generate).mockResolvedValue(
        err(new Error('Generation failed')),
      );

      const result = await fluentGen.generateBuilder('/test/file.ts', 'User');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Generation failed');
      }
    });
  });

  describe('generateMultiple', () => {
    let fluentGen: FluentGen;

    beforeEach(() => {
      fluentGen = new FluentGen();
    });

    test('should generate multiple builders successfully', async () => {
      const mockResolvedType: ResolvedType = {
        sourceFile: '/test/file.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [], genericParams: [] },
        imports: [],
        dependencies: [],
      };

      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(ok(mockResolvedType));
      vi.mocked(mockBuilderGenerator.generate).mockResolvedValue(ok('generated code'));
      vi.mocked(mockBuilderGenerator.generateCommonFile).mockReturnValue('common code');

      const result = await fluentGen.generateMultiple('/test/file.ts', ['User', 'Product']);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(3);
        expect(result.value.get('common.ts')).toBe('common code');
        expect(result.value.get('User.builder.ts')).toBe('generated code');
        expect(result.value.get('Product.builder.ts')).toBe('generated code');
      }

      expect(mockBuilderGenerator.setGeneratingMultiple).toHaveBeenCalledWith(true);
      expect(mockBuilderGenerator.setGeneratingMultiple).toHaveBeenCalledWith(false);
      expect(mockBuilderGenerator.clearCache).toHaveBeenCalled();
    });

    test('should return error for invalid filePath', async () => {
      const result = await fluentGen.generateMultiple('', ['User']);
      expect(result.ok).toBe(false);
    });

    test('should return error for invalid typeNames array', async () => {
      const result = await fluentGen.generateMultiple('/test/file.ts', []);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('typeNames array cannot be empty');
      }
    });

    test('should return error for invalid typeName in array', async () => {
      const result = await fluentGen.generateMultiple('/test/file.ts', ['User', '']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('typeName must be a non-empty string');
      }
    });

    test('should cleanup state even when generation fails', async () => {
      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(err(new Error('Failed')));

      const result = await fluentGen.generateMultiple('/test/file.ts', ['User']);
      expect(result.ok).toBe(false);

      expect(mockBuilderGenerator.setGeneratingMultiple).toHaveBeenCalledWith(false);
      expect(mockBuilderGenerator.clearCache).toHaveBeenCalled();
    });
  });

  describe('generateMultipleFromFiles', () => {
    let fluentGen: FluentGen;

    beforeEach(() => {
      fluentGen = new FluentGen();
    });

    test('should generate builders from multiple files successfully', async () => {
      const mockResolvedType: ResolvedType = {
        sourceFile: '/test/file.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [], genericParams: [] },
        imports: [],
        dependencies: [],
      };

      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(ok(mockResolvedType));
      vi.mocked(mockBuilderGenerator.generate).mockResolvedValue(ok('generated code'));
      vi.mocked(mockBuilderGenerator.generateCommonFile).mockReturnValue('common code');

      const fileTypeMap = new Map([
        ['/test/user.ts', ['User']],
        ['/test/product.ts', ['Product']],
      ]);

      const result = await fluentGen.generateMultipleFromFiles(fileTypeMap);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(3);
        expect(result.value.get('common.ts')).toBe('common code');
        expect(result.value.get('User.builder.ts')).toBe('generated code');
        expect(result.value.get('Product.builder.ts')).toBe('generated code');
      }

      expect(mockBuilderGenerator.setGeneratingMultiple).toHaveBeenCalledWith(true);
      expect(mockBuilderGenerator.setGeneratingMultiple).toHaveBeenCalledWith(false);
      expect(mockBuilderGenerator.clearCache).toHaveBeenCalled();
    });

    test('should return error for empty fileTypeMap', async () => {
      const result = await fluentGen.generateMultipleFromFiles(new Map());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('fileTypeMap cannot be empty');
      }
    });

    test('should validate all file paths', async () => {
      const fileTypeMap = new Map([['', ['User']]]);

      const result = await fluentGen.generateMultipleFromFiles(fileTypeMap);
      expect(result.ok).toBe(false);
    });

    test('should validate all type names', async () => {
      const fileTypeMap = new Map([['/test/file.ts', ['']]]);

      const result = await fluentGen.generateMultipleFromFiles(fileTypeMap);
      expect(result.ok).toBe(false);
    });

    test('should cleanup state even when generation fails', async () => {
      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(err(new Error('Failed')));

      const fileTypeMap = new Map([['/test/file.ts', ['User']]]);

      const result = await fluentGen.generateMultipleFromFiles(fileTypeMap);
      expect(result.ok).toBe(false);

      expect(mockBuilderGenerator.setGeneratingMultiple).toHaveBeenCalledWith(false);
      expect(mockBuilderGenerator.clearCache).toHaveBeenCalled();
    });
  });

  describe('generateToFile', () => {
    let fluentGen: FluentGen;

    beforeEach(async () => {
      fluentGen = new FluentGen();

      // Mock path module
      const mockPath = await import('node:path');
      vi.mocked(mockPath.dirname).mockReturnValue('/output');
      vi.mocked(mockPath.join).mockReturnValue('/output/user.builder.ts');

      // Mock fs promises
      const mockFs = await import('node:fs/promises');
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);
    });

    test('should generate and write to file successfully', async () => {
      const mockResolvedType: ResolvedType = {
        sourceFile: '/test/file.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [], genericParams: [] },
        imports: [],
        dependencies: [],
      };

      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(ok(mockResolvedType));
      vi.mocked(mockBuilderGenerator.generate).mockResolvedValue(ok('generated code'));

      const result = await fluentGen.generateToFile('/test/file.ts', 'User', '/custom/output.ts');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('/custom/output.ts');
      }

      const mockFs = await import('node:fs/promises');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/custom/output.ts', 'generated code', 'utf-8');
    });

    test('should return error for invalid outputPath', async () => {
      const result = await fluentGen.generateToFile('/test/file.ts', 'User', '');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('outputPath must be a non-empty string if provided');
      }
    });

    test('should handle file write errors', async () => {
      const mockResolvedType: ResolvedType = {
        sourceFile: '/test/file.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [], genericParams: [] },
        imports: [],
        dependencies: [],
      };

      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(ok(mockResolvedType));
      vi.mocked(mockBuilderGenerator.generate).mockResolvedValue(ok('generated code'));

      const mockFs = await import('node:fs/promises');
      vi.mocked(mockFs.writeFile).mockRejectedValue(new Error('Write failed'));

      const result = await fluentGen.generateToFile('/test/file.ts', 'User');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to write file');
      }
    });
  });

  describe('scanAndGenerate', () => {
    let fluentGen: FluentGen;

    beforeEach(() => {
      fluentGen = new FluentGen();

      // Mock glob module
      vi.doMock('glob', () => ({
        glob: vi.fn(),
      }));
    });

    test('should scan and generate successfully', async () => {
      const mockGlob = vi.fn().mockResolvedValue(['/test/file1.ts', '/test/file2.ts']);
      vi.doMock('glob', () => ({ glob: mockGlob }));

      vi.mocked(mockTypeExtractor.scanFile)
        .mockResolvedValueOnce(ok(['User']))
        .mockResolvedValueOnce(ok(['Product']));

      const mockResolvedType: ResolvedType = {
        sourceFile: '/test/file.ts',
        name: 'User',
        typeInfo: { kind: TypeKind.Object, properties: [], genericParams: [] },
        imports: [],
        dependencies: [],
      };

      vi.mocked(mockTypeExtractor.extractType).mockResolvedValue(ok(mockResolvedType));
      vi.mocked(mockBuilderGenerator.generate).mockResolvedValue(ok('generated code'));

      const result = await fluentGen.scanAndGenerate('**/*.ts');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.size).toBe(2);
        expect(result.value.has('/test/file1.ts:User')).toBe(true);
        expect(result.value.has('/test/file2.ts:Product')).toBe(true);
      }
    });

    test('should return error for invalid pattern', async () => {
      const result = await fluentGen.scanAndGenerate('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('pattern must be a non-empty string');
      }
    });

    test('should handle glob import errors', async () => {
      vi.doMock('glob', () => {
        throw new Error('Import failed');
      });

      const result = await fluentGen.scanAndGenerate('**/*.ts');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to scan and generate');
      }
    });
  });

  describe('registerPlugin', () => {
    let fluentGen: FluentGen;

    beforeEach(() => {
      fluentGen = new FluentGen();
    });

    test('should register plugin successfully', () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      const result = fluentGen.registerPlugin(mockPlugin);

      expect(result.ok).toBe(true);
      expect(mockPluginManager.register).toHaveBeenCalledWith(mockPlugin);
    });

    test('should return error when plugin registration fails', () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      vi.mocked(mockPluginManager.register).mockImplementation(() => {
        throw new Error('Registration failed');
      });

      const result = fluentGen.registerPlugin(mockPlugin);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to register plugin');
      }
    });
  });

  describe('clearCache', () => {
    test('should clear generator cache', () => {
      const fluentGen = new FluentGen();
      fluentGen.clearCache();
      expect(mockBuilderGenerator.clearCache).toHaveBeenCalled();
    });
  });
});
