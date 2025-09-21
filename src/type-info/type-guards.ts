import type { TypeInfo } from '../core/types.js';
import { TypeKind } from '../core/types.js';

/**
 * Factory function to create type guards for TypeInfo variants
 */
function createTypeGuard<T extends TypeInfo>(kind: TypeKind) {
  return (info: TypeInfo): info is T => info.kind === kind;
}

/**
 * Type guard to check if TypeInfo is an Object type
 */
export const isObjectTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Object }>>(
  TypeKind.Object,
);

/**
 * Type guard to check if TypeInfo is an Array type
 */
export const isArrayTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Array }>>(
  TypeKind.Array,
);

/**
 * Type guard to check if TypeInfo is a Union type
 */
export const isUnionTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Union }>>(
  TypeKind.Union,
);

/**
 * Type guard to check if TypeInfo is an Intersection type
 */
export const isIntersectionTypeInfo = createTypeGuard<
  Extract<TypeInfo, { kind: TypeKind.Intersection }>
>(TypeKind.Intersection);

/**
 * Type guard to check if TypeInfo is a Reference type
 */
export const isReferenceTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Reference }>>(
  TypeKind.Reference,
);

/**
 * Type guard to check if TypeInfo is a Primitive type
 */
export const isPrimitiveTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Primitive }>>(
  TypeKind.Primitive,
);

/**
 * Type guard to check if TypeInfo is a Generic type
 */
export const isGenericTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Generic }>>(
  TypeKind.Generic,
);

/**
 * Type guard to check if TypeInfo is a Literal type
 */
export const isLiteralTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Literal }>>(
  TypeKind.Literal,
);

/**
 * Type guard to check if TypeInfo is a Function type
 */
export const isFunctionTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Function }>>(
  TypeKind.Function,
);

/**
 * Type guard to check if TypeInfo is a Tuple type
 */
export const isTupleTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Tuple }>>(
  TypeKind.Tuple,
);

/**
 * Type guard to check if TypeInfo is an Enum type
 */
export const isEnumTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Enum }>>(
  TypeKind.Enum,
);

/**
 * Type guard to check if TypeInfo is a Keyof type
 */
export const isKeyofTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Keyof }>>(
  TypeKind.Keyof,
);

/**
 * Type guard to check if TypeInfo is a Typeof type
 */
export const isTypeofTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Typeof }>>(
  TypeKind.Typeof,
);

/**
 * Type guard to check if TypeInfo is an Index type
 */
export const isIndexTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Index }>>(
  TypeKind.Index,
);

/**
 * Type guard to check if TypeInfo is a Conditional type
 */
export const isConditionalTypeInfo = createTypeGuard<
  Extract<TypeInfo, { kind: TypeKind.Conditional }>
>(TypeKind.Conditional);

/**
 * Type guard to check if TypeInfo is an Unknown type
 */
export const isUnknownTypeInfo = createTypeGuard<Extract<TypeInfo, { kind: TypeKind.Unknown }>>(
  TypeKind.Unknown,
);
