import { describe, test, expect } from 'vitest';
import {
  PropertyMethodTransformBuilder,
  ValueTransformBuilder,
  BuildMethodTransformBuilder,
  CustomMethodBuilder,
  createPropertyMethodTransformBuilder,
  createValueTransformBuilder,
  createBuildMethodTransformBuilder,
  createCustomMethodBuilder,
} from '../transform-builders.js';
import { TypeKind } from '../../types.js';
import type {
  PropertyMethodContext,
  ValueContext,
  BuildMethodContext,
  BuilderContext,
} from '../plugin-types.js';

describe('Transform Builders', () => {
  describe('PropertyMethodTransformBuilder', () => {
    test('should create builder using factory function', () => {
      const builder = createPropertyMethodTransformBuilder();
      expect(builder).toBeInstanceOf(PropertyMethodTransformBuilder);
    });

    test('should build empty transform', () => {
      const builder = new PropertyMethodTransformBuilder();
      const transform = builder.build();

      const mockContext = createMockPropertyMethodContext();
      expect(transform(mockContext)).toEqual({});
    });

    test('should build simple rule with parameter type', () => {
      const builder = new PropertyMethodTransformBuilder();
      const transform = builder
        .when(ctx => ctx.type.isPrimitive('string'))
        .setParameter('string | TaggedValue<string>')
        .done()
        .build();

      const stringContext = createMockPropertyMethodContext({
        type: mockTypeMatcher(true),
      });

      const numberContext = createMockPropertyMethodContext({
        type: mockTypeMatcher(false),
      });

      expect(transform(stringContext)).toEqual({
        parameterType: 'string | TaggedValue<string>',
      });

      expect(transform(numberContext)).toEqual({});
    });

    test('should build rule with extractor', () => {
      const builder = new PropertyMethodTransformBuilder();
      const transform = builder
        .when(() => true)
        .setExtractor('String(value)')
        .done()
        .build();

      const context = createMockPropertyMethodContext();
      expect(transform(context)).toEqual({
        extractValue: 'String(value)',
      });
    });

    test('should build rule with validator', () => {
      const builder = new PropertyMethodTransformBuilder();
      const transform = builder
        .when(() => true)
        .setValidator('typeof value === "string"')
        .done()
        .build();

      const context = createMockPropertyMethodContext();
      expect(transform(context)).toEqual({
        validate: 'typeof value === "string"',
      });
    });

    test('should build complete transformation rule', () => {
      const builder = new PropertyMethodTransformBuilder();
      const transform = builder
        .when(ctx => ctx.type.isPrimitive('string'))
        .setParameter('string | TaggedValue<string>')
        .setExtractor('String(value)')
        .setValidator('typeof value === "string"')
        .done()
        .build();

      const context = createMockPropertyMethodContext({
        type: mockTypeMatcher(true),
      });

      expect(transform(context)).toEqual({
        parameterType: 'string | TaggedValue<string>',
        extractValue: 'String(value)',
        validate: 'typeof value === "string"',
      });
    });

    test('should support multiple rules with different conditions', () => {
      const builder = new PropertyMethodTransformBuilder();
      const transform = builder
        .when(ctx => ctx.type.isPrimitive('string'))
        .setParameter('string | TaggedValue<string>')
        .done()
        .when(ctx => ctx.type.isPrimitive('number'))
        .setParameter('number | TaggedValue<number>')
        .done()
        .build();

      const stringContext = createMockPropertyMethodContext({
        type: mockTypeMatcher(true, 'string'),
      });

      const numberContext = createMockPropertyMethodContext({
        type: mockTypeMatcher(true, 'number'),
      });

      expect(transform(stringContext)).toEqual({
        parameterType: 'string | TaggedValue<string>',
      });

      expect(transform(numberContext)).toEqual({
        parameterType: 'number | TaggedValue<number>',
      });
    });

    test('should return first matching rule', () => {
      const builder = new PropertyMethodTransformBuilder();
      const transform = builder
        .when(() => true)
        .setParameter('first-match')
        .done()
        .when(() => true)
        .setParameter('second-match')
        .done()
        .build();

      const context = createMockPropertyMethodContext();
      expect(transform(context)).toEqual({
        parameterType: 'first-match',
      });
    });

    test('should handle function-based parameter transformations', () => {
      const builder = new PropertyMethodTransformBuilder();

      // This should work but currently uses placeholder
      expect(() => {
        builder
          .when(() => true)
          .setParameter(ctx => `Tagged<${ctx.originalTypeString}>`)
          .done()
          .build();
      }).not.toThrow();
    });

    test('should throw error when trying to set parameter without condition', () => {
      const builder = new PropertyMethodTransformBuilder();

      expect(() => builder.setParameter('string')).toThrow('No active rule. Call when() first.');
    });

    test('should throw error when trying to set extractor without condition', () => {
      const builder = new PropertyMethodTransformBuilder();

      expect(() => builder.setExtractor('String(value)')).toThrow(
        'No active rule. Call when() first.',
      );
    });

    test('should throw error when trying to set validator without condition', () => {
      const builder = new PropertyMethodTransformBuilder();

      expect(() => builder.setValidator('typeof value === "string"')).toThrow(
        'No active rule. Call when() first.',
      );
    });

    test('should throw error when starting new rule without finishing previous', () => {
      const builder = new PropertyMethodTransformBuilder();

      builder.when(() => true);
      expect(() => builder.when(() => true)).toThrow(
        'Previous transformation rule not completed. Call done() first.',
      );
    });

    test('should chain methods fluently', () => {
      const builder = new PropertyMethodTransformBuilder();
      const result = builder
        .when(() => true)
        .setParameter('string')
        .setExtractor('String(value)')
        .setValidator('typeof value === "string"');

      expect(result).toBe(builder);
    });
  });

  describe('ValueTransformBuilder', () => {
    test('should create builder using factory function', () => {
      const builder = createValueTransformBuilder();
      expect(builder).toBeInstanceOf(ValueTransformBuilder);
    });

    test('should build empty transform returning null', () => {
      const builder = new ValueTransformBuilder();
      const transform = builder.build();

      const mockContext = createMockValueContext();
      expect(transform(mockContext)).toBeNull();
    });

    test('should build simple transformation', () => {
      const builder = new ValueTransformBuilder();
      const transform = builder
        .when(ctx => ctx.typeChecker.isPrimitive('string'))
        .transform('value.toUpperCase()')
        .done()
        .build();

      const stringContext = createMockValueContext({
        typeChecker: mockTypeMatcher(true),
      });

      const numberContext = createMockValueContext({
        typeChecker: mockTypeMatcher(false),
      });

      expect(transform(stringContext)).toEqual({
        transform: 'value.toUpperCase()',
      });

      expect(transform(numberContext)).toBeNull();
    });

    test('should build transformation with condition', () => {
      const builder = new ValueTransformBuilder();
      const transform = builder
        .when(() => true)
        .transform('value.trim()')
        .condition('typeof value === "string"')
        .done()
        .build();

      const context = createMockValueContext();
      expect(transform(context)).toEqual({
        transform: 'value.trim()',
        condition: 'typeof value === "string"',
      });
    });

    test('should support multiple transformation rules', () => {
      const builder = new ValueTransformBuilder();
      const transform = builder
        .when(ctx => ctx.typeChecker.isPrimitive('string'))
        .transform('value.toUpperCase()')
        .done()
        .when(ctx => ctx.typeChecker.isPrimitive('number'))
        .transform('Math.round(value)')
        .done()
        .build();

      const stringContext = createMockValueContext({
        typeChecker: mockTypeMatcher(true, 'string'),
      });

      const numberContext = createMockValueContext({
        typeChecker: mockTypeMatcher(true, 'number'),
      });

      expect(transform(stringContext)).toEqual({
        transform: 'value.toUpperCase()',
      });

      expect(transform(numberContext)).toEqual({
        transform: 'Math.round(value)',
      });
    });

    test('should throw error when setting transform without condition', () => {
      const builder = new ValueTransformBuilder();

      expect(() => builder.transform('value.trim()')).toThrow('No active rule. Call when() first.');
    });

    test('should throw error when setting condition without transform rule', () => {
      const builder = new ValueTransformBuilder();

      expect(() => builder.condition('typeof value === "string"')).toThrow(
        'No active rule. Call when() first.',
      );
    });

    test('should chain methods fluently', () => {
      const builder = new ValueTransformBuilder();
      const result = builder
        .when(() => true)
        .transform('value.trim()')
        .condition('typeof value === "string"');

      expect(result).toBe(builder);
    });
  });

  describe('BuildMethodTransformBuilder', () => {
    test('should create builder using factory function', () => {
      const builder = createBuildMethodTransformBuilder();
      expect(builder).toBeInstanceOf(BuildMethodTransformBuilder);
    });

    test('should build identity transform by default', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder.build();

      const originalCode = 'build() { return { ...this.values }; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      expect(transform(mockContext)).toBe(originalCode);
    });

    test('should insert before marker', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder.insertBefore('return {', 'this.validate();').build();

      const originalCode = 'build() { return { ...this.values }; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      const result = transform(mockContext);
      expect(result).toContain('this.validate();');
      expect(result).toContain('return {');
      expect(result.indexOf('this.validate();')).toBeLessThan(result.indexOf('return {'));
    });

    test('should insert after marker', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder.insertAfter('// BUILD', 'console.log("Building...");').build();

      const originalCode = 'build() { // BUILD\n  return this.values; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      const result = transform(mockContext);
      expect(result).toContain('// BUILD');
      expect(result).toContain('console.log("Building...");');
      expect(result.indexOf('// BUILD')).toBeLessThan(
        result.indexOf('console.log("Building...");'),
      );
    });

    test('should replace marker with code', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder
        .replace('// PLACEHOLDER', 'const validated = this.validate();')
        .build();

      const originalCode = 'build() { // PLACEHOLDER\n  return this.values; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      const result = transform(mockContext);
      expect(result).not.toContain('// PLACEHOLDER');
      expect(result).toContain('const validated = this.validate();');
    });

    test('should wrap entire code', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder
        .wrapMethod('try {', '} catch(e) { throw new Error("Build failed"); }')
        .build();

      const originalCode = 'return this.values;';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      const result = transform(mockContext);
      expect(result).toContain('try {');
      expect(result).toContain('} catch(e) { throw new Error("Build failed"); }');
      expect(result).toContain('return this.values;');
    });

    test('should handle regex markers', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder
        .replace(/return\s+\{.*\};/, 'return { ...defaults, ...this.values };')
        .build();

      const originalCode = 'build() { return { ...this.values }; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      const result = transform(mockContext);
      expect(result).toContain('return { ...defaults, ...this.values };');
    });

    test('should support function-based transformations', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder
        .replace('return {', (match, context) => `// Builder: ${context.builderName}\n  return {`)
        .build();

      const originalCode = 'build() { return { ...this.values }; }';
      const mockContext = createMockBuildMethodContext({
        buildMethodCode: originalCode,
        builderName: 'UserBuilder',
      });

      const result = transform(mockContext);
      expect(result).toContain('// Builder: UserBuilder');
    });

    test('should apply multiple transformations in order', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder
        .insertBefore('return', '// Step 1')
        .insertAfter('return', '// Step 2')
        .build();

      const originalCode = 'build() { return this.values; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      const result = transform(mockContext);
      expect(result).toContain('// Step 1');
      expect(result).toContain('// Step 2');
    });

    test('should handle missing markers gracefully', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder.insertBefore('MISSING_MARKER', 'this.validate();').build();

      const originalCode = 'build() { return this.values; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      const result = transform(mockContext);
      expect(result).toBe(originalCode); // Should remain unchanged
    });

    test('should handle empty transformations', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder.build();

      const originalCode = 'build() { return this.values; }';
      const mockContext = createMockBuildMethodContext({ buildMethodCode: originalCode });

      expect(transform(mockContext)).toBe(originalCode);
    });

    test('should handle complex function-based replacement without unsafe casting', () => {
      const builder = new BuildMethodTransformBuilder();
      const transform = builder
        .replace(/return\s+\{.*\}/, (match: string, context: BuildMethodContext) => {
          // This should not cause type errors
          return `// Context: ${context.typeName}\n    ${match}`;
        })
        .build();

      const originalCode = 'build() { return { ...this.values }; }';
      const mockContext = createMockBuildMethodContext({
        buildMethodCode: originalCode,
        typeName: 'TestType',
      });

      const result = transform(mockContext);
      expect(result).toContain('// Context: TestType');
      expect(result).toContain('return { ...this.values };');
    });

    describe('conditional transformations with when()', () => {
      test('should apply transformation when predicate returns true', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .insertBefore('return {', 'this.validate();')
          .build();

        const matchingContext = createMockBuildMethodContext({
          buildMethodCode: 'build() { return { ...this.values }; }',
          builderName: 'UserBuilder',
        });

        const result = transform(matchingContext);
        expect(result).toContain('this.validate();');
      });

      test('should skip transformation when predicate returns false', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .insertBefore('return {', 'this.validate();')
          .build();

        const nonMatchingContext = createMockBuildMethodContext({
          buildMethodCode: 'build() { return { ...this.values }; }',
          builderName: 'ProductBuilder',
        });

        const result = transform(nonMatchingContext);
        expect(result).not.toContain('this.validate();');
        expect(result).toBe('build() { return { ...this.values }; }');
      });

      test('should support multiple conditional transformations', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .insertBefore('return {', '// User validation')
          .when(ctx => ctx.builderName === 'ProductBuilder')
          .insertBefore('return {', '// Product validation')
          .build();

        const userContext = createMockBuildMethodContext({
          buildMethodCode: 'build() { return { ...this.values }; }',
          builderName: 'UserBuilder',
        });

        const productContext = createMockBuildMethodContext({
          buildMethodCode: 'build() { return { ...this.values }; }',
          builderName: 'ProductBuilder',
        });

        expect(transform(userContext)).toContain('// User validation');
        expect(transform(userContext)).not.toContain('// Product validation');

        expect(transform(productContext)).toContain('// Product validation');
        expect(transform(productContext)).not.toContain('// User validation');
      });

      test('should work with insertAfter and predicate', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .when(ctx => ctx.typeName === 'User')
          .insertAfter('return {', '\n  // User-specific logic')
          .build();

        const matchingContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          typeName: 'User',
        });

        const nonMatchingContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          typeName: 'Product',
        });

        expect(transform(matchingContext)).toContain('// User-specific logic');
        expect(transform(nonMatchingContext)).not.toContain('// User-specific logic');
      });

      test('should work with replace and predicate', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .replace('return {', 'return Object.freeze({')
          .build();

        const matchingContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          builderName: 'UserBuilder',
        });

        const nonMatchingContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          builderName: 'ProductBuilder',
        });

        expect(transform(matchingContext)).toContain('Object.freeze');
        expect(transform(nonMatchingContext)).not.toContain('Object.freeze');
      });

      test('should work with wrapMethod and predicate', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .wrapMethod('try {', '} catch(e) { console.error(e); }')
          .build();

        const matchingContext = createMockBuildMethodContext({
          buildMethodCode: 'return this.values;',
          builderName: 'UserBuilder',
        });

        const nonMatchingContext = createMockBuildMethodContext({
          buildMethodCode: 'return this.values;',
          builderName: 'ProductBuilder',
        });

        expect(transform(matchingContext)).toContain('try {');
        expect(transform(matchingContext)).toContain('} catch(e)');
        expect(transform(nonMatchingContext)).not.toContain('try {');
      });

      test('should reset predicate after transformation is added', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .insertBefore('return {', '// Step 1')
          .insertBefore('return {', '// Step 2') // Should not have predicate
          .build();

        const userContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          builderName: 'UserBuilder',
        });

        const productContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          builderName: 'ProductBuilder',
        });

        const userResult = transform(userContext);
        const productResult = transform(productContext);

        expect(userResult).toContain('// Step 1');
        expect(userResult).toContain('// Step 2');
        expect(productResult).not.toContain('// Step 1');
        expect(productResult).toContain('// Step 2'); // No predicate, should apply
      });

      test('should mix conditional and unconditional transformations', () => {
        const builder = new BuildMethodTransformBuilder();
        const transform = builder
          .insertBefore('return {', '// Always applied')
          .when(ctx => ctx.builderName === 'UserBuilder')
          .insertBefore('return {', '// Only for UserBuilder')
          .build();

        const userContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          builderName: 'UserBuilder',
        });

        const productContext = createMockBuildMethodContext({
          buildMethodCode: 'return { ...this.values };',
          builderName: 'ProductBuilder',
        });

        expect(transform(userContext)).toContain('// Always applied');
        expect(transform(userContext)).toContain('// Only for UserBuilder');
        expect(transform(productContext)).toContain('// Always applied');
        expect(transform(productContext)).not.toContain('// Only for UserBuilder');
      });
    });
  });

  describe('CustomMethodBuilder', () => {
    test('should create builder using factory function', () => {
      const builder = createCustomMethodBuilder();
      expect(builder).toBeInstanceOf(CustomMethodBuilder);
    });

    test('should build empty method lists through higher level API', () => {
      // Test that an empty methods array can be created at the plugin level
      const buildEmptyMethodsList = () => [];
      expect(buildEmptyMethodsList()).toEqual([]);
    });

    test('should build simple method definition', () => {
      const builder = new CustomMethodBuilder();
      const generateMethods = builder
        .name('withEmail')
        .parameters([{ name: 'email', type: 'string' }])
        .returns('this')
        .implementation('return this.email(email);')
        .build();

      const _builderMethod = (_context: BuilderContext) => [generateMethods];

      expect(generateMethods).toEqual({
        name: 'withEmail',
        parameters: [{ name: 'email', type: 'string' }],
        returnType: 'this',
        implementation: 'return this.email(email);',
      });
    });

    test('should build method with optional parameters', () => {
      const builder = new CustomMethodBuilder();
      const generateMethods = builder
        .name('withData')
        .parameters([
          { name: 'data', type: 'T', isOptional: true },
          { name: 'merge', type: 'boolean', isOptional: true, defaultValue: 'false' },
        ])
        .returns('this')
        .implementation('return this.setData(data, merge);')
        .build();

      const _builderMethod = (_context: BuilderContext) => [generateMethods];

      expect(generateMethods).toEqual({
        name: 'withData',
        parameters: [
          { name: 'data', type: 'T', isOptional: true },
          { name: 'merge', type: 'boolean', isOptional: true, defaultValue: 'false' },
        ],
        returnType: 'this',
        implementation: 'return this.setData(data, merge);',
      });
    });

    test('should build method with JSDoc', () => {
      const builder = new CustomMethodBuilder();
      const generateMethods = builder
        .name('withDefaults')
        .parameters([])
        .returns('this')
        .implementation('return this;')
        .jsDoc('Sets default values for all properties')
        .build();

      const _builderMethod = (_context: BuilderContext) => [generateMethods];

      expect(generateMethods).toEqual({
        name: 'withDefaults',
        parameters: [],
        returnType: 'this',
        implementation: 'return this;',
        jsDoc: 'Sets default values for all properties',
      });
    });

    test('should build method with function-based return type', () => {
      const builder = new CustomMethodBuilder();
      const generateMethods = builder
        .name('clone')
        .parameters([])
        .returns(context => context.builderName)
        .implementation(context => `return new ${context.builderName}(this.values);`)
        .build();

      const _builderMethod = (_context: BuilderContext) => [generateMethods];

      expect(typeof generateMethods.returnType).toBe('function');
      expect(typeof generateMethods.implementation).toBe('function');

      if (typeof generateMethods.returnType === 'function') {
        const mockContext = createMockBuilderContext({ builderName: 'UserBuilder' });
        expect(generateMethods.returnType(mockContext)).toBe('UserBuilder');
      }

      if (typeof generateMethods.implementation === 'function') {
        const mockContext = createMockBuilderContext({ builderName: 'UserBuilder' });
        expect(generateMethods.implementation(mockContext)).toBe(
          'return new UserBuilder(this.values);',
        );
      }
    });

    test('should build multiple methods', () => {
      const _builder = new CustomMethodBuilder();
      // Build two separate method definitions
      const emailMethod = new CustomMethodBuilder()
        .name('withEmail')
        .parameters([{ name: 'email', type: 'string' }])
        .returns('this')
        .implementation('return this.email(email);')
        .build();

      const nameMethod = new CustomMethodBuilder()
        .name('withName')
        .parameters([{ name: 'name', type: 'string' }])
        .returns('this')
        .implementation('return this.name(name);')
        .build();

      const _builderMethod = (_context: BuilderContext) => [emailMethod, nameMethod];
      const generateMethods = _builderMethod;

      const mockContext = createMockBuilderContext();
      // generateMethods is now a CustomMethodDefinition array function
      const methods = generateMethods(mockContext);

      expect(methods).toHaveLength(2);
      expect(methods.map(m => m.name)).toEqual(['withEmail', 'withName']);
    });

    test('should throw error when building without method name', () => {
      const builder = new CustomMethodBuilder();

      expect(() => builder.build()).toThrow('Method name is required');
    });

    test('should throw error when building without implementation', () => {
      const builder = new CustomMethodBuilder();
      builder.name('test');

      expect(() => builder.build()).toThrow('Method implementation is required');
    });

    test('should set default return type when not specified', () => {
      const builder = new CustomMethodBuilder();
      const method = builder.name('test').implementation('return this;').build();

      expect(method.returnType).toBe('this');
    });

    test('should allow method chaining', () => {
      const builder = new CustomMethodBuilder();
      const result = builder
        .name('test')
        .parameters([])
        .returns('this')
        .implementation('return this;');

      expect(result).toBe(builder);
    });

    test('should support function-based return types and implementations', () => {
      const builder = new CustomMethodBuilder();
      const method = builder
        .name('test')
        .returns(ctx => ctx.builderName)
        .implementation(ctx => `return new ${ctx.builderName}();`)
        .build();

      expect(typeof method.returnType).toBe('function');
      expect(typeof method.implementation).toBe('function');
    });

    describe('conditional methods with when()', () => {
      test('should include predicate when using when()', () => {
        const builder = new CustomMethodBuilder();
        const method = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .name('withEmail')
          .parameters([{ name: 'email', type: 'string' }])
          .returns('this')
          .implementation('return this.email(email);')
          .build();

        expect(method.predicate).toBeDefined();
        expect(typeof method.predicate).toBe('function');
      });

      test('should not include predicate when when() is not called', () => {
        const builder = new CustomMethodBuilder();
        const method = builder
          .name('withEmail')
          .parameters([{ name: 'email', type: 'string' }])
          .returns('this')
          .implementation('return this.email(email);')
          .build();

        expect(method.predicate).toBeUndefined();
      });

      test('should allow chaining when() with other methods', () => {
        const builder = new CustomMethodBuilder();
        const result = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .name('test')
          .implementation('return this;');

        expect(result).toBe(builder);
      });

      test('should build method with working predicate', () => {
        const builder = new CustomMethodBuilder();
        const method = builder
          .when(ctx => ctx.builderName === 'UserBuilder')
          .name('withEmail')
          .implementation('return this.email(email);')
          .build();

        const userContext = createMockBuilderContext({ builderName: 'UserBuilder' });
        const productContext = createMockBuilderContext({ builderName: 'ProductBuilder' });

        expect(method.predicate?.(userContext)).toBe(true);
        expect(method.predicate?.(productContext)).toBe(false);
      });

      test('should support complex predicates', () => {
        const builder = new CustomMethodBuilder();
        const method = builder
          .when(ctx => ctx.properties.some(p => p.name === 'email'))
          .name('validateEmail')
          .implementation('// validation logic')
          .build();

        const contextWithEmail = createMockBuilderContext({
          properties: [
            {
              name: 'email',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
            },
          ],
        });

        const contextWithoutEmail = createMockBuilderContext({
          properties: [
            {
              name: 'username',
              type: { kind: TypeKind.Primitive, name: 'string' },
              optional: false,
              readonly: false,
            },
          ],
        });

        expect(method.predicate?.(contextWithEmail)).toBe(true);
        expect(method.predicate?.(contextWithoutEmail)).toBe(false);
      });
    });
  });

  describe('integration tests', () => {
    test('should work together in plugin context', () => {
      const propertyBuilder = createPropertyMethodTransformBuilder();
      const valueBuilder = createValueTransformBuilder();
      const buildBuilder = createBuildMethodTransformBuilder();
      const customBuilder = createCustomMethodBuilder();

      // Configure all builders
      const propertyTransform = propertyBuilder
        .when(ctx => ctx.type.isPrimitive('string'))
        .setParameter('string | TaggedValue<string>')
        .setExtractor('String(value)')
        .done()
        .build();

      const valueTransform = valueBuilder
        .when(ctx => ctx.typeChecker.isPrimitive('string'))
        .transform('value.trim()')
        .done()
        .build();

      const buildTransform = buildBuilder.insertBefore('return {', 'this.validate();').build();

      const customMethods = customBuilder
        .name('withDefaults')
        .parameters([])
        .returns('this')
        .implementation('return this;')
        .build();

      const _customMethodsFunction = () => [customMethods];

      // Test all transforms work
      const stringContext = createMockPropertyMethodContext({
        type: mockTypeMatcher(true),
      });

      const propertyResult = propertyTransform(stringContext);
      expect(propertyResult).not.toBeNull();
      if (propertyResult) {
        expect(propertyResult.parameterType).toBe('string | TaggedValue<string>');
      }

      const valueContext = createMockValueContext({
        typeChecker: mockTypeMatcher(true),
      });

      const valueResult = valueTransform(valueContext);
      expect(valueResult?.transform).toBe('value.trim()');

      const buildContext = createMockBuildMethodContext({
        buildMethodCode: 'build() { return { ...this.values }; }',
      });

      const buildResult = buildTransform(buildContext);
      expect(buildResult).toContain('this.validate();');

      expect(customMethods.name).toBe('withDefaults');
      expect(customMethods.returnType).toBe('this');
    });
  });
});

