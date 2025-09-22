# Programmatic API

The fluent-gen programmatic API allows you to integrate builder generation into
your build process, development tools, or custom workflows. This guide covers
the complete API surface and usage patterns.

## Installation

```bash
npm install fluent-gen
# or
pnpm add fluent-gen
# or
yarn add fluent-gen
```

## Quick Start

```typescript
import { FluentGen } from 'fluent-gen';

// Create a generator instance
const generator = new FluentGen({
  useDefaults: true,
  addComments: true,
});

// Generate a builder for a type
const result = await generator.generateBuilder('./src/types.ts', 'User');

if (result.ok) {
  console.log('Generated builder:', result.value);
} else {
  console.error('Error:', result.error);
}
```

## Core Classes

### FluentGen

The main class for builder generation. Provides methods to generate builders
programmatically.

```typescript
import { FluentGen, type FluentGenOptions } from 'fluent-gen';

class FluentGen {
  constructor(options?: FluentGenOptions);

  // Core methods
  generateBuilder(filePath: string, typeName: string): Promise<Result<string>>;
  generateMultiple(
    filePath: string,
    typeNames: string[],
  ): Promise<Result<Map<string, string>>>;
  generateToFile(
    filePath: string,
    typeName: string,
    outputPath?: string,
  ): Promise<Result<string>>;
  scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>;

  // Plugin management
  registerPlugin(plugin: Plugin): Result<void>;

  // Cache management
  clearCache(): void;
}
```

#### Constructor Options

```typescript
interface FluentGenOptions {
  // Output configuration
  outputDir?: string; // Default output directory for generated files
  fileName?: string; // Custom filename pattern

  // Generation settings
  useDefaults?: boolean; // Generate default values for optional properties
  addComments?: boolean; // Include JSDoc comments in generated code
  contextType?: string; // Custom context type name for builders
  importPath?: string; // Import path for context type
  outputPath?: string; // Output path for generated files

  // Type extraction settings
  tsConfigPath?: string; // Path to tsconfig.json
  maxDepth?: number; // Maximum depth for type resolution (1-100)
  cache?: boolean; // Enable caching for type resolution

  // Advanced
  pluginManager?: PluginManager; // Custom plugin manager instance
}
```

### TypeExtractor

Extracts type information from TypeScript files.

```typescript
import { TypeExtractor, type TypeExtractorOptions } from 'fluent-gen';

class TypeExtractor {
  constructor(options?: TypeExtractorOptions);

  extractType(filePath: string, typeName: string): Promise<Result<TypeInfo>>;
  scanFile(filePath: string): Promise<Result<string[]>>;
}
```

#### TypeExtractor Options

```typescript
interface TypeExtractorOptions {
  tsConfigPath?: string; // Path to tsconfig.json
  cache?: boolean; // Enable caching
  pluginManager?: PluginManager; // Plugin manager instance
  maxDepth?: number; // Max recursion depth (1-100)
}
```

### BuilderGenerator

Generates builder code from type information.

```typescript
import { BuilderGenerator, type GeneratorConfig } from 'fluent-gen';

class BuilderGenerator {
  constructor(config?: GeneratorConfig, pluginManager?: PluginManager);

  generate(typeInfo: TypeInfo): Promise<Result<string>>;
  generateCommonFile(): string;
  setGeneratingMultiple(value: boolean): void;
  clearCache(): void;
}
```

#### Generator Configuration

```typescript
interface GeneratorConfig {
  outputPath?: string; // Output file path
  useDefaults?: boolean; // Use default values
  contextType?: string; // Context type name
  importPath?: string; // Import path for context
  addComments?: boolean; // Include JSDoc comments
}
```

## Core Methods

### generateBuilder

Generate a single builder for a specific type.

```typescript
async generateBuilder(
  filePath: string,
  typeName: string
): Promise<Result<string>>
```

**Parameters:**

- `filePath` - Path to the TypeScript file containing the type
- `typeName` - Name of the interface or type to generate a builder for

**Returns:** `Result<string>` containing the generated builder code or an error

**Example:**

```typescript
const generator = new FluentGen({
  useDefaults: true,
  addComments: true,
});

const result = await generator.generateBuilder('./src/types/user.ts', 'User');

if (result.ok) {
  console.log('Generated code:', result.value);
  // Save to file or use the generated code
} else {
  console.error('Generation failed:', result.error.message);
}
```

