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
} from '../core/plugin/index.js';
import { enhancePropertyMethodContext, enhanceBuilderContext } from '../core/plugin/index.js';
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
   * @param typeInfo - The type info to check
   * @returns True if the type is an object type with properties
   */
  isObjectType(typeInfo: TypeInfo): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> {
    return typeInfo.kind === TypeKind.Object;
  }

  /**
   * Gets the builder class name for a type
   * @param typeName - The name of the type to create a builder for
   * @returns The builder class name (e.g., "User" -> "UserBuilder")
   */
  getBuilderName(typeName: string): string {
    return `${typeName}Builder`;
  }

  /**
   * Converts property names to valid method names
   * Handles kebab-case and reserved keywords
   * @param propertyName - The property name to convert (e.g., "user-name", "class")
   * @returns The method name (e.g., "withUserName", "withClass")
   * @example
   * getMethodName("user-name") // "withUserName"
   * getMethodName("id") // "withId"
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
   * @param typeInfo - The type info to extract generic information from
   * @returns Object containing formatted generic parameters and constraints
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
    const originalTypeString = this.typeStringGenerator.getPropertyType(params.property);

    return enhancePropertyMethodContext(
      params.property,
      propertyType,
      params.builderName,
      params.typeName,
      params.typeInfo,
      originalTypeString,
    );
  }

  /**
   * Creates builder context for custom methods
   */
  createBuilderContext(params: InterfaceMethodParams): BuilderContext {
    const { genericParams } = this.getGenericContext(params.typeInfo);
    const properties = this.isObjectType(params.typeInfo) ? params.typeInfo.properties : [];

    return enhanceBuilderContext(
      params.typeName,
      params.typeInfo,
      params.builderName,
      properties,
      genericParams,
      params.genericConstraints,
    );
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
   * Type guard for PropertyMethodTransform
   */
  private isPropertyMethodTransform(
    value: unknown,
  ): value is import('../core/plugin/plugin-types.js').PropertyMethodTransform & {
    parameterType?: string | ((context: PropertyMethodContext) => string);
    extractValue?: string;
    validate?: string;
  } {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const obj = value as Record<string, unknown>;

    // Check parameterType: can be string, function, or undefined
    if (obj.parameterType !== undefined) {
      if (typeof obj.parameterType !== 'string' && typeof obj.parameterType !== 'function') {
        return false;
      }
    }

    // Check extractValue: must be string or undefined
    if (obj.extractValue !== undefined && typeof obj.extractValue !== 'string') {
      return false;
    }

    // Check validate: must be string or undefined
    if (obj.validate !== undefined && typeof obj.validate !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Resolves a parameter type that can be either static or dynamic
   */
  private resolveParameterType(params: {
    parameterType: string | ((context: PropertyMethodContext) => string);
    context: PropertyMethodContext;
  }): string | null {
    const { parameterType, context } = params;

    if (typeof parameterType === 'string') {
      const trimmed = parameterType.trim();
      return trimmed || null;
    }

    if (typeof parameterType === 'function') {
      try {
        const result = parameterType(context);
        if (typeof result !== 'string') {
          return null;
        }
        const trimmed = result.trim();
        return trimmed || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Safely formats plugin transform result
   */
  safeFormatPluginTransform(params: { transform: unknown; context: PropertyMethodContext }): {
    parameterType?: string;
    extractValue?: string;
    validate?: string;
  } {
    const { transform, context } = params;

    if (!this.isPropertyMethodTransform(transform)) {
      return {};
    }

    const result: {
      parameterType?: string;
      extractValue?: string;
      validate?: string;
    } = {};

    // Resolve parameter type (can be string or function)
    if (transform.parameterType !== undefined) {
      const resolved = this.resolveParameterType({
        parameterType: transform.parameterType,
        context,
      });
      if (resolved) {
        result.parameterType = resolved;
      }
    }

    // Extract value must be string
    if (typeof transform.extractValue === 'string') {
      const trimmed = transform.extractValue.trim();
      if (trimmed) {
        result.extractValue = trimmed;
      }
    }

    // Validate must be string
    if (typeof transform.validate === 'string') {
      const trimmed = transform.validate.trim();
      if (trimmed) {
        result.validate = trimmed;
      }
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

  /**
   * Validates custom method structure
   * @param method - The method object to validate
   * @returns True if the method has valid name and signature properties
   */
  validateCustomMethod(method: unknown): method is CustomMethod {
    if (!method || typeof method !== 'object') {
      return false;
    }

    const candidate = method as Record<string, unknown>;
    return (
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0 &&
      typeof candidate.signature === 'string' &&
      candidate.signature.trim().length > 0
    );
  }

  /**
   * Validates custom method with implementation
   * @param method - The method object to validate
   * @returns True if the method has valid name, signature, and implementation properties
   */
  validateCustomMethodWithImplementation(method: unknown): method is CustomMethod {
    if (!this.validateCustomMethod(method)) {
      return false;
    }

    return method.implementation.trim().length > 0;
  }

  /**
   * Gets custom methods from plugin manager with error handling
   * @param builderContext - The builder context for the plugin
   * @param pluginManager - The plugin manager to get methods from
   * @returns Array of custom methods, or empty array if none found or on error
   */
  getCustomMethodsSafely(
    builderContext: BuilderContext,
    pluginManager: PluginManager,
  ): CustomMethod[] {
    try {
      const customMethods = pluginManager.getCustomMethods(builderContext);
      if (!Array.isArray(customMethods) || customMethods.length === 0) {
        return [];
      }
      return customMethods;
    } catch {
      return [];
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
   * @param typeName - The name of the type to generate builder interface for
   * @param typeInfo - Complete type information including properties and generics
   * @param config - Configuration options for method generation
   * @returns Promise resolving to the complete interface code as a string
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
   * @param typeInfo - Complete type information including properties and generics
   * @param builderName - Name of the builder class being generated
   * @param genericConstraints - Generic constraints string (e.g., "<T extends string>")
   * @param config - Configuration options for method generation
   * @param typeName - The name of the original type being built
   * @returns Promise resolving to the complete method implementations as a string
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
   * @param typeName - The name of the type being built
   * @param typeInfo - Complete type information to determine if defaults are needed
   * @param config - Configuration options including context type
   * @returns The complete build method implementation as a string
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
    const genericContext = this.utils.getGenericContext(params.typeInfo);

    const methods = await this.generateInterfaceMethodSignatures({
      typeInfo: params.typeInfo,
      builderName,
      genericConstraints: genericContext.genericConstraints,
      config: params.config,
      typeName: validatedTypeName,
    });

    return `
export interface ${builderName}Methods${genericContext.genericParams} {
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
      } catch {
        // Continue with other properties
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

    // Add custom method implementations from plugins
    const customMethodImplementations = await this.generateCustomMethodImplementations(params);
    if (customMethodImplementations.trim()) {
      methods.push(customMethodImplementations);
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
        const safeTransform = this.utils.safeFormatPluginTransform({
          transform,
          context,
        });
        if (safeTransform.parameterType) {
          paramType = safeTransform.parameterType;
        }
      } catch {
        // Continue with default parameter type
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
        const safeTransform = this.utils.safeFormatPluginTransform({
          transform,
          context,
        });

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
      } catch {
        // Continue with default implementation
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

    const context = this.utils.createBuilderContext(params);
    const customMethods = this.utils.getCustomMethodsSafely(context, params.config.pluginManager);

    const validMethods = customMethods
      .filter(method => this.utils.validateCustomMethod(method))
      .map(method => {
        const jsDocComment =
          typeof method.jsDoc === 'string' && method.jsDoc.trim()
            ? `  /** ${method.jsDoc.trim()} */\n`
            : '';
        return `${jsDocComment}  ${method.name.trim()}${method.signature.trim()}: ${params.builderName}${params.genericConstraints};`;
      });

    return validMethods.join('\n');
  }

  /**
   * Generate custom method implementations from plugins
   */
  private async generateCustomMethodImplementations(params: ClassMethodsParams): Promise<string> {
    if (!params.config.pluginManager) {
      return '';
    }

    const context = this.utils.createBuilderContext(params);
    const customMethods = this.utils.getCustomMethodsSafely(context, params.config.pluginManager);

    const validMethods = customMethods
      .filter(method => this.utils.validateCustomMethodWithImplementation(method))
      .map(method => {
        const jsDocComment =
          typeof method.jsDoc === 'string' && method.jsDoc.trim()
            ? `  /** ${method.jsDoc.trim()} */\n`
            : '';
        const implementation = method.implementation.trim();

        // The implementation should already be the complete method definition
        return `${jsDocComment}  ${implementation}`;
      });

    return validMethods.join('\n\n');
  }
}
