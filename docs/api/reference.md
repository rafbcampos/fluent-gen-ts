# API Reference

## FluentGen

### Constructor

```typescript
new FluentGen(options?: FluentGenOptions)
```

### FluentGenOptions

| Property         | Type             | Description                             |
| ---------------- | ---------------- | --------------------------------------- |
| `outputDir`      | `string`         | Output directory for generated builders |
| `fileName`       | `string`         | File name pattern                       |
| `outputPath`     | `string`         | Output file path                        |
| `useDefaults`    | `boolean`        | Generate default values                 |
| `addComments`    | `boolean`        | Include JSDoc comments                  |
| `contextType`    | `string`         | Context type name                       |
| `tsConfigPath`   | `string`         | Path to tsconfig.json                   |
| `cache`          | `Cache`          | Cache instance                          |
| `pluginManager`  | `PluginManager`  | Plugin manager instance                 |
| `maxDepth`       | `number`         | Maximum recursion depth (1-100)         |
| `monorepoConfig` | `MonorepoConfig` | Monorepo configuration                  |

### Methods

#### generateBuilder

```typescript
async generateBuilder(filePath: string, typeName: string): Promise<Result<string>>
```

Generates a builder for a single type.

**Parameters:**

- `filePath`: Path to TypeScript file (.ts, .tsx, or .d.ts)
- `typeName`: Name of the type to generate builder for

**Returns:** `Result<string>` - Generated builder code or error

#### generateMultiple

```typescript
async generateMultiple(
  filePath: string,
  typeNames: string[]
): Promise<Result<Map<string, string>>>
```

Generates multiple builders from a single file. Creates a common.ts file with
shared utilities.

**Parameters:**

- `filePath`: Path to TypeScript file
- `typeNames`: Array of type names

**Returns:** `Result<Map<string, string>>` - Map of file names to generated code

#### generateMultipleFromFiles

```typescript
async generateMultipleFromFiles(
  fileTypeMap: Map<string, string[]>
): Promise<Result<Map<string, string>>>
```

Generates builders from multiple files.

**Parameters:**

- `fileTypeMap`: Map of file paths to arrays of type names

**Returns:** `Result<Map<string, string>>` - Map of file names to generated code

#### generateToFile

```typescript
async generateToFile(
  filePath: string,
  typeName: string,
  outputPath?: string
): Promise<Result<string>>
```

Generates and writes a builder to a file.

**Parameters:**

- `filePath`: Source TypeScript file path
- `typeName`: Type name
- `outputPath`: Output path (optional)

**Returns:** `Result<string>` - Output file path or error

#### scanAndGenerate

```typescript
async scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>
```

Scans files using glob pattern and generates builders.

**Parameters:**

- `pattern`: Glob pattern

**Returns:** `Result<Map<string, string>>` - Map of `{filePath}:{typeName}` to
generated code

#### registerPlugin

```typescript
registerPlugin(plugin: Plugin): Result<void>
```

Registers a plugin.

**Parameters:**

- `plugin`: Plugin instance

**Returns:** `Result<void>` - Success or error

#### clearCache

```typescript
clearCache(): void
```

Clears internal cache.

---

## Plugin System

### createPlugin

```typescript
function createPlugin(name: string, version: string): PluginBuilder;
```

Creates a new plugin builder.

**Parameters:**

- `name`: Plugin name
- `version`: Plugin version

**Returns:** `PluginBuilder`

### PluginBuilder

#### setDescription

```typescript
setDescription(description: string): PluginBuilder
```

Sets plugin description.

#### requireImports

```typescript
requireImports(configurator: (manager: ImportManager) => ImportManager): PluginBuilder
```

Configures plugin imports.

#### beforeParse

```typescript
beforeParse(hook: (context: ParseContext) => Result<ParseContext>): PluginBuilder
```

Hook executed before parsing.

#### afterParse

```typescript
afterParse(hook: (context: ParseContext, type: Type) => Result<Type>): PluginBuilder
```

Hook executed after parsing.

#### beforeResolve

```typescript
beforeResolve(hook: (context: ResolveContext) => Result<ResolveContext>): PluginBuilder
```

Hook executed before type resolution.

#### afterResolve

```typescript
afterResolve(hook: (context: ResolveContext, typeInfo: TypeInfo) => Result<TypeInfo>): PluginBuilder
```

Hook executed after type resolution.

#### beforeGenerate

```typescript
beforeGenerate(hook: (context: GenerateContext) => Result<GenerateContext>): PluginBuilder
```

Hook executed before code generation.

#### afterGenerate

