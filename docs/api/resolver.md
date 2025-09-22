# Type Resolution System

The type resolution system analyzes TypeScript code and extracts comprehensive
type information for fluent builder generation. It handles complex scenarios
including generics, utility types, circular references, and conditional types.

## Architecture Overview

The type resolution system consists of multiple specialized components:

```
┌─────────────────────────────────────────────────────┐
│                 TypeExtractor                       │
│              (Main Interface)                       │
├─────────────────────────────────────────────────────┤
│    TypeScriptParser    │      TypeResolver          │
│   (AST Parsing)        │   (Type Resolution)        │
├─────────────────────────────────────────────────────┤
│  UtilityExpander │ ConditionalResolver │ MappedResolver │
├─────────────────────────────────────────────────────┤
│        TemplateLiteralResolver │ ImportResolver      │
└─────────────────────────────────────────────────────┘
```

## TypeExtractor Class

The main interface for TypeScript type analysis and extraction:

### Constructor

```typescript
constructor(options?: TypeExtractorOptions)
```

**Options:**

```typescript
interface TypeExtractorOptions {
  tsConfigPath?: string; // Path to tsconfig.json
  cache?: TypeResolutionCache; // Custom cache instance
  pluginManager?: PluginManager; // Plugin manager for hooks
  maxDepth?: number; // Maximum resolution depth (1-100)
}
```

### Core Extraction Methods

#### extractType()

Extracts complete type information for a single type:

```typescript
async extractType(
  filePath: string,
  typeName: string
): Promise<Result<ResolvedType>>
```

**Parameters:**

- `filePath` - Path to TypeScript file containing the type (`.ts`, `.tsx`, or
  `.d.ts`)
- `typeName` - Name of the interface, type alias, or class to extract

**Returns:** `Result<ResolvedType>` containing complete type information

**Example:**

```typescript
import { TypeExtractor } from 'fluent-gen-ts';

const extractor = new TypeExtractor({
  tsConfigPath: './tsconfig.json',
  maxDepth: 10,
});

const result = await extractor.extractType('./src/types.ts', 'User');

if (result.ok) {
  const resolvedType = result.value;
  console.log('Type name:', resolvedType.name);
  console.log('Source file:', resolvedType.sourceFile);
  console.log('Type info:', resolvedType.typeInfo);
  console.log('Dependencies:', resolvedType.dependencies);
} else {
  console.error('Extraction failed:', result.error.message);
}
```

#### extractMultiple()

Extracts multiple types from the same file in a single operation:

```typescript
async extractMultiple(
  filePath: string,
  typeNames: string[]
): Promise<Result<ResolvedType[]>>
```

**Parameters:**

- `filePath` - Source TypeScript file path
- `typeNames` - Array of type names to extract

**Returns:** `Result<ResolvedType[]>` with extracted types in the same order

**Example:**

```typescript
const result = await extractor.extractMultiple('./types.ts', [
  'User',
  'Post',
  'Comment',
]);

if (result.ok) {
  for (const resolvedType of result.value) {
    console.log(`Extracted: ${resolvedType.name}`);
  }
}
```

#### scanFile()

Scans a TypeScript file and returns all available type names:

```typescript
async scanFile(filePath: string): Promise<Result<string[]>>
```

**Parameters:**

- `filePath` - TypeScript file to scan

**Returns:** `Result<string[]>` with names of all interfaces and type aliases

**Example:**

```typescript
const result = await extractor.scanFile('./src/models.ts');

if (result.ok) {
  console.log('Available types:', result.value);
  // Output: ['User', 'Post', 'Comment', 'Category']
}
```

### Cache Management

#### clearCache()

Clears the type resolution cache and resets internal state:

```typescript
clearCache(): void
```

**Usage:**

```typescript
// Clear cache before processing unrelated files
extractor.clearCache();

// Or periodically in long-running processes
setInterval(() => {
  extractor.clearCache();
}, 60000); // Every minute
```

## ResolvedType Interface