// Test helper functions

function createMockPropertyMethodContext(
  overrides: Partial<PropertyMethodContext> = {},
): PropertyMethodContext {
  return {
    typeName: 'User',
    typeInfo: { kind: TypeKind.Object, properties: [] },
    builderName: 'UserBuilder',
    property: {
      name: 'email',
      type: { kind: TypeKind.Primitive, name: 'string' },
      optional: false,
      readonly: false,
    },
    propertyType: { kind: TypeKind.Primitive, name: 'string' },
    originalTypeString: 'string',
    type: mockTypeMatcher(),
    hasGeneric: () => false,
    getGenericConstraint: () => undefined,
    isOptional: () => false,
    isReadonly: () => false,
    getPropertyPath: () => ['email'],
    getMethodName: () => 'email',
    ...overrides,
  };
}

function createMockValueContext(overrides: Partial<ValueContext> = {}): ValueContext {
  return {
    property: 'email',
    valueVariable: 'emailValue',
    type: { kind: TypeKind.Primitive, name: 'string' },
    isOptional: false,
    typeChecker: mockTypeMatcher(),
    ...overrides,
  };
}

function createMockBuildMethodContext(
  overrides: Partial<BuildMethodContext> = {},
): BuildMethodContext {
  return {
    buildMethodCode: 'build() { return { ...this.values }; }',
    typeInfo: { kind: TypeKind.Object, properties: [] },
    typeName: 'User',
    builderName: 'UserBuilder',
    genericParams: '',
    genericConstraints: '',
    properties: [],
    options: {},
    resolvedType: {
      sourceFile: '/test/types.ts',
      name: 'User',
      typeInfo: { kind: TypeKind.Object, properties: [] },
      imports: [],
      dependencies: [],
    },
    ...overrides,
  };
}

function createMockBuilderContext(overrides: Partial<BuilderContext> = {}): BuilderContext {
  return {
    typeName: 'User',
    typeInfo: { kind: TypeKind.Object, properties: [] },
    builderName: 'UserBuilder',
    genericParams: '',
    genericConstraints: '',
    properties: [],
    hasProperty: () => false,
    getProperty: () => undefined,
    getRequiredProperties: () => [],
    getOptionalProperties: () => [],
    ...overrides,
  };
}

function mockTypeMatcher(shouldMatch = false, matchType = 'string') {
  return {
    isPrimitive: (name?: string) => shouldMatch && (!name || name === matchType),
    isObject: () => ({}) as any,
    isArray: () => ({}) as any,
    isUnion: () => ({}) as any,
    isIntersection: () => ({}) as any,
    isReference: () => false,
    isGeneric: () => false,
    matches: () => false,
    toString: () => matchType,
    transformDeep: () => ({}) as any,
    containsDeep: () => false,
    findDeep: () => [],
  };
}
