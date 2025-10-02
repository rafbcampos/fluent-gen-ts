# Quick Start

:::tip 5-Minute Goal Generate your first type-safe builder and use it in your
code. :::

## Installation

```bash
npm install -D fluent-gen-ts
```

## 1. Create a TypeScript Interface

```typescript
// src/types/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
}
```

## 2. Generate the Builder

### Option A: Single Command

```bash
npx fluent-gen-ts generate ./src/types/user.ts User --output ./src/builders/
```

### Option B: Config File (Recommended)

Create `fluentgen.config.js`:

```javascript
export default {
  targets: [{ file: './src/types/user.ts', types: ['User'] }],
  output: {
    dir: './src/builders',
  },
};
```

Then run:

```bash
npx fluent-gen-ts batch
```

## 3. Use the Builder

```typescript
import { user } from './src/builders/user.builder.js';

// Create a user with fluent API
const newUser = user()
  .withId('user-123')
  .withName('Alice Smith')
  .withEmail('alice@example.com')
  .withAge(30)
  .withIsActive(true)
  .build();

console.log(newUser);
// {
//   id: 'user-123',
//   name: 'Alice Smith',
//   email: 'alice@example.com',
//   age: 30,
//   isActive: true
// }
```

## That's It! 🎉

You now have a type-safe, fluent builder for your `User` interface.

## Common Next Steps

### Add More Types

```javascript
// fluentgen.config.js
export default {
  targets: [
    { file: './src/types/user.ts', types: ['User', 'Profile'] },
    { file: './src/types/product.ts', types: ['Product'] },
  ],
  output: {
    dir: './src/builders',
  },
};
```

### Use in Tests

```typescript
// __tests__/user.test.ts
import { user } from '../builders/user.builder.js';

test('should create user', () => {
  const testUser = user()
    .withId('test-id')
    .withName('Test User')
    .withEmail('test@example.com')
    .withAge(25)
    .withIsActive(true)
    .build();

  expect(testUser.name).toBe('Test User');
});
```

### Add Validation Plugin

```typescript
// plugins/validation.ts
import { createPlugin } from 'fluent-gen-ts';

export default createPlugin('validation', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when(ctx => ctx.property.name === 'email')
      .setValidator(
        `
      if (value && !value.includes('@')) {
        throw new Error('Invalid email');
      }
    `,
      )
      .done(),
  )
  .build();
```

```javascript
// fluentgen.config.js
export default {
  plugins: ['./plugins/validation.ts'],
  targets: [
    /* ... */
  ],
};
```

## What's Next?

<div class="next-steps">

### 📚 Learn Core Concepts

Understand the system: **[Core Concepts →](/guide/core-concepts)**

### 🔌 Add Plugins

Extend functionality: **[Plugin Overview →](/guide/plugins/)**

### 📖 Browse Examples

See real patterns: **[Examples →](/examples/)**

### ⚙️ CLI Commands

Learn all commands: **[CLI Reference →](/guide/cli-commands)**

</div>

## Need Help?

- **[FAQ](/guide/faq)** - Common questions
- **[Troubleshooting](/guide/troubleshooting)** - Common issues
- **[GitHub Issues](https://github.com/rafbcampos/fluent-gen-ts/issues)** -
  Report bugs

<style scoped>
.next-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
</style>
