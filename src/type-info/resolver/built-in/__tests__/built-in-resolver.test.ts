import { test, expect, describe, beforeEach, vi } from 'vitest';
import { Project } from 'ts-morph';
import { BuiltInResolver } from '../built-in-resolver.js';
import { ok, err } from '../../../../core/result.js';
import { TypeKind } from '../../../../core/types.js';
import { GenericContext } from '../../../generic-context.js';

describe('BuiltInResolver', () => {
  let resolver: BuiltInResolver;
  let project: Project;
  let mockResolveType: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockResolveType = vi.fn();
    resolver = new BuiltInResolver(mockResolveType);
    project = new Project();
  });

  describe('resolveBuiltInType', () => {
    test('resolves primitive type without type arguments', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const test: string = 'hello';
      `,
      );
      const variable = sourceFile.getVariableDeclarationOrThrow('test');
      const type = variable.getType();

      const result = await resolver.resolveBuiltInType({
        type,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'string',
        });
      }
    });

    test('resolves generic type with type arguments', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const test: Array<string> = [];
      `,
      );
      const variable = sourceFile.getVariableDeclarationOrThrow('test');
      const type = variable.getType();

      // Mock the resolveType function to return a resolved type argument
      mockResolveType.mockResolvedValue(
        ok({
          kind: TypeKind.Primitive,
          name: 'string',
        }),
      );

      const result = await resolver.resolveBuiltInType({
        type,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Generic,
          name: 'Array',
          typeArguments: [
            {
              kind: TypeKind.Primitive,
              name: 'string',
            },
          ],
        });
      }

      expect(mockResolveType).toHaveBeenCalledTimes(1);
      expect(mockResolveType).toHaveBeenCalledWith(
        expect.anything(), // type argument
        1, // depth + 1
        undefined, // context
      );
    });

    test('resolves generic type with multiple type arguments', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const test: Map<string, number> = new Map();
      `,
      );
      const variable = sourceFile.getVariableDeclarationOrThrow('test');
      const type = variable.getType();

      // Mock the resolveType function for both type arguments
      mockResolveType
        .mockResolvedValueOnce(
          ok({
            kind: TypeKind.Primitive,
            name: 'string',
          }),
        )
        .mockResolvedValueOnce(
          ok({
            kind: TypeKind.Primitive,
            name: 'number',
          }),
        );

      const result = await resolver.resolveBuiltInType({
        type,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Generic,
          name: 'Map',
          typeArguments: [
            {
              kind: TypeKind.Primitive,
              name: 'string',
            },
            {
              kind: TypeKind.Primitive,
              name: 'number',
            },
          ],
        });
      }

      expect(mockResolveType).toHaveBeenCalledTimes(2);
    });

    test('propagates error when type argument resolution fails', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const test: Array<string> = [];
      `,
      );
      const variable = sourceFile.getVariableDeclarationOrThrow('test');
      const type = variable.getType();

      // Mock the resolveType function to return an error
      const mockError = err('Type resolution failed');
      mockResolveType.mockResolvedValue(mockError);

      const result = await resolver.resolveBuiltInType({
        type,
        depth: 0,
      });

      expect(result.ok).toBe(false);
      expect(result).toEqual(mockError);
    });

    test('handles types without symbols correctly', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type Test = never;
      `,
      );
      const typeAlias = sourceFile.getTypeAliasOrThrow('Test');
      const type = typeAlias.getType();

      const result = await resolver.resolveBuiltInType({
        type,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'never', // falls back to type.getText()
        });
      }
    });

    test('passes context to recursive type resolution', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const test: Array<string> = [];
      `,
      );
      const variable = sourceFile.getVariableDeclarationOrThrow('test');
      const type = variable.getType();

      const mockContext = {} as GenericContext; // mock generic context
      mockResolveType.mockResolvedValue(
        ok({
          kind: TypeKind.Primitive,
          name: 'string',
        }),
      );

      await resolver.resolveBuiltInType({
        type,
        depth: 5,
        context: mockContext,
      });

      expect(mockResolveType).toHaveBeenCalledWith(
        expect.anything(),
        6, // depth + 1
        mockContext, // context should be passed through
      );
    });
  });

  describe('resolveNodeJSBuiltInType', () => {
    test('resolves NodeJS namespace types', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        declare let env: NodeJS.ProcessEnv;
      `,
      );
      const variable = sourceFile.getVariableDeclarationOrThrow('env');
      const type = variable.getType();

      const result = resolver.resolveNodeJSBuiltInType({ type });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'NodeJS.ProcessEnv',
        });
      }
    });

    test('resolves regular NodeJS types using symbol name', () => {
      // Create a mock type with a Buffer symbol
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        declare let buffer: Buffer;
      `,
      );
      const variable = sourceFile.getVariableDeclarationOrThrow('buffer');
      const type = variable.getType();

      const result = resolver.resolveNodeJSBuiltInType({ type });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'Buffer', // Uses symbol name when available
        });
      }
    });

    test('handles types without symbols', () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type Test = never;
      `,
      );
      const typeAlias = sourceFile.getTypeAliasOrThrow('Test');
      const type = typeAlias.getType();

      const result = resolver.resolveNodeJSBuiltInType({ type });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'never', // Falls back to type text when no symbol
        });
      }
    });

    test('handles types with symbols but no meaningful name', () => {
      // This is a bit contrived, but tests the edge case
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const obj = { prop: 'value' };
        type Test = typeof obj;
      `,
      );
      const typeAlias = sourceFile.getTypeAliasOrThrow('Test');
      const type = typeAlias.getType();

      const result = resolver.resolveNodeJSBuiltInType({ type });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Uses symbol name when available, even if it's __object
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: '__object',
        });
      }
    });
  });
});