### generateMultiple

Generate builders for multiple types from the same file.

```typescript
async generateMultiple(
  filePath: string,
  typeNames: string[]
): Promise<Result<Map<string, string>>>
```

**Parameters:**

- `filePath` - Path to the TypeScript file
- `typeNames` - Array of type names to generate builders for

**Returns:** `Result<Map<string, string>>` where keys are filenames and values
are generated code

**Example:**

```typescript
const result = await generator.generateMultiple('./src/types/models.ts', [
  'User',
  'Product',
  'Order',
]);

if (result.ok) {
  // result.value is a Map with:
  // - 'common.ts' -> Common utilities
  // - 'User.builder.ts' -> User builder
  // - 'Product.builder.ts' -> Product builder
  // - 'Order.builder.ts' -> Order builder

  for (const [filename, code] of result.value) {
    console.log(`Generated ${filename}`);
    // Save each file
  }
}
```

### generateToFile

Generate a builder and save it to a file.

```typescript
async generateToFile(
  filePath: string,
  typeName: string,
  outputPath?: string
): Promise<Result<string>>
```

**Parameters:**

- `filePath` - Path to the TypeScript file
- `typeName` - Name of the type
- `outputPath` - Optional output file path (uses default if not provided)

**Returns:** `Result<string>` containing the output file path or an error

**Example:**

```typescript
const result = await generator.generateToFile(
  './src/types/user.ts',
  'User',
  './src/builders/user.builder.ts',
);

if (result.ok) {
  console.log('Builder saved to:', result.value);
} else {
  console.error('Failed to generate:', result.error.message);
}
```

### scanAndGenerate

Scan files matching a pattern and generate builders for all discovered types.

```typescript
async scanAndGenerate(
  pattern: string
): Promise<Result<Map<string, string>>>
```

**Parameters:**

- `pattern` - Glob pattern to match TypeScript files

**Returns:** `Result<Map<string, string>>` where keys are `"file:type"` and
values are generated code

**Example:**

```typescript
const result = await generator.scanAndGenerate('src/**/*.ts');

if (result.ok) {
  for (const [key, code] of result.value) {
    const [file, type] = key.split(':');
    console.log(`Generated builder for ${type} from ${file}`);
    // Save the generated code
  }
}
```

### registerPlugin

Register a plugin to extend generation behavior.

```typescript
registerPlugin(plugin: Plugin): Result<void>
```

**Parameters:**

- `plugin` - Plugin object with hooks

**Returns:** `Result<void>` indicating success or failure

**Example:**

```typescript
const myPlugin: Plugin = {
  name: 'my-custom-plugin',
  hooks: {
    beforeTypeResolution: async context => {
      console.log('Resolving type:', context.typeName);
      return { continue: true };
    },
  },
};

const result = generator.registerPlugin(myPlugin);
if (!result.ok) {
  console.error('Plugin registration failed:', result.error);
}
```

### clearCache

Clear the internal cache for type resolution and generation.

```typescript
clearCache(): void
```

**Example:**

```typescript
// Clear cache between generations if needed
generator.clearCache();
```

## Result Type

All API methods return `Result` types for consistent error handling without
exceptions.

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
```

### Helper Functions

```typescript
import { ok, err, isOk, isErr } from 'fluent-gen';

// Create results
const successResult = ok('success');
const errorResult = err(new Error('failed'));

// Check results
if (isOk(result)) {
  console.log('Success:', result.value);
}

if (isErr(result)) {
  console.error('Error:', result.error);
}
```

## Type Information

### TypeInfo Interface

The structure returned by type extraction:

```typescript
interface TypeInfo {
  name: string;
  kind: TypeKind;
  properties?: PropertyInfo[];
  typeParameters?: GenericParam[];
  indexSignatures?: IndexSignature[];
  jsDoc?: string;
  isExported: boolean;
  sourceFile: string;
}

interface PropertyInfo {
  name: string;
  type: ResolvedType;
  isOptional: boolean;
  jsDoc?: string;
  defaultValue?: string;
}

type TypeKind =
  | 'interface'
  | 'type-alias'
  | 'class'
  | 'enum'
  | 'union'
  | 'intersection'
  | 'primitive'
  | 'object'
  | 'array'
  | 'tuple';
