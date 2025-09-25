import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';

export class EnumResolver {
  resolveEnum(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const enumName = type.getSymbol()?.getName();

    return ok({
      kind: TypeKind.Enum,
      name: enumName ?? 'UnknownEnum',
    });
  }
}
