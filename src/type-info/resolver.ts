import { Type, ts, Symbol as TsSymbol, SyntaxKind, Node } from 'ts-morph';
import type { Project } from 'ts-morph';
import type { Result } from '../core/result.js';
import { ok, err } from '../core/result.js';
import type { TypeInfo, PropertyInfo, GenericParam, IndexSignature } from '../core/types.js';
import { TypeKind } from '../core/types.js';
import { TypeResolutionCache } from '../core/cache.js';
import { PluginManager, HookType } from '../core/plugin.js';
import { UtilityTypeExpander } from './utility-type-expander.js';
import { MappedTypeResolver } from './mapped-type-resolver.js';
import { ConditionalTypeResolver } from './conditional-type-resolver.js';
import { TemplateLiteralResolver } from './template-literal-resolver.js';
import { GenericContext } from './generic-context.js';

export interface ResolverOptions {
  readonly maxDepth?: number;
  readonly cache?: TypeResolutionCache;
  readonly pluginManager?: PluginManager;
  readonly expandUtilityTypes?: boolean;
  readonly resolveMappedTypes?: boolean;
  readonly resolveConditionalTypes?: boolean;
  readonly resolveTemplateLiterals?: boolean;
  readonly project?: Project;
}

export class TypeResolver {
  private readonly maxDepth: number;
  /**
   * Cache for type resolution within a single extraction session.
   * Helps avoid redundant resolution of the same types and improves performance.
   * The cache is scoped to a single TypeResolver instance and should be cleared
   * if the underlying source files change.
   */
  private readonly cache: TypeResolutionCache;
  private readonly pluginManager: PluginManager;
  private readonly visitedTypes = new Set<string>();
  private readonly utilityTypeExpander: UtilityTypeExpander;
  private readonly mappedTypeResolver: MappedTypeResolver;
  private readonly conditionalTypeResolver: ConditionalTypeResolver;
  private readonly templateLiteralResolver: TemplateLiteralResolver;
  private readonly expandUtilityTypes: boolean;
  private readonly resolveMappedTypes: boolean;
  private readonly resolveConditionalTypes: boolean;
  private readonly resolveTemplateLiterals: boolean;
  private genericContext: GenericContext;

  constructor(options: ResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 30;
    this.cache = options.cache ?? new TypeResolutionCache();
    this.pluginManager = options.pluginManager ?? new PluginManager();
    this.expandUtilityTypes = options.expandUtilityTypes ?? true;
    this.resolveMappedTypes = options.resolveMappedTypes ?? true;
    this.resolveConditionalTypes = options.resolveConditionalTypes ?? true;
    this.resolveTemplateLiterals = options.resolveTemplateLiterals ?? true;

    this.utilityTypeExpander = new UtilityTypeExpander({
      maxDepth: this.maxDepth,
    });
    this.mappedTypeResolver = new MappedTypeResolver({
      maxDepth: this.maxDepth,
    });
    this.conditionalTypeResolver = new ConditionalTypeResolver({
      maxDepth: this.maxDepth,
    });
    this.templateLiteralResolver = new TemplateLiteralResolver({
      maxDepth: this.maxDepth,
    });

    this.genericContext = new GenericContext();
  }

  async resolveType(type: Type, depth = 0, context?: GenericContext): Promise<Result<TypeInfo>> {
    const params = { type, depth, context: context ?? this.genericContext };

    if (params.depth > this.maxDepth) {
      return err(new Error(`Max resolution depth (${this.maxDepth}) exceeded`));
    }

    const typeString = params.type.getText();
    const cacheKey = this.generateCacheKey(typeString, params.context);

    // Check cache first (before circular reference check)
    const cachedResult = this.cache.getType(cacheKey) as TypeInfo | undefined;
    if (cachedResult) {
      return ok(cachedResult);
    }

    if (this.visitedTypes.has(typeString)) {
      return ok({
        kind: TypeKind.Reference,
        name: typeString,
      });
    }

    this.visitedTypes.add(typeString);

    try {
      const hookResult = await this.pluginManager.executeHook({
        hookType: HookType.BeforeResolve,
        input: { type: params.type, symbol: params.type.getSymbol() },
      });

      if (!hookResult.ok) {
        return hookResult;
      }

      // Try specialized resolvers first
      const specializedResult = await this.trySpecializedResolvers(params);
      if (specializedResult) {
        return this.finalizeResolution({
          typeInfo: specializedResult,
          type: params.type,
          typeString,
          cacheKey,
        });
      }

      // Resolve the actual type
      const typeInfo = await this.resolveTypeCore(params);
      if (!typeInfo.ok) return typeInfo;

      return this.finalizeResolution({
        typeInfo: typeInfo.value,
        type: params.type,
        typeString,
        cacheKey,
      });
    } catch (error) {
      this.visitedTypes.delete(typeString);
      return err(new Error(`Failed to resolve type: ${error}`));
    }
  }

