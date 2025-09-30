import type {
  PropertyMethodContext,
  BuilderContext,
  ValueContext,
  BuildMethodContext,
  PropertyMethodTransform,
  PropertyMethodTransformRule,
  ValueTransform,
  ValueTransformRule,
  BuildMethodTransformation,
  CustomMethodDefinition,
  MethodParameter,
} from './plugin-types.js';

/**
 * Abstract base class for rule-based builders that manage transformation rules.
 * Provides common functionality for validating rule states and managing rule lifecycle.
 *
 * @template TRule - The type of transformation rule this builder manages
 * @template TContext - The context type passed to transformation predicates and functions
 * @template TTransform - The type of transformation result returned by the build method
 */
abstract class BaseRuleBuilder<TRule, TContext, TTransform> {
  protected rules: TRule[] = [];
  protected currentRule: Partial<TRule> | null = null;

  /**
   * Validates that no rule is currently being built
   */
  protected validateNoActiveRule(): void {
    if (this.currentRule) {
      throw new Error('Previous transformation rule not completed. Call done() first.');
    }
  }

  /**
   * Validates that a rule is currently being built
   */
  protected validateActiveRule(): void {
    if (!this.currentRule) {
      throw new Error('No active rule. Call when() first.');
    }
  }

  /**
   * Validates that the current rule is complete before adding to rules
   */
  protected validateRuleComplete(): void {
    if (!this.currentRule) {
      throw new Error('No active rule to complete.');
    }
    if (!this.isRuleComplete(this.currentRule)) {
      throw new Error('Rule is incomplete.');
    }
  }

  /**
   * Completes the current rule and adds it to the rules array
   */
  protected completeCurrentRule(): void {
    this.validateRuleComplete();
    this.rules.push(this.currentRule as TRule);
    this.currentRule = null;
  }

  /**
   * Validates that all rules are completed before building
   */
  protected validateReadyToBuild(): void {
    if (this.currentRule) {
      throw new Error('Unfinished rule. Call done() to complete it.');
    }
  }

  /**
   * Abstract method to check if a rule is complete
   */
  protected abstract isRuleComplete(rule: Partial<TRule>): boolean;

  /**
   * Abstract method to create the transformation function
   */
  abstract build(): (context: TContext) => TTransform;
}

/**
 * Mutable interface for property method transformation rules.
 * Used internally during rule construction.
 */
interface MutablePropertyMethodTransformRule {
  predicate: (context: PropertyMethodContext) => boolean;
  transform: {
    parameterType?: string | ((context: PropertyMethodContext) => string);
    extractValue?: string;
    validate?: string;
  };
}

/**
 * Builder for property method transformations.
 * Provides a fluent API for defining how property methods in generated builders are transformed.
 *
 * Property method transformations allow you to modify how setter methods are generated,
 * including changing parameter types, adding validation, and extracting values.
 *
 * @example
 * ```typescript
 * const builder = new PropertyMethodTransformBuilder();
 * const transform = builder
 *   .when(ctx => ctx.type.isPrimitive('string'))
 *   .setParameter('string | TaggedValue<string>')
 *   .setExtractor('String(value)')
 *   .setValidator('typeof value === "string"')
 *   .done()
 *   .build();
 * ```
 */
export class PropertyMethodTransformBuilder extends BaseRuleBuilder<
  PropertyMethodTransformRule,
  PropertyMethodContext,
  PropertyMethodTransform
> {
  /**
   * Start a new transformation rule with a condition.
   * The predicate determines when this transformation should apply to a property method.
   *
   * @param predicate - Function that receives a PropertyMethodContext and returns true if this transformation should apply
   * @returns This builder instance for method chaining
   * @example
   * ```typescript
   * builder.when(ctx => ctx.type.isPrimitive('string'))
   * ```
   */
  when(predicate: (context: PropertyMethodContext) => boolean): this {
    this.validateNoActiveRule();

    this.currentRule = {
      predicate,
      transform: {},
    };
    return this;
  }

  /**
   * Set the parameter type transformation for the property method.
   * This allows you to change the parameter type of the generated setter method.
   *
   * @param type - Either a string representing the new parameter type, or a function that transforms the original type
   * @returns This builder instance for method chaining
   * @example
   * ```typescript
   * // Static type transformation
   * builder.setParameter('string | TaggedValue<string>')
   *
   * // Dynamic type transformation
   * builder.setParameter(original => `${original} | null`)
   * ```
   */
  setParameter(type: string | ((context: PropertyMethodContext) => string)): this {
    this.validateActiveRule();

    const rule = this.currentRule as MutablePropertyMethodTransformRule;
    rule.transform = {
      ...rule.transform,
      parameterType: type,
    };
    return this;
  }

  /**
   * Set the value extraction code
   */
  setExtractor(code: string): this {
    this.validateActiveRule();

    const rule = this.currentRule as MutablePropertyMethodTransformRule;
    rule.transform = {
      ...rule.transform,
      extractValue: code,
    };
    return this;
  }

  /**
   * Set the validation code
   */
  setValidator(code: string): this {
    this.validateActiveRule();

    const rule = this.currentRule as MutablePropertyMethodTransformRule;
    rule.transform = {
      ...rule.transform,
      validate: code,
    };
    return this;
  }

  /**
   * Complete the current rule and prepare for the next one
   */
  done(): this {
    this.completeCurrentRule();
    return this;
  }

  /**
   * Build and return the transformation function.
   * The returned function can be used to transform property method contexts.
   *
   * @returns A function that takes a PropertyMethodContext and returns a PropertyMethodTransform or empty object
   * @throws Error if there are unfinished rules (call done() to complete them)
   * @example
   * ```typescript
   * const transform = builder.build();
   * const result = transform(propertyMethodContext);
   * ```
   */
  build(): (context: PropertyMethodContext) => PropertyMethodTransform {
    this.validateReadyToBuild();

    return (context: PropertyMethodContext) => {
      for (const rule of this.rules) {
        if (rule.predicate(context)) {
          return rule.transform;
        }
      }
      return {};
    };
  }

  /**
   * Check if a rule is complete - required by base class
   */
  protected isRuleComplete(rule: Partial<MutablePropertyMethodTransformRule>): boolean {
    return !!(rule.predicate && rule.transform);
  }

  /**
   * Get all defined rules
   */
  getRules(): readonly PropertyMethodTransformRule[] {
    return this.rules;
  }
}