```typescript
afterGenerate(hook: (code: string, context: GenerateContext) => Result<string>): PluginBuilder
```

Hook executed after code generation.

#### transformType

```typescript
transformType(hook: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>): PluginBuilder
```

Transforms type information.

#### transformProperty

```typescript
transformProperty(hook: (property: PropertyInfo) => Result<PropertyInfo>): PluginBuilder
```

Transforms property information.

#### transformPropertyMethods

```typescript
transformPropertyMethods(
  configurator: (builder: PropertyMethodTransformBuilder) => PropertyMethodTransformBuilder
): PluginBuilder
```

Configures property method transformations.

#### addMethod

```typescript
addMethod(configurator: (builder: CustomMethodBuilder) => CustomMethodBuilder): PluginBuilder
```

Adds custom method to builders.

#### transformValues

```typescript
transformValues(
  configurator: (builder: ValueTransformBuilder) => ValueTransformBuilder
): PluginBuilder
```

Configures value transformations.

#### transformBuildMethod

```typescript
transformBuildMethod(
  configurator: (builder: BuildMethodTransformBuilder) => BuildMethodTransformBuilder
): PluginBuilder
```

Transforms build method.

#### transformImports

```typescript
transformImports(
  hook: (context: ImportTransformContext) => Result<ImportTransformContext>
): PluginBuilder
```

Transforms import statements.

#### build

```typescript
build(): Plugin
```

Builds the plugin.

---

## Type Matchers

### primitive

```typescript
primitive(...names: string[]): TypeMatcher
```

Matches primitive types.

**Parameters:**

- `names`: Primitive type names ('string', 'number', 'boolean', etc.)

### object

```typescript
object(name?: string): ObjectTypeMatcher
```

Matches object types.

**Parameters:**

- `name`: Object name (optional)

### ObjectTypeMatcher Methods

#### withGeneric

```typescript
withGeneric(name?: string): ObjectTypeMatcher
```

Matches objects with generic parameters.

#### withProperty

```typescript
withProperty(name: string, type?: TypeMatcher): ObjectTypeMatcher
```

Matches objects with specific property.

#### withProperties

```typescript
withProperties(...names: string[]): ObjectTypeMatcher
```

Matches objects with multiple properties.

### array

```typescript
array(): ArrayTypeMatcher
```

Matches array types.

### ArrayTypeMatcher Methods

#### of

```typescript
of(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): ArrayTypeMatcher
```

Specifies array element type.

### union

```typescript
union(): UnionTypeMatcher
```

Matches union types.

### UnionTypeMatcher Methods

#### containing

```typescript
containing(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): UnionTypeMatcher
```

Matches unions containing specific type.

#### exact

```typescript
exact(...matchers: TypeMatcher[]): UnionTypeMatcher
```

Matches exact union types.

### intersection

```typescript
intersection(): IntersectionTypeMatcher
```

Matches intersection types.

### IntersectionTypeMatcher Methods

#### including

```typescript
including(matcher: TypeMatcher | ((m: TypeMatcherBuilder) => TypeMatcher)): IntersectionTypeMatcher
```

Matches intersections including specific type.

#### exact

```typescript
exact(...matchers: TypeMatcher[]): IntersectionTypeMatcher
```

Matches exact intersection types.

### Other Matchers

```typescript
reference(name?: string): TypeMatcher
generic(name?: string): TypeMatcher
any(): TypeMatcher
never(): TypeMatcher
literal(value: string | number | boolean): TypeMatcher
or(...matchers: TypeMatcher[]): TypeMatcher
and(...matchers: TypeMatcher[]): TypeMatcher
not(matcher: TypeMatcher): TypeMatcher
```

---

## Transform Builders

### PropertyMethodTransformBuilder

#### when

```typescript
when(predicate: (context: PropertyMethodContext) => boolean): PropertyMethodTransformBuilder
```

Starts new transformation rule with condition.

#### setParameter

```typescript
setParameter(type: string | ((original: string) => string)): PropertyMethodTransformBuilder
```

Sets parameter type transformation.

#### setExtractor

```typescript
setExtractor(code: string): PropertyMethodTransformBuilder
```

Sets value extraction code.

#### setValidator

```typescript
setValidator(code: string): PropertyMethodTransformBuilder
```

Sets validation code.

#### done

```typescript
done(): PropertyMethodTransformBuilder
```

Completes current rule.

#### build

```typescript
build(): (context: PropertyMethodContext) => PropertyMethodTransform
```

Builds transformation function.

### CustomMethodBuilder

#### name

```typescript
name(name: string): CustomMethodBuilder
```

Sets method name.

