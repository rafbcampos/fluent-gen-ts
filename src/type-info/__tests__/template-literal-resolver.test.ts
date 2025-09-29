import { test, expect, describe, beforeEach } from 'vitest';
import { Project, ts } from 'ts-morph';
import { TemplateLiteralResolver } from '../template-literal-resolver.js';
import { TypeKind } from '../../core/types.js';
import type { TypeInfo } from '../../core/types.js';

describe('TemplateLiteralResolver - TypeScript API Verification', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });
  });

  test('verify TypeScript template literal flag detection', () => {
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
        // Simple template literal (resolved)
        type SimpleTemplate = \`hello world\`;

        // Template literal with placeholder (unresolved)
        type WithPlaceholder<T> = \`prefix-\${T}-suffix\`;

        // Resolved template literal
        type ResolvedTemplate = WithPlaceholder<"test">;

        // Template literal with union expansion
        type Status = "success" | "error";
        type StatusMessage = \`Status: \${Status}\`;
      `,
    );

    // Test simple template literal (should be resolved to string literal)
    const simpleType = sourceFile.getTypeAliasOrThrow('SimpleTemplate').getType();
    const simpleCompilerType = simpleType.compilerType as ts.Type;
    expect(simpleType.isLiteral()).toBe(true);
    expect(!!(simpleCompilerType.flags & ts.TypeFlags.TemplateLiteral)).toBe(false);

    // Test unresolved template literal (should have TemplateLiteral flag)
    const withPlaceholderType = sourceFile.getTypeAliasOrThrow('WithPlaceholder').getType();
    const placeholderCompilerType = withPlaceholderType.compilerType as ts.Type;
    expect(!!(placeholderCompilerType.flags & ts.TypeFlags.TemplateLiteral)).toBe(true);

    // Test resolved template literal (should be string literal)
    const resolvedType = sourceFile.getTypeAliasOrThrow('ResolvedTemplate').getType();
    expect(resolvedType.isLiteral()).toBe(true);
    expect(resolvedType.getText()).toBe('"prefix-test-suffix"');

    // Test union expansion (should be union type)
    const statusMessageType = sourceFile.getTypeAliasOrThrow('StatusMessage').getType();
    expect(statusMessageType.isUnion()).toBe(true);
    expect(statusMessageType.getUnionTypes().length).toBe(2);
  });
});

