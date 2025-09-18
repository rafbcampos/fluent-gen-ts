import { Type, ts } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { TypeInfo, PropertyInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";

export interface MappedTypeResolverOptions {
  readonly maxDepth?: number;
}

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

    // Check if this is a mapped type by examining its structure
    const symbol = type.getSymbol();
    const declaration = symbol?.getValueDeclaration();

    if (!declaration) {
      return ok(null);
    }

    // Try to get mapped type information using ts-morph's capabilities
    if (this.isMappedType(type)) {
      return this.expandMappedType(type, resolveType, depth);
    }

    // Check for index signature types
    if (this.hasIndexSignature(type)) {
      return this.expandIndexSignatureType(type, resolveType, depth);
    }

    return ok(null);
  }

  private isMappedType(type: Type): boolean {
    // Check if the type has the structure of a mapped type
    // This includes types like { [K in keyof T]: ... } or { [K in Union]: ... }
    const typeText = type.getText();

    // Look for mapped type patterns
    if (typeText.includes(" in ") && (typeText.includes("[") || typeText.includes("{"))) {
      return true;
    }

    // Check using TypeScript's internal flags if available
    const tsType = type.compilerType;
    if (tsType && "objectFlags" in tsType && typeof tsType.objectFlags === "number") {
      // TypeScript ObjectFlags.Mapped = 32
      return (tsType.objectFlags & 32) !== 0;
    }

    return false;
  }

  private hasIndexSignature(type: Type): boolean {
    if (!type.isObject()) return false;

    // Don't treat arrays as index signatures
    if (type.isArray()) return false;

    const indexInfos = type.getStringIndexType() || type.getNumberIndexType();
    return indexInfos !== undefined;
  }

  private async expandMappedType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    // Get the properties that result from the mapped type
    const properties: PropertyInfo[] = [];

    try {
      // If this is a concrete mapped type (already resolved to specific properties)
      if (type.getProperties().length > 0) {
        for (const prop of type.getProperties()) {
          const propType = prop.getTypeAtLocation(prop.getValueDeclaration()!);
          const resolvedPropType = await resolveType(propType, depth + 1);

          if (!resolvedPropType.ok) continue;

          const property: PropertyInfo = {
            name: prop.getName(),
            type: resolvedPropType.value,
            optional: prop.isOptional(),
            readonly: this.isReadonlyProperty(prop),
          };

          properties.push(property);
        }

        return ok({
          kind: TypeKind.Object,
          properties,
          name: "__MappedType__", // Special marker for mapped types
        });
      }

      // If this is an abstract mapped type, we may need to handle it differently
      // For now, return an object with a special marker
      return ok({
        kind: TypeKind.Object,
        properties: [],
        name: "__MappedType__",
      });
    } catch (error) {
      return err(new Error(`Failed to expand mapped type: ${error}`));
    }
  }

  private async expandIndexSignatureType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const stringIndexType = type.getStringIndexType();
    const numberIndexType = type.getNumberIndexType();

    let valueType: TypeInfo = { kind: TypeKind.Unknown };

    if (stringIndexType) {
      const resolved = await resolveType(stringIndexType, depth + 1);
      if (resolved.ok) {
        valueType = resolved.value;
      }
    } else if (numberIndexType) {
      const resolved = await resolveType(numberIndexType, depth + 1);
      if (resolved.ok) {
        valueType = resolved.value;
      }
    }

    // Return a special object type that represents an index signature
    return ok({
      kind: TypeKind.Object,
      properties: [],
      name: "__IndexSignature__",
      indexSignatures: [
        {
          keyType: stringIndexType ? "string" : "number",
          valueType: valueType,
        },
      ],
    });
  }

  private isReadonlyProperty(symbol: any): boolean {
    const valueDeclaration = symbol.getValueDeclaration?.();
    if (!valueDeclaration) return false;

    const modifiers = valueDeclaration.getModifiers?.();
    if (!modifiers) return false;

    return modifiers.some(
      (mod: any) => mod.getKind() === ts.SyntaxKind.ReadonlyKeyword
    );
  }

  resolveKeyRemapping(type: Type): Result<Map<string, string>> {
    // Handle key remapping in mapped types like:
    // { [K in keyof T as `get${Capitalize<K>}`]: T[K] }
    const remapping = new Map<string, string>();

    try {
      const typeText = type.getText();
      const asMatch = typeText.match(/as\s+`([^`]+)`/);

      if (asMatch && asMatch[1]) {
        // This is a simplified implementation
        // Real implementation would need to parse template literal types
        const template = asMatch[1];

        // For now, just mark that remapping exists
        remapping.set("__remapped__", template);
      }

      return ok(remapping);
    } catch (error) {
      return err(new Error(`Failed to resolve key remapping: ${error}`));
    }
  }
}