# fluent-gen

> Generate fluent builders for any Typescript interface.

## Features

- **Type-Safe Builders**: Generate strongly-typed fluent builders from TypeScript interfaces
- **Deep Type Resolution**: Handles complex types including utility, mapped, conditional types, and generics
- **Smart Defaults**: Automatically generates sensible default values for optional properties
- **JSDoc Support**: Preserves documentation comments in generated code
- **Plugin System**: Extensible micro-kernel architecture for custom type handlers
- **CLI & API**: Use as a command-line tool or programmatically in your build process
- **High Performance**: Built-in caching for symbol resolution and type analysis

## Installation

```bash
# Global CLI installation
pnpm install -g fluent-gen

# Local project installation
pnpm install --save-dev fluent-gen
```

## Quick Start

### CLI Usage

Generate a builder for a single interface:

```bash
fluent-gen generate src/types/user.ts User -o src/builders/
```

Scan and generate builders for multiple files:

```bash
fluent-gen scan "src/**/*.ts" --interactive
```

Initialize a configuration file:

```bash
fluent-gen init
```

### Programmatic Usage

```typescript
import { generateBuilderCode } from "fluent-gen";

const result = await generateBuilderCode({
  filePath: "./src/types/user.ts",
  typeName: "User",
  outputPath: "./src/builders/user.builder.ts",
});

if (result.isOk()) {
  console.log("Builder generated successfully!");
}
```

## Example

Given this TypeScript interface:

```typescript
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
}
```

fluent-gen generates a type-safe builder:

```typescript
const user = userBuilder()
  .withId("user-123")
  .withName("John Doe")
  .withEmail("john@example.com")
  .withAge(30)
  .withAddress(
    addressBuilder()
      .withStreet("123 Main St")
      .withCity("San Francisco")
      .withCountry("USA")
      .withPostalCode("94105"),
  )
  .withTags(["developer", "typescript"]);

// Build the final object
const userData: User = user.build();
```

## Configuration

Create a `.fluentgenrc.json` file in your project root:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./generated",
    "useDefaults": true,
    "addComments": true
  },
  "targets": [
    {
      "file": "src/types/models.ts",
      "types": ["User", "Product", "Order"]
    }
  ],
  "patterns": [
    {
      "include": "src/**/*.interface.ts",
      "exclude": ["**/*.test.ts", "**/*.spec.ts"]
    }
  ]
}
```

## Advanced Features

### Nested Builders

Nested objects automatically support builder pattern:

```typescript
const order = orderBuilder()
  .withId("order-123")
  .withCustomer(
    customerBuilder().withName("Alice").withEmail("alice@example.com"),
  )
  .withItems([
    orderItemBuilder().withProductId("prod-1").withQuantity(2).withPrice(29.99),
  ]);
```

### Generic Types

Full support for generic interfaces:

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  timestamp: Date;
}

// Usage with specific type
const response = apiResponseBuilder<User>()
  .withData(userBuilder().withName("Bob").build())
  .withStatus(200)
  .withTimestamp(new Date());
```

### Context Passing

Builders support context passing from parent to child:

```typescript
const user = userBuilder()
  .withAddress(addressBuilder()) // Address builder receives parent context
  .build({ tenantId: "tenant-123" }); // Context passed during build
```

## API Reference

### CLI Commands

- `generate <file> <type>` - Generate a builder for a specific type
- `batch` - Generate builders from configuration file
- `scan <pattern>` - Scan files for interfaces and types
- `init` - Initialize a configuration file

### Programmatic API

```typescript
import {
  generateBuilderCode,
  extractTypeInfo,
  TypeResolver,
  PluginSystem,
} from "fluent-gen";
```

See [full API documentation](https://rafbcampos.github.io/fluent-gen/) for details.

## Plugin System

fluent-gen uses a micro-kernel architecture with a powerful plugin system:

```typescript
import { Plugin, PluginSystem } from "fluent-gen";

const myPlugin: Plugin = {
  name: "my-custom-plugin",
  hooks: {
    beforeTypeResolution: async (context) => {
      // Custom logic before type resolution
      return { continue: true };
    },
    afterPropertyGeneration: async (context) => {
      // Modify generated properties
      return {
        continue: true,
        data: modifiedProperties,
      };
    },
  },
};

const pluginSystem = new PluginSystem();
pluginSystem.register(myPlugin);
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/rafbcampos/fluent-gen.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build
```

## License

MIT © [Rafael Campos](https://github.com/rafbcampos)

## Support

- [Documentation](https://rafbcampos.github.io/fluent-gen/)
- [GitHub Issues](https://github.com/rafbcampos/fluent-gen/issues)
- [Discussions](https://github.com/rafbcampos/fluent-gen/discussions)

