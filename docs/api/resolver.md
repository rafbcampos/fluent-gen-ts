# Type Resolution System

The type resolution system is the core component that analyzes TypeScript code and extracts type information. It handles complex scenarios including generics, utility types, circular references, and conditional types.

## Architecture Overview

The type resolution system consists of multiple specialized components:

```
┌─────────────────────────────────────────────────────┐
│                Type Extractor                       │
├─────────────────────────────────────────────────────┤
│    Parser    │   Resolver   │   Import Resolver    │
├──────────────┼──────────────┼──────────────────────┤
│  Utility     │  Conditional │   Mapped Type        │
│  Expander    │  Resolver    │   Resolver           │
├──────────────┼──────────────┼──────────────────────┤
│           Template Literal Resolver               │
└─────────────────────────────────────────────────────┘
```

## Main Type Extraction API

### extractTypeInfo

The primary function for extracting type information:

```typescript
async function extractTypeInfo(
  filePath: string,
  typeName: string,
  options?: TypeExtractionOptions
): Promise<Result<TypeInfo>>
```

**Parameters:**
- `filePath` - Path to TypeScript file containing the type
- `typeName` - Name of the interface or type to extract
- `options` - Optional extraction configuration

**Returns:** `Result<TypeInfo>` containing the resolved type information

**Example:**
```typescript
import { extractTypeInfo } from 'fluent-gen';

const result = await extractTypeInfo('./types.ts', 'User');

if (result.ok) {
  console.log('Type info:', result.value);
  console.log('Properties:', result.value.properties);
} else {
  console.error('Failed to extract type:', result.error.message);
}
```

### TypeExtractionOptions

```typescript
interface TypeExtractionOptions {
  // TypeScript configuration
  tsConfigPath?: string;           // Path to tsconfig.json
  compilerOptions?: CompilerOptions; // Override compiler options

  // Resolution options
  followImports?: boolean;         // Follow imported types (default: true)
  maxDepth?: number;              // Maximum resolution depth (default: 10)
  resolveGenerics?: boolean;      // Resolve generic parameters (default: true)

  // Caching options
  cacheEnabled?: boolean;         // Enable type resolution caching (default: true)
  cacheTTL?: number;             // Cache time-to-live in ms (default: 300000)

  // Plugin options
  plugins?: Plugin[];            // Type resolution plugins
  customResolvers?: TypeResolver[]; // Custom type resolvers
}
```

**Example with Options:**
```typescript
const result = await extractTypeInfo('./types.ts', 'User', {
  followImports: true,
  maxDepth: 15,
  resolveGenerics: true,
  cacheEnabled: true,
  tsConfigPath: './tsconfig.json'
});
```

## Type Resolution Components

### TypeExtractor

The main orchestrator for type extraction:

```typescript
class TypeExtractor {
  constructor(options?: TypeExtractionOptions);

  async extractType(filePath: string, typeName: string): Promise<Result<TypeInfo>>;
  async extractMultiple(filePath: string, typeNames: string[]): Promise<Result<Map<string, TypeInfo>>>;
  async scanFile(filePath: string): Promise<Result<TypeDeclaration[]>>;

  // Configuration
  setOptions(options: Partial<TypeExtractionOptions>): void;
  getOptions(): TypeExtractionOptions;

  // Cache management
  clearCache(): void;
  getCacheStats(): CacheStats;
}
```

### Parser

Handles TypeScript AST parsing and initial analysis:

```typescript
class Parser {
  parseFile(filePath: string): Result<SourceFile>;
  findTypeDeclaration(sourceFile: SourceFile, typeName: string): Result<TypeNode>;
  extractJSDoc(node: Node): string | undefined;
  getTypeParameters(node: TypeNode): GenericParameter[];
}
```

### Resolver

Core type resolution logic:

```typescript
class Resolver {
  resolveType(typeNode: TypeNode, context: ResolutionContext): Result<TypeInfo>;
  resolveTypeReference(node: TypeReferenceNode, context: ResolutionContext): Result<TypeInfo>;
  resolveUnionType(node: UnionTypeNode, context: ResolutionContext): Result<UnionTypeInfo>;
  resolveIntersectionType(node: IntersectionTypeNode, context: ResolutionContext): Result<IntersectionTypeInfo>;
}
```

