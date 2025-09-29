import { describe, it, expect, vi } from 'vitest';
import { ok, err } from '../../../../core/result.js';
import { TypeKind } from '../../../../core/types.js';
import { UnionResolver } from '../union-resolver.js';
import type { Type } from 'ts-morph';
import type { GenericContext } from '../../../generic-context.js';

describe('UnionResolver', () => {
  describe('resolveUnion', () => {
    it('should resolve union types correctly', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValueOnce(ok({ kind: TypeKind.Primitive, name: 'string' }))
        .mockResolvedValueOnce(ok({ kind: TypeKind.Primitive, name: 'number' }));

      const resolver = new UnionResolver(mockResolveType);

      const mockType = {
        getUnionTypes: vi.fn().mockReturnValue([{}, {}] as Type[]),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveUnion({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Primitive, name: 'string' },
            { kind: TypeKind.Primitive, name: 'number' },
          ],
        });
      }

      expect(mockResolveType).toHaveBeenCalledTimes(2);
    });

    it('should propagate errors from type resolution', async () => {
      const errorMessage = 'Failed to resolve type';
      const mockResolveType = vi
        .fn()
        .mockResolvedValueOnce(ok({ kind: TypeKind.Primitive, name: 'string' }))
        .mockResolvedValueOnce(err(new Error(errorMessage)));

      const resolver = new UnionResolver(mockResolveType);

      const mockType = {
        getUnionTypes: vi.fn().mockReturnValue([{}, {}] as Type[]),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveUnion({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(errorMessage);
      }
    });

    it('should handle empty union types', async () => {
      const mockResolveType = vi.fn();
      const resolver = new UnionResolver(mockResolveType);

      const mockType = {
        getUnionTypes: vi.fn().mockReturnValue([]),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveUnion({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Union,
          unionTypes: [],
        });
      }

      expect(mockResolveType).not.toHaveBeenCalled();
    });
  });

  describe('resolveIntersection', () => {
    it('should resolve intersection types correctly', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValueOnce(
          ok({
            kind: TypeKind.Object,
            name: 'Foo',
            properties: [],
          }),
        )
        .mockResolvedValueOnce(
          ok({
            kind: TypeKind.Object,
            name: 'Bar',
            properties: [],
          }),
        );

      const resolver = new UnionResolver(mockResolveType);

      const mockType = {
        getIntersectionTypes: vi.fn().mockReturnValue([{}, {}] as Type[]),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveIntersection({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Intersection,
          intersectionTypes: [
            { kind: TypeKind.Object, name: 'Foo', properties: [] },
            { kind: TypeKind.Object, name: 'Bar', properties: [] },
          ],
        });
      }

      expect(mockResolveType).toHaveBeenCalledTimes(2);
    });

    it('should propagate errors from type resolution', async () => {
      const errorMessage = 'Failed to resolve type';
      const mockResolveType = vi
        .fn()
        .mockResolvedValueOnce(ok({ kind: TypeKind.Object, properties: [] }))
        .mockResolvedValueOnce(err(new Error(errorMessage)));

      const resolver = new UnionResolver(mockResolveType);

      const mockType = {
        getIntersectionTypes: vi.fn().mockReturnValue([{}, {}] as Type[]),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveIntersection({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe(errorMessage);
      }
    });

    it('should handle empty intersection types', async () => {
      const mockResolveType = vi.fn();
      const resolver = new UnionResolver(mockResolveType);

      const mockType = {
        getIntersectionTypes: vi.fn().mockReturnValue([]),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const result = await resolver.resolveIntersection({
        type: mockType,
        depth: 0,
        context: mockContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Intersection,
          intersectionTypes: [],
        });
      }

      expect(mockResolveType).not.toHaveBeenCalled();
    });
  });

  describe('composite type resolution', () => {
    it('should use common logic for both union and intersection', async () => {
      const mockResolveType = vi
        .fn()
        .mockResolvedValue(ok({ kind: TypeKind.Primitive, name: 'any' }));

      const resolver = new UnionResolver(mockResolveType);

      const mockUnionType = {
        getUnionTypes: vi.fn().mockReturnValue([{}, {}, {}] as Type[]),
      } as unknown as Type;

      const mockIntersectionType = {
        getIntersectionTypes: vi.fn().mockReturnValue([{}, {}, {}] as Type[]),
      } as unknown as Type;

      const mockContext = {} as GenericContext;

      const unionResult = await resolver.resolveUnion({
        type: mockUnionType,
        depth: 0,
        context: mockContext,
      });

      const intersectionResult = await resolver.resolveIntersection({
        type: mockIntersectionType,
        depth: 0,
        context: mockContext,
      });

      expect(unionResult.ok).toBe(true);
      expect(intersectionResult.ok).toBe(true);

      expect(mockResolveType).toHaveBeenCalledTimes(6);
      expect(mockResolveType).toHaveBeenCalledWith({}, 1, mockContext);
    });
  });
});