describe('TemplateLiteralResolver', () => {
  let project: Project;
  let resolver: TemplateLiteralResolver;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });
    resolver = new TemplateLiteralResolver();
  });

  const mockResolveType = async (
    type: ts.Type,
    _depth: number,
  ): Promise<{ ok: true; value: TypeInfo }> => {
    // Mock resolver that handles basic type resolution
    if (type.flags & ts.TypeFlags.StringLiteral) {
      return {
        ok: true,
        value: {
          kind: TypeKind.Literal,
          literal: (type as any).value,
        },
      };
    }

    if (type.flags & ts.TypeFlags.Union) {
      const unionTypes: TypeInfo[] = [];
      for (const unionType of (type as any).types || []) {
        if (unionType.flags & ts.TypeFlags.StringLiteral) {
          unionTypes.push({
            kind: TypeKind.Literal,
            literal: unionType.value,
          });
        }
      }
      return {
        ok: true,
        value: {
          kind: TypeKind.Union,
          unionTypes,
        },
      };
    }

    return {
      ok: true,
      value: {
        kind: TypeKind.Primitive,
        name: 'string',
      },
    };
  };

  describe('resolveTemplateLiteral', () => {
    test('returns null for non-template literal types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type StringType = string;
          type LiteralType = "hello";
        `,
      );

      const stringType = sourceFile.getTypeAliasOrThrow('StringType').getType();
      const result = await resolver.resolveTemplateLiteral({
        type: stringType,
        resolveType: mockResolveType as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }

      const literalType = sourceFile.getTypeAliasOrThrow('LiteralType').getType();
      const literalResult = await resolver.resolveTemplateLiteral({
        type: literalType,
        resolveType: mockResolveType as any,
      });

      expect(literalResult.ok).toBe(true);
      if (literalResult.ok) {
        expect(literalResult.value).toBe(null);
      }
    });

    test('returns null for already resolved template literals', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type SimpleTemplate = \`hello world\`;
          type ResolvedTemplate<T> = \`prefix-\${T}-suffix\`;
          type ConcreteResolved = ResolvedTemplate<"test">;
        `,
      );

      // Simple template literal without placeholders
      const simpleType = sourceFile.getTypeAliasOrThrow('SimpleTemplate').getType();
      const simpleResult = await resolver.resolveTemplateLiteral({
        type: simpleType,
        resolveType: mockResolveType as any,
      });

      expect(simpleResult.ok).toBe(true);
      if (simpleResult.ok) {
        expect(simpleResult.value).toBe(null); // Already resolved by TypeScript
      }

      // Resolved template literal
      const resolvedType = sourceFile.getTypeAliasOrThrow('ConcreteResolved').getType();
      const resolvedResult = await resolver.resolveTemplateLiteral({
        type: resolvedType,
        resolveType: mockResolveType as any,
      });

      expect(resolvedResult.ok).toBe(true);
      if (resolvedResult.ok) {
        expect(resolvedResult.value).toBe(null); // Already resolved by TypeScript
      }
    });

    test('handles template literals with placeholders that resolve to literals', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type WithPlaceholder<T> = \`prefix-\${T}-suffix\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('WithPlaceholder').getType();

      // Mock resolveType to return a specific literal
      const mockResolveSpecific = async (): Promise<{
        ok: true;
        value: TypeInfo;
      }> => ({
        ok: true,
        value: {
          kind: TypeKind.Literal,
          literal: 'test',
        },
      });

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveSpecific as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        const literal = result.value as Extract<TypeInfo, { kind: TypeKind.Literal }>;
        expect(literal.literal).toBe('prefix-test-suffix');
      }
    });

    test('handles template literals with union placeholders', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type WithUnionPlaceholder<T> = \`prefix-\${T}-suffix\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('WithUnionPlaceholder').getType();

      // Mock resolveType to return a union of literals
      const mockResolveUnion = async (): Promise<{
        ok: true;
        value: TypeInfo;
      }> => ({
        ok: true,
        value: {
          kind: TypeKind.Union,
          unionTypes: [
            { kind: TypeKind.Literal, literal: 'success' },
            { kind: TypeKind.Literal, literal: 'error' },
          ],
        },
      });

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveUnion as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        const union = result.value as Extract<TypeInfo, { kind: TypeKind.Union }>;
        expect(union.unionTypes).toHaveLength(2);

        const literals = union.unionTypes.map(t =>
          t.kind === TypeKind.Literal ? t.literal : null,
        );
        expect(literals).toContain('prefix-success-suffix');
        expect(literals).toContain('prefix-error-suffix');
      }
    });

    test('handles multiple placeholders in template literals', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type MultiPlaceholder<T, U> = \`\${T}-middle-\${U}\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('MultiPlaceholder').getType();

      // Mock resolveType to alternate between different literals
      let callCount = 0;
      const mockResolveMultiple = async (): Promise<{
        ok: true;
        value: TypeInfo;
      }> => {
        callCount++;
        return {
          ok: true,
          value: {
            kind: TypeKind.Literal,
            literal: callCount === 1 ? 'start' : 'end',
          },
        };
      };

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveMultiple as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        const literal = result.value as Extract<TypeInfo, { kind: TypeKind.Literal }>;
        expect(literal.literal).toBe('start-middle-end');
      }
    });

    test('returns generic when placeholders cannot be resolved to literals', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type WithGenericPlaceholder<T> = \`prefix-\${T}-suffix\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('WithGenericPlaceholder').getType();

      // Mock resolveType to return a primitive type that can't be expanded
      const mockResolveGeneric = async (): Promise<{
        ok: true;
        value: TypeInfo;
      }> => ({
        ok: true,
        value: {
          kind: TypeKind.Primitive,
          name: 'string',
        },
      });

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveGeneric as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
        const generic = result.value as Extract<TypeInfo, { kind: TypeKind.Generic }>;
        expect(generic.name).toBe(templateType.getText());
      }
    });

    test('respects max depth limit', async () => {
      const resolverWithLowDepth = new TemplateLiteralResolver({ maxDepth: 0 });
      const sourceFile = project.createSourceFile('test.ts', `type Test<T> = \`hello-\${T}\`;`);

      const type = sourceFile.getTypeAliasOrThrow('Test').getType();
      const result = await resolverWithLowDepth.resolveTemplateLiteral({
        type,
        resolveType: mockResolveType as any,
        depth: 1,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Max template literal resolution depth exceeded');
      }
    });

    test('respects max combinations limit', async () => {
      const resolverWithLowLimit = new TemplateLiteralResolver({
        maxCombinations: 3,
      });
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type MultiPlaceholder<T, U> = \`\${T}_\${U}\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('MultiPlaceholder').getType();

      let callCount = 0;
      const mockResolveWithLargeUnion = async (): Promise<{
        ok: true;
        value: TypeInfo;
      }> => {
        callCount++;
        return {
          ok: true,
          value: {
            kind: TypeKind.Union,
            unionTypes:
              callCount === 1
                ? [
                    { kind: TypeKind.Literal, literal: 'a' },
                    { kind: TypeKind.Literal, literal: 'b' },
                  ]
                : [
                    { kind: TypeKind.Literal, literal: '1' },
                    { kind: TypeKind.Literal, literal: '2' },
                  ],
          },
        };
      };

      const result = await resolverWithLowLimit.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveWithLargeUnion as any,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('combinations');
        expect(result.error.message).toContain('exceeding max');
      }
    });

    test('handles template literals without placeholders', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type NoPlaceholders<T> = \`fixed-string\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('NoPlaceholders').getType();

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveType as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        const literal = result.value as Extract<TypeInfo, { kind: TypeKind.Literal }>;
        expect(literal.literal).toBe('fixed-string');
      }
    });

    test('handles errors in placeholder resolution gracefully', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type WithErrorPlaceholder<T> = \`prefix-\${T}-suffix\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('WithErrorPlaceholder').getType();

      // Mock resolveType to return an error
      const mockResolveError = async (): Promise<{
        ok: false;
        error: Error;
      }> => ({
        ok: false,
        error: new Error('Resolution failed'),
      });

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveError as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        // Should return generic when resolution fails
        expect(result.value.kind).toBe(TypeKind.Generic);
      }
    });

    test('handles complex union combinations in multiple placeholders', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type ComplexTemplate<T, U> = \`\${T}_\${U}\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('ComplexTemplate').getType();

      // Mock resolveType to return unions for both placeholders
      let callCount = 0;
      const mockResolveComplexUnion = async (): Promise<{
        ok: true;
        value: TypeInfo;
      }> => {
        callCount++;
        return {
          ok: true,
          value: {
            kind: TypeKind.Union,
            unionTypes:
              callCount === 1
                ? [
                    { kind: TypeKind.Literal, literal: 'a' },
                    { kind: TypeKind.Literal, literal: 'b' },
                  ]
                : [
                    { kind: TypeKind.Literal, literal: '1' },
                    { kind: TypeKind.Literal, literal: '2' },
                  ],
          },
        };
      };

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveComplexUnion as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Union);
        const union = result.value as Extract<TypeInfo, { kind: TypeKind.Union }>;
        expect(union.unionTypes).toHaveLength(4);

        const literals = union.unionTypes.map(t =>
          t.kind === TypeKind.Literal ? t.literal : null,
        );
        expect(literals).toContain('a_1');
        expect(literals).toContain('a_2');
        expect(literals).toContain('b_1');
        expect(literals).toContain('b_2');
      }
    });
  });

  describe('edge cases', () => {
    test('handles empty template literals', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type EmptyTemplate = \`\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('EmptyTemplate').getType();

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveType as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Empty template should be resolved to empty string literal by TypeScript
        expect(result.value).toBe(null);
      }
    });

    test('handles template literals with only placeholders', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type OnlyPlaceholder<T> = \`\${T}\`;
        `,
      );

      const templateType = sourceFile.getTypeAliasOrThrow('OnlyPlaceholder').getType();

      const mockResolveSingle = async (): Promise<{
        ok: true;
        value: TypeInfo;
      }> => ({
        ok: true,
        value: {
          kind: TypeKind.Literal,
          literal: 'content',
        },
      });

      const result = await resolver.resolveTemplateLiteral({
        type: templateType,
        resolveType: mockResolveSingle as any,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Literal);
        const literal = result.value as Extract<TypeInfo, { kind: TypeKind.Literal }>;
        expect(literal.literal).toBe('content');
      }
    });
  });
});