### ImportResolver

Manages TypeScript import resolution:

```typescript
class ImportResolver {
  resolveImport(importPath: string, fromFile: string): Promise<Result<ResolvedImport>>;
  resolveTypeImport(typeName: string, fromFile: string): Promise<Result<TypeImport>>;
  getExports(filePath: string): Promise<Result<ExportInfo[]>>;
}
```

## TypeInfo Types

### Base TypeInfo

All type information extends this base interface:

```typescript
interface BaseTypeInfo {
  kind: TypeKind;
  optional?: boolean;
  readonly?: boolean;
  jsDoc?: string;
  sourceLocation?: SourceLocation;
}

enum TypeKind {
  Primitive = 'primitive',
  Object = 'object',
  Array = 'array',
  Union = 'union',
  Intersection = 'intersection',
  Generic = 'generic',
  Conditional = 'conditional',
  Mapped = 'mapped',
  TemplateLiteral = 'template-literal',
  Tuple = 'tuple',
  Function = 'function',
  Unknown = 'unknown'
}
```

### PrimitiveTypeInfo

Represents primitive TypeScript types:

```typescript
interface PrimitiveTypeInfo extends BaseTypeInfo {
  kind: 'primitive';
  name: 'string' | 'number' | 'boolean' | 'bigint' | 'symbol' | 'undefined' | 'null' | 'void' | 'any' | 'unknown' | 'never';
  literalValue?: string | number | boolean; // For literal types
}
```

**Examples:**
- `string` → `{ kind: 'primitive', name: 'string' }`
- `42` → `{ kind: 'primitive', name: 'number', literalValue: 42 }`
- `'hello'` → `{ kind: 'primitive', name: 'string', literalValue: 'hello' }`

### ObjectTypeInfo

Represents object types and interfaces:

```typescript
interface ObjectTypeInfo extends BaseTypeInfo {
  kind: 'object';
  properties: PropertyInfo[];
  indexSignatures?: IndexSignatureInfo[];
  callSignatures?: CallSignatureInfo[];
  constructSignatures?: ConstructSignatureInfo[];
}

interface PropertyInfo {
  name: string;
  type: TypeInfo;
  optional: boolean;
  readonly: boolean;
  jsDoc?: string;
  defaultValue?: any;
}
```

**Example:**
```typescript
interface User {
  id: string;
  name: string;
  age?: number;
}

// Resolves to:
{
  kind: 'object',
  properties: [
    { name: 'id', type: { kind: 'primitive', name: 'string' }, optional: false },
    { name: 'name', type: { kind: 'primitive', name: 'string' }, optional: false },
    { name: 'age', type: { kind: 'primitive', name: 'number' }, optional: true }
  ]
}
```

### ArrayTypeInfo

Represents array and tuple types:

```typescript
interface ArrayTypeInfo extends BaseTypeInfo {
  kind: 'array';
  elementType: TypeInfo;
  isReadonly?: boolean;
}

interface TupleTypeInfo extends BaseTypeInfo {
  kind: 'tuple';
  elements: TypeInfo[];
  restElement?: TypeInfo;
}
```

**Examples:**
- `string[]` → `{ kind: 'array', elementType: { kind: 'primitive', name: 'string' } }`
- `[string, number]` → `{ kind: 'tuple', elements: [string_type, number_type] }`

### UnionTypeInfo

Represents union types:

```typescript
interface UnionTypeInfo extends BaseTypeInfo {
  kind: 'union';
  types: TypeInfo[];
  discriminant?: string; // For discriminated unions
}
```

**Examples:**
- `string | number` → `{ kind: 'union', types: [string_type, number_type] }`
- `'success' | 'error'` → Union of string literals

### GenericTypeInfo

Represents generic types with parameters:

