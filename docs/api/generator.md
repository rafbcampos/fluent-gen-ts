# Generator Functions

The generator module is responsible for transforming resolved TypeScript type information into fluent builder code. This document details all generator functions, their APIs, and customization options.

## Architecture Overview

The generation system follows a multi-layer architecture:

```
┌─────────────────────────────────────────────────────┐
│                FluentGen (Main)                     │
├─────────────────────────────────────────────────────┤
│            BuilderGenerator                         │
├─────────────────────────────────────────────────────┤
│  TemplateGen │ MethodGen │ ImportGen │ TypeStringGen │
├─────────────┼───────────┼───────────┼───────────────┤
│         DefaultValueGen │ StaticGen │              │
└─────────────────────────────────────────────────────┘
```

## Main Generator API

### FluentGen Class

The primary interface for code generation:

```typescript
class FluentGen {
  constructor(config?: GeneratorConfig);

  // Core generation methods
  generateBuilder(filePath: string, typeName: string): Promise<Result<string>>;
  generateMultiple(filePath: string, typeNames: string[]): Promise<Result<Map<string, string>>>;
  generateToFile(filePath: string, typeName: string, outputPath?: string): Promise<Result<string>>;
  scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>;

  // Configuration
  setConfig(config: Partial<GeneratorConfig>): void;
  getConfig(): GeneratorConfig;

  // Plugin management
  registerPlugin(plugin: Plugin): void;
  clearPlugins(): void;

  // Cache management
  clearCache(): void;
  getCacheStats(): CacheStats;
}
```

#### Constructor

```typescript
new FluentGen(config?: GeneratorConfig)
```

**Parameters:**
- `config` - Optional generator configuration

**Example:**
```typescript
const generator = new FluentGen({
  outputDir: './src/builders',
  useDefaults: true,
  addComments: true,
  indentSize: 2
});
```

#### generateBuilder

Generate a single builder for a specific type.

```typescript
async generateBuilder(
  filePath: string,
  typeName: string
): Promise<Result<string>>
```

**Parameters:**
- `filePath` - Path to TypeScript file containing the type
- `typeName` - Name of the interface or type to generate builder for

**Returns:** `Result<string>` containing the generated builder code

**Example:**
```typescript
const result = await generator.generateBuilder('./types.ts', 'User');

if (result.ok) {
  console.log('Generated builder code:', result.value);
} else {
  console.error('Generation failed:', result.error.message);
}
```

#### generateMultiple

Generate builders for multiple types from a single file.

```typescript
async generateMultiple(
  filePath: string,
  typeNames: string[]
): Promise<Result<Map<string, string>>>
```

**Parameters:**
- `filePath` - Path to TypeScript file
- `typeNames` - Array of type names to generate builders for

**Returns:** `Result<Map<string, string>>` where keys are type names and values are generated code

**Example:**
```typescript
const result = await generator.generateMultiple(
  './api-types.ts',
  ['CreateUserRequest', 'UpdateUserRequest', 'UserResponse']
);

if (result.ok) {
  for (const [typeName, code] of result.value) {
    await fs.writeFile(`./builders/${typeName}.builder.ts`, code);
  }
}
```

#### generateToFile

Generate a builder and write directly to a file.

```typescript
async generateToFile(
  filePath: string,
  typeName: string,
  outputPath?: string
): Promise<Result<string>>
```

**Parameters:**
- `filePath` - Source TypeScript file path
- `typeName` - Type name to generate builder for
- `outputPath` - Optional output file path (auto-generated if not provided)

**Returns:** `Result<string>` containing the output file path

**Example:**
```typescript
// Auto-generate output path based on type name
const result1 = await generator.generateToFile('./types.ts', 'User');

// Custom output path
const result2 = await generator.generateToFile(
  './types.ts',
  'Product',
  './custom/Product.builder.ts'
);
```

#### scanAndGenerate

Scan files matching a pattern and generate builders for discovered interfaces.

```typescript
async scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>
```

**Parameters:**
- `pattern` - Glob pattern to match TypeScript files

**Returns:** `Result<Map<string, string>>` with discovered types and generated code

