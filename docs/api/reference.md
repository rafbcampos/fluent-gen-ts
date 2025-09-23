# API Reference

This document provides comprehensive API documentation for fluent-gen-ts.

## FluentGen

The main class for generating fluent builders.

### Constructor

```typescript
constructor(options?: FluentGenOptions)
```

#### FluentGenOptions

| Property        | Type            | Description               | Default               |
| --------------- | --------------- | ------------------------- | --------------------- |
| `outputDir`     | `string`        | Default output directory  | `./generated`         |
| `fileName`      | `string`        | Default file name pattern | `{type}.builder.ts`   |
| `useDefaults`   | `boolean`       | Generate smart defaults   | `true`                |
| `addComments`   | `boolean`       | Include JSDoc comments    | `true`                |
| `contextType`   | `string`        | Custom context type name  | `BaseBuildContext`    |
| `tsConfigPath`  | `string`        | Path to tsconfig.json     | Auto-detected         |
| `cache`         | `Cache`         | Custom cache instance     | `new Cache()`         |
| `pluginManager` | `PluginManager` | Plugin manager instance   | `new PluginManager()` |
| `maxDepth`      | `number`        | Max recursion depth       | `10`                  |

### Methods

#### generateBuilder

Generate a single builder for a type.

```typescript
async generateBuilder(filePath: string, typeName: string): Promise<Result<string>>
```

**Parameters:**

- `filePath`: Path to TypeScript file containing the type
- `typeName`: Name of the type/interface to generate builder for

**Returns:** `Result<string>` containing the generated builder code

**Example:**

```typescript
const gen = new FluentGen();
const result = await gen.generateBuilder('./types.ts', 'User');

if (result.ok) {
  console.log(result.value); // Generated builder code
} else {
  console.error(result.error.message);
}
```

#### generateMultiple

Generate multiple builders from a single file with shared common utilities.

```typescript
async generateMultiple(
  filePath: string,
  typeNames: string[]
): Promise<Result<Map<string, string>>>
```

**Parameters:**

- `filePath`: Path to TypeScript file
- `typeNames`: Array of type names to generate builders for

**Returns:** `Result<Map<string, string>>` where keys are file names and values
are generated code

**Example:**

```typescript
const result = await gen.generateMultiple('./types.ts', [
  'User',
  'Product',
  'Order',
]);

if (result.ok) {
  result.value.forEach((code, fileName) => {
    console.log(`${fileName}:\n${code}`);
  });
}
```

#### generateMultipleFromFiles

Generate builders from multiple files.

```typescript
async generateMultipleFromFiles(
  fileTypeMap: Map<string, string[]>
): Promise<Result<Map<string, string>>>
```

**Example:**

```typescript
const fileTypeMap = new Map([
  ['./src/user.ts', ['User', 'UserProfile']],
  ['./src/product.ts', ['Product', 'Category']],
]);

const result = await gen.generateMultipleFromFiles(fileTypeMap);
```

#### generateToFile

Generate and write a builder directly to a file.

```typescript
async generateToFile(
  filePath: string,
  typeName: string,
  outputPath?: string
): Promise<Result<string>>
```

**Returns:** `Result<string>` containing the output file path

#### scanAndGenerate

Scan files using a glob pattern and generate builders for all found types.

```typescript
async scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>
```

**Example:**

```typescript
const result = await gen.scanAndGenerate('src/**/*.ts');
```

#### registerPlugin

Register a plugin with the generator.

```typescript
registerPlugin(plugin: Plugin): Result<void>
```

#### clearCache

Clear the internal cache.

```typescript
clearCache(): void
```

## Result Type

All async operations return a `Result<T>` type for explicit error handling.

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
```

**Usage Pattern:**

```typescript
const result = await someOperation();