```

## Plugin System

Create plugins to customize generation behavior.

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  hooks?: {
    beforeTypeResolution?: Hook<ParseContext>;
    afterTypeResolution?: Hook<ResolveContext>;
    beforePropertyGeneration?: Hook<GenerateContext>;
    afterPropertyGeneration?: Hook<GenerateContext>;
    beforeCodeGeneration?: Hook<GenerateContext>;
    afterCodeGeneration?: Hook<GenerateContext>;
  };
}

type Hook<T> = (context: T) => Promise<HookResult>;

interface HookResult {
  continue: boolean;
  data?: any;
  error?: Error;
}
```

### Creating a Plugin

```typescript
import { Plugin } from 'fluent-gen';

const customDefaultsPlugin: Plugin = {
  name: 'custom-defaults',
  hooks: {
    afterPropertyGeneration: async context => {
      // Modify properties to add custom defaults
      const properties = context.properties.map(prop => {
        if (prop.isOptional && prop.type === 'string') {
          prop.defaultValue = '"custom-default"';
        }
        return prop;
      });

      return {
        continue: true,
        data: properties,
      };
    },
  },
};

// Register the plugin
generator.registerPlugin(customDefaultsPlugin);
```

## Advanced Usage

### Custom Output Paths

```typescript
const generator = new FluentGen({
  outputDir: './src/generated/builders',
  fileName: '{type}.builder.generated.ts',
});

// Files will be saved to outputDir with custom naming
await generator.generateToFile('./src/types.ts', 'User');
// Output: ./src/generated/builders/user.builder.generated.ts
```

### Context Passing

Enable context passing between parent and child builders:

```typescript
const generator = new FluentGen({
  contextType: 'BuildContext',
  importPath: './build-context',
});

// Generated builders will support context
const code = await generator.generateBuilder('./types.ts', 'Order');
```

### Batch Processing

Process multiple files efficiently:

```typescript
import { FluentGen } from 'fluent-gen';
import { glob } from 'glob';

async function generateAllBuilders() {
  const generator = new FluentGen({
    useDefaults: true,
    addComments: true,
  });

  const files = await glob('src/**/*.interface.ts');

  for (const file of files) {
    const extractor = new TypeExtractor();
    const typesResult = await extractor.scanFile(file);

    if (typesResult.ok) {
      for (const typeName of typesResult.value) {
        const result = await generator.generateToFile(
          file,
          typeName,
          `./builders/${typeName}.builder.ts`,
        );

        if (result.ok) {
          console.log(`✓ Generated ${typeName}`);
        } else {
          console.error(`✗ Failed ${typeName}:`, result.error.message);
        }
      }
    }
  }
}
```

### Integration with Build Tools

#### Webpack Plugin

```typescript
class FluentGenWebpackPlugin {
  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync(
      'FluentGenPlugin',
      async (params, callback) => {
        const generator = new FluentGen({
          useDefaults: true,
        });

        const result = await generator.scanAndGenerate('src/**/*.ts');

        if (result.ok) {
          // Save generated files
          for (const [key, code] of result.value) {
            // Write files...
          }
        }

        callback();
      },
    );
  }
}
```

#### Vite Plugin

```typescript
import { Plugin } from 'vite';
import { FluentGen } from 'fluent-gen';

export function fluentGenPlugin(): Plugin {
  return {
    name: 'vite-plugin-fluent-gen',
    async buildStart() {
      const generator = new FluentGen({
        useDefaults: true,
      });

      await generator.scanAndGenerate('src/**/*.ts');
    },
  };
}
```

## Error Handling

### Best Practices

```typescript
import { FluentGen, isErr } from 'fluent-gen';

async function safeGenerate(file: string, type: string) {
  const generator = new FluentGen();

  try {
    const result = await generator.generateBuilder(file, type);

    if (isErr(result)) {
      // Handle specific error types
      if (result.error.message.includes('Type not found')) {
        console.error(`Type '${type}' not found in ${file}`);
      } else if (result.error.message.includes('File not found')) {
        console.error(`File '${file}' does not exist`);
      } else {
        console.error('Unexpected error:', result.error);
      }
      return null;
    }

    return result.value;
  } catch (error) {
    // This shouldn't happen with Result types
    console.error('Unexpected exception:', error);
    return null;
  }
}
```

