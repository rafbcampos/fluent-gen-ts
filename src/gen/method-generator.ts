/**
 * Method generation utilities for builder classes
 * Handles generation of builder methods and interfaces
 */

import type { TypeInfo, PropertyInfo, IndexSignature } from "../core/types.js";
import { TypeKind } from "../core/types.js";
import type {
  PluginManager,
  PropertyMethodContext,
  CustomMethod,
  BuilderContext,
} from "../core/plugin.js";
import { TypeStringGenerator } from "./type-string-generator.js";
import { isIndexSignature } from "./types.js";

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
 * Generates methods for builder classes
 */
export class MethodGenerator {
  private readonly typeStringGenerator = new TypeStringGenerator();

  /**
   * Generates the builder interface with methods
   * @param name - The type name
   * @param typeInfo - The type information
   * @param config - Method generation configuration
   */
  async generateBuilderInterface(
    name: string,
    typeInfo: TypeInfo,
    config: MethodGeneratorConfig,
  ): Promise<string> {
    const builderName = this.getBuilderName(name);
    const genericParams = this.isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericParams(typeInfo.genericParams)
      : "";
    const genericConstraints = this.isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericConstraints(
          typeInfo.genericParams,
        )
      : "";

    const methods = await this.generateInterfaceMethods(
      typeInfo,
      builderName,
      genericConstraints,
      config,
      name,
    );

    return `
export interface ${builderName}Methods${genericParams} {
${methods}
}`.trim();
  }

  /**
   * Generates builder class methods
   * @param typeInfo - The type information
   * @param builderName - Name of the builder class
   * @param genericConstraints - Generic type constraints
   * @param config - Method generation configuration
   */
  async generateClassMethods(
    typeInfo: TypeInfo,
    builderName: string,
    genericConstraints: string,
    config: MethodGeneratorConfig,
    typeName: string,
  ): Promise<string> {
    if (!this.isObjectType(typeInfo)) {
      return "";
    }

    const methods: string[] = [];

    // Generate standard with* methods
    for (const prop of typeInfo.properties) {
      const method = await this.generateWithMethodAsync(
        prop,
        builderName,
        genericConstraints,
        config,
        typeName,
        typeInfo,
      );
      methods.push(method);
    }

    // Add withAdditionalProperties method if there's an index signature
    if (typeInfo.indexSignature && isIndexSignature(typeInfo.indexSignature)) {
      methods.push(
        this.generateIndexSignatureMethod(
          typeInfo.indexSignature,
          builderName,
          genericConstraints,
          config,
        ),
      );
    }

    return methods.join("\n\n");
  }

  /**
   * Generates the build method for a builder
   * @param name - The type name
   * @param typeInfo - The type information
   * @param config - Method generation configuration
   */
  generateBuildMethod(
    name: string,
    typeInfo: TypeInfo,
    config: MethodGeneratorConfig,
  ): string {
    const builderName = this.getBuilderName(name);
    const genericConstraints = this.isObjectType(typeInfo)
      ? this.typeStringGenerator.formatGenericConstraints(
          typeInfo.genericParams,
        )
      : "";

    const hasDefaults = this.hasDefaultValues(typeInfo);
    const defaultsReference = hasDefaults
      ? `${builderName}.defaults`
      : "undefined";

    return `  /**
   * Builds the final ${name} object
   * @param context - Optional build context for nested builders
   */
  build(context?: ${config.contextType}): ${name}${genericConstraints} {
    return this.buildWithDefaults(${defaultsReference}, context);
  }`;
  }

  /**
   * Generates interface methods for the builder
   */
  private async generateInterfaceMethods(
    typeInfo: TypeInfo,
    builderName: string,
    genericConstraints: string,
    config: MethodGeneratorConfig,
    typeName: string,
  ): Promise<string> {
    if (!this.isObjectType(typeInfo)) {
      return "";
    }

    const methodSignatures: string[] = [];

    for (const prop of typeInfo.properties) {
      const methodName = `with${this.capitalize(prop.name)}`;
      let paramType = this.typeStringGenerator.getPropertyType(prop);
      const returnType = `${builderName}${genericConstraints}`;
      const jsDoc = this.generateJsDoc(prop, config);

      // Apply plugin transformations if available
      if (config.pluginManager) {
        const context: PropertyMethodContext = {
          property: prop,
          originalType: paramType,
          builderName,
          typeName,
          typeInfo,
        };

        const transform =
          config.pluginManager.getPropertyMethodTransform(context);
        if (transform?.parameterType) {
          paramType = transform.parameterType;
        }
      }

      methodSignatures.push(
        `${jsDoc}  ${methodName}(value: ${paramType}): ${returnType};`,
      );
    }

    // Add custom method signatures from plugins
    if (config.pluginManager) {
      const customMethods = await this.generateCustomMethodSignatures(
        builderName,
        genericConstraints,
        config,
        typeName,
        typeInfo,
      );
      if (customMethods) {
        methodSignatures.push(customMethods);
      }
    }

    return methodSignatures.join("\n");
  }

