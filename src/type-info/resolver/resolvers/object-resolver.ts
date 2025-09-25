import { Type, SyntaxKind } from 'ts-morph';
import type { Result } from '../../../core/result.js';
import { ok } from '../../../core/result.js';
import type { TypeInfo, GenericParam } from '../../../core/types.js';
import { TypeKind } from '../../../core/types.js';
import type { GenericContext } from '../../generic-context.js';
import type { TypeResolverFunction } from '../core/resolver-context.js';
import { PropertyResolver } from './property-resolver.js';
import { GenericResolver } from './generic-resolver.js';
import { isTypeAlias, extractTypeName } from '../utils/type-helpers.js';
import type { PluginManager } from '../../../core/plugin/index.js';

export class ObjectResolver {
  private readonly propertyResolver: PropertyResolver;
  private readonly genericResolver: GenericResolver;

  constructor(
    private readonly resolveType: TypeResolverFunction,
    pluginManager: PluginManager,
  ) {
    this.propertyResolver = new PropertyResolver(resolveType, pluginManager);
    this.genericResolver = new GenericResolver(resolveType);
  }

  async resolveObject(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const symbol = type.getSymbol();
    const sourceFile = symbol?.getDeclarations()?.[0]?.getSourceFile();

    if (symbol && isTypeAlias(symbol)) {
      const aliasedType = this.getAliasedType(type);
      if (aliasedType && this.shouldResolveAlias({ type, aliasedType })) {
        return this.resolveType(aliasedType, depth + 1, context);
      }
    }

    const properties = await this.propertyResolver.resolveProperties({ type, depth, context });
    if (!properties.ok) return properties;

    const indexSignature = await this.propertyResolver.resolveIndexSignature({
      type,
      depth,
      context,
    });
    if (!indexSignature.ok) return indexSignature;

    const objectName = extractTypeName({ symbol, typeText: type.getText() });
    const unresolvedGenerics = context.getUnresolvedGenerics();

    const typeArguments = await this.resolveTypeArguments({ type, depth, context });

    let genericParams: GenericParam[] = [];
    if (unresolvedGenerics.length > 0) {
      const genericParamsResult = await this.genericResolver.resolveGenericParams({ type });
      if (!genericParamsResult.ok) return genericParamsResult;
      genericParams = genericParamsResult.value;
    }

    const typeSourceFile = sourceFile?.getFilePath();

    return ok({
      kind: TypeKind.Object,
      ...(objectName && objectName !== '__type' && { name: objectName }),
      properties: properties.value,
      ...(typeArguments && typeArguments.length > 0 && { typeArguments }),
      ...(genericParams.length > 0 && { genericParams }),
      ...(indexSignature.value && { indexSignature: indexSignature.value }),
      ...(unresolvedGenerics.length > 0 && { unresolvedGenerics }),
      ...(typeSourceFile && { sourceFile: typeSourceFile }),
    });
  }

  private shouldResolveAlias(params: { type: Type; aliasedType: Type }): boolean {
    const { type, aliasedType } = params;
    const hasProperties = type.getProperties().length > 0;
    const aliasedHasProperties = aliasedType.getProperties().length > 0;

    return !(hasProperties && aliasedHasProperties);
  }

  private getAliasedType(type: Type): Type | null {
    const symbol = type.getSymbol();
    if (!symbol) return null;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return null;

    for (const decl of declarations) {
      if (decl.getKind() === SyntaxKind.TypeAliasDeclaration) {
        if ('getType' in decl && typeof decl.getType === 'function') {
          return decl.getType();
        }
      }
    }

    return null;
  }

  private async resolveTypeArguments(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<TypeInfo[] | undefined> {
    const { type, depth, context } = params;
    const typeArgs = type.getTypeArguments();

    if (!typeArgs || typeArgs.length === 0) {
      return undefined;
    }

    const resolvePromises = typeArgs.map(arg => this.resolveType(arg, depth + 1, context));
    const resolvedArgs = await Promise.all(resolvePromises);

    const allOk = resolvedArgs.every(result => result.ok);
    if (!allOk) {
      return undefined;
    }

    return resolvedArgs.map(result => {
      if (result.ok) {
        return result.value;
      }
      throw new Error('Unexpected error in type argument resolution');
    });
  }
}