**Example:**
```typescript
const result = await generator.scanAndGenerate('src/models/**/*.ts');

if (result.ok) {
  console.log(`Found ${result.value.size} types to generate`);

  for (const [typeName, code] of result.value) {
    const outputPath = `./builders/${typeName}.builder.ts`;
    await fs.writeFile(outputPath, code);
  }
}
```

## Standalone Generator Functions

For more granular control, use individual generator functions:

### generateBuilderCode

Generate builder code from resolved type information:

```typescript
function generateBuilderCode(
  typeInfo: TypeInfo,
  config?: GeneratorConfig
): Result<string>
```

**Parameters:**
- `typeInfo` - Resolved type information
- `config` - Optional generator configuration

**Returns:** `Result<string>` containing generated code

**Example:**
```typescript
import { extractTypeInfo, generateBuilderCode } from 'fluent-gen';

// First extract type information
const typeResult = await extractTypeInfo('./types.ts', 'User');

if (typeResult.ok) {
  // Then generate builder code
  const codeResult = generateBuilderCode(typeResult.value, {
    useDefaults: true,
    addComments: true
  });

  if (codeResult.ok) {
    console.log('Generated code:', codeResult.value);
  }
}
```

## Generator Configuration

### GeneratorConfig Interface

```typescript
interface GeneratorConfig {
  // Output settings
  outputDir?: string;              // Output directory for generated files
  fileExtension?: string;          // File extension for generated builders
  fileNameTemplate?: string;       // Template for file names

  // Code generation options
  useDefaults?: boolean;           // Generate default values for properties
  addComments?: boolean;           // Include JSDoc comments in generated code
  skipTypeCheck?: boolean;         // Skip TypeScript type checking

  // Formatting options
  indentSize?: number;             // Number of spaces for indentation
  useTab?: boolean;               // Use tabs instead of spaces

  // Context options
  contextType?: string;           // Custom context type name
  importPath?: string;            // Import path for context type

  // Advanced options
  customTemplates?: TemplateMap;  // Custom code templates
  typeTransforms?: TypeTransform[]; // Type transformation functions
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG: GeneratorConfig = {
  outputDir: './src/builders',
  fileExtension: '.builder.ts',
  fileNameTemplate: '{type}{ext}',
  useDefaults: true,
  addComments: true,
  skipTypeCheck: false,
  indentSize: 2,
  useTab: false,
  contextType: 'BuildContext',
  importPath: 'fluent-gen'
};
```

### Configuration Examples

#### Minimal Configuration
```typescript
const generator = new FluentGen({
  outputDir: './generated'
});
```

#### Custom Formatting
```typescript
const generator = new FluentGen({
  indentSize: 4,
  useTab: true,
  fileExtension: '.generated.ts'
});
```

#### Production Configuration
```typescript
const generator = new FluentGen({
  outputDir: './dist/builders',
  useDefaults: false,
  addComments: false,
  skipTypeCheck: true
});
```

#### Custom Context Type
```typescript
const generator = new FluentGen({
  contextType: 'MyBuildContext',
  importPath: '@/types/build-context'
});
```

## Code Generation Components

### BuilderGenerator

The main orchestrator for builder generation:

```typescript
class BuilderGenerator {
  constructor(config: GeneratorConfig);

  generate(typeInfo: TypeInfo): Result<string>;
  generateWithPlugins(typeInfo: TypeInfo, plugins: Plugin[]): Result<string>;
}
```

### TemplateGenerator

Handles code template processing:

```typescript
class TemplateGenerator {
  generateBuilder(context: GenerationContext): string;
  generateMethod(context: MethodContext): string;
  generateImport(context: ImportContext): string;
}
```

### MethodGenerator

Generates individual builder methods:

```typescript
class MethodGenerator {
  generateWithMethod(property: PropertyInfo, context: GenerationContext): MethodDeclaration;
  generateBuildMethod(context: GenerationContext): MethodDeclaration;
  generateCloneMethod(context: GenerationContext): MethodDeclaration;
}
```

### ImportGenerator

Manages import statement generation:

```typescript
class ImportGenerator {
  generateImports(context: GenerationContext): ImportStatement[];
  resolveImportPath(fromFile: string, toFile: string): string;
  optimizeImports(imports: ImportStatement[]): ImportStatement[];
}
```