### Common Errors

| Error                | Cause                                | Solution                                       |
| -------------------- | ------------------------------------ | ---------------------------------------------- |
| `Type not found`     | Type doesn't exist or isn't exported | Ensure type is exported and name is correct    |
| `File not found`     | Invalid file path                    | Check file path is correct and relative to cwd |
| `Invalid TypeScript` | Syntax errors in source file         | Fix TypeScript compilation errors              |
| `Circular reference` | Complex circular dependencies        | Simplify type structure or use type aliases    |
| `Max depth exceeded` | Very deep nested types               | Increase `maxDepth` option                     |

## Performance Optimization

### Caching

Enable caching for better performance with multiple generations:

```typescript
const generator = new FluentGen({
  cache: true, // Enable caching
});

// First generation - builds cache
await generator.generateBuilder('./types.ts', 'User');

// Subsequent generations - uses cache
await generator.generateBuilder('./types.ts', 'Product');

// Clear cache when needed
generator.clearCache();
```

### Parallel Processing

Process multiple types in parallel:

```typescript
async function generateInParallel(types: Array<[string, string]>) {
  const generator = new FluentGen({ cache: true });

  const promises = types.map(([file, type]) =>
    generator.generateBuilder(file, type),
  );

  const results = await Promise.all(promises);

  results.forEach((result, index) => {
    if (result.ok) {
      console.log(`✓ Generated ${types[index][1]}`);
    } else {
      console.error(`✗ Failed ${types[index][1]}`);
    }
  });
}
```

## Testing Generated Builders

```typescript
import { FluentGen } from 'fluent-gen';
import { beforeAll, describe, it, expect } from 'vitest';

describe('Builder Generation', () => {
  let generator: FluentGen;

  beforeAll(() => {
    generator = new FluentGen({
      useDefaults: true,
      addComments: false,
    });
  });

  it('should generate valid builder code', async () => {
    const result = await generator.generateBuilder(
      './test-types.ts',
      'TestInterface',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('export function testInterfaceBuilder');
      expect(result.value).toContain('withId');
      expect(result.value).toContain('build()');
    }
  });
});
```

## Migration Guide

### From v0.x to v1.x

The API has been redesigned for v1.0:

```typescript
// Old API (v0.x)
import { generateBuilderCode } from 'fluent-gen';

const result = await generateBuilderCode({
  filePath: './types.ts',
  typeName: 'User',
  outputPath: './user.builder.ts',
});

// New API (v1.x)
import { FluentGen } from 'fluent-gen';

const generator = new FluentGen();
const result = await generator.generateToFile(
  './types.ts',
  'User',
  './user.builder.ts',
);
```

## API Reference Summary

### Exports

```typescript
// Main API
export { FluentGen } from 'fluent-gen';
export type { FluentGenOptions } from 'fluent-gen';

// Type extraction
export { TypeExtractor } from 'fluent-gen';
export type { TypeExtractorOptions } from 'fluent-gen';

// Code generation
export { BuilderGenerator } from 'fluent-gen';
export type { GeneratorConfig } from 'fluent-gen';

// Core types
export type {
  TypeInfo,
  PropertyInfo,
  TypeKind,
  ResolvedType,
  GenericParam,
  IndexSignature,
  GeneratorOptions,
} from 'fluent-gen';

// Result handling
export { ok, err, isOk, isErr } from 'fluent-gen';
export type { Result } from 'fluent-gen';

// Plugin system
export { PluginManager, HookType } from 'fluent-gen';
export type {
  Plugin,
  ParseContext,
  ResolveContext,
  GenerateContext,
} from 'fluent-gen';

// Runtime utilities (for generated code)
export {
  FLUENT_BUILDER_SYMBOL,
  isFluentBuilder,
  isBuilderArray,
  createNestedContext,
  resolveValue,
} from 'fluent-gen';
export type { FluentBuilder, BaseBuildContext } from 'fluent-gen';
```

## Next Steps

- Explore the [CLI documentation](./cli.md) for command-line usage
- Learn about [configuration](./configuration.md) options
- Check out [examples](../examples/basic.md) for common patterns
- Read about [plugin development](../api/plugins.md) for extending fluent-gen
