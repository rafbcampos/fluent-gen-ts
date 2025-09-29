import { Type, ts } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';

/**
 * Resolves TypeScript type operators (keyof, typeof, indexed access) to their TypeInfo representation.
 */
export class OperatorResolver {
  /**
   * Checks if a type is a keyof type operator.
   * @param type - The type to check
   * @returns True if the type is a keyof operator
   */
  isKeyofType(type: Type): boolean {
    const tsType = type.compilerType as ts.Type;
    return Boolean(tsType && 'flags' in tsType && (tsType.flags & ts.TypeFlags.Index) !== 0);
  }

  /**
   * Checks if a type is a typeof type operator.
   * @param type - The type to check
   * @returns True if the type is a typeof operator
   */
  isTypeofType(type: Type): boolean {
    const symbol = type.getSymbol();
    const typeText = type.getText();
    return typeText.startsWith('typeof ') || Boolean(symbol?.getName()?.startsWith('typeof '));
  }

  /**
   * Checks if a type is an indexed access type.
   * @param type - The type to check
   * @returns True if the type is an indexed access type
   */
  isIndexAccessType(type: Type): boolean {
    const tsType = type.compilerType as ts.Type;
    return Boolean(
      tsType && 'flags' in tsType && (tsType.flags & ts.TypeFlags.IndexedAccess) !== 0,
    );
  }

  /**
   * Resolves a keyof type operator to its TypeInfo representation.
   * @param params - The type to resolve
   * @returns Result containing the resolved keyof TypeInfo
   */
  resolveKeyof(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const typeText = type.getText();
    const keyofMatch = typeText.match(/keyof\s+(.+)/);

    if (keyofMatch?.[1]) {
      return ok({
        kind: TypeKind.Keyof,
        target: { kind: TypeKind.Reference, name: keyofMatch[1] },
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }

  /**
   * Resolves a typeof type operator to its TypeInfo representation.
   * @param params - The type to resolve
   * @returns Result containing the resolved typeof TypeInfo
   */
  resolveTypeof(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const typeText = type.getText();
    const typeofMatch = typeText.match(/typeof\s+(.+)/);

    if (typeofMatch?.[1]) {
      return ok({
        kind: TypeKind.Typeof,
        target: { kind: TypeKind.Reference, name: typeofMatch[1] },
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }

  /**
   * Resolves an indexed access type to its TypeInfo representation.
   * @param params - The type to resolve
   * @returns Result containing the resolved indexed access TypeInfo
   */
  resolveIndexAccess(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const typeText = type.getText();
    const indexMatch = typeText.match(/(.+)\[(.+)\]/);

    if (indexMatch?.[1] && indexMatch[2]) {
      return ok({
        kind: TypeKind.Index,
        object: { kind: TypeKind.Reference, name: indexMatch[1] },
        index: { kind: TypeKind.Reference, name: indexMatch[2] },
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }
}