### TypeStringGenerator

Converts TypeInfo to TypeScript type strings:

```typescript
class TypeStringGenerator {
  generateTypeString(typeInfo: TypeInfo): string;
  generateUnionType(types: TypeInfo[]): string;
  generateGenericParameters(generics: GenericParameter[]): string;
}
```

### DefaultValueGenerator

Generates default values for properties:

```typescript
class DefaultValueGenerator {
  generateDefault(typeInfo: TypeInfo): any;
  generateObjectDefault(properties: PropertyInfo[]): object;
  generateArrayDefault(elementType: TypeInfo): any[];
}
```

## Generated Code Structure

### Builder Class Template

```typescript
// Generated builder structure
export interface {TypeName}Builder extends FluentBuilder<{TypeName}, {ContextType}> {
  // With methods for each property
  with{PropertyName}(value: {PropertyType}): {TypeName}Builder;

  // Special methods
  build(context?: {ContextType}): {TypeName};
  clone(): {TypeName}Builder;
  merge(partial: Partial<{TypeName}>): {TypeName}Builder;
}

// Factory function
export function {typeName}Builder(): {TypeName}Builder {
  return new {TypeName}BuilderImpl();
}

// Implementation class
class {TypeName}BuilderImpl implements {TypeName}Builder {
  private data: Partial<{TypeName}> = {};

  // Method implementations...
}
```

### Method Generation Patterns

#### Simple Property Method
```typescript
with{PropertyName}(value: {PropertyType}): {TypeName}Builder {
  return new {TypeName}BuilderImpl({
    ...this.data,
    {propertyName}: value
  });
}
```

#### Optional Property Method
```typescript
with{PropertyName}(value?: {PropertyType}): {TypeName}Builder {
  const newData = { ...this.data };
  if (value !== undefined) {
    newData.{propertyName} = value;
  }
  return new {TypeName}BuilderImpl(newData);
}
```

#### Nested Builder Support
```typescript
with{PropertyName}(
  value: {PropertyType} | FluentBuilder<{PropertyType}>
): {TypeName}Builder {
  const resolvedValue = isFluentBuilder(value) ? value() : value;
  return new {TypeName}BuilderImpl({
    ...this.data,
    {propertyName}: resolvedValue
  });
}
```

#### Array Property Method
```typescript
with{PropertyName}(value: {ElementType}[]): {TypeName}Builder {
  return new {TypeName}BuilderImpl({
    ...this.data,
    {propertyName}: [...value]
  });
}

add{PropertyName}(value: {ElementType}): {TypeName}Builder {
  const current = this.data.{propertyName} || [];
  return new {TypeName}BuilderImpl({
    ...this.data,
    {propertyName}: [...current, value]
  });
}
```

## Customization Options

### Custom Templates

Override default code templates:

```typescript
interface TemplateMap {
  builderClass?: string;
  factoryFunction?: string;
  withMethod?: string;
  buildMethod?: string;
  imports?: string;
}

const customTemplates: TemplateMap = {
  withMethod: `
    with{{propertyName}}(value: {{propertyType}}): {{builderType}} {
      // Custom implementation
      return this.set('{{propertyName}}', value);
    }
  `
};

const generator = new FluentGen({
  customTemplates
});
```

### Type Transforms

Transform types during generation:

```typescript
interface TypeTransform {
  name: string;
  match: (typeInfo: TypeInfo) => boolean;
  transform: (typeInfo: TypeInfo) => TypeInfo;
}

const dateTransform: TypeTransform = {
  name: 'date-to-string',
  match: (type) => type.kind === 'primitive' && type.name === 'Date',
  transform: (type) => ({
    ...type,
    name: 'string',
    jsDoc: 'ISO date string'
  })
};

const generator = new FluentGen({
  typeTransforms: [dateTransform]
});
```

### Output Formatting

Control code formatting:

```typescript
interface FormattingOptions {
  indentSize: number;
  useTab: boolean;
  semicolons: boolean;
  trailingComma: boolean;
  singleQuote: boolean;
}

const generator = new FluentGen({
  indentSize: 4,
  useTab: false,
  // Additional formatting via prettier integration
  prettier: {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true
  }
});
```

