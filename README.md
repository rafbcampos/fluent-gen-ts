# fluent-gen-ts

[![CI](https://github.com/rafbcampos/fluent-gen-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/rafbcampos/fluent-gen-ts/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/rafbcampos/fluent-gen-ts/graph/badge.svg?token=PQ45UU94C1)](https://codecov.io/gh/rafbcampos/fluent-gen-ts)
[![npm version](https://badge.fury.io/js/fluent-gen-ts.svg)](https://www.npmjs.com/package/fluent-gen-ts)
[![Node.js Version](https://img.shields.io/node/v/fluent-gen-ts.svg)](https://nodejs.org/)

> **Generate type-safe fluent builders for TypeScript interfaces and types with
> zero runtime dependencies**

Transform your TypeScript interfaces into elegant, chainable builders that
provide full IntelliSense support and type safety at every step.

## ✨ Features

- **🎯 Complete Type Safety** - Full TypeScript support with type inference
- **🔧 Zero Runtime Dependencies** - Generated builders are completely
  self-contained
- **🚀 Smart Defaults** - Automatically generates sensible defaults for required
  fields
- **🔄 Nested Builder Support** - Seamless composition of complex objects with
  deferred builds
- **🧩 Sophisticated Plugin System** - Fluent API for creating powerful,
  type-safe plugins with advanced matching, deep type transformation, custom
  methods, and auxiliary data storage
- **🎨 Flexible Naming Strategies** - Configurable filename generation with
  predefined conventions or custom transform functions
- **⚡ CLI & Programmatic API** - Use via command line or integrate into your
  build process
- **📝 JSDoc Preservation** - Maintains your documentation and comments
- **🏗️ Advanced Build Transforms** - Insert custom logic before/after build with
  plugin system
- **📦 Monorepo Support** - Intelligent dependency resolution for pnpm, yarn,
  and npm workspaces

## 🚀 Quick Start

### Installation

```bash
npm install -D fluent-gen-ts
```

### Basic Usage

Given this TypeScript interface:

```typescript
interface User {
  id: string;
  name: string;
  email?: string;
  role: 'admin' | 'user';
  isActive: boolean;
}
```

Generate a fluent builder:

```bash
npx fluent-gen-ts generate ./types.ts User
```

Use the generated builder:

```typescript
import { user } from './user.builder.js';

const newUser = user()
  .withId('123')
  .withName('Alice')
  .withEmail('alice@example.com')
  .withRole('admin')
  .withIsActive(true)
  .build();
```

### Interactive Setup

Get started quickly with the interactive CLI:

```bash
npx fluent-gen-ts init
```

This will guide you through:

- 📁 Scanning your TypeScript files
- 🎯 Selecting interfaces to generate builders for
- ⚙️ Configuring output and naming conventions
- 📦 Setting up monorepo configuration (if needed)
- 🔧 Setting up your configuration file

### 📦 Monorepo Support

fluent-gen-ts provides intelligent dependency resolution for monorepo setups:

```javascript
// fluent-gen.config.js
module.exports = {
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto', // or 'workspace-root' | 'hoisted' | 'local-only'
    workspaceRoot: './path/to/workspace/root', // optional, for workspace-root strategy
    customPaths: ['./custom/deps'], // optional, for custom dependency locations
  },
  // ... other config
};
```

**Supported Package Managers:**

- **pnpm workspaces** - Automatically resolves from `.pnpm` store and symlinks
- **yarn workspaces** - Finds hoisted dependencies and workspace root packages
- **npm workspaces** - Standard node_modules resolution with workspace support

**Resolution Strategies:**

- `auto` - Try multiple strategies automatically (recommended)
- `workspace-root` - Look only in workspace root node_modules
- `hoisted` - Walk up directory tree for hoisted dependencies
- `local-only` - Only check local node_modules directories

## 🏗️ Core Concepts

### Fluent Builder Pattern

Every generated builder provides a chainable API:

```typescript
const product = product()
  .withId('P001')
  .withName('Laptop')
  .withPrice(999.99)
  .withInStock(true)
  .withCategories(['electronics', 'computers'])
  .build();
```

### Smart Defaults

Builders automatically provide sensible defaults:

```typescript
const user = user().withName('Alice').build();
// Result: { id: "", name: "Alice", role: "user", isActive: false }
```

### Nested Builders with Deferred Builds

Build complex nested structures effortlessly:

```typescript
const order = order()
  .withCustomer(
    customer().withName('John').withEmail('john@example.com'),
    // No .build() needed - automatically handled!
  )
  .withItems([
    item().withName('Laptop').withPrice(999),
    item().withName('Mouse').withPrice(29),
  ])
  .build();
```

### Conditional Logic

Use built-in utilities for conditional property setting:

```typescript
const user = user()
  .withName('Bob')
  .if(u => !u.has('email'), 'email', 'default@example.com')
  .ifElse(u => u.peek('email')?.includes('admin'), 'role', 'admin', 'user')
  .build();
```

## 📚 Generation Modes

### Single Mode (Default)

Perfect for individual builders or maximum portability:

- ✅ Self-contained with inlined utilities
- ✅ No external dependencies
- ✅ Easy to share across projects

```bash
npx fluent-gen-ts generate ./types.ts User
```

### Batch Mode

Ideal for generating multiple builders:

- ✅ Shared `common.ts` file with utilities
- ✅ DRY - utilities defined once
- ✅ Consistent across all builders

```javascript
// fluentgen.config.js
export default {
  targets: [
    { file: './src/user.ts', types: ['User', 'UserProfile'] },
    { file: './src/product.ts', types: ['Product', 'Category'] },
  ],
  output: { dir: './src/builders', mode: 'batch' },
};
```

```bash
npx fluent-gen-ts batch
```

### Custom Common File

Create your own customizable utilities:

```bash
npx fluent-gen-ts setup-common --output ./src/common.ts
```

## 🧩 Powerful Plugin System

Extend fluent-gen-ts with a sophisticated plugin system featuring a fluent API,
advanced type matching, custom naming strategies, and auxiliary data storage:

```typescript
// my-plugin.ts
import { createPlugin, primitive, object, union } from 'fluent-gen-ts';

const plugin = createPlugin('comprehensive-plugin', '1.0.0')
  .setDescription('Advanced transformations and custom methods')

  // Advanced type matching and transformations
  .transformPropertyMethods(builder =>
    builder
      // Handle primitive string types with custom logic
      .when(ctx => ctx.type.isPrimitive('string'))
      .setParameter('string | TaggedTemplateValue<string>')
      .setExtractor('String(value)')
      .setValidator(
        `
      if (value && value.length === 0) {
        throw new Error('String cannot be empty');
      }
    `,
      )
      .done()

      // Handle object types (e.g., AssetWrapper)
      .when(ctx => ctx.type.matches(object('AssetWrapper')))
      .setParameter('Asset | FluentBuilder<Asset>')
      .setExtractor('{ asset: value }')
      .done()

      // Handle union types containing strings
      .when(ctx => ctx.type.matches(union().containing(primitive('string'))))
      .setParameter('string | TaggedTemplateValue<string>')
      .setExtractor('String(value)')
      .done(),
  )

  // Add custom methods with auxiliary data storage
  .addMethod(method =>
    method
      .name('withTemplate')
      .parameter('template', '(ctx: BaseBuildContext) => string')
      .returns('this')
      .implementation(
        `
      // Store template function for later processing
      return this.pushAuxiliary('templates', template);
    `,
      )
      .jsDoc('/**\\n * Add a template function processed during build\\n */'),
  )

  .addMethod(method =>
    method
      .name('withRandomId')
      .parameter('prefix', 'string', { defaultValue: '"item"' })
      .returns('this').implementation(`
      const id = \`\${prefix}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      return this.withId(id);
    `),
  )

  // Transform build method with template processing
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // Process stored templates
      const templates = this.getAuxiliaryArray('templates');
      if (templates.length > 0 && context) {
        for (const template of templates) {
          try {
            const result = template(context);
            console.log('Template result:', result);
          } catch (error) {
            console.warn('Template execution failed:', error);
          }
        }
      }
    `,
    ),
  )

  .build();

export default plugin;
```

### Advanced Configuration

```json
{
  "generator": {
    "naming": {
      // Predefined conventions: camelCase, kebab-case, snake_case, PascalCase
      "convention": "camelCase",

      // OR custom transform function for complete control
      "transform": "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()"
    }
  },
  "plugins": ["./my-plugin.ts"],
  "targets": [
    {
      "file": "src/types.ts",
      "types": ["ActionAsset"],
      "outputFile": "./src/builders/{type}.builder.ts"
    }
  ]
}
```

### Deep Type Transformation

Transform types recursively at any depth with powerful utilities:

```typescript
import {
  createPlugin,
  primitive,
  transformTypeDeep,
  containsTypeDeep,
  TypeDeepTransformer,
} from 'fluent-gen-ts';

const deepTransformPlugin = createPlugin('deep-transform', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      // Use fluent transformer API
      .when(ctx => ctx.type.containsDeep(primitive('string')))
      .setParameter(ctx =>
        ctx.type
          .transformDeep()
          .replace(primitive('string'), 'string | { value: string }')
          .replace(primitive('number'), 'number | { value: number }')
          .toString(),
      )
      .done()

      // Or use low-level API for advanced control
      .when(ctx => ctx.type.containsDeep(primitive('Date')))
      .setParameter(ctx =>
        transformTypeDeep(ctx.propertyType, {
          onPrimitive: type => {
            if (primitive('Date').match(type)) {
              return 'Date | string | number';
            }
            return null;
          },
        }),
      )
      .done(),
  )
  .build();
```

**Transformation Examples:**

- `Array<string>` → `Array<string | { value: string }>`
- `{ name: string, tags: Array<string> }` →
  `{ name: string | { value: string }; tags: Array<string | { value: string }> }`
- `{ data: { nested: { value: string } } }` →
  `{ data: { nested: { value: string | { value: string } } } }`

**Key Plugin Features:**

- 🎯 **Fluent Plugin Builder API** - Chainable, type-safe plugin creation
- 🔍 **Advanced Type Matching** - Match primitives, objects, unions, arrays,
  generics
- 🔄 **Deep Type Transformation** - Recursively transform types at any depth
- 📦 **Auxiliary Data Storage** - Store templates, functions, and custom data
- 🏗️ **Build Method Transformation** - Insert custom logic before/after build
- 📝 **Custom Method Generation** - Add domain-specific methods to builders
- 🔧 **Smart Import Management** - Automatic handling of internal/external
  imports
- 🎨 **Flexible Naming Strategies** - Custom filename transformations

## 🎯 Advanced TypeScript Support

fluent-gen-ts handles complex TypeScript patterns:

### Generic Types

```typescript
interface Container<T> {
  value: T;
  metadata: Record<string, unknown>;
}

// Generated: container<T>() builder
```

### Utility Types

```typescript
type PublicUser = Pick<User, 'id' | 'name'>;
type UpdateUser = Partial<Omit<User, 'id'>>;

// Fully supported with correct property methods
```

### Union and Intersection Types

```typescript
interface Config {
  mode: 'development' | 'production';
  ssl: boolean | { cert: string; key: string };
}

// Generates type-safe methods for all variations
```

## 📋 CLI Commands

| Command                  | Description                            |
| ------------------------ | -------------------------------------- |
| `init`                   | Interactive setup wizard               |
| `generate <file> <type>` | Generate single builder                |
| `batch`                  | Generate multiple builders from config |
| `scan <pattern>`         | Scan and display found types           |
| `setup-common`           | Create customizable common utilities   |

See the
[CLI documentation](https://rafbcampos.github.io/fluent-gen-ts/guide/cli-commands)
for detailed options.

## ⚙️ Configuration

### Configuration File

fluent-gen-ts supports multiple configuration file formats:

- `fluentgen.config.js` or `.fluentgenrc.js` (ES modules or CommonJS)
- `.fluentgenrc.json`, `.fluentgenrc.yaml`, `.fluentgenrc.yml` (JSON/YAML)
- `package.json` (under `"fluentgen"` key)

**ES Modules (recommended):**

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  // Input files and types
  targets: [
    { file: './src/models/user.ts', types: ['User', 'UserProfile'] },
    { file: './src/models/product.ts', types: ['Product', 'Category'] },
  ],

  // Output configuration (optional, used mainly in batch mode)
  output: {
    dir: './src/builders',
    mode: 'batch', // or 'single'
  },

  // Generator options
  generator: {
    useDefaults: true, // Generate smart defaults
    addComments: true, // Include JSDoc comments

    // Advanced naming configuration
    naming: {
      convention: 'camelCase', // camelCase, kebab-case, snake_case, PascalCase
      suffix: 'builder',

      // OR custom transform function for complete control
      transform: '(typeName) => typeName.replace(/DTO$/, "").toLowerCase()',
    },
  },

  // TypeScript configuration
  tsConfigPath: './tsconfig.json',

  // Plugins
  plugins: ['./plugins/validation.js', './plugins/custom-methods.js'],
};
```

**CommonJS:**

```javascript
/** @type {import('fluent-gen-ts').Config} */
module.exports = {
  targets: [{ file: './src/models/user.ts', types: ['User', 'UserProfile'] }],
  generator: {
    naming: {
      convention: 'camelCase',
      suffix: 'builder',
    },
  },
  plugins: ['./plugins/validation.js'],
};
```

### Package Scripts

```json
{
  "scripts": {
    "generate:builders": "fluent-gen-ts batch",
    "prebuild": "npm run generate:builders"
  }
}
```

## 🧪 Testing

Generated builders are perfect for creating test data:

```typescript
// Test factories
const testUser = user()
  .withId('test-123')
  .withName('Test User')
  .withEmail('test@example.com')
  .withRole('user')
  .withIsActive(true)
  .build();

// Property-based testing
import { fc } from 'fast-check';

const arbitraryUser = fc
  .record({
    name: fc.string(),
    email: fc.emailAddress(),
    role: fc.constantFrom('admin', 'user'),
  })
  .map(data => user(data).build());
```

## 🚀 Real-World Examples

### API Response Builder

```typescript
const successResponse = apiResponse()
  .withData(
    paginatedResult().withItems([user1, user2, user3]).withPagination({
      page: 1,
      total: 150,
      hasNext: true,
    }),
  )
  .withStatus(200)
  .withMessage('Success')
  .build();
```

### Configuration Builder

```typescript
const config = appConfig()
  .withEnv('production')
  .withDatabase(
    databaseConfig()
      .withHost('prod-db.company.com')
      .withSsl(true)
      .withPool({ min: 5, max: 50 }),
  )
  .withCache(cacheConfig().withType('redis').withTtl(3600))
  .build();
```

## 📖 Documentation

- **[Getting Started](https://rafbcampos.github.io/fluent-gen-ts/guide/getting-started)** -
  Your first builder in less than a minute
- **[Core Concepts](https://rafbcampos.github.io/fluent-gen-ts/guide/core-concepts)** -
  Understanding the fundamentals
- **[CLI Commands](https://rafbcampos.github.io/fluent-gen-ts/guide/cli-commands)** -
  Complete CLI reference
- **[Plugin System](https://rafbcampos.github.io/fluent-gen-ts/guide/plugins)** -
  Extending with plugins
- **[Advanced Usage](https://rafbcampos.github.io/fluent-gen-ts/guide/advanced-usage)** -
  Complex scenarios and patterns
- **[API Reference](https://rafbcampos.github.io/fluent-gen-ts/api/reference)** -
  Complete API documentation
- **[Examples](https://rafbcampos.github.io/fluent-gen-ts/examples/)** - Use
  patterns

## 🤝 Why fluent-gen-ts?

### The Problem

Creating complex object structures in TypeScript often leads to:

- 📝 Verbose object literals with repetitive property assignments
- 🔍 No IDE support while building objects incrementally
- 🧪 Difficulty creating test data variations
- 🔄 Manual maintenance of builder patterns

### The Solution

fluent-gen-ts automatically generates builders that:

- ⛓️ Provide chainable APIs for step-by-step object construction
- 💡 Offer full IntelliSense support at every step
- ✅ Generate valid objects with smart defaults
- 🏗️ Support complex nested objects and arrays
- 🚫 Require zero runtime dependencies

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/rafbcampos/fluent-gen-ts.git
cd fluent-gen-ts

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run only unit tests
pnpm test:unit

# Run only E2E tests
pnpm test:e2e
```

## 🙏 Acknowledgments

- [ts-morph](https://github.com/dsherret/ts-morph) - TypeScript compiler API
  wrapper
- [TypeScript](https://www.typescriptlang.org/) - The amazing type system that
  makes this possible

---

<div align="center">

**[Documentation](https://rafbcampos.github.io/fluent-gen-ts/) •
[Examples](https://rafbcampos.github.io/fluent-gen-ts/examples/) •
[GitHub](https://github.com/rafbcampos/fluent-gen-ts) •
[NPM](https://www.npmjs.com/package/fluent-gen-ts)**

Made with ❤️ by [Rafael Campos](https://github.com/rafbcampos)

</div>
