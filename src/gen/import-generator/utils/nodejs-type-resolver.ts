import { builtinModules } from 'node:module';
import { Project, TypeChecker } from 'ts-morph';

interface NodeJSTypeInfo {
  readonly typeName: string;
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
    this.globalTypes.add('ArrayBuffer');
    this.globalTypes.add('SharedArrayBuffer');
    this.globalTypes.add('DataView');
    this.globalTypes.add('Promise');
    this.globalTypes.add('Error');
    this.globalTypes.add('RegExp');
    this.globalTypes.add('Date');
    this.globalTypes.add('Map');
    this.globalTypes.add('Set');
    this.globalTypes.add('WeakMap');
    this.globalTypes.add('WeakSet');
    this.globalTypes.add('Symbol');
    this.globalTypes.add('Int8Array');
    this.globalTypes.add('Uint8Array');
    this.globalTypes.add('Int16Array');
    this.globalTypes.add('Uint16Array');
    this.globalTypes.add('Int32Array');
    this.globalTypes.add('Uint32Array');
    this.globalTypes.add('Float32Array');
    this.globalTypes.add('Float64Array');
    this.globalTypes.add('BigInt64Array');
    this.globalTypes.add('BigUint64Array');
    this.globalTypes.add('Buffer'); // Buffer is global in Node.js

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
   * Resolves a type name using the TypeScript compiler API with user's tsconfig
   */
  private resolveTypeWithUserConfig(typeName: string): string | null {
    if (!this.project || !this.typeChecker) {
      return null;
    }

    try {
      // Create a temporary source file to test type resolution
      const tempFile = this.project.createSourceFile(
        `temp-resolve-${Date.now()}.ts`,
        `
          // Try to import the type from various Node.js modules
          const testType: ${typeName} = {} as any;
        `,
        { overwrite: true },
      );

      // Get all source files that might contain Node.js types
      const nodeTypesFiles = this.project
        .getSourceFiles()
        .filter(
          sf =>
            sf.getFilePath().includes('@types/node') ||
            sf.getFilePath().includes('node_modules/@types/node'),
        );

      for (const nodeFile of nodeTypesFiles) {
        // Check if this file exports the type we're looking for
        const exports = nodeFile.getExportedDeclarations();
        if (exports.has(typeName)) {
          // Extract module name from file path
          const filePath = nodeFile.getFilePath();
          const match = filePath.match(/(@types\/node[/\\]?)([^/\\]+)\.d\.ts/);
          if (match && match[2] && this.builtinModulesSet.has(match[2])) {
            tempFile.delete();
            return match[2];
          }
        }
      }

      tempFile.delete();
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves a type name to its Node.js module using TypeScript compiler API
   */
  resolveTypeWithCompiler(typeName: string): string | null {
    // Use user's TypeScript config for better accuracy
    return this.resolveTypeWithUserConfig(typeName);
  }

  /**
   * Resolves a type name to its Node.js module if it's a built-in type
   */
  getModuleForType(typeName: string): string | null {
    // Check if it's a global type first - these should NOT be resolved to modules
    if (this.globalTypes.has(typeName)) {
      return null;
    }

    // Check cache first
    if (this.typeToModuleCache.has(typeName)) {
      return this.typeToModuleCache.get(typeName)!;
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
   * Attempts to infer the module name from the type name using common patterns
   */
  private inferModuleFromTypeName(typeName: string): string | null {
    // Pattern 1: Type names that match module names directly
    const lowercaseType = typeName.toLowerCase();
    if (this.builtinModulesSet.has(lowercaseType)) {
      return lowercaseType;
    }

    // Pattern 2: Remove common suffixes and try again
    const suffixesToTry = ['Stream', 'Server', 'Client', 'Request', 'Response', 'Error'];
    for (const suffix of suffixesToTry) {
      if (typeName.endsWith(suffix)) {
        const baseName = typeName.slice(0, -suffix.length).toLowerCase();
        if (this.builtinModulesSet.has(baseName)) {
          return baseName;
        }
      }
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
   */
  getBuiltinModules(): readonly string[] {
    return builtinModules;
  }

  /**
   * Checks if a module is a Node.js built-in module
   */
  isBuiltinModule(moduleName: string): boolean {
    return this.builtinModulesSet.has(moduleName);
  }

  /**
   * Clears the resolution cache and cleans up resources
   */
  clearCache(): void {
    this.typeToModuleCache.clear();
  }

  /**
   * Gets cache statistics for monitoring performance
   */
  getCacheStats(): { size: number; builtinModulesCount: number } {
    return {
      size: this.typeToModuleCache.size,
      builtinModulesCount: this.builtinModulesSet.size,
    };
  }

  /**
   * Dispose of the resolver and clean up resources
   */
  dispose(): void {
    this.clearCache();
    // Clean up any temporary source files if project exists
    if (this.project) {
      this.project.getSourceFiles().forEach(sf => {
        if (sf.getBaseName().startsWith('temp-')) {
          sf.delete();
        }
      });
    }
  }
}
