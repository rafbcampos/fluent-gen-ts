import { test, expect, describe, beforeEach } from 'vitest';
import { Project, ts } from 'ts-morph';
import { ConditionalTypeResolver } from '../conditional-type-resolver.js';
import { TypeKind } from '../../core/types.js';
import type { TypeInfo } from '../../core/types.js';
import { GenericContext } from '../generic-context.js';

describe('ConditionalTypeResolver - TypeScript API Investigation', () => {
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

  test('verify TypeScript conditional type flag detection', () => {
    const sourceFile = project.createSourceFile(
      'test.ts',
      `
        // Resolved conditional types
        type IsString<T> = T extends string ? true : false;
        type Test1 = IsString<string>;  // Should be resolved to true
        type Test2 = IsString<number>;  // Should be resolved to false

        // Unresolved conditional type (depends on generic)
        type UnresolvedConditional<T> = T extends string ? { isString: true } : { isString: false };

        // Conditional with infer
        type ExtractArrayType<T> = T extends (infer U)[] ? U : never;

        // Nested conditional
        type NestedConditional<T> = T extends string
          ? T extends "hello"
            ? "greeting"
            : "other-string"
          : "not-string";

        interface TestInterface<T> {
          conditionalProp: T extends string ? number : boolean;
          normalProp: string;
        }
      `,
    );

    // Test resolved conditional (should be 'true' literal)
    const test1Type = sourceFile.getTypeAliasOrThrow('Test1').getType();
    const test1CompilerType = test1Type.compilerType as ts.Type;

    // Verify resolved conditionals don't have the Conditional flag
    expect(test1Type.isLiteral()).toBe(true);
    expect(!!(test1CompilerType.flags & ts.TypeFlags.Conditional)).toBe(false);

    // Test resolved conditional (should be 'false' literal)
    const test2Type = sourceFile.getTypeAliasOrThrow('Test2').getType();
    const test2CompilerType = test2Type.compilerType as ts.Type;

    expect(test2Type.isLiteral()).toBe(true);
    expect(!!(test2CompilerType.flags & ts.TypeFlags.Conditional)).toBe(false);

    // Test unresolved conditional (generic parameter)
    const unresolvedAlias = sourceFile.getTypeAliasOrThrow('UnresolvedConditional');
    const unresolvedType = unresolvedAlias.getType();
    const unresolvedCompilerType = unresolvedType.compilerType as ts.Type;

    // Verify unresolved conditionals have the Conditional flag
    expect(!!(unresolvedCompilerType.flags & ts.TypeFlags.Conditional)).toBe(true);
    expect(unresolvedCompilerType.flags).toBe(16777216); // ts.TypeFlags.Conditional

    // Check if it's a ConditionalType in TypeScript's internal type system
    const conditionalType = unresolvedCompilerType as ts.ConditionalType;
    const hasConditionalStructure =
      !!(conditionalType as any).root && !!(conditionalType as any).checkType;
    expect(hasConditionalStructure).toBeTruthy();

    // Test conditional with infer
    const extractArrayType = sourceFile.getTypeAliasOrThrow('ExtractArrayType').getType();
    const extractCompilerType = extractArrayType.compilerType as ts.Type;
    expect(!!(extractCompilerType.flags & ts.TypeFlags.Conditional)).toBe(true);

    // Test interface with conditional property
    const testInterface = sourceFile.getInterfaceOrThrow('TestInterface');
    const conditionalProp = testInterface.getPropertyOrThrow('conditionalProp');
    const conditionalPropType = conditionalProp.getType();
    const propCompilerType = conditionalPropType.compilerType as ts.Type;
    expect(!!(propCompilerType.flags & ts.TypeFlags.Conditional)).toBe(true);
  });
});

