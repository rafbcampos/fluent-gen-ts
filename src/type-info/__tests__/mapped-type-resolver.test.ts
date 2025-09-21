import { test, expect, describe, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { MappedTypeResolver } from '../mapped-type-resolver.js';
import { TypeKind } from '../../core/types.js';
import type { TypeInfo } from '../../core/types.js';
import { ok, type Result } from '../../core/result.js';

describe('MappedTypeResolver', () => {
  let project: Project;
  let resolver: MappedTypeResolver;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });
    resolver = new MappedTypeResolver();
  });

  describe('resolveMappedType', () => {
    test('returns null for already resolved utility types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          interface User {
            id: string;
            name: string;
          }
          type PartialUser = Partial<User>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow('PartialUser').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Already resolved by TypeScript
      }
    });

    test('handles pure string index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type StringIndex = { [key: string]: number };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('StringIndex').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Primitive, name: 'number' });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        const objectType = result.value as Extract<TypeInfo, { kind: TypeKind.Object }>;
        expect(objectType.properties).toEqual([]);
        expect(objectType.indexSignature?.keyType).toBe('string');
        expect(objectType.indexSignature?.valueType).toEqual({
          kind: TypeKind.Primitive,
          name: 'number',
        });
        expect(objectType.indexSignature?.readonly).toBe(false);
      }
    });

    test('handles pure number index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type NumberIndex = { [key: number]: string };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('NumberIndex').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Primitive, name: 'string' });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        const objectType = result.value as Extract<TypeInfo, { kind: TypeKind.Object }>;
        expect(objectType.indexSignature?.keyType).toBe('number');
        expect(objectType.indexSignature?.valueType).toEqual({
          kind: TypeKind.Primitive,
          name: 'string',
        });
      }
    });

    test('handles readonly index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type ReadonlyIndex = { readonly [key: string]: boolean };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('ReadonlyIndex').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Primitive, name: 'boolean' });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        const objectType = result.value as Extract<TypeInfo, { kind: TypeKind.Object }>;
        expect(objectType.indexSignature?.readonly).toBe(true);
      }
    });

    test('ignores mixed types with properties and index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type Mixed = {
            name: string;
            [key: string]: any;
          };
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow('Mixed').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Should be handled by main resolver
      }
    });

    test('excludes arrays from index signature handling', async () => {
      const sourceFile = project.createSourceFile('test.ts', `type ArrayType = number[];`);

      const type = sourceFile.getTypeAliasOrThrow('ArrayType').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Arrays should not be treated as index signatures
      }
    });

    test('handles unresolved generic mapped types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type MyPartial<T> = { [K in keyof T]?: T[K] };
          type UnresolvedGeneric<T> = MyPartial<T>;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow('UnresolvedGeneric').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
        const genericType = result.value as Extract<TypeInfo, { kind: TypeKind.Generic }>;
        expect(genericType.name).toBeDefined();
      }
    });

    test('respects max depth limit', async () => {
      const resolverWithLowDepth = new MappedTypeResolver({ maxDepth: 0 });
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type StringIndex = { [key: string]: number };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('StringIndex').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolverWithLowDepth.resolveMappedType({
        type,
        resolveType: mockResolveType,
        depth: 1,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Max mapped type resolution depth exceeded');
      }
    });

    test('handles empty objects correctly', async () => {
      const sourceFile = project.createSourceFile('test.ts', `type EmptyObject = {};`);

      const type = sourceFile.getTypeAliasOrThrow('EmptyObject').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Empty objects are not mapped types
      }
    });

    test('handles primitive types correctly', async () => {
      const sourceFile = project.createSourceFile('test.ts', `type StringType = string;`);

      const type = sourceFile.getTypeAliasOrThrow('StringType').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Primitives are not mapped types
      }
    });

    test('handles value type resolution errors', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type StringIndex = { [key: string]: ComplexType };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('StringIndex').getType();
      const mockResolveType = async (_t: any, _depth: number) => {
        return {
          ok: false,
          error: new Error('Failed to resolve ComplexType'),
        } as const;
      };

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Unknown);
      }
    });
  });

  describe('edge cases', () => {
    test('handles types without symbols gracefully', async () => {
      const sourceFile = project.createSourceFile('test.ts', `type TestType = { x: number };`);

      const type = sourceFile.getTypeAliasOrThrow('TestType').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> => ok({ kind: TypeKind.Unknown });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      // Should handle gracefully without throwing
    });

    test('handles complex nested index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type NestedIndex = { [key: string]: { [key: number]: boolean } };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('NestedIndex').getType();
      let callCount = 0;
      const mockResolveType = async (_t: any, _depth: number): Promise<Result<TypeInfo>> => {
        callCount++;
        if (callCount === 1) {
          return ok({
            kind: TypeKind.Object,
            properties: [],
            indexSignature: {
              keyType: 'number' as const,
              valueType: { kind: TypeKind.Primitive, name: 'boolean' },
              readonly: false,
            },
          });
        }
        return ok({ kind: TypeKind.Unknown });
      };

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        const objectType = result.value as Extract<TypeInfo, { kind: TypeKind.Object }>;
        expect(objectType.indexSignature?.keyType).toBe('string');
        expect(objectType.indexSignature?.valueType.kind).toBe(TypeKind.Object);
      }
    });

    test('handles both string and number index types present', async () => {
      // This is a rare case but can happen in some TypeScript configurations
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          interface DualIndex {
            [key: string]: any;
            [key: number]: string;
          }
          type TestDual = DualIndex;
        `,
      );

      const type = sourceFile.getTypeAliasOrThrow('TestDual').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Primitive, name: 'string' });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      // Should handle gracefully - string index type takes precedence
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Object);
        const objectType = result.value as Extract<TypeInfo, { kind: TypeKind.Object }>;
        expect(objectType.indexSignature?.keyType).toBe('string');
      }
    });

    test('preserves depth parameter in recursive calls', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type StringIndex = { [key: string]: number };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('StringIndex').getType();
      let receivedDepth: number | undefined;
      const mockResolveType = async (_t: any, depth: number): Promise<Result<TypeInfo>> => {
        receivedDepth = depth;
        return ok({ kind: TypeKind.Primitive, name: 'number' });
      };

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
        depth: 5,
      });

      expect(result.ok).toBe(true);
      expect(receivedDepth).toBe(6); // Should increment depth by 1
    });
  });

  describe('readonly detection accuracy', () => {
    test('correctly identifies non-readonly index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type NonReadonly = { [key: string]: any };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('NonReadonly').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Primitive, name: 'any' });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        const objectType = result.value as Extract<TypeInfo, { kind: TypeKind.Object }>;
        expect(objectType.indexSignature?.readonly).toBe(false);
      }
    });

    test('correctly identifies readonly index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `type ReadonlyType = { readonly [key: string]: any };`,
      );

      const type = sourceFile.getTypeAliasOrThrow('ReadonlyType').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Primitive, name: 'any' });

      const result = await resolver.resolveMappedType({
        type,
        resolveType: mockResolveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        const objectType = result.value as Extract<TypeInfo, { kind: TypeKind.Object }>;
        expect(objectType.indexSignature?.readonly).toBe(true);
      }
    });
  });
});
