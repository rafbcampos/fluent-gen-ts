import { describe, test, expect } from 'vitest';
import {
  HookType,
  type Plugin,
  type PluginImports,
  type InternalImport,
  type ExternalImport,
  type ParseContext,
  type ResolveContext,
  type PropertyMethodContext,
  type BuilderContext,
  type ValueContext,
  type PropertyMethodTransform,
  type CustomMethod,
  type ValueTransform,
  type TypeMatcher,
  type ObjectTypeMatcher,
  type ArrayTypeMatcher,
  type UnionTypeMatcher,
  type IntersectionTypeMatcher,
  type PropertyMethodTransformRule,
  type BuildMethodTransformation,
  type CustomMethodDefinition,
  type MethodParameter,
  type PathMappingRule,
  type RelativeToMonorepoMapping,
} from '../plugin-types.js';
import { ok } from '../../result.js';
import { TypeKind } from '../../types.js';

describe('Plugin Types', () => {
  describe('HookType constants', () => {
    test('should have all expected hook types', () => {
      expect(HookType.BeforeParse).toBe('beforeParse');
      expect(HookType.AfterParse).toBe('afterParse');
      expect(HookType.BeforeResolve).toBe('beforeResolve');
      expect(HookType.AfterResolve).toBe('afterResolve');
      expect(HookType.BeforeGenerate).toBe('beforeGenerate');
      expect(HookType.AfterGenerate).toBe('afterGenerate');
      expect(HookType.TransformType).toBe('transformType');
      expect(HookType.TransformProperty).toBe('transformProperty');
      expect(HookType.TransformBuildMethod).toBe('transformBuildMethod');
      expect(HookType.TransformPropertyMethod).toBe('transformPropertyMethod');
      expect(HookType.AddCustomMethods).toBe('addCustomMethods');
      expect(HookType.TransformValue).toBe('transformValue');
      expect(HookType.TransformImports).toBe('transformImports');
    });

    test('should be readonly constants', () => {
      const hookType = HookType.BeforeParse;
      expect(hookType).toBe('beforeParse');

      // Verify it's a const assertion by checking the type narrowing works
      const allHookTypes = Object.values(HookType);
      expect(allHookTypes).toContain('beforeParse');
      expect(allHookTypes).toContain('transformImports');
    });
  });

  describe('Import Types', () => {
    describe('InternalImport', () => {
      test('should accept valid internal import', () => {
        const internalImport: InternalImport = {
          kind: 'internal',
          path: '../types.js',
          imports: ['User', 'Address'],
        };

        expect(internalImport.kind).toBe('internal');
        expect(internalImport.path).toBe('../types.js');
        expect(internalImport.imports).toEqual(['User', 'Address']);
      });

      test('should accept internal import with optional properties', () => {
        const internalImport: InternalImport = {
          kind: 'internal',
          path: '../types.js',
          imports: ['User'],
          isTypeOnly: true,
          isDefault: false,
          defaultName: 'UserType',
        };

        expect(internalImport.isTypeOnly).toBe(true);
        expect(internalImport.isDefault).toBe(false);
        expect(internalImport.defaultName).toBe('UserType');
      });
    });

    describe('ExternalImport', () => {
      test('should accept valid external import', () => {
        const externalImport: ExternalImport = {
          kind: 'external',
          package: '@my-org/pkg',
          imports: ['Asset', 'Flow'],
        };

        expect(externalImport.kind).toBe('external');
        expect(externalImport.package).toBe('@my-org/pkg');
        expect(externalImport.imports).toEqual(['Asset', 'Flow']);
      });

      test('should accept external import with optional properties', () => {
        const externalImport: ExternalImport = {
          kind: 'external',
          package: 'lodash',
          imports: ['merge'],
          isTypeOnly: false,
          isDefault: true,
          defaultName: 'merge',
        };

        expect(externalImport.isTypeOnly).toBe(false);
        expect(externalImport.isDefault).toBe(true);
        expect(externalImport.defaultName).toBe('merge');
      });
    });

    describe('PluginImports', () => {
      test('should accept empty imports array', () => {
        const pluginImports: PluginImports = {
          imports: [],
        };

        expect(pluginImports.imports).toHaveLength(0);
      });

      test('should accept mixed internal and external imports', () => {
        const pluginImports: PluginImports = {
          imports: [
            {
              kind: 'internal',
              path: '../types.js',
              imports: ['User'],
            },
            {
              kind: 'external',
              package: 'lodash',
              imports: ['merge'],
            },
          ],
        };

        expect(pluginImports.imports).toHaveLength(2);
        expect(pluginImports.imports[0]!.kind).toBe('internal');
        expect(pluginImports.imports[1]!.kind).toBe('external');
      });
    });
  });

  describe('Context Types', () => {
    describe('ParseContext', () => {
      test('should accept valid parse context', () => {
        const context: ParseContext = {
          sourceFile: '/path/to/file.ts',
          typeName: 'User',
        };

        expect(context.sourceFile).toBe('/path/to/file.ts');
        expect(context.typeName).toBe('User');
      });
    });

    describe('ResolveContext', () => {
      test('should accept minimal resolve context', () => {
        const mockType = {} as any; // Mock Type object for test
        const context: ResolveContext = {
          type: mockType,
        };

        expect(context.type).toBe(mockType);
      });

      test('should accept full resolve context', () => {
        const mockType = {} as any;
        const mockSymbol = {} as any;
        const context: ResolveContext = {
          type: mockType,
          symbol: mockSymbol,
          sourceFile: '/path/to/file.ts',
          typeName: 'User',
        };

        expect(context.type).toBe(mockType);
        expect(context.symbol).toBe(mockSymbol);
        expect(context.sourceFile).toBe('/path/to/file.ts');
        expect(context.typeName).toBe('User');
      });

      test('should handle optional symbol property correctly', () => {
        const mockType = {} as any;
        const context: ResolveContext = {
          type: mockType,
          // symbol omitted to test optional behavior
        };

        expect(context.type).toBe(mockType);
        expect(context.symbol).toBeUndefined();
      });
    });

    describe('PropertyMethodContext', () => {
      test('should accept valid property method context', () => {
        const context: PropertyMethodContext = {
          typeName: 'User',
          typeInfo: { kind: TypeKind.Primitive, name: 'string' },
          builderName: 'UserBuilder',
          property: {
            name: 'email',
            type: { kind: TypeKind.Primitive, name: 'string' },
            optional: false,
            readonly: false,
          },
          propertyType: { kind: TypeKind.Primitive, name: 'string' },
          originalTypeString: 'string',
          type: {
            isPrimitive: () => true,
            isObject: () => ({}) as ObjectTypeMatcher,
            isArray: () => ({}) as ArrayTypeMatcher,
            isUnion: () => ({}) as UnionTypeMatcher,
            isIntersection: () => ({}) as IntersectionTypeMatcher,
            isReference: () => false,
            isGeneric: () => false,
            matches: () => false,
            toString: () => 'string',
            transformDeep: () => ({}) as any,
            containsDeep: () => false,
            findDeep: () => [],
          },
          hasGeneric: () => false,
          getGenericConstraint: () => undefined,
          isOptional: () => false,
          isReadonly: () => false,
          getPropertyPath: () => ['email'],
          getMethodName: () => 'email',
        };

        expect(context.property.name).toBe('email');
        expect(context.type.isPrimitive()).toBe(true);
        expect(context.getMethodName()).toBe('email');
      });
    });

    describe('BuilderContext', () => {
      test('should accept valid builder context', () => {
        const context: BuilderContext = {
          typeName: 'User',
          typeInfo: { kind: TypeKind.Object, properties: [] },
          builderName: 'UserBuilder',
          genericParams: '<T>',
          genericConstraints: '<T extends object>',
          properties: [],
          hasProperty: () => false,
          getProperty: () => undefined,
          getRequiredProperties: () => [],
          getOptionalProperties: () => [],
        };

        expect(context.builderName).toBe('UserBuilder');
        expect(context.hasProperty('email')).toBe(false);
      });
    });

    describe('ValueContext', () => {
      test('should accept valid value context', () => {
        const context: ValueContext = {
          property: 'email',
          valueVariable: 'emailValue',
          type: { kind: TypeKind.Primitive, name: 'string' },
          isOptional: false,
          typeChecker: {
            isPrimitive: () => true,
            isObject: () => ({}) as ObjectTypeMatcher,
            isArray: () => ({}) as ArrayTypeMatcher,
            isUnion: () => ({}) as UnionTypeMatcher,
            isIntersection: () => ({}) as IntersectionTypeMatcher,
            isReference: () => false,
            isGeneric: () => false,
            matches: () => false,
            toString: () => 'string',
            transformDeep: () => ({}) as any,
            containsDeep: () => false,
            findDeep: () => [],
          },
        };

        expect(context.property).toBe('email');
        expect(context.typeChecker.isPrimitive()).toBe(true);
      });
    });
  });

  describe('Transform Types', () => {
    describe('PropertyMethodTransform', () => {
      test('should accept empty transform', () => {
        const transform: PropertyMethodTransform = {};
        expect(transform).toEqual({});
      });

      test('should accept full transform', () => {
        const transform: PropertyMethodTransform = {
          parameterType: 'string | TaggedValue<string>',
          extractValue: 'String(value)',
          validate: 'typeof value === "string"',
        };

        expect(transform.parameterType).toBe('string | TaggedValue<string>');
        expect(transform.extractValue).toBe('String(value)');
        expect(transform.validate).toBe('typeof value === "string"');
      });
    });

    describe('CustomMethod', () => {
      test('should accept valid custom method', () => {
        const method: CustomMethod = {
          name: 'withEmail',
          signature: '(email: string): this',
          implementation: 'return this.email(email);',
        };

        expect(method.name).toBe('withEmail');
        expect(method.signature).toBe('(email: string): this');
      });

      test('should accept custom method with JSDoc', () => {
        const method: CustomMethod = {
          name: 'withEmail',
          signature: '(email: string): this',
          implementation: 'return this.email(email);',
          jsDoc: 'Sets the email address',
        };

        expect(method.jsDoc).toBe('Sets the email address');
      });
    });

    describe('ValueTransform', () => {
      test('should accept value transform without condition', () => {
        const transform: ValueTransform = {
          transform: 'value.toUpperCase()',
        };

        expect(transform.transform).toBe('value.toUpperCase()');
      });

      test('should accept value transform with condition', () => {
        const transform: ValueTransform = {
          condition: 'typeof value === "string"',
          transform: 'value.toUpperCase()',
        };

        expect(transform.condition).toBe('typeof value === "string"');
        expect(transform.transform).toBe('value.toUpperCase()');
      });
    });
  });

  describe('Plugin Interface', () => {
    test('should accept minimal plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    test('should accept plugin with description', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
      };

      expect(plugin.description).toBe('A test plugin');
    });

    test('should accept plugin with imports', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        imports: {
          imports: [
            {
              kind: 'internal',
              path: '../types.js',
              imports: ['User'],
            },
          ],
        },
      };

      expect(plugin.imports?.imports).toHaveLength(1);
    });

    test('should accept plugin with lifecycle hooks', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        beforeParse: context => ok(context),
        afterParse: (context, type) => ok(type),
        beforeResolve: context => ok(context),
        afterResolve: (context, typeInfo) => ok(typeInfo),
        beforeGenerate: context => ok(context),
        afterGenerate: (code, _context) => ok(code),
      };

      expect(plugin.beforeParse).toBeDefined();
      expect(plugin.afterGenerate).toBeDefined();
    });

    test('should accept plugin with transformation hooks', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        transformType: (type, typeInfo) => ok(typeInfo),
        transformProperty: property => ok(property),
        transformBuildMethod: _context => ok('return {};'),
        transformPropertyMethod: _context => ok({}),
        addCustomMethods: _context => ok([]),
        transformValue: _context => ok(null),
        transformImports: context => ok(context),
      };

      expect(plugin.transformType).toBeDefined();
      expect(plugin.transformImports).toBeDefined();
    });
  });

  describe('Transform Builder Types', () => {
    describe('PropertyMethodTransformRule', () => {
      test('should accept valid transform rule', () => {
        const rule: PropertyMethodTransformRule = {
          predicate: context => context.type.isPrimitive('string'),
          transform: {
            parameterType: 'string | TaggedValue<string>',
            extractValue: 'String(value)',
          },
        };

        expect(rule.predicate).toBeDefined();
        expect(rule.transform.parameterType).toBe('string | TaggedValue<string>');
      });
    });

    describe('BuildMethodTransformation', () => {
      test('should accept insertBefore transformation', () => {
        const transformation: BuildMethodTransformation = {
          type: 'insertBefore',
          marker: '// INSERT_VALIDATION',
          code: 'validateInput(this.values);',
        };

        expect(transformation.type).toBe('insertBefore');
        expect(transformation.marker).toBe('// INSERT_VALIDATION');
      });

      test('should accept replace transformation with function', () => {
        const transformation: BuildMethodTransformation = {
          type: 'replace',
          marker: /return \{.*\};/,
          code: context => `return { ...${context.builderName}.defaults, ...this.values };`,
        };

        expect(transformation.type).toBe('replace');
        expect(transformation.code).toBeTypeOf('function');
      });
    });

    describe('CustomMethodDefinition', () => {
      test('should accept method definition with string types', () => {
        const methodDef: CustomMethodDefinition = {
          name: 'withEmail',
          parameters: [
            {
              name: 'email',
              type: 'string',
            },
          ],
          returnType: 'this',
          implementation: 'return this.email(email);',
        };

        expect(methodDef.name).toBe('withEmail');
        expect(methodDef.parameters[0]!.name).toBe('email');
      });

      test('should accept method definition with function types', () => {
        const methodDef: CustomMethodDefinition = {
          name: 'withData',
          parameters: [
            {
              name: 'data',
              type: 'T',
              isOptional: true,
              defaultValue: 'null',
            },
          ],
          returnType: context => context.builderName,
          implementation: context => `return new ${context.builderName}({ ...this.values, data });`,
          jsDoc: 'Sets the data property',
        };

        expect(methodDef.returnType).toBeTypeOf('function');
        expect(methodDef.implementation).toBeTypeOf('function');
        expect(methodDef.jsDoc).toBe('Sets the data property');
      });
    });

    describe('MethodParameter', () => {
      test('should accept minimal parameter', () => {
        const param: MethodParameter = {
          name: 'value',
          type: 'string',
        };

        expect(param.name).toBe('value');
        expect(param.type).toBe('string');
      });

      test('should accept parameter with all options', () => {
        const param: MethodParameter = {
          name: 'value',
          type: 'string',
          isOptional: true,
          defaultValue: '"default"',
        };

        expect(param.isOptional).toBe(true);
        expect(param.defaultValue).toBe('"default"');
      });
    });
  });

  describe('Type Matcher Interfaces', () => {
    describe('TypeMatcher', () => {
      test('should define required methods', () => {
        const matcher: TypeMatcher = {
          match: typeInfo => typeInfo.kind === TypeKind.Primitive,
          describe: () => 'primitive matcher',
        };

        expect(matcher.match({ kind: TypeKind.Primitive, name: 'string' })).toBe(true);
        expect(matcher.describe()).toBe('primitive matcher');
      });
    });

    describe('ObjectTypeMatcher', () => {
      test('should extend TypeMatcher with fluent methods', () => {
        const mockObjectMatcher = () => ({}) as ObjectTypeMatcher;

        const matcher: ObjectTypeMatcher = {
          match: () => true,
          describe: () => 'object matcher',
          withGeneric: mockObjectMatcher,
          withProperty: mockObjectMatcher,
          withProperties: mockObjectMatcher,
        };

        expect(typeof matcher.withGeneric).toBe('function');
        expect(typeof matcher.withProperty).toBe('function');
        expect(typeof matcher.withProperties).toBe('function');
      });
    });

    describe('ArrayTypeMatcher', () => {
      test('should extend TypeMatcher with of method', () => {
        const matcher: ArrayTypeMatcher = {
          match: () => true,
          describe: () => 'array matcher',
          of: () => ({}) as ArrayTypeMatcher,
        };

        expect(typeof matcher.of).toBe('function');
      });
    });

    describe('UnionTypeMatcher', () => {
      test('should extend TypeMatcher with union methods', () => {
        const mockUnionMatcher = () => ({}) as UnionTypeMatcher;

        const matcher: UnionTypeMatcher = {
          match: () => true,
          describe: () => 'union matcher',
          containing: mockUnionMatcher,
          exact: mockUnionMatcher,
        };

        expect(typeof matcher.containing).toBe('function');
        expect(typeof matcher.exact).toBe('function');
      });
    });

    describe('IntersectionTypeMatcher', () => {
      test('should extend TypeMatcher with intersection methods', () => {
        const mockIntersectionMatcher = () => ({}) as IntersectionTypeMatcher;

        const matcher: IntersectionTypeMatcher = {
          match: () => true,
          describe: () => 'intersection matcher',
          including: mockIntersectionMatcher,
          exact: mockIntersectionMatcher,
        };

        expect(typeof matcher.including).toBe('function');
        expect(typeof matcher.exact).toBe('function');
      });
    });
  });

  describe('Path Mapping Types', () => {
    describe('PathMappingRule', () => {
      test('should accept string pattern', () => {
        const rule: PathMappingRule = {
          pattern: '../utils',
          replacement: '@my-org/utils',
        };

        expect(rule.pattern).toBe('../utils');
        expect(rule.replacement).toBe('@my-org/utils');
        expect(rule.isRegex).toBeUndefined();
      });

      test('should accept regex pattern', () => {
        const rule: PathMappingRule = {
          pattern: '^\\.\\./core',
          isRegex: true,
          replacement: '@my-org/core',
        };

        expect(rule.pattern).toBe('^\\.\\./core');
        expect(rule.isRegex).toBe(true);
        expect(rule.replacement).toBe('@my-org/core');
      });
    });

    describe('RelativeToMonorepoMapping', () => {
      test('should accept mapping with multiple rules', () => {
        const mapping: RelativeToMonorepoMapping = {
          pathMappings: [
            {
              pattern: '../utils',
              replacement: '@my-org/utils',
            },
            {
              pattern: '^\\.\\./core',
              isRegex: true,
              replacement: '@my-org/core',
            },
          ],
          baseDir: '/project/src',
        };

        expect(mapping.pathMappings).toHaveLength(2);
        expect(mapping.pathMappings[0]!.pattern).toBe('../utils');
        expect(mapping.pathMappings[1]!.isRegex).toBe(true);
        expect(mapping.baseDir).toBe('/project/src');
      });

      test('should work without base directory', () => {
        const mapping: RelativeToMonorepoMapping = {
          pathMappings: [
            {
              pattern: '../utils',
              replacement: '@my-org/utils',
            },
          ],
        };

        expect(mapping.pathMappings).toHaveLength(1);
        expect(mapping.baseDir).toBeUndefined();
      });
    });
  });
});
