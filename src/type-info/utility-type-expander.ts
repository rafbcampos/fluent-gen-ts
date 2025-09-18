import { Type } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { TypeInfo, PropertyInfo, IndexSignature } from "../core/types.js";
import { TypeKind } from "../core/types.js";

export interface UtilityTypeExpanderOptions {
  readonly maxDepth?: number;
}

export class UtilityTypeExpander {
  private readonly maxDepth: number;

  constructor(options: UtilityTypeExpanderOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
  }

  async expandUtilityType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth = 0,
  ): Promise<Result<TypeInfo | null>> {
    if (depth > this.maxDepth) {
      return err(new Error(`Max utility type expansion depth exceeded`));
    }

    const symbol = type.getSymbol();
    if (!symbol) return ok(null);

    const name = symbol.getName();
    const typeArgs = type.getTypeArguments();

    // If TypeScript has already resolved this utility type to a concrete type,
    // let the normal resolution process handle it
    if (name === "__type" && type.getProperties().length > 0) {
      return ok(null); // Let normal property resolution handle it
    }

    // Handle Pick<T, K>
    if (name === "Pick" && typeArgs.length === 2) {
      const [targetType, keysType] = typeArgs;
      if (targetType && keysType) {
        return this.expandPick(targetType, keysType, resolveType, depth);
      }
    }

    // Handle Omit<T, K>
    if (name === "Omit" && typeArgs.length === 2) {
      const [targetType, keysType] = typeArgs;
      if (targetType && keysType) {
        return this.expandOmit(targetType, keysType, resolveType, depth);
      }
    }

    // Handle Partial<T>
    if (name === "Partial" && typeArgs.length === 1) {
      const targetType = typeArgs[0];
      if (targetType) {
        return this.expandPartial(targetType, resolveType, depth);
      }
    }

    // Handle Required<T>
    if (name === "Required" && typeArgs.length === 1) {
      const targetType = typeArgs[0];
      if (targetType) {
        return this.expandRequired(targetType, resolveType, depth);
      }
    }

    // Handle Readonly<T>
    if (name === "Readonly" && typeArgs.length === 1) {
      const targetType = typeArgs[0];
      if (targetType) {
        return this.expandReadonly(targetType, resolveType, depth);
      }
    }

    // Handle Record<K, T>
    if (name === "Record" && typeArgs.length === 2) {
      const [keysType, valueType] = typeArgs;
      if (keysType && valueType) {
        return this.expandRecord(keysType, valueType, resolveType, depth);
      }
    }

    // Handle Exclude<T, U>
    if (name === "Exclude" && typeArgs.length === 2) {
      const [targetType, excludeType] = typeArgs;
      if (targetType && excludeType) {
        return this.expandExclude(targetType, excludeType, resolveType, depth);
      }
    }

    // Handle Extract<T, U>
    if (name === "Extract" && typeArgs.length === 2) {
      const [targetType, extractType] = typeArgs;
      if (targetType && extractType) {
        return this.expandExtract(targetType, extractType, resolveType, depth);
      }
    }

    // Handle NonNullable<T>
    if (name === "NonNullable" && typeArgs.length === 1) {
      const targetType = typeArgs[0];
      if (targetType) {
        return this.expandNonNullable(targetType, resolveType, depth);
      }
    }

    return ok(null);
  }

  private async expandPick(
    targetType: Type,
    keysType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const targetResolved = await resolveType(targetType, depth + 1);
    if (!targetResolved.ok) return targetResolved;

    if (targetResolved.value.kind !== TypeKind.Object) {
      return err(new Error("Pick can only be applied to object types"));
    }

    const keys = this.extractLiteralKeys(keysType);
    if (!keys.ok) return keys;

    const pickedProperties = targetResolved.value.properties.filter((prop) =>
      keys.value.includes(prop.name),
    );

    return ok({
      kind: TypeKind.Object,
      properties: pickedProperties,
      ...(targetResolved.value.genericParams && {
        genericParams: targetResolved.value.genericParams,
      }),
    });
  }

  private async expandOmit(
    targetType: Type,
    keysType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const targetResolved = await resolveType(targetType, depth + 1);
    if (!targetResolved.ok) return targetResolved;

    if (targetResolved.value.kind !== TypeKind.Object) {
      return err(new Error("Omit can only be applied to object types"));
    }

    const keys = this.extractLiteralKeys(keysType);
    if (!keys.ok) return keys;

    const omittedProperties = targetResolved.value.properties.filter(
      (prop) => !keys.value.includes(prop.name),
    );

    return ok({
      kind: TypeKind.Object,
      properties: omittedProperties,
      ...(targetResolved.value.genericParams && {
        genericParams: targetResolved.value.genericParams,
      }),
    });
  }

  private async expandPartial(
    targetType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const targetResolved = await resolveType(targetType, depth + 1);
    if (!targetResolved.ok) return targetResolved;

    if (targetResolved.value.kind !== TypeKind.Object) {
      return err(new Error("Partial can only be applied to object types"));
    }

    const partialProperties = targetResolved.value.properties.map((prop) => ({
      ...prop,
      optional: true,
    }));

    return ok({
      kind: TypeKind.Object,
      properties: partialProperties,
      ...(targetResolved.value.genericParams && {
        genericParams: targetResolved.value.genericParams,
      }),
    });
  }

  private async expandRequired(
    targetType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const targetResolved = await resolveType(targetType, depth + 1);
    if (!targetResolved.ok) return targetResolved;

    if (targetResolved.value.kind !== TypeKind.Object) {
      return err(new Error("Required can only be applied to object types"));
    }

    const requiredProperties = targetResolved.value.properties.map((prop) => ({
      ...prop,
      optional: false,
    }));

    return ok({
      kind: TypeKind.Object,
      properties: requiredProperties,
      ...(targetResolved.value.genericParams && {
        genericParams: targetResolved.value.genericParams,
      }),
    });
  }

  private async expandReadonly(
    targetType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const targetResolved = await resolveType(targetType, depth + 1);
    if (!targetResolved.ok) return targetResolved;

    if (targetResolved.value.kind !== TypeKind.Object) {
      return err(new Error("Readonly can only be applied to object types"));
    }

    const readonlyProperties = targetResolved.value.properties.map((prop) => ({
      ...prop,
      readonly: true,
    }));

    return ok({
      kind: TypeKind.Object,
      properties: readonlyProperties,
      ...(targetResolved.value.genericParams && {
        genericParams: targetResolved.value.genericParams,
      }),
    });
  }

  private async expandRecord(
    keysType: Type,
    valueType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const valueResolved = await resolveType(valueType, depth + 1);
    if (!valueResolved.ok) return valueResolved;

    // First try to extract literal keys
    const keys = this.extractLiteralKeys(keysType);
    if (keys.ok && keys.value.length > 0) {
      // We have concrete literal keys, create properties for each
      const properties: PropertyInfo[] = keys.value.map((key) => ({
        name: key,
        type: valueResolved.value,
        optional: false,
        readonly: false,
      }));

      return ok({
        kind: TypeKind.Object,
        properties,
      });
    }

    // If we can't extract literal keys, this is a generic Record type
    // We need to create an object with an index signature
    const keyType = this.getRecordKeyType(keysType);

    return ok({
      kind: TypeKind.Object,
      properties: [], // No specific properties for generic Record
      indexSignature: {
        keyType,
        valueType: valueResolved.value,
        readonly: false,
      } satisfies IndexSignature,
      name: "__RecordType__", // Special marker for Record types
    });
  }

  private async expandExclude(
    targetType: Type,
    excludeType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    if (!targetType.isUnion()) {
      const targetResolved = await resolveType(targetType, depth + 1);
      if (!targetResolved.ok) return targetResolved;

      // Check if target type would be excluded
      if (this.isTypeAssignableTo(targetType, excludeType)) {
        return ok({ kind: TypeKind.Primitive, name: "never" });
      }
      return targetResolved;
    }

    const unionTypes = targetType.getUnionTypes();
    const filteredTypes: TypeInfo[] = [];

    for (const unionType of unionTypes) {
      if (!this.isTypeAssignableTo(unionType, excludeType)) {
        const resolved = await resolveType(unionType, depth + 1);
        if (!resolved.ok) return resolved;
        filteredTypes.push(resolved.value);
      }
    }

    if (filteredTypes.length === 0) {
      return ok({ kind: TypeKind.Primitive, name: "never" });
    } else if (filteredTypes.length === 1 && filteredTypes[0]) {
      return ok(filteredTypes[0]);
    } else {
      return ok({
        kind: TypeKind.Union,
        unionTypes: filteredTypes,
      });
    }
  }

  private async expandExtract(
    targetType: Type,
    extractType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    if (!targetType.isUnion()) {
      const targetResolved = await resolveType(targetType, depth + 1);
      if (!targetResolved.ok) return targetResolved;

      // Check if target type would be extracted
      if (this.isTypeAssignableTo(targetType, extractType)) {
        return targetResolved;
      }
      return ok({ kind: TypeKind.Primitive, name: "never" });
    }

    const unionTypes = targetType.getUnionTypes();
    const extractedTypes: TypeInfo[] = [];

    for (const unionType of unionTypes) {
      if (this.isTypeAssignableTo(unionType, extractType)) {
        const resolved = await resolveType(unionType, depth + 1);
        if (!resolved.ok) return resolved;
        extractedTypes.push(resolved.value);
      }
    }

    if (extractedTypes.length === 0) {
      return ok({ kind: TypeKind.Primitive, name: "never" });
    } else if (extractedTypes.length === 1 && extractedTypes[0]) {
      return ok(extractedTypes[0]);
    } else {
      return ok({
        kind: TypeKind.Union,
        unionTypes: extractedTypes,
      });
    }
  }

  private async expandNonNullable(
    targetType: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    if (targetType.isUnion()) {
      const unionTypes = targetType.getUnionTypes();
      const nonNullTypes: TypeInfo[] = [];

      for (const unionType of unionTypes) {
        if (!unionType.isNull() && !unionType.isUndefined()) {
          const resolved = await resolveType(unionType, depth + 1);
          if (!resolved.ok) return resolved;
          nonNullTypes.push(resolved.value);
        }
      }

      if (nonNullTypes.length === 0) {
        return ok({ kind: TypeKind.Primitive, name: "never" });
      } else if (nonNullTypes.length === 1 && nonNullTypes[0]) {
        return ok(nonNullTypes[0]);
      } else {
        return ok({
          kind: TypeKind.Union,
          unionTypes: nonNullTypes,
        });
      }
    }

    if (targetType.isNull() || targetType.isUndefined()) {
      return ok({ kind: TypeKind.Primitive, name: "never" });
    }

    return resolveType(targetType, depth + 1);
  }

  private extractLiteralKeys(type: Type): Result<string[]> {
    const keys: string[] = [];

    if (type.isLiteral()) {
      const literal = type.getLiteralValue();
      if (typeof literal === "string") {
        keys.push(literal);
      }
    } else if (type.isUnion()) {
      for (const unionType of type.getUnionTypes()) {
        if (unionType.isLiteral()) {
          const literal = unionType.getLiteralValue();
          if (typeof literal === "string") {
            keys.push(literal);
          }
        }
      }
    }

    return ok(keys);
  }

  private getRecordKeyType(keysType: Type): "string" | "number" | "symbol" {
    // Determine the key type for Record based on the keys type
    if (keysType.isString() || keysType.getText().includes("string")) {
      return "string";
    }
    if (keysType.isNumber() || keysType.getText().includes("number")) {
      return "number";
    }
    if (keysType.getText().includes("symbol")) {
      return "symbol";
    }

    // Check if it's a union that contains string literals or string type
    if (keysType.isUnion()) {
      const unionTypes = keysType.getUnionTypes();
      for (const unionType of unionTypes) {
        if (unionType.isString() || unionType.isLiteral()) {
          return "string";
        }
      }
    }

    // Default to string for most cases
    return "string";
  }

  private isTypeAssignableTo(source: Type, target: Type): boolean {
    // This is a simplified check - in a real implementation,
    // we'd use TypeScript's type checker more thoroughly
    if (source.getText() === target.getText()) return true;

    // Check if source is assignable to target
    // This is a simplified version - real implementation would use TS compiler API
    if (target.isAny()) return true;
    if (source.isNever()) return true;

    if (target.isUnion()) {
      const unionTypes = target.getUnionTypes();
      return unionTypes.some(t => this.isTypeAssignableTo(source, t));
    }

    return false;
  }
}