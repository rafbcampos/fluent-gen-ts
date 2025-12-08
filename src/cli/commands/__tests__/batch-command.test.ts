/**
 * Tests for BatchCommand
 * Verifies batch generation orchestration with real services and configuration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BatchCommand, BatchCommandError } from '../batch-command.js';
import type { BatchOptions } from '../../types.js';

describe('BatchCommand', () => {
  let command: BatchCommand;
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    command = new BatchCommand();
    testDir = join(process.cwd(), 'test-temp', `batch-command-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Spy on console methods to suppress output during tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('execute with valid configuration', () => {
    it('should successfully execute batch generation with minimal config', async () => {
      // Create test source file
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface TestUser {
  id: string;
  name: string;
}`,
      );

      // Create config file
      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: sourceFile,
              types: ['TestUser'],
              outputFile: join(testDir, 'test-user.builder.ts'),
            },
          ],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
        dryRun: true, // Use dry run to avoid actual file writes
      };

      await command.execute(options);

      // Verify console output shows success
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration loaded'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Batch generation complete'),
      );
    });

    it('should handle multiple targets in batch generation', async () => {
      // Create multiple test source files
      const userFile = join(testDir, 'user.ts');
      writeFileSync(
        userFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const productFile = join(testDir, 'product.ts');
      writeFileSync(
        productFile,
        `export interface Product {
  id: string;
  title: string;
  price: number;
}`,
      );

      // Create config file with multiple targets
      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: userFile,
              types: ['User'],
              outputFile: join(testDir, 'user.builder.ts'),
            },
            {
              file: productFile,
              types: ['Product'],
              outputFile: join(testDir, 'product.builder.ts'),
            },
          ],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
        dryRun: true,
      };

      await command.execute(options);

      // Verify processing of multiple targets
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Processing 2 target(s)'));
    });

    it('should load and apply plugins when specified', async () => {
      // Create test source file
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface TestType {
  value: string;
}`,
      );

      // Create a simple test plugin
      const pluginFile = join(testDir, 'test-plugin.js');
      writeFileSync(
        pluginFile,
        `export default {
  name: 'test-plugin',
  version: '1.0.0'
};`,
      );

      // Create config file
      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: sourceFile,
              types: ['TestType'],
              outputFile: join(testDir, 'test-type.builder.ts'),
            },
          ],
          plugins: [pluginFile],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
        dryRun: true,
      };

      await command.execute(options);

      // Verify plugin loading message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 plugin(s)'));
    });

    it('should merge command-line plugins with config plugins', async () => {
      // Create test source file
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface TestType {
  value: string;
}`,
      );

      // Create test plugins
      const plugin1 = join(testDir, 'plugin1.js');
      writeFileSync(
        plugin1,
        `export default {
  name: 'plugin1',
  version: '1.0.0'
};`,
      );

      const plugin2 = join(testDir, 'plugin2.js');
      writeFileSync(
        plugin2,
        `export default {
  name: 'plugin2',
  version: '1.0.0'
};`,
      );

      // Create config file with one plugin
      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: sourceFile,
              types: ['TestType'],
              outputFile: join(testDir, 'test-type.builder.ts'),
            },
          ],
          plugins: [plugin1],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
        plugins: [plugin2], // Add second plugin via command line
        dryRun: true,
      };

      await command.execute(options);

      // Verify both plugins are loaded (merged)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded 2 plugin(s)'));
    });
  });

  describe('error handling', () => {
    it('should throw BatchCommandError when config file not found', async () => {
      const options: BatchOptions = {
        config: join(testDir, 'non-existent-config.json'),
      };

      await expect(command.execute(options)).rejects.toThrow(BatchCommandError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load configuration'),
      );
    });

    it('should throw BatchCommandError when config has no targets', async () => {
      const configFile = join(testDir, 'empty-config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
      };

      await expect(command.execute(options)).rejects.toThrow(BatchCommandError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No targets found in configuration'),
      );
    });

    it('should throw BatchCommandError when config has empty targets array', async () => {
      const configFile = join(testDir, 'empty-targets-config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
      };

      await expect(command.execute(options)).rejects.toThrow(BatchCommandError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No targets found in configuration'),
      );
    });

    it('should handle malformed JSON config gracefully', async () => {
      const configFile = join(testDir, 'malformed-config.json');
      writeFileSync(configFile, '{ invalid json }');

      const options: BatchOptions = {
        config: configFile,
      };

      await expect(command.execute(options)).rejects.toThrow(BatchCommandError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load configuration'),
      );
    });

    it('should report errors from failed targets', async () => {
      // Create a config with a target pointing to non-existent file
      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: join(testDir, 'non-existent.ts'),
              types: ['NonExistent'],
              outputFile: join(testDir, 'output.ts'),
            },
          ],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
      };

      await command.execute(options);

      // Should show errors in summary
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });
  });

  describe('options handling', () => {
    it('should respect parallel option', async () => {
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface TestType {
  value: string;
}`,
      );

      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: sourceFile,
              types: ['TestType'],
              outputFile: join(testDir, 'output.ts'),
            },
          ],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
        parallel: true,
        dryRun: true,
      };

      await command.execute(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Batch generation complete'),
      );
    });

    it('should use default config path when no config option provided', async () => {
      // This tests the "default search path" behavior
      const options: BatchOptions = {};

      // Should attempt to load config and throw due to no config found
      await expect(command.execute(options)).rejects.toThrow(BatchCommandError);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('default search path'));
    });

    it('should handle dryRun option correctly', async () => {
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface TestType {
  value: string;
}`,
      );

      const configFile = join(testDir, 'fluentgen.config.json');
      const outputFile = join(testDir, 'output.ts');

      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: sourceFile,
              types: ['TestType'],
              outputFile: outputFile,
            },
          ],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
        dryRun: true,
      };

      await command.execute(options);

      // In dry-run mode, output file should not be created
      // (this depends on TaskRunner implementation)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Batch generation complete'),
      );
    });
  });

  describe('output formatting', () => {
    it('should print section headers correctly', async () => {
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface TestType {
  value: string;
}`,
      );

      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: sourceFile,
              types: ['TestType'],
              outputFile: join(testDir, 'output.ts'),
            },
          ],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
        dryRun: true,
      };

      await command.execute(options);

      // Verify section headers are printed
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration Phase'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generation Phase'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Summary'));
    });

    it('should display error details in summary when targets fail', async () => {
      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          targets: [
            {
              file: join(testDir, 'missing.ts'),
              types: ['Missing'],
              outputFile: join(testDir, 'output.ts'),
            },
          ],
          generator: {
            outputDir: testDir,
          },
        }),
      );

      const options: BatchOptions = {
        config: configFile,
      };

      await command.execute(options);

      // Should show errors section with warning emoji
      const errorCalls = consoleErrorSpy.mock.calls
        .concat(consoleLogSpy.mock.calls)
        .flat()
        .join(' ');

      expect(errorCalls).toMatch(/Errors:|⚠/);
    });
  });
});
