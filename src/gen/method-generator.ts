/**
 * Method generation utilities for builder classes
 * Handles generation of builder methods and interfaces
 */

import type { TypeInfo, PropertyInfo, IndexSignature } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import type {
  PluginManager,
  PropertyMethodContext,
  CustomMethod,
  BuilderContext,
} from '../core/plugin.js';
import { TypeStringGenerator } from './type-string-generator.js';
import { isIndexSignature } from './types.js';
import { collectAllProperties } from '../type-info/type-utils.js';
import { isIntersectionTypeInfo } from '../type-info/type-guards.js';

/**
 * Configuration for method generation
 */
export interface MethodGeneratorConfig {
  /** Whether to add JSDoc comments */
  readonly addComments: boolean;
  /** Context type for builders */
  readonly contextType: string;
  /** Plugin manager for method transformations */
  readonly pluginManager?: PluginManager;
}

/**
 * Parameters for generating builder interface
 */
interface BuilderInterfaceParams {
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
  readonly config: MethodGeneratorConfig;
}

/**
 * Parameters for generating class methods
 */
interface ClassMethodsParams {
  readonly typeInfo: TypeInfo;
  readonly builderName: string;
  readonly genericConstraints: string;
  readonly config: MethodGeneratorConfig;
  readonly typeName: string;
}

/**
 * Parameters for generating individual with* methods
 */
interface WithMethodParams {
  readonly property: PropertyInfo;
  readonly builderName: string;
  readonly genericConstraints: string;
  readonly config: MethodGeneratorConfig;
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
}

/**
 * Parameters for generating interface method signatures
 */
interface InterfaceMethodParams {
  readonly typeInfo: TypeInfo;
  readonly builderName: string;
  readonly genericConstraints: string;
  readonly config: MethodGeneratorConfig;
  readonly typeName: string;
}

/**
 * Parameters for generating build method
 */
interface BuildMethodParams {
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
  readonly config: MethodGeneratorConfig;
}

/**
 * Context for generic parameter formatting
 */
interface GenericContext {
  readonly genericParams: string;
  readonly genericConstraints: string;
}

/**
 * Parameters for index signature method generation
 */
interface IndexSignatureMethodParams {
  readonly indexSignature: IndexSignature;
  readonly builderName: string;
  readonly genericConstraints: string;
  readonly config: MethodGeneratorConfig;
}

/**
 * Shared utilities for method generation
 */
class MethodGeneratorUtils {
  private readonly typeStringGenerator = new TypeStringGenerator();

  /**
   * Type guard to check if typeInfo is an object type
   */
  isObjectType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> {
    return typeInfo.kind === TypeKind.Object;
  }

  /**
   * Gets the builder class name for a type
   */
  getBuilderName(typeName: string): string {
    return `${typeName}Builder`;
  }

  /**
   * Converts property names to valid method names
   * Handles kebab-case and reserved keywords
   */
  getMethodName(propertyName: string): string {
    return `with${this.capitalizePropertyName(propertyName)}`;
  }