/**
 * Builder for value transformations
 * Provides a fluent API for transforming values in builders
 */
interface MutableValueTransformRule {
  predicate: (context: ValueContext) => boolean;
  transform: {
    condition?: string;
    transform: string;
  };
}

export class ValueTransformBuilder extends BaseRuleBuilder<
  ValueTransformRule,
  ValueContext,
  ValueTransform | null
> {
  /**
   * Start a new transformation rule with a condition
   */
  when(predicate: (context: ValueContext) => boolean): this {
    this.validateNoActiveRule();

    this.currentRule = {
      predicate,
      transform: { transform: '' },
    };
    return this;
  }

  /**
   * Set a condition for when the transformation should apply
   */
  condition(code: string): this {
    this.validateActiveRule();

    const rule = this.currentRule as MutableValueTransformRule;
    rule.transform = {
      ...rule.transform,
      condition: code,
      transform: rule.transform?.transform || '',
    };
    return this;
  }

  /**
   * Set the transformation code
   */
  transform(code: string): this {
    this.validateActiveRule();

    const rule = this.currentRule as MutableValueTransformRule;
    rule.transform = {
      ...rule.transform,
      transform: code,
    };
    return this;
  }

  /**
   * Wrap the value with a function call
   */
  wrap(wrapper: string): this {
    this.validateActiveRule();

    // If wrapper contains VALUE, replace it. Otherwise wrap the value
    const transformCode = wrapper.includes('VALUE')
      ? wrapper.replace(/VALUE/g, 'value')
      : `${wrapper}(value)`;

    const rule = this.currentRule as MutableValueTransformRule;
    rule.transform = {
      ...rule.transform,
      transform: transformCode,
    };
    return this;
  }

  /**
   * Complete the current rule
   */
  done(): this {
    this.completeCurrentRule();
    return this;
  }

  /**
   * Build and return the transformation function
   */
  build(): (context: ValueContext) => ValueTransform | null {
    this.validateReadyToBuild();

    return (context: ValueContext) => {
      for (const rule of this.rules) {
        if (rule.predicate(context)) {
          return rule.transform;
        }
      }
      return null;
    };
  }

  /**
   * Check if a rule is complete - required by base class
   */
  protected isRuleComplete(rule: Partial<MutableValueTransformRule>): boolean {
    return !!(rule.predicate && rule.transform && rule.transform.transform);
  }
}

/**
 * Builder for build method transformations
 * Provides a fluent API for modifying the build method
 */
export class BuildMethodTransformBuilder {
  private transformations: BuildMethodTransformation[] = [];

  /**
   * Insert code before a marker
   */
  insertBefore(
    marker: string | RegExp,
    code: string | ((context: BuildMethodContext) => string),
  ): this {
    this.transformations.push({
      type: 'insertBefore',
      marker,
      code,
    });
    return this;
  }

  /**
   * Insert code after a marker
   */
  insertAfter(
    marker: string | RegExp,
    code: string | ((context: BuildMethodContext) => string),
  ): this {
    this.transformations.push({
      type: 'insertAfter',
      marker,
      code,
    });
    return this;
  }

  /**
   * Replace a pattern with new code
   */
  replace(
    pattern: string | RegExp,
    replacement: string | ((match: string, context: BuildMethodContext) => string),
  ): this {
    this.transformations.push({
      type: 'replace',
      marker: pattern,
      code: '', // Empty code for replace operation
      replacement,
    });
    return this;
  }

  /**
   * Wrap the entire method with before and after code
   */
  wrapMethod(
    before: string | ((context: BuildMethodContext) => string),
    after: string | ((match: string, context: BuildMethodContext) => string),
  ): this {
    this.transformations.push({
      type: 'wrap',
      code: before,
      replacement: after,
    });
    return this;
  }