Complete type information returned by extraction:

```typescript
interface ResolvedType {
  readonly sourceFile: string; // Absolute path to source file
  readonly name: string; // Type name
  readonly typeInfo: TypeInfo; // Detailed type structure
  readonly imports: readonly string[]; // Required import paths
  readonly dependencies: readonly ResolvedType[]; // Dependent types
}
```

### Example ResolvedType

```typescript
// For: interface User { name: string; posts: Post[]; }
{
  sourceFile: "/path/to/types.ts",
  name: "User",
  typeInfo: {
    kind: TypeKind.Object,
    properties: [
      {
        name: "name",
        type: { kind: TypeKind.Primitive, name: "string" },
        optional: false,
        readonly: false
      },
      {
        name: "posts",
        type: {
          kind: TypeKind.Array,
          elementType: { kind: TypeKind.Reference, name: "Post" }
        },
        optional: false,
        readonly: false
      }
    ]
  },
  imports: ["./post"],
  dependencies: [/* Post ResolvedType */]
}
```

## TypeInfo System

The core discriminated union representing all TypeScript types:

### Object Types

```typescript
interface ObjectTypeInfo {
  kind: TypeKind.Object;
  name?: string; // Interface/class name
  properties: readonly PropertyInfo[];
  genericParams?: readonly GenericParam[];
  indexSignature?: IndexSignature;
  unresolvedGenerics?: readonly GenericParam[];
  typeArguments?: readonly TypeInfo[];
}

interface PropertyInfo {
  readonly name: string;
  readonly type: TypeInfo;
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly jsDoc?: string; // JSDoc comments
}
```

### Primitive Types

```typescript
interface PrimitiveTypeInfo {
  kind: TypeKind.Primitive;
  name: string; // 'string', 'number', 'boolean', etc.
  literal?: unknown; // For literal types: 'hello', 42, true
}
```

### Array Types

```typescript
interface ArrayTypeInfo {
  kind: TypeKind.Array;
  elementType: TypeInfo; // Type of array elements
}
```

### Union Types

```typescript
interface UnionTypeInfo {
  kind: TypeKind.Union;
  unionTypes: readonly TypeInfo[]; // All union members
}
```

### Generic Types

```typescript
interface GenericTypeInfo {
  kind: TypeKind.Generic;
  name: string; // Generic parameter name
  typeArguments?: readonly TypeInfo[];
  constraint?: TypeInfo; // 'extends' constraint
  default?: TypeInfo; // Default type
  unresolvedGenerics?: readonly GenericParam[];
}

interface GenericParam {
  readonly name: string;
  readonly constraint?: TypeInfo;
  readonly default?: TypeInfo;
}
```

### Reference Types

```typescript
interface ReferenceTypeInfo {
  kind: TypeKind.Reference;
  name: string; // Referenced type name
  typeArguments?: readonly TypeInfo[]; // Generic arguments
}
```

### Conditional Types

```typescript
interface ConditionalTypeInfo {
  kind: TypeKind.Conditional;
  checkType: TypeInfo; // T in 'T extends U ? X : Y'
  extendsType: TypeInfo; // U in 'T extends U ? X : Y'
  trueType: TypeInfo; // X in 'T extends U ? X : Y'
  falseType: TypeInfo; // Y in 'T extends U ? X : Y'
  inferredTypes?: Record<string, TypeInfo>; // Inferred type variables
}
```

### Other Types

```typescript
// Tuple types: [string, number]
interface TupleTypeInfo {
  kind: TypeKind.Tuple;
  elements: readonly TypeInfo[];
}

// Enum types
interface EnumTypeInfo {
  kind: TypeKind.Enum;
  name: string;
  values?: readonly unknown[];
}

// Utility types
interface KeyofTypeInfo {
  kind: TypeKind.Keyof;
  target: TypeInfo; // keyof T
}

interface TypeofTypeInfo {
  kind: TypeKind.Typeof;
  target: TypeInfo; // typeof x
}

// Index access: T[K]
interface IndexTypeInfo {
  kind: TypeKind.Index;
  object: TypeInfo; // T
  index: TypeInfo; // K
}
```

