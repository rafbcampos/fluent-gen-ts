import { validateTypeName } from './validation.js';

export const deduplicateImports = (imports: string[]): string[] => {
  if (!Array.isArray(imports)) {
    return [];
  }

  const seen = new Set<string>();
  const typeToImportMap = new Map<string, string>();
  const deduplicated: string[] = [];

  for (const imp of imports) {
    if (typeof imp !== 'string') {
      continue;
    }

    const normalized = imp.trim();
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    const importedNames = extractAllImportedNames(normalized);
    let shouldSkip = false;

    for (const importName of importedNames) {
      if (typeToImportMap.has(importName)) {
        shouldSkip = true;
        break;
      }
    }

    if (shouldSkip) {
      continue;
    }

    seen.add(normalized);
    for (const importName of importedNames) {
      typeToImportMap.set(importName, normalized);
    }
    deduplicated.push(imp);
  }

  return deduplicated;
};

const extractAllImportedNames = (importStatement: string): string[] => {
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
};

export const extractImportedTypes = (importStatement: string): string[] => {
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

  return types.filter(validateTypeName);
};

export const extractModulesFromNamedImports = (importStatements: string): Set<string> => {
  const modules = new Set<string>();

  if (importStatements.length > 10000) {
    console.warn('Import statements string too long, truncating for safety');
    importStatements = importStatements.substring(0, 10000);
  }

  const namedTypeImportRegex = /import\s+type\s+\{\s*[^}]+\s*\}\s+from\s+["']([^"']+)["']/gm;
  const mixedImportRegex = /import\s+(?:\w+\s*,\s*)?\{[^}]+\}\s+from\s+["']([^"']+)["']/gm;

  let match;
  while ((match = namedTypeImportRegex.exec(importStatements)) !== null) {
    if (match[1]) {
      modules.add(match[1]);
    }
  }

  while ((match = mixedImportRegex.exec(importStatements)) !== null) {
    if (match[1] && match[0]) {
      const braceStart = match[0].indexOf('{');
      const braceEnd = match[0].indexOf('}');
      if (braceStart !== -1 && braceEnd !== -1) {
        const importContent = match[0].substring(braceStart + 1, braceEnd);

        if (/(?:type\s+\w+|[A-Z]\w*)/.test(importContent)) {
          modules.add(match[1]);
        }
      }
    }
  }

  return modules;
};

export const resolveImportConflicts = (categories: {
  localTypes: Set<string>;
  relativeImports: Map<string, Set<string>>;
  externalTypes: Map<string, string>;
}): void => {
  const externalTypeNames = new Set(categories.externalTypes.keys());

  for (const typeName of externalTypeNames) {
    if (categories.localTypes.has(typeName)) {
      categories.localTypes.delete(typeName);
    }
  }

  for (const [sourceFile, types] of categories.relativeImports) {
    const typesToRemove: string[] = [];
    for (const typeName of types) {
      if (externalTypeNames.has(typeName)) {
        typesToRemove.push(typeName);
      }
    }

    for (const typeName of typesToRemove) {
      types.delete(typeName);
    }

    if (types.size === 0) {
      categories.relativeImports.delete(sourceFile);
    }
  }
};
