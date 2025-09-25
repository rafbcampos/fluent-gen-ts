import { Type, ts } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';

export class OperatorResolver {
  isKeyofType(type: Type): boolean {
    const tsType = type.compilerType as ts.Type;
    if (tsType && 'flags' in tsType) {
      return (tsType.flags & ts.TypeFlags.Index) !== 0;
    }
    return false;
  }

  isTypeofType(type: Type): boolean {
    const symbol = type.getSymbol();
    const typeText = type.getText();
    return typeText.startsWith('typeof ') || (symbol?.getName()?.startsWith('typeof ') ?? false);
  }

  isIndexAccessType(type: Type): boolean {
    const tsType = type.compilerType as ts.Type;
    if (tsType && 'flags' in tsType) {
      return (tsType.flags & ts.TypeFlags.IndexedAccess) !== 0;
    }
    return false;
  }

  resolveKeyof(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const typeText = type.getText();
    const keyofMatch = typeText.match(/keyof\s+(.+)/);

    if (keyofMatch && keyofMatch[1]) {
      return ok({
        kind: TypeKind.Keyof,
        target: { kind: TypeKind.Reference, name: keyofMatch[1] },
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }

  resolveTypeof(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const typeText = type.getText();
    const typeofMatch = typeText.match(/typeof\s+(.+)/);

    if (typeofMatch && typeofMatch[1]) {
      return ok({
        kind: TypeKind.Typeof,
        target: { kind: TypeKind.Reference, name: typeofMatch[1] },
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }

  resolveIndexAccess(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const typeText = type.getText();
    const indexMatch = typeText.match(/(.+)\[(.+)\]/);

    if (indexMatch && indexMatch[1] && indexMatch[2]) {
      return ok({
        kind: TypeKind.Index,
        object: { kind: TypeKind.Reference, name: indexMatch[1] },
        index: { kind: TypeKind.Reference, name: indexMatch[2] },
      });
    }

    return ok({ kind: TypeKind.Unknown });
  }
}
