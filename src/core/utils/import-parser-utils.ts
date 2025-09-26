import type { StructuredImport, StructuredNamedImport } from '../plugin/plugin-types.js';

/**
 * Core import parsing utilities - shared across all import processing
 */
export class ImportParsingUtils {
  /**
   * Split concatenated import statements into individual statements
   */
  static splitConcatenatedImports(importStatement: string): string[] {
    const trimmed = importStatement.trim();
    if (!trimmed) return [];

    // Check if this is a concatenated import statement
    if (trimmed.includes(';\nimport') || trimmed.includes('; import')) {
      return trimmed
        .split(/;\s*(?=import\s)/g)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => (s.endsWith(';') ? s : s + ';'));
    }

    return [trimmed];
  }

  /**
   * Extract the source module from an import statement
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
   * Check if import statement is type-only
   */
  static isTypeOnlyImport(importStatement: string): boolean {
    return /^import\s+type\s+/.test(importStatement.trim());
  }

  /**
   * Check if import statement is side-effect only
   */
  static isSideEffectImport(importStatement: string): boolean {
    return /^import\s+["'][^"']+["']\s*;?$/.test(importStatement.trim());
  }

  /**
   * Extract import part (everything between 'import' and 'from')
   */
  static extractImportPart(importStatement: string): string {
    const cleaned = importStatement.replace(/^import\s+(?:type\s+)?/, '');
    return cleaned.replace(/\s+from\s+["'][^"']+["']\s*;?$/, '').trim();
  }

  /**
   * Parse named imports from import part string
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

  /**
   * Extract all imported names from an import statement (for backward compatibility)
   */
  static extractAllImportedNames(importStatement: string): string[] {
    const names: string[] = [];

    // Extract from type-only imports: import type { A, B } from "module"
    const typeOnlyMatch = importStatement.match(/import\s+type\s+\{\s*([^}]+)\s*\}/);
    if (typeOnlyMatch?.[1]) {
      const typeList = typeOnlyMatch[1].split(',').map(t => t.trim());
      names.push(...typeList);
    }

    // Extract from mixed imports: import [Default,] { a, type B, c } from "module"
    const mixedMatch = importStatement.match(/import\s+(?:\w+\s*,\s*)?\{\s*([^}]+)\s*\}/);
    if (mixedMatch?.[1]) {
      const items = mixedMatch[1].split(',');
      for (const item of items) {
        const trimmed = item.trim();
        const typeMatch = trimmed.match(/^type\s+(\w+)$/);
        if (typeMatch?.[1]) {
          names.push(typeMatch[1]);
        } else if (/^\w+$/.test(trimmed)) {
          names.push(trimmed);
        }
      }
    }

    return names;
  }

  /**
   * Extract only type imports from an import statement (for backward compatibility)
   */
  static extractImportedTypes(
    importStatement: string,
    validateTypeName?: (name: string) => boolean,
  ): string[] {
    const types: string[] = [];

    const typeOnlyMatch = importStatement.match(/import\s+type\s+\{\s*([^}]+)\s*\}/);
    if (typeOnlyMatch?.[1]) {
      const typeList = typeOnlyMatch[1].split(',').map(t => t.trim());
      types.push(...typeList);
    }

    const mixedMatch = importStatement.match(/import\s+(?:\w+\s*,\s*)?\{\s*([^}]+)\s*\}/);
    if (mixedMatch?.[1]) {
      const items = mixedMatch[1].split(',');
      for (const item of items) {
        const trimmed = item.trim();
        const typeMatch = trimmed.match(/^type\s+(\w+)$/);
        if (typeMatch?.[1]) {
          types.push(typeMatch[1]);
        } else if (/^[A-Z]\w*$/.test(trimmed)) {
          types.push(trimmed);
        }
      }
    }

    return validateTypeName ? types.filter(validateTypeName) : types;
  }

  /**
   * Parse a single import statement into a StructuredImport
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
   * Parse multiple import statements, handling concatenated statements
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