## Type Resolution Features

### Generics Resolution

Handles complex generic scenarios:

```typescript
// Source TypeScript
interface Container<T, U = string> {
  value: T;
  metadata: U;
  items: T[];
}

// Resolved TypeInfo
{
  kind: TypeKind.Object,
  name: "Container",
  genericParams: [
    { name: "T" },
    { name: "U", default: { kind: TypeKind.Primitive, name: "string" } }
  ],
  properties: [
    {
      name: "value",
      type: { kind: TypeKind.Generic, name: "T" }
    },
    {
      name: "metadata",
      type: { kind: TypeKind.Generic, name: "U" }
    },
    {
      name: "items",
      type: {
        kind: TypeKind.Array,
        elementType: { kind: TypeKind.Generic, name: "T" }
      }
    }
  ]
}
```

### Utility Types

Supports TypeScript utility types:

```typescript
// Pick<User, 'name' | 'email'>
{
  kind: TypeKind.Object,
  properties: [
    { name: "name", type: { kind: TypeKind.Primitive, name: "string" } },
    { name: "email", type: { kind: TypeKind.Primitive, name: "string" } }
  ]
}

// Partial<User>
{
  kind: TypeKind.Object,
  properties: [
    { name: "name", type: { kind: TypeKind.Primitive, name: "string" }, optional: true },
    { name: "email", type: { kind: TypeKind.Primitive, name: "string" }, optional: true }
  ]
}
```

### Conditional Types

Resolves complex conditional logic:

```typescript
// type ApiResponse<T> = T extends string ? { message: T } : { data: T }

// For T = string
{
  kind: TypeKind.Object,
  properties: [
    { name: "message", type: { kind: TypeKind.Generic, name: "T" } }
  ]
}

// For T = User
{
  kind: TypeKind.Object,
  properties: [
    { name: "data", type: { kind: TypeKind.Reference, name: "User" } }
  ]
}
```

### Mapped Types

Handles mapped type transformations:

```typescript
// type UserFlags = { [K in keyof User]: boolean }
{
  kind: TypeKind.Object,
  properties: [
    { name: "name", type: { kind: TypeKind.Primitive, name: "boolean" } },
    { name: "email", type: { kind: TypeKind.Primitive, name: "boolean" } },
    { name: "age", type: { kind: TypeKind.Primitive, name: "boolean" } }
  ]
}
```

## Advanced Configuration

### TypeScript Configuration

```typescript
const extractor = new TypeExtractor({
  tsConfigPath: './tsconfig.json',
  maxDepth: 15, // Deeper resolution for complex types
});
```

### Custom Cache

```typescript
import { TypeResolutionCache } from 'fluent-gen-ts';

const customCache = new TypeResolutionCache();
const extractor = new TypeExtractor({
  cache: customCache,
});

// Cache statistics
console.log('Cache size:', customCache.size());
console.log('Cache stats:', customCache.getStats());
```

### Plugin Integration

```typescript
import { PluginManager } from 'fluent-gen-ts';

const pluginManager = new PluginManager();

// Register type transformation plugin
pluginManager.register({
  name: 'type-transformer',
  version: '1.0.0',
  beforeResolve: context => {
    console.log('Resolving type:', context.typeName);
    return ok(context);
  },
  afterResolve: (context, typeInfo) => {
    // Transform resolved type
    return ok(typeInfo);
  },
});

const extractor = new TypeExtractor({
  pluginManager,
});
```

## Error Handling

### Common Error Scenarios

```typescript
const result = await extractor.extractType('./types.ts', 'MissingType');

if (!result.ok) {
  console.error('Error:', result.error.message);

  // Common error types:
  // - "File not found" - Source file doesn't exist
  // - "Type not found" - Type doesn't exist in file
  // - "Parse error" - TypeScript parsing failed
  // - "Circular reference" - Circular type dependency
  // - "Max depth exceeded" - Type resolution too deep
}
```

