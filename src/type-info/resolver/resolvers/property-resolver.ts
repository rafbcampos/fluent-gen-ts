import { Type, SyntaxKind, Node, Symbol as TsSymbol } from 'ts-morph';
import { ts } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok, err } from '../../../core/result.js';
import type { TypeInfo, PropertyInfo, IndexSignature } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';
import type { PluginManager } from '../../../core/plugin/index.js';
import { HookType } from '../../../core/plugin/index.js';

/**
 * Resolves object properties and index signatures to their TypeInfo representation.
 */
export class PropertyResolver {
  constructor(
    private readonly resolveType: TypeResolverFunction,
    private readonly pluginManager: PluginManager,
  ) {}

  /**
   * Resolves all properties of a type.
   * @param params - The type resolution parameters
   * @returns Result containing an array of resolved PropertyInfo
   */
  async resolveProperties(params: {
    type: Type;
    depth: number;
    context?: GenericContext;
  }): Promise<Result<PropertyInfo[]>> {
    const { type, depth, context } = params;
    const properties: PropertyInfo[] = [];

    try {
      const typeProperties = type.getProperties();

      for (const symbol of typeProperties) {
        const property = await this.resolveProperty({ symbol, type, depth, context });
        if (property) {
          properties.push(property);
        }
      }

      return ok(properties);
    } catch (error) {
      return err(
        new Error(
          `Failed to resolve properties: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  private async resolveProperty(params: {
    symbol: TsSymbol;
    type: Type;
    depth: number;
    context: GenericContext | undefined;
  }): Promise<PropertyInfo | null> {
    const { symbol, type, depth, context } = params;
    const valueDeclaration = symbol.getValueDeclaration();

    if (!valueDeclaration) {
      return this.resolveSyntheticProperty({ symbol, type, depth, context });
    }

    const propType = symbol.getTypeAtLocation(valueDeclaration);
    const callSignatures = propType.getCallSignatures();

    if (callSignatures.length > 0) {
      return this.resolveFunctionProperty({ symbol, callSignatures });
    }

    const resolvedType = await this.resolveType(propType, depth + 1, context);
    if (!resolvedType.ok) return null;

    const jsDoc = this.extractJsDoc({ symbol, valueDeclaration });

    const property: PropertyInfo = {
      name: symbol.getName(),
      type: resolvedType.value,
      optional: symbol.isOptional(),
      readonly: this.isReadonlyProperty(symbol),
      ...(jsDoc && { jsDoc }),
    };

    const transformed = await this.pluginManager.executeHook({
      hookType: HookType.TransformProperty,
      input: property,
    });

    if (!transformed.ok) return null;

    return transformed.value as PropertyInfo;
  }

  private async resolveSyntheticProperty(params: {
    symbol: TsSymbol;
    type: Type;
    depth: number;
    context: GenericContext | undefined;
  }): Promise<PropertyInfo | null> {
    const { symbol, type, depth, context } = params;

    try {
      const propName = symbol.getName();
      const propType = this.getPropertyType(symbol, type);

      if (!propType) {
        return null;
      }

      const resolvedType = await this.resolveType(propType, depth + 1, context);
      if (!resolvedType.ok) {
        return null;
      }

      return {
        name: propName,
        type: resolvedType.value,
        optional: symbol.isOptional(),
        readonly: this.isReadonlyProperty(symbol),
      };
    } catch {
      return null;
    }
  }

  private resolveFunctionProperty(params: {
    symbol: TsSymbol;
    callSignatures: ReturnType<Type['getCallSignatures']>;
  }): PropertyInfo {
    const { symbol, callSignatures } = params;
    let functionSignature: string;

    try {
      const callSignature = callSignatures[0];
      if (!callSignature) {
        throw new Error('No call signature found');
      }
      const paramStrings = this.buildParameterStrings(callSignature);
      const returnType = callSignature.getReturnType();
      const returnTypeText = this.getTypeText(returnType);
      functionSignature = `(${paramStrings.join(', ')}) => ${returnTypeText}`;
    } catch {
      functionSignature = 'Function';
    }

    const resolvedType: TypeInfo = {
      kind: TypeKind.Function,
      name: functionSignature,
    };

    return {
      name: symbol.getName(),
      type: resolvedType,
      optional: symbol.isOptional(),
      readonly: false,
    };
  }

  private buildParameterStrings(callSignature: ReturnType<Type['getCallSignatures']>[0]): string[] {
    const params = callSignature.getParameters();
    return params.map(param => {
      const paramName = param.getName();
      const paramDeclaration = (param as any).valueDeclaration;

      if (!paramDeclaration) {
        const isOptional = this.isOptionalParameter(param);
        return `${paramName}${isOptional ? '?' : ''}: any`;
      }

      const paramType = this.getParameterType(param, paramDeclaration);
      const isOptional = this.isOptionalParameter(param);
      const typeText = paramType ? this.getTypeText(paramType) : 'any';
      return `${paramName}${isOptional ? '?' : ''}: ${typeText}`;
    });
  }

  private extractJsDoc(params: { symbol: TsSymbol; valueDeclaration: Node }): string | undefined {
    const { valueDeclaration } = params;

    if ('getJsDocs' in valueDeclaration && typeof valueDeclaration.getJsDocs === 'function') {
      const jsDocs = valueDeclaration.getJsDocs();
      if (jsDocs && jsDocs.length > 0) {
        const jsDoc = jsDocs[0]?.getDescription?.() || jsDocs[0]?.getComment?.();
        if (typeof jsDoc === 'string' && jsDoc.trim()) {
          return jsDoc.trim();
        }
      }
    }

    const jsDocTags = params.symbol.getJsDocTags();
    if (jsDocTags.length > 0) {
      const commentTag = jsDocTags.find(tag => tag.getName() === 'comment');
      const tagText = commentTag?.getText() || jsDocTags[0]?.getText();
      const jsDoc = Array.isArray(tagText)
        ? tagText.map(part => part.text || part.toString()).join('')
        : tagText;
      if (jsDoc && jsDoc.trim()) {
        return jsDoc.trim();
      }
    }

    return undefined;
  }

  async resolveIndexSignature(params: {
    type: Type;
    depth: number;
    context?: GenericContext;
  }): Promise<Result<IndexSignature | null>> {
    const { type, depth, context } = params;

    try {
      const isReadonly = this.checkReadonlyIndexSignature(type);

      const stringIndexType = type.getStringIndexType();
      if (stringIndexType) {
        const valueType = await this.resolveType(stringIndexType, depth + 1, context);
        if (!valueType.ok) return valueType;

        return ok({
          keyType: 'string',
          valueType: valueType.value,
          readonly: isReadonly,
        });
      }

      const numberIndexType = type.getNumberIndexType();
      if (numberIndexType) {
        const valueType = await this.resolveType(numberIndexType, depth + 1, context);
        if (!valueType.ok) return valueType;

        return ok({
          keyType: 'number',
          valueType: valueType.value,
          readonly: isReadonly,
        });
      }

      return ok(null);
    } catch (error) {
      return err(new Error(`Failed to resolve index signature: ${error}`));
    }
  }

  private checkReadonlyIndexSignature(type: Type): boolean {
    const symbol = type.getSymbol();
    const declarations = symbol?.getDeclarations() ?? [];

    for (const decl of declarations) {
      if (!decl) continue;

      if ('getMembers' in decl && typeof decl.getMembers === 'function') {
        const members = decl.getMembers();
        for (const member of members) {
          if (member.getKind && member.getKind() === SyntaxKind.IndexSignature) {
            const modifiers = member.getModifiers ? member.getModifiers() : [];
            return modifiers.some((mod: Node) => mod.getKind() === SyntaxKind.ReadonlyKeyword);
          }
        }
      }
    }

    return false;
  }

  private isReadonlyProperty(symbol: TsSymbol): boolean {
    const valueDeclaration = symbol.getValueDeclaration();
    if (!valueDeclaration) return false;

    if ('hasModifier' in valueDeclaration && typeof valueDeclaration.hasModifier === 'function') {
      return valueDeclaration.hasModifier(ts.SyntaxKind.ReadonlyKeyword);
    }

    return false;
  }

  /**
   * Gets property type from a symbol and parent type.
   * @param symbol - The property symbol
   * @param type - The parent type
   * @returns The property type or undefined
   */
  private getPropertyType(symbol: TsSymbol, type: Type): Type | undefined {
    const parentSymbol = type.getSymbol();
    const sourceFile = parentSymbol?.getDeclarations()?.[0]?.getSourceFile();

    if (!sourceFile || !symbol.getTypeAtLocation) {
      return undefined;
    }

    try {
      return symbol.getTypeAtLocation(sourceFile);
    } catch {
      return undefined;
    }
  }

  /**
   * Gets text representation of a type.
   * @param type - The type to get text for
   * @returns String representation of the type
   */
  private getTypeText(type: unknown): string {
    if (
      type &&
      typeof type === 'object' &&
      'getText' in type &&
      typeof type.getText === 'function'
    ) {
      return type.getText();
    }
    if (
      type &&
      typeof type === 'object' &&
      'toString' in type &&
      typeof type.toString === 'function'
    ) {
      return type.toString();
    }
    return 'unknown';
  }

  /**
   * Checks if a parameter is optional.
   * @param param - The parameter to check
   * @returns True if the parameter is optional
   */
  private isOptionalParameter(param: unknown): boolean {
    if (
      param &&
      typeof param === 'object' &&
      'isOptional' in param &&
      typeof param.isOptional === 'function'
    ) {
      return Boolean(param.isOptional());
    }
    return false;
  }

  /**
   * Gets the type of a parameter at a given location.
   * @param param - The parameter
   * @param location - The location node
   * @returns The parameter type or undefined
   */
  private getParameterType(param: unknown, location: Node): Type | undefined {
    if (
      param &&
      typeof param === 'object' &&
      'getTypeAtLocation' in param &&
      typeof param.getTypeAtLocation === 'function'
    ) {
      return param.getTypeAtLocation(location) as Type;
    }
    return undefined;
  }
}