  /**
   * Capitalizes property names for method names
   * Converts kebab-case to PascalCase
   */
  private capitalizePropertyName(str: string): string {
    return str
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Gets generic parameter information for a type
   */
  getGenericContext(typeInfo: TypeInfo): GenericContext {
    if (!this.isObjectType(typeInfo)) {
      return { genericParams: '', genericConstraints: '' };
    }

    return {
      genericParams: this.typeStringGenerator.formatGenericParams(typeInfo.genericParams),
      genericConstraints: this.typeStringGenerator.formatGenericConstraints(typeInfo.genericParams),
    };
  }

  /**
   * Generates JSDoc comment for a property
   */
  generateJsDoc(property: PropertyInfo, addComments: boolean): string {
    if (!addComments || !property.jsDoc) {
      return '';
    }
    return `  /** ${property.jsDoc} */\n`;
  }

  /**
   * Creates plugin context for property method transformation
   */
  createPropertyMethodContext(params: WithMethodParams): PropertyMethodContext {
    const propertyType = params.property.type;

    return {
      property: params.property,
      propertyType: propertyType,
      originalTypeString: this.typeStringGenerator.getPropertyType(params.property),
      builderName: params.builderName,
      typeName: params.typeName,
      typeInfo: params.typeInfo,

      // Helper methods
      isType(kind: TypeKind): boolean {
        return propertyType.kind === kind;
      },

      hasGenericConstraint(constraintName: string): boolean {
        if (propertyType.kind === TypeKind.Generic && 'constraint' in propertyType) {
          const constraint = propertyType.constraint;
          if (
            constraint &&
            typeof constraint === 'object' &&
            'name' in constraint &&
            typeof constraint.name === 'string'
          ) {
            return constraint.name === constraintName;
          }
        }
        return false;
      },

      isArrayType(): boolean {
        return propertyType.kind === TypeKind.Array;
      },

      isUnionType(): boolean {
        return propertyType.kind === TypeKind.Union;
      },

      isPrimitiveType(name?: string): boolean {
        if (propertyType.kind !== TypeKind.Primitive) {
          return false;
        }
        if (name && 'name' in propertyType && typeof propertyType.name === 'string') {
          return propertyType.name === name;
        }
        return !name;
      },
    };
  }

  /**
   * Creates builder context for custom methods
   */
  createBuilderContext(params: InterfaceMethodParams): BuilderContext {
    const { genericParams } = this.getGenericContext(params.typeInfo);

    return {
      typeName: params.typeName,
      builderName: params.builderName,
      typeInfo: params.typeInfo,
      properties: this.isObjectType(params.typeInfo) ? params.typeInfo.properties : [],
      genericParams,
      genericConstraints: params.genericConstraints,
    };
  }

  /**
   * Determines if a type should have default values
   */
  shouldHaveDefaults(typeInfo: TypeInfo): boolean {
    if (!this.isObjectType(typeInfo)) {
      return false;
    }

    return typeInfo.properties.some(
      prop =>
        !prop.optional &&
        prop.type.kind !== TypeKind.Object &&
        prop.type.kind !== TypeKind.Reference,
    );
  }

  /**
   * Gets the TypeStringGenerator instance
   */
  getTypeStringGenerator(): TypeStringGenerator {
    return this.typeStringGenerator;
  }

  /**
   * Validates that a type name is non-empty and valid
   */
  validateTypeName(typeName: string): string {
    if (!typeName || typeof typeName !== 'string' || typeName.trim().length === 0) {
      throw new Error('Type name must be a non-empty string');
    }
    return typeName.trim();
  }

  /**
   * Validates property name for JavaScript identifier compatibility
   */
  validatePropertyName(propertyName: string): string {
    if (!propertyName || typeof propertyName !== 'string') {
      throw new Error('Property name must be a non-empty string');
    }

    // Allow any string as property name since we use bracket notation for setting values
    // The method name conversion handles kebab-case and other special characters
    return propertyName;
  }

  /**
   * Safely formats plugin transform result
   */
  safeFormatPluginTransform(transform: unknown): {
    parameterType?: string;
    extractValue?: string;
    validate?: string;
  } {
    if (!transform || typeof transform !== 'object') {
      return {};
    }

    const safeTransform = transform as Record<string, unknown>;
    const result: {
      parameterType?: string;
      extractValue?: string;
      validate?: string;
    } = {};

    if (typeof safeTransform.parameterType === 'string' && safeTransform.parameterType.trim()) {
      result.parameterType = safeTransform.parameterType.trim();
    }

    if (typeof safeTransform.extractValue === 'string' && safeTransform.extractValue.trim()) {
      result.extractValue = safeTransform.extractValue.trim();
    }

    if (typeof safeTransform.validate === 'string' && safeTransform.validate.trim()) {
      result.validate = safeTransform.validate.trim();
    }

    return result;
  }

  /**
   * Validates that TypeInfo has required properties for object types
   */
  validateObjectTypeInfo(typeInfo: TypeInfo): void {
    if (!this.isObjectType(typeInfo)) {
      throw new Error(`Expected object type, got ${typeInfo.kind}`);
    }

    if (!Array.isArray(typeInfo.properties)) {
      throw new Error('Object type must have properties array');
    }
  }
}

/**
 * Generates methods for builder classes
 */
export class MethodGenerator {
  private readonly utils = new MethodGeneratorUtils();

  /**
   * Generates the builder interface with methods
   */
  async generateBuilderInterface(
    typeName: string,
    typeInfo: TypeInfo,
    config: MethodGeneratorConfig,
  ): Promise<string> {
    const params: BuilderInterfaceParams = { typeName, typeInfo, config };
    return this.generateBuilderInterfaceFromParams(params);
  }

  /**
   * Generates builder class methods
   */
  async generateClassMethods(
    typeInfo: TypeInfo,
    builderName: string,
    genericConstraints: string,
    config: MethodGeneratorConfig,
    typeName: string,
  ): Promise<string> {
    const params: ClassMethodsParams = {
      typeInfo,
      builderName,
      genericConstraints,
      config,
      typeName,
    };
    return this.generateClassMethodsFromParams(params);
  }

  /**
   * Generates the build method for a builder
   */
  generateBuildMethod(typeName: string, typeInfo: TypeInfo, config: MethodGeneratorConfig): string {
    const params: BuildMethodParams = { typeName, typeInfo, config };
    return this.generateBuildMethodFromParams(params);
  }