### Validation

Input validation is performed automatically:

```typescript
// Invalid file path
await extractor.extractType('', 'User'); // Error: filePath must be non-empty

// Invalid type name
await extractor.extractType('./types.ts', ''); // Error: typeName must be non-empty

// Invalid file extension
await extractor.extractType('./types.js', 'User'); // Error: must be .ts, .tsx, or .d.ts
```

## Performance Optimization

### Caching Strategy

```typescript
// For batch processing
const extractor = new TypeExtractor();

for (const file of files) {
  const types = await extractor.scanFile(file);
  if (types.ok) {
    await extractor.extractMultiple(file, types.value);
  }
}

// Clear cache periodically
extractor.clearCache();
```

### Memory Management

```typescript
// Limit resolution depth for large codebases
const extractor = new TypeExtractor({
  maxDepth: 5, // Faster but less detailed resolution
});

// Use custom cache with size limits
const cache = new TypeResolutionCache({
  maxSize: 1000, // Limit cached types
});
```

### Parallel Processing

```typescript
// Process multiple files in parallel
const extractors = files.map(file =>
  new TypeExtractor().extractType(file, 'MainType'),
);

const results = await Promise.all(extractors);
```

## Integration Examples

### With Build Tools

```typescript
// build-types.ts
import { TypeExtractor } from 'fluent-gen-ts';
import { glob } from 'glob';

const extractor = new TypeExtractor();

const files = await glob('./src/**/*.ts');
const allTypes = new Map<string, string[]>();

for (const file of files) {
  const types = await extractor.scanFile(file);
  if (types.ok && types.value.length > 0) {
    allTypes.set(file, types.value);
  }
}

console.log('Discovered types:', allTypes);
```

### With Watch Mode

```typescript
import { watch } from 'fs';

const extractor = new TypeExtractor();

watch('./src/types.ts', async (eventType, filename) => {
  if (eventType === 'change') {
    extractor.clearCache();

    const types = await extractor.scanFile('./src/types.ts');
    if (types.ok) {
      console.log('Types updated:', types.value);
    }
  }
});
```

### Type Analysis

```typescript
// Analyze type complexity
async function analyzeType(filePath: string, typeName: string) {
  const result = await extractor.extractType(filePath, typeName);

  if (result.ok) {
    const { typeInfo, dependencies } = result.value;

    console.log('Type complexity:');
    console.log('- Properties:', countProperties(typeInfo));
    console.log('- Dependencies:', dependencies.length);
    console.log('- Max depth:', calculateDepth(typeInfo));
  }
}

function countProperties(typeInfo: TypeInfo): number {
  if (typeInfo.kind === TypeKind.Object) {
    return typeInfo.properties.length;
  }
  return 0;
}
```

## Type Guards and Utilities

Use type guards to safely work with TypeInfo:

```typescript
import {
  isObjectTypeInfo,
  isArrayTypeInfo,
  isUnionTypeInfo,
  isPrimitiveTypeInfo,
} from 'fluent-gen-ts';

function processTypeInfo(typeInfo: TypeInfo) {
  if (isObjectTypeInfo(typeInfo)) {
    console.log('Object with', typeInfo.properties.length, 'properties');
  } else if (isArrayTypeInfo(typeInfo)) {
    console.log('Array of', typeInfo.elementType.kind);
  } else if (isUnionTypeInfo(typeInfo)) {
    console.log('Union with', typeInfo.unionTypes.length, 'types');
  } else if (isPrimitiveTypeInfo(typeInfo)) {
    console.log('Primitive type:', typeInfo.name);
  }
}
```

## Next Steps

- [Generator Functions Documentation](./generator.md) - Code generation from
  resolved types
- [Plugin Development Guide](./plugins.md) - Extending type resolution
- [CLI Usage](../guide/cli.md) - Command-line type extraction