if (result.ok) {
  // Success case
  console.log(result.value);
} else {
  // Error case
  console.error(result.error.message);
}
```

## PluginManager

Manages plugin registration and execution.

### Methods

#### register

Register a new plugin.

```typescript
register(plugin: Plugin): void
```

#### unregister

Remove a plugin by name.

```typescript
unregister(name: string): boolean
```

#### executeHook

Execute a specific plugin hook.

```typescript
async executeHook<K extends HookType>(
  options: ExecuteHookOptions<K>
): Promise<Result<GetHookReturnType<K>>>
```

#### getPlugins

Get all registered plugins.

```typescript
getPlugins(): ReadonlyArray<Plugin>
```

#### getRequiredImports

Get imports required by all registered plugins.

```typescript
getRequiredImports(): PluginImports
```

## Plugin Interface

```typescript
interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly imports?: PluginImports;

  // Lifecycle hooks
  beforeParse?: (context: ParseContext) => Result<ParseContext>;
  afterParse?: (context: ParseContext, type: Type) => Result<Type>;
  beforeResolve?: (context: ResolveContext) => Result<ResolveContext>;
  afterResolve?: (
    context: ResolveContext,
    typeInfo: TypeInfo,
  ) => Result<TypeInfo>;
  beforeGenerate?: (context: GenerateContext) => Result<GenerateContext>;
  afterGenerate?: (code: string, context: GenerateContext) => Result<string>;

  // Transformation hooks
  transformType?: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>;
  transformProperty?: (property: PropertyInfo) => Result<PropertyInfo>;
  transformBuildMethod?: (context: BuildMethodContext) => Result<string>;
  transformPropertyMethod?: (
    context: PropertyMethodContext,
  ) => Result<PropertyMethodTransform>;
  transformValue?: (context: ValueContext) => Result<ValueTransform | null>;
  transformImports?: (
    context: ImportTransformContext,
  ) => Result<ImportTransformContext>;

  // Extension hooks
  addCustomMethods?: (
    context: BuilderContext,
  ) => Result<readonly CustomMethod[]>;
}
```

### Plugin Context Types

#### PropertyMethodContext

Context provided to `transformPropertyMethod` hook.

```typescript
interface PropertyMethodContext {
  readonly property: PropertyInfo;
  readonly propertyType: TypeInfo;
  readonly builderName: string;
  readonly typeName: string;
  readonly originalTypeString: string;

  // Helper methods
  isType(kind: TypeKind): boolean;
  hasGenericConstraint(constraintName: string): boolean;
  isArrayType(): boolean;
  isUnionType(): boolean;
  isPrimitiveType(name?: string): boolean;
}
```

#### BuildMethodContext

Context for `transformBuildMethod` hook.

```typescript
interface BuildMethodContext {
  readonly typeName: string;
  readonly builderName: string;
  readonly buildMethodCode: string;
  readonly properties: readonly PropertyInfo[];
  readonly genericParams: string;
  readonly genericConstraints: string;
  readonly options: GeneratorOptions;
  readonly resolvedType: ResolvedType;
}
```

#### BuilderContext

Context for `addCustomMethods` hook.

```typescript
interface BuilderContext {
  readonly typeName: string;
  readonly builderName: string;
  readonly properties: readonly PropertyInfo[];
  readonly genericParams: string;
  readonly genericConstraints: string;
}
```

## Generated Builder API

All generated builders extend `FluentBuilderBase` and implement this interface:

```typescript
interface FluentBuilder<T, C extends BaseBuildContext = BaseBuildContext> {
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  build(context?: C): T;
}
```

### Builder Methods

#### Property Methods

For each property in the type, a `with{PropertyName}` method is generated:

```typescript
// For property: name: string
withName(value: string): this

// For property: age?: number
withAge(value: number): this

// For property: items: Item[]
withItems(value: Item[] | FluentBuilder<Item>[]): this
```

#### Utility Methods

All builders include these utility methods:

```typescript
// Conditional setting
if<K extends keyof T>(
  predicate: (builder: this) => boolean,
  property: K,
  value: T[K] | FluentBuilder<T[K]> | (() => T[K] | FluentBuilder<T[K]>)
): this

// Conditional with alternative
ifElse<K extends keyof T>(
  predicate: (builder: this) => boolean,
  property: K,
  trueValue: T[K] | FluentBuilder<T[K]> | (() => T[K] | FluentBuilder<T[K]>),
  falseValue: T[K] | FluentBuilder<T[K]> | (() => T[K] | FluentBuilder<T[K]>)
): this

// Check if property is set
has<K extends keyof T>(key: K): boolean

// Peek at current value
peek<K extends keyof T>(key: K): T[K] | undefined

