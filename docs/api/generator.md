# Generator Functions

The generator module transforms resolved TypeScript type information into fluent
builder code. This document covers the complete generation API, configuration
options, and customization capabilities.

## Architecture Overview

The generation system uses a multi-layered architecture:

```
┌────────────────────────────────────────────────────────┐
│                     FluentGen                          │
│                  (Main Interface)                      │
├────────────────────────────────────────────────────────┤
│                 BuilderGenerator                       │
│               (Core Generation)                        │
├────────────────────────────────────────────────────────┤
│  MethodGen │ ImportGen │ TypeStringGen │ TemplateGen   │
├────────────────────────────────────────────────────────┤
│              DefaultValueGenerator                     │
└────────────────────────────────────────────────────────┘
```

## FluentGen Class

The main entry point for all generation operations:

### Constructor

```typescript
constructor(options?: FluentGenOptions)
```

**Options:**

```typescript
interface FluentGenOptions extends GeneratorConfig, TypeExtractorOptions {
  outputDir?: string; // Default output directory
  fileName?: string; // Default filename template
}

interface GeneratorConfig extends GeneratorOptions {
  addComments?: boolean; // Add JSDoc comments (default: true)
  generateCommonFile?: boolean; // Generate common utilities file
}

interface GeneratorOptions {
  outputPath?: string; // Output directory path
  useDefaults?: boolean; // Generate default values (default: true)
  contextType?: string; // Build context type name (default: 'BaseBuildContext')
  importPath?: string; // Import path for utilities (default: './common')
}
```

### Core Generation Methods

#### generateBuilder()

Generates a fluent builder for a single type:

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
import { FluentGen } from 'fluent-gen-ts';

const generator = new FluentGen({
  useDefaults: true,
  addComments: true,
});

const result = await generator.generateBuilder('./types.ts', 'User');

if (result.ok) {
  console.log(result.value); // Generated TypeScript builder code
} else {
  console.error('Generation failed:', result.error.message);
}
```

**Generated Output Example:**

```typescript
import type { BaseBuildContext } from './common';

export interface UserBuilder {
  withName(name: string): UserBuilder;
  withEmail(email: string): UserBuilder;
  withAge(age?: number): UserBuilder;
  (context?: BaseBuildContext): User;
}

export function createUserBuilder(): UserBuilder {
  const builder = {} as UserBuilder & { [key: string]: any };

  builder.withName = (name: string) => {
    builder._name = name;
    return builder;
  };

  // ... other methods

  const buildFunction = (context?: BaseBuildContext): User => {
    return {
      name: builder._name,
      email: builder._email,
      age: builder._age ?? 0,
    };
  };

  return Object.assign(buildFunction, builder) as UserBuilder;
}
```

#### generateMultiple()

Generates builders for multiple types in a single operation:

```typescript
async generateMultiple(
  filePath: string,
  typeNames: string[]
): Promise<Result<Map<string, string>>>
```

**Parameters:**

- `filePath` - Path to TypeScript file
- `typeNames` - Array of type names to generate builders for

**Returns:** `Result<Map<string, string>>` where keys are filenames and values
are generated code

**Example:**

```typescript
const result = await generator.generateMultiple('./types.ts', [
  'User',
  'Post',
  'Comment',
]);

if (result.ok) {
  for (const [filename, code] of result.value) {
    console.log(`Generated ${filename}:`);
    console.log(code);
  }
}
```

**Generated Files:**

- `common.ts` - Shared utilities and types
- `User.builder.ts` - User builder implementation
- `Post.builder.ts` - Post builder implementation
- `Comment.builder.ts` - Comment builder implementation

#### generateToFile()

Generates a builder and writes it to a file:

```typescript
async generateToFile(
  filePath: string,
  typeName: string,
  outputPath?: string
): Promise<Result<string>>
```

**Parameters:**

- `filePath` - Source TypeScript file path
- `typeName` - Type name to generate
- `outputPath` - Optional custom output path

**Returns:** `Result<string>` containing the path where the file was written

**Example:**

```typescript
const result = await generator.generateToFile(
  './src/types.ts',
  'User',
  './src/builders/user.builder.ts',
);

if (result.ok) {
  console.log('Builder written to:', result.value);
}
```

#### scanAndGenerate()

Scans files matching a pattern and generates builders for all found types:

```typescript
async scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>
```

**Parameters:**

- `pattern` - Glob pattern to match TypeScript files

**Returns:** `Result<Map<string, string>>` with generated builders

**Example:**

```typescript
const result = await generator.scanAndGenerate('./src/models/*.ts');

if (result.ok) {
  for (const [key, code] of result.value) {
    console.log(`Found and generated: ${key}`);
  }
}
```

### Plugin Management

#### registerPlugin()

Registers a plugin with the generator:

```typescript
registerPlugin(plugin: Plugin): Result<void>
```

**Example:**

```typescript
import type { Plugin } from 'fluent-gen-ts';

const validationPlugin: Plugin = {
  name: 'validation-plugin',
  version: '1.0.0',
  transformProperty: property => {
    // Add validation logic
    return ok(property);
  },
};

const result = generator.registerPlugin(validationPlugin);
if (!result.ok) {
  console.error('Plugin registration failed:', result.error.message);
}
```

### Cache Management

#### clearCache()

Clears internal generation caches:

```typescript
clearCache(): void
```

Use this when you want to force regeneration or free memory:

```typescript
generator.clearCache();
```

## BuilderGenerator Class

Low-level builder generation engine:

### Constructor

```typescript
constructor(config?: GeneratorConfig, pluginManager?: PluginManager)
```

### Core Methods

#### generate()

Generates builder code from resolved type information:

```typescript
async generate(resolvedType: ResolvedType): Promise<Result<string>>
```

**Example:**

```typescript
import { BuilderGenerator, TypeExtractor } from 'fluent-gen-ts';