  /**
   * Build and return the transformation function
   */
  build(): (context: BuildMethodContext) => string {
    return (context: BuildMethodContext) => {
      let code = context.buildMethodCode;

      for (const transformation of this.transformations) {
        const insertCode =
          typeof transformation.code === 'function'
            ? transformation.code(context)
            : transformation.code;

        switch (transformation.type) {
          case 'insertBefore':
            if (transformation.marker) {
              if (typeof transformation.marker === 'string') {
                const index = code.indexOf(transformation.marker);
                if (index !== -1) {
                  code = code.slice(0, index) + insertCode + '\n' + code.slice(index);
                }
              } else {
                code = code.replace(transformation.marker, insertCode + '\n$&');
              }
            }
            break;

          case 'insertAfter':
            if (transformation.marker) {
              if (typeof transformation.marker === 'string') {
                const index = code.indexOf(transformation.marker);
                if (index !== -1) {
                  const endIndex = index + transformation.marker.length;
                  code = code.slice(0, endIndex) + '\n' + insertCode + code.slice(endIndex);
                }
              } else {
                code = code.replace(transformation.marker, '$&\n' + insertCode);
              }
            }
            break;

          case 'replace':
            if (transformation.marker && transformation.replacement) {
              if (typeof transformation.marker === 'string') {
                if (typeof transformation.replacement === 'function') {
                  code = code.replace(
                    transformation.marker,
                    transformation.replacement('', context),
                  );
                } else {
                  code = code.replace(transformation.marker, transformation.replacement);
                }
              } else {
                // transformation.marker is RegExp
                const replacementFn = transformation.replacement;
                if (typeof replacementFn === 'function') {
                  code = code.replace(transformation.marker, (match: string) =>
                    replacementFn(match, context),
                  );
                } else if (replacementFn) {
                  code = code.replace(transformation.marker, replacementFn);
                }
              }
            }
            break;

          case 'wrap':
            if (insertCode && transformation.replacement) {
              const afterCode =
                typeof transformation.replacement === 'function'
                  ? transformation.replacement('', context)
                  : transformation.replacement;
              code = insertCode + '\n' + code + '\n' + afterCode;
            }
            break;
        }
      }

      return code;
    };
  }

  /**
   * Get all transformations
   */
  getTransformations(): readonly BuildMethodTransformation[] {
    return this.transformations;
  }
}

/**
 * Builder for custom methods
 * Provides a fluent API for defining custom methods on builders
 */
export class CustomMethodBuilder {
  private definition: {
    name?: string;
    parameters?: readonly MethodParameter[];
    returnType?: string | ((context: BuilderContext) => string);
    implementation?: string | ((context: BuilderContext) => string);
    jsDoc?: string;
  } = {};

  /**
   * Set the method name
   */
  name(name: string): this {
    this.definition.name = name;
    return this;
  }

  /**
   * Set method parameters
   */
  parameters(params: MethodParameter[]): this {
    this.definition = { ...this.definition, parameters: params };
    return this;
  }

  /**
   * Add a single parameter
   */
  parameter(
    name: string,
    type: string,
    options?: { optional?: boolean; defaultValue?: string },
  ): this {
    const params = [...(this.definition.parameters || [])];
    params.push({
      name,
      type,
      ...(options?.optional ? { isOptional: options.optional } : {}),
      ...(options?.defaultValue ? { defaultValue: options.defaultValue } : {}),
    });
    this.definition = { ...this.definition, parameters: params };
    return this;
  }

  /**
   * Set the return type
   */
  returns(type: string | ((context: BuilderContext) => string)): this {
    this.definition = { ...this.definition, returnType: type };
    return this;
  }

  /**
   * Set the implementation
   */
  implementation(code: string | ((context: BuilderContext) => string)): this {
    this.definition = { ...this.definition, implementation: code };
    return this;
  }

  /**
   * Set JSDoc comment
   */
  jsDoc(doc: string): this {
    this.definition = { ...this.definition, jsDoc: doc };
    return this;
  }

  /**
   * Build the custom method definition
   */
  build(): CustomMethodDefinition {
    if (!this.definition.name) {
      throw new Error('Method name is required');
    }

    if (!this.definition.implementation) {
      throw new Error('Method implementation is required');
    }

    return {
      name: this.definition.name,
      parameters: this.definition.parameters || [],
      returnType: this.definition.returnType || 'this',
      implementation: this.definition.implementation,
      ...(this.definition.jsDoc ? { jsDoc: this.definition.jsDoc } : {}),
    };
  }
}

/**
 * Creates a new PropertyMethodTransformBuilder instance.
 * @returns A new PropertyMethodTransformBuilder for configuring property method transformations
 */
export function createPropertyMethodTransformBuilder(): PropertyMethodTransformBuilder {
  return new PropertyMethodTransformBuilder();
}

export function createValueTransformBuilder(): ValueTransformBuilder {
  return new ValueTransformBuilder();
}

export function createBuildMethodTransformBuilder(): BuildMethodTransformBuilder {
  return new BuildMethodTransformBuilder();
}

export function createCustomMethodBuilder(): CustomMethodBuilder {
  return new CustomMethodBuilder();
}
