# fluent-gen

[![CI](https://github.com/rafbcampos/fluent-gen-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/rafbcampos/fluent-gen-ts/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/rafbcampos/fluent-gen-ts/graph/badge.svg?token=PQ45UU94C1)](https://codecov.io/gh/rafbcampos/fluent-gen-ts)
[![npm version](https://badge.fury.io/js/fluent-gen-ts.svg)](https://www.npmjs.com/package/fluent-gen-ts)
[![Node.js Version](https://img.shields.io/node/v/fluent-gen-ts.svg)](https://nodejs.org/)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![npm downloads](https://img.shields.io/npm/dm/fluent-gen-ts.svg)](https://www.npmjs.com/package/fluent-gen-ts)

> Generate type-safe fluent builders for TypeScript interfaces and types

## Features

- **Type-Safe Builders**: Generate strongly-typed fluent builders from
  TypeScript interfaces, types, and type aliases
- **Deep Type Resolution**: Handles complex types including utility types,
  mapped types, conditional types, and generics
- **Smart Defaults**: Automatically generates sensible default values for
  optional properties
- **JSDoc Support**: Preserves documentation comments in generated code
- **Plugin System**: Extensible architecture with hooks for customizing
  generation behavior
- **CLI & API**: Use as a command-line tool or programmatically in your build
  process
- **Zero Runtime Overhead**: All generation happens at build time with no
  runtime dependencies

## Installation

```bash
# Install as a development dependency
pnpm add -D fluent-gen

# Or use npm
npm install --save-dev fluent-gen

# Or use yarn
yarn add -D fluent-gen
```

## Quick Start

### CLI Usage

fluent-gen provides four main commands:

```bash
# Generate a builder for a single type
fluent-gen generate <file> <type> [options]

# Generate multiple builders from configuration
fluent-gen batch [options]

# Scan files and generate builders interactively or automatically
fluent-gen scan <pattern> [options]

# Initialize a configuration file
fluent-gen init [options]
```

#### Examples

```bash
# Generate a builder for the User interface
fluent-gen generate src/types/user.ts User

# Generate with custom output location
fluent-gen generate src/types/user.ts User -o src/builders/user.builder.ts

# Scan all TypeScript files and select types interactively
fluent-gen scan "src/**/*.ts" --interactive

# Generate from configuration file
fluent-gen batch
```

### Programmatic Usage

```typescript
import { FluentGen } from 'fluent-gen';

// Create an instance with options
const generator = new FluentGen({
  useDefaults: true,
  addComments: true,
  outputDir: './src/builders',
});

// Generate builder code for a single type
const result = await generator.generateBuilder('./src/types/user.ts', 'User');

if (result.ok) {
  console.log('Generated builder code:', result.value);
} else {
  console.error('Error:', result.error);
}

// Generate and save to file
const fileResult = await generator.generateToFile(
  './src/types/user.ts',
  'User',
  './src/builders/user.builder.ts',
);

// Generate multiple builders
const multipleResult = await generator.generateMultiple(
  './src/types/models.ts',
  ['User', 'Product', 'Order'],
);

// Scan and generate from pattern
const scanResult = await generator.scanAndGenerate('src/**/*.ts');
```

## Example

Given this TypeScript interface:

```typescript
// user.ts
interface Address {
  street: string;
  city: string;
  country: string;
  postalCode?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  address: Address;
  tags?: string[];
  createdAt: Date;
}
```

fluent-gen generates type-safe builders:

```typescript
import { user, address } from './user.builder';

// Build a user with fluent interface
const newUser = user()
  .withId('user-123')
  .withName('John Doe')
  .withEmail('john@example.com')
  .withAge(30)
  .withAddress(
    address()
      .withStreet('123 Main St')
      .withCity('San Francisco')
      .withCountry('USA')
      .withPostalCode('94105')
      .build(),
  )
  .withTags(['developer', 'typescript'])
  .withCreatedAt(new Date())
  .build();

// The result is fully typed as User
const userData: User = newUser;
```

## Configuration

Create a `.fluentgenrc.json` file in your project root:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/generated/builders",
    "useDefaults": true,
    "addComments": true,
    "contextType": "BuildContext",
    "importPath": "./build-context"
  },
  "targets": [
    {
      "file": "src/types/models.ts",
      "types": ["User", "Product", "Order"],
      "outputFile": "src/builders/models.builder.ts"
    }
  ],
  "patterns": ["src/**/*.interface.ts"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "plugins": ["./plugins/custom-plugin.js"]
}
```

### Configuration Options

| Option                  | Type    | Description                                     |
| ----------------------- | ------- | ----------------------------------------------- |
| `tsConfigPath`          | string  | Path to TypeScript configuration file           |
| `generator.outputDir`   | string  | Default output directory for generated builders |
| `generator.useDefaults` | boolean | Generate default values for optional properties |
| `generator.addComments` | boolean | Include JSDoc comments in generated code        |
| `generator.contextType` | string  | Custom context type name for builders           |
| `generator.importPath`  | string  | Import path for context type                    |
| `targets`               | array   | Specific files and types to generate            |
| `patterns`              | array   | Glob patterns to scan for types                 |
| `exclude`               | array   | Patterns to exclude from scanning               |
| `plugins`               | array   | Paths to plugin files                           |

## CLI Commands

### `generate`

Generate a builder for a specific type.

```bash
fluent-gen generate <file> <type> [options]
```

**Options:**

- `-o, --output <path>`: Output file path
- `-c, --config <path>`: Path to configuration file
- `-t, --tsconfig <path>`: Path to tsconfig.json
- `-p, --plugins <paths...>`: Plugin file paths
- `-d, --defaults`: Use default values for optional properties
- `--dry-run`: Preview without writing files
- `--no-comments`: Don't include JSDoc comments

### `batch`

Generate builders from configuration file.

```bash
fluent-gen batch [options]
```

**Options:**

- `-c, --config <path>`: Configuration file path
- `-p, --plugins <paths...>`: Plugin file paths
- `-d, --dry-run`: Preview without writing files
- `--parallel`: Generate builders in parallel

### `scan`

Scan files for types and generate builders.

```bash
fluent-gen scan <pattern> [options]
```

**Options:**

- `-o, --output <pattern>`: Output file pattern
- `-c, --config <path>`: Configuration file path
- `-p, --plugins <paths...>`: Plugin file paths
- `-e, --exclude <patterns...>`: Patterns to exclude
- `-t, --types <types>`: Comma-separated type names
- `-i, --interactive`: Interactive type selection
- `--dry-run`: Preview discovered types
- `--ignore-private`: Ignore non-exported types

### `init`

Initialize a configuration file.

```bash
fluent-gen init [options]
```

**Options:**

- `--overwrite`: Overwrite existing configuration

## Advanced Features

### Nested Builders

Nested objects automatically get their own builders:

```typescript
const order = orderBuilder()
  .withId('order-123')
  .withCustomer(
    customerBuilder().withName('Alice').withEmail('alice@example.com').build(),
  )
  .withItems([
    orderItemBuilder()
      .withProductId('prod-1')
      .withQuantity(2)
      .withPrice(29.99)
      .build(),
    orderItemBuilder()
      .withProductId('prod-2')
      .withQuantity(1)
      .withPrice(49.99)
      .build(),
  ])
  .build();
```

### Generic Types

Full support for generic interfaces and types:

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

// Generated builder usage
const response = apiResponseBuilder<User>()
  .withData(userBuilder().withName('Bob').build())
  .withStatus(200)
  .withMessage('Success')
  .build();
```

### Context Passing

Builders support context passing for advanced scenarios:

```typescript
interface BuildContext {
  tenantId: string;
  userId: string;
}

const user = userBuilder()
  .withName('John')
  .withEmail('john@example.com')
  .build({ tenantId: 'tenant-123', userId: 'user-456' });
```

## Plugin System

Create custom plugins to extend generation behavior:

```typescript
import { Plugin } from 'fluent-gen';

const myPlugin: Plugin = {
  name: 'my-custom-plugin',
  hooks: {
    beforeTypeResolution: async context => {
      // Modify type resolution behavior
      return { continue: true };
    },
    afterPropertyGeneration: async context => {
      // Customize generated properties
      return { continue: true, data: context.properties };
    },
    beforeCodeGeneration: async context => {
      // Modify generation context
      return { continue: true };
    },
  },
};

// Register plugin
generator.registerPlugin(myPlugin);
```

## API Reference

### Main Classes

#### FluentGen

The main class for builder generation.

```typescript
class FluentGen {
  constructor(options?: FluentGenOptions);

  // Generate builder code as string
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

  // Scan pattern and generate builders
  scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>>;

  // Plugin registration
  registerPlugin(plugin: Plugin): Result<void>;

  // Cache management
  clearCache(): void;
}
```

#### TypeExtractor

Extract type information from TypeScript files.

```typescript
class TypeExtractor {
  extractType(filePath: string, typeName: string): Promise<Result<TypeInfo>>;
  scanFile(filePath: string): Promise<Result<string[]>>;
}
```

#### BuilderGenerator

Generate builder code from type information.

```typescript
class BuilderGenerator {
  generate(typeInfo: TypeInfo): Promise<Result<string>>;
  generateCommonFile(): string;
}
```

### Result Type

All operations use Result types for error handling:

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

// Helper functions
function isOk<T>(result: Result<T>): boolean;
function isErr<T>(result: Result<T>): boolean;
```

## Development

```bash
# Clone the repository
git clone https://github.com/rafbcampos/fluent-gen.git
cd fluent-gen

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build

# Run linting
pnpm lint

# Type checking
pnpm typecheck
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 4.5.0

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

## License

MIT © [Rafael Campos](https://github.com/rafbcampos)

## Support

- [Documentation](https://rafbcampos.github.io/fluent-gen-ts/)
- [GitHub Issues](https://github.com/rafbcampos/fluent-gen/issues)
