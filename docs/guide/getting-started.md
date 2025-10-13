# Getting Started

This guide will help you get up and running with fluent-gen-ts in minutes.

## Prerequisites

- Node.js 18 or higher
- TypeScript 5.0 or higher
- A TypeScript project with interfaces or types you want to generate builders
  for

## Installation

Install fluent-gen-ts as a development dependency:

::: code-group

```bash [npm]
npm install -D fluent-gen-ts
```

```bash [pnpm]
pnpm add -D fluent-gen-ts
```

```bash [yarn]
yarn add -D fluent-gen-ts
```

:::

## Quick Start with Interactive CLI

The easiest way to get started is using the interactive CLI:

```bash
npx fluent-gen-ts init
```

This will guide you through:

1. **Scanning for TypeScript files**: Specify patterns like `src/**/*.ts`
2. **Selecting interfaces**: Choose which interfaces to generate builders for
3. **Configuring output**: Set the output directory and naming conventions
4. **Creating configuration**: Save your choices to `fluentgen.config.js`
5. **Generating builders**: Optionally generate builders immediately

## Your First Builder

Let's create a simple example. Create a file `types.ts`:

```typescript
// types.ts
export interface User {
  id: string;
  name: string;
  email?: string;
  age: number;
  role: 'admin' | 'user' | 'guest';
  isActive: boolean;
}
```

### Generate the Builder

Run the generate command:

```bash
npx fluent-gen-ts generate ./types.ts User --output ./builders/
```

This creates `builders/user.builder.ts`:

```typescript
import type { User } from '../types.js';

// ... builder utilities (inlined in single mode) ...

export class UserBuilder extends FluentBuilderBase<User> {
  private static readonly defaults = {
    id: '',
    name: '',
    age: 0,
    role: 'user',
    isActive: false,
  };

  withId(value: string): UserBuilder {
    return this.set('id', value);
  }

  withName(value: string): UserBuilder {
    return this.set('name', value);
  }

  withEmail(value: string): UserBuilder {
    return this.set('email', value);
  }

  withAge(value: number): UserBuilder {
    return this.set('age', value);
  }

  withRole(value: 'admin' | 'user' | 'guest'): UserBuilder {
    return this.set('role', value);
  }

  withIsActive(value: boolean): UserBuilder {
    return this.set('isActive', value);
  }

  build(context?: BaseBuildContext): User {
    return this.buildWithDefaults(UserBuilder.defaults, context);
  }
}

export function user(initial?: Partial<User>): UserBuilder {
  return new UserBuilder(initial);
}
```

### Using the Builder

Now you can use the generated builder in your code:

```typescript
import { user } from './builders/user.builder.js';

// Basic usage
const basicUser = user()
  .withId('u1')
  .withName('Alice')
  .withAge(30)
  .withRole('admin')
  .withIsActive(true)
  .build();

// With optional fields
const fullUser = user()
  .withId('u2')
  .withName('Bob')
  .withEmail('bob@example.com')
  .withAge(25)
  .withRole('user')
  .withIsActive(true)
  .build();

// Start with partial data
const partialUser = user({ id: 'u3', name: 'Charlie' })
  .withAge(35)
  .withRole('guest')
  .withIsActive(false)
  .build();

// Using conditionals
const conditionalUser = user()
  .withId('u4')
  .withName('Diana')
  .withAge(28)
  .withRole('user')
  .withIsActive(true)
  .if(b => !b.has('email'), 'email', 'default@example.com')
  .build();
```

## Batch Generation

When you have multiple types to generate builders for, use batch generation:

### 1. Create a Configuration File

Create `fluentgen.config.js`:

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  targets: [
    { file: './src/models/user.ts', types: ['User', 'UserProfile'] },
    { file: './src/models/product.ts', types: ['Product', 'Category'] },
    { file: './src/models/order.ts', types: ['Order', 'OrderItem'] },
  ],
  generator: {
    outputDir: './src/builders',
    useDefaults: true,
    addComments: true,
  },
};
```

### 2. Run Batch Generation

```bash
npx fluent-gen-ts batch
```

This will:

- Generate a `common.ts` file with shared utilities
- Create individual builder files that import from `common.ts`
- Use consistent configuration across all builders

## Single vs Batch Mode

### Single Mode (Default)

- Each builder is self-contained with inlined utilities
- No external dependencies
- Perfect for:
  - Generating one or two builders
  - Sharing builders across projects
  - Maximum portability

### Batch Mode

- Generates a shared `common.ts` file
- Builders import utilities from `common.ts`
- Perfect for:
  - Generating multiple builders
  - Keeping generated code DRY
  - Maintaining consistency across builders

## Using Your Own Common File

You can create and customize your own common utilities:

```bash
npx fluent-gen-ts setup-common --output ./src/common.ts
```

This creates a customizable `common.ts` file. When generating builders in the
same directory, they'll automatically use your custom common file.

## TypeScript Configuration

fluent-gen-ts respects your TypeScript configuration. You can specify a custom
`tsconfig.json`:

```bash
npx fluent-gen-ts generate ./types.ts User --tsconfig ./tsconfig.build.json
```

Or in your configuration file:

```javascript
export default {
  tsConfigPath: './tsconfig.build.json',
  // ... other options
};
```

## Next Steps

- Learn about [Core Concepts](./core-concepts.md) to understand how builders
  work
- Explore [Advanced Usage](./advanced-usage.md) for complex scenarios
- Check out [Plugin Development](./plugins.md) to extend functionality
- See [CLI Commands](./cli-commands.md) for all available commands
- Browse [Examples](/examples/) for real-world usage patterns

## Troubleshooting

### Common Issues

**Builder not generating?**

- Ensure the type is exported (`export interface` or `export type`)
- Check that the file path and type name are correct
- Verify the type represents an object (not a primitive or function)

**Type errors in generated code?**

- Make sure you're using TypeScript 5.0 or higher
- Check that all imported types are properly exported
- Ensure your tsconfig includes the generated files

**Can't find module errors?**

- Use `.js` extensions in imports (for ESM compatibility)
- Check your `tsconfig.json` module resolution settings
- Ensure `package.json` has `"type": "module"` if using ESM

### Getting Help

- [GitHub Issues](https://github.com/rafbcampos/fluent-gen-ts/issues) - Report
  bugs or request features
- [Examples](/examples/) - See working examples
- [API Reference](/api/reference) - Detailed API documentation
