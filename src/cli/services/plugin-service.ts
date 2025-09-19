import chalk from "chalk";
import path from "node:path";
import { PluginManager, type Plugin } from "../../core/plugin.js";

export class PluginService {
  private pluginManager = new PluginManager();

  isValidPlugin(obj: unknown): obj is Plugin {
    if (typeof obj !== "object" || obj === null) {
      return false;
    }

    const plugin = obj as Record<string, unknown>;

    return (
      typeof plugin.name === "string" &&
      typeof plugin.version === "string" &&
      plugin.name.length > 0 &&
      plugin.version.length > 0
    );
  }

  async loadPlugins(pluginPaths?: string[]): Promise<PluginManager> {
    if (!pluginPaths || pluginPaths.length === 0) {
      return this.pluginManager;
    }

    const results = await Promise.allSettled(
      pluginPaths.map(pluginPath => this.loadPlugin(pluginPath))
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const pluginPath = pluginPaths[index];
        console.error(
          chalk.red(`  ✗ Failed to load plugin ${pluginPath}:`),
          result.reason
        );
      }
    });

    return this.pluginManager;
  }

  private async loadPlugin(pluginPath: string): Promise<void> {
    const absolutePath = path.resolve(pluginPath);

    const pluginModule = await import(absolutePath);
    const pluginInstance = pluginModule.default || pluginModule;

    if (this.isValidPlugin(pluginInstance)) {
      this.pluginManager.register(pluginInstance);
      console.log(chalk.gray(`  ✓ Loaded plugin: ${pluginInstance.name}`));
    } else {
      console.warn(
        chalk.yellow(
          `  ⚠ Invalid plugin format in ${pluginPath} - missing required 'name' or 'version' properties`
        )
      );
    }
  }

  mergePluginPaths(
    optionPlugins?: string[],
    configPlugins?: string[]
  ): string[] {
    return [
      ...(optionPlugins || []),
      ...(configPlugins || [])
    ];
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }
}