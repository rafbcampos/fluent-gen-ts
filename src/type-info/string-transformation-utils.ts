import { Type, ts } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok } from '../core/result.js';

/**
 * Information about a detected TypeScript intrinsic string transformation type
 */
export interface StringTransformationInfo {
  /** The type of string transformation being performed */
  readonly transform: StringTransformationType;
  /** The inner type being transformed (e.g., the T in Capitalize<T>) */
  readonly innerType: Type;
}

/**
 * Supported TypeScript intrinsic string transformation types
 */
export type StringTransformationType = 'capitalize' | 'uncapitalize' | 'uppercase' | 'lowercase';

/**
 * Utility for detecting and working with TypeScript's intrinsic string manipulation types
 * like Capitalize<T>, Uppercase<T>, etc.
 */
export class StringTransformationUtils {
  /**
   * Detects if a type is an intrinsic string manipulation type and extracts information
   *
   * @param type - The TypeScript type to analyze
   * @returns A Result containing StringTransformationInfo if the type is an intrinsic string transformation, null otherwise
   *
   * @example
   * ```typescript
   * const utils = new StringTransformationUtils();
   * const result = utils.detectStringTransformation(capitalizeType);
   * if (result.ok && result.value) {
   *   console.log(result.value.transform); // 'capitalize'
   * }
   * ```
   */
  detectStringTransformation(type: Type): Result<StringTransformationInfo | null> {
    const compilerType = type.compilerType;

    // Ensure we have a valid TypeScript compiler type
    if (!compilerType || !this.isValidCompilerType(compilerType)) {
      return ok(null);
    }

    // Check for intrinsic string manipulation types using TypeScript's internal structure
    if (this.isIntrinsicStringType(compilerType)) {
      const symbol = type.getSymbol();
      if (!symbol) return ok(null);

      const typeName = symbol.getName();
      const transform = this.getTransformationType(typeName);
      if (!transform) return ok(null);

      // Get the type arguments to find the inner type
      const typeArgs = type.getTypeArguments();
      if (typeArgs.length !== 1) return ok(null);

      const innerType = typeArgs[0];
      if (!innerType) return ok(null);

      return ok({
        transform,
        innerType,
      });
    }

    return ok(null);
  }

  /**
   * Applies a string transformation to a value, matching TypeScript's intrinsic string manipulation behavior
   *
   * @param value - The string value to transform
   * @param transform - The type of transformation to apply
   * @returns The transformed string
   *
   * @example
   * ```typescript
   * const utils = new StringTransformationUtils();
   *
   * utils.applyStringTransform('hello', 'capitalize');  // 'Hello'
   * utils.applyStringTransform('Hello', 'uncapitalize'); // 'hello'
   * utils.applyStringTransform('hello', 'uppercase');    // 'HELLO'
   * utils.applyStringTransform('HELLO', 'lowercase');    // 'hello'
   * ```
   */
  applyStringTransform(value: string, transform: StringTransformationType): string {
    switch (transform) {
      case 'capitalize':
        return value.charAt(0).toUpperCase() + value.slice(1);
      case 'uncapitalize':
        return value.charAt(0).toLowerCase() + value.slice(1);
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
    }
  }

  /**
   * Type guard to check if the compiler type is a valid TypeScript Type
   *
   * @param compilerType - The compiler type to validate
   * @returns True if it's a valid ts.Type, false otherwise
   */
  private isValidCompilerType(compilerType: unknown): compilerType is ts.Type {
    return compilerType != null && typeof compilerType === 'object' && 'flags' in compilerType;
  }

  /**
   * Checks if a type is an intrinsic string manipulation type using TypeScript's internal flags
   *
   * @param compilerType - The TypeScript compiler type to check
   * @returns True if the type is an intrinsic string manipulation type, false otherwise
   */
  private isIntrinsicStringType(compilerType: ts.Type): boolean {
    // TypeScript's intrinsic string manipulation types have a specific flag
    return !!(compilerType.flags & ts.TypeFlags.StringMapping);
  }

  /**
   * Maps TypeScript intrinsic string manipulation symbol names to our transformation types
   *
   * @param symbolName - The name of the TypeScript symbol (e.g., 'Capitalize', 'Uppercase')
   * @returns The corresponding StringTransformationType, or null if not recognized
   */
  private getTransformationType(symbolName: string): StringTransformationType | null {
    switch (symbolName) {
      case 'Capitalize':
        return 'capitalize';
      case 'Uncapitalize':
        return 'uncapitalize';
      case 'Uppercase':
        return 'uppercase';
      case 'Lowercase':
        return 'lowercase';
      default:
        return null;
    }
  }
}
