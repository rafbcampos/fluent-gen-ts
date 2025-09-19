import { Type, ts } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { TypeInfo, IndexSignature } from "../core/types.js";
import { TypeKind } from "../core/types.js";

export interface MappedTypeResolverOptions {
  readonly maxDepth?: number;
}

/**
 * Handles mapped types that haven't been resolved by TypeScript.
 *
 * In most cases, TypeScript will have already expanded mapped types
 * (e.g., `Readonly<User>` becomes an object with readonly properties).
 * This resolver primarily handles:
 * - Index signatures ({ [key: string]: T })
 * - Unresolved generic mapped types
 */
export class MappedTypeResolver {
  private readonly maxDepth: number;

  constructor(options: MappedTypeResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
  }

  async resolveMappedType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth = 0,
  ): Promise<Result<TypeInfo | null>> {
    if (depth > this.maxDepth) {
      return err(new Error(`Max mapped type resolution depth exceeded`));
    }

    // Check for index signature types
    if (this.hasIndexSignature(type)) {
      return this.expandIndexSignatureType(type, resolveType, depth);
    }

    // Check if this is an unresolved generic mapped type
    if (this.isUnresolvedMappedType(type)) {
      // For unresolved generic mapped types, we can't expand them
      // Return generic type info
      return ok({
        kind: TypeKind.Generic,
        name: type.getSymbol()?.getName() || type.getText(),
      });
    }

    // TypeScript has already expanded this mapped type
    return ok(null);
  }

  private isUnresolvedMappedType(type: Type): boolean {
    // If the type has properties, it's already been expanded by TypeScript
    if (type.getProperties().length > 0) {
      return false;
    }

    // Check if this looks like an unresolved mapped type
    const typeText = type.getText();
    const symbol = type.getSymbol();
    const symbolName = symbol?.getName();

    // Patterns that indicate unresolved mapped types:
    // - Type alias with generic parameters (e.g., "MyPartial<T>")
    // - Contains angle brackets
    // - Not an anonymous/expanded type
    if (symbolName && typeText.includes("<") && typeText.includes(">")) {
      // Exclude already resolved types
      if (symbolName === "__type" || symbolName === "Anonymous") {
        return false;
      }

      // Check using TypeScript's internal flags as a fallback
      const tsType = type.compilerType as ts.Type;
      if (
        tsType &&
        "objectFlags" in tsType &&
        typeof tsType.objectFlags === "number"
      ) {
        // TypeScript ObjectFlags.Mapped = 32
        // ObjectFlags.InstantiatedMapped = 96 (already instantiated)
        return (
          (tsType.objectFlags & 32) !== 0 && (tsType.objectFlags & 96) !== 96
        );
      }

      return true;
    }

    return false;
  }

  private hasIndexSignature(type: Type): boolean {
    if (!type.isObject()) return false;

    // Don't treat arrays as index signatures
    if (type.isArray()) return false;

    // Check for string or number index signatures
    const stringIndexType = type.getStringIndexType();
    const numberIndexType = type.getNumberIndexType();

    if (stringIndexType === undefined && numberIndexType === undefined) {
      return false;
    }

    // Only handle pure index signatures (no regular properties)
    // If the type has both properties and index signatures, let the main resolver handle it
    const properties = type.getProperties();
    return properties.length === 0;
  }

  private async expandIndexSignatureType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const stringIndexType = type.getStringIndexType();
    const numberIndexType = type.getNumberIndexType();

    // Resolve the value type
    let indexSignature: IndexSignature | undefined;

    if (stringIndexType) {
      const resolved = await resolveType(stringIndexType, depth + 1);
      if (resolved.ok) {
        indexSignature = {
          keyType: "string",
          valueType: resolved.value,
          readonly: this.isReadonlyIndexSignature(type),
        };
      }
    } else if (numberIndexType) {
      const resolved = await resolveType(numberIndexType, depth + 1);
      if (resolved.ok) {
        indexSignature = {
          keyType: "number",
          valueType: resolved.value,
          readonly: this.isReadonlyIndexSignature(type),
        };
      }
    }

    if (!indexSignature) {
      return ok({ kind: TypeKind.Unknown });
    }

    // Return an object type with index signature
    return ok({
      kind: TypeKind.Object,
      properties: [],
      indexSignature,
    });
  }


  private isReadonlyIndexSignature(type: Type): boolean {
    // Check if the index signature is readonly
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const declarations = symbol.getDeclarations() || [];

    // Check declarations for index signatures and readonly modifiers
    for (const decl of declarations) {
      if (!decl) continue;

      // Try to access the members to find index signatures
      if ("getMembers" in decl && typeof decl.getMembers === "function") {
        const members = decl.getMembers();
        for (const member of members) {
          // Check if this is an index signature
          if (
            member.getKindName &&
            member.getKindName() === "IndexSignature"
          ) {
            // Check for readonly modifier
            const modifiers = member.getModifiers
              ? member.getModifiers()
              : [];
            return modifiers.some(
              (mod: any) => mod.getKind() === ts.SyntaxKind.ReadonlyKeyword,
            );
          }
        }
      }
    }

    return false;
  }
}