#### param

```typescript
param(
  name: string,
  type: string,
  options?: { optional?: boolean; defaultValue?: string }
): CustomMethodBuilder
```

Adds method parameter.

#### returns

```typescript
returns(type: string | ((context: BuilderContext) => string)): CustomMethodBuilder
```

Sets return type.

#### implementation

```typescript
implementation(code: string | ((context: BuilderContext) => string)): CustomMethodBuilder
```

Sets method implementation.

#### jsDoc

```typescript
jsDoc(doc: string): CustomMethodBuilder
```

Sets JSDoc comment.

#### build

```typescript
build(): CustomMethodDefinition
```

Builds method definition.

### ValueTransformBuilder

#### when

```typescript
when(predicate: (context: ValueContext) => boolean): ValueTransformBuilder
```

Starts new transformation rule.

#### transform

```typescript
transform(code: string | ((value: string) => string)): ValueTransformBuilder
```

Sets transformation code.

#### withCondition

```typescript
withCondition(condition: string): ValueTransformBuilder
```

Sets transformation condition.

#### done

```typescript
done(): ValueTransformBuilder
```

Completes current rule.

#### build

```typescript
build(): (context: ValueContext) => ValueTransform | null
```

Builds transformation function.

### BuildMethodTransformBuilder

#### insertBefore

```typescript
insertBefore(marker: string | RegExp, code: string): BuildMethodTransformBuilder
```

Inserts code before marker.

#### insertAfter

```typescript
insertAfter(marker: string | RegExp, code: string): BuildMethodTransformBuilder
```

Inserts code after marker.

#### replace

```typescript
replace(marker: string | RegExp, replacement: string): BuildMethodTransformBuilder
```

Replaces marker with code.

#### wrap

```typescript
wrap(before: string, after: string): BuildMethodTransformBuilder
```

Wraps build method with code.

#### build

```typescript
build(): (context: BuildMethodContext) => string
```

Builds transformation function.

---

## Import Management

### ImportManager

#### addInternal

```typescript
addInternal(
  path: string,
  imports: string | string[],
  options?: {
    typeOnly?: boolean;
    isDefault?: boolean;
    defaultName?: string;
  }
): ImportManager
```

Adds internal import.

#### addExternal

```typescript
addExternal(
  packageName: string,
  imports: string | string[],
  options?: {
    typeOnly?: boolean;
    isDefault?: boolean;
    defaultName?: string;
  }
): ImportManager
```

Adds external import.

#### addInternalTypes

```typescript
addInternalTypes(path: string, types: string | string[]): ImportManager
```

Adds internal type imports.

#### addExternalTypes

```typescript
addExternalTypes(packageName: string, types: string | string[]): ImportManager
```

Adds external type imports.

#### addInternalDefault

```typescript
addInternalDefault(path: string, defaultName: string): ImportManager
```

Adds internal default import.

#### addExternalDefault

```typescript
addExternalDefault(packageName: string, defaultName: string): ImportManager
```

Adds external default import.

#### merge

```typescript
merge(other: ImportManager): ImportManager
```

Merges imports from another manager.

#### deduplicate

```typescript
deduplicate(): ImportManager
```

Removes duplicate imports.

#### clear

```typescript
clear(): ImportManager
```

Clears all imports.

#### clone

```typescript
clone(): ImportManager
```

Creates copy of import manager.

#### hasImport

```typescript
hasImport(predicate: (imp: Import) => boolean): boolean
```

Checks if import exists.

#### removeImports

```typescript
removeImports(predicate: (imp: Import) => boolean): ImportManager
```

Removes matching imports.

#### getImports

```typescript
getImports(): readonly Import[]
```

Returns all imports.

#### getGroupedImports

```typescript
getGroupedImports(): {
  internal: readonly InternalImport[];
  external: readonly ExternalImport[];
}
```

Returns imports grouped by type.

#### toImportStatements

```typescript
toImportStatements(): string[]
```

Converts to import statements.

#### build

```typescript
build(): PluginImports
```

Builds plugin imports configuration.

---

## Plugin Manager

### Constructor

```typescript
new PluginManager();
```

### Methods

#### register

```typescript
register(plugin: Plugin): void
```

Registers a plugin. Throws error if validation fails or plugin name already
registered.

#### unregister

```typescript
unregister(name: string): boolean
```

Unregisters plugin by name. Returns true if removed, false if not found.

#### getPlugins

```typescript
getPlugins(): readonly Plugin[]
```

Returns all registered plugins.

#### getPlugin

```typescript
getPlugin(name: string): Plugin | undefined
```

