import { test, expect, describe, beforeEach } from 'vitest';
import { ResolutionContextImpl, DEFAULT_MAX_DEPTH } from '../resolver-context.js';

describe('ResolutionContextImpl', () => {
  let context: ResolutionContextImpl;

  beforeEach(() => {
    context = new ResolutionContextImpl();
  });

  describe('constructor', () => {
    test('uses default max depth when not specified', () => {
      const defaultContext = new ResolutionContextImpl();
      expect(defaultContext.maxDepth).toBe(DEFAULT_MAX_DEPTH);
    });

    test('accepts custom max depth', () => {
      const customDepth = 50;
      const customContext = new ResolutionContextImpl(customDepth);
      expect(customContext.maxDepth).toBe(customDepth);
    });

    test('accepts zero max depth', () => {
      const zeroContext = new ResolutionContextImpl(0);
      expect(zeroContext.maxDepth).toBe(0);
    });

    test('initializes with empty visited types set', () => {
      const newContext = new ResolutionContextImpl();
      expect(newContext.visitedTypes.size).toBe(0);
    });
  });

  describe('isVisited', () => {
    test('returns false for non-visited type', () => {
      expect(context.isVisited('string')).toBe(false);
    });

    test('returns true for visited type', () => {
      context.markVisited('string');
      expect(context.isVisited('string')).toBe(true);
    });

    test('handles empty string', () => {
      expect(context.isVisited('')).toBe(false);
      context.markVisited('');
      expect(context.isVisited('')).toBe(true);
    });

    test('is case sensitive', () => {
      context.markVisited('String');
      expect(context.isVisited('string')).toBe(false);
      expect(context.isVisited('String')).toBe(true);
    });
  });

  describe('markVisited', () => {
    test('marks type as visited', () => {
      context.markVisited('number');
      expect(context.visitedTypes.has('number')).toBe(true);
    });

    test('handles duplicate marking gracefully', () => {
      context.markVisited('boolean');
      context.markVisited('boolean');

      expect(context.visitedTypes.has('boolean')).toBe(true);
      expect(context.visitedTypes.size).toBe(1);
    });

    test('can mark multiple different types', () => {
      context.markVisited('string');
      context.markVisited('number');
      context.markVisited('boolean');

      expect(context.visitedTypes.size).toBe(3);
      expect(context.isVisited('string')).toBe(true);
      expect(context.isVisited('number')).toBe(true);
      expect(context.isVisited('boolean')).toBe(true);
    });

    test('handles complex type strings', () => {
      const complexType = 'Array<Record<string, Promise<number>>>';
      context.markVisited(complexType);
      expect(context.isVisited(complexType)).toBe(true);
    });
  });

  describe('unmarkVisited', () => {
    test('removes type from visited set', () => {
      context.markVisited('string');
      expect(context.isVisited('string')).toBe(true);

      context.unmarkVisited('string');
      expect(context.isVisited('string')).toBe(false);
    });

    test('handles unmarking non-visited type gracefully', () => {
      expect(() => context.unmarkVisited('nonexistent')).not.toThrow();
      expect(context.visitedTypes.size).toBe(0);
    });

    test('only removes specified type', () => {
      context.markVisited('string');
      context.markVisited('number');

      context.unmarkVisited('string');

      expect(context.isVisited('string')).toBe(false);
      expect(context.isVisited('number')).toBe(true);
      expect(context.visitedTypes.size).toBe(1);
    });

    test('handles multiple unmarkings of same type', () => {
      context.markVisited('boolean');
      context.unmarkVisited('boolean');
      context.unmarkVisited('boolean');

      expect(context.isVisited('boolean')).toBe(false);
      expect(context.visitedTypes.size).toBe(0);
    });
  });

  describe('exceedsMaxDepth', () => {
    test('returns false when depth is less than max', () => {
      expect(context.exceedsMaxDepth(DEFAULT_MAX_DEPTH - 1)).toBe(false);
    });

    test('returns false when depth equals max', () => {
      expect(context.exceedsMaxDepth(DEFAULT_MAX_DEPTH)).toBe(false);
    });

    test('returns true when depth exceeds max', () => {
      expect(context.exceedsMaxDepth(DEFAULT_MAX_DEPTH + 1)).toBe(true);
    });

    test('works with custom max depth', () => {
      const customContext = new ResolutionContextImpl(10);

      expect(customContext.exceedsMaxDepth(9)).toBe(false);
      expect(customContext.exceedsMaxDepth(10)).toBe(false);
      expect(customContext.exceedsMaxDepth(11)).toBe(true);
    });

    test('works with zero max depth', () => {
      const zeroContext = new ResolutionContextImpl(0);

      expect(zeroContext.exceedsMaxDepth(0)).toBe(false);
      expect(zeroContext.exceedsMaxDepth(1)).toBe(true);
    });

    test('handles negative depths', () => {
      expect(context.exceedsMaxDepth(-1)).toBe(false);
    });
  });

  describe('resetState', () => {
    test('clears all visited types', () => {
      context.markVisited('string');
      context.markVisited('number');
      context.markVisited('boolean');

      expect(context.visitedTypes.size).toBe(3);

      context.resetState();

      expect(context.visitedTypes.size).toBe(0);
      expect(context.isVisited('string')).toBe(false);
      expect(context.isVisited('number')).toBe(false);
      expect(context.isVisited('boolean')).toBe(false);
    });

    test('resets empty context without issues', () => {
      expect(() => context.resetState()).not.toThrow();
      expect(context.visitedTypes.size).toBe(0);
    });

    test('does not affect maxDepth', () => {
      const originalMaxDepth = context.maxDepth;
      context.resetState();
      expect(context.maxDepth).toBe(originalMaxDepth);
    });
  });

  describe('integration scenarios', () => {
    test('typical usage pattern for preventing infinite recursion', () => {
      const typeString = 'RecursiveType';

      // First encounter
      expect(context.isVisited(typeString)).toBe(false);
      expect(context.exceedsMaxDepth(5)).toBe(false);

      context.markVisited(typeString);

      // Second encounter (should detect cycle)
      expect(context.isVisited(typeString)).toBe(true);

      // Clean up after processing
      context.unmarkVisited(typeString);
      expect(context.isVisited(typeString)).toBe(false);
    });

    test('backtracking scenario with nested types', () => {
      const types = ['TypeA', 'TypeB', 'TypeC'];

      // Mark types during descent
      types.forEach(type => context.markVisited(type));

      // Verify all are marked
      types.forEach(type => {
        expect(context.isVisited(type)).toBe(true);
      });

      // Unmark types during ascent (reverse order)
      types.reverse().forEach(type => context.unmarkVisited(type));

      // Verify all are unmarked
      types.forEach(type => {
        expect(context.isVisited(type)).toBe(false);
      });
    });

    test('handles deep recursion up to max depth', () => {
      const customContext = new ResolutionContextImpl(5);

      for (let depth = 0; depth <= 5; depth++) {
        expect(customContext.exceedsMaxDepth(depth)).toBe(false);
      }

      expect(customContext.exceedsMaxDepth(6)).toBe(true);
    });

    test('state persistence across multiple operations', () => {
      // Simulate processing multiple types in sequence
      context.markVisited('Type1');
      context.markVisited('Type2');

      expect(context.visitedTypes.size).toBe(2);

      // Process Type1 (backtrack)
      context.unmarkVisited('Type1');
      expect(context.visitedTypes.size).toBe(1);
      expect(context.isVisited('Type2')).toBe(true);

      // Add Type3
      context.markVisited('Type3');
      expect(context.visitedTypes.size).toBe(2);

      // Reset for next resolution
      context.resetState();
      expect(context.visitedTypes.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('handles extremely long type strings', () => {
      const longType = 'A'.repeat(10000);

      expect(() => {
        context.markVisited(longType);
        context.isVisited(longType);
        context.unmarkVisited(longType);
      }).not.toThrow();
    });

    test('handles special characters in type strings', () => {
      const specialTypes = [
        'Type<T>',
        'Namespace.Type',
        'Type[]',
        'Type | undefined',
        'Type & AnotherType',
        '{[key: string]: value}',
        '() => void',
      ];

      specialTypes.forEach(type => {
        context.markVisited(type);
        expect(context.isVisited(type)).toBe(true);
        context.unmarkVisited(type);
        expect(context.isVisited(type)).toBe(false);
      });
    });

    test('handles very large max depth values', () => {
      const largeContext = new ResolutionContextImpl(Number.MAX_SAFE_INTEGER);

      expect(largeContext.exceedsMaxDepth(1000000)).toBe(false);
      expect(largeContext.exceedsMaxDepth(Number.MAX_SAFE_INTEGER)).toBe(false);
    });
  });
});
