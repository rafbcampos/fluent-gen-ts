# Getting Started

This guide will help you get started with fluent-gen, a TypeScript type
extraction system that generates fluent builders for any interface, type alias,
or type literal.

## Prerequisites

Before you begin, ensure you have:

- Node.js >= 18.0.0
- TypeScript >= 4.5.0
- A TypeScript project with a `tsconfig.json` file

## Installation

Install fluent-gen as a development dependency:

::: code-group

```bash [npm]
npm install --save-dev fluent-gen
```

```bash [pnpm]
pnpm add -D fluent-gen
```

```bash [yarn]
yarn add -D fluent-gen
```

:::

## Your First Builder

Let's create a simple TypeScript interface and generate a fluent builder for it.

### Step 1: Create an Interface

Create a file `src/types/user.ts`:

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  isActive: boolean;
}
```

### Step 2: Generate the Builder

You can generate a builder using either the CLI or programmatic API.

#### Using the CLI

```bash
npx fluent-gen generate src/types/user.ts User
```

This will output the generated builder code to the console. To save it to a
file:

```bash
npx fluent-gen generate src/types/user.ts User -o src/builders/user.builder.ts
```

#### Using the Programmatic API

Create a script `generate-builders.js`:

```javascript
import { FluentGen } from 'fluent-gen';

const generator = new FluentGen({
  useDefaults: true,
  addComments: true,
});

const result = await generator.generateToFile(
  './src/types/user.ts',
  'User',
  './src/builders/user.builder.ts',
);

if (result.ok) {
  console.log('Builder generated at:', result.value);
} else {
  console.error('Generation failed:', result.error);
}
```

Run the script:

```bash
node generate-builders.js
```

### Step 3: Use the Builder

Now you can use the generated builder in your code:

```typescript
import { userBuilder } from './builders/user.builder';

// Create a user with the fluent builder
const user = userBuilder()
  .withId('user-001')
  .withName('Alice Johnson')
  .withEmail('alice@example.com')
  .withAge(28)
  .withIsActive(true)
  .build();

console.log(user);
// Output: {
//   id: 'user-001',
//   name: 'Alice Johnson',
//   email: 'alice@example.com',
//   age: 28,
//   isActive: true
// }
```

## Working with Complex Types

fluent-gen handles complex types seamlessly. Let's see an example with nested
objects and arrays.

### Nested Objects

```typescript
// types/order.ts
export interface Address {
  street: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  address: Address;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customer: Customer;
  items: OrderItem[];
  totalAmount: number;
  createdAt: Date;
}
```

Generate builders for all types:

```bash
npx fluent-gen generate types/order.ts Order -o builders/order.builder.ts
```

Use the nested builders:

```typescript
import {
  orderBuilder,
  customerBuilder,
  addressBuilder,
  orderItemBuilder,
} from './builders/order.builder';

const order = orderBuilder()
  .withId('order-001')
  .withCustomer(
    customerBuilder()
      .withId('cust-001')
      .withName('Bob Smith')
      .withEmail('bob@example.com')
      .withAddress(
        addressBuilder()
          .withStreet('456 Oak St')
          .withCity('New York')
          .withCountry('USA')
          .withZipCode('10001')
          .build(),
      )
      .build(),
  )
  .withItems([
    orderItemBuilder()
      .withProductId('prod-001')
      .withQuantity(2)
      .withPrice(29.99)
      .build(),
    orderItemBuilder()
      .withProductId('prod-002')
      .withQuantity(1)
      .withPrice(49.99)
      .build(),
  ])
  .withTotalAmount(109.97)
  .withCreatedAt(new Date())
  .build();
```

## Batch Generation

For larger projects, you can generate multiple builders at once.

### Using Configuration File

Create a `.fluentgenrc.json` file:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/generated/builders",
    "useDefaults": true,
    "addComments": true
  },
  "targets": [
    {
      "file": "src/types/models.ts",
      "types": ["User", "Product", "Order"]
    },
    {
      "file": "src/types/api.ts",
      "types": ["ApiRequest", "ApiResponse"]
    }
  ]
}
```

Run batch generation:

```bash
npx fluent-gen batch
```

### Using Scan Command

Scan your codebase and select types interactively:

```bash
npx fluent-gen scan "src/**/*.ts" --interactive
```

Or generate builders for all discovered types:

```bash
npx fluent-gen scan "src/**/*.ts" -o "src/builders/{type}.builder.ts"
```

## Generic Types

fluent-gen supports generic interfaces and types:

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  timestamp: Date;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
```

Use generic builders:

```typescript
import {
  apiResponseBuilder,
  pagedResponseBuilder,
  userBuilder,
} from './builders';

// ApiResponse with User data
const userResponse = apiResponseBuilder<User>()
  .withData(
    userBuilder()
      .withId('user-001')
      .withName('Alice')
      .withEmail('alice@example.com')
      .build(),
  )
  .withStatus(200)
  .withMessage('User fetched successfully')
  .withTimestamp(new Date())
  .build();

// PagedResponse with User array
const usersPage = pagedResponseBuilder<User>()
  .withItems([
    userBuilder().withName('Alice').build(),
    userBuilder().withName('Bob').build(),
  ])
  .withPage(1)
  .withPageSize(10)
  .withTotalCount(2)
  .build();
```

## Using Default Values

Enable default values for optional properties:

```typescript
const generator = new FluentGen({
  useDefaults: true,
});
```

With defaults enabled, optional properties will have sensible default values:

```typescript
const user = userBuilder()
  .withId('user-001')
  .withName('Alice')
  .withEmail('alice@example.com')
  .withIsActive(true)
  .build();

// age will default to 0 (number default)
console.log(user.age); // 0
```

## Next Steps

Now that you've learned the basics, explore more advanced features:

- [CLI Reference](./cli.md) - Learn about all CLI commands and options
- [Programmatic API](./api.md) - Deep dive into the programmatic API
- [Configuration](./configuration.md) - Configure fluent-gen for your project
- [Plugin System](../api/plugins.md) - Extend fluent-gen with custom plugins
- [Examples](../examples/basic.md) - See more complex examples

## Common Issues

### TypeScript Configuration

Ensure your `tsconfig.json` has proper settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Import Errors

If you encounter import errors, ensure:

1. Your generated builders are in the correct location
2. Your TypeScript paths are configured correctly
3. You're using the correct import syntax for your module system

### Type Not Found

If fluent-gen can't find a type:

1. Ensure the type is exported
2. Check that the file path is correct
3. Verify the type name matches exactly (case-sensitive)

## Getting Help

- Check the [API Documentation](../api/overview.md)
- Browse [Examples](../examples/basic.md)
- Report issues on [GitHub](https://github.com/rafbcampos/fluent-gen/issues)
- Join discussions on
  [GitHub Discussions](https://github.com/rafbcampos/fluent-gen/discussions)