## Performance Optimizations

### Caching Strategies

- **Template Caching**: Compiled templates cached by configuration
- **Type String Caching**: Generated type strings cached by TypeInfo hash
- **Import Resolution Caching**: Resolved imports cached by file path

### Parallel Generation

```typescript
// Generate multiple builders in parallel
const generator = new FluentGen();

const types = ['User', 'Product', 'Order'];
const results = await Promise.all(
  types.map(type => generator.generateBuilder('./types.ts', type))
);

// Check all results
const successful = results.filter(r => r.ok);
const failed = results.filter(r => !r.ok);
```

### Memory Management

- Incremental parsing for large files
- Lazy evaluation of expensive operations
- Automatic cleanup of temporary data structures

## Error Handling

### Generation Errors

```typescript
enum GenerationErrorCode {
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  TYPE_GENERATION_ERROR = 'TYPE_GENERATION_ERROR',
  METHOD_GENERATION_ERROR = 'METHOD_GENERATION_ERROR',
  IMPORT_GENERATION_ERROR = 'IMPORT_GENERATION_ERROR',
  OUTPUT_ERROR = 'OUTPUT_ERROR'
}

class GenerationError extends FluentGenError {
  constructor(
    code: GenerationErrorCode,
    message: string,
    context?: GenerationErrorContext
  ) {
    super(code, message, context);
  }
}
```

### Error Recovery

```typescript
// Graceful error handling
const result = await generator.generateBuilder('./types.ts', 'User');

if (!result.ok) {
  const error = result.error as GenerationError;

  switch (error.code) {
    case GenerationErrorCode.TEMPLATE_ERROR:
      console.log('Template compilation failed');
      break;
    case GenerationErrorCode.TYPE_GENERATION_ERROR:
      console.log('Type generation failed for:', error.context?.typeName);
      break;
    default:
      console.log('Unknown generation error:', error.message);
  }
}
```

## Testing Generator Functions

### Unit Testing

```typescript
import { generateBuilderCode } from 'fluent-gen';

describe('generateBuilderCode', () => {
  it('should generate basic builder', () => {
    const typeInfo: ObjectTypeInfo = {
      kind: 'object',
      properties: [
        {
          name: 'name',
          type: { kind: 'primitive', name: 'string' },
          optional: false,
          readonly: false
        }
      ]
    };

    const result = generateBuilderCode(typeInfo, {
      useDefaults: true
    });

    expect(result.ok).toBe(true);
    expect(result.value).toContain('withName');
  });
});
```

### Integration Testing

```typescript
describe('FluentGen integration', () => {
  it('should generate working builder', async () => {
    const generator = new FluentGen();
    const result = await generator.generateBuilder('./test-types.ts', 'TestUser');

    expect(result.ok).toBe(true);

    // Write and import generated code
    await fs.writeFile('./TestUser.builder.ts', result.value);

    const { testUserBuilder } = await import('./TestUser.builder');
    const user = testUserBuilder()
      .withName('Test User')
      .withEmail('test@example.com')();

    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');
  });
});
```

## Best Practices

### 1. Configuration Management

```typescript
// Environment-based configuration
const config: GeneratorConfig = {
  outputDir: process.env.BUILDER_OUTPUT_DIR || './src/builders',
  useDefaults: process.env.NODE_ENV !== 'production',
  addComments: process.env.NODE_ENV === 'development'
};
```

### 2. Error Handling

```typescript
// Always check results
const result = await generator.generateBuilder('./types.ts', 'User');

if (result.ok) {
  // Handle success
  await processGeneratedCode(result.value);
} else {
  // Handle error with context
  logger.error('Generation failed', {
    error: result.error.message,
    code: result.error.code,
    context: result.error.context
  });
}
```

### 3. Performance

```typescript
// Batch operations when possible
const types = ['User', 'Product', 'Order'];
const result = await generator.generateMultiple('./types.ts', types);

// Use caching for repeated operations
const generator = new FluentGen();
// Cache is automatically used for subsequent calls
```

## Next Steps

- [Type Resolution System](./resolver.md)
- [Plugin Development Guide](./plugins.md)
- [CLI Reference](../guide/cli.md)
- [Configuration Guide](../guide/configuration.md)