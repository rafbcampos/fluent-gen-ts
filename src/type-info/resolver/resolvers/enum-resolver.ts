import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';

const DEFAULT_ENUM_NAME = 'UnknownEnum';

/**
 * Resolves TypeScript enum types to their TypeInfo representation.
 */
export class EnumResolver {
  /**
   * Resolves an enum type to its TypeInfo representation.
   * @param params - The type to resolve
   * @returns Result containing the resolved enum TypeInfo
   */
  resolveEnum(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;
    const enumName = type.getSymbol()?.getName();

    return ok({
      kind: TypeKind.Enum,
      name: enumName ?? DEFAULT_ENUM_NAME,
    });
  }
}