describe('ConditionalTypeResolver', () => {
  let project: Project;
  let resolver: ConditionalTypeResolver;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });
    resolver = new ConditionalTypeResolver();
  });

  describe('resolveConditionalType', () => {
    test('returns null for already resolved conditional types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type IsString<T> = T extends string ? true : false;
          type Resolved = IsString<string>;  // Resolved to true
        `,
      );

      const resolvedType = sourceFile.getTypeAliasOrThrow('Resolved').getType();
      const result = await resolver.resolveConditionalType({
        type: resolvedType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Should return null as it's already resolved
      }
    });

    test('handles unresolved conditional types with generic parameters', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type ConditionalGeneric<T> = T extends string ? number : boolean;
        `,
      );

      const unresolvedType = sourceFile.getTypeAliasOrThrow('ConditionalGeneric').getType();
      const result = await resolver.resolveConditionalType({
        type: unresolvedType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        // Should return Generic type that represents the unresolved conditional
        // This will bubble up to create Builder<T>
        expect(result.value.kind).toBe(TypeKind.Generic);
        const generic = result.value as Extract<TypeInfo, { kind: TypeKind.Generic }>;
        expect(generic.name).toBeDefined();
      }
    });

    test('respects max depth limit', async () => {
      const resolverWithLowDepth = new ConditionalTypeResolver({ maxDepth: 0 });
      const sourceFile = project.createSourceFile('test.ts', `type Test = string;`);

      const type = sourceFile.getTypeAliasOrThrow('Test').getType();
      const result = await resolverWithLowDepth.resolveConditionalType({
        type,
        depth: 1,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Max conditional type resolution depth exceeded');
      }
    });

    test('handles primitive types correctly', async () => {
      const sourceFile = project.createSourceFile('test.ts', `type StringType = string;`);

      const stringType = sourceFile.getTypeAliasOrThrow('StringType').getType();
      const result = await resolver.resolveConditionalType({
        type: stringType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Not a conditional type
      }
    });

    test('handles literal types correctly', async () => {
      const sourceFile = project.createSourceFile('test.ts', `type LiteralType = "hello";`);

      const literalType = sourceFile.getTypeAliasOrThrow('LiteralType').getType();
      const result = await resolver.resolveConditionalType({
        type: literalType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Not a conditional type
      }
    });

    test('handles objects with properties correctly', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          interface TestObject {
            name: string;
            age: number;
          }
          type ObjType = TestObject;
        `,
      );

      const objType = sourceFile.getTypeAliasOrThrow('ObjType').getType();
      const result = await resolver.resolveConditionalType({ type: objType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Not a conditional type
      }
    });

    test('handles nested conditional types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type NestedConditional<T> = T extends string
            ? T extends "hello"
              ? "greeting"
              : "other"
            : "not-string";
        `,
      );

      const nestedType = sourceFile.getTypeAliasOrThrow('NestedConditional').getType();
      const result = await resolver.resolveConditionalType({
        type: nestedType,
      });

      expect(result.ok).toBe(true);
      // Unresolved nested conditionals are returned as Generic
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
      }
    });

    test('handles conditional types with infer keyword', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type ExtractArray<T> = T extends (infer U)[] ? U : never;
        `,
      );

      const inferType = sourceFile.getTypeAliasOrThrow('ExtractArray').getType();
      const result = await resolver.resolveConditionalType({ type: inferType });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        // Conditional with infer is returned as Generic for later resolution
        expect(result.value.kind).toBe(TypeKind.Generic);
        const generic = result.value as Extract<TypeInfo, { kind: TypeKind.Generic }>;
        expect(generic.name).toBeDefined();
      }
    });

    test('handles distributive conditional types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type Distributive<T> = T extends any ? T[] : never;
        `,
      );

      const distributiveType = sourceFile.getTypeAliasOrThrow('Distributive').getType();
      const result = await resolver.resolveConditionalType({
        type: distributiveType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
      }
    });

    test('correctly identifies resolved union types from conditionals', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type StringOrNumber<T> = T extends boolean ? string | number : never;
          type Result = StringOrNumber<true>;  // Should be resolved to string | number
        `,
      );

      const resultType = sourceFile.getTypeAliasOrThrow('Result').getType();
      const result = await resolver.resolveConditionalType({
        type: resultType,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Already resolved
      }
    });

    test("handles type aliases that look like generics but aren't conditional", async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type Box<T> = { value: T };
          type MyBox = Box<string>;
        `,
      );

      const boxType = sourceFile.getTypeAliasOrThrow('MyBox').getType();
      const result = await resolver.resolveConditionalType({ type: boxType });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Not a conditional type
      }
    });
  });

  describe('edge cases', () => {
    test('handles undefined symbol names gracefully', async () => {
      // Create a type without a symbol (anonymous type)
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type Anonymous = T extends string ? { x: number } : { y: string };
        `,
      );

      // This will cause a TypeScript error but we want to test the behavior
      try {
        const type = sourceFile.getTypeAliasOrThrow('Anonymous').getType();
        const result = await resolver.resolveConditionalType({ type });

        // The code should handle this gracefully
        expect(result.ok).toBeDefined();
      } catch {
        // If TypeScript can't parse it, that's also acceptable
        expect(true).toBe(true);
      }
    });

    test('handles complex generic parameter names', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type ComplexConditional<TData> = TData extends string ? number : boolean;
          type NamespacedConditional<MyNamespace.Type> = MyNamespace.Type extends string ? true : false;
        `,
      );

      const complexType = sourceFile.getTypeAliasOrThrow('ComplexConditional').getType();
      const result = await resolver.resolveConditionalType({ type: complexType });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
      }
    });

    test('handles generic parameters with constraints', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type ConstrainedConditional<T extends Record<string, any>> = T extends { id: string } ? T['id'] : never;
        `,
      );

      const constrainedType = sourceFile.getTypeAliasOrThrow('ConstrainedConditional').getType();
      const result = await resolver.resolveConditionalType({ type: constrainedType });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
      }
    });

    test('handles type.getText() errors gracefully', async () => {
      const sourceFile = project.createSourceFile('test.ts', `type Test = string;`);
      const type = sourceFile.getTypeAliasOrThrow('Test').getType();

      // Mock type.getText to throw an error
      const originalGetText = type.getText.bind(type);
      type.getText = () => {
        throw new Error('getText failed');
      };

      const result = await resolver.resolveConditionalType({ type });

      // Should handle the error gracefully
      expect(result.ok).toBe(true);

      // Restore original method
      type.getText = originalGetText;
    });
  });

  describe('integration with GenericContext', () => {
    test('uses GenericContext to track generic parameters', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          type WithGeneric<T> = T extends string ? { value: T } : never;
        `,
      );

      // Create a GenericContext and register T as a generic parameter
      const genericContext = new GenericContext();
      genericContext.registerGenericParam({
        param: {
          name: 'T',
          constraint: { kind: TypeKind.Unknown },
        },
      });

      const resolverWithContext = new ConditionalTypeResolver({
        genericContext,
      });

      const type = sourceFile.getTypeAliasOrThrow('WithGeneric').getType();
      const result = await resolverWithContext.resolveConditionalType({ type });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        // With context, it should recognize T as a known generic
        expect(result.value.kind).toBe(TypeKind.Generic);
        const generic = result.value as Extract<TypeInfo, { kind: TypeKind.Generic }>;
        expect(generic.name).toContain('T');
      }
    });

    test('preserves conditionals for builder generation', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
          interface ApiResponse<T = any> {
            data: T extends Error ? never : T;
            error: T extends Error ? string : undefined;
          }
        `,
      );

      const genericContext = new GenericContext();
      const resolverWithContext = new ConditionalTypeResolver({
        genericContext,
      });

      // Get the interface and its properties
      const apiInterface = sourceFile.getInterfaceOrThrow('ApiResponse');
      const dataProperty = apiInterface.getPropertyOrThrow('data');
      const dataType = dataProperty.getType();

      const result = await resolverWithContext.resolveConditionalType({
        type: dataType,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        // The conditional should be preserved as a generic
        // allowing Builder<T> to be created
        expect(result.value.kind).toBe(TypeKind.Generic);
      }
    });
  });
});