// Build the final object
build(context?: BaseBuildContext): T
```

### Context Interface

```typescript
interface BaseBuildContext {
  readonly parentId?: string;
  readonly parameterName?: string;
  readonly index?: number;
  readonly [key: string]: unknown;
}
```

## Type Information

### TypeInfo

Represents resolved type information.

```typescript
interface TypeInfo {
  name: string;
  kind: TypeKind;
  isOptional: boolean;
  isArray: boolean;
  isUnion: boolean;
  isGeneric: boolean;
  genericParams?: TypeInfo[];
  unionTypes?: TypeInfo[];
  properties?: PropertyInfo[];
  jsDoc?: string;
}
```

### TypeKind

Enumeration of supported type kinds.

```typescript
enum TypeKind {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Array = 'array',
  Object = 'object',
  Union = 'union',
  Intersection = 'intersection',
  Generic = 'generic',
  Literal = 'literal',
  Unknown = 'unknown',
}
```

### PropertyInfo

Represents a property within a type.

```typescript
interface PropertyInfo {
  name: string;
  type: TypeInfo;
  isOptional: boolean;
  jsDoc?: string;
}
```

## Utility Functions

### Type Guards

```typescript
// Check if value is a fluent builder
function isFluentBuilder<
  T = unknown,
  C extends BaseBuildContext = BaseBuildContext,
>(value: unknown): value is FluentBuilder<T, C>;

// Check if value is an array of builders
function isBuilderArray<
  T = unknown,
  C extends BaseBuildContext = BaseBuildContext,
>(value: unknown): value is Array<FluentBuilder<T, C>>;
```

### Result Helpers

```typescript
// Create success result
function ok<T>(value: T): Result<T>;

// Create error result
function err<T>(error: Error): Result<T>;
```

### Context Helpers

```typescript
// Create nested context
function createNestedContext<C extends BaseBuildContext>(
  parentContext: C,
  parameterName: string,
  index?: number,
): C;

// Resolve builders in value
function resolveValue<T, C extends BaseBuildContext>(
  value: unknown,
  context?: C,
): unknown;
```

## Configuration

### Config File Interface

```typescript
interface Config {
  types: Array<{
    file: string;
    types: string[];
  }>;
  output: {
    dir: string;
    mode: 'single' | 'batch';
  };
  generator?: {
    useDefaults?: boolean;
    addComments?: boolean;
    maxDepth?: number;
    contextType?: string;
  };
  tsConfigPath?: string;
  plugins?: string[];
}
```

## Error Types

### Common Error Scenarios

1. **File Not Found**: When the specified TypeScript file doesn't exist
2. **Type Not Found**: When the specified type/interface doesn't exist in the
   file
3. **Invalid Type**: When the type cannot be converted to a builder (e.g.,
   primitives, functions)
4. **Circular Reference**: When types have circular dependencies exceeding max
   depth
5. **Plugin Error**: When a plugin hook fails or returns invalid data
6. **Generation Error**: When code generation fails due to unsupported type
   constructs

### Error Handling Pattern

```typescript
try {
  const result = await gen.generateBuilder(file, type);

  if (result.ok) {
    // Handle success
    processGeneratedCode(result.value);
  } else {
    // Handle specific error types
    switch (result.error.message) {
      case 'File not found':
        console.error('Check file path');
        break;
      case 'Type not found':
        console.error('Check type name and exports');
        break;
      default:
        console.error('Generation failed:', result.error.message);
    }
  }
} catch (error) {
  // Handle unexpected errors
  console.error('Unexpected error:', error);
}
```

## Examples

### Basic Usage

```typescript
import { FluentGen } from 'fluent-gen-ts';

const gen = new FluentGen({
  useDefaults: true,
  addComments: true,
});

const result = await gen.generateBuilder('./user.ts', 'User');
if (result.ok) {
  console.log(result.value);
}
```

### With Plugins

```typescript
import { FluentGen, PluginManager } from 'fluent-gen-ts';
import validationPlugin from './plugins/validation.js';

const pluginManager = new PluginManager();
pluginManager.register(validationPlugin);

const gen = new FluentGen({ pluginManager });
```

### Batch Generation

```typescript
const fileTypeMap = new Map([
  ['./src/user.ts', ['User', 'UserProfile']],
  ['./src/product.ts', ['Product', 'Category']],
]);

const result = await gen.generateMultipleFromFiles(fileTypeMap);

if (result.ok) {
  for (const [fileName, code] of result.value) {
    await writeFile(fileName, code);
  }
}
```
