# Programmatic API

The Fluent Gen programmatic API allows you to integrate builder generation into your build process, development tools, or custom workflows. This guide covers the complete API surface.

## Installation

```bash
npm install fluent-gen
```

## Quick Start

```typescript
import { FluentGen } from 'fluent-gen';

const generator = new FluentGen({
  useDefaults: true,
  addComments: true
});

// Generate a single builder
const result = await generator.generateBuilder(
  './src/types.ts',
  'User'
);

if (result.ok) {
  console.log('Generated builder code:', result.value);
} else {
  console.error('Generation failed:', result.error);
}
```

## Core Classes

### FluentGen

The main class for builder generation.

```typescript
import { FluentGen, type GeneratorConfig } from 'fluent-gen';

class FluentGen {
  constructor(config?: GeneratorConfig);

  // Core generation methods
  generateBuilder(filePath: string, typeName: string): Promise<Result<string>>;
  generateMultiple(filePath: string, typeNames: string[]): Promise<Result<Map<string, string>>>;
  generateToFile(filePath: string, typeName: string, outputPath?: string): Promise<Result<string>>;
  scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>;

  // Configuration methods
  registerPlugin(plugin: Plugin): void;
  setConfig(config: Partial<GeneratorConfig>): void;
  getConfig(): GeneratorConfig;

  // Cache management
  clearCache(): void;
  getCacheStats(): CacheStats;
}
```

#### Constructor Options

```typescript
interface GeneratorConfig {
  outputDir?: string;           // Output directory for files
  useDefaults?: boolean;        // Generate default values
  contextType?: string;         // Custom context type name
  importPath?: string;          // Import path for context type
  indentSize?: number;          // Indentation size (spaces)
  useTab?: boolean;            // Use tabs instead of spaces
  addComments?: boolean;        // Include JSDoc comments
  fileExtension?: string;       // Custom file extension
  skipTypeCheck?: boolean;      // Skip TypeScript validation
}
```

## Generation Methods

### generateBuilder

Generate a single builder for a specific type.

```typescript
async generateBuilder(
  filePath: string,
  typeName: string
): Promise<Result<string>>
```

**Parameters:**
- `filePath` - Path to TypeScript file containing the interface
- `typeName` - Name of the interface or type to generate builder for

**Returns:** `Result<string>` containing the generated builder code

**Example:**

```typescript
import { FluentGen } from 'fluent-gen';

const generator = new FluentGen({
  useDefaults: true,
  addComments: true
});

const result = await generator.generateBuilder(
  './src/models/user.ts',
  'User'
);

if (result.ok) {
  console.log('Generated builder:', result.value);
  // Write to file, send to webpack, etc.
} else {
  console.error('Error:', result.error.message);
}
```

### generateMultiple

Generate builders for multiple types from a single file.

```typescript
async generateMultiple(
  filePath: string,
  typeNames: string[]
): Promise<Result<Map<string, string>>>
```

**Parameters:**
- `filePath` - Path to TypeScript file
- `typeNames` - Array of interface/type names

**Returns:** `Result<Map<string, string>>` where keys are type names and values are generated code

**Example:**

```typescript
const result = await generator.generateMultiple(
  './src/api/types.ts',
  ['CreateUserRequest', 'UpdateUserRequest', 'UserResponse']
);

if (result.ok) {
  for (const [typeName, code] of result.value) {
    console.log(`Generated ${typeName} builder`);
    await fs.writeFile(`./builders/${typeName}.builder.ts`, code);
  }
}
```

### generateToFile

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
- `typeName` - Interface/type name
- `outputPath` - Optional output file path (auto-generated if not provided)

**Returns:** `Result<string>` containing the output file path

**Example:**

```typescript
// Auto-generate output path
const result = await generator.generateToFile(
  './src/types.ts',
  'Product'
);

// Custom output path
const result2 = await generator.generateToFile(
  './src/types.ts',
  'Order',
  './custom/Order.builder.ts'
);

if (result.ok) {
  console.log('File written to:', result.value);
}
```

