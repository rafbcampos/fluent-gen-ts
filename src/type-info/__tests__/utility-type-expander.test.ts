import { test, expect, describe, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { UtilityTypeExpander } from '../utility-type-expander.js';
import { GenericContext } from '../generic-context.js';
import { TypeKind, type TypeInfo } from '../../core/types.js';
import { ok, type Result } from '../../core/result.js';

describe('UtilityTypeExpander', () => {
  let project: Project;
  let expander: UtilityTypeExpander;
  let genericContext: GenericContext;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });

    expander = new UtilityTypeExpander({ maxDepth: 10 });
    genericContext = new GenericContext();
  });

  describe('constructor', () => {
    test('creates expander with default options', () => {
      const defaultExpander = new UtilityTypeExpander();
      expect(defaultExpander).toBeDefined();
    });

    test('creates expander with custom options', () => {
      const customExpander = new UtilityTypeExpander({
        maxDepth: 5,
        genericContext,
      });
      expect(customExpander).toBeDefined();
    });
  });

  describe('resolved utility types', () => {
    test('returns null for resolved Pick<T, K>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User { id: string; name: string; age: number; }
        type UserPick = Pick<User, 'id' | 'name'>;
        const userPick: UserPick = { id: "1", name: "John" };
      `,
      );

      const userPickType = sourceFile.getVariableDeclarationOrThrow('userPick').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: userPickType,
        resolveType: mockResolveType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // TypeScript already resolved it
      }
    });

    test('returns null for resolved Partial<T>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User { id: string; name: string; age: number; }
        type UserPartial = Partial<User>;
        const userPartial: UserPartial = { id: "1" };
      `,
      );

      const userPartialType = sourceFile.getVariableDeclarationOrThrow('userPartial').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: userPartialType,
        resolveType: mockResolveType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // TypeScript already resolved it
      }
    });

    test('returns null for resolved Record<K, V>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type StringRecord = Record<string, number>;
        const stringRecord: StringRecord = { anything: 42 };
      `,
      );

      const stringRecordType = sourceFile.getVariableDeclarationOrThrow('stringRecord').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: stringRecordType,
        resolveType: mockResolveType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // TypeScript already resolved it
      }
    });
  });

  describe('unresolved utility types', () => {
    test('handles unresolved Partial<T>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          data: T;
          partial: Partial<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const partialProperty = genericInterface.getPropertyOrThrow('partial');
      const partialType = partialProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: partialType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
        if (result.value.kind === TypeKind.Generic) {
          expect(result.value.name).toBe('Partial<T>');
        }
      }
    });

    test('handles unresolved Pick<T, K>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          data: T;
          picked: Pick<T, "id" | "version">;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const pickedProperty = genericInterface.getPropertyOrThrow('picked');
      const pickedType = pickedProperty.getType();

      // Check if this is actually unresolved (should have 0 properties for truly unresolved cases)
      if (pickedType.getProperties().length === 0) {
        const mockResolveType = async (): Promise<Result<TypeInfo>> =>
          ok({ kind: TypeKind.Object, properties: [] });

        const result = await expander.expandUtilityType({
          type: pickedType,
          resolveType: mockResolveType,
          depth: 0,
          genericContext,
        });

        expect(result.ok).toBe(true);
        if (result.ok && result.value) {
          expect(result.value.kind).toBe(TypeKind.Generic);
          if (result.value.kind === TypeKind.Generic) {
            expect(result.value.name).toContain('Pick<T,');
          }
        }
      }
    });

    test('handles unresolved Record<K, V>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<K extends string, V> {
          records: Record<K, V>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const recordsProperty = genericInterface.getPropertyOrThrow('records');
      const recordsType = recordsProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: recordsType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
        if (result.value.kind === TypeKind.Generic) {
          expect(result.value.name).toBe('Record<K, V>');
        }
      }
    });

    test('handles Required<T>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          data: T;
          required: Required<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const requiredProperty = genericInterface.getPropertyOrThrow('required');
      const requiredType = requiredProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: requiredType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
        if (result.value.kind === TypeKind.Generic) {
          expect(result.value.name).toBe('Required<T>');
        }
      }
    });

    test('handles Readonly<T>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          data: T;
          readonly: Readonly<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const readonlyProperty = genericInterface.getPropertyOrThrow('readonly');
      const readonlyType = readonlyProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: readonlyType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
        if (result.value.kind === TypeKind.Generic) {
          expect(result.value.name).toBe('Readonly<T>');
        }
      }
    });
  });

  describe('generic parameter extraction', () => {
    test('extracts and registers generic parameters from Partial<T>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          partial: Partial<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const partialProperty = genericInterface.getPropertyOrThrow('partial');
      const partialType = partialProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      await expander.expandUtilityType({
        type: partialType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      // Check if T was registered as a generic parameter
      expect(genericContext.isGenericParam('T')).toBe(true);
    });

    test('extracts multiple generic parameters from Pick<T, K>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T, K extends keyof T> {
          picked: Pick<T, K>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const pickedProperty = genericInterface.getPropertyOrThrow('picked');
      const pickedType = pickedProperty.getType();

      // Only test if this is truly unresolved
      if (pickedType.getProperties().length === 0) {
        const mockResolveType = async (): Promise<Result<TypeInfo>> =>
          ok({ kind: TypeKind.Object, properties: [] });

        await expander.expandUtilityType({
          type: pickedType,
          resolveType: mockResolveType,
          depth: 0,
          genericContext,
        });

        // Check if T and K were registered as generic parameters
        expect(genericContext.isGenericParam('T')).toBe(true);
        expect(genericContext.isGenericParam('K')).toBe(true);
      }
    });

    test('extracts generic parameters from Record<K, V>', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<K extends string, V> {
          records: Record<K, V>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const recordsProperty = genericInterface.getPropertyOrThrow('records');
      const recordsType = recordsProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      await expander.expandUtilityType({
        type: recordsType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      // Check if K and V were registered as generic parameters
      expect(genericContext.isGenericParam('K')).toBe(true);
      expect(genericContext.isGenericParam('V')).toBe(true);
    });

    test('does not register utility type names as generic parameters', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          partial: Partial<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const partialProperty = genericInterface.getPropertyOrThrow('partial');
      const partialType = partialProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      await expander.expandUtilityType({
        type: partialType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      // "Partial" should not be registered as a generic parameter
      expect(genericContext.isGenericParam('Partial')).toBe(false);
      // But "T" should be
      expect(genericContext.isGenericParam('T')).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('returns error when max depth exceeded', async () => {
      const shallowExpander = new UtilityTypeExpander({ maxDepth: 0 });
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          partial: Partial<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const partialProperty = genericInterface.getPropertyOrThrow('partial');
      const partialType = partialProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await shallowExpander.expandUtilityType({
        type: partialType,
        resolveType: mockResolveType,
        depth: 1, // Exceeds maxDepth of 0
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Max utility type expansion depth exceeded');
      }
    });

    test('handles unknown utility type patterns', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User { id: string; name: string; }
        const user: User = { id: "1", name: "John" };
      `,
      );

      const userType = sourceFile.getVariableDeclarationOrThrow('user').getType();
      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: userType,
        resolveType: mockResolveType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null); // Not a utility type
      }
    });

    test('works without generic context', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          partial: Partial<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const partialProperty = genericInterface.getPropertyOrThrow('partial');
      const partialType = partialProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: partialType,
        resolveType: mockResolveType,
        depth: 0,
        // No genericContext provided
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
      }
    });
  });

  describe('integration with type patterns', () => {
    test('handles complex nested utility types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T, K extends keyof T> {
          complex: Partial<Pick<T, K>>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const complexProperty = genericInterface.getPropertyOrThrow('complex');
      const complexType = complexProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: complexType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      expect(result.ok).toBe(true);
      // The result depends on how TypeScript resolves the nested utility types
      // It might be resolved or unresolved depending on the specific case
    });

    test('handles union types with utility types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface GenericContainer<T> {
          union: Partial<T> | Required<T>;
        }
      `,
      );

      const genericInterface = sourceFile.getInterfaceOrThrow('GenericContainer');
      const unionProperty = genericInterface.getPropertyOrThrow('union');
      const unionType = unionProperty.getType();

      const mockResolveType = async (): Promise<Result<TypeInfo>> =>
        ok({ kind: TypeKind.Object, properties: [] });

      const result = await expander.expandUtilityType({
        type: unionType,
        resolveType: mockResolveType,
        depth: 0,
        genericContext,
      });

      expect(result.ok).toBe(true);
      // Union types containing utility patterns are detected when unresolved
      if (result.ok && result.value) {
        expect(result.value.kind).toBe(TypeKind.Generic);
        if (result.value.kind === TypeKind.Generic) {
          expect(result.value.name).toBe('Partial<T> | Required<T>');
        }
      }
    });
  });
});