  private async trySpecializedResolvers(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<TypeInfo | null> {
    const { type, depth } = params;

    // Try utility types
    if (this.expandUtilityTypes) {
      const result = await this.utilityTypeExpander.expandUtilityType({
        type,
        resolveType: (t, d) => this.resolveType(t, d, params.context),
        depth,
        genericContext: params.context,
      });
      if (result.ok && result.value) {
        return result.value;
      }
    }

    // Try conditional types
    if (this.resolveConditionalTypes) {
      const result = await this.conditionalTypeResolver.resolveConditionalType({
        type,
        depth,
      });
      if (result.ok && result.value) {
        return result.value;
      }
    }

    // Try mapped types
    if (this.resolveMappedTypes) {
      const result = await this.mappedTypeResolver.resolveMappedType({
        type,
        resolveType: (t, d) => this.resolveType(t, d, params.context),
        depth,
      });
      if (result.ok && result.value) {
        return result.value;
      }
    }

    // Try template literals
    if (this.resolveTemplateLiterals) {
      const result = await this.templateLiteralResolver.resolveTemplateLiteral({
        type,
        resolveType: (t, d) => this.resolveType(t, d, params.context),
        depth,
      });
      if (result.ok && result.value) {
        return result.value;
      }
    }

    return null;
  }

  /**
   * Checks if a type is a built-in/global type (like Date, Array, Promise, etc.)
   * by examining its symbol's source file location
   */
  private isBuiltInType(type: Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const symbolName = symbol.getName();

    // Don't treat resolved utility types as built-in types
    // Resolved utility types typically have symbol names like "__type"
    if (symbolName === '__type') {
      return false;
    }

    // Check if the symbol comes from TypeScript's lib files or global scope
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return false;

    // Check if any declaration is from a lib file or has no source file (global)
    return declarations.some(decl => {
      const sourceFile = decl.getSourceFile();
      if (!sourceFile) return true; // No source file = global

      const filePath = sourceFile.getFilePath();
      // TypeScript lib files are typically in node_modules/typescript/lib/
      return (
        filePath.includes('/typescript/lib/') ||
        filePath.includes('\\typescript\\lib\\') ||
        (filePath.endsWith('.d.ts') && filePath.includes('lib.'))
      );
    });
  }

  /**
   * Checks if a type is a Node.js built-in type that needs special handling
   */
  private isNodeJSBuiltInType(type: Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const symbolName = symbol.getName();
    const typeText = type.getText();

    // Handle NodeJS namespace types (like NodeJS.ProcessEnv)
    if (typeText.startsWith('NodeJS.')) {
      return this.isNodeJSNamespaceType(typeText);
    }

    // Node.js built-in types that should be treated as primitives but need imports
    const nodeJSTypes = [
      'EventEmitter',
      'URL',
      'URLSearchParams',
      'Buffer',
      'Readable',
      'Writable',
      'Transform',
      'Duplex',
    ];

    if (!nodeJSTypes.includes(symbolName)) return false;

    // Check if it comes from @types/node
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return false;

    return declarations.some(decl => {
      const sourceFile = decl.getSourceFile();
      if (!sourceFile) return false;
      const filePath = sourceFile.getFilePath();
      return filePath.includes('/@types/node/') || filePath.includes('\\@types\\node\\');
    });
  }

  /**
   * Checks if a type is a NodeJS namespace type
   */
  private isNodeJSNamespaceType(typeText: string): boolean {
    const nodeJSNamespaceTypes = [
      'NodeJS.ProcessEnv',
      'NodeJS.Dict',
      'NodeJS.ArrayBufferView',
      'NodeJS.Process',
    ];
    return nodeJSNamespaceTypes.includes(typeText);
  }

  /**
   * Resolves Node.js built-in types as primitives to avoid expanding their properties
   */
  private resolveNodeJSBuiltInType(type: Type): Result<TypeInfo> {
    const symbol = type.getSymbol();
    const typeText = type.getText();

    // For NodeJS namespace types, use the full qualified name
    if (typeText.startsWith('NodeJS.')) {
      return ok({
        kind: TypeKind.Primitive,
        name: typeText,
      });
    }

    // For other Node.js types, use the symbol name
    const symbolName = symbol?.getName() ?? 'unknown';
    return ok({
      kind: TypeKind.Primitive,
      name: symbolName,
    });
  }

  /**
   * Resolves built-in types as primitives to avoid expanding their properties
   */
  private async resolveBuiltInType(
    type: Type,
    depth: number = 0,
    context?: GenericContext,
  ): Promise<Result<TypeInfo>> {
    const symbol = type.getSymbol();
    const typeName = symbol?.getName() || type.getText();

    // Check if this is a generic built-in type (e.g., Set<string>, Map<K, V>)
    const typeArguments = type.getTypeArguments();
    if (typeArguments && typeArguments.length > 0) {
      // Resolve type arguments
      const resolvedTypeArgs: TypeInfo[] = [];
      for (const arg of typeArguments) {
        const resolved = await this.resolveType(arg, depth + 1, context);
        if (!resolved.ok) return resolved;
        resolvedTypeArgs.push(resolved.value);
      }

      return ok({
        kind: TypeKind.Generic,
        name: typeName,
        typeArguments: resolvedTypeArgs,
      });
    }

    return ok({
      kind: TypeKind.Primitive,
      name: typeName,
    });
  }

  private async resolveTypeCore(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;

    if (type.isString()) {
      return ok({ kind: TypeKind.Primitive, name: 'string' });
    } else if (type.isNumber()) {
      return ok({ kind: TypeKind.Primitive, name: 'number' });
    } else if (type.isBoolean()) {
      return ok({ kind: TypeKind.Primitive, name: 'boolean' });
    } else if (type.isUndefined()) {
      return ok({ kind: TypeKind.Primitive, name: 'undefined' });
    } else if (type.isNull()) {
      return ok({ kind: TypeKind.Primitive, name: 'null' });
    } else if (type.isAny()) {
      return ok({ kind: TypeKind.Primitive, name: 'any' });
    } else if (type.isNever()) {
      return ok({ kind: TypeKind.Never });
    } else if (type.getText() === 'object') {
      // Handle the primitive 'object' type
      return ok({ kind: TypeKind.Primitive, name: 'object' });
    } else if (type.isTypeParameter()) {
      return this.resolveTypeParameter({ type, depth, context });
    } else if (type.isArray()) {
      return this.resolveArrayType({ type, depth, context });
    } else if (type.isEnum()) {
      return this.resolveEnumType({ type });
    } else if (type.isUnion()) {
      return this.resolveUnionType({ type, depth, context });
    } else if (type.isIntersection()) {
      return this.resolveIntersectionType({ type, depth, context });
    } else if (type.isLiteral()) {
      // For boolean literals, getLiteralValue() returns undefined
      // We need to get the value from the intrinsicName
      let literalValue: string | number | ts.PseudoBigInt | boolean | undefined =
        type.getLiteralValue();
      if (literalValue === undefined) {
        const compilerType = type.compilerType;
        if (this.hasIntrinsicName(compilerType, 'true')) {
          literalValue = true;
        } else if (this.hasIntrinsicName(compilerType, 'false')) {
          literalValue = false;
        }
      }
      return ok({
        kind: TypeKind.Literal,
        literal: literalValue,
      });
    } else if (type.isTuple()) {
      return this.resolveTupleType({ type, depth, context });
    } else if (this.isKeyofType(type)) {
      return this.resolveKeyofType(type);
    } else if (this.isTypeofType(type)) {
      return this.resolveTypeofType(type);
    } else if (this.isIndexAccessType(type)) {
      return this.resolveIndexAccessType(type);
    } else if (this.isNodeJSBuiltInType(type)) {
      return this.resolveNodeJSBuiltInType(type);
    } else if (this.isBuiltInType(type)) {
      return this.resolveBuiltInType(type, depth, context);
    } else if (type.isObject() || type.isInterface()) {
      return this.resolveObjectType({ type, depth, context });
    } else {
      return ok({ kind: TypeKind.Unknown });
    }
  }

  private async finalizeResolution(params: {
    typeInfo: TypeInfo;
    type: Type;
    typeString: string;
    cacheKey: string;
  }): Promise<Result<TypeInfo>> {
    const { typeInfo, type, typeString, cacheKey } = params;

    const afterHook = await this.pluginManager.executeHook({
      hookType: HookType.AfterResolve,
      input: { type, symbol: type.getSymbol() },
      additionalArgs: [typeInfo],
    });

    this.visitedTypes.delete(typeString);

    if (afterHook.ok) {
      this.cache.setType(cacheKey, typeInfo);
      return ok(typeInfo);
    } else {
      return afterHook;
    }
  }

  private async resolveTypeParameter(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const paramName = type.getSymbol()?.getName() || 'T';

    // Check if we have a resolved type for this generic in context
    const resolvedInContext = context.getResolvedType(paramName);
    if (resolvedInContext) {
      return ok(resolvedInContext);
    }

    // Register as unresolved generic
    const constraint = type.getConstraint();
    const defaultType = type.getDefault();

    let constraintInfo: TypeInfo | undefined;
    let defaultInfo: TypeInfo | undefined;

    if (constraint) {
      const constraintResult = await this.resolveType(constraint, depth + 1, context);
      if (constraintResult.ok) {
        constraintInfo = constraintResult.value;
      }
    }

    if (defaultType) {
      const defaultResult = await this.resolveType(defaultType, depth + 1, context);
      if (defaultResult.ok) {
        defaultInfo = defaultResult.value;
      }
    }

    // Register the generic parameter in context
    context.registerGenericParam({
      param: {
        name: paramName,
        ...(constraintInfo && { constraint: constraintInfo }),
        ...(defaultInfo && { default: defaultInfo }),
      },
    });

    return ok({ kind: TypeKind.Generic, name: paramName });
  }

  private async resolveArrayType(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const elementType = type.getArrayElementType();

    if (elementType) {
      const resolvedElement = await this.resolveType(elementType, depth + 1, context);
      if (!resolvedElement.ok) return resolvedElement;
      return ok({
        kind: TypeKind.Array,
        elementType: resolvedElement.value,
      });
    } else {
      return ok({ kind: TypeKind.Unknown });
    }
  }

  private async resolveUnionType(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const unionTypes = await this.resolveUnionTypes(type, depth, context);
    if (!unionTypes.ok) return unionTypes;
    return ok({
      kind: TypeKind.Union,
      unionTypes: unionTypes.value,
    });
  }

  private async resolveIntersectionType(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const intersectionTypes = await this.resolveIntersectionTypes(type, depth, context);
    if (!intersectionTypes.ok) return intersectionTypes;
    return ok({
      kind: TypeKind.Intersection,
      intersectionTypes: intersectionTypes.value,
    });
  }

  private async resolveTupleType(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const tupleTypes = await this.resolveTupleTypes(type, depth, context);
    if (!tupleTypes.ok) return tupleTypes;
    return ok({
      kind: TypeKind.Tuple,
      elements: tupleTypes.value,
    });
  }

  private async resolveEnumType(params: { type: Type }): Promise<Result<TypeInfo>> {
    const { type } = params;
    const enumName = type.getSymbol()?.getName();
    return ok({
      kind: TypeKind.Enum,
      name: enumName || 'UnknownEnum',
    });
  }

  private async resolveObjectType(params: {
    type: Type;
    depth: number;
    context: GenericContext;
  }): Promise<Result<TypeInfo>> {
    const { type, depth, context } = params;
    const symbol = type.getSymbol();

    // Check if this is a type reference to a type alias
    if (symbol && this.isTypeAlias(symbol)) {
      const aliasedType = this.getAliasedType(type);

      if (aliasedType) {
        // Check if this is a resolved utility type (has properties but aliased type differs)
        const hasProperties = type.getProperties().length > 0;
        const aliasedHasProperties = aliasedType.getProperties().length > 0;

        // If both the type and its alias have properties, it means TypeScript has already
        // resolved the utility type and we should use the current type's properties
        // instead of recursing to avoid infinite loops or property loss
        if (hasProperties && aliasedHasProperties) {
          // Use the current type (which has resolved properties) instead of recursing
          // This handles resolved utility types like Readonly<T>, Partial<T>, etc.
        } else {
          // For non-utility type aliases, recurse normally
          return this.resolveType(aliasedType, depth + 1, context);
        }
      }
    }

    const properties = await this.resolveProperties(type, depth, context);
    if (!properties.ok) return properties;

    const indexSignature = await this.resolveIndexSignature(type, depth, context);
    if (!indexSignature.ok) return indexSignature;

    const objectName = symbol?.getName();
    const unresolvedGenerics = context.getUnresolvedGenerics();

    // Capture type arguments for generic instantiations (e.g., PagedData<User>)
    let typeArguments: TypeInfo[] | undefined;
    const typeArgs = type.getTypeArguments();
    if (typeArgs && typeArgs.length > 0) {
      const resolvePromises = typeArgs.map(arg => this.resolveType(arg, depth + 1, context));
      const resolvedArgs = await Promise.all(resolvePromises);

      // Check if all type arguments resolved successfully
      const allOk = resolvedArgs.every(result => result.ok);
      if (allOk) {
        typeArguments = resolvedArgs.map(result => (result as any).value);
      }
    }

    // Only extract generic parameters if there are unresolved generics
    // For concrete type instantiations (like StringContainer = Container<string>),
    // we don't want to include the original generic parameters
    let genericParams: GenericParam[] = [];
    if (unresolvedGenerics.length > 0) {
      const genericParamsResult = await this.resolveGenericParams(type);
      if (!genericParamsResult.ok) return genericParamsResult;
      genericParams = genericParamsResult.value;
    }

    return ok({
      kind: TypeKind.Object,
      ...(objectName && { name: objectName }),
      properties: properties.value,
      ...(typeArguments && typeArguments.length > 0 && { typeArguments }),
      ...(genericParams.length > 0 && {
        genericParams,
      }),
      ...(indexSignature.value && {
        indexSignature: indexSignature.value,
      }),
      ...(unresolvedGenerics.length > 0 && {
        unresolvedGenerics,
      }),
    });
  }

  private async resolveProperties(
    type: Type,
    depth: number,
    context?: GenericContext,
  ): Promise<Result<PropertyInfo[]>> {
    const properties: PropertyInfo[] = [];

    try {
      const typeProperties = type.getProperties();

      for (const symbol of typeProperties) {
        const valueDeclaration = symbol.getValueDeclaration();
        if (!valueDeclaration) {
          // For synthetic properties (like from resolved Record types), try multiple approaches
          // For synthetic properties (like from resolved Record types), try multiple approaches
          try {
            const propName = symbol.getName();
            let propType: Type | undefined;

            // Try method 1: Get type from symbol's type node
            if (symbol.getTypeAtLocation) {
              try {
                // Get a source file context to use as location
                const parentSymbol = type.getSymbol();
                const sourceFile = parentSymbol?.getDeclarations()?.[0]?.getSourceFile();
                if (sourceFile) {
                  propType = symbol.getTypeAtLocation(sourceFile);
                }
              } catch {
                // Ignore and try next method
              }
            }

            // Fallback: Just get the type at the source file level
            if (!propType) {
              const parentSymbol = type.getSymbol();
              const sourceFile = parentSymbol?.getDeclarations()?.[0]?.getSourceFile();
              if (sourceFile) {
                try {
                  propType = symbol.getTypeAtLocation(sourceFile);
                } catch {
                  // If this fails too, skip the property
                }
              }
            }

            if (!propType) {
              continue;
            }

            const resolvedType = await this.resolveType(propType, depth + 1, context);
            if (!resolvedType.ok) {
              return resolvedType;
            }

            const property: PropertyInfo = {
              name: propName,
              type: resolvedType.value,
              optional: symbol.isOptional(),
              readonly: this.isReadonlyProperty(symbol),
            };

            properties.push(property);
            continue;
          } catch {
            // If all approaches fail, skip this property
            continue;
          }
        }

        const propType = symbol.getTypeAtLocation(valueDeclaration);

        // Check if this is a function/method signature using ts-morph's proper API
        const callSignatures = propType.getCallSignatures();
        if (callSignatures.length > 0) {
          // This is a function type - generate the function signature
          let functionSignature: string;

          try {
            // Get the first call signature (most cases have only one)
            const callSignature = callSignatures[0];
            if (!callSignature) {
              throw new Error('No call signature found');
            }
            const params = callSignature.getParameters();
            const returnType = callSignature.getReturnType();

            // Build parameter list
            const paramStrings = params.map(param => {
              const paramName = param.getName();
              const paramDeclaration = param.getValueDeclaration();

              if (!paramDeclaration) {
                // Fallback to any if we can't determine the type
                const isOptional = param.isOptional();
                return `${paramName}${isOptional ? '?' : ''}: any`;
              }

              const paramType = param.getTypeAtLocation(paramDeclaration);
              const isOptional = param.isOptional();
              const typeText = paramType.getText();
              return `${paramName}${isOptional ? '?' : ''}: ${typeText}`;
            });

            // Build the complete function signature
            const returnTypeText = returnType.getText();
            functionSignature = `(${paramStrings.join(', ')}) => ${returnTypeText}`;
          } catch {
            // If signature extraction fails, try to get the type text directly
            try {
              functionSignature = propType.getText();
            } catch {
              // Final fallback to simple function type
              functionSignature = 'Function';
            }
          }

          const resolvedType: TypeInfo = {
            kind: TypeKind.Function,
            name: functionSignature,
          };

          // Add the resolved function property
          properties.push({
            name: symbol.getName(),
            type: resolvedType,
            optional: symbol.isOptional(),
            readonly: false, // Methods are not readonly by default
          });
          continue;
        }

        const resolvedType = await this.resolveType(propType, depth + 1, context);

        if (!resolvedType.ok) return resolvedType;

        // Get JSDoc from the value declaration which contains the actual comments
        let jsDoc: string | undefined;

        if (valueDeclaration) {
          // Try to get JSDoc directly from the declaration node
          // Use proper TypeScript node type checking for JSDoc
          const jsDocs =
            'getJsDocs' in valueDeclaration && typeof valueDeclaration.getJsDocs === 'function'
              ? valueDeclaration.getJsDocs()
              : undefined;
          if (jsDocs && jsDocs.length > 0) {
            // Get the description from the first JSDoc
            jsDoc = jsDocs[0]?.getDescription?.() || jsDocs[0]?.getComment?.();
            if (typeof jsDoc !== 'string' && jsDoc) {
              jsDoc = String(jsDoc);
            }
          }

          // Fallback to JSDoc tags
          if (!jsDoc) {
            const jsDocTags = symbol.getJsDocTags();
            if (jsDocTags.length > 0) {
              const commentTag = jsDocTags.find(tag => tag.getName() === 'comment');
              const tagText = commentTag?.getText() || jsDocTags[0]?.getText();
              jsDoc = Array.isArray(tagText)
                ? tagText.map(part => part.text || part.toString()).join('')
                : tagText;
            }
          }
        }

        // Clean up JSDoc if present
        if (jsDoc) {
          jsDoc = jsDoc.trim();
          if (!jsDoc) {
            jsDoc = undefined;
          }
        }

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

        if (!transformed.ok) return transformed;

        properties.push(transformed.value as PropertyInfo);
      }

      return ok(properties);
    } catch (error) {
      return err(new Error(`Failed to resolve properties: ${error}`));
    }
  }

  private async resolveUnionTypes(
    type: Type,
    depth: number,
    context?: GenericContext,
  ): Promise<Result<TypeInfo[]>> {
    const unionTypes: TypeInfo[] = [];

    for (const unionType of type.getUnionTypes()) {
      const resolved = await this.resolveType(unionType, depth + 1, context);
      if (!resolved.ok) return resolved;
      unionTypes.push(resolved.value);
    }

    return ok(unionTypes);
  }

  private async resolveIntersectionTypes(
    type: Type,
    depth: number,
    context?: GenericContext,
  ): Promise<Result<TypeInfo[]>> {
    const intersectionTypes: TypeInfo[] = [];

    for (const intersectionType of type.getIntersectionTypes()) {
      const resolved = await this.resolveType(intersectionType, depth + 1, context);
      if (!resolved.ok) return resolved;
      intersectionTypes.push(resolved.value);
    }

    return ok(intersectionTypes);
  }

  private async resolveTupleTypes(
    type: Type,
    depth: number,
    context?: GenericContext,
  ): Promise<Result<TypeInfo[]>> {
    const tupleTypes: TypeInfo[] = [];
    const typeArgs = type.getTupleElements();

    for (const tupleType of typeArgs) {
      const resolved = await this.resolveType(tupleType, depth + 1, context);
      if (!resolved.ok) return resolved;
      tupleTypes.push(resolved.value);
    }

    return ok(tupleTypes);
  }

  private async resolveGenericParams(type: Type): Promise<Result<GenericParam[]>> {
    const genericParams: GenericParam[] = [];

    try {
      const symbol = type.getSymbol();
      if (!symbol) return ok(genericParams);

      const declarations = symbol.getDeclarations();
      if (!declarations || declarations.length === 0) return ok(genericParams);

      const declaration = declarations[0];
      if (!declaration) return ok(genericParams);

      if (
        'getTypeParameters' in declaration &&
        typeof declaration.getTypeParameters === 'function'
      ) {
        const typeParams = declaration.getTypeParameters() ?? [];

        for (const param of typeParams) {
          const constraint = param.getConstraint();
          const defaultType = param.getDefault();

          let constraintType: TypeInfo | undefined;
          let defaultTypeInfo: TypeInfo | undefined;

          if (constraint) {
            const constraintResult = await this.resolveType(constraint.getType(), 0);
            if (constraintResult.ok) {
              constraintType = constraintResult.value;
            }
          }

          if (defaultType) {
            const defaultResult = await this.resolveType(defaultType.getType(), 0);
            if (defaultResult.ok) {
              defaultTypeInfo = defaultResult.value;
            }
          }

          const genericParam: GenericParam = {
            name: param.getName(),
            ...(constraintType && { constraint: constraintType }),
            ...(defaultTypeInfo && { default: defaultTypeInfo }),
          };

          genericParams.push(genericParam);
        }
      }

      return ok(genericParams);
    } catch (error) {
      return err(
        new Error(
          `Failed to resolve generic parameters: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  clearVisited(): void {
    this.visitedTypes.clear();
  }

  /**
   * Reset all resolver state including visited types and generic context.
   * This should be called between different type extractions to ensure clean state,
   * especially important for multi-file batch processing to prevent depth accumulation.
   */
  resetState(): void {
    this.visitedTypes.clear();
    this.resetGenericContext();
  }

  /**
   * Get the current generic context for accessing unresolved generics
   */
  getGenericContext(): GenericContext {
    return this.genericContext;
  }

  /**
   * Reset the generic context for a new resolution session
   */
  resetGenericContext(): void {
    this.genericContext = new GenericContext();
  }

  /**
   * Type guard to safely check if a compiler type has an intrinsic name
   */
  private hasIntrinsicName(compilerType: ts.Type, expectedName: string): boolean {
    return (
      typeof compilerType === 'object' &&
      compilerType !== null &&
      'intrinsicName' in compilerType &&
      compilerType.intrinsicName === expectedName
    );
  }

  /**
   * Generate a cache key for type resolution based on type text and generic context
   */
  private generateCacheKey(typeString: string, context: GenericContext): string {
    // Include resolved generic types in the cache key to ensure
    // different generic instantiations get different cache entries
    const resolvedGenerics = context
      .getAllGenericParams()
      .map(param => {
        const resolved = context.getResolvedType(param.name);
        return resolved
          ? `${param.name}=${resolved.kind}:${JSON.stringify(resolved)}`
          : `${param.name}=unresolved`;
      })
      .sort() // Sort for consistent cache keys
      .join('|');

    return resolvedGenerics ? `${typeString}::${resolvedGenerics}` : typeString;
  }

  private isTypeAlias(symbol: TsSymbol): boolean {
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return false;

    return declarations.some(decl => {
      return decl.getKind() === SyntaxKind.TypeAliasDeclaration;
    });
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

  private async resolveIndexSignature(
    type: Type,
    depth: number,
    context?: GenericContext,
  ): Promise<Result<IndexSignature | null>> {
    try {
      // Get the symbol to access more detailed information
      const symbol = type.getSymbol();
      const declarations = symbol?.getDeclarations() || [];

      let isReadonly = false;

      // Check declarations for index signatures and readonly modifiers
      for (const decl of declarations) {
        if (!decl) continue;

        // Try to access the members to find index signatures
        if ('getMembers' in decl && typeof decl.getMembers === 'function') {
          const members = decl.getMembers();
          for (const member of members) {
            // Check if this is an index signature
            if (member.getKind && member.getKind() === SyntaxKind.IndexSignature) {
              // Check for readonly modifier
              const modifiers = member.getModifiers ? member.getModifiers() : [];
              isReadonly = modifiers.some(
                (mod: Node) => mod.getKind() === SyntaxKind.ReadonlyKeyword,
              );
              break;
            }
          }
        }
      }

      // Check for string index signature
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

      // Check for number index signature
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

  private isReadonlyProperty(symbol: TsSymbol): boolean {
    const valueDeclaration = symbol.getValueDeclaration();
    if (!valueDeclaration) return false;

    // Use ts-morph's built-in modifier checking
    if ('hasModifier' in valueDeclaration && typeof valueDeclaration.hasModifier === 'function') {
      return valueDeclaration.hasModifier(ts.SyntaxKind.ReadonlyKeyword);
    }

    return false;
  }

  private isKeyofType(type: Type): boolean {
    // Check if this is a keyof operator type
    const tsType = type.compilerType as ts.Type;
    if (tsType && 'flags' in tsType) {
      // TypeScript TypeFlags.Index = 4194304
      return (tsType.flags & ts.TypeFlags.Index) !== 0;
    }
    return false;
  }

  private isTypeofType(type: Type): boolean {
    // Check if this is a typeof operator type
    const symbol = type.getSymbol();
    const typeText = type.getText();

    // Look for typeof pattern in the type text
    return typeText.startsWith('typeof ') || (symbol?.getName()?.startsWith('typeof ') ?? false);
  }

  private isIndexAccessType(type: Type): boolean {
    // Check if this is an indexed access type (T[K])
    const tsType = type.compilerType as ts.Type;
    if (tsType && 'flags' in tsType) {
      // TypeScript TypeFlags.IndexedAccess = 8388608
      return (tsType.flags & ts.TypeFlags.IndexedAccess) !== 0;
    }
    return false;
  }

  private async resolveKeyofType(type: Type): Promise<Result<TypeInfo>> {
    // keyof T should extract the keys of T as a union of string literals
    // For now, return the keyof representation - actual resolution would
    // require analyzing the target type's properties

    // Try to get the target type from the keyof
    const typeText = type.getText();
    const keyofMatch = typeText.match(/keyof\s+(.+)/);

    if (keyofMatch && keyofMatch[1]) {
      // For unresolved keyof types, store the structure
      return ok({
        kind: TypeKind.Keyof,
        target: { kind: TypeKind.Reference, name: keyofMatch[1] },
      });
    }

    // If we can't parse it, return as unknown
    return ok({ kind: TypeKind.Unknown });
  }

  private async resolveTypeofType(type: Type): Promise<Result<TypeInfo>> {
    // typeof should resolve to the type of the target expression
    const typeText = type.getText();
    const typeofMatch = typeText.match(/typeof\s+(.+)/);

    if (typeofMatch && typeofMatch[1]) {
      // For unresolved typeof types, store the structure
      return ok({
        kind: TypeKind.Typeof,
        target: { kind: TypeKind.Reference, name: typeofMatch[1] },
      });
    }

    // If we can't parse it, return as unknown
    return ok({ kind: TypeKind.Unknown });
  }

  private async resolveIndexAccessType(type: Type): Promise<Result<TypeInfo>> {
    // T[K] should resolve to the type of property K in T
    const typeText = type.getText();
    const indexMatch = typeText.match(/(.+)\[(.+)\]/);

    if (indexMatch && indexMatch[1] && indexMatch[2]) {
      // For unresolved index access types, store the structure
      return ok({
        kind: TypeKind.Index,
        object: { kind: TypeKind.Reference, name: indexMatch[1] },
        index: { kind: TypeKind.Reference, name: indexMatch[2] },
      });
    }

    // If we can't parse it, return as unknown
    return ok({ kind: TypeKind.Unknown });
  }
}
