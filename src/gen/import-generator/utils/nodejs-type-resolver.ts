import { builtinModules } from 'node:module';
import { Project, SourceFile, TypeChecker } from 'ts-morph';

/**
 * Represents a mapping between a Node.js type name and its containing module
 */
interface NodeJSTypeInfo {
  /** The name of the TypeScript type (e.g., 'EventEmitter') */
  readonly typeName: string;
  /** The Node.js module that exports this type (e.g., 'events') */
  readonly module: string;
}

/**
 * Resolves Node.js built-in types to their corresponding modules using runtime discovery
 */
export class NodeJSTypeResolver {
  private readonly typeToModuleCache = new Map<string, string>();
  private readonly builtinModulesSet = new Set(builtinModules);
  private readonly globalTypes = new Set<string>();
  private readonly project?: Project;
  private readonly typeChecker?: TypeChecker;
  private nodeTypesFilesCache: SourceFile[] | undefined;

  /**
   * Creates a new NodeJS type resolver
   *
   * @param tsConfigPath - Optional path to a TypeScript configuration file for enhanced type resolution.
   *                      If provided, enables more accurate type resolution using the TypeScript compiler API.
   *                      Falls back to pattern matching if the config cannot be loaded.
   *
   * @example
   * ```typescript
   * // Basic usage with pattern matching only
   * const resolver = new NodeJSTypeResolver();
   *
   * // Enhanced usage with TypeScript configuration
   * const resolverWithConfig = new NodeJSTypeResolver('./tsconfig.json');
   * ```
   */
  constructor(tsConfigPath?: string) {
    // Use the user's TypeScript configuration if available
    if (tsConfigPath) {
      try {
        this.project = new Project({
          tsConfigFilePath: tsConfigPath,
        });
        this.typeChecker = this.project.getTypeChecker();
      } catch {
        console.warn(
          `Could not load TypeScript config from ${tsConfigPath}, falling back to pattern matching only`,
        );
      }
    }

    this.initializeKnownTypeMappings();
  }

  /**
   * Initialize mappings for commonly used Node.js types that don't follow
   * a simple module name pattern
   */
  private initializeKnownTypeMappings(): void {
    // Global types that should NOT be resolved to modules
    const globalTypesList = [
      'ArrayBuffer',
      'SharedArrayBuffer',
      'DataView',
      'Promise',
      'Error',
      'RegExp',
      'Date',
      'Map',
      'Set',
      'WeakMap',
      'WeakSet',
      'Symbol',
      'Int8Array',
      'Uint8Array',
      'Int16Array',
      'Uint16Array',
      'Int32Array',
      'Uint32Array',
      'Float32Array',
      'Float64Array',
      'BigInt64Array',
      'BigUint64Array',
      'Buffer', // Buffer is global in Node.js
    ];

    for (const globalType of globalTypesList) {
      this.globalTypes.add(globalType);
    }

    // Core types that are exported from specific modules
    const knownMappings: NodeJSTypeInfo[] = [
      // Events module
      { typeName: 'EventEmitter', module: 'events' },

      // Stream module
      { typeName: 'Readable', module: 'stream' },
      { typeName: 'Writable', module: 'stream' },
      { typeName: 'Transform', module: 'stream' },
      { typeName: 'Duplex', module: 'stream' },
      { typeName: 'PassThrough', module: 'stream' },

      // URL module
      { typeName: 'URL', module: 'url' },
      { typeName: 'URLSearchParams', module: 'url' },

      // HTTP module
      { typeName: 'IncomingMessage', module: 'http' },
      { typeName: 'OutgoingMessage', module: 'http' },
      { typeName: 'Server', module: 'http' },
      { typeName: 'ClientRequest', module: 'http' },
      { typeName: 'ServerResponse', module: 'http' },

      // HTTPS module
      { typeName: 'Agent', module: 'https' },

      // FS module
      { typeName: 'Stats', module: 'fs' },
      { typeName: 'Dirent', module: 'fs' },
      { typeName: 'ReadStream', module: 'fs' },
      { typeName: 'WriteStream', module: 'fs' },

      // Child Process module
      { typeName: 'ChildProcess', module: 'child_process' },
      { typeName: 'ChildProcessWithoutNullStreams', module: 'child_process' },
      { typeName: 'ChildProcessByStdio', module: 'child_process' },

      // Crypto module
      { typeName: 'Hash', module: 'crypto' },
      { typeName: 'Hmac', module: 'crypto' },
      { typeName: 'Cipher', module: 'crypto' },
      { typeName: 'Decipher', module: 'crypto' },
      { typeName: 'Sign', module: 'crypto' },
      { typeName: 'Verify', module: 'crypto' },
      { typeName: 'KeyObject', module: 'crypto' },

      // Net module
      { typeName: 'Socket', module: 'net' },

      // TLS module
      { typeName: 'TLSSocket', module: 'tls' },
      { typeName: 'SecureContext', module: 'tls' },

      // Timers
      { typeName: 'Timeout', module: 'timers' },
      { typeName: 'Immediate', module: 'timers' },
    ];

    for (const { typeName, module } of knownMappings) {
      this.typeToModuleCache.set(typeName, module);
    }
  }