  /**
   * Internal implementation for generating builder interface
   */
  private async generateBuilderInterfaceFromParams(
    params: BuilderInterfaceParams,
  ): Promise<string> {
    // Validate inputs
    const validatedTypeName = this.utils.validateTypeName(params.typeName);

    const builderName = this.utils.getBuilderName(validatedTypeName);
    const { genericParams } = this.utils.getGenericContext(params.typeInfo);

    const methods = await this.generateInterfaceMethodSignatures({
      typeInfo: params.typeInfo,
      builderName,
      genericConstraints: this.utils.getGenericContext(params.typeInfo).genericConstraints,
      config: params.config,
      typeName: validatedTypeName,
    });

    return `
export interface ${builderName}Methods${genericParams} {
${methods}
}`.trim();
  }

  /**
   * Internal implementation for generating class methods
   */
  private async generateClassMethodsFromParams(params: ClassMethodsParams): Promise<string> {
    // Check if this is a type that can have properties (object or intersection types)
    if (!this.utils.isObjectType(params.typeInfo) && !isIntersectionTypeInfo(params.typeInfo)) {
      return '';
    }

    // Validate object type structure for object types
    if (this.utils.isObjectType(params.typeInfo)) {
      this.utils.validateObjectTypeInfo(params.typeInfo);
    }

    // Collect all properties, handling intersection types properly
    const allProperties = collectAllProperties(params.typeInfo);

    const methods: string[] = [];

    // Generate standard with* methods
    for (const property of allProperties) {
      try {
        // Skip properties with never type - they should not exist in interfaces
        if (property.type.kind === TypeKind.Never) {
          continue;
        }

        // Validate property
        this.utils.validatePropertyName(property.name);

        const method = await this.generateWithMethod({
          property,
          builderName: params.builderName,
          genericConstraints: params.genericConstraints,
          config: params.config,
          typeName: params.typeName,
          typeInfo: params.typeInfo,
        });
        methods.push(method);
      } catch (error) {
        // Log error but continue with other properties
        console.warn(`Skipping invalid property ${property.name}:`, error);
      }
    }

    // Add withAdditionalProperties method if there's an index signature (only for object types)
    if (
      this.utils.isObjectType(params.typeInfo) &&
      params.typeInfo.indexSignature &&
      isIndexSignature(params.typeInfo.indexSignature)
    ) {
      methods.push(
        this.generateIndexSignatureMethod({
          indexSignature: params.typeInfo.indexSignature,
          builderName: params.builderName,
          genericConstraints: params.genericConstraints,
          config: params.config,
        }),
      );
    }

    return methods.join('\n\n');
  }

  /**
   * Internal implementation for generating build method
   */
  private generateBuildMethodFromParams(params: BuildMethodParams): string {
    // Validate inputs
    const validatedTypeName = this.utils.validateTypeName(params.typeName);
    const builderName = this.utils.getBuilderName(validatedTypeName);
    const { genericConstraints } = this.utils.getGenericContext(params.typeInfo);

    const hasDefaults = this.utils.shouldHaveDefaults(params.typeInfo);
    const defaultsReference = hasDefaults ? `${builderName}.defaults` : 'undefined';

    return `  /**
   * Builds the final ${validatedTypeName} object
   * @param context - Optional build context for nested builders
   */
  build(context?: ${params.config.contextType}): ${validatedTypeName}${genericConstraints} {
    return this.buildWithDefaults(${defaultsReference}, context);
  }`;
  }

  /**
   * Generates interface method signatures
   */
  private async generateInterfaceMethodSignatures(params: InterfaceMethodParams): Promise<string> {
    // Check if this is a type that can have properties (object or intersection types)
    if (!this.utils.isObjectType(params.typeInfo) && !isIntersectionTypeInfo(params.typeInfo)) {
      return '';
    }

    // Collect all properties, handling intersection types properly
    const allProperties = collectAllProperties(params.typeInfo);

    const methodSignatures: string[] = [];

    // Generate property method signatures
    for (const property of allProperties) {
      // Skip properties with never type - they should not exist in interfaces
      if (property.type.kind === TypeKind.Never) {
        continue;
      }

      const signature = await this.generatePropertyMethodSignature({
        property,
        builderName: params.builderName,
        genericConstraints: params.genericConstraints,
        config: params.config,
        typeName: params.typeName,
        typeInfo: params.typeInfo,
      });
      methodSignatures.push(signature);
    }

    // Add custom method signatures from plugins
    if (params.config.pluginManager) {
      const customSignatures = await this.generateCustomMethodSignatures(params);
      if (customSignatures) {
        methodSignatures.push(customSignatures);
      }
    }

    return methodSignatures.join('\n');
  }

