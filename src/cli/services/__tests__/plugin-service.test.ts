/**
 * Tests for PluginService
 * Verifies plugin loading, validation, and path merging functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginService } from '../plugin-service.js';
import { isValidPlugin, type Plugin } from '../../../core/plugin/index.js';

describe('PluginService', () => {
  let pluginService: PluginService;

  beforeEach(() => {
    pluginService = new PluginService();
    vi.clearAllMocks();
  });

  describe('isValidPlugin (from core)', () => {
    it('should return true for a valid plugin', () => {
      const validPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      expect(isValidPlugin(validPlugin)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidPlugin(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidPlugin(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isValidPlugin('string')).toBe(false);
      expect(isValidPlugin(123)).toBe(false);
      expect(isValidPlugin(true)).toBe(false);
    });

    it('should return false for object without name', () => {
      const plugin = { version: '1.0.0' };
      expect(isValidPlugin(plugin)).toBe(false);
    });

    it('should return false for object without version', () => {
      const plugin = { name: 'test-plugin' };
      expect(isValidPlugin(plugin)).toBe(false);
    });

    it('should return false for object with empty name', () => {
      const plugin = { name: '', version: '1.0.0' };
      expect(isValidPlugin(plugin)).toBe(false);
    });

    it('should return false for object with empty version', () => {
      const plugin = { name: 'test-plugin', version: '' };
      expect(isValidPlugin(plugin)).toBe(false);
    });

    it('should return false for object with non-string name', () => {
      const plugin = { name: 123, version: '1.0.0' };
      expect(isValidPlugin(plugin)).toBe(false);
    });

    it('should return false for object with non-string version', () => {
      const plugin = { name: 'test-plugin', version: 123 };
      expect(isValidPlugin(plugin)).toBe(false);
    });

    it('should return true for plugin with extra properties', () => {
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        extraField: 'extra',
      };
      expect(isValidPlugin(plugin)).toBe(true);
    });
  });

  describe('mergePluginPaths', () => {
    it('should merge two arrays of plugin paths', () => {
      const optionPlugins = ['plugin1.js', 'plugin2.js'];
      const configPlugins = ['plugin3.js', 'plugin4.js'];

      const result = pluginService.mergePluginPaths(optionPlugins, configPlugins);

      expect(result).toEqual(['plugin1.js', 'plugin2.js', 'plugin3.js', 'plugin4.js']);
    });

    it('should handle undefined optionPlugins', () => {
      const configPlugins = ['plugin1.js', 'plugin2.js'];

      const result = pluginService.mergePluginPaths(undefined, configPlugins);

      expect(result).toEqual(['plugin1.js', 'plugin2.js']);
    });

    it('should handle undefined configPlugins', () => {
      const optionPlugins = ['plugin1.js', 'plugin2.js'];

      const result = pluginService.mergePluginPaths(optionPlugins, undefined);

      expect(result).toEqual(['plugin1.js', 'plugin2.js']);
    });

    it('should handle both arrays being undefined', () => {
      const result = pluginService.mergePluginPaths(undefined, undefined);

      expect(result).toEqual([]);
    });

    it('should handle empty arrays', () => {
      const result = pluginService.mergePluginPaths([], []);

      expect(result).toEqual([]);
    });

    it('should preserve order (options first, then config)', () => {
      const optionPlugins = ['option1.js'];
      const configPlugins = ['config1.js'];

      const result = pluginService.mergePluginPaths(optionPlugins, configPlugins);

      expect(result[0]).toBe('option1.js');
      expect(result[1]).toBe('config1.js');
    });

    it('should allow duplicate paths', () => {
      const optionPlugins = ['plugin1.js', 'plugin2.js'];
      const configPlugins = ['plugin1.js', 'plugin3.js'];

      const result = pluginService.mergePluginPaths(optionPlugins, configPlugins);

      expect(result).toEqual(['plugin1.js', 'plugin2.js', 'plugin1.js', 'plugin3.js']);
    });
  });

  describe('loadPlugins', () => {
    it('should return empty plugin manager when no paths provided', async () => {
      const manager = await pluginService.loadPlugins();

      expect(manager).toBeDefined();
    });

    it('should return empty plugin manager when empty array provided', async () => {
      const manager = await pluginService.loadPlugins([]);

      expect(manager).toBeDefined();
    });

    it('should return empty plugin manager when undefined provided', async () => {
      const manager = await pluginService.loadPlugins(undefined);

      expect(manager).toBeDefined();
    });
  });

  describe('getPluginManager', () => {
    it('should return the plugin manager instance', () => {
      const manager = pluginService.getPluginManager();

      expect(manager).toBeDefined();
    });

    it('should return the same instance on multiple calls', () => {
      const manager1 = pluginService.getPluginManager();
      const manager2 = pluginService.getPluginManager();

      expect(manager1).toBe(manager2);
    });
  });
});