  /**
   * Generates a single with* method with plugin support
   */
  private async generateWithMethodAsync(
    prop: PropertyInfo,
    builderName: string,
    genericConstraints: string,
    config: MethodGeneratorConfig,
    typeName: string,
    typeInfo: TypeInfo,
  ): Promise<string> {
    const methodName = `with${this.capitalize(prop.name)}`;
    let paramType = this.typeStringGenerator.getPropertyType(prop);
    let implementation = `return this.set("${prop.name}", value);`;

    // Apply plugin transformations if available
    if (config.pluginManager) {
      const context: PropertyMethodContext = {
        property: prop,
        originalType: paramType,
        builderName,
        typeName,
        typeInfo,
      };

      const transform =
        config.pluginManager.getPropertyMethodTransform(context);

      if (transform) {
        if (transform.parameterType) {
          paramType = transform.parameterType;
        }

        if (transform.extractValue || transform.validate) {
          const extractCode = transform.extractValue
            ? `const extractedValue = ${transform.extractValue};`
            : "const extractedValue = value;";

          const validateCode = transform.validate
            ? `${transform.validate};`
            : "";

          implementation = `
    ${extractCode}
    ${validateCode}
    return this.set("${prop.name}", extractedValue);
  `.trim();
        }
      }
    }

    const jsDoc = this.generateJsDoc(prop, config);

    return `${jsDoc}
  ${methodName}(value: ${paramType}): ${builderName}${genericConstraints} {
    ${implementation}
  }`;
  }

  /**
   * Generates method for index signature support
   */
  private generateIndexSignatureMethod(
    indexSignature: IndexSignature,
    builderName: string,
    genericConstraints: string,
    config: MethodGeneratorConfig,
  ): string {
    const valueType = this.typeStringGenerator.typeInfoToString(
      indexSignature.valueType,
    );
    const keyType = indexSignature.keyType;
    const jsDoc = config.addComments
      ? `  /**
   * Set additional properties with dynamic keys
   * @param props - Object with dynamic properties
   */
`
      : "";

    return `${jsDoc}  withAdditionalProperties(props: Record<${keyType}, ${valueType}>): ${builderName}${genericConstraints} {
    Object.assign(this.values, props);
    return this as ${builderName}${genericConstraints};
  }`;
  }

  /**
   * Generates JSDoc comment for a property
   */
  private generateJsDoc(
    prop: PropertyInfo,
    config: MethodGeneratorConfig,
  ): string {
    if (!config.addComments || !prop.jsDoc) {
      return "";
    }
    return `  /** ${prop.jsDoc} */\n`;
  }

  /**
   * Gets the builder class name for a type
   */
  private getBuilderName(typeName: string): string {
    return `${typeName}Builder`;
  }

  /**
   * Capitalizes a string for method names
   */
  private capitalize(str: string): string {
    // Convert kebab-case (hyphenated) property names to camelCase
    // e.g., "accept-encoding" -> "AcceptEncoding"
    return str
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  /**
   * Generates custom method signatures for interfaces
   */
  private async generateCustomMethodSignatures(
    builderName: string,
    genericConstraints: string,
    config: MethodGeneratorConfig,
    typeName: string,
    typeInfo: TypeInfo,
  ): Promise<string> {
    if (!config.pluginManager || !this.isObjectType(typeInfo)) {
      return "";
    }

    const context: BuilderContext = {
      typeName,
      builderName,
      typeInfo,
      properties: typeInfo.properties,
      genericParams: this.typeStringGenerator.formatGenericParams(
        typeInfo.genericParams,
      ),
      genericConstraints,
    };

    const customMethods = config.pluginManager.getCustomMethods(context);

    if (customMethods.length === 0) {
      return "";
    }

    return customMethods
      .map((method: CustomMethod) => {
        const jsDoc = method.jsDoc || "";
        return `${jsDoc}  ${method.name}${method.signature}: ${builderName}${genericConstraints};`;
      })
      .join("\n");
  }

  /**
   * Checks if a type has default values
   */
  private hasDefaultValues(typeInfo: TypeInfo): boolean {
    if (!this.isObjectType(typeInfo)) {
      return false;
    }

    return typeInfo.properties.some(
      (prop) =>
        !prop.optional &&
        prop.type.kind !== TypeKind.Object &&
        prop.type.kind !== TypeKind.Reference,
    );
  }

  /**
   * Type guard to check if typeInfo is an object type
   */
  private isObjectType(
    typeInfo: TypeInfo,
  ): typeInfo is Extract<TypeInfo, { kind: TypeKind.Object }> {
    return typeInfo.kind === TypeKind.Object;
  }
}