  /**
   * Generates a single property method signature
   */
  private async generatePropertyMethodSignature(params: WithMethodParams): Promise<string> {
    const methodName = this.utils.getMethodName(params.property.name);
    let paramType = this.utils.getTypeStringGenerator().getPropertyType(params.property);
    const returnType = `${params.builderName}${params.genericConstraints}`;
    const jsDoc = this.utils.generateJsDoc(params.property, params.config.addComments);

    // Apply plugin transformations if available
    if (params.config.pluginManager) {
      try {
        const context = this.utils.createPropertyMethodContext(params);
        const transform = params.config.pluginManager.getPropertyMethodTransform(context);
        const safeTransform = this.utils.safeFormatPluginTransform(transform);
        if (safeTransform.parameterType) {
          paramType = safeTransform.parameterType;
        }
      } catch (error) {
        console.warn(`Plugin transformation failed for property ${params.property.name}:`, error);
      }
    }

    return `${jsDoc}  ${methodName}(value: ${paramType}): ${returnType};`;
  }

  /**
   * Generates a single with* method implementation
   */
  private async generateWithMethod(params: WithMethodParams): Promise<string> {
    const methodName = this.utils.getMethodName(params.property.name);
    let paramType = this.utils.getTypeStringGenerator().getPropertyType(params.property);
    let implementation = `return this.set("${params.property.name}", value);`;

    // Apply plugin transformations if available
    if (params.config.pluginManager) {
      try {
        const context = this.utils.createPropertyMethodContext(params);
        const transform = params.config.pluginManager.getPropertyMethodTransform(context);
        const safeTransform = this.utils.safeFormatPluginTransform(transform);

        if (safeTransform.parameterType) {
          paramType = safeTransform.parameterType;
        }

        if (safeTransform.extractValue || safeTransform.validate) {
          const extractCode = safeTransform.extractValue
            ? `const extractedValue = ${safeTransform.extractValue};`
            : 'const extractedValue = value;';

          const validateCode = safeTransform.validate ? `${safeTransform.validate};` : '';

          implementation = `
    ${extractCode}
    ${validateCode}
    return this.set("${params.property.name}", extractedValue);
  `.trim();
        }
      } catch (error) {
        console.warn(`Plugin transformation failed for property ${params.property.name}:`, error);
      }
    }

    const jsDoc = this.utils.generateJsDoc(params.property, params.config.addComments);

    return `${jsDoc}  ${methodName}(value: ${paramType}): ${params.builderName}${params.genericConstraints} {
    ${implementation}
  }`;
  }

  /**
   * Generates method for index signature support
   */
  private generateIndexSignatureMethod(params: IndexSignatureMethodParams): string {
    const valueType = this.utils
      .getTypeStringGenerator()
      .typeInfoToString(params.indexSignature.valueType);
    const keyType = params.indexSignature.keyType;
    const jsDoc = params.config.addComments
      ? `  /**
   * Set additional properties with dynamic keys
   * @param props - Object with dynamic properties
   */
`
      : '';

    return `${jsDoc}  withAdditionalProperties(props: Record<${keyType}, ${valueType}>): ${params.builderName}${params.genericConstraints} {
    Object.assign(this.values, props);
    return this as ${params.builderName}${params.genericConstraints};
  }`;
  }

  /**
   * Generates custom method signatures for interfaces
   */
  private async generateCustomMethodSignatures(params: InterfaceMethodParams): Promise<string> {
    if (!params.config.pluginManager || !this.utils.isObjectType(params.typeInfo)) {
      return '';
    }

    try {
      const context = this.utils.createBuilderContext(params);
      const customMethods = params.config.pluginManager.getCustomMethods(context);

      if (!Array.isArray(customMethods) || customMethods.length === 0) {
        return '';
      }

      const validMethods = customMethods
        .filter((method): method is CustomMethod => {
          // Validate method structure
          return (
            method &&
            typeof method === 'object' &&
            typeof method.name === 'string' &&
            method.name.trim().length > 0 &&
            typeof method.signature === 'string' &&
            method.signature.trim().length > 0
          );
        })
        .map(method => {
          const jsDoc = typeof method.jsDoc === 'string' ? method.jsDoc : '';
          return `${jsDoc}  ${method.name.trim()}${method.signature.trim()}: ${params.builderName}${params.genericConstraints};`;
        });

      return validMethods.join('\n');
    } catch (error) {
      console.warn('Failed to generate custom method signatures:', error);
      return '';
    }
  }
}