  /**
   * Gets and caches Node.js types files for better performance
   */
  private getNodeTypesFiles(): SourceFile[] {
    if (!this.project) {
      return [];
    }

    if (!this.nodeTypesFilesCache) {
      this.nodeTypesFilesCache = this.project
        .getSourceFiles()
        .filter(
          sf =>
            sf.getFilePath().includes('@types/node') ||
            sf.getFilePath().includes('node_modules/@types/node'),
        );
    }

    return this.nodeTypesFilesCache;
  }

  /**
   * Resolves a type name using the TypeScript compiler API with user's tsconfig
   */
  private resolveTypeWithUserConfig(typeName: string): string | null {
    if (!this.project || !this.typeChecker) {
      return null;
    }

    try {
      const nodeTypesFiles = this.getNodeTypesFiles();

      for (const nodeFile of nodeTypesFiles) {
        // Check if this file exports the type we're looking for
        const exports = nodeFile.getExportedDeclarations();
        if (exports.has(typeName)) {
          // Extract module name from file path
          const filePath = nodeFile.getFilePath();
          const match = filePath.match(/(@types\/node[/\\]?)([^/\\]+)\.d\.ts/);
          if (match && match[2] && this.builtinModulesSet.has(match[2])) {
            return match[2];
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves a type name to its Node.js module using TypeScript compiler API
   *
   * This method uses the TypeScript compiler API to accurately resolve types.
   * It requires a TypeScript configuration to be provided during construction.
   *
   * @param typeName - The TypeScript type name to resolve
   * @returns The Node.js module name, or null if not resolvable or no TypeScript config available
   *
   * @example
   * ```typescript
   * const resolver = new NodeJSTypeResolver('./tsconfig.json');
   * resolver.resolveTypeWithCompiler('EventEmitter'); // returns 'events'
   * ```
   */
  resolveTypeWithCompiler(typeName: string): string | null {
    // Use user's TypeScript config for better accuracy
    return this.resolveTypeWithUserConfig(typeName);
  }

  /**
   * Resolves a type name to its Node.js module if it's a built-in type
   *
   * This method attempts to determine which Node.js built-in module exports a given type.
   * It uses multiple resolution strategies:
   * 1. Checks if the type is a global type that shouldn't be resolved to a module
   * 2. Looks up cached results for performance
   * 3. Uses TypeScript compiler API for accurate resolution (if configured)
   * 4. Falls back to pattern-based inference
   *
   * @param typeName - The TypeScript type name to resolve (e.g., 'EventEmitter', 'ReadStream')
   * @returns The Node.js module name that exports this type, or null if not a built-in type
   *
   * @example
   * ```typescript
   * resolver.getModuleForType('EventEmitter'); // returns 'events'
   * resolver.getModuleForType('ReadStream');   // returns 'fs'
   * resolver.getModuleForType('Buffer');       // returns null (global type)
   * resolver.getModuleForType('CustomType');   // returns null (not a Node.js type)
   * ```
   */
  getModuleForType(typeName: string): string | null {
    // Check if it's a global type first - these should NOT be resolved to modules
    if (this.globalTypes.has(typeName)) {
      return null;
    }

    // Check cache first
    if (this.typeToModuleCache.has(typeName)) {
      const cachedModule = this.typeToModuleCache.get(typeName);
      return cachedModule ?? null;
    }

    // Try TypeScript compiler resolution first
    let resolvedModule = this.resolveTypeWithCompiler(typeName);

    // Fallback to pattern inference if compiler resolution fails
    if (!resolvedModule) {
      resolvedModule = this.inferModuleFromTypeName(typeName);
    }

    if (resolvedModule && this.builtinModulesSet.has(resolvedModule)) {
      this.typeToModuleCache.set(typeName, resolvedModule);
      return resolvedModule;
    }

    return null;
  }

  /**
   * Attempts to remove common suffixes from a type name and find a matching module
   */
  private tryRemovingSuffixes(typeName: string): string | null {
    const suffixes = ['Stream', 'Server', 'Client', 'Request', 'Response', 'Error'];
    for (const suffix of suffixes) {
      if (typeName.endsWith(suffix)) {
        const baseName = typeName.slice(0, -suffix.length).toLowerCase();
        if (this.builtinModulesSet.has(baseName)) {
          return baseName;
        }
      }
    }
    return null;
  }

  /**
   * Attempts to infer the module name from the type name using common patterns
   */
  private inferModuleFromTypeName(typeName: string): string | null {
    const lowercaseType = typeName.toLowerCase();

    // Pattern 1: Type names that match module names directly
    if (this.builtinModulesSet.has(lowercaseType)) {
      return lowercaseType;
    }

    // Pattern 2: Remove common suffixes and try again
    const suffixResult = this.tryRemovingSuffixes(typeName);
    if (suffixResult) {
      return suffixResult;
    }

    // Pattern 3: Check if the type name contains a module name
    for (const module of this.builtinModulesSet) {
      if (lowercaseType.includes(module)) {
        return module;
      }
    }

    return null;
  }

  /**
   * Gets all available Node.js built-in modules
   *
   * @returns A readonly array of all Node.js built-in module names
   *
   * @example
   * ```typescript
   * const modules = resolver.getBuiltinModules();
   * console.log(modules); // ['fs', 'http', 'events', ...]
   * ```
   */
  getBuiltinModules(): readonly string[] {
    return builtinModules;
  }

  /**
   * Checks if a module is a Node.js built-in module
   *
   * @param moduleName - The module name to check
   * @returns True if the module is a built-in Node.js module, false otherwise
   *
   * @example
   * ```typescript
   * resolver.isBuiltinModule('fs');      // returns true
   * resolver.isBuiltinModule('lodash');  // returns false
   * ```
   */
  isBuiltinModule(moduleName: string): boolean {
    return this.builtinModulesSet.has(moduleName);
  }

  /**
   * Clears the resolution cache and cleans up resources
   *
   * Use this method to reset the internal cache, which can be useful for testing
   * or when memory usage becomes a concern.
   *
   * @example
   * ```typescript
   * resolver.clearCache();
   * console.log(resolver.getCacheStats().size); // returns 0
   * ```
   */
  clearCache(): void {
    this.typeToModuleCache.clear();
  }

  /**
   * Gets cache statistics for monitoring performance
   *
   * @returns An object containing cache size and built-in modules count
   *
   * @example
   * ```typescript
   * const stats = resolver.getCacheStats();
   * console.log(`Cache has ${stats.size} entries`);
   * console.log(`Knows about ${stats.builtinModulesCount} built-in modules`);
   * ```
   */
  getCacheStats(): { size: number; builtinModulesCount: number } {
    return {
      size: this.typeToModuleCache.size,
      builtinModulesCount: this.builtinModulesSet.size,
    };
  }

  /**
   * Dispose of the resolver and clean up resources
   *
   * This method should be called when you're done using the resolver to clean up
   * temporary files and release memory. Always call this method in a finally block
   * or use it in a try-with-resources pattern.
   *
   * @example
   * ```typescript
   * const resolver = new NodeJSTypeResolver('./tsconfig.json');
   * try {
   *   const result = resolver.getModuleForType('EventEmitter');
   *   // ... use result
   * } finally {
   *   resolver.dispose();
   * }
   * ```
   */
  dispose(): void {
    this.clearCache();
    // Clear cached @types/node files
    this.nodeTypesFilesCache = undefined;
  }
}
