import { describe, it, expect, vi } from 'vitest';
import { ok } from '../../../../core/result.js';
import { TypeKind } from '../../../../core/types.js';
import { ArrayResolver } from '../array-resolver.js';
import type { Type } from 'ts-morph';
import type { GenericContext } from '../../../generic-context.js';

describe('ArrayResolver', () => {
  describe('resolveArray', () => {
    it('should handle readonly arrays', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValue(ok({ kind: TypeKind.Primitive, name: 'string' }));
      const resolver = new ArrayResolver(mockResolveType);

      const mockType = {
        getArrayElementType: vi.fn().mockReturnValue({} as Type),
        getText: vi.fn().mockReturnValue('readonly string[]'),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveArray({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'string' },
          readonly: true,
        });
      }
    });

    it('should handle ReadonlyArray<T> type', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValue(ok({ kind: TypeKind.Primitive, name: 'number' }));
      const resolver = new ArrayResolver(mockResolveType);

      const mockType = {
        getArrayElementType: vi.fn().mockReturnValue({} as Type),
        getText: vi.fn().mockReturnValue('ReadonlyArray<number>'),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveArray({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'number' },
          readonly: true,
        });
      }
    });

    it('should handle regular arrays without readonly', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValue(ok({ kind: TypeKind.Primitive, name: 'boolean' }));
      const resolver = new ArrayResolver(mockResolveType);

      const mockType = {
        getArrayElementType: vi.fn().mockReturnValue({} as Type),
        getText: vi.fn().mockReturnValue('boolean[]'),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveArray({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Primitive, name: 'boolean' },
        });
      }
    });
  });

  describe('resolveTuple', () => {
    it('should handle readonly tuples', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValueOnce(ok({ kind: TypeKind.Primitive, name: 'string' }))
        .mockResolvedValueOnce(ok({ kind: TypeKind.Primitive, name: 'number' }));

      const resolver = new ArrayResolver(mockResolveType);

      const mockType = {
        getTupleElements: vi.fn().mockReturnValue([{}, {}] as Type[]),
        getText: vi.fn().mockReturnValue('readonly [string, number]'),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveTuple({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Tuple,
          elements: [
            { kind: TypeKind.Primitive, name: 'string' },
            { kind: TypeKind.Primitive, name: 'number' },
          ],
          readonly: true,
        });
      }
    });

    it('should handle regular tuples without readonly', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValueOnce(ok({ kind: TypeKind.Primitive, name: 'boolean' }));

      const resolver = new ArrayResolver(mockResolveType);

      const mockType = {
        getTupleElements: vi.fn().mockReturnValue([{}] as Type[]),
        getText: vi.fn().mockReturnValue('[boolean]'),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveTuple({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Tuple,
          elements: [{ kind: TypeKind.Primitive, name: 'boolean' }],
        });
      }
    });
  });
});
