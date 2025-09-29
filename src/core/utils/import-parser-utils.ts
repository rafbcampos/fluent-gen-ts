import type { StructuredImport, StructuredNamedImport } from '../plugin/plugin-types.js';

/**
 * Core import parsing utilities for JavaScript/TypeScript import statements.
 *
 * Provides low-level parsing and manipulation of import statements, including:
 * - Splitting concatenated imports
 * - Extracting import sources
 * - Identifying import types (type-only, side-effect)
 * - Parsing named imports with aliases and type modifiers
 * - Converting import strings to structured objects
 *
 * This class is used internally by higher-level import transformation APIs.
 */
export class ImportParsingUtils {
  /**
   * Splits concatenated import statements into individual statements.
   *
   * Handles imports separated by semicolons and whitespace, such as:
   * `import {A} from "a"; import {B} from "b";`
   *
   * @param importStatement - The concatenated import statement string
   * @returns Array of individual import statements, each ending with a semicolon
   *
   * @example
   * ```typescript
   * const result = ImportParsingUtils.splitConcatenatedImports(
   *   'import {A} from "a"; import {B} from "b";'
   * );
   * // result = ['import {A} from "a";', 'import {B} from "b";']
   * ```
   */
  static splitConcatenatedImports(importStatement: string): string[] {
    const trimmed = importStatement.trim();
    if (!trimmed) return [];

    if (/;\s*import\s/.test(trimmed)) {
      return trimmed
        .split(/;\s*(?=import\s)/g)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => (s.endsWith(';') ? s : s + ';'));
    }