Returns plugin by name or undefined.

#### hasPlugin

```typescript
hasPlugin(name: string): boolean
```

Checks if plugin is registered.

#### getPluginCount

```typescript
getPluginCount(): number
```

Returns number of registered plugins.

#### getPluginsByHookType

```typescript
getPluginsByHookType(hookType: HookTypeValue): readonly Plugin[]
```

Returns plugins that implement specific hook.

#### executeHook

```typescript
async executeHook<K extends HookTypeValue>(
  options: ExecuteHookOptions<K>
): Promise<Result<ReturnType<PluginHookMap[K]>>>
```

Executes hook across all registered plugins sequentially.

#### executePluginHook

```typescript
async executePluginHook<K extends HookTypeValue>(
  pluginName: string,
  options: ExecuteHookOptions<K>
): Promise<Result<ReturnType<PluginHookMap[K]>>>
```

Executes hook from specific plugin.

#### getPropertyMethodTransform

```typescript
getPropertyMethodTransform(context: PropertyMethodContext): PropertyMethodTransform | null
```

Returns merged property method transformations from all plugins.

#### getCustomMethods

```typescript
getCustomMethods(context: BuilderContext): readonly CustomMethod[]
```

Returns custom methods from all plugins.

#### getValueTransforms

```typescript
getValueTransforms(context: ValueContext): readonly ValueTransform[]
```

Returns value transformations from all plugins.

#### getRequiredImports

```typescript
getRequiredImports(): ImportManager
```

Returns deduplicated imports from all plugins.

#### generateImportStatements

```typescript
generateImportStatements(): string[]
```

Generates import statements from all plugins.

#### clear

```typescript
clear(): void
```

Removes all registered plugins.

---

## Context Types

### ParseContext

```typescript
interface ParseContext {
  readonly sourceFile: string;
  readonly typeName: string;
}
```

### ResolveContext

```typescript
interface ResolveContext {
  readonly type: Type;
  readonly symbol?: Symbol | undefined;
  readonly sourceFile?: string;
  readonly typeName?: string;
}
```

### GenerateContext

```typescript
interface GenerateContext {
  readonly resolvedType: ResolvedType;
  readonly options: GeneratorOptions;
}
```

### PropertyMethodContext

```typescript
interface PropertyMethodContext {
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
  readonly builderName: string;
  readonly property: PropertyInfo;
  readonly propertyType: TypeInfo;
  readonly originalTypeString: string;
  readonly type: TypeMatcherInterface;

  hasGeneric(name: string): boolean;
  getGenericConstraint(name: string): string | undefined;
  isOptional(): boolean;
  isReadonly(): boolean;
  getPropertyPath(): string[];
  getMethodName(): string;
}
```

### BuilderContext

```typescript
interface BuilderContext {
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
  readonly builderName: string;
  readonly genericParams: string;
  readonly genericConstraints: string;
  readonly properties: readonly PropertyInfo[];

  hasProperty(name: string): boolean;
  getProperty(name: string): PropertyInfo | undefined;
  getRequiredProperties(): readonly PropertyInfo[];
  getOptionalProperties(): readonly PropertyInfo[];
}
```

### ValueContext

```typescript
interface ValueContext {
  readonly property: string;
  readonly valueVariable: string;
  readonly type: TypeInfo;
  readonly isOptional: boolean;
  readonly typeChecker: TypeMatcherInterface;
}
```

### BuildMethodContext

```typescript
interface BuildMethodContext {
  readonly typeName: string;
  readonly typeInfo: TypeInfo;
  readonly builderName: string;
  readonly buildMethodCode: string;
  readonly properties: readonly PropertyInfo[];
  readonly options: GeneratorOptions;
  readonly resolvedType: ResolvedType;
  readonly genericParams: string;
  readonly genericConstraints: string;
}
```

### TypeMatcherInterface

```typescript
interface TypeMatcherInterface {
  isPrimitive(...names: string[]): boolean;
  isObject(name?: string): ObjectTypeMatcher;
  isArray(): ArrayTypeMatcher;
  isUnion(): UnionTypeMatcher;
  isIntersection(): IntersectionTypeMatcher;
  isReference(name?: string): boolean;
  isGeneric(name?: string): boolean;
  matches(matcher: TypeMatcher): boolean;
  toString(): string;
}
```

---

## Core Types

### TypeInfo

```typescript
interface TypeInfo {
  kind: TypeKind;
  name?: string;
  properties?: PropertyInfo[];
  elementType?: TypeInfo;
  types?: TypeInfo[];
  genericParams?: TypeInfo[];
  value?: string | number | boolean;
}
```

