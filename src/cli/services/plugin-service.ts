import chalk from 'chalk';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PluginManager, isValidPlugin } from '../../core/plugin/index.js';

/**
 * Service for managing plugin loading and validation
 */
export class PluginService {
  private pluginManager = new PluginManager();

  /**
   * Load plugins from the specified paths
   *
   * @param pluginPaths - Array of file paths to plugin modules
   * @returns Promise resolving to the PluginManager with loaded plugins
   *
   * @example
   * ```typescript
   * const manager = await pluginService.loadPlugins([
   *   './plugins/my-plugin.js',
   *   './plugins/another-plugin.js'
   * ]);
   * ```
   */
  async loadPlugins(pluginPaths?: string[]): Promise<PluginManager> {
    if (!pluginPaths || pluginPaths.length === 0) {
      return this.pluginManager;
    }

    const results = await Promise.allSettled(
      pluginPaths.map(pluginPath => this.loadPlugin(pluginPath)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const pluginPath = pluginPaths[index];
        console.error(chalk.red(`  ✗ Failed to load plugin ${pluginPath}:`), result.reason);
      }
    });

    return this.pluginManager;
  }

  private async loadPlugin(pluginPath: string): Promise<void> {
    const absolutePath = path.resolve(pluginPath);
    const isTypeScript = /\.(ts|mts|cts)$/.test(absolutePath);

    let pluginModule;

    if (isTypeScript) {
      // Use tsx for TypeScript files
      // Dynamic import with string concatenation to prevent bundler from resolving at build time
      const tsxModule = 'tsx/esm/api';
      const { register } = await import(/* @vite-ignore */ tsxModule);
      const unregister = register();

      try {
        // Convert to file URL for proper ESM import
        const fileUrl = pathToFileURL(absolutePath).href;
        pluginModule = await import(fileUrl);
      } finally {
        unregister();
      }
    } else {
      // Use regular import for JavaScript files
      pluginModule = await import(absolutePath);
    }

    const pluginInstance = pluginModule.default ?? pluginModule;

    if (isValidPlugin(pluginInstance)) {
      this.pluginManager.register(pluginInstance);
      console.log(chalk.gray(`  ✓ Loaded plugin: ${pluginInstance.name}`));
    } else {
      console.warn(
        chalk.yellow(
          `  ⚠ Invalid plugin format in ${pluginPath} - missing required 'name' or 'version' properties`,
        ),
      );
    }
  }

  /**
   * Merge plugin paths from command options and configuration
   *
   * @param optionPlugins - Plugin paths from command line options
   * @param configPlugins - Plugin paths from configuration file
   * @returns Merged array of plugin paths (options first, then config)
   *
   * @example
   * ```typescript
   * const paths = pluginService.mergePluginPaths(
   *   ['./cli-plugin.js'],
   *   ['./config-plugin.js']
   * );
   * // Returns: ['./cli-plugin.js', './config-plugin.js']
   * ```
   */
  mergePluginPaths(optionPlugins?: string[], configPlugins?: string[]): string[] {
    return [...(optionPlugins || []), ...(configPlugins || [])];
  }

  /**
   * Get the plugin manager instance
   *
   * @returns The PluginManager instance containing all loaded plugins
   */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }
}