### scanAndGenerate

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
  console.log(`Generated ${result.value.size} builders`);

  for (const [typeName, code] of result.value) {
    const outputPath = `./builders/${typeName}.builder.ts`;
    await fs.writeFile(outputPath, code);
  }
}
```

## Type Extraction API

For more granular control, use the type extraction functions directly:

```typescript
import { extractTypeInfo, generateBuilderCode } from 'fluent-gen';

// Extract type information
const typeResult = await extractTypeInfo('./src/types.ts', 'User');

if (typeResult.ok) {
  const typeInfo = typeResult.value;

  // Generate builder code from type info
  const codeResult = generateBuilderCode(typeInfo, {
    useDefaults: true,
    addComments: true
  });

  if (codeResult.ok) {
    console.log('Generated code:', codeResult.value);
  }
}
```

### extractTypeInfo

```typescript
async function extractTypeInfo(
  filePath: string,
  typeName: string,
  options?: TypeExtractionOptions
): Promise<Result<TypeInfo>>
```

**Options:**

```typescript
interface TypeExtractionOptions {
  tsConfigPath?: string;
  cacheEnabled?: boolean;
  followImports?: boolean;
  maxDepth?: number;
}
```

### generateBuilderCode

```typescript
function generateBuilderCode(
  typeInfo: TypeInfo,
  config?: GeneratorConfig
): Result<string>
```

## Plugin System

Register plugins to extend generation behavior:

```typescript
import { FluentGen, type Plugin } from 'fluent-gen';

const customPlugin: Plugin = {
  name: 'custom-defaults',
  hooks: {
    beforeGeneration: (context) => {
      // Modify context before generation
      console.log('Generating for type:', context.typeName);
    },
    afterPropertyGeneration: (context, property, method) => {
      // Customize property methods
      if (property.type.kind === 'string') {
        method.addJSDoc(`@example .with${property.name}("example")`);
      }
      return method;
    }
  }
};

const generator = new FluentGen();
generator.registerPlugin(customPlugin);
```

## Result Type

All async methods return a `Result<T>` type for railway-oriented programming:

```typescript
type Result<T> = Ok<T> | Err;

interface Ok<T> {
  ok: true;
  value: T;
}

interface Err {
  ok: false;
  error: Error;
}
```

**Usage:**

```typescript
const result = await generator.generateBuilder('./types.ts', 'User');

if (result.ok) {
  // Success case
  const code = result.value;
  console.log('Generated:', code);
} else {
  // Error case
  const error = result.error;
  console.error('Failed:', error.message);
}
```

## Error Handling

Fluent Gen uses structured error handling:

```typescript
import { FluentGenError, ErrorCode } from 'fluent-gen';

