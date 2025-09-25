import { Type, ts } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';

export class PrimitiveResolver {
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
    if (type.getText() === 'object') {
      return ok({ kind: TypeKind.Primitive, name: 'object' });
    }

    return null;
  }

  resolveLiteral(params: { type: Type }): Result<TypeInfo> | null {
    const { type } = params;

    if (!type.isLiteral()) {
      return null;
    }

    let literalValue: string | number | ts.PseudoBigInt | boolean | undefined =
      type.getLiteralValue();

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

  private hasIntrinsicName(compilerType: ts.Type, expectedName: string): boolean {
    return (
      typeof compilerType === 'object' &&
      compilerType !== null &&
      'intrinsicName' in compilerType &&
      compilerType.intrinsicName === expectedName
    );
  }
}
