import type { Type } from 'ts-morph';

/**
 * Detects whether TypeScript types are built-in types from the TypeScript standard library
 * or Node.js runtime environment.
 *
 * Built-in types include:
 * - TypeScript lib types (string, number, Array, Promise, etc.)
 * - Node.js types (Buffer, EventEmitter, fs.ReadStream, etc.)
 * - NodeJS namespace types (NodeJS.ProcessEnv, NodeJS.Dict, etc.)
 */
export class BuiltInDetector {
  private static readonly NODE_JS_TYPES = new Set([
    'EventEmitter',
    'URL',
    'URLSearchParams',
    'Buffer',
    'Readable',
    'Writable',
    'Transform',
    'Duplex',
  ]);

  private static readonly NODE_JS_NAMESPACE_TYPES = new Set([
    'NodeJS.ProcessEnv',
    'NodeJS.Dict',
    'NodeJS.ArrayBufferView',
    'NodeJS.Process',
  ]);

  /**
   * Checks if a type is a built-in TypeScript library type.
   *
   * This method identifies types that are part of the TypeScript standard library
   * (e.g., Array, Promise, string, number) by examining their declaration source files.
   * Types are considered built-in if their declarations come from TypeScript lib files.
   *
   * @param type The TypeScript type to check
   * @returns `true` if the type is a built-in TypeScript library type, `false` otherwise
   *
   * @example
   * ```typescript
   * const detector = new BuiltInDetector();
   *
   * // Returns true for standard library types
   * detector.isBuiltInType(arrayType); // true for Array<T>
   * detector.isBuiltInType(promiseType); // true for Promise<T>
   *
   * // Returns false for user-defined types
   * detector.isBuiltInType(customInterfaceType); // false
   * ```
   */
  isBuiltInType(type: Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const symbolName = symbol.getName();
    if (symbolName === '__type') {
      return false;
    }

    return this.checkTypeByDeclarationPaths(
      type,
      this.isBuiltInPath.bind(this),
      true, // return true when sourceFile is null
    );
  }

  /**
   * Checks if a type is a built-in Node.js type.
   *
   * This method identifies types that are part of the Node.js runtime environment,
   * including both common Node.js classes (Buffer, EventEmitter, etc.) and types
   * from the NodeJS namespace (NodeJS.ProcessEnv, NodeJS.Dict, etc.).
   *
   * @param type The TypeScript type to check
   * @returns `true` if the type is a built-in Node.js type, `false` otherwise
   *
   * @example
   * ```typescript
   * const detector = new BuiltInDetector();
   *
   * // Returns true for Node.js runtime types
   * detector.isNodeJSBuiltInType(bufferType); // true for Buffer
   * detector.isNodeJSBuiltInType(eventEmitterType); // true for EventEmitter
   * detector.isNodeJSBuiltInType(processEnvType); // true for NodeJS.ProcessEnv
   *
   * // Returns false for non-Node.js types
   * detector.isNodeJSBuiltInType(arrayType); // false for Array<T>
   * detector.isNodeJSBuiltInType(customType); // false for user-defined types
   * ```
   */
  isNodeJSBuiltInType(type: Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const typeText = type.getText();
    if (typeText.startsWith('NodeJS.')) {
      return this.isNodeJSNamespaceType(typeText);
    }

    const symbolName = symbol.getName();

    if (!this.isNodeJSTypeName(symbolName)) return false;

    return this.checkTypeByDeclarationPaths(
      type,
      this.isNodeJSPath.bind(this),
      false, // return false when sourceFile is null
    );
  }

  /**
   * Checks if a type matches a path predicate by examining its declaration source files.
   *
   * @param type The TypeScript type to check
   * @param pathPredicate Function that tests if a file path matches the criteria
   * @param returnValueWhenNoSourceFile Value to return when a declaration has no source file.
   *        This handles edge cases where types exist but lack file associations.
   * @returns `true` if any declaration matches the path predicate
   */
  private checkTypeByDeclarationPaths(
    type: Type,
    pathPredicate: (filePath: string) => boolean,
    returnValueWhenNoSourceFile: boolean,
  ): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return false;

    return declarations.some(decl => {
      const sourceFile = decl.getSourceFile();
      if (!sourceFile) return returnValueWhenNoSourceFile;

      const filePath = sourceFile.getFilePath();
      return pathPredicate(filePath);
    });
  }

  private isNodeJSTypeName(symbolName: string): boolean {
    return BuiltInDetector.NODE_JS_TYPES.has(symbolName);
  }

  private isValidNodeJSNamespaceType(typeText: string): boolean {
    return BuiltInDetector.NODE_JS_NAMESPACE_TYPES.has(typeText);
  }

  private isBuiltInPath(filePath: string): boolean {
    return (
      filePath.includes('/typescript/lib/') ||
      filePath.includes('\\typescript\\lib\\') ||
      (filePath.endsWith('.d.ts') && filePath.includes('lib.'))
    );
  }

  private isNodeJSPath(filePath: string): boolean {
    return filePath.includes('/@types/node/') || filePath.includes('\\@types\\node\\');
  }

  private isNodeJSNamespaceType(typeText: string): boolean {
    return this.isValidNodeJSNamespaceType(typeText);
  }
}
