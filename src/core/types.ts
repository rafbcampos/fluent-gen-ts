export const FLUENT_BUILDER_SYMBOL = Symbol.for("fluent-builder");

export interface BuildContext {
  readonly parentId?: string;
  readonly parameterName?: string;
  readonly index?: number;
  readonly [key: string]: unknown;
}

export interface FluentBuilder<T, Ctx extends BuildContext = BuildContext> {
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  (context?: Ctx): T;
}

export const isFluentBuilder = <
  T = unknown,
  Ctx extends BuildContext = BuildContext,
>(
  value: unknown,
): value is FluentBuilder<T, Ctx> => {
  return (
    typeof value === "function" &&
    FLUENT_BUILDER_SYMBOL in value &&
    value[FLUENT_BUILDER_SYMBOL] === true
  );
};

export interface PropertyInfo {
  readonly name: string;
  readonly type: TypeInfo;
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly jsDoc?: string;
}

export interface IndexSignature {
  readonly keyType: "string" | "number" | "symbol";
  readonly valueType: TypeInfo;
  readonly readonly?: boolean;
}

export type TypeInfo =
  | {
      readonly kind: TypeKind.Primitive;
      readonly name: string;
      readonly literal?: unknown;
    }
  | {
      readonly kind: TypeKind.Object;
      readonly name?: string;
      readonly properties: readonly PropertyInfo[];
      readonly genericParams?: readonly GenericParam[];
      readonly indexSignature?: IndexSignature;
      readonly unresolvedGenerics?: readonly GenericParam[];
    }
  | {
      readonly kind: TypeKind.Array;
      readonly elementType: TypeInfo;
    }
  | {
      readonly kind: TypeKind.Union;
      readonly unionTypes: readonly TypeInfo[];
    }
  | {
      readonly kind: TypeKind.Intersection;
      readonly intersectionTypes: readonly TypeInfo[];
    }
  | {
      readonly kind: TypeKind.Generic;
      readonly name: string;
      readonly typeArguments?: readonly TypeInfo[];
      readonly constraint?: TypeInfo;
      readonly default?: TypeInfo;
      readonly unresolvedGenerics?: readonly GenericParam[];
    }
  | {
      readonly kind: TypeKind.Literal;
      readonly literal: unknown;
    }
  | {
      readonly kind: TypeKind.Unknown;
    }
  | {
      readonly kind: TypeKind.Reference;
      readonly name: string;
      readonly typeArguments?: readonly TypeInfo[];
    }
  | {
      readonly kind: TypeKind.Function;
      readonly name?: string;
    }
  | {
      readonly kind: TypeKind.Tuple;
      readonly elements: readonly TypeInfo[];
    }
  | {
      readonly kind: TypeKind.Enum;
      readonly name: string;
      readonly values?: readonly unknown[];
    }
  | {
      readonly kind: TypeKind.Keyof;
      readonly target: TypeInfo;
    }
  | {
      readonly kind: TypeKind.Typeof;
      readonly target: TypeInfo;
    }
  | {
      readonly kind: TypeKind.Index;
      readonly object: TypeInfo;
      readonly index: TypeInfo;
    }
  | {
      readonly kind: TypeKind.Conditional;
      readonly checkType: TypeInfo;
      readonly extendsType: TypeInfo;
      readonly trueType: TypeInfo;
      readonly falseType: TypeInfo;
      readonly inferredTypes?: Record<string, TypeInfo>;
    };

export interface GenericParam {
  readonly name: string;
  readonly constraint?: TypeInfo;
  readonly default?: TypeInfo;
}

export enum TypeKind {
  Primitive = "primitive",
  Object = "object",
  Array = "array",
  Union = "union",
  Intersection = "intersection",
  Generic = "generic",
  Literal = "literal",
  Unknown = "unknown",
  Reference = "reference",
  Function = "function",
  Tuple = "tuple",
  Enum = "enum",
  Keyof = "keyof",
  Typeof = "typeof",
  Index = "index",
  Conditional = "conditional",
}

export interface ResolvedType {
  readonly sourceFile: string;
  readonly name: string;
  readonly typeInfo: TypeInfo;
  readonly imports: readonly string[];
  readonly dependencies: readonly ResolvedType[];
}

export interface GeneratorOptions {
  outputPath?: string;
  useDefaults?: boolean;
  contextType?: string;
  importPath?: string;
  indentSize?: number;
  useTab?: boolean;
}
