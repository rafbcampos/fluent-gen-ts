# API Reference Overview

This is the complete API reference for Fluent Gen TS. The library provides
type-safe fluent builder generation from TypeScript interfaces and types.

## Quick Start

```typescript
import { FluentGen } from 'fluent-gen-ts';

const generator = new FluentGen();
const result = await generator.generateBuilder('./types.ts', 'User');

if (result.ok) {
  console.log(result.value); // Generated builder code
} else {
  console.error(result.error.message);
}
```

## Architecture Overview

Fluent Gen TS follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                      FluentGen                          │
│                   (Main API)                            │
├─────────────────────────────────────────────────────────┤
│     TypeExtractor        │        BuilderGenerator      │
│   (Type Analysis)        │      (Code Generation)       │
├─────────────────────────────────────────────────────────┤
│                   PluginManager                         │
│                 (Plugin System)                         │
├─────────────────────────────────────────────────────────┤
│    TypeInfo System     │     Result Types              │
│   (Type Definitions)   │   (Error Handling)            │
└─────────────────────────────────────────────────────────┘
```

## Core Classes

### FluentGen

The main entry point for fluent builder generation:

```typescript
class FluentGen {
  constructor(options?: FluentGenOptions);

  // Generate single builder
  generateBuilder(filePath: string, typeName: string): Promise<Result<string>>;

  // Generate multiple builders
  generateMultiple(
    filePath: string,
    typeNames: string[],
  ): Promise<Result<Map<string, string>>>;

  // Generate and write to file
  generateToFile(
    filePath: string,
    typeName: string,
    outputPath?: string,
  ): Promise<Result<string>>;

  // Scan file and generate all builders
  scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>;

  // Plugin management
  registerPlugin(plugin: Plugin): Result<void>;

  // Cache management
  clearCache(): void;
}

interface FluentGenOptions extends GeneratorConfig, TypeExtractorOptions {
  outputDir?: string;
  fileName?: string;
}
```

### TypeExtractor

Handles TypeScript type analysis and extraction:

```typescript
class TypeExtractor {
  constructor(options?: TypeExtractorOptions);

  // Extract single type
  extractType(
    filePath: string,
    typeName: string,
  ): Promise<Result<ResolvedType>>;

  // Extract multiple types
  extractMultiple(
    filePath: string,
    typeNames: string[],
  ): Promise<Result<ResolvedType[]>>;

  // Scan file for available types
  scanFile(filePath: string): Promise<Result<string[]>>;

  // Cache management
  clearCache(): void;
}

interface TypeExtractorOptions {
  tsConfigPath?: string;
  cache?: TypeResolutionCache;
  pluginManager?: PluginManager;
  maxDepth?: number;
}
```

### BuilderGenerator

Low-level builder code generation:

```typescript
class BuilderGenerator {
  constructor(config?: GeneratorConfig, pluginManager?: PluginManager);

  // Generate builder code
  generate(resolvedType: ResolvedType): Promise<Result<string>>;

  // Generate common utilities file
  generateCommonFile(): string;

  // State management
  setGeneratingMultiple(value: boolean): void;
  clearCache(): void;
}

interface GeneratorConfig extends GeneratorOptions {
  addComments?: boolean;
  generateCommonFile?: boolean;
}

interface GeneratorOptions {
  outputPath?: string;
  useDefaults?: boolean;
  contextType?: string;
  importPath?: string;
}
```

## Type System

### TypeInfo

The core discriminated union representing all TypeScript types:

```typescript
type TypeInfo =
  | { kind: TypeKind.Primitive; name: string; literal?: unknown }
  | {
      kind: TypeKind.Object;
      name?: string;
      properties: readonly PropertyInfo[] /* ... */;
    }
  | { kind: TypeKind.Array; elementType: TypeInfo }
  | { kind: TypeKind.Union; unionTypes: readonly TypeInfo[] }
  | { kind: TypeKind.Intersection; intersectionTypes: readonly TypeInfo[] }
  | {
      kind: TypeKind.Generic;
      name: string;
      typeArguments?: readonly TypeInfo[] /* ... */;
    }
  | { kind: TypeKind.Literal; literal: unknown }
  | {
      kind: TypeKind.Reference;
      name: string;
      typeArguments?: readonly TypeInfo[];
    }
  | { kind: TypeKind.Function; name?: string }
  | { kind: TypeKind.Tuple; elements: readonly TypeInfo[] }
  | { kind: TypeKind.Enum; name: string; values?: readonly unknown[] }
  | { kind: TypeKind.Keyof; target: TypeInfo }
  | { kind: TypeKind.Typeof; target: TypeInfo }
  | { kind: TypeKind.Index; object: TypeInfo; index: TypeInfo }
  | {
      kind: TypeKind.Conditional;
      checkType: TypeInfo;
      extendsType: TypeInfo /* ... */;
    }
  | { kind: TypeKind.Unknown }
  | { kind: TypeKind.Never };

