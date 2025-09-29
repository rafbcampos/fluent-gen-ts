import { Type, ts } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';

const OBJECT_TYPE_TEXT = 'object';

/**
 * Resolves primitive and literal types to their TypeInfo representation.
 */
export class PrimitiveResolver {
  /**
   * Resolves a primitive type to its TypeInfo representation.
   * @param params - The type to resolve
   * @returns Result containing the resolved primitive TypeInfo, or null if not a primitive
   */
  resolvePrimitive(params: { type: Type }): Result<TypeInfo> | null {
    const { type } = params;

    if (type.isString()) {
      return ok({ kind: TypeKind.Primitive, name: 'string' });
    }
    if (type.isNumber()) {
      return ok({ kind: TypeKind.Primitive, name: 'number' });
    }
    if (type.isBoolean()) {
      return ok({ kind: TypeKind.Primitive, name: 'boolean' });
    }
    if (type.isUndefined()) {
      return ok({ kind: TypeKind.Primitive, name: 'undefined' });
    }
    if (type.isNull()) {
      return ok({ kind: TypeKind.Primitive, name: 'null' });
    }
    if (type.isAny()) {
      return ok({ kind: TypeKind.Primitive, name: 'any' });
    }
    if (type.isNever()) {
      return ok({ kind: TypeKind.Never });
    }
    if (type.getText() === OBJECT_TYPE_TEXT) {
      return ok({ kind: TypeKind.Primitive, name: 'object' });
    }

    return null;
  }

  /**
   * Resolves a literal type to its TypeInfo representation.
   * @param params - The type to resolve
   * @returns Result containing the resolved literal TypeInfo, or null if not a literal
   */
  resolveLiteral(params: { type: Type }): Result<TypeInfo> | null {
    const { type } = params;

    if (!type.isLiteral()) {
      return null;
    }

    let literalValue: string | number | boolean | undefined = type.getLiteralValue() as
      | string
      | number
      | boolean
      | undefined;

    if (literalValue === undefined) {
      const compilerType = type.compilerType;
      if (this.hasIntrinsicName(compilerType, 'true')) {
        literalValue = true;
      } else if (this.hasIntrinsicName(compilerType, 'false')) {
        literalValue = false;
      }
    }

    return ok({
      kind: TypeKind.Literal,
      literal: literalValue,
    });
  }

  /**
   * Checks if a compiler type has the expected intrinsic name.
   * @param compilerType - The TypeScript compiler type
   * @param expectedName - The expected intrinsic name
   * @returns True if the type has the expected intrinsic name
   */
  private hasIntrinsicName(compilerType: ts.Type, expectedName: string): boolean {
    return (
      typeof compilerType === 'object' &&
      compilerType !== null &&
      'intrinsicName' in compilerType &&
      compilerType.intrinsicName === expectedName
    );
  }
}
