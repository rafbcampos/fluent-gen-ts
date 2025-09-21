import { test, expect, describe, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { TypeResolver } from '../resolver.js';
import { TypeResolutionCache } from '../../core/cache.js';
import { PluginManager } from '../../core/plugin.js';
import { GenericContext } from '../generic-context.js';
import { TypeKind } from '../../core/types.js';

describe('TypeResolver', () => {
  let project: Project;
  let resolver: TypeResolver;
  let cache: TypeResolutionCache;
  let pluginManager: PluginManager;

  beforeEach(() => {
    project = new Project({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: true,
    });

    cache = new TypeResolutionCache();
    pluginManager = new PluginManager();

    resolver = new TypeResolver({
      maxDepth: 10,
      cache,
      pluginManager,
      project,
    });
  });

  describe('constructor', () => {
    test('creates resolver with default options', () => {
      const defaultResolver = new TypeResolver();
      expect(defaultResolver).toBeDefined();
      expect(defaultResolver.getGenericContext()).toBeDefined();
    });

    test('creates resolver with custom options', () => {
      const customResolver = new TypeResolver({
        maxDepth: 5,
        cache: new TypeResolutionCache(),
        pluginManager: new PluginManager(),
        expandUtilityTypes: false,
        resolveMappedTypes: false,
        resolveConditionalTypes: false,
        resolveTemplateLiterals: false,
      });
      expect(customResolver).toBeDefined();
    });
  });

  describe('primitive type resolution', () => {
    test('resolves string type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: string = "hello";
      `,
      );

      const stringType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(stringType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'string',
        });
      }
    });

    test('resolves number type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: number = 42;
      `,
      );

      const numberType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(numberType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'number',
        });
      }
    });

    test('resolves boolean type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: boolean = true;
      `,
      );

      const booleanType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(booleanType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'boolean',
        });
      }
    });

    test('resolves undefined type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: undefined = undefined;
      `,
      );

      const undefinedType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(undefinedType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'undefined',
        });
      }
    });

    test('resolves null type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: null = null;
      `,
      );

      const nullType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(nullType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Primitive,
          name: 'null',
        });
      }
    });
  });

  describe('literal type resolution', () => {
    test('resolves string literal type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: "hello" = "hello";
      `,
      );

      const literalType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(literalType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Literal,
          literal: 'hello',
        });
      }
    });

    test('resolves number literal type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: 42 = 42;
      `,
      );

      const literalType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(literalType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Literal,
          literal: 42,
        });
      }
    });

    test('resolves boolean literal type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: true = true;
      `,
      );

      const literalType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(literalType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Literal,
          literal: true,
        });
      }
    });
  });

  describe('array type resolution', () => {
    test('resolves string array type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: string[] = ["hello", "world"];
      `,
      );

      const arrayType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(arrayType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Array,
          elementType: {
            kind: TypeKind.Primitive,
            name: 'string',
          },
        });
      }
    });

    test('resolves nested array type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: number[][] = [[1, 2], [3, 4]];
      `,
      );

      const arrayType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(arrayType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          kind: TypeKind.Array,
          elementType: {
            kind: TypeKind.Array,
            elementType: {
              kind: TypeKind.Primitive,
              name: 'number',
            },
          },
        });
      }
    });
  });

  describe('union type resolution', () => {
    test('resolves simple union type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: string | number = "hello";
      `,
      );

      const unionType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(unionType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          expect(result.value.unionTypes).toHaveLength(2);
          expect(result.value.unionTypes).toContainEqual({
            kind: TypeKind.Primitive,
            name: 'string',
          });
          expect(result.value.unionTypes).toContainEqual({
            kind: TypeKind.Primitive,
            name: 'number',
          });
        }
      }
    });

    test('resolves complex union type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: string | number | boolean | null = null;
      `,
      );

      const unionType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(unionType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Union);
        if (result.value.kind === TypeKind.Union) {
          // TypeScript expands boolean to true | false, so we expect 5 types
          expect(result.value.unionTypes).toHaveLength(5);
          // Verify the types are correct
          const typeNames = result.value.unionTypes.map(t => {
            if (t.kind === TypeKind.Literal) {
              return String(t.literal);
            }
            if ('name' in t) {
              return t.name;
            }
            return t.kind;
          });
          expect(typeNames).toContain('string');
          expect(typeNames).toContain('number');
          expect(typeNames).toContain('null');
          expect(typeNames).toContain('true');
          expect(typeNames).toContain('false');
        }
      }
    });
  });

  describe('intersection type resolution', () => {
    test('resolves intersection type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface A { a: string; }
        interface B { b: number; }
        const value: A & B = { a: "hello", b: 42 };
      `,
      );

      const intersectionType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(intersectionType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Intersection);
        if (result.value.kind === TypeKind.Intersection) {
          expect(result.value.intersectionTypes).toHaveLength(2);
        }
      }
    });
  });

  describe('tuple type resolution', () => {
    test('resolves tuple type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        const value: [string, number, boolean] = ["hello", 42, true];
      `,
      );

      const tupleType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(tupleType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Tuple);
        if (result.value.kind === TypeKind.Tuple) {
          expect(result.value.elements).toHaveLength(3);
          expect(result.value.elements[0]).toEqual({
            kind: TypeKind.Primitive,
            name: 'string',
          });
          expect(result.value.elements[1]).toEqual({
            kind: TypeKind.Primitive,
            name: 'number',
          });
          expect(result.value.elements[2]).toEqual({
            kind: TypeKind.Primitive,
            name: 'boolean',
          });
        }
      }
    });
  });

  describe('object/interface type resolution', () => {
    test('resolves simple interface', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          id: string;
          name: string;
          age: number;
        }
        const value: User = { id: "1", name: "John", age: 30 };
      `,
      );

      const interfaceType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(interfaceType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.name).toBe('User');
          expect(result.value.properties).toHaveLength(3);

          const idProp = result.value.properties.find(p => p.name === 'id');
          expect(idProp).toBeDefined();
          expect(idProp?.type).toEqual({
            kind: TypeKind.Primitive,
            name: 'string',
          });
          expect(idProp?.optional).toBe(false);
          expect(idProp?.readonly).toBe(false);
        }
      }
    });

    test('resolves interface with optional properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          id: string;
          name: string;
          age?: number;
          email?: string;
        }
        const value: User = { id: "1", name: "John" };
      `,
      );

      const interfaceType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(interfaceType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          const ageProp = result.value.properties.find(p => p.name === 'age');
          const emailProp = result.value.properties.find(p => p.name === 'email');

          expect(ageProp?.optional).toBe(true);
          expect(emailProp?.optional).toBe(true);

          const idProp = result.value.properties.find(p => p.name === 'id');
          expect(idProp?.optional).toBe(false);
        }
      }
    });

    test('resolves interface with readonly properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          readonly id: string;
          name: string;
          readonly createdAt: Date;
        }
        const value: User = { id: "1", name: "John", createdAt: new Date() };
      `,
      );

      const interfaceType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(interfaceType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          const idProp = result.value.properties.find(p => p.name === 'id');
          const nameProp = result.value.properties.find(p => p.name === 'name');
          const createdAtProp = result.value.properties.find(p => p.name === 'createdAt');

          expect(idProp?.readonly).toBe(true);
          expect(nameProp?.readonly).toBe(false);
          expect(createdAtProp?.readonly).toBe(true);
        }
      }
    });

    test('resolves nested object structure', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Address {
          street: string;
          city: string;
        }

        interface User {
          id: string;
          address: Address;
        }

        const value: User = {
          id: "1",
          address: { street: "123 Main St", city: "Anytown" }
        };
      `,
      );

      const userType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(userType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          const addressProp = result.value.properties.find(p => p.name === 'address');
          expect(addressProp).toBeDefined();
          expect(addressProp?.type.kind).toBe(TypeKind.Object);

          if (addressProp?.type.kind === TypeKind.Object) {
            expect(addressProp.type.name).toBe('Address');
            expect(addressProp.type.properties).toHaveLength(2);
          }
        }
      }
    });
  });

  describe('enum type resolution', () => {
    test('resolves enum type', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        enum Color {
          Red = "red",
          Green = "green",
          Blue = "blue"
        }
        const value: Color = Color.Red;
      `,
      );

      const enumType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(enumType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Enum);
        if (result.value.kind === TypeKind.Enum) {
          expect(result.value.name).toBe('Color');
        }
      }
    });
  });

  describe('generic type resolution', () => {
    test('resolves generic interface with type parameters', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Container<T> {
          value: T;
        }
        const value: Container<string> = { value: "hello" };
      `,
      );

      const containerType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(containerType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.name).toBe('Container');
          const valueProp = result.value.properties.find(p => p.name === 'value');
          expect(valueProp?.type).toEqual({
            kind: TypeKind.Primitive,
            name: 'string',
          });
        }
      }
    });

    test('resolves generic interface with unresolved type parameters', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Container<T> {
          value: T;
        }
      `,
      );

      const containerInterface = sourceFile.getInterfaceOrThrow('Container');
      const containerType = containerInterface.getType();
      const result = await resolver.resolveType(containerType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.genericParams).toBeDefined();
          expect(result.value.genericParams?.length).toBeGreaterThan(0);
        }
      }
    });

    test('resolves generic with constraints', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Identifiable {
          id: string;
        }

        interface Container<T extends Identifiable> {
          item: T;
        }
      `,
      );

      const containerInterface = sourceFile.getInterfaceOrThrow('Container');
      const containerType = containerInterface.getType();
      const result = await resolver.resolveType(containerType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.genericParams).toBeDefined();
          const genericParam = result.value.genericParams?.[0];
          expect(genericParam?.name).toBe('T');
          expect(genericParam?.constraint).toBeDefined();
        }
      }
    });

    test('resolves generic with default types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Container<T = string> {
          value: T;
        }
      `,
      );

      const containerInterface = sourceFile.getInterfaceOrThrow('Container');
      const containerType = containerInterface.getType();
      const result = await resolver.resolveType(containerType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.genericParams).toBeDefined();
          const genericParam = result.value.genericParams?.[0];
          expect(genericParam?.name).toBe('T');
          expect(genericParam?.default).toBeDefined();
        }
      }
    });
  });

  describe('type alias resolution', () => {
    test('resolves type alias to object', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type User = {
          id: string;
          name: string;
        };
        const value: User = { id: "1", name: "John" };
      `,
      );

      const userType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(userType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.properties).toHaveLength(2);
        }
      }
    });

    test('resolves type alias to union', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type StringOrNumber = string | number;
        const value: StringOrNumber = "hello";
      `,
      );

      const aliasType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(aliasType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Union);
      }
    });
  });

  describe('index signatures', () => {
    test('resolves string index signature', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface StringMap {
          [key: string]: number;
        }
        const value: StringMap = { a: 1, b: 2 };
      `,
      );

      const mapType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(mapType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.indexSignature).toBeDefined();
          expect(result.value.indexSignature?.keyType).toBe('string');
          expect(result.value.indexSignature?.valueType).toEqual({
            kind: TypeKind.Primitive,
            name: 'number',
          });
        }
      }
    });

    test('resolves readonly index signature', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface ReadonlyStringMap {
          readonly [key: string]: number;
        }
        const value: ReadonlyStringMap = { a: 1, b: 2 };
      `,
      );

      const mapType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(mapType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          expect(result.value.indexSignature).toBeDefined();
          expect(result.value.indexSignature?.readonly).toBe(true);
        }
      }
    });
  });

  describe('error handling', () => {
    test('handles max depth exceeded', async () => {
      const shallowResolver = new TypeResolver({ maxDepth: 1 });

      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Deep {
          level1: {
            level2: {
              level3: string;
            };
          };
        }
        const value: Deep = { level1: { level2: { level3: "deep" } } };
      `,
      );

      const deepType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await shallowResolver.resolveType(deepType);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Max resolution depth');
      }
    });

    test('handles circular references', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface TreeNode {
          value: string;
          parent?: TreeNode;
          children: TreeNode[];
        }
        const value: TreeNode = {
          value: "root",
          children: []
        };
      `,
      );

      const nodeType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(nodeType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
      }
    });
  });

  describe('caching behavior', () => {
    test('uses cache for repeated type resolution', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          id: string;
          name: string;
        }
        const user1: User = { id: "1", name: "John" };
        const user2: User = { id: "2", name: "Jane" };
      `,
      );

      const user1Type = sourceFile.getVariableDeclarationOrThrow('user1').getType();
      const user2Type = sourceFile.getVariableDeclarationOrThrow('user2').getType();

      const result1 = await resolver.resolveType(user1Type);
      const result2 = await resolver.resolveType(user2Type);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      // Both should resolve to the same structure since they're the same type
      if (result1.ok && result2.ok) {
        expect(result1.value).toEqual(result2.value);
      }
    });

    test('cache can be cleared', () => {
      resolver.clearVisited();
      expect(() => resolver.clearVisited()).not.toThrow();
    });
  });

  describe('generic context management', () => {
    test('can access generic context', () => {
      const context = resolver.getGenericContext();
      expect(context).toBeInstanceOf(GenericContext);
    });

    test('can reset generic context', () => {
      const originalContext = resolver.getGenericContext();
      resolver.resetGenericContext();
      const newContext = resolver.getGenericContext();

      expect(newContext).toBeInstanceOf(GenericContext);
      expect(newContext).not.toBe(originalContext);
    });

    test('resolves with custom generic context', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Container<T> {
          value: T;
        }
      `,
      );

      const containerInterface = sourceFile.getInterfaceOrThrow('Container');
      const containerType = containerInterface.getType();

      const customContext = new GenericContext();
      const result = await resolver.resolveType(containerType, 0, customContext);

      expect(result.ok).toBe(true);
    });
  });

  describe('JSDoc preservation', () => {
    test('preserves JSDoc comments on properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          /** The unique identifier for the user */
          id: string;
          /** The user's full name */
          name: string;
          /** The user's age in years */
          age: number;
        }
        const value: User = { id: "1", name: "John", age: 30 };
      `,
      );

      const userType = sourceFile.getVariableDeclarationOrThrow('value').getType();
      const result = await resolver.resolveType(userType);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe(TypeKind.Object);
        if (result.value.kind === TypeKind.Object) {
          const idProp = result.value.properties.find(p => p.name === 'id');
          const nameProp = result.value.properties.find(p => p.name === 'name');
          const ageProp = result.value.properties.find(p => p.name === 'age');

          expect(idProp?.jsDoc).toBe('The unique identifier for the user');
          expect(nameProp?.jsDoc).toBe("The user's full name");
          expect(ageProp?.jsDoc).toBe("The user's age in years");
        }
      }
    });
  });
});