enum TypeKind {
  Primitive = 'primitive',
  Object = 'object',
  Array = 'array',
  Union = 'union',
  Intersection = 'intersection',
  Generic = 'generic',
  Literal = 'literal',
  Unknown = 'unknown',
  Reference = 'reference',
  Function = 'function',
  Tuple = 'tuple',
  Enum = 'enum',
  Keyof = 'keyof',
  Typeof = 'typeof',
  Index = 'index',
  Conditional = 'conditional',
  Never = 'never',
}
```

### PropertyInfo

Represents object properties:

```typescript
interface PropertyInfo {
  readonly name: string;
  readonly type: TypeInfo;
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly jsDoc?: string;
}
```

### ResolvedType

Complete type information with dependencies:

```typescript
interface ResolvedType {
  readonly sourceFile: string;
  readonly name: string;
  readonly typeInfo: TypeInfo;
  readonly imports: readonly string[];
  readonly dependencies: readonly ResolvedType[];
}
```

## Result Types

Fluent Gen uses railway-oriented programming for error handling:

```typescript
type Result<T> = Ok<T> | Err;

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err {
  readonly ok: false;
  readonly error: Error;
}

// Utility functions
function ok<T>(value: T): Ok<T>;
function err(error: Error | string): Err;
function isOk<T>(result: Result<T>): result is Ok<T>;
function isErr<T>(result: Result<T>): result is Err;
```

## Plugin System

### PluginManager

Manages and executes plugins:

```typescript
class PluginManager {
  register(plugin: Plugin): void;
  unregister(name: string): boolean;
  executeHook<K extends HookType>(
    options: ExecuteHookOptions<K>,
  ): Promise<Result<GetHookReturnType<K>>>;
}
```

### Plugin Interface

```typescript
interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly imports?: PluginImports;

  // Hook implementations
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
}

enum HookType {
  BeforeParse = 'beforeParse',
  AfterParse = 'afterParse',
  BeforeResolve = 'beforeResolve',
  AfterResolve = 'afterResolve',
  BeforeGenerate = 'beforeGenerate',
  AfterGenerate = 'afterGenerate',
  TransformType = 'transformType',
  TransformProperty = 'transformProperty',
  TransformBuildMethod = 'transformBuildMethod',
  TransformPropertyMethod = 'transformPropertyMethod',
  AddCustomMethods = 'addCustomMethods',
  TransformValue = 'transformValue',
}
```

## Generated Builder Interface

Builders generated by Fluent Gen implement this interface:

```typescript
interface FluentBuilder<T, Ctx extends BuildContext = BuildContext> {
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  (context?: Ctx): T;
}

interface BuildContext {
  readonly parentId?: string;
  readonly parameterName?: string;
  readonly index?: number;
  readonly [key: string]: unknown;
}

// Utility function
function isFluentBuilder<T = unknown, Ctx extends BuildContext = BuildContext>(
  value: unknown,
): value is FluentBuilder<T, Ctx>;
```

## Common Usage Patterns

### Basic Generation

```typescript
import { FluentGen } from 'fluent-gen-ts';

const generator = new FluentGen({
  outputDir: './src/builders',
  useDefaults: true,
  addComments: true,
});

const result = await generator.generateBuilder('./types.ts', 'User');
if (result.ok) {
  console.log('Generated builder:', result.value);
}
```

### Multiple Types

```typescript
const result = await generator.generateMultiple('./types.ts', [
  'User',
  'Post',
  'Comment',
]);
if (result.ok) {
  for (const [filename, code] of result.value) {
    console.log(`Generated ${filename}`);
  }
}
```

### With Plugins

```typescript
const customPlugin: Plugin = {
  name: 'custom-validation',
  version: '1.0.0',
  transformProperty: property => {
    // Add validation logic
    return ok(property);
  },
};

generator.registerPlugin(customPlugin);
```

### File Generation

```typescript
const outputPath = await generator.generateToFile(
  './types.ts',
  'User',
  './src/builders/user.builder.ts',
);
if (outputPath.ok) {
  console.log('Builder written to:', outputPath.value);
}
```

## Error Handling

All async operations return `Result<T>` types for safe error handling:

```typescript
const result = await generator.generateBuilder('./types.ts', 'User');

if (result.ok) {
  // Success - use result.value
  console.log(result.value);
} else {
  // Error - handle result.error
  console.error('Generation failed:', result.error.message);
}
```

## Configuration Options

### FluentGenOptions

```typescript
interface FluentGenOptions {
  // Generator options
  outputPath?: string; // Output directory
  useDefaults?: boolean; // Generate default values
  contextType?: string; // Build context type name
  importPath?: string; // Import path for utilities
  addComments?: boolean; // Add JSDoc comments

  // Type extractor options
  tsConfigPath?: string; // TypeScript config path
  maxDepth?: number; // Maximum resolution depth
  cache?: TypeResolutionCache; // Custom cache instance
  pluginManager?: PluginManager; // Custom plugin manager

  // File generation
  outputDir?: string; // Output directory
  fileName?: string; // Output filename template
}
```

## Next Steps

- [Generator Functions Documentation](./generator.md) - Detailed code generation
  API
- [Type Resolution System](./resolver.md) - Type extraction and analysis
- [Plugin Development Guide](./plugins.md) - Creating custom plugins