### PropertyInfo

```typescript
interface PropertyInfo {
  name: string;
  type: TypeInfo;
  optional: boolean;
  readonly: boolean;
  jsDoc?: string;
}
```

### TypeKind

```typescript
enum TypeKind {
  Primitive = 'primitive',
  Object = 'object',
  Array = 'array',
  Union = 'union',
  Intersection = 'intersection',
  Reference = 'reference',
  Generic = 'generic',
  Any = 'any',
  Never = 'never',
  Literal = 'literal',
}
```

### Plugin

```typescript
interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly imports?: PluginImports;

  beforeParse?: (context: ParseContext) => Result<ParseContext>;
  afterParse?: (context: ParseContext, type: Type) => Result<Type>;
  beforeResolve?: (context: ResolveContext) => Result<ResolveContext>;
  afterResolve?: (
    context: ResolveContext,
    typeInfo: TypeInfo,
  ) => Result<TypeInfo>;
  beforeGenerate?: (context: GenerateContext) => Result<GenerateContext>;
  afterGenerate?: (code: string, context: GenerateContext) => Result<string>;

  transformType?: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>;
  transformProperty?: (property: PropertyInfo) => Result<PropertyInfo>;
  transformBuildMethod?: (context: BuildMethodContext) => Result<string>;
  transformPropertyMethod?: (
    context: PropertyMethodContext,
  ) => Result<PropertyMethodTransform>;
  addCustomMethods?: (
    context: BuilderContext,
  ) => Result<readonly CustomMethod[]>;
  transformValue?: (context: ValueContext) => Result<ValueTransform | null>;
  transformImports?: (
    context: ImportTransformContext,
  ) => Result<ImportTransformContext>;
}
```

### PropertyMethodTransform

```typescript
interface PropertyMethodTransform {
  readonly parameterType?: string;
  readonly extractValue?: string;
  readonly validate?: string;
}
```

### CustomMethod

```typescript
interface CustomMethod {
  readonly name: string;
  readonly signature: string;
  readonly implementation: string;
  readonly jsDoc?: string;
}
```

### ValueTransform

```typescript
interface ValueTransform {
  readonly condition?: string;
  readonly transform: string;
}
```

### HookTypeValue

```typescript
type HookTypeValue =
  | 'beforeParse'
  | 'afterParse'
  | 'beforeResolve'
  | 'afterResolve'
  | 'beforeGenerate'
  | 'afterGenerate'
  | 'transformType'
  | 'transformProperty'
  | 'transformBuildMethod'
  | 'transformPropertyMethod'
  | 'addCustomMethods'
  | 'transformValue'
  | 'transformImports';
```

---

## Result Type

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
```

### Helper Functions

```typescript
function ok<T>(value: T): Result<T>;
```

Creates success result.

```typescript
function err<T>(error: Error): Result<T>;
```

Creates error result.

---

## Utility Functions

### isValidPlugin

```typescript
function isValidPlugin(obj: unknown): obj is Plugin;
```

Type guard for Plugin interface. Checks for required name and version
properties.

### createPluginManager

```typescript
function createPluginManager(): PluginManager;
```

Creates new PluginManager instance.

### createImportManager

```typescript
function createImportManager(): ImportManager;
```

Creates new ImportManager instance.

### createTypeMatcher

```typescript
function createTypeMatcher(): TypeMatcherBuilder;
```

Creates new TypeMatcherBuilder instance.

---

## Context Enhancers

### enhanceParseContext

```typescript
function enhanceParseContext(context: ParseContext): ParseContext;
```

Enhances parse context with utility methods.

### enhanceResolveContext

```typescript
function enhanceResolveContext(context: ResolveContext): ResolveContext;
```

Enhances resolve context with utility methods.

### enhanceGenerateContext

```typescript
function enhanceGenerateContext(context: GenerateContext): GenerateContext;
```

Enhances generate context with utility methods.

### enhancePropertyMethodContext

```typescript
function enhancePropertyMethodContext(
  context: PropertyMethodContext,
): PropertyMethodContext;
```

Enhances property method context with type matcher interface and helper methods.

### enhanceBuilderContext

```typescript
function enhanceBuilderContext(context: BuilderContext): BuilderContext;
```

Enhances builder context with property query methods.

### enhanceValueContext

```typescript
function enhanceValueContext(context: ValueContext): ValueContext;
```

Enhances value context with type checker.

### enhanceBuildMethodContext

```typescript
function enhanceBuildMethodContext(
  context: BuildMethodContext,
): BuildMethodContext;
```

Enhances build method context with utility methods.
