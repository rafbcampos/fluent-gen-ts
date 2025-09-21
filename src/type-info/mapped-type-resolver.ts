import { Type, ts, Node } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { TypeInfo, IndexSignature } from '../core/types.js';
import { TypeKind } from '../core/types.js';

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

  async resolveMappedType({
    type,
    resolveType,
    depth = 0,
  }: {
    type: Type;
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>;
    depth?: number;
  }): Promise<Result<TypeInfo | null>> {
    if (depth > this.maxDepth) {
      return err(new Error(`Max mapped type resolution depth exceeded`));
    }

    // Check for index signature types
    if (this.hasIndexSignature(type)) {
      return this.expandIndexSignatureType({ type, resolveType, depth });
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
    return this.checkUnresolvedMappedType({ type });
  }

  private checkUnresolvedMappedType({ type }: { type: Type }): boolean {
    // If the type has properties, it's already been expanded by TypeScript
    if (type.getProperties().length > 0) {
      return false;
    }

    const typeText = type.getText();
    const symbol = type.getSymbol();

    // Check if this looks like an unresolved mapped type with generics
    if (this.hasGenericParameters({ typeText }) && symbol) {
      return this.isUnresolvedGenericMappedType({ type, symbol });
    }

    return false;
  }

  private hasGenericParameters({ typeText }: { typeText: string }): boolean {
    return typeText.includes('<') && typeText.includes('>');
  }

  private isUnresolvedGenericMappedType({
    type,
    symbol,
  }: {
    type: Type;
    symbol: NonNullable<ReturnType<Type['getSymbol']>>;
  }): boolean {
    // Anonymous types have __type symbol name
    // Already resolved types are excluded by having properties > 0
    if (this.isAnonymousTypeSymbol({ symbol })) {
      return false;
    }

    // Check using TypeScript's internal flags for mapped types
    if (this.hasObjectFlags(type)) {
      const tsType = type.compilerType as ts.Type & { objectFlags: number };
      return (
        this.hasObjectFlag(tsType, ts.ObjectFlags.Mapped) &&
        !this.hasObjectFlag(tsType, ts.ObjectFlags.Mapped | ts.ObjectFlags.Instantiated)
      );
    }

    return true;
  }

  private isAnonymousTypeSymbol({
    symbol,
  }: {
    symbol: NonNullable<ReturnType<Type['getSymbol']>>;
  }): boolean {
    const symbolName = symbol.getName();
    // Based on debug test findings: anonymous types have these specific names
    return symbolName === '__type' || symbolName === 'Anonymous';
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

  private async expandIndexSignatureType({
    type,
    resolveType,
    depth,
  }: {
    type: Type;
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>;
    depth: number;
  }): Promise<Result<TypeInfo>> {
    const stringIndexType = type.getStringIndexType();
    const numberIndexType = type.getNumberIndexType();

    // Resolve the value type
    let indexSignature: IndexSignature | undefined;

    if (stringIndexType) {
      const resolved = await resolveType(stringIndexType, depth + 1);
      if (resolved.ok) {
        indexSignature = {
          keyType: 'string',
          valueType: resolved.value,
          readonly: this.isReadonlyIndexSignature(type),
        };
      }
    } else if (numberIndexType) {
      const resolved = await resolveType(numberIndexType, depth + 1);
      if (resolved.ok) {
        indexSignature = {
          keyType: 'number',
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
    return this.checkIndexSignatureReadonly({ type });
  }

  private checkIndexSignatureReadonly({ type }: { type: Type }): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const declarations = symbol.getDeclarations() || [];
    return declarations.some(decl => this.declarationHasReadonlyIndexSignature({ decl }));
  }

  private declarationHasReadonlyIndexSignature({ decl }: { decl: Node | undefined }): boolean {
    if (!decl || !this.hasGetMembersMethod(decl)) return false;

    const members = decl.getMembers();
    return members.some(member => this.isReadonlyIndexSignatureMember({ member }));
  }

  private isReadonlyIndexSignatureMember({ member }: { member: Node }): boolean {
    return this.isIndexSignatureNode(member) && this.hasReadonlyModifier({ member });
  }

  private isIndexSignatureNode(member: Node): boolean {
    return member.getKindName && member.getKindName() === 'IndexSignature';
  }

  private hasReadonlyModifier({ member }: { member: Node }): boolean {
    if (!this.hasGetModifiersMethod(member)) return false;
    const modifiers = member.getModifiers();
    return modifiers.some((mod: Node) => mod.getKind() === ts.SyntaxKind.ReadonlyKeyword);
  }

  private hasGetModifiersMethod(member: Node): member is Node & { getModifiers(): Node[] } {
    return 'getModifiers' in member && typeof member.getModifiers === 'function';
  }

  private hasGetMembersMethod(decl: Node): decl is Node & { getMembers(): Node[] } {
    return 'getMembers' in decl && typeof decl.getMembers === 'function';
  }

  private hasObjectFlags(type: Type): boolean {
    const tsType = type.compilerType as ts.Type;
    return tsType && 'objectFlags' in tsType && typeof tsType.objectFlags === 'number';
  }

  private hasObjectFlag(tsType: ts.Type & { objectFlags: number }, flag: ts.ObjectFlags): boolean {
    return (tsType.objectFlags & flag) !== 0;
  }
}
