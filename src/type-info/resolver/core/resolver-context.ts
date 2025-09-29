import type { Type } from 'ts-morph';
import type { TypeInfo } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { Result } from '../../../core/result.js';

/**
 * Default maximum recursion depth for type resolution to prevent infinite loops.
 */
export const DEFAULT_MAX_DEPTH = 30;

/**
 * Parameters required for type resolution operations.
 */
export interface ResolverParams {
  /** The TypeScript type to be resolved */
  readonly type: Type;
  /** Current recursion depth to prevent infinite loops */
  readonly depth: number;
  /** Optional generic type context for resolving type parameters */
  readonly context?: GenericContext;
}

/**
 * Context for managing type resolution state and preventing infinite recursion.
 * Tracks visited types and enforces maximum recursion depth limits.
 */
export interface ResolutionContext {
  /** Set of type strings that have been visited during resolution */
  readonly visitedTypes: Set<string>;
  /** Maximum allowed recursion depth */
  readonly maxDepth: number;

  /**
   * Check if a type has already been visited during resolution.
   * @param typeString - String representation of the type to check
   * @returns True if the type has been visited, false otherwise
   */
  isVisited(typeString: string): boolean;

  /**
   * Mark a type as visited during resolution.
   * @param typeString - String representation of the type to mark as visited
   */
  markVisited(typeString: string): void;

  /**
   * Remove a type from the visited set (for backtracking).
   * @param typeString - String representation of the type to unmark
   */
  unmarkVisited(typeString: string): void;

  /**
   * Check if the current depth exceeds the maximum allowed depth.
   * @param depth - Current recursion depth
   * @returns True if depth exceeds maximum, false otherwise
   */
  exceedsMaxDepth(depth: number): boolean;

  /**
   * Reset all tracking state (clear visited types).
   */
  resetState(): void;
}

/**
 * Default implementation of ResolutionContext for managing type resolution state.
 *
 * @example
 * ```typescript
 * const context = new ResolutionContextImpl(25);
 * if (!context.exceedsMaxDepth(depth) && !context.isVisited(typeString)) {
 *   context.markVisited(typeString);
 *   // ... resolve type
 *   context.unmarkVisited(typeString);
 * }
 * ```
 */
export class ResolutionContextImpl implements ResolutionContext {
  readonly visitedTypes = new Set<string>();

  /**
   * Creates a new resolution context with the specified maximum depth.
   * @param maxDepth - Maximum allowed recursion depth (default: DEFAULT_MAX_DEPTH)
   */
  constructor(readonly maxDepth: number = DEFAULT_MAX_DEPTH) {}

  isVisited(typeString: string): boolean {
    return this.visitedTypes.has(typeString);
  }

  markVisited(typeString: string): void {
    this.visitedTypes.add(typeString);
  }

  unmarkVisited(typeString: string): void {
    this.visitedTypes.delete(typeString);
  }

  exceedsMaxDepth(depth: number): boolean {
    return depth > this.maxDepth;
  }

  resetState(): void {
    this.visitedTypes.clear();
  }
}

/**
 * Function signature for resolving TypeScript types into TypeInfo objects.
 *
 * @param type - The TypeScript type to resolve
 * @param depth - Current recursion depth to prevent infinite loops
 * @param context - Optional generic type context for resolving type parameters
 * @returns Promise resolving to a Result containing TypeInfo or an error
 */
export type TypeResolverFunction = (
  type: Type,
  depth: number,
  context?: GenericContext,
) => Promise<Result<TypeInfo>>;
