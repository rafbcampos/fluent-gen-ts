import type { Type } from 'ts-morph';
import type { TypeInfo } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { Result } from '../../../core/result.js';

export interface ResolverParams {
  readonly type: Type;
  readonly depth: number;
  readonly context: GenericContext;
}

export interface ResolutionContext {
  readonly visitedTypes: Set<string>;
  readonly maxDepth: number;
  isVisited(typeString: string): boolean;
  markVisited(typeString: string): void;
  unmarkVisited(typeString: string): void;
  exceedsMaxDepth(depth: number): boolean;
  resetState(): void;
}

export class ResolutionContextImpl implements ResolutionContext {
  readonly visitedTypes = new Set<string>();

  constructor(readonly maxDepth: number = 30) {}

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

export type TypeResolverFunction = (
  type: Type,
  depth: number,
  context?: GenericContext,
) => Promise<Result<TypeInfo>>;