const extractor = new TypeExtractor();
const generator = new BuilderGenerator({
  useDefaults: true,
  addComments: true,
});

const typeResult = await extractor.extractType('./types.ts', 'User');
if (typeResult.ok) {
  const codeResult = await generator.generate(typeResult.value);
  if (codeResult.ok) {
    console.log(codeResult.value);
  }
}
```

#### generateCommonFile()

Generates the common utilities file for multi-builder generation:

```typescript
generateCommonFile(): string
```

**Generated Common File:**

```typescript
export const FLUENT_BUILDER_SYMBOL = Symbol.for('fluent-builder');

export interface BaseBuildContext {
  readonly parentId?: string;
  readonly parameterName?: string;
  readonly index?: number;
  readonly [key: string]: unknown;
}

export interface FluentBuilder<
  T,
  Ctx extends BaseBuildContext = BaseBuildContext,
> {
  readonly [FLUENT_BUILDER_SYMBOL]: true;
  (context?: Ctx): T;
}

export function isFluentBuilder<T = unknown>(
  value: unknown,
): value is FluentBuilder<T> {
  return (
    typeof value === 'function' &&
    FLUENT_BUILDER_SYMBOL in value &&
    value[FLUENT_BUILDER_SYMBOL] === true
  );
}

// Additional utility functions...
```

#### setGeneratingMultiple()

Controls multi-builder generation mode:

```typescript
setGeneratingMultiple(value: boolean): void
```

This affects import generation and common file creation.

## Generation Configuration

### Detailed Configuration Options

```typescript
interface GeneratorConfig {
  // Output configuration
  outputPath?: string; // './generated'

  // Code generation options
  useDefaults?: boolean; // true - Generate default values
  addComments?: boolean; // true - Add JSDoc comments
  generateCommonFile?: boolean; // Auto-determined by multi-generation

  // Type configuration
  contextType?: string; // 'BaseBuildContext' - Build context type
  importPath?: string; // './common' - Import path for utilities
}
```

### Usage Examples

#### Minimal Configuration

```typescript
const generator = new FluentGen();
// Uses all defaults
```

#### Custom Configuration

```typescript
const generator = new FluentGen({
  outputDir: './src/builders',
  useDefaults: false,
  addComments: false,
  contextType: 'CustomBuildContext',
});
```

#### With Custom Plugin Manager

```typescript
import { PluginManager } from 'fluent-gen-ts';

const pluginManager = new PluginManager();
// Register plugins...

const generator = new FluentGen({
  pluginManager,
  useDefaults: true,
});
```

## Generated Code Structure

### Single Builder File

```typescript
// user.builder.ts
import type { BaseBuildContext } from './common';

export interface UserBuilder {
  withName(name: string): UserBuilder;
  withEmail(email: string): UserBuilder;
  withAge(age?: number): UserBuilder;
  (context?: BaseBuildContext): User;
}

export function createUserBuilder(): UserBuilder {
  // Implementation...
}
```

### Multi-Builder Structure

```
src/builders/
├── common.ts              # Shared utilities
├── User.builder.ts        # User builder
├── Post.builder.ts        # Post builder
└── Comment.builder.ts     # Comment builder
```

## Error Handling

All generation methods return `Result<T>` types for safe error handling:

### Common Error Scenarios

```typescript
const result = await generator.generateBuilder('./types.ts', 'NonExistentType');

if (!result.ok) {
  switch (result.error.message) {
    case 'Type not found':
      console.error('The specified type does not exist');
      break;
    case 'File not found':
      console.error('The source file could not be read');
      break;
    case 'Parse error':
      console.error('TypeScript parsing failed');
      break;
    default:
      console.error('Unknown error:', result.error.message);
  }
}
```

## Advanced Usage

### Custom File Naming

```typescript
const generator = new FluentGen({
  fileName: '${typeName}.fluent.ts', // Custom template
});
```

### Integration with Build Tools

```typescript
// build-script.ts
import { FluentGen } from 'fluent-gen-ts';

const generator = new FluentGen({
  outputDir: './dist/builders',
});

// Generate builders for all types in src/models
const result = await generator.scanAndGenerate('./src/models/*.ts');

if (result.ok) {
  console.log(`Generated ${result.value.size} builders`);
} else {
  process.exit(1);
}
```

### Watch Mode Integration

```typescript
import { watch } from 'fs';

watch('./src/types.ts', async eventType => {
  if (eventType === 'change') {
    generator.clearCache();
    await generator.generateBuilder('./src/types.ts', 'User');
  }
});
```

## Performance Considerations

### Caching

- Type resolution results are cached automatically
- Generated imports are deduplicated
- Call `clearCache()` periodically in long-running processes

### Memory Usage

- Large type hierarchies use more memory
- Clear caches between unrelated generation runs
- Consider generating in batches for very large codebases

### Build Time Optimization

```typescript
// For faster incremental builds
const generator = new FluentGen({
  maxDepth: 5, // Limit type resolution depth
});
```

## Next Steps

- [Type Resolution System](./resolver.md) - Understanding type extraction
- [Plugin Development Guide](./plugins.md) - Creating custom plugins
- [CLI Usage](../guide/cli.md) - Command-line interface
