/**
 * Tests for GeneratorService
 * Verifies generator configuration building and option merging functionality
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { GeneratorService } from '../generator-service.js';
import type { Config, GeneratorConfig } from '../../config.js';
import type { CommandOptions } from '../../types.js';

describe('GeneratorService', () => {
  let service: GeneratorService;

  beforeEach(() => {
    service = new GeneratorService();
  });

  describe('buildFluentGenOptions', () => {
    it('should build options from command options', () => {
      const options: CommandOptions = {
        tsConfigPath: './tsconfig.json',
        outputDir: './output',
        fileName: 'test.ts',
        useDefaults: true,
        addComments: false,
        contextType: 'TestContext',
      };

      const result = service.buildFluentGenOptions(options);

      expect(result).toEqual({
        tsConfigPath: './tsconfig.json',
        outputDir: './output',
        fileName: 'test.ts',
        useDefaults: true,
        addComments: false,
        contextType: 'TestContext',
      });
    });

    it('should handle undefined values by omitting them', () => {
      const options: CommandOptions = {
        outputDir: './output',
      };

      const result = service.buildFluentGenOptions(options);

      expect(result).toEqual({
        outputDir: './output',
      });
    });

    it('should return empty object for empty options', () => {
      const result = service.buildFluentGenOptions({});
      expect(result).toEqual({});
    });
  });

  describe('buildBaseOptions', () => {
    it('should build options from generator config', () => {
      const config: GeneratorConfig = {
        outputDir: './gen',
        useDefaults: true,
        contextType: 'BaseContext',
        addComments: true,
      };

      const result = service.buildBaseOptions(config);

      expect(result).toEqual({
        outputDir: './gen',
        useDefaults: true,
        contextType: 'BaseContext',
        addComments: true,
      });
    });

    it('should handle undefined config', () => {
      const result = service.buildBaseOptions(undefined);
      expect(result).toEqual({});
    });

    it('should handle partial config', () => {
      const config: GeneratorConfig = {
        outputDir: './gen',
      };

      const result = service.buildBaseOptions(config);

      expect(result).toEqual({
        outputDir: './gen',
      });
    });
  });

  describe('mergeGeneratorOptions', () => {
    it('should merge config, command options, and output path', () => {
      const config: Config = {
        tsConfigPath: './tsconfig.json',
        generator: {
          outputDir: './gen',
          useDefaults: true,
        },
      };

      const commandOptions: Partial<CommandOptions> = {
        addComments: true,
      };

      const result = service.mergeGeneratorOptions({
        config,
        commandOptions,
        outputPath: './custom/output.ts',
      });

      expect(result).toEqual({
        outputDir: './custom',
        fileName: 'output.ts',
        tsConfigPath: './tsconfig.json',
        useDefaults: true,
        addComments: true,
      });
    });

    it('should handle empty output path', () => {
      const config: Config = {
        generator: {
          outputDir: './gen',
        },
      };

      const result = service.mergeGeneratorOptions({
        config,
        commandOptions: {},
        outputPath: '',
      });

      expect(result).toEqual({
        outputDir: '.',
        fileName: '',
      });
    });

    it('should handle undefined output path', () => {
      const config: Config = {
        generator: {
          outputDir: './gen',
        },
      };

      const result = service.mergeGeneratorOptions({
        config,
        commandOptions: {},
      });

      expect(result).toEqual({
        outputDir: './gen',
      });
    });

    it('should prioritize command options over config', () => {
      const config: Config = {
        tsConfigPath: './tsconfig.json',
        generator: {
          useDefaults: false,
          addComments: false,
        },
      };

      const commandOptions: Partial<CommandOptions> = {
        tsConfigPath: './custom-tsconfig.json',
        useDefaults: true,
        addComments: true,
      };

      const result = service.mergeGeneratorOptions({
        config,
        commandOptions,
      });

      expect(result).toEqual({
        tsConfigPath: './custom-tsconfig.json',
        useDefaults: true,
        addComments: true,
      });
    });
  });

  describe('createGenerator', () => {
    it('should create FluentGen with basic config', () => {
      const config: Config = {
        generator: {
          outputDir: './gen',
        },
      };

      const generator = service.createGenerator({ config });

      expect(generator).toBeDefined();
    });

    it('should include monorepo config when enabled', () => {
      const config: Config = {
        generator: {
          outputDir: './gen',
        },
        monorepo: {
          enabled: true,
          workspaceRoot: './packages',
        },
      };

      const generator = service.createGenerator({ config });

      expect(generator).toBeDefined();
    });

    it('should handle overrides', () => {
      const config: Config = {
        generator: {
          outputDir: './gen',
        },
      };

      const overrides: Partial<CommandOptions> = {
        outputDir: './custom',
        fileName: 'custom.ts',
      };

      const generator = service.createGenerator({
        config,
        overrides,
      });

      expect(generator).toBeDefined();
    });

    it('should convert factoryTransform string to namingStrategy function', () => {
      const config: Config = {
        generator: {
          outputDir: './gen',
          naming: {
            factoryTransform: "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()",
          },
        },
      };

      const generator = service.createGenerator({ config });

      expect(generator).toBeDefined();
      // The generator should have been created with a namingStrategy
      // We can't directly test the private config, but we can verify it was created successfully
    });

    it('should handle invalid factoryTransform gracefully', () => {
      const config: Config = {
        generator: {
          outputDir: './gen',
          naming: {
            factoryTransform: 'invalid syntax ((',
          },
        },
      };

      // Should not throw, but log a warning
      const generator = service.createGenerator({ config });

      expect(generator).toBeDefined();
    });
  });
});
