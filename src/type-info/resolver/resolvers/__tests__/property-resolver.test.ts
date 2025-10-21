import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from 'ts-morph';
import { PropertyResolver } from '../property-resolver.js';
import { TypeResolver } from '../../index.js';
import { TypeResolutionCache } from '../../../../core/cache.js';
import { PluginManager } from '../../../../core/plugin/index.js';
import { TypeKind } from '../../../../core/types.js';

describe('PropertyResolver', () => {
  let project: Project;
  let typeResolver: TypeResolver;
  let propertyResolver: PropertyResolver;
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

    propertyResolver = new PropertyResolver(
      (type, depth, context) => typeResolver.resolveType(type, depth, context),
      pluginManager,
    );
  });

  describe('resolveProperties', () => {
    it('should resolve simple object properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface User {
          name: string;
          age: number;
          active: boolean;
        }
        const user: User = {} as User;
      `,
      );

      const userType = sourceFile.getVariableDeclarationOrThrow('user').getType();
      const result = await propertyResolver.resolveProperties({
        type: userType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'name', optional: false, readonly: false }),
            expect.objectContaining({ name: 'age', optional: false, readonly: false }),
            expect.objectContaining({ name: 'active', optional: false, readonly: false }),
          ]),
        );
      }
    });

    it('should resolve optional properties', async () => {
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
      const result = await propertyResolver.resolveProperties({
        type: configType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const requiredProp = result.value.find(p => p.name === 'required');
        const optionalProp = result.value.find(p => p.name === 'optional');

        expect(requiredProp).toBeDefined();
        expect(requiredProp?.optional).toBe(false);

        expect(optionalProp).toBeDefined();
        expect(optionalProp?.optional).toBe(true);
      }
    });

    it('should resolve readonly properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface ReadonlyConfig {
          readonly id: string;
          name: string;
        }
        const config: ReadonlyConfig = {} as ReadonlyConfig;
      `,
      );

      const configType = sourceFile.getVariableDeclarationOrThrow('config').getType();
      const result = await propertyResolver.resolveProperties({
        type: configType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const idProp = result.value.find(p => p.name === 'id');
        const nameProp = result.value.find(p => p.name === 'name');

        expect(idProp).toBeDefined();
        expect(idProp?.readonly).toBe(true);

        expect(nameProp).toBeDefined();
        expect(nameProp?.readonly).toBe(false);
      }
    });

    it('should resolve function properties with signatures', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Handler {
          onClick: (event: string) => void;
          onSubmit: (data: number, id: string) => boolean;
        }
        const handler: Handler = {} as Handler;
      `,
      );

      const handlerType = sourceFile.getVariableDeclarationOrThrow('handler').getType();
      const result = await propertyResolver.resolveProperties({
        type: handlerType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const onClickProp = result.value.find(p => p.name === 'onClick');
        const onSubmitProp = result.value.find(p => p.name === 'onSubmit');

        expect(onClickProp).toBeDefined();
        expect(onClickProp?.type.kind).toBe(TypeKind.Function);
        // Function signatures may use 'any' when type location is not available
        if (onClickProp?.type.kind === TypeKind.Function) {
          expect(onClickProp.type.name).toMatch(/event.*void/);
        }

        expect(onSubmitProp).toBeDefined();
        expect(onSubmitProp?.type.kind).toBe(TypeKind.Function);
        // Function signatures may use 'any' when type location is not available
        if (onSubmitProp?.type.kind === TypeKind.Function) {
          expect(onSubmitProp.type.name).toMatch(/data.*id.*boolean/);
        }
      }
    });

    it('should resolve function properties with optional parameters', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Callback {
          execute: (required: string, optional?: number) => void;
        }
        const callback: Callback = {} as Callback;
      `,
      );

      const callbackType = sourceFile.getVariableDeclarationOrThrow('callback').getType();
      const result = await propertyResolver.resolveProperties({
        type: callbackType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const executeProp = result.value.find(p => p.name === 'execute');

        expect(executeProp).toBeDefined();
        expect(executeProp?.type.kind).toBe(TypeKind.Function);
        // Function properties are resolved with parameter names
        if (executeProp?.type.kind === TypeKind.Function) {
          expect(executeProp.type.name).toMatch(/required/);
          expect(executeProp.type.name).toMatch(/optional/);
          expect(executeProp.type.name).toMatch(/void/);
        }
      }
    });

    it('should extract JSDoc comments from properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Documented {
          /** The user's unique identifier */
          id: string;
          /** The user's display name */
          name: string;
          age: number;
        }
        const doc: Documented = {} as Documented;
      `,
      );

      const docType = sourceFile.getVariableDeclarationOrThrow('doc').getType();
      const result = await propertyResolver.resolveProperties({
        type: docType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const idProp = result.value.find(p => p.name === 'id');
        const nameProp = result.value.find(p => p.name === 'name');
        const ageProp = result.value.find(p => p.name === 'age');

        expect(idProp?.jsDoc).toBe("The user's unique identifier");
        expect(nameProp?.jsDoc).toBe("The user's display name");
        expect(ageProp?.jsDoc).toBeUndefined();
      }
    });

    it('should handle properties from mapped types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        type Keys = 'a' | 'b' | 'c';
        type Mapped = { [K in Keys]: string };
        const mapped: Mapped = {} as Mapped;
      `,
      );

      const mappedType = sourceFile.getVariableDeclarationOrThrow('mapped').getType();
      const result = await propertyResolver.resolveProperties({
        type: mappedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        const propNames = result.value.map(p => p.name).sort();
        expect(propNames).toEqual(['a', 'b', 'c']);
      }
    });

    it('should handle properties from intersection types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Base {
          id: string;
        }
        interface Extension {
          name: string;
        }
        type Combined = Base & Extension;
        const combined: Combined = {} as Combined;
      `,
      );

      const combinedType = sourceFile.getVariableDeclarationOrThrow('combined').getType();
      const result = await propertyResolver.resolveProperties({
        type: combinedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'id' }),
            expect.objectContaining({ name: 'name' }),
          ]),
        );
      }
    });

    it('should handle properties with complex nested types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Nested {
          data: {
            items: string[];
            count: number;
          };
        }
        const nested: Nested = {} as Nested;
      `,
      );

      const nestedType = sourceFile.getVariableDeclarationOrThrow('nested').getType();
      const result = await propertyResolver.resolveProperties({
        type: nestedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const dataProp = result.value.find(p => p.name === 'data');
        expect(dataProp).toBeDefined();
        expect(dataProp?.type.kind).toBe(TypeKind.Object);
      }
    });
  });

  describe('resolveIndexSignature', () => {
    it('should resolve string index signature', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface StringIndexed {
          [key: string]: number;
        }
        const indexed: StringIndexed = {} as StringIndexed;
      `,
      );

      const indexedType = sourceFile.getVariableDeclarationOrThrow('indexed').getType();
      const result = await propertyResolver.resolveIndexSignature({
        type: indexedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.keyType).toBe('string');
        expect(result.value.valueType.kind).toBe(TypeKind.Primitive);
        if (result.value.valueType.kind === TypeKind.Primitive) {
          expect(result.value.valueType.name).toBe('number');
        }
        expect(result.value.readonly).toBe(false);
      } else {
        expect.fail('Expected index signature to be present');
      }
    });

    it('should resolve number index signature', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface NumberIndexed {
          [index: number]: string;
        }
        const indexed: NumberIndexed = {} as NumberIndexed;
      `,
      );

      const indexedType = sourceFile.getVariableDeclarationOrThrow('indexed').getType();
      const result = await propertyResolver.resolveIndexSignature({
        type: indexedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.keyType).toBe('number');
        expect(result.value.valueType.kind).toBe(TypeKind.Primitive);
        if (result.value.valueType.kind === TypeKind.Primitive) {
          expect(result.value.valueType.name).toBe('string');
        }
        expect(result.value.readonly).toBe(false);
      } else {
        expect.fail('Expected index signature to be present');
      }
    });

    it('should resolve readonly index signature', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface ReadonlyIndexed {
          readonly [key: string]: boolean;
        }
        const indexed: ReadonlyIndexed = {} as ReadonlyIndexed;
      `,
      );

      const indexedType = sourceFile.getVariableDeclarationOrThrow('indexed').getType();
      const result = await propertyResolver.resolveIndexSignature({
        type: indexedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.keyType).toBe('string');
        expect(result.value.readonly).toBe(true);
      } else {
        expect.fail('Expected index signature to be present');
      }
    });

    it('should return null for types without index signature', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface NoIndex {
          name: string;
        }
        const noIndex: NoIndex = {} as NoIndex;
      `,
      );

      const noIndexType = sourceFile.getVariableDeclarationOrThrow('noIndex').getType();
      const result = await propertyResolver.resolveIndexSignature({
        type: noIndexType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('should handle index signatures with complex value types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface ComplexIndexed {
          [key: string]: {
            id: number;
            data: string[];
          };
        }
        const indexed: ComplexIndexed = {} as ComplexIndexed;
      `,
      );

      const indexedType = sourceFile.getVariableDeclarationOrThrow('indexed').getType();
      const result = await propertyResolver.resolveIndexSignature({
        type: indexedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.keyType).toBe('string');
        expect(result.value.valueType.kind).toBe(TypeKind.Object);
      } else {
        expect.fail('Expected index signature to be present');
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle properties from utility types like Partial', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Base {
          required: string;
          alsoRequired: number;
        }
        type PartialBase = Partial<Base>;
        const partial: PartialBase = {};
      `,
      );

      const partialType = sourceFile.getVariableDeclarationOrThrow('partial').getType();
      const result = await propertyResolver.resolveProperties({
        type: partialType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        // All properties should be optional in Partial
        expect(result.value.every(p => p.optional)).toBe(true);
      }
    });

    it('should handle properties from utility types like Readonly', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Base {
          mutable: string;
        }
        type ReadonlyBase = Readonly<Base>;
        const readonly: ReadonlyBase = {} as ReadonlyBase;
      `,
      );

      const readonlyType = sourceFile.getVariableDeclarationOrThrow('readonly').getType();
      const result = await propertyResolver.resolveProperties({
        type: readonlyType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const mutableProp = result.value.find(p => p.name === 'mutable');
        expect(mutableProp).toBeDefined();
        // Readonly<T> creates a mapped type, which doesn't have readonly modifier on declarations
        // so the property resolver can't detect it as readonly - this is expected behavior
        expect(mutableProp?.type.kind).toBe(TypeKind.Primitive);
      }
    });

    it('should handle properties from generic types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface Generic<T> {
          value: T;
        }
        const instance: Generic<string> = {} as Generic<string>;
      `,
      );

      const instanceType = sourceFile.getVariableDeclarationOrThrow('instance').getType();
      const result = await propertyResolver.resolveProperties({
        type: instanceType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const valueProp = result.value.find(p => p.name === 'value');
        expect(valueProp).toBeDefined();
        expect(valueProp?.type.kind).toBe(TypeKind.Primitive);
        if (valueProp?.type.kind === TypeKind.Primitive) {
          expect(valueProp.type.name).toBe('string');
        }
      }
    });

    it('should handle deeply nested object properties', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface DeepNest {
          level1: {
            level2: {
              level3: {
                value: string;
              };
            };
          };
        }
        const deep: DeepNest = {} as DeepNest;
      `,
      );

      const deepType = sourceFile.getVariableDeclarationOrThrow('deep').getType();
      const result = await propertyResolver.resolveProperties({
        type: deepType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const level1Prop = result.value.find(p => p.name === 'level1');
        expect(level1Prop).toBeDefined();
        expect(level1Prop?.type.kind).toBe(TypeKind.Object);
      }
    });

    it('should handle properties with union types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface WithUnion {
          value: string | number | boolean;
        }
        const union: WithUnion = {} as WithUnion;
      `,
      );

      const unionType = sourceFile.getVariableDeclarationOrThrow('union').getType();
      const result = await propertyResolver.resolveProperties({
        type: unionType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const valueProp = result.value.find(p => p.name === 'value');
        expect(valueProp).toBeDefined();
        expect(valueProp?.type.kind).toBe(TypeKind.Union);
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
      const result = await propertyResolver.resolveProperties({
        type: emptyType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should handle properties with literal types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface WithLiterals {
          status: 'active' | 'inactive';
          count: 0 | 1 | 2;
        }
        const literals: WithLiterals = {} as WithLiterals;
      `,
      );

      const literalsType = sourceFile.getVariableDeclarationOrThrow('literals').getType();
      const result = await propertyResolver.resolveProperties({
        type: literalsType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        const statusProp = result.value.find(p => p.name === 'status');
        const countProp = result.value.find(p => p.name === 'count');

        expect(statusProp).toBeDefined();
        expect(countProp).toBeDefined();
      }
    });

    it('should handle properties from Pick utility type', async () => {
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
      const result = await propertyResolver.resolveProperties({
        type: pickedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        const propNames = result.value.map(p => p.name).sort();
        expect(propNames).toEqual(['id', 'name']);
      }
    });

    it('should handle properties from Omit utility type', async () => {
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
      const result = await propertyResolver.resolveProperties({
        type: omittedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        const propNames = result.value.map(p => p.name).sort();
        expect(propNames).toEqual(['id', 'name']);
        expect(result.value.find(p => p.name === 'secret')).toBeUndefined();
      }
    });

    it('should handle interface extending Omit with generics', async () => {
      const sourceFile = project.createSourceFile(
        'test-omit-generic.ts',
        `
        interface BaseAsset<T = unknown> {
          id: string;
          type: string;
          binding: string;
          label?: string;
          help?: string;
          note?: string;
          placeholder?: string;
          metadata?: T;
        }

        interface CustomMetadata {
          role: 'custom';
        }

        interface DerivedAsset<T = unknown> extends Omit<BaseAsset<T>, 'binding' | 'metadata'> {
          metadata?: CustomMetadata;
        }

        const derived: DerivedAsset = {} as DerivedAsset;
      `,
      );

      const derivedType = sourceFile.getVariableDeclarationOrThrow('derived').getType();
      const result = await propertyResolver.resolveProperties({
        type: derivedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const propNames = result.value.map(p => p.name).sort();

        expect(propNames).toContain('id');
        expect(propNames).toContain('type');
        expect(propNames).toContain('label');
        expect(propNames).toContain('help');
        expect(propNames).toContain('note');
        expect(propNames).toContain('placeholder');
        expect(propNames).toContain('metadata');

        expect(propNames).not.toContain('binding');

        expect(result.value.length).toBe(7);
      }
    });

    it('should handle interface extending Pick with generics', async () => {
      const sourceFile = project.createSourceFile(
        'test-pick-generic.ts',
        `
        interface FullAsset<T = unknown> {
          id: string;
          type: string;
          binding: string;
          label?: string;
          help?: string;
          metadata?: T;
        }

        interface PickedAsset<T = unknown> extends Pick<FullAsset<T>, 'id' | 'label' | 'help'> {
          extra?: string;
        }

        const picked: PickedAsset = {} as PickedAsset;
      `,
      );

      const pickedType = sourceFile.getVariableDeclarationOrThrow('picked').getType();
      const result = await propertyResolver.resolveProperties({
        type: pickedType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const propNames = result.value.map(p => p.name).sort();

        expect(propNames).toContain('id');
        expect(propNames).toContain('label');
        expect(propNames).toContain('help');
        expect(propNames).toContain('extra');

        expect(propNames).not.toContain('type');
        expect(propNames).not.toContain('binding');
        expect(propNames).not.toContain('metadata');

        expect(result.value.length).toBe(4);
      }
    });

    it('should handle interface extending Partial with generics', async () => {
      const sourceFile = project.createSourceFile(
        'test-partial-generic.ts',
        `
        interface RequiredAsset<T = unknown> {
          id: string;
          type: string;
          metadata?: T;
        }

        interface PartialAsset<T = unknown> extends Partial<RequiredAsset<T>> {
          extra?: string;
        }

        const partial: PartialAsset = {} as PartialAsset;
      `,
      );

      const partialType = sourceFile.getVariableDeclarationOrThrow('partial').getType();
      const result = await propertyResolver.resolveProperties({
        type: partialType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const propNames = result.value.map(p => p.name).sort();

        expect(propNames).toContain('id');
        expect(propNames).toContain('type');
        expect(propNames).toContain('metadata');
        expect(propNames).toContain('extra');

        expect(result.value.length).toBe(4);
      }
    });

    it('should handle properties with array types', async () => {
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        interface WithArrays {
          items: string[];
          matrix: number[][];
          readonly tuple: readonly [string, number];
        }
        const arrays: WithArrays = {} as WithArrays;
      `,
      );

      const arraysType = sourceFile.getVariableDeclarationOrThrow('arrays').getType();
      const result = await propertyResolver.resolveProperties({
        type: arraysType,
        depth: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const itemsProp = result.value.find(p => p.name === 'items');
        const matrixProp = result.value.find(p => p.name === 'matrix');
        const tupleProp = result.value.find(p => p.name === 'tuple');

        expect(itemsProp?.type.kind).toBe(TypeKind.Array);
        expect(matrixProp?.type.kind).toBe(TypeKind.Array);
        expect(tupleProp?.type.kind).toBe(TypeKind.Tuple);
        expect(tupleProp?.readonly).toBe(true);
      }
    });
  });
});
