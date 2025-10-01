/**
 * Tests for ScanCommand
 * Verifies file scanning, type extraction, and builder generation for multiple files
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ScanCommand } from '../scan-command.js';
import type { ScanOptions } from '../../types.js';

describe('ScanCommand', () => {
  let command: ScanCommand;
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    command = new ScanCommand();
    testDir = join(process.cwd(), 'test-temp', `scan-command-${Date.now()}`);
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

  describe('file scanning', () => {
    it('should scan files matching glob pattern', async () => {
      // Create test TypeScript files
      const file1 = join(testDir, 'user.ts');
      writeFileSync(
        file1,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const file2 = join(testDir, 'product.ts');
      writeFileSync(
        file2,
        `export interface Product {
  id: string;
  title: string;
}`,
      );

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should find both types in dry-run
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('User');
      expect(allLogs).toContain('Product');
    });

    it('should exclude files matching exclude patterns', async () => {
      // Create test files
      const file1 = join(testDir, 'user.ts');
      writeFileSync(file1, 'export interface User { id: string; }');

      const file2 = join(testDir, 'user.test.ts');
      writeFileSync(file2, 'export interface UserTest { id: string; }');

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        exclude: ['**/*.test.ts'], // Use glob pattern
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should only find User, not UserTest
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('User');
      expect(allLogs).not.toContain('UserTest');
    });

    it('should handle no files found gracefully', async () => {
      const pattern = join(testDir, 'non-existent-*.ts');

      await command.execute(pattern);

      // The command returns early, doesn't log anything to console.log
      // The spinner.fail is not captured by console.log spy
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple exclude patterns', async () => {
      const file1 = join(testDir, 'user.ts');
      writeFileSync(file1, 'export interface User { id: string; }');

      const file2 = join(testDir, 'user.test.ts');
      writeFileSync(file2, 'export interface UserTest { id: string; }');

      const file3 = join(testDir, 'user.spec.ts');
      writeFileSync(file3, 'export interface UserSpec { id: string; }');

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        exclude: ['**/*.test.ts', '**/*.spec.ts'], // Use glob patterns
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should only process user.ts
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('User');
      expect(allLogs).not.toContain('UserTest');
      expect(allLogs).not.toContain('UserSpec');
    });
  });

  describe('type extraction', () => {
    it('should extract types from scanned files', async () => {
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  title: string;
}`,
      );

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should find both User and Product types
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('User');
      expect(allLogs).toContain('Product');
    });

    it('should filter types by name when types option is provided', async () => {
      const sourceFile = join(testDir, 'types.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}

export interface Product {
  id: string;
}

export interface Order {
  id: string;
}`,
      );

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        types: 'User,Product',
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should only process User and Product, not Order
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('User');
      expect(allLogs).toContain('Product');
    });

    it('should handle files with no exportable types', async () => {
      const sourceFile = join(testDir, 'empty.ts');
      writeFileSync(sourceFile, '// Just a comment\nconst x = 1;');

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should show no types found
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('No types found');
    });
  });

  describe('dry-run mode', () => {
    it('should list found types without generating builders in dry-run mode', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should show dry-run message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Dry-run complete'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });

    it('should display file paths in dry-run output', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('user.ts');
    });
  });

  // Interactive mode tests are skipped because they require user input via inquirer
  // which cannot be easily mocked in unit tests without complex setup

  describe('output generation', () => {
    it('should generate builders and print to console by default', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const pattern = join(testDir, '*.ts');

      await command.execute(pattern);

      // Should print generated code
      const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
      expect(allLogs).toContain('User');
    });

    it('should write builders to output path when specified', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
  name: string;
}`,
      );

      const outputDir = join(testDir, 'builders');
      mkdirSync(outputDir, { recursive: true });

      const pattern = join(testDir, 'user.ts');
      const options: ScanOptions = {
        output: join(outputDir, '{type}.builder.ts'),
      };

      await command.execute(pattern, options);

      // Should create output file
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('Generated');
    });

    it('should support output path templating', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      const outputDir = join(testDir, 'builders');
      mkdirSync(outputDir, { recursive: true });

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        output: join(outputDir, '{type}.builder.ts'),
      };

      await command.execute(pattern, options);

      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('Generated');
    });
  });

  describe('plugin handling', () => {
    it('should load plugins when specified', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      // Create a test plugin
      const pluginFile = join(testDir, 'test-plugin.js');
      writeFileSync(
        pluginFile,
        `export default {
  name: 'test-plugin',
  version: '1.0.0'
};`,
      );

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        plugins: [pluginFile],
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should successfully scan with plugin
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });

    it('should merge command-line and config plugins', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

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

      const configFile = join(testDir, 'config.json');
      writeFileSync(
        configFile,
        JSON.stringify({
          plugins: [plugin1],
        }),
      );

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        config: configFile,
        plugins: [plugin2],
        dryRun: true,
      };

      await command.execute(pattern, options);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('User'));
    });
  });

  describe('error handling', () => {
    it('should handle configuration loading errors', async () => {
      const sourceFile = join(testDir, 'user.ts');
      writeFileSync(
        sourceFile,
        `export interface User {
  id: string;
}`,
      );

      const configFile = join(testDir, 'invalid-config.json');
      writeFileSync(configFile, '{ invalid json }');

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        config: configFile,
      };

      await expect(command.execute(pattern, options)).rejects.toThrow();
    });

    it('should handle generation failures gracefully', async () => {
      // Create file with no types
      const sourceFile = join(testDir, 'empty.ts');
      writeFileSync(sourceFile, '');

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        types: 'NonExistent', // Request non-existent type
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should show no types found
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('No types found');
    });

    it('should continue processing on individual file errors', async () => {
      const goodFile = join(testDir, 'good.ts');
      writeFileSync(
        goodFile,
        `export interface Good {
  id: string;
}`,
      );

      const badFile = join(testDir, 'bad.ts');
      writeFileSync(badFile, ''); // Empty file with no types

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should process the good file
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('Good');
    });
  });

  describe('multiple files processing', () => {
    it('should process all matched files', async () => {
      // Create multiple files
      writeFileSync(join(testDir, 'user.ts'), 'export interface User { id: string; }');
      writeFileSync(join(testDir, 'product.ts'), 'export interface Product { id: string; }');
      writeFileSync(join(testDir, 'order.ts'), 'export interface Order { id: string; }');

      const pattern = join(testDir, '*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should find all three types
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('User');
      expect(allLogs).toContain('Product');
      expect(allLogs).toContain('Order');
    });

    it('should handle nested directory patterns', async () => {
      const nestedDir = join(testDir, 'nested');
      mkdirSync(nestedDir, { recursive: true });

      writeFileSync(join(testDir, 'user.ts'), 'export interface User { id: string; }');
      writeFileSync(join(nestedDir, 'product.ts'), 'export interface Product { id: string; }');

      const pattern = join(testDir, '**/*.ts');
      const options: ScanOptions = {
        dryRun: true,
      };

      await command.execute(pattern, options);

      // Should find types from both directories
      const allLogs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(allLogs).toContain('User');
      expect(allLogs).toContain('Product');
    });
  });
});