```typescript
interface GenericTypeInfo extends BaseTypeInfo {
  kind: 'generic';
  name: string;
  typeParameters: GenericParameter[];
  baseType: TypeInfo;
  constraints?: TypeInfo[];
}

interface GenericParameter {
  name: string;
  constraint?: TypeInfo;
  default?: TypeInfo;
}
```

**Example:**
```typescript
interface ApiResponse<T = any, E = Error> {
  data: T;
  error?: E;
}

// Resolves to GenericTypeInfo with:
// typeParameters: [
//   { name: 'T', default: any_type },
//   { name: 'E', default: Error_type }
// ]
```

## Advanced Type Resolution

### Utility Type Expansion

The `UtilityTypeExpander` handles TypeScript utility types:

```typescript
class UtilityTypeExpander {
  expandPick<T, K extends keyof T>(baseType: TypeInfo, keys: string[]): Result<TypeInfo>;
  expandOmit<T, K extends keyof T>(baseType: TypeInfo, keys: string[]): Result<TypeInfo>;
  expandPartial<T>(baseType: TypeInfo): Result<TypeInfo>;
  expandRequired<T>(baseType: TypeInfo): Result<TypeInfo>;
  expandRecord<K extends string, T>(keyType: TypeInfo, valueType: TypeInfo): Result<TypeInfo>;
}
```

**Supported Utility Types:**
- `Pick<T, K>` - Select subset of properties
- `Omit<T, K>` - Exclude properties
- `Partial<T>` - Make all properties optional
- `Required<T>` - Make all properties required
- `Record<K, V>` - Create object type with specific key-value types
- `Exclude<T, U>` - Exclude from union
- `Extract<T, U>` - Extract from union
- `NonNullable<T>` - Remove null and undefined
- `ReturnType<T>` - Extract function return type
- `Parameters<T>` - Extract function parameter types

**Example:**
```typescript
// Type: Pick<User, 'id' | 'name'>
const result = await extractTypeInfo('./types.ts', 'UserSummary');

// Automatically expands to:
{
  kind: 'object',
  properties: [
    { name: 'id', type: string_type },
    { name: 'name', type: string_type }
  ]
}
```

### Conditional Type Resolution

The `ConditionalTypeResolver` handles conditional types:

```typescript
class ConditionalTypeResolver {
  resolveConditional(
    checkType: TypeInfo,
    extendsType: TypeInfo,
    trueType: TypeInfo,
    falseType: TypeInfo,
    context: ResolutionContext
  ): Result<TypeInfo>;

  evaluateExtends(type: TypeInfo, constraint: TypeInfo): boolean;
}
```

**Example:**
```typescript
type ApiResponseData<T> = T extends string
  ? { message: T }
  : T extends number
  ? { value: T }
  : { data: T };

// For T = string, resolves to: { message: string }
// For T = number, resolves to: { value: number }
// For T = User, resolves to: { data: User }
```

### Mapped Type Resolution

The `MappedTypeResolver` handles mapped types:

```typescript
class MappedTypeResolver {
  resolveMapped(
    typeParameter: string,
    nameType: TypeInfo,
    keyType: TypeInfo,
    templateType: TypeInfo,
    context: ResolutionContext
  ): Result<TypeInfo>;
}
```

**Example:**
```typescript
type Optional<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? T[P] | undefined : T[P];
};

// Automatically resolves the mapped type transformation
```

### Template Literal Types

The `TemplateLiteralResolver` handles template literal types:

```typescript
class TemplateLiteralResolver {
  resolveTemplate(
    head: string,
    templateSpans: TemplateSpan[],
    context: ResolutionContext
  ): Result<TemplateLiteralTypeInfo>;
}

interface TemplateLiteralTypeInfo extends BaseTypeInfo {
  kind: 'template-literal';
  parts: (string | TypeInfo)[];
}
```

**Example:**
```typescript
type EventName<T extends string> = `on${Capitalize<T>}`;

// For T = 'click', resolves to literal type 'onClick'
```

## Circular Reference Handling

### Detection and Resolution

Fluent Gen automatically detects and handles circular references:

```typescript
interface Node {
  id: string;
  children: Node[];
  parent?: Node;
}

// Circular reference between Node.children and Node.parent
// Automatically handled without infinite recursion
```

