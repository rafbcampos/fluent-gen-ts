import { Type } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type { TypeInfo } from "../core/types.js";
import { TypeKind } from "../core/types.js";

export interface ConditionalTypeResolverOptions {
  readonly maxDepth?: number;
}

export class ConditionalTypeResolver {
  private readonly maxDepth: number;

  constructor(options: ConditionalTypeResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
  }

  async resolveConditionalType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth = 0,
  ): Promise<Result<TypeInfo | null>> {
    if (depth > this.maxDepth) {
      return err(new Error(`Max conditional type resolution depth exceeded`));
    }

    // Check if this is a conditional type
    if (!this.isConditionalType(type)) {
      return ok(null);
    }

    try {
      // Try to resolve the conditional type to its actual result
      const resolvedType = this.evaluateConditionalType(type);
      if (resolvedType) {
        return resolveType(resolvedType, depth + 1);
      }

      // If we can't evaluate it (e.g., it depends on a generic parameter),
      // we need to handle it differently
      return this.handleUnresolvedConditional(type, resolveType, depth);
    } catch (error) {
      return err(new Error(`Failed to resolve conditional type: ${error}`));
    }
  }

  private isConditionalType(type: Type): boolean {
    const typeText = type.getText();

    // Check for conditional type pattern: T extends U ? X : Y
    if (typeText.includes(" extends ") && typeText.includes(" ? ") && typeText.includes(" : ")) {
      return true;
    }

    // Check using TypeScript's internal flags if available
    const tsType = type.compilerType;
    if (tsType && "flags" in tsType) {
      // TypeScript TypeFlags.Conditional = 16777216
      return (tsType.flags & 16777216) !== 0;
    }

    return false;
  }

  private evaluateConditionalType(type: Type): Type | null {
    // Try to get the resolved type if TypeScript has already evaluated it
    const tsType = type.compilerType;

    // If this is a resolved conditional type, it will have a resolvedType property
    if (tsType && "resolvedType" in tsType && tsType.resolvedType) {
      // Create a Type wrapper for the resolved type
      const symbol = type.getSymbol();
      if (symbol) {
        const declarations = symbol.getDeclarations();
        if (declarations && declarations.length > 0) {
          // This is a simplified approach - in practice, we'd need to properly wrap the TS type
          // and get the resolved type from the declaration
        }
      }
    }

    // If the type is concrete (not dependent on generics), TypeScript may have already resolved it
    // In that case, we can try to get the actual type using the compiler API directly
    const sourceFile = type.getSymbol()?.getDeclarations()?.[0]?.getSourceFile();
    if (sourceFile) {
      // We could access TypeChecker through sourceFile.project.getTypeChecker()
      // This is a simplified implementation
      // Real implementation would use the TypeChecker API more thoroughly
    }

    return null;
  }

  private async handleUnresolvedConditional(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    // For unresolved conditional types (e.g., those dependent on generic parameters),
    // we'll try to extract both branches and return a union type

    const { checkType, extendsType, trueType, falseType } = this.parseConditionalType(type);

    if (!trueType || !falseType) {
      // If we can't parse the conditional, return unknown
      return ok({ kind: TypeKind.Unknown });
    }

    // Try to evaluate if we can determine the condition
    if (checkType && extendsType) {
      const isAssignable = this.checkTypeExtends(checkType, extendsType);
      if (isAssignable !== null) {
        const resultType = isAssignable ? trueType : falseType;
        return resolveType(resultType, depth + 1);
      }
    }

    // If we can't determine the condition, resolve both branches and return a union
    const trueResolved = await resolveType(trueType, depth + 1);
    const falseResolved = await resolveType(falseType, depth + 1);

    if (!trueResolved.ok) return trueResolved;
    if (!falseResolved.ok) return falseResolved;

    // Check if both branches resolve to the same type
    if (this.areTypesEqual(trueResolved.value, falseResolved.value)) {
      return ok(trueResolved.value);
    }

    // Return a union of both possibilities
    return ok({
      kind: TypeKind.Union,
      unionTypes: [trueResolved.value, falseResolved.value],
    });
  }

  private parseConditionalType(type: Type): {
    checkType: Type | null;
    extendsType: Type | null;
    trueType: Type | null;
    falseType: Type | null;
  } {
    // This is a simplified parser for conditional types
    // In a real implementation, we'd use the TypeScript AST more directly

    const result = {
      checkType: null as Type | null,
      extendsType: null as Type | null,
      trueType: null as Type | null,
      falseType: null as Type | null,
    };

    // Try to extract the parts from the type text
    const typeText = type.getText();
    const match = typeText.match(/^(.+?)\s+extends\s+(.+?)\s+\?\s+(.+?)\s+:\s+(.+)$/);

    if (match) {
      // This is a very simplified approach
      // In practice, we'd need to properly parse and resolve these type references
    }

    // For TypeScript internal types, we might be able to access the parts directly
    const tsType = type.compilerType;
    if (tsType && "root" in tsType) {
      // Access conditional type parts if available
    }

    return result;
  }

  private checkTypeExtends(checkType: Type, extendsType: Type): boolean | null {
    // Check if checkType extends extendsType
    // Return true if it does, false if it doesn't, null if we can't determine

    // For simple cases, we can check directly
    if (checkType.isString() && extendsType.isString()) return true;
    if (checkType.isNumber() && extendsType.isNumber()) return true;
    if (checkType.isBoolean() && extendsType.isBoolean()) return true;

    // For literal types
    if (checkType.isLiteral() && extendsType.isLiteral()) {
      return checkType.getLiteralValue() === extendsType.getLiteralValue();
    }

    // For union types in extendsType
    if (extendsType.isUnion()) {
      const unionTypes = extendsType.getUnionTypes();
      return unionTypes.some(t => this.checkTypeExtends(checkType, t) === true);
    }

    // For more complex cases, we can't determine statically
    return null;
  }

  private areTypesEqual(type1: TypeInfo, type2: TypeInfo): boolean {
    // Simple equality check for TypeInfo
    if (type1.kind !== type2.kind) return false;

    switch (type1.kind) {
      case TypeKind.Primitive:
        return type1.name === (type2 as any).name;
      case TypeKind.Literal:
        return type1.literal === (type2 as any).literal;
      case TypeKind.Reference:
        return type1.name === (type2 as any).name;
      default:
        // For complex types, we'd need deeper comparison
        return false;
    }
  }

  resolveInferTypes(type: Type): Result<Map<string, Type>> {
    // Handle infer keyword in conditional types
    // E.g., T extends (...args: infer P) => infer R ? [P, R] : never
    const inferredTypes = new Map<string, Type>();

    try {
      const typeText = type.getText();
      const inferMatches = typeText.matchAll(/infer\s+([A-Z]\w*)/g);

      for (const _match of inferMatches) {
        // In a real implementation, we'd need to resolve the actual inferred type
        // For now, we just mark that an infer exists
        // inferredTypes.set(_match[1], resolvedInferType);
      }

      return ok(inferredTypes);
    } catch (error) {
      return err(new Error(`Failed to resolve infer types: ${error}`));
    }
  }
}