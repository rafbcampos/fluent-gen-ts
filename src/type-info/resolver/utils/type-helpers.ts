import { SyntaxKind } from 'ts-morph';
import type { Symbol as TsSymbol } from 'ts-morph';

/**
 * Determines if a TypeScript symbol represents a type alias declaration.
 *
 * @param symbol - The TypeScript symbol to check
 * @returns `true` if the symbol is a type alias, `false` otherwise
 *
 * @example
 * ```typescript
 * // For: type StringAlias = string;
 * const symbol = sourceFile.getTypeAlias('StringAlias').getSymbol();
 * isTypeAlias(symbol); // returns true
 *
 * // For: interface User { name: string; }
 * const interfaceSymbol = sourceFile.getInterface('User').getSymbol();
 * isTypeAlias(interfaceSymbol); // returns false
 * ```
 */
export function isTypeAlias(symbol: TsSymbol): boolean {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return false;

  return declarations.some(decl => {
    return decl.getKind() === SyntaxKind.TypeAliasDeclaration;
  });
}

/**
 * Extracts a meaningful type name from a TypeScript symbol and type text.
 *
 * When a symbol has the generic name '__type' (common for anonymous types),
 * this function attempts to extract a more meaningful name from the type text
 * using pattern matching.
 *
 * @param params - Configuration object
 * @param params.symbol - The TypeScript symbol (may be undefined)
 * @param params.typeText - The string representation of the type
 * @returns A meaningful type name, or 'unknown' if none can be determined
 *
 * @example
 * ```typescript
 * // With a named symbol
 * extractTypeName({ symbol: userSymbol, typeText: 'User' });
 * // returns: 'User'
 *
 * // With __type symbol and module-qualified type
 * extractTypeName({ symbol: anonymousSymbol, typeText: 'MyModule.UserType<T>' });
 * // returns: 'UserType'
 *
 * // When no meaningful name can be extracted
 * extractTypeName({ symbol: undefined, typeText: 'SomeComplexType' });
 * // returns: 'unknown'
 * ```
 */
export function extractTypeName(params: {
  symbol: TsSymbol | undefined;
  typeText: string;
}): string {
  const { symbol, typeText } = params;
  let name = symbol?.getName();

  if (name === '__type') {
    const match = typeText.match(/\.([A-Z][a-zA-Z0-9]+)(?:<|$)/);
    if (match && match[1]) {
      name = match[1];
    } else {
      name = undefined;
    }
  }

  return name && name.trim() !== '' ? name : 'unknown';
}

/**
 * Extracts the source file path from TypeScript's import() syntax in type text.
 *
 * When types reference other modules, TypeScript may include import statements
 * in the type text like: `import("/path/to/file").TypeName<T>`.
 * This function extracts the file path from such import statements.
 *
 * @param typeText - The type text that may contain an import statement
 * @returns The extracted file path, or undefined if no import statement found
 *
 * @example
 * ```typescript
 * extractSourceFileFromImport('import("/home/user/project/src/types").User');
 * // Returns: '/home/user/project/src/types'
 *
 * extractSourceFileFromImport('Partial<import("/path/to/file").TableColumn<T>>');
 * // Returns: '/path/to/file'
 *
 * extractSourceFileFromImport('RegularType');
 * // Returns: undefined
 * ```
 */
export function extractSourceFileFromImport(typeText: string): string | undefined {
  // Match import("path/to/file") pattern in type text
  // This handles cases like: import("/absolute/path").TypeName
  // or nested: Partial<import("/path").Type>
  const importMatch = typeText.match(/import\("([^"]+)"\)/);
  if (importMatch) {
    return importMatch[1];
  }
  return undefined;
}