try {
  const result = await generator.generateBuilder('./types.ts', 'NonExistent');

  if (!result.ok) {
    const error = result.error as FluentGenError;

    switch (error.code) {
      case ErrorCode.TYPE_NOT_FOUND:
        console.log('Interface not found');
        break;
      case ErrorCode.FILE_NOT_FOUND:
        console.log('Source file not found');
        break;
      case ErrorCode.PARSE_ERROR:
        console.log('TypeScript parsing failed');
        break;
      default:
        console.log('Unknown error:', error.message);
    }
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Configuration Management

### Dynamic Configuration

```typescript
const generator = new FluentGen();

// Update configuration at runtime
generator.setConfig({
  useDefaults: false,
  addComments: true,
  indentSize: 4
});

// Get current configuration
const config = generator.getConfig();
console.log('Current config:', config);
```

### Environment-Based Configuration

```typescript
const generator = new FluentGen({
  outputDir: process.env.FLUENT_GEN_OUTPUT || './src/builders',
  useDefaults: process.env.NODE_ENV !== 'production',
  addComments: process.env.NODE_ENV === 'development'
});
```

## Cache Management

Fluent Gen includes sophisticated caching for performance:

```typescript
// Clear all caches
generator.clearCache();

// Get cache statistics
const stats = generator.getCacheStats();
console.log('Cache stats:', {
  typeResolutionHits: stats.typeResolutionHits,
  symbolResolutionHits: stats.symbolResolutionHits,
  memoryUsage: stats.memoryUsage
});
```

## Build Tool Integration

### Webpack Plugin

```typescript
// webpack.config.js
const { FluentGenPlugin } = require('fluent-gen/webpack');

module.exports = {
  plugins: [
    new FluentGenPlugin({
      patterns: ['src/**/*.ts'],
      outputDir: './src/builders',
      watch: process.env.NODE_ENV === 'development'
    })
  ]
};
```

### Vite Plugin

```typescript
// vite.config.ts
import { fluentGen } from 'fluent-gen/vite';

export default defineConfig({
  plugins: [
    fluentGen({
      targets: [
        { file: './src/types.ts', types: ['User', 'Product'] }
      ]
    })
  ]
});
```

### Rollup Plugin

```typescript
// rollup.config.js
import { fluentGen } from 'fluent-gen/rollup';

export default {
  plugins: [
    fluentGen({
      configPath: './.fluentgenrc.json'
    })
  ]
};
```

### Custom Build Integration

```typescript
// build.js
import { FluentGen } from 'fluent-gen';
import fs from 'fs/promises';
import path from 'path';

async function generateBuilders() {
  const generator = new FluentGen({
    outputDir: './dist/builders',
    useDefaults: true
  });

  const targets = [
    { file: './src/api/types.ts', types: ['ApiRequest', 'ApiResponse'] },
    { file: './src/models/user.ts', types: ['User', 'UserProfile'] },
    { file: './src/models/product.ts', types: ['Product', 'Category'] }
  ];

  for (const target of targets) {
    const result = await generator.generateMultiple(target.file, target.types);

    if (result.ok) {
      for (const [typeName, code] of result.value) {
        const outputPath = path.join('./dist/builders', `${typeName}.builder.ts`);
        await fs.writeFile(outputPath, code);
        console.log(`✓ Generated ${typeName} builder`);
      }
    } else {
      console.error(`✗ Failed to generate ${target.file}:`, result.error.message);
      process.exit(1);
    }
  }
}

generateBuilders().catch(console.error);
```

## Advanced Usage

### Custom Type Resolution

```typescript
import { TypeExtractor, ImportResolver } from 'fluent-gen/core';

// Custom import resolution
const customResolver = new ImportResolver({
  pathMapping: {
    '@/types': './src/types',
    '@/models': './src/models'
  }
});

const extractor = new TypeExtractor({
  importResolver: customResolver,
  followImports: true,
  maxDepth: 10
});

const result = await extractor.extractType('./src/types.ts', 'ComplexType');
```

### Streaming Generation

```typescript
import { FluentGen } from 'fluent-gen';
import { Readable } from 'stream';

async function* generateStream(patterns: string[]) {
  const generator = new FluentGen();

  for (const pattern of patterns) {
    const result = await generator.scanAndGenerate(pattern);

    if (result.ok) {
      for (const [typeName, code] of result.value) {
        yield { typeName, code };
      }
    }
  }
}

// Usage
for await (const { typeName, code } of generateStream(['src/**/*.ts'])) {
  console.log(`Generated ${typeName}`);
  // Process each builder as it's generated
}
```

## Testing Integration

### Jest Setup

```typescript
// jest.setup.ts
import { FluentGen } from 'fluent-gen';

// Global test generator
global.testGenerator = new FluentGen({
  useDefaults: true,
  addComments: false
});
```

### Test Utilities

```typescript
// test-utils.ts
import { FluentGen } from 'fluent-gen';
import { join } from 'path';

export async function generateTestBuilder(
  typeName: string,
  sourceFile = 'test-types.ts'
) {
  const generator = new FluentGen({ useDefaults: true });
  const filePath = join(__dirname, 'fixtures', sourceFile);

  const result = await generator.generateBuilder(filePath, typeName);

  if (!result.ok) {
    throw new Error(`Failed to generate ${typeName}: ${result.error.message}`);
  }

  return result.value;
}

// Usage in tests
describe('UserBuilder', () => {
  it('should generate correct builder', async () => {
    const code = await generateTestBuilder('User');
    expect(code).toContain('withName');
    expect(code).toContain('withEmail');
  });
});
```

## Next Steps

- [Explore practical examples](../examples/basic.md)
- [Learn about plugin development](../api/plugins.md)
- [Understand the type resolution system](../api/resolver.md)
- [See the complete API reference](../api/overview.md)