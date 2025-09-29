import type { Type } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';
import { BuiltInDetector } from './built-in-detector.js';

/**
 * Resolves built-in TypeScript library types and Node.js runtime types to TypeInfo objects.
 *
 * The BuiltInResolver works in conjunction with the BuiltInDetector to process types that
 * have been identified as built-in types. It handles:
 * - TypeScript standard library types (primitives, generics like Array<T>, Promise<T>)
 * - Node.js runtime types (Buffer, EventEmitter, NodeJS.ProcessEnv, etc.)
 *
 * For generic types, the resolver recursively resolves all type arguments to provide
 * complete type information.
 */
export class BuiltInResolver {
  private readonly detector = new BuiltInDetector();

  constructor(private readonly resolveType: TypeResolverFunction) {}

  /**
   * Resolves a built-in TypeScript library type to TypeInfo.
   *
   * This method handles both primitive types (string, number, etc.) and generic types
   * (Array<T>, Promise<T>, etc.) from the TypeScript standard library. For generic types,
   * it recursively resolves all type arguments.
   *
   * @param params - The resolution parameters
   * @param params.type - The TypeScript type to resolve
   * @param params.depth - Current recursion depth for preventing infinite recursion
   * @param params.context - Optional generic context for type parameter resolution
   * @returns A Promise resolving to a Result containing the resolved TypeInfo
   *
   * @example
   * ```typescript
   * // Resolving a primitive type
   * const stringResult = await resolver.resolveBuiltInType({
   *   type: stringType,
   *   depth: 0
   * });
   * // Result: { kind: TypeKind.Primitive, name: 'string' }
   *
   * // Resolving a generic type
   * const arrayResult = await resolver.resolveBuiltInType({
   *   type: arrayStringType,
   *   depth: 0
   * });
   * // Result: {
   * //   kind: TypeKind.Generic,
   * //   name: 'Array',
   * //   typeArguments: [{ kind: TypeKind.Primitive, name: 'string' }]
   * // }
   * ```
   */
  async resolveBuiltInType(params: {
    type: Type;
    depth: number;
    context?: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const typeName = this.getTypeName(type);

    const typeArguments = type.getTypeArguments();
    if (typeArguments && typeArguments.length > 0) {
      const resolvedTypeArgs: TypeInfo[] = [];
      for (const arg of typeArguments) {
        const resolved = await this.resolveType(arg, depth + 1, context);
        if (!resolved.ok) return resolved;
        resolvedTypeArgs.push(resolved.value);
      }

      return ok({
        kind: TypeKind.Generic,
        name: typeName,
        typeArguments: resolvedTypeArgs,
      });
    }

    return ok({
      kind: TypeKind.Primitive,
      name: typeName,
    });
  }

  /**
   * Resolves a Node.js built-in type to TypeInfo.
   *
   * This method handles Node.js runtime types including both common Node.js classes
   * (Buffer, EventEmitter, etc.) and types from the NodeJS namespace (NodeJS.ProcessEnv,
   * NodeJS.Dict, etc.). The method should only be called after the BuiltInDetector
   * has confirmed the type is a Node.js built-in type.
   *
   * @param params - The resolution parameters
   * @param params.type - The TypeScript type to resolve (must be a Node.js built-in)
   * @returns A Result containing the resolved TypeInfo as a primitive type
   *
   * @example
   * ```typescript
   * // Resolving a Node.js class
   * const bufferResult = resolver.resolveNodeJSBuiltInType({
   *   type: bufferType
   * });
   * // Result: { kind: TypeKind.Primitive, name: 'Buffer' }
   *
   * // Resolving a NodeJS namespace type
   * const processEnvResult = resolver.resolveNodeJSBuiltInType({
   *   type: processEnvType
   * });
   * // Result: { kind: TypeKind.Primitive, name: 'NodeJS.ProcessEnv' }
   * ```
   */
  resolveNodeJSBuiltInType(params: { type: Type }): Result<TypeInfo> {
    const { type } = params;

    // Use the type text directly for NodeJS built-in types
    // This method is only called after the BuiltInDetector has confirmed
    // the type is a NodeJS built-in, so we can trust the type text
    const typeName = this.getTypeName(type);

    return ok({
      kind: TypeKind.Primitive,
      name: typeName,
    });
  }

  /**
   * Extracts the appropriate name for a type, preferring symbol name when available
   * and falling back to type text representation. For NodeJS namespace types,
   * preserves the full namespace qualification.
   */
  private getTypeName(type: Type): string {
    const typeText = type.getText();

    // For NodeJS namespace types, use the full type text to preserve namespace
    if (typeText.includes('NodeJS.') && this.detector.isNodeJSBuiltInType(type)) {
      return typeText;
    }

    const symbol = type.getSymbol();
    return symbol?.getName() ?? typeText;
  }
}
