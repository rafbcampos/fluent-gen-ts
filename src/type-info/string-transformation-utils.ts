import { Type, ts } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok } from '../core/result.js';

export interface StringTransformationInfo {
  readonly transform: StringTransformationType;
  readonly innerType: Type;
}

export type StringTransformationType = 'capitalize' | 'uncapitalize' | 'uppercase' | 'lowercase';

/**
 * Utility for detecting and working with TypeScript's intrinsic string manipulation types
 * like Capitalize<T>, Uppercase<T>, etc.
 */
export class StringTransformationUtils {
  /**
   * Detects if a type is an intrinsic string manipulation type and extracts information
   */
  detectStringTransformation(type: Type): Result<StringTransformationInfo | null> {
    const compilerType = type.compilerType as ts.Type;

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
   * Applies a string transformation to a value
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
   * Checks if a type is an intrinsic string manipulation type
   */
  private isIntrinsicStringType(compilerType: ts.Type): boolean {
    // TypeScript's intrinsic string manipulation types have a specific flag
    return !!(compilerType.flags & ts.TypeFlags.StringMapping);
  }

  /**
   * Maps symbol names to transformation types
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
