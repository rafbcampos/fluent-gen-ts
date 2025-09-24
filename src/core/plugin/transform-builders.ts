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
 * Builder for property method transformations
 * Provides a fluent API for defining how property methods are transformed
 */
interface MutablePropertyMethodTransformRule {
  predicate: (context: PropertyMethodContext) => boolean;
  transform: {
    parameterType?: string;
    extractValue?: string;
    validate?: string;
  };
}

export class PropertyMethodTransformBuilder {
  private rules: PropertyMethodTransformRule[] = [];
  private currentRule: Partial<MutablePropertyMethodTransformRule> | null = null;

  /**
   * Start a new transformation rule with a condition
   */
  when(predicate: (context: PropertyMethodContext) => boolean): this {
    if (this.currentRule) {
      throw new Error('Previous transformation rule not completed. Call done() first.');
    }

    this.currentRule = {
      predicate,
      transform: {},
    };
    return this;
  }

  /**
   * Set the parameter type transformation
   */
  setParameter(type: string | ((original: string) => string)): this {
    if (!this.currentRule) {
      throw new Error('No active rule. Call when() first.');
    }

    if (typeof type === 'function') {
      // Will be applied to the original type string
      this.currentRule.transform = {
        ...this.currentRule.transform,
        parameterType: '__FUNCTION__', // Placeholder, will be handled in build
      };
      // Store the function separately (would need to enhance the type)
    } else {
      this.currentRule.transform = {
        ...this.currentRule.transform,
        parameterType: type,
      };
    }
    return this;
  }

  /**
   * Set the value extraction code
   */
  setExtractor(code: string): this {
    if (!this.currentRule) {
      throw new Error('No active rule. Call when() first.');
    }

    this.currentRule.transform = {
      ...this.currentRule.transform,
      extractValue: code,
    };
    return this;
  }

  /**
   * Set the validation code
   */
  setValidator(code: string): this {
    if (!this.currentRule) {
      throw new Error('No active rule. Call when() first.');
    }

    this.currentRule.transform = {
      ...this.currentRule.transform,
      validate: code,
    };
    return this;
  }

  /**
   * Complete the current rule and prepare for the next one
   */
  done(): this {
    if (!this.currentRule) {
      throw new Error('No active rule to complete.');
    }

    if (!this.currentRule.predicate || !this.currentRule.transform) {
      throw new Error('Rule is incomplete.');
    }

    this.rules.push(this.currentRule as PropertyMethodTransformRule);
    this.currentRule = null;
    return this;
  }

  /**
   * Build and return the transformation function
   */
  build(): (context: PropertyMethodContext) => PropertyMethodTransform {
    if (this.currentRule) {
      throw new Error('Unfinished rule. Call done() to complete it.');
    }

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

export class ValueTransformBuilder {
  private rules: ValueTransformRule[] = [];
  private currentRule: Partial<MutableValueTransformRule> | null = null;

  /**
   * Start a new transformation rule with a condition
   */
  when(predicate: (context: ValueContext) => boolean): this {
    if (this.currentRule) {
      throw new Error('Previous transformation rule not completed. Call done() first.');
    }

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
    if (!this.currentRule) {
      throw new Error('No active rule. Call when() first.');
    }

    this.currentRule.transform = {
      transform: this.currentRule.transform?.transform || '',
      ...this.currentRule.transform,
      condition: code,
    };
    return this;
  }

  /**
   * Set the transformation code
   */
  transform(code: string): this {
    if (!this.currentRule) {
      throw new Error('No active rule. Call when() first.');
    }

    this.currentRule.transform = {
      ...this.currentRule.transform,
      transform: code,
    };
    return this;
  }

  /**
   * Wrap the value with a function call
   */
  wrap(wrapper: string): this {
    if (!this.currentRule) {
      throw new Error('No active rule. Call when() first.');
    }

    // If wrapper contains VALUE, replace it. Otherwise wrap the value
    const transformCode = wrapper.includes('VALUE')
      ? wrapper.replace(/VALUE/g, 'value')
      : `${wrapper}(value)`;

    this.currentRule.transform = {
      ...this.currentRule.transform,
      transform: transformCode,
    };
    return this;
  }

  /**
   * Complete the current rule
   */
  done(): this {
    if (!this.currentRule) {
      throw new Error('No active rule to complete.');
    }

    if (!this.currentRule.predicate || !this.currentRule.transform) {
      throw new Error('Rule is incomplete.');
    }

    this.rules.push(this.currentRule as ValueTransformRule);
    this.currentRule = null;
    return this;
  }

  /**
   * Build and return the transformation function
   */
  build(): (context: ValueContext) => ValueTransform | null {
    if (this.currentRule) {
      throw new Error('Unfinished rule. Call done() to complete it.');
    }

    return (context: ValueContext) => {
      for (const rule of this.rules) {
        if (rule.predicate(context)) {
          return rule.transform;
        }
      }
      return null;
    };
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
              const replacementCode =
                typeof transformation.replacement === 'function'
                  ? (match: string) => (transformation.replacement as Function)(match, context)
                  : transformation.replacement;

              if (typeof transformation.marker === 'string') {
                code = code.replace(transformation.marker, replacementCode as string);
              } else {
                code = code.replace(transformation.marker, replacementCode as any);
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
 * Helper functions to create builders
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
