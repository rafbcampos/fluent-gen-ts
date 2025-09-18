# Getting Started

Welcome to Fluent Gen! This guide will help you get up and running with generating type-safe fluent builders from your TypeScript interfaces.

## What is Fluent Gen?

Fluent Gen is a TypeScript code generation tool that automatically creates fluent builder patterns from your existing interfaces and types. It analyzes your TypeScript code, resolves all type dependencies, and generates builder classes that provide a chainable, type-safe API for constructing objects.

## Key Features

- **Zero Runtime Overhead**: All generation happens at build time
- **Full Type Safety**: Preserves TypeScript types, generics, and JSDoc comments
- **Complex Type Support**: Handles utility types, conditional types, and circular references
- **Extensible**: Plugin architecture for customizing generation behavior
- **Production Ready**: Result-based error handling and comprehensive caching

## Prerequisites

- Node.js 18+ or Bun
- TypeScript 5.0+
- A TypeScript project with defined interfaces or types

## Quick Start

### 1. Install Fluent Gen

```bash
npm install -D fluent-gen
```

### 2. Create Your First Interface

Create a file `types.ts` with an interface:

```typescript
// types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}
```

### 3. Generate the Builder

Run the CLI command:

```bash
npx fluent-gen generate ./types.ts User
```

This generates a `User.builder.ts` file with your fluent builder.

### 4. Use the Builder

```typescript
import { userBuilder } from './User.builder';

const user = userBuilder()
  .withId('user-123')
  .withName('Alice Johnson')
  .withEmail('alice@example.com')
  .withAge(28)
  .withSettings({
    theme: 'dark',
    notifications: true
  });

// Build the final object
const userInstance = user();
console.log(userInstance);
// Output: { id: 'user-123', name: 'Alice Johnson', ... }
```

## How It Works

1. **Type Extraction**: Fluent Gen parses your TypeScript file using `ts-morph` and extracts the specified interface or type.

2. **Dependency Resolution**: It recursively resolves all type dependencies, including:
   - Imported types from other files
   - Node module types
   - Utility types (`Pick`, `Omit`, `Partial`, etc.)
   - Generic type parameters

3. **Type Analysis**: The resolved type is analyzed to understand:
   - Property types and optionality
   - Nested object structures
   - Union and intersection types
   - JSDoc comments

4. **Code Generation**: Based on the analysis, Fluent Gen generates:
   - A builder class with `with*` methods for each property
   - Type-safe method signatures
   - Smart default values
   - Support for nested builders

## Core Concepts

### Fluent Builder Pattern

The fluent builder pattern provides a chainable API for object construction:

```typescript
const product = productBuilder()
  .withId('prod-001')
  .withName('Laptop')
  .withPrice(999.99)
  .withInStock(true);

const instance = product(); // Build the object
```

### Deferred Building

Builders don't create the object immediately. The final object is built when you call the builder function:

```typescript
const builder = userBuilder().withName('Bob');
// Object not created yet

const user1 = builder(); // Now the object is created
const user2 = builder(); // Creates a new instance
```

### Nested Builders

For nested objects, Fluent Gen automatically creates nested builders:

```typescript
interface Order {
  id: string;
  customer: Customer;
  items: OrderItem[];
}

// Usage with nested builders
const order = orderBuilder()
  .withId('order-123')
  .withCustomer(
    customerBuilder()
      .withName('John')
      .withEmail('john@example.com')
  )
  .withItems([
    orderItemBuilder()
      .withProductId('prod-001')
      .withQuantity(2)
  ]);
```

### Context Passing

Builders can pass context to nested builders, useful for maintaining relationships:

```typescript
const user = userBuilder()
  .withId('user-123')
  .withProfile(
    profileBuilder() // Receives parent context
  );

// The profile builder can access the parent user's ID
```

## Next Steps

- **[Installation Guide](./installation.md)**: Detailed installation instructions and requirements
- **[CLI Usage](./cli.md)**: Learn about all CLI commands and options
- **[Configuration](./configuration.md)**: Set up project-wide configuration
- **[Programmatic API](./api.md)**: Integrate Fluent Gen into your build process
- **[Examples](../examples/basic.md)**: See more complex usage examples

## Common Use Cases

### Test Data Generation

Create consistent test data with builders:

```typescript
describe('UserService', () => {
  it('should create a user', () => {
    const testUser = userBuilder()
      .withId('test-id')
      .withName('Test User')
      .withEmail('test@example.com')();

    const result = userService.create(testUser);
    expect(result).toBeDefined();
  });
});
```

### API Request Building

Build API request payloads:

```typescript
const createUserRequest = createUserRequestBuilder()
  .withUsername('newuser')
  .withPassword('secure123')
  .withProfile(
    profileBuilder()
      .withFirstName('Jane')
      .withLastName('Doe')
  )();

await api.post('/users', createUserRequest);
```

### Configuration Objects

Build complex configuration objects:

```typescript
const config = appConfigBuilder()
  .withPort(3000)
  .withDatabase(
    databaseConfigBuilder()
      .withHost('localhost')
      .withPort(5432)
      .withName('myapp')
  )
  .withAuth(
    authConfigBuilder()
      .withJwtSecret(process.env.JWT_SECRET)
      .withTokenExpiry('24h')
  )();
```

## Troubleshooting

### Common Issues

**Type not found**: Ensure the type is exported and the file path is correct.

**Import resolution fails**: Check your `tsconfig.json` paths configuration.

**Circular references**: Fluent Gen handles these automatically, but very complex circular dependencies might need manual intervention.

### Getting Help

- Check common questions in the documentation
- Report issues on [GitHub](https://github.com/rafbcampos/fluent-gen/issues)
- Join discussions in the [community forum](https://github.com/rafbcampos/fluent-gen/discussions)

## Learn More

- [Architecture Overview](../api/overview.md): Understand the internal architecture
- [Plugin Development](../api/plugins.md): Create custom plugins
- [Advanced Patterns](../examples/advanced.md): Complex type scenarios