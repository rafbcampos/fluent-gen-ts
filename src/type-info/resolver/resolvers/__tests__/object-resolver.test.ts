import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { ObjectResolver } from '../object-resolver.js';
import { TypeResolver } from '../../index.js';
import { TypeResolutionCache } from '../../../../core/cache.js';
import { PluginManager } from '../../../../core/plugin/index.js';
import { GenericContext } from '../../../generic-context.js';
import { TypeKind } from '../../../../core/types.js';

describe('ObjectResolver', () => {
  let project: Project;
  let typeResolver: TypeResolver;
  let objectResolver: ObjectResolver;
  let pluginManager: PluginManager;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });

    const cache = new TypeResolutionCache();
    pluginManager = new PluginManager();

    typeResolver = new TypeResolver({
      maxDepth: 10,
      cache,
      pluginManager,
      project,
    });

    objectResolver = new ObjectResolver(
      (type, depth, context) => typeResolver.resolveType(type, depth, context),
      pluginManager,
    );
  });

  describe('resolveObject', () => {
    it('should resolve simple object types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          name: string;
          age: number;
        }
        const user: User = {} as User;
      `,
      );

      const userType = sourceFile.getVariableDeclarationOrThrow('user').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: userType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.name).toBe('User');
        expect(result.value.properties).toHaveLength(2);
      }
    });

    it('should resolve anonymous object types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const obj: { id: string; count: number } = {} as { id: string; count: number };
      `,
      );

      const objType = sourceFile.getVariableDeclarationOrThrow('obj').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: objType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        // Anonymous objects should not have a name or have __type which gets filtered
        expect(result.value.name).toBeUndefined();
        expect(result.value.properties).toHaveLength(2);
      }
    });

    it('should resolve objects with index signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Dictionary {
          [key: string]: number;
        }
        const dict: Dictionary = {} as Dictionary;
      `,
      );

      const dictType = sourceFile.getVariableDeclarationOrThrow('dict').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: dictType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.indexSignature).toBeDefined();
        expect(result.value.indexSignature?.keyType).toBe('string');
      }
    });

    it('should resolve generic objects with type arguments', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Box<T> {
          value: T;
        }
        const box: Box<string> = {} as Box<string>;
      `,
      );

      const boxType = sourceFile.getVariableDeclarationOrThrow('box').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: boxType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.name).toBe('Box');
        expect(result.value.typeArguments).toBeDefined();
        expect(result.value.typeArguments).toHaveLength(1);
        expect(result.value.typeArguments?.[0]?.kind).toBe(TypeKind.Primitive);
      }
    });

    it('should resolve generic objects with multiple type arguments', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Pair<K, V> {
          key: K;
          value: V;
        }
        const pair: Pair<string, number> = {} as Pair<string, number>;
      `,
      );

      const pairType = sourceFile.getVariableDeclarationOrThrow('pair').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: pairType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.typeArguments).toHaveLength(2);
        expect(result.value.typeArguments?.[0]?.kind).toBe(TypeKind.Primitive);
        expect(result.value.typeArguments?.[1]?.kind).toBe(TypeKind.Primitive);
      }
    });

    it('should include source file path for named types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Named {
          id: string;
        }
        const named: Named = {} as Named;
      `,
      );

      const namedType = sourceFile.getVariableDeclarationOrThrow('named').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: namedType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.sourceFile).toBeDefined();
        expect(result.value.sourceFile).toContain('test.ts');
      }
    });

    it('should resolve type aliases to simple types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type StringAlias = string;
        const alias: StringAlias = '' as StringAlias;
      `,
      );

      const aliasType = sourceFile.getVariableDeclarationOrThrow('alias').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: aliasType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        // String primitive types have built-in properties (toString, charAt, etc.)
        // This is expected behavior in TypeScript
        expect(result.value.properties!.length).toBeGreaterThan(0);
      }
    });

    it('should resolve type aliases to object types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type UserAlias = { name: string; age: number };
        const user: UserAlias = {} as UserAlias;
      `,
      );

      const userType = sourceFile.getVariableDeclarationOrThrow('user').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: userType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(2);
      }
    });

    it('should handle type aliases to interfaces', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Person {
          name: string;
        }
        type PersonAlias = Person;
        const person: PersonAlias = {} as PersonAlias;
      `,
      );

      const personType = sourceFile.getVariableDeclarationOrThrow('person').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: personType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        // Should resolve through the alias to the underlying interface
        expect(result.value.properties).toHaveLength(1);
      }
    });

    it('should not resolve type alias when both have properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Base {
          id: string;
        }
        type Extended = Base & { name: string };
        const extended: Extended = {} as Extended;
      `,
      );

      const extendedType = sourceFile.getVariableDeclarationOrThrow('extended').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: extendedType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        // Should have combined properties from both Base and the extension
        expect(result.value.properties).toHaveLength(2);
      }
    });

    it('should handle empty objects', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Empty {}
        const empty: Empty = {};
      `,
      );

      const emptyType = sourceFile.getVariableDeclarationOrThrow('empty').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: emptyType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(0);
      }
    });

    it('should handle objects with nested types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Nested {
          data: {
            items: string[];
          };
        }
        const nested: Nested = {} as Nested;
      `,
      );

      const nestedType = sourceFile.getVariableDeclarationOrThrow('nested').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: nestedType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(1);
        const dataProp = result.value.properties?.find(p => p.name === 'data');
        expect(dataProp?.type.kind).toBe(TypeKind.Object);
      }
    });

    it('should include unresolved generics when type has generic parameters', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Container<T> {
          value: T;
        }
        type GenericContainer<U> = Container<U>;
        const container: GenericContainer<string> = {} as GenericContainer<string>;
      `,
      );

      const containerType = sourceFile.getVariableDeclarationOrThrow('container').getType();
      // Create context with unresolved generics
      const context = new GenericContext();
      const genericParam = { name: 'U' };
      context.registerGenericParam({ param: genericParam });

      const result = await objectResolver.resolveObject({
        type: containerType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        // Should include information about generics when context has unresolved generics
        expect(result.value.unresolvedGenerics).toBeDefined();
        expect(result.value.unresolvedGenerics).toHaveLength(1);
      }
    });

    it('should handle intersection types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface A {
          propA: string;
        }
        interface B {
          propB: number;
        }
        type C = A & B;
        const c: C = {} as C;
      `,
      );

      const cType = sourceFile.getVariableDeclarationOrThrow('c').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: cType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        // Should include properties from both A and B
        expect(result.value.properties?.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should handle objects with optional properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Config {
          required: string;
          optional?: number;
        }
        const config: Config = {} as Config;
      `,
      );

      const configType = sourceFile.getVariableDeclarationOrThrow('config').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: configType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(2);
      }
    });

    it('should handle objects with readonly properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface ReadonlyProps {
          readonly id: string;
          name: string;
        }
        const readonlyProps: ReadonlyProps = {} as ReadonlyProps;
      `,
      );

      const readonlyType = sourceFile.getVariableDeclarationOrThrow('readonlyProps').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: readonlyType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(2);
      }
    });

    it('should handle objects from Pick utility type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Full {
          id: string;
          name: string;
          age: number;
        }
        type Picked = Pick<Full, 'id' | 'name'>;
        const picked: Picked = {} as Picked;
      `,
      );

      const pickedType = sourceFile.getVariableDeclarationOrThrow('picked').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: pickedType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(2);
        const propNames = result.value.properties?.map((p: { name: string }) => p.name).sort();
        expect(propNames).toEqual(['id', 'name']);
      }
    });

    it('should handle objects from Omit utility type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Full {
          id: string;
          name: string;
          secret: string;
        }
        type Omitted = Omit<Full, 'secret'>;
        const omitted: Omitted = {} as Omitted;
      `,
      );

      const omittedType = sourceFile.getVariableDeclarationOrThrow('omitted').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: omittedType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(2);
        const propNames = result.value.properties?.map((p: { name: string }) => p.name).sort();
        expect(propNames).toEqual(['id', 'name']);
      }
    });

    it('should handle objects from Partial utility type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface RequiredProps {
          id: string;
          name: string;
        }
        type OptionalProps = Partial<RequiredProps>;
        const optionalProps: OptionalProps = {};
      `,
      );

      const optionalType = sourceFile.getVariableDeclarationOrThrow('optionalProps').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: optionalType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        // Partial<T> may expand to an empty object with type arguments
        // or may have the properties directly depending on TypeScript version
        if (result.value.properties && result.value.properties.length > 0) {
          // All properties should be optional
          expect(result.value.properties.every((p: { optional?: boolean }) => p.optional)).toBe(
            true,
          );
        }
      }
    });

    it('should handle objects with complex generic constraints', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Constrained<T extends { id: string }> {
          data: T;
        }
        const constrained: Constrained<{ id: string; name: string }> = {} as Constrained<{ id: string; name: string }>;
      `,
      );

      const constrainedType = sourceFile.getVariableDeclarationOrThrow('constrained').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: constrainedType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(1);
        expect(result.value.typeArguments).toBeDefined();
      }
    });

    it('should handle objects without symbols', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const obj = { x: 1, y: 2 };
        const typed: typeof obj = obj;
      `,
      );

      const typedType = sourceFile.getVariableDeclarationOrThrow('typed').getType();
      const context = new GenericContext();
      const result = await objectResolver.resolveObject({
        type: typedType,
        depth: 0,
        context,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value.kind === TypeKind.Object) {
        expect(result.value.properties).toHaveLength(2);
      }
    });
  });
});
