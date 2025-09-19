# API Reference Overview

This is the complete API reference for Fluent Gen. The API is organized into several modules that work together to provide type extraction, code generation, and builder creation capabilities.

## Architecture Overview

Fluent Gen follows a microkernel architecture with the following core components:

```
┌─────────────────────────────────────────────────────────┐
│                    Fluent Gen Core                      │
├─────────────────────────────────────────────────────────┤
│  CLI Layer          │  Programmatic API                 │
├─────────────────────┼───────────────────────────────────┤
│  Generator Layer    │  Code Generation Engine           │
├─────────────────────┼───────────────────────────────────┤
│  Type Info Layer    │  Type Extraction & Resolution     │
├─────────────────────┼───────────────────────────────────┤
│  Core Layer         │  Result Types, Caching, Plugins   │
└─────────────────────────────────────────────────────────┘
```

## Module Structure

### Core Modules (`/src/core/`)

**Purpose**: Fundamental types, utilities, and abstractions

- [`types.ts`](#core-types) - Core type definitions and interfaces
- [`result.ts`](#result-types) - Railway-oriented programming types
- [`cache.ts`](#caching-system) - Type resolution caching
- [`plugin.ts`](#plugin-system) - Plugin architecture and hooks
- [`import-resolver.ts`](#import-resolution) - TypeScript import resolution

### Type Information (`/src/type-info/`)

**Purpose**: TypeScript parsing, analysis, and type resolution

- [`parser.ts`](#type-parser) - TypeScript AST parsing
- [`resolver.ts`](#type-resolver) - Type resolution and dependency tracking
- [`extractor.ts`](#type-extractor) - Main type extraction orchestration
- [`utility-expander.ts`](#utility-types) - Utility type expansion
- [`conditional-resolver.ts`](#conditional-types) - Conditional type resolution
- [`mapped-resolver.ts`](#mapped-types) - Mapped type resolution

### Code Generation (`/src/gen/`)

**Purpose**: Builder code generation and output formatting

- [`generator.ts`](#code-generator) - Main generation orchestration
- [`import-generator.ts`](#import-generation) - Import statement generation
- [`method-generator.ts`](#method-generation) - Builder method generation
- [`template-generator.ts`](#template-generation) - Code template processing
- [`type-string-generator.ts`](#type-strings) - TypeScript type string formatting

### CLI Interface (`/src/cli/`)

**Purpose**: Command-line interface and configuration

- [`commands.ts`](#cli-commands) - CLI command implementations
- [`config.ts`](#configuration) - Configuration loading and validation

## Core Types

### FluentBuilder Interface

The foundation of all generated builders:

```typescript
interface FluentBuilder<T, Ctx extends BuildContext = BuildContext> {
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  (context?: Ctx): T;
}
```

**Type Parameters:**

- `T` - The type being built
- `Ctx` - Build context type for parent-child relationships

**Usage:**

```typescript
// Generated builder extends this interface
interface UserBuilder extends FluentBuilder<User> {
  withName(name: string): UserBuilder;
  withEmail(email: string): UserBuilder;
  // ... other with methods
}
```

### TypeInfo Discriminated Union

Represents all possible TypeScript types:

```typescript
type TypeInfo =
  | PrimitiveTypeInfo
  | ObjectTypeInfo
  | ArrayTypeInfo
  | UnionTypeInfo
  | IntersectionTypeInfo
  | GenericTypeInfo
  | ConditionalTypeInfo
  | MappedTypeInfo
  | TemplateLiteralTypeInfo;
```

**Common Properties:**

```typescript
interface BaseTypeInfo {
  kind: TypeKind;
  optional?: boolean;
  readonly?: boolean;
  jsDoc?: string;
}
```

### PropertyInfo

Represents object properties:

```typescript
interface PropertyInfo {
  name: string;
  type: TypeInfo;
  optional: boolean;
  readonly: boolean;
  jsDoc?: string;
  defaultValue?: any;
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
```

### Result Utilities

```typescript
// Create success result
function ok<T>(value: T): Ok<T>;

// Create error result
function err(error: Error | string): Err;

// Chain operations
function chain<T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U>;

// Map over success values
function map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U>;
```

**Usage Example:**

```typescript
const result = await generator.generateBuilder("./types.ts", "User");

if (result.ok) {
  console.log("Generated:", result.value);
} else {
  console.error("Error:", result.error.message);
}
```

## Caching System

### TypeResolutionCache

Optimizes performance by caching resolved types:

```typescript
interface TypeResolutionCache {
  get(key: string): TypeInfo | undefined;
  set(key: string, typeInfo: TypeInfo): void;
  has(key: string): boolean;
  clear(): void;
  size(): number;
}
```

### Cache Keys

Cache keys are generated from:

- File path
- Type name
- Generic parameters
- Import context

**Example Cache Key:**

```
/src/types.ts:User<T=string,U=number>:imports=[./base.ts]
```

### Cache Statistics

```typescript
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  memoryUsage: number;
}
```

## Plugin System

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  version?: string;
  hooks: PluginHooks;
}

interface PluginHooks {
  beforeParsing?: BeforeParsingHook;
  afterParsing?: AfterParsingHook;
  beforeResolving?: BeforeResolvingHook;
  afterResolving?: AfterResolvingHook;
  beforeGeneration?: BeforeGenerationHook;
  afterGeneration?: AfterGenerationHook;
  beforePropertyGeneration?: BeforePropertyGenerationHook;
  afterPropertyGeneration?: AfterPropertyGenerationHook;
  beforeMethodGeneration?: BeforeMethodGenerationHook;
  afterMethodGeneration?: AfterMethodGenerationHook;
  importTransform?: ImportTransformHook;
  valueTransform?: ValueTransformHook;
}
```

### Hook Types

**Parsing Hooks:**

```typescript
type BeforeParsingHook = (
  context: ParseContext,
) => ParseContext | Promise<ParseContext>;

type AfterParsingHook = (
  context: ParseContext,
  result: ParseResult,
) => ParseResult | Promise<ParseResult>;
```

**Generation Hooks:**

```typescript
type BeforeGenerationHook = (
  context: GenerationContext,
) => GenerationContext | Promise<GenerationContext>;

type AfterGenerationHook = (
  context: GenerationContext,
  code: string,
) => string | Promise<string>;
```

**Property Hooks:**

```typescript
type BeforePropertyGenerationHook = (
  context: PropertyContext,
  property: PropertyInfo,
) => PropertyInfo | Promise<PropertyInfo>;

type AfterPropertyGenerationHook = (
  context: PropertyContext,
  property: PropertyInfo,
  method: MethodDeclaration,
) => MethodDeclaration | Promise<MethodDeclaration>;
```

### Plugin Registration

```typescript
// Programmatic registration
const generator = new FluentGen();
generator.registerPlugin({
  name: 'custom-plugin',
  hooks: {
    beforeGeneration: (context) => {
      console.log('Generating for:', context.typeName);
      return context;
    }
  }
});

// Configuration file registration
{
  "plugins": [
    "./plugins/custom-plugin.js",
    "@company/fluent-gen-plugin"
  ]
}
```

## Import Resolution

### ImportResolver

Handles TypeScript module resolution:

```typescript
interface ImportResolver {
  resolveImport(
    importPath: string,
    fromFile: string,
  ): Promise<Result<ResolvedImport>>;

  resolveTypeImport(
    typeName: string,
    fromFile: string,
  ): Promise<Result<TypeImport>>;
}

interface ResolvedImport {
  resolvedPath: string;
  isNodeModule: boolean;
  isTypeOnly: boolean;
  exports: string[];
}
```

### Import Types

- **Relative imports**: `./types`, `../models/user`
- **Absolute imports**: `@/types`, `~/models`
- **Node modules**: `lodash`, `@types/node`
- **Virtual files**: In-memory TypeScript files

## Error Handling

### Error Types

```typescript
enum ErrorCode {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  TYPE_NOT_FOUND = "TYPE_NOT_FOUND",
  PARSE_ERROR = "PARSE_ERROR",
  RESOLVE_ERROR = "RESOLVE_ERROR",
  GENERATION_ERROR = "GENERATION_ERROR",
  CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",
  UNSUPPORTED_TYPE = "UNSUPPORTED_TYPE",
}

class FluentGenError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public context?: any,
  ) {
    super(message);
  }
}
```

### Error Context

Errors include contextual information:

```typescript
interface ErrorContext {
  filePath?: string;
  typeName?: string;
  propertyName?: string;
  line?: number;
  column?: number;
  stack?: string[];
}
```

## Configuration Types

### GeneratorConfig

```typescript
interface GeneratorConfig {
  outputDir?: string;
  useDefaults?: boolean;
  contextType?: string;
  importPath?: string;
  indentSize?: number;
  useTab?: boolean;
  addComments?: boolean;
  fileExtension?: string;
  fileNameTemplate?: string;
  skipTypeCheck?: boolean;
}
```

### Target Configuration

```typescript
interface Target {
  file: string;
  types: string[];
  outputDir?: string;
  generator?: Partial<GeneratorConfig>;
}
```

### Complete Configuration

```typescript
interface Config {
  tsConfigPath?: string;
  generator?: GeneratorConfig;
  targets?: Target[];
  patterns?: string[];
  exclude?: string[];
  plugins?: string[];
  watch?: WatchConfig;
}
```

## Context Types

### BuildContext

Base context passed to builders:

```typescript
interface BuildContext {
  parentId?: string;
  depth?: number;
  metadata?: Record<string, any>;
}
```

### Generation Context

Context during code generation:

```typescript
interface GenerationContext {
  typeName: string;
  typeInfo: TypeInfo;
  config: GeneratorConfig;
  imports: ImportInfo[];
  plugins: Plugin[];
}
```

### Property Context

Context during property generation:

```typescript
interface PropertyContext {
  typeName: string;
  propertyName: string;
  parentContext: GenerationContext;
  depth: number;
}
```

## Type Guards

Fluent Gen provides type guards for runtime type checking:

```typescript
// Core type guards
function isFluentBuilder<T>(obj: any): obj is FluentBuilder<T>;
function isPrimitiveType(type: TypeInfo): type is PrimitiveTypeInfo;
function isObjectType(type: TypeInfo): type is ObjectTypeInfo;
function isArrayType(type: TypeInfo): type is ArrayTypeInfo;
function isUnionType(type: TypeInfo): type is UnionTypeInfo;

// Result type guards
function isOk<T>(result: Result<T>): result is Ok<T>;
function isErr<T>(result: Result<T>): result is Err;
```

## Constants

### Symbols

```typescript
const FLUENT_BUILDER_SYMBOL = Symbol.for("fluent-builder");
const BUILDER_CONTEXT_SYMBOL = Symbol.for("builder-context");
```

### Default Values

```typescript
const DEFAULT_CONFIG: GeneratorConfig = {
  outputDir: "./src/builders",
  useDefaults: true,
  addComments: true,
  indentSize: 2,
  useTab: false,
  fileExtension: ".builder.ts",
};
```

## Utilities

### Type Utilities

```typescript
// Get default value for a type
function getDefaultValue(typeInfo: TypeInfo): any;

// Generate TypeScript type string
function generateTypeString(typeInfo: TypeInfo): string;

// Check if type is optional
function isOptionalType(typeInfo: TypeInfo): boolean;

// Flatten union types
function flattenUnionType(typeInfo: UnionTypeInfo): TypeInfo[];
```

### String Utilities

```typescript
// Convert to camelCase
function toCamelCase(str: string): string;

// Convert to PascalCase
function toPascalCase(str: string): string;

// Generate with method name
function toWithMethodName(propertyName: string): string;
```

## Performance Considerations

### Memory Management

- Type resolution cache with LRU eviction
- Weak references for circular type handling
- Lazy evaluation of expensive operations

### Optimization Strategies

- Parallel type resolution when possible
- Incremental parsing for watch mode
- AST node reuse across generations
- Import deduplication

### Benchmarks

Typical performance characteristics:

- Simple interface (5 properties): ~10ms
- Complex nested structure (20+ properties): ~50ms
- Large union type (100+ variants): ~100ms
- Full project scan (500+ types): ~2-5s

## Next Steps

- [Generator Functions Documentation](./generator.md)
- [Type Resolution System](./resolver.md)
- [Plugin Development Guide](./plugins.md)
- [CLI Reference](../guide/cli.md)

