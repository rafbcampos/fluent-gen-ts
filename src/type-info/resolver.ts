import { Type, ts, Symbol as TsSymbol } from "ts-morph";
import type { Project } from "ts-morph";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import type {
  TypeInfo,
  PropertyInfo,
  GenericParam,
  IndexSignature,
} from "../core/types.js";
import { TypeKind } from "../core/types.js";
import { TypeResolutionCache } from "../core/cache.js";
import { PluginManager, HookType } from "../core/plugin.js";
import { UtilityTypeExpander } from "./utility-type-expander.js";
import { MappedTypeResolver } from "./mapped-type-resolver.js";
import { ConditionalTypeResolver } from "./conditional-type-resolver.js";
import { TemplateLiteralResolver } from "./template-literal-resolver.js";
import { GenericContext } from "./generic-context.js";

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
    this.maxDepth = options.maxDepth ?? 10;
    this.cache = options.cache ?? new TypeResolutionCache();
    this.pluginManager = options.pluginManager ?? new PluginManager();
    this.expandUtilityTypes = options.expandUtilityTypes ?? true;
    this.resolveMappedTypes = options.resolveMappedTypes ?? true;
    this.resolveConditionalTypes = options.resolveConditionalTypes ?? true;
    this.resolveTemplateLiterals = options.resolveTemplateLiterals ?? true;

    this.utilityTypeExpander = new UtilityTypeExpander({
      maxDepth: this.maxDepth,
      ...(options.project && { project: options.project }),
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

  async resolveType(
    type: Type,
    depth = 0,
    context?: GenericContext,
  ): Promise<Result<TypeInfo>> {
    // Use provided context or create a new one
    const genericContext = context ?? this.genericContext;
    if (depth > this.maxDepth) {
      return err(new Error(`Max resolution depth (${this.maxDepth}) exceeded`));
    }

    const typeString = type.getText();
    if (this.visitedTypes.has(typeString)) {
      return ok({
        kind: TypeKind.Reference,
        name: typeString,
      });
    }

    this.visitedTypes.add(typeString);

    try {
      const hookResult = await this.pluginManager.executeHook(
        HookType.BeforeResolve,
        { type, symbol: type.getSymbol() },
      );

      if (!hookResult.ok) {
        return hookResult;
      }

      let typeInfo: TypeInfo;

      // First, try to expand utility types if enabled
      if (this.expandUtilityTypes) {
        const utilityExpanded =
          await this.utilityTypeExpander.expandUtilityType(
            type,
            (t, d) => this.resolveType(t, d),
            depth,
          );
        if (utilityExpanded.ok && utilityExpanded.value) {
          typeInfo = utilityExpanded.value;
          const afterHook = await this.pluginManager.executeHook(
            HookType.AfterResolve,
            { type, symbol: type.getSymbol() },
            typeInfo,
          );
          this.visitedTypes.delete(typeString);
          return afterHook.ok ? ok(typeInfo) : afterHook;
        }
      }

      // Try to resolve conditional types if enabled
      if (this.resolveConditionalTypes) {
        const conditionalResolved =
          await this.conditionalTypeResolver.resolveConditionalType(
            type,
            (t, d) => this.resolveType(t, d),
            depth,
          );
        if (conditionalResolved.ok && conditionalResolved.value) {
          typeInfo = conditionalResolved.value;
          const afterHook = await this.pluginManager.executeHook(
            HookType.AfterResolve,
            { type, symbol: type.getSymbol() },
            typeInfo,
          );
          this.visitedTypes.delete(typeString);
          return afterHook.ok ? ok(typeInfo) : afterHook;
        }
      }

      // Try to resolve mapped types if enabled
      if (this.resolveMappedTypes) {
        const mappedResolved = await this.mappedTypeResolver.resolveMappedType(
          type,
          (t, d) => this.resolveType(t, d),
          depth,
        );
        if (mappedResolved.ok && mappedResolved.value) {
          typeInfo = mappedResolved.value;
          const afterHook = await this.pluginManager.executeHook(
            HookType.AfterResolve,
            { type, symbol: type.getSymbol() },
            typeInfo,
          );
          this.visitedTypes.delete(typeString);
          return afterHook.ok ? ok(typeInfo) : afterHook;
        }
      }

      // Try to resolve template literal types if enabled
      if (this.resolveTemplateLiterals) {
        const templateResolved =
          await this.templateLiteralResolver.resolveTemplateLiteral(
            type,
            (t, d) => this.resolveType(t, d),
            depth,
          );
        if (templateResolved.ok && templateResolved.value) {
          typeInfo = templateResolved.value;
          const afterHook = await this.pluginManager.executeHook(
            HookType.AfterResolve,
            { type, symbol: type.getSymbol() },
            typeInfo,
          );
          this.visitedTypes.delete(typeString);
          return afterHook.ok ? ok(typeInfo) : afterHook;
        }
      }

      if (type.isString()) {
        typeInfo = { kind: TypeKind.Primitive, name: "string" };
      } else if (type.isNumber()) {
        typeInfo = { kind: TypeKind.Primitive, name: "number" };
      } else if (type.isBoolean()) {
        typeInfo = { kind: TypeKind.Primitive, name: "boolean" };
      } else if (type.isUndefined()) {
        typeInfo = { kind: TypeKind.Primitive, name: "undefined" };
      } else if (type.isNull()) {
        typeInfo = { kind: TypeKind.Primitive, name: "null" };
      } else if (type.isAny()) {
        typeInfo = { kind: TypeKind.Primitive, name: "any" };
      } else if (type.isTypeParameter()) {
        const paramName = type.getSymbol()?.getName() || "T";

        // Check if we have a resolved type for this generic in context
        const resolvedInContext = genericContext.getResolvedType(paramName);
        if (resolvedInContext) {
          typeInfo = resolvedInContext;
        } else {
          // Register as unresolved generic
          const constraint = type.getConstraint();
          const defaultType = type.getDefault();

          let constraintInfo: TypeInfo | undefined;
          let defaultInfo: TypeInfo | undefined;

          if (constraint) {
            const constraintResult = await this.resolveType(
              constraint,
              depth + 1,
              genericContext,
            );
            if (constraintResult.ok) {
              constraintInfo = constraintResult.value;
            }
          }

          if (defaultType) {
            const defaultResult = await this.resolveType(
              defaultType,
              depth + 1,
              genericContext,
            );
            if (defaultResult.ok) {
              defaultInfo = defaultResult.value;
            }
          }

          // Register the generic parameter in context
          genericContext.registerGenericParam({
            name: paramName,
            ...(constraintInfo && { constraint: constraintInfo }),
            ...(defaultInfo && { default: defaultInfo }),
          });

          typeInfo = { kind: TypeKind.Generic, name: paramName };
        }
      } else if (type.isArray()) {
        const elementType = type.getArrayElementType();
        if (elementType) {
          const resolvedElement = await this.resolveType(
            elementType,
            depth + 1,
            genericContext,
          );
          if (!resolvedElement.ok) return resolvedElement;
          typeInfo = {
            kind: TypeKind.Array,
            elementType: resolvedElement.value,
          };
        } else {
          typeInfo = { kind: TypeKind.Unknown };
        }
      } else if (type.isUnion()) {
        const unionTypes = await this.resolveUnionTypes(type, depth, genericContext);
        if (!unionTypes.ok) return unionTypes;
        typeInfo = {
          kind: TypeKind.Union,
          unionTypes: unionTypes.value,
        };
      } else if (type.isIntersection()) {
        const intersectionTypes = await this.resolveIntersectionTypes(
          type,
          depth,
          genericContext,
        );
        if (!intersectionTypes.ok) return intersectionTypes;
        typeInfo = {
          kind: TypeKind.Intersection,
          intersectionTypes: intersectionTypes.value,
        };
      } else if (type.isLiteral()) {
        typeInfo = {
          kind: TypeKind.Literal,
          literal: type.getLiteralValue(),
        };
      } else if (type.isTuple()) {
        const tupleTypes = await this.resolveTupleTypes(type, depth, genericContext);
        if (!tupleTypes.ok) return tupleTypes;
        typeInfo = {
          kind: TypeKind.Tuple,
          elements: tupleTypes.value,
        };
      } else if (type.isEnum()) {
        const enumName = type.getSymbol()?.getName();
        typeInfo = {
          kind: TypeKind.Enum,
          name: enumName || "UnknownEnum",
        };
      } else if (this.isKeyofType(type)) {
        const keyofResult = await this.resolveKeyofType(type);
        if (!keyofResult.ok) return keyofResult;
        typeInfo = keyofResult.value;
      } else if (this.isTypeofType(type)) {
        const typeofResult = await this.resolveTypeofType(type);
        if (!typeofResult.ok) return typeofResult;
        typeInfo = typeofResult.value;
      } else if (this.isIndexAccessType(type)) {
        const indexResult = await this.resolveIndexAccessType(type);
        if (!indexResult.ok) return indexResult;
        typeInfo = indexResult.value;
      } else if (type.isObject() || type.isInterface()) {
        // Check for type references that need expansion
        const symbol = type.getSymbol();

        // Check if this is a type reference to a type alias
        if (symbol && this.isTypeAlias(symbol)) {
          const aliasedType = this.getAliasedType(type);

          if (aliasedType) {
            // Check if the aliased type is a utility type first
            if (this.expandUtilityTypes) {
              const utilityExpanded =
                await this.utilityTypeExpander.expandUtilityType(
                  aliasedType,
                  (t, d) => this.resolveType(t, d, genericContext),
                  depth + 1,
                );
              if (utilityExpanded.ok && utilityExpanded.value) {
                this.visitedTypes.delete(typeString);
                return ok(utilityExpanded.value);
              }
            }

            // If not a utility type, recursively resolve the aliased type
            const resolvedAlias = await this.resolveType(
              aliasedType,
              depth + 1,
              genericContext,
            );
            if (resolvedAlias.ok) {
              this.visitedTypes.delete(typeString);
              return resolvedAlias;
            }
          }
        }

        const properties = await this.resolveProperties(type, depth, genericContext);
        if (!properties.ok) return properties;

        const genericParams = await this.resolveGenericParams(type);
        if (!genericParams.ok) return genericParams;

        const indexSignature = await this.resolveIndexSignature(type, depth, genericContext);
        if (!indexSignature.ok) return indexSignature;

        const objectName = type.getSymbol()?.getName();
        const unresolvedGenerics = genericContext.getUnresolvedGenerics();

        typeInfo = {
          kind: TypeKind.Object,
          ...(objectName && { name: objectName }),
          properties: properties.value,
          ...(genericParams.value.length > 0 && {
            genericParams: genericParams.value,
          }),
          ...(indexSignature.value && {
            indexSignature: indexSignature.value,
          }),
          ...(unresolvedGenerics.length > 0 && {
            unresolvedGenerics,
          }),
        };
      } else {
        typeInfo = { kind: TypeKind.Unknown };
      }

      const afterHook = await this.pluginManager.executeHook(
        HookType.AfterResolve,
        { type, symbol: type.getSymbol() },
        typeInfo,
      );

      this.visitedTypes.delete(typeString);

      return afterHook.ok ? ok(typeInfo) : afterHook;
    } catch (error) {
      this.visitedTypes.delete(typeString);
      return err(new Error(`Failed to resolve type: ${error}`));
    }
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
                const sourceFile = parentSymbol
                  ?.getDeclarations()?.[0]
                  ?.getSourceFile();
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
              const sourceFile = parentSymbol
                ?.getDeclarations()?.[0]
                ?.getSourceFile();
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
        const resolvedType = await this.resolveType(propType, depth + 1, context);

        if (!resolvedType.ok) return resolvedType;

        // Get JSDoc from the value declaration which contains the actual comments
        let jsDoc: string | undefined;

        if (valueDeclaration) {
          // Try to get JSDoc directly from the declaration node
          // Use proper TypeScript node type checking for JSDoc
          const jsDocs =
            "getJsDocs" in valueDeclaration &&
            typeof valueDeclaration.getJsDocs === "function"
              ? valueDeclaration.getJsDocs()
              : undefined;
          if (jsDocs && jsDocs.length > 0) {
            // Get the description from the first JSDoc
            jsDoc = jsDocs[0]?.getDescription?.() || jsDocs[0]?.getComment?.();
            if (typeof jsDoc !== "string" && jsDoc) {
              jsDoc = String(jsDoc);
            }
          }

          // Fallback to JSDoc tags
          if (!jsDoc) {
            const jsDocTags = symbol.getJsDocTags();
            if (jsDocTags.length > 0) {
              const commentTag = jsDocTags.find(
                (tag) => tag.getName() === "comment",
              );
              const tagText = commentTag?.getText() || jsDocTags[0]?.getText();
              jsDoc = Array.isArray(tagText)
                ? tagText.map((part) => part.text || part.toString()).join("")
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

        const transformed = await this.pluginManager.executeHook(
          HookType.TransformProperty,
          property,
        );

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
      const resolved = await this.resolveType(
        unionType,
        depth + 1,
        context,
      );
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

  private async resolveGenericParams(
    type: Type,
  ): Promise<Result<GenericParam[]>> {
    const genericParams: GenericParam[] = [];

    try {
      const symbol = type.getSymbol();
      if (!symbol) return ok(genericParams);

      const declarations = symbol.getDeclarations();
      if (!declarations || declarations.length === 0) return ok(genericParams);

      const declaration = declarations[0];
      if (!declaration) return ok(genericParams);

      if (
        "getTypeParameters" in declaration &&
        typeof declaration.getTypeParameters === "function"
      ) {
        const typeParams = declaration.getTypeParameters() ?? [];

        for (const param of typeParams) {
          const constraint = param.getConstraint();
          const defaultType = param.getDefault();

          let constraintType: TypeInfo | undefined;
          let defaultTypeInfo: TypeInfo | undefined;

          if (constraint) {
            const constraintResult = await this.resolveType(
              constraint.getType(),
              0,
            );
            if (constraintResult.ok) {
              constraintType = constraintResult.value;
            }
          }

          if (defaultType) {
            const defaultResult = await this.resolveType(
              defaultType.getType(),
              0,
            );
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

  private isTypeAlias(symbol: any): boolean {
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return false;

    return declarations.some((decl: any) => {
      return decl.getKindName && decl.getKindName() === "TypeAliasDeclaration";
    });
  }

  private getAliasedType(type: Type): Type | null {
    const symbol = type.getSymbol();
    if (!symbol) return null;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return null;

    for (const decl of declarations) {
      if (decl.getKindName && decl.getKindName() === "TypeAliasDeclaration") {
        if ("getType" in decl && typeof decl.getType === "function") {
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
        if ("getMembers" in decl && typeof decl.getMembers === "function") {
          const members = decl.getMembers();
          for (const member of members) {
            // Check if this is an index signature
            if (
              member.getKindName &&
              member.getKindName() === "IndexSignature"
            ) {
              // Check for readonly modifier
              const modifiers = member.getModifiers
                ? member.getModifiers()
                : [];
              isReadonly = modifiers.some(
                (mod: any) => mod.getKind() === ts.SyntaxKind.ReadonlyKeyword,
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
          keyType: "string",
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
          keyType: "number",
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
    if (
      "hasModifier" in valueDeclaration &&
      typeof valueDeclaration.hasModifier === "function"
    ) {
      return valueDeclaration.hasModifier(ts.SyntaxKind.ReadonlyKeyword);
    }

    return false;
  }

  private isKeyofType(type: Type): boolean {
    // Check if this is a keyof operator type
    const tsType = type.compilerType as ts.Type;
    if (tsType && "flags" in tsType) {
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
    return typeText.startsWith("typeof ") ||
           (symbol?.getName()?.startsWith("typeof ") ?? false);
  }

  private isIndexAccessType(type: Type): boolean {
    // Check if this is an indexed access type (T[K])
    const tsType = type.compilerType as ts.Type;
    if (tsType && "flags" in tsType) {
      // TypeScript TypeFlags.IndexedAccess = 8388608
      return (tsType.flags & ts.TypeFlags.IndexedAccess) !== 0;
    }
    return false;
  }

  private async resolveKeyofType(
    type: Type,
  ): Promise<Result<TypeInfo>> {
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

  private async resolveTypeofType(
    type: Type,
  ): Promise<Result<TypeInfo>> {
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

  private async resolveIndexAccessType(
    type: Type,
  ): Promise<Result<TypeInfo>> {
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