    return [trimmed];
  }

  /**
   * Extracts the source module path from an import statement.
   *
   * Works with all import types:
   * - Regular imports: `import {X} from "module"` → `"module"`
   * - Side-effect imports: `import "module"` → `"module"`
   * - Namespace imports: `import * as X from "module"` → `"module"`
   *
   * @param importStatement - The import statement to parse
   * @returns The module path/specifier, or null if not found
   *
   * @example
   * ```typescript
   * ImportParsingUtils.extractSource('import {A} from "./module.js";');
   * // returns: './module.js'
   *
   * ImportParsingUtils.extractSource('import "./styles.css";');
   * // returns: './styles.css'
   * ```
   */
  static extractSource(importStatement: string): string | null {
    // Handle side-effect imports first: import "module"
    const sideEffectMatch = importStatement.match(/^import\s+["']([^"']+)["']\s*;?$/);
    if (sideEffectMatch?.[1]) {
      return sideEffectMatch[1];
    }

    // Handle regular imports: ... from "module"
    const sourceMatch = importStatement.match(/from\s+["']([^"']+)["']\s*;?$/);
    return sourceMatch?.[1] || null;
  }

  /**
   * Checks if an import statement is type-only.
   *
   * Type-only imports use the `type` modifier:
   * `import type {X} from "module"` or `import type * as X from "module"`
   *
   * @param importStatement - The import statement to check
   * @returns True if the statement begins with `import type`
   *
   * @example
   * ```typescript
   * ImportParsingUtils.isTypeOnlyImport('import type {User} from "./types";');
   * // returns: true
   *
   * ImportParsingUtils.isTypeOnlyImport('import {type User} from "./types";');
   * // returns: false (this is a mixed import, not fully type-only)
   * ```
   */
  static isTypeOnlyImport(importStatement: string): boolean {
    return /^import\s+type\s+/.test(importStatement.trim());
  }

  /**
   * Checks if an import statement is side-effect only.
   *
   * Side-effect imports have no bindings: `import "module"`
   *
   * @param importStatement - The import statement to check
   * @returns True if the statement imports a module for side effects only
   *
   * @example
   * ```typescript
   * ImportParsingUtils.isSideEffectImport('import "./styles.css";');
   * // returns: true
   *
   * ImportParsingUtils.isSideEffectImport('import {A} from "./module";');
   * // returns: false
   * ```
   */
  static isSideEffectImport(importStatement: string): boolean {
    return /^import\s+["'][^"']+["']\s*;?$/.test(importStatement.trim());
  }

  /**
   * Extracts the import specifiers part of an import statement.
   *
   * Returns everything between 'import' and 'from', excluding the 'type' modifier:
   * - `import {A, B} from "m"` → `"{A, B}"`
   * - `import type {A} from "m"` → `"{A}"`
   * - `import * as X from "m"` → `"* as X"`
   *
   * @param importStatement - The import statement to parse
   * @returns The import specifiers as a string
   *
   * @example
   * ```typescript
   * ImportParsingUtils.extractImportPart('import {A, B as C} from "m";');
   * // returns: '{A, B as C}'
   * ```
   */
  static extractImportPart(importStatement: string): string {
    const cleaned = importStatement.replace(/^import\s+(?:type\s+)?/, '');
    return cleaned.replace(/\s+from\s+["'][^"']+["']\s*;?$/, '').trim();
  }

  /**
   * Parses named imports from a braced import specifiers string.
   *
   * Handles:
   * - Simple names: `A` → `{name: 'A'}`
   * - Aliases: `A as B` → `{name: 'A', alias: 'B'}`
   * - Type modifiers: `type A` → `{name: 'A', isTypeOnly: true}`
   * - Combined: `type A as B` → `{name: 'A', alias: 'B', isTypeOnly: true}`
   *
   * @param namedImportsStr - The content inside braces (e.g., "A, B as C")
   * @param parentTypeOnly - If true, all imports inherit type-only status
   * @returns Array of structured named import objects
   * @throws {Error} If an import specifier is malformed
   *
   * @example
   * ```typescript
   * ImportParsingUtils.parseNamedImports('A, B as C, type D');
   * // returns: [
   * //   {name: 'A'},
   * //   {name: 'B', alias: 'C'},
   * //   {name: 'D', isTypeOnly: true}
   * // ]
   * ```
   */
  static parseNamedImports(
    namedImportsStr: string,
    parentTypeOnly: boolean = false,
  ): StructuredNamedImport[] {
    if (!namedImportsStr.trim()) return [];

    const imports: StructuredNamedImport[] = [];
    const items = namedImportsStr.split(',');

    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;

      // Handle type modifier: type Name
      const typeMatch = trimmed.match(/^type\s+(\w+)(?:\s+as\s+(\w+))?$/);
      if (typeMatch?.[1]) {
        if (typeMatch[2]) {
          imports.push({ name: typeMatch[1], alias: typeMatch[2], isTypeOnly: true });
        } else {
          imports.push({ name: typeMatch[1], isTypeOnly: true });
        }
        continue;
      }

      // Handle alias: Name as Alias
      const aliasMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
      if (aliasMatch?.[1] && aliasMatch[2]) {
        if (parentTypeOnly) {
          imports.push({ name: aliasMatch[1], alias: aliasMatch[2], isTypeOnly: true });
        } else {
          imports.push({ name: aliasMatch[1], alias: aliasMatch[2] });
        }
        continue;
      }

      // Handle simple name: Name
      const nameMatch = trimmed.match(/^(\w+)$/);
      if (nameMatch?.[1]) {
        if (parentTypeOnly) {
          imports.push({ name: nameMatch[1], isTypeOnly: true });
        } else {
          imports.push({ name: nameMatch[1] });
        }
        continue;
      }

      throw new Error(`Invalid named import: ${trimmed}`);
    }

    return imports;
  }

  private static extractNamesFromBracedImports(
    importStatement: string,
    filter: (name: string) => boolean,
  ): string[] {
    const names: string[] = [];

    const typeOnlyMatch = importStatement.match(/import\s+type\s+\{\s*([^}]+)\s*\}/);
    if (typeOnlyMatch?.[1]) {
      const typeList = typeOnlyMatch[1].split(',').map(t => t.trim());
      names.push(...typeList);
    }

    const mixedMatch = importStatement.match(/import\s+(?:\w+\s*,\s*)?\{\s*([^}]+)\s*\}/);
    if (mixedMatch?.[1]) {
      const items = mixedMatch[1].split(',');
      for (const item of items) {
        const trimmed = item.trim();
        const typeMatch = trimmed.match(/^type\s+(\w+)$/);
        if (typeMatch?.[1]) {
          names.push(typeMatch[1]);
        } else if (filter(trimmed)) {
          names.push(trimmed);
        }
      }
    }

    return names;
  }

  /**
   * Extracts all imported names from braced imports.
   *
   * Returns identifiers from both type-only and mixed imports.
   * Does not handle default or namespace imports.
   *
   * @param importStatement - The import statement to parse
   * @returns Array of imported identifier names
   * @deprecated For backward compatibility only. Use parseImportToStructured for new code.
   *
   * @example
   * ```typescript
   * ImportParsingUtils.extractAllImportedNames('import {A, type B, C} from "m";');
   * // returns: ['A', 'B', 'C']
   * ```
   */
  static extractAllImportedNames(importStatement: string): string[] {
    return this.extractNamesFromBracedImports(importStatement, name => /^\w+$/.test(name));
  }

  /**
   * Extracts type imports from braced imports.
   *
   * Returns identifiers that are:
   * - Explicitly marked with `type` modifier
   * - Follow PascalCase naming convention (heuristic for backward compatibility)
   *
   * @param importStatement - The import statement to parse
   * @param validateTypeName - Optional validator for type names
   * @returns Array of type identifier names
   * @deprecated For backward compatibility only. Use parseImportToStructured for new code.
   *
   * @example
   * ```typescript
   * ImportParsingUtils.extractImportedTypes('import {User, type Config, API} from "m";');
   * // returns: ['User', 'Config', 'API'] (all PascalCase or explicitly typed)
   * ```
   */
  static extractImportedTypes(
    importStatement: string,
    validateTypeName?: (name: string) => boolean,
  ): string[] {
    const types = this.extractNamesFromBracedImports(importStatement, name =>
      /^[A-Z]\w*$/.test(name),
    );
    return validateTypeName ? types.filter(validateTypeName) : types;
  }

  /**
   * Parses a single import statement into a structured object.
   *
   * Handles all import syntax forms:
   * - Named: `import {A, B} from "m"`
   * - Default: `import X from "m"`
   * - Namespace: `import * as X from "m"`
   * - Mixed: `import X, {A, B} from "m"`
   * - Side-effect: `import "m"`
   * - Type-only: `import type {A} from "m"`
   * - Mixed types: `import {A, type B} from "m"`
   *
   * @param importStatement - The import statement to parse
   * @returns Structured representation of the import
   * @throws {Error} If the import statement is invalid or malformed
   *
   * @example
   * ```typescript
   * const result = ImportParsingUtils.parseImportToStructured(
   *   'import React, {useState, type FC} from "react";'
   * );
   * // result = {
   * //   source: 'react',
   * //   defaultImport: 'React',
   * //   namedImports: [{name: 'useState'}, {name: 'FC', isTypeOnly: true}],
   * //   isTypeOnly: false,
   * //   isSideEffect: false
   * // }
   * ```
   */
  static parseImportToStructured(importStatement: string): StructuredImport {
    const trimmed = importStatement.trim();

    // Handle side-effect imports
    if (this.isSideEffectImport(trimmed)) {
      const source = this.extractSource(trimmed);
      if (!source) {
        throw new Error(`Invalid side-effect import statement: ${importStatement}`);
      }
      return {
        source,
        namedImports: [],
        isTypeOnly: false,
        isSideEffect: true,
      };
    }

    // Get basic info
    const isTypeOnly = this.isTypeOnlyImport(trimmed);
    const source = this.extractSource(trimmed);
    if (!source) {
      throw new Error(`Invalid import statement: ${importStatement}`);
    }

    const importPart = this.extractImportPart(trimmed);

    // Handle namespace imports: * as name
    const namespaceMatch = importPart.match(/^\*\s+as\s+(\w+)$/);
    if (namespaceMatch?.[1]) {
      const baseResult = {
        source,
        namedImports: [],
        isTypeOnly,
        isSideEffect: false,
      };
      return { ...baseResult, namespaceImport: namespaceMatch[1] };
    }

    let defaultImport: string | undefined;
    let namedImportsStr = '';

    // Handle mixed imports: DefaultName, { named, imports }
    const mixedMatch = importPart.match(/^(\w+)\s*,\s*\{([^}]*)\}$/);
    if (mixedMatch?.[1] && mixedMatch[2]) {
      defaultImport = mixedMatch[1];
      namedImportsStr = mixedMatch[2];
    } else {
      // Handle default import only: DefaultName
      const defaultMatch = importPart.match(/^(\w+)$/);
      if (defaultMatch?.[1]) {
        defaultImport = defaultMatch[1];
      } else {
        // Handle named imports only: { named, imports }
        const namedMatch = importPart.match(/^\{([^}]*)\}$/);
        if (namedMatch?.[1]) {
          namedImportsStr = namedMatch[1];
        }
      }
    }

    const namedImports = this.parseNamedImports(namedImportsStr, isTypeOnly);

    const baseResult = {
      source,
      namedImports,
      isTypeOnly: isTypeOnly && !namedImports.some(ni => ni.isTypeOnly === false),
      isSideEffect: false,
    };

    return defaultImport ? { ...baseResult, defaultImport } : baseResult;
  }

  /**
   * Parses multiple import statements into structured objects.
   *
   * Automatically splits concatenated import statements before parsing.
   * Filters out empty or whitespace-only statements.
   *
   * @param importStatements - Array of import statement strings (may be concatenated)
   * @returns Array of structured import objects
   * @throws {Error} If any import statement is invalid
   *
   * @example
   * ```typescript
   * const result = ImportParsingUtils.parseImportsToStructured([
   *   'import {A} from "a";',
   *   'import {B} from "b"; import {C} from "c";' // concatenated
   * ]);
   * // result has 3 structured imports for A, B, and C
   * ```
   */
  static parseImportsToStructured(importStatements: readonly string[]): StructuredImport[] {
    const allStatements: string[] = [];

    for (const stmt of importStatements) {
      const splitStatements = this.splitConcatenatedImports(stmt);
      allStatements.push(...splitStatements);
    }

    return allStatements
      .filter(stmt => stmt.trim())
      .map(stmt => this.parseImportToStructured(stmt));
  }
}
