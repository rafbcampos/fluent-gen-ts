import { Type } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { TypeInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";

export interface TemplateLiteralResolverOptions {
  readonly maxDepth?: number;
}

export class TemplateLiteralResolver {
  private readonly maxDepth: number;

  constructor(options: TemplateLiteralResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
  }

  async resolveTemplateLiteral(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth = 0,
  ): Promise<Result<TypeInfo | null>> {
    if (depth > this.maxDepth) {
      return err(new Error(`Max template literal resolution depth exceeded`));
    }

    try {
      if (!this.isTemplateLiteralType(type)) {
        return ok(null);
      }
      // Try to extract the template literal pattern
      const pattern = this.extractTemplateLiteralPattern(type);
      if (!pattern) {
        return ok(null);
      }

      // If it's a simple template literal without placeholders, return as a literal type
      if (!pattern.includes("${")) {
        return ok({
          kind: TypeKind.Literal,
          literal: pattern,
        });
      }

      // For template literals with placeholders, we need to resolve possible values
      const possibleValues = await this.expandTemplateLiteralValues(type, resolveType, depth);
      if (!possibleValues.ok) return possibleValues;

      if (possibleValues.value.length === 0) {
        // If we couldn't expand to concrete values, return a string type
        return ok({
          kind: TypeKind.Primitive,
          name: "string",
        });
      }

      if (possibleValues.value.length === 1) {
        // Single concrete value
        return ok({
          kind: TypeKind.Literal,
          literal: possibleValues.value[0],
        });
      }

      // Multiple possible values - return as a union of literals
      const unionTypes: TypeInfo[] = possibleValues.value.map((value) => ({
        kind: TypeKind.Literal,
        literal: value,
      }));

      return ok({
        kind: TypeKind.Union,
        unionTypes,
      });
    } catch (error) {
      return err(new Error(`Failed to resolve template literal type: ${error}`));
    }
  }

  private isTemplateLiteralType(type: Type): boolean {
    const typeText = type.getText();

    // Check for template literal pattern: `...${...}...`
    if (typeText.startsWith("`") && typeText.endsWith("`")) {
      return true;
    }

    // Check using TypeScript's internal flags if available
    const tsType = type.compilerType;
    if (tsType && "flags" in tsType) {
      // TypeScript TypeFlags.TemplateLiteral = 134217728
      return (tsType.flags & 134217728) !== 0;
    }

    return false;
  }

  private extractTemplateLiteralPattern(type: Type): string | null {
    const typeText = type.getText();

    // Remove backticks if present
    if (typeText.startsWith("`") && typeText.endsWith("`")) {
      return typeText.slice(1, -1);
    }

    // Try to extract from TypeScript's internal representation
    const tsType = type.compilerType;
    if (tsType && "texts" in tsType && Array.isArray(tsType.texts)) {
      // Reconstruct the template literal pattern
      return this.reconstructTemplate(tsType);
    }

    return null;
  }

  private reconstructTemplate(tsType: any): string {
    if (!tsType.texts || !Array.isArray(tsType.texts)) {
      return "";
    }

    let result = "";
    for (let i = 0; i < tsType.texts.length; i++) {
      result += tsType.texts[i];
      if (tsType.types && i < tsType.types.length) {
        result += "${...}"; // Placeholder for type
      }
    }

    return result;
  }

  private async expandTemplateLiteralValues(
    type: Type,
    _resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    _depth: number,
  ): Promise<Result<string[]>> {
    const values: string[] = [];

    // Try to get the TypeScript internal representation
    const tsType = type.compilerType;
    if (!tsType) {
      return ok(values);
    }

    // If TypeScript has already computed the literal values
    if ("types" in tsType && Array.isArray(tsType.types)) {
      for (const t of tsType.types) {
        if (t && "value" in t && t.value !== undefined) {
          values.push(String(t.value));
        }
      }
    }

    // For complex template literals with type parameters,
    // we might not be able to expand all values
    // In such cases, we return what we can determine

    return ok(values);
  }

  resolveCapitalizePattern(type: Type): Result<string | null> {
    // Handle Capitalize<T> and similar intrinsic string manipulation types
    const typeText = type.getText();

    if (typeText.startsWith("Capitalize<") && typeText.endsWith(">")) {
      const innerType = typeText.slice(11, -1);
      return ok(`capitalize(${innerType})`);
    }

    if (typeText.startsWith("Uncapitalize<") && typeText.endsWith(">")) {
      const innerType = typeText.slice(13, -1);
      return ok(`uncapitalize(${innerType})`);
    }

    if (typeText.startsWith("Uppercase<") && typeText.endsWith(">")) {
      const innerType = typeText.slice(10, -1);
      return ok(`uppercase(${innerType})`);
    }

    if (typeText.startsWith("Lowercase<") && typeText.endsWith(">")) {
      const innerType = typeText.slice(10, -1);
      return ok(`lowercase(${innerType})`);
    }

    return ok(null);
  }

  applyStringTransform(value: string, transform: string): string {
    switch (transform) {
      case "capitalize":
        return value.charAt(0).toUpperCase() + value.slice(1);
      case "uncapitalize":
        return value.charAt(0).toLowerCase() + value.slice(1);
      case "uppercase":
        return value.toUpperCase();
      case "lowercase":
        return value.toLowerCase();
      default:
        return value;
    }
  }
}