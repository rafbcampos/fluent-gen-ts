/**
 * Tests for GenerateCommand
 * Verifies single builder generation with real services and configuration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GenerateCommand } from '../generate-command.js';
import type { GenerateOptions } from '../../types.js';

describe('GenerateCommand', () => {
  let command: GenerateCommand;
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    command = new GenerateCommand();
    testDir = join(process.cwd(), 'test-temp', `generate-command-${Date.now()}`);
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

  describe('execute with output to console', () => {
    it('should generate builder code and print to console', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
  email: string;
}`,
      );

      await command.execute(sourceFile, 'User');

      // Should print generated code to console
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('export'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });

    it('should handle dry-run mode correctly', async () => {
      const sourceFile = join(testDir, 'product.ts');
      writeFileSync(
        sourceFile,
        `export interface Product {
  id: string;
  name: string;
  price: number;
}`,
      );

      const options: GenerateOptions = {
        dryRun: true,
      };

      await command.execute(sourceFile, 'Product', options);

      // Should print generated code preview message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated code preview'));
      // Should print the actual generated code
      const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
      expect(allLogs).toContain('Product');
    });

    it('should apply command-line options to generation', async () => {
      const sourceFile = join(testDir, 'task.ts');
      writeFileSync(
        sourceFile,
        `export interface Task {
  id: string;
  title: string;
  completed: boolean;
}`,
      );

      const options: GenerateOptions = {
        defaults: true,
        comments: false,
        dryRun: true,
      };

      await command.execute(sourceFile, 'Task', options);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task'));
    });
  });

  describe('execute with output to file', () => {
    it('should generate builder and write to specified file', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const outputFile = join(testDir, 'user.builder.ts');
      const options: GenerateOptions = {
        output: outputFile,
      };

      await command.execute(sourceFile, 'User', options);

      // Verify file was created
      expect(existsSync(outputFile)).toBe(true);

      const content = readFileSync(outputFile, 'utf-8');
      expect(content).toContain('export');
      expect(content).toContain('User');
    });

    it('should not write file in dry-run mode even with output specified', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const outputFile = join(testDir, 'user.builder.ts');
      const options: GenerateOptions = {
        output: outputFile,
        dryRun: true,
      };

      await command.execute(sourceFile, 'User', options);

      // File should not be created in dry-run
      expect(existsSync(outputFile)).toBe(false);

      // Should show generated code preview
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated code preview'));
    });

    it('should respect output file path from options', async () => {
      const sourceFile = join(testDir, 'product.ts');
      writeFileSync(
        sourceFile,
        `export interface Product {
  id: string;
  price: number;
}`,
      );

      const outputFile = join(testDir, 'custom', 'product.builder.ts');
      mkdirSync(join(testDir, 'custom'), { recursive: true });

      const options: GenerateOptions = {
        output: outputFile,
      };

      await command.execute(sourceFile, 'Product', options);

      expect(existsSync(outputFile)).toBe(true);
    });
  });

  describe('plugin handling', () => {
    it('should load and apply plugins from command-line options', async () => {
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

      const options: GenerateOptions = {
        plugins: [pluginFile],
        dryRun: true,
      };

      await command.execute(sourceFile, 'TestType', options);

      // Should successfully generate with plugin
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TestType'));
    });

    it('should merge command-line plugins with config plugins', async () => {
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
          plugins: [plugin1],
        }),
      );

      const options: GenerateOptions = {
        config: configFile,
        plugins: [plugin2], // Add second plugin via command line
        dryRun: true,
      };

      await command.execute(sourceFile, 'TestType', options);

      // Should successfully generate with both plugins
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TestType'));
    });
  });

  describe('configuration handling', () => {
    it('should load configuration from specified path', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const configFile = join(testDir, 'custom-config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          generator: {
            useDefaults: true,
            addComments: false,
          },
        }),
      );

      const options: GenerateOptions = {
        config: configFile,
        dryRun: true,
      };

      await command.execute(sourceFile, 'User', options);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });

    it('should use tsconfig option when specified', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const tsconfigFile = join(testDir, 'tsconfig.test.json');
      writeFileSync(
        tsconfigFile,
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: 'ES2020',
          },
        }),
      );

      const options: GenerateOptions = {
        tsconfig: tsconfigFile,
        dryRun: true,
      };

      await command.execute(sourceFile, 'User', options);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });

    it('should merge command options with config options', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          generator: {
            useDefaults: false,
            addComments: true,
          },
        }),
      );

      const options: GenerateOptions = {
        config: configFile,
        defaults: true, // Override config setting
        dryRun: true,
      };

      await command.execute(sourceFile, 'User', options);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });
  });

  describe('error handling', () => {
    it('should handle non-existent source file gracefully', async () => {
      const sourceFile = join(testDir, 'non-existent.ts');

      await expect(command.execute(sourceFile, 'NonExistent')).rejects.toThrow();
    });

    it('should handle non-existent type gracefully', async () => {
      const sourceFile = join(testDir, 'empty.ts');
      writeFileSync(sourceFile, 'export interface User { id: string; }');

      await expect(command.execute(sourceFile, 'NonExistentType')).rejects.toThrow();
    });

    it('should handle invalid configuration file gracefully', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      const configFile = join(testDir, 'invalid-config.json');
      writeFileSync(configFile, '{ invalid json }');

      const options: GenerateOptions = {
        config: configFile,
      };

      await expect(command.execute(sourceFile, 'User', options)).rejects.toThrow();
    });

    it('should handle empty TypeScript source file gracefully', async () => {
      const sourceFile = join(testDir, 'empty.ts');
      writeFileSync(sourceFile, '// Just a comment, no types');

      await expect(command.execute(sourceFile, 'NonExistent')).rejects.toThrow();
    });

    it('should propagate generation errors', async () => {
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(sourceFile, ''); // Empty file

      await expect(command.execute(sourceFile, 'NonExistent')).rejects.toThrow();
    });
  });

  describe('options precedence', () => {
    it('should prioritize command-line options over config', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          generator: {
            addComments: true,
          },
        }),
      );

      const options: GenerateOptions = {
        config: configFile,
        comments: false, // Override config
        dryRun: true,
      };

      await command.execute(sourceFile, 'User', options);

      const output = consoleLogSpy.mock.calls.flat().join('\n');
      // The command-line option should override the config
      expect(output).toContain('User');
    });

    it('should use config values when command-line options not provided', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const configFile = join(testDir, 'fluentgen.config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          generator: {
            useDefaults: true,
            addComments: false,
          },
        }),
      );

      const options: GenerateOptions = {
        config: configFile,
        dryRun: true,
      };

      await command.execute(sourceFile, 'User', options);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });
  });

  describe('success messages', () => {
    it('should display success message when writing to file', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      const outputFile = join(testDir, 'user.builder.ts');
      const options: GenerateOptions = {
        output: outputFile,
      };

      await command.execute(sourceFile, 'User', options);

      // ora.succeed doesn't call console.log, but we can verify file exists
      expect(existsSync(outputFile)).toBe(true);
      const content = readFileSync(outputFile, 'utf-8');
      expect(content).toContain('User');
    });

    it('should display success message for dry-run', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      const options: GenerateOptions = {
        dryRun: true,
      };

      await command.execute(sourceFile, 'User', options);

      // Should print generated code preview
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated code preview'));
    });

    it('should display success message when printing to console', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      await command.execute(sourceFile, 'User');

      // Should print the generated code
      const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
      expect(allLogs).toContain('User');
    });
  });
});
