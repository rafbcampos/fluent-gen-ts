import { Type, ts, Node } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { TypeInfo, IndexSignature } from '../core/types.js';
import { TypeKind } from '../core/types.js';

/**
 * Configuration options for the MappedTypeResolver.
 */
export interface MappedTypeResolverOptions {
  /** Maximum recursion depth for type resolution to prevent infinite loops. Defaults to 10. */
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

  /**
   * Attempts to resolve a mapped type that hasn't been fully resolved by TypeScript.
   *
   * @param params - The resolution parameters
   * @param params.type - The TypeScript type to analyze
   * @param params.resolveType - Function to resolve nested types recursively
   * @param params.depth - Current recursion depth (default: 0)
   * @returns Promise resolving to TypeInfo if this is a mappable type, null if already resolved, or error
   */
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

    if (this.hasIndexSignature(type)) {
      return this.expandIndexSignatureType(type, resolveType, depth);
    }

    if (this.isUnresolvedMappedType(type)) {
      const symbol = type.getSymbol();
      const name = symbol?.getName() || type.getText();
      return ok({
        kind: TypeKind.Generic,
        name,
      });
    }

    return ok(null);
  }

  private isUnresolvedMappedType(type: Type): boolean {
    if (type.getProperties().length > 0) {
      return false;
    }

    const typeText = type.getText();
    const symbol = type.getSymbol();

    if (this.hasGenericParameters(typeText) && symbol) {
      return this.isUnresolvedGenericMappedType(type, symbol);
    }

    return false;
  }

  private hasGenericParameters(typeText: string): boolean {
    return typeText.includes('<') && typeText.includes('>');
  }

  private isUnresolvedGenericMappedType(
    type: Type,
    symbol: NonNullable<ReturnType<Type['getSymbol']>>,
  ): boolean {
    if (this.isAnonymousTypeSymbol(symbol)) {
      return false;
    }

    if (this.hasObjectFlags(type)) {
      return (
        this.hasObjectFlag(type.compilerType, ts.ObjectFlags.Mapped) &&
        !this.hasObjectFlag(type.compilerType, ts.ObjectFlags.Instantiated)
      );
    }

    return true;
  }

  private isAnonymousTypeSymbol(symbol: NonNullable<ReturnType<Type['getSymbol']>>): boolean {
    const symbolName = symbol.getName();
    return symbolName === '__type' || symbolName === 'Anonymous';
  }

  private hasIndexSignature(type: Type): boolean {
    if (!type.isObject() || type.isArray()) return false;

    const stringIndexType = type.getStringIndexType();
    const numberIndexType = type.getNumberIndexType();

    if (stringIndexType === undefined && numberIndexType === undefined) {
      return false;
    }

    return type.getProperties().length === 0;
  }

  private async expandIndexSignatureType(
    type: Type,
    resolveType: (t: Type, depth: number) => Promise<Result<TypeInfo>>,
    depth: number,
  ): Promise<Result<TypeInfo>> {
    const stringIndexType = type.getStringIndexType();
    const numberIndexType = type.getNumberIndexType();

    let indexSignature: IndexSignature | undefined;
    let indexType = stringIndexType;
    let keyType: 'string' | 'number' = 'string';

    if (!indexType) {
      indexType = numberIndexType;
      keyType = 'number';
    }

    if (indexType) {
      const resolved = await resolveType(indexType, depth + 1);
      if (resolved.ok) {
        indexSignature = {
          keyType,
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
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const declarations = symbol.getDeclarations() || [];
    return declarations.some(decl => this.declarationHasReadonlyIndexSignature(decl));
  }

  private declarationHasReadonlyIndexSignature(decl: Node | undefined): boolean {
    if (!decl || !this.hasGetMembersMethod(decl)) return false;

    const members = decl.getMembers();
    return members.some(member => this.isReadonlyIndexSignatureMember(member));
  }

  private isReadonlyIndexSignatureMember(member: Node): boolean {
    return this.isIndexSignatureNode(member) && this.hasReadonlyModifier(member);
  }

  private isIndexSignatureNode(member: Node): boolean {
    return (
      'getKindName' in member &&
      typeof member.getKindName === 'function' &&
      member.getKindName() === 'IndexSignature'
    );
  }

  private hasReadonlyModifier(member: Node): boolean {
    if (!this.hasGetModifiersMethod(member)) return false;
    const modifiers = member.getModifiers();
    return modifiers.some(
      (mod: Node) => this.hasGetKindMethod(mod) && mod.getKind() === ts.SyntaxKind.ReadonlyKeyword,
    );
  }

  private hasGetModifiersMethod(member: Node): member is Node & { getModifiers(): Node[] } {
    return 'getModifiers' in member && typeof member.getModifiers === 'function';
  }

  private hasGetMembersMethod(decl: Node): decl is Node & { getMembers(): Node[] } {
    return 'getMembers' in decl && typeof decl.getMembers === 'function';
  }

  private hasGetKindMethod(node: Node): node is Node & { getKind(): ts.SyntaxKind } {
    return 'getKind' in node && typeof node.getKind === 'function';
  }

  private hasObjectFlags(
    type: Type,
  ): type is Type & { compilerType: ts.Type & { objectFlags: number } } {
    const tsType = type.compilerType as ts.Type;
    return tsType && 'objectFlags' in tsType && typeof tsType.objectFlags === 'number';
  }

  private hasObjectFlag(tsType: ts.Type & { objectFlags: number }, flag: ts.ObjectFlags): boolean {
    return (tsType.objectFlags & flag) !== 0;
  }
}