### Circular Reference Strategies

1. **Lazy Resolution**: Defer resolution of circular properties
2. **Reference Tracking**: Track resolution stack to detect cycles
3. **Placeholder Types**: Use placeholder types during resolution
4. **Post-Processing**: Resolve circular references after initial pass

```typescript
interface CircularReferenceHandler {
  detectCycle(type: TypeInfo, stack: string[]): boolean;
  createPlaceholder(typeName: string): PlaceholderTypeInfo;
  resolvePlaceholders(typeInfo: TypeInfo): TypeInfo;
}
```

## Caching System

### Resolution Cache

The type resolution cache improves performance for repeated operations:

```typescript
interface TypeResolutionCache {
  // Cache resolved types
  getType(key: string): TypeInfo | undefined;
  setType(key: string, typeInfo: TypeInfo): void;

  // Cache symbols
  getSymbol(key: string): Symbol | undefined;
  setSymbol(key: string, symbol: Symbol): void;

  // Cache imports
  getImport(key: string): ResolvedImport | undefined;
  setImport(key: string, import: ResolvedImport): void;

  // Management
  clear(): void;
  size(): number;
  stats(): CacheStats;
}
```

### Cache Key Generation

Cache keys are generated from:
- File path (normalized)
- Type name
- Generic parameters
- Import context
- Compiler options hash

**Example Cache Key:**
```
/src/types.ts:ApiResponse<User,Error>:imports=[./user.ts]:opts=abc123
```

### Cache Statistics

```typescript
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
}
```

## Error Handling

### Resolution Errors

```typescript
enum ResolutionErrorCode {
  TYPE_NOT_FOUND = 'TYPE_NOT_FOUND',
  IMPORT_RESOLUTION_FAILED = 'IMPORT_RESOLUTION_FAILED',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  GENERIC_RESOLUTION_FAILED = 'GENERIC_RESOLUTION_FAILED',
  UTILITY_TYPE_EXPANSION_FAILED = 'UTILITY_TYPE_EXPANSION_FAILED',
  CONDITIONAL_TYPE_RESOLUTION_FAILED = 'CONDITIONAL_TYPE_RESOLUTION_FAILED',
  MAPPED_TYPE_RESOLUTION_FAILED = 'MAPPED_TYPE_RESOLUTION_FAILED',
  TEMPLATE_LITERAL_RESOLUTION_FAILED = 'TEMPLATE_LITERAL_RESOLUTION_FAILED'
}

class ResolutionError extends FluentGenError {
  constructor(
    code: ResolutionErrorCode,
    message: string,
    context?: ResolutionErrorContext
  ) {
    super(code, message, context);
  }
}
```

### Error Context

```typescript
interface ResolutionErrorContext {
  filePath?: string;
  typeName?: string;
  propertyName?: string;
  resolutionStack?: string[];
  sourceLocation?: SourceLocation;
  originalError?: Error;
}
```

### Error Recovery

```typescript
// Graceful error handling
const result = await extractTypeInfo('./types.ts', 'ComplexType');

if (!result.ok) {
  const error = result.error as ResolutionError;

  switch (error.code) {
    case ResolutionErrorCode.TYPE_NOT_FOUND:
      console.log('Type not found:', error.context?.typeName);
      break;
    case ResolutionErrorCode.CIRCULAR_REFERENCE:
      console.log('Circular reference detected:', error.context?.resolutionStack);
      break;
    default:
      console.log('Resolution failed:', error.message);
  }
}
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Resolution**: Only resolve types when needed
2. **Incremental Parsing**: Reuse parsed ASTs when possible
3. **Parallel Resolution**: Resolve independent types in parallel
4. **Memory Management**: Clean up temporary data structures

### Performance Monitoring

```typescript
interface PerformanceMetrics {
  totalResolutionTime: number;
  averageResolutionTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  resolvedTypeCount: number;
}

const extractor = new TypeExtractor();
const metrics = extractor.getPerformanceMetrics();
```

### Benchmarking

```typescript
// Benchmark type resolution
console.time('type-resolution');
const result = await extractTypeInfo('./large-types.ts', 'ComplexType');
console.timeEnd('type-resolution');

console.log('Cache stats:', extractor.getCacheStats());
```

## Custom Resolvers

### Creating Custom Resolvers

```typescript
interface CustomTypeResolver {
  name: string;
  canResolve(typeNode: TypeNode): boolean;
  resolve(typeNode: TypeNode, context: ResolutionContext): Result<TypeInfo>;
}

// Example: Custom date resolver
const dateResolver: CustomTypeResolver = {
  name: 'date-resolver',
  canResolve: (node) => {
    return node.kind === SyntaxKind.TypeReference &&
           node.typeName.getText() === 'Date';
  },
  resolve: (node, context) => {
    return ok({
      kind: 'primitive',
      name: 'string',
      jsDoc: 'ISO date string (resolved by custom resolver)'
    } as PrimitiveTypeInfo);
  }
};

// Register custom resolver
const extractor = new TypeExtractor({
  customResolvers: [dateResolver]
});
```

### Plugin Integration

```typescript
// Type resolution plugin
const customResolutionPlugin: Plugin = {
  name: 'custom-resolution',
  hooks: {
    beforeResolving: (context) => {
      console.log('Resolving type:', context.typeName);
      return context;
    },
    afterResolving: (context, typeInfo) => {
      // Transform resolved type
      if (typeInfo.kind === 'object') {
        return {
          ...typeInfo,
          properties: typeInfo.properties.map(prop => ({
            ...prop,
            jsDoc: prop.jsDoc || `Auto-generated docs for ${prop.name}`
          }))
        };
      }
      return typeInfo;
    }
  }
};
```

## Testing Type Resolution

### Unit Testing

```typescript
import { extractTypeInfo } from 'fluent-gen';

describe('Type Resolution', () => {
  it('should resolve basic interface', async () => {
    const result = await extractTypeInfo('./test-types.ts', 'User');

    expect(result.ok).toBe(true);
    expect(result.value.kind).toBe('object');
    expect(result.value.properties).toHaveLength(3);
  });

  it('should handle generic types', async () => {
    const result = await extractTypeInfo('./test-types.ts', 'ApiResponse');

    expect(result.ok).toBe(true);
    expect(result.value.kind).toBe('generic');
    expect(result.value.typeParameters).toHaveLength(1);
  });
});
```

### Integration Testing

```typescript
describe('Complex Type Resolution', () => {
  it('should resolve utility types', async () => {
    const result = await extractTypeInfo('./complex-types.ts', 'PickedUser');

    expect(result.ok).toBe(true);
    // Verify Pick<User, 'id' | 'name'> is properly resolved
    const properties = result.value.properties;
    expect(properties.map(p => p.name)).toEqual(['id', 'name']);
  });
});
```

## Best Practices

### 1. Configuration

```typescript
// Recommended configuration for large projects
const extractor = new TypeExtractor({
  followImports: true,
  maxDepth: 20,
  cacheEnabled: true,
  cacheTTL: 600000, // 10 minutes
  tsConfigPath: './tsconfig.json'
});
```

### 2. Error Handling

```typescript
// Always handle resolution errors
const result = await extractTypeInfo('./types.ts', 'User');

if (!result.ok) {
  logger.error('Type resolution failed', {
    error: result.error.message,
    code: result.error.code,
    context: result.error.context
  });

  // Fallback or recovery logic
  return getDefaultTypeInfo();
}
```

### 3. Performance

```typescript
// Batch resolution for better performance
const typeNames = ['User', 'Product', 'Order'];
const extractor = new TypeExtractor();

const results = await Promise.all(
  typeNames.map(name => extractor.extractType('./types.ts', name))
);

// Check cache stats
console.log('Cache hit rate:', extractor.getCacheStats().hitRate);
```

## Next Steps

- [Plugin Development Guide](./plugins.md)
- [Generator Functions](./generator.md)
- [API Overview](./overview.md)
- [Configuration Guide](../guide/configuration.md)