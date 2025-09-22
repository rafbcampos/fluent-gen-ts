---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Fluent Gen TS'
  text: 'Type-safe fluent builders'
  tagline:
    Generate fluent builders from TypeScript interfaces and types with zero
    runtime overhead
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/rafbcampos/fluent-gen-ts

features:
  - icon: 🔍
    title: Type Extraction
    details:
      Automatically extracts and resolves TypeScript types including generics,
      utility types, mapped types, and complex nested structures
  - icon: 🏗️
    title: Fluent Builders
    details:
      Generates type-safe fluent builder patterns with IntelliSense support and
      JSDoc preservation
  - icon: ⚡
    title: Zero Runtime
    details:
      All generation happens at build time. No runtime dependencies or overhead
      in your production code
  - icon: 🔌
    title: Plugin Architecture
    details:
      Extensible architecture with hooks for customizing generation behavior at
      multiple stages
  - icon: 🎯
    title: Production Ready
    details:
      Strict TypeScript, comprehensive error handling with Result types, and
      optimized for large codebases
  - icon: 🛠️
    title: CLI & API
    details:
      Use via command line for quick generation or integrate programmatically
      into your build pipeline
---

## Quick Example

Transform your TypeScript interfaces into fluent builders:

```typescript
// Your interface
interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  address: {
    street: string;
    city: string;
  };
}

// Generated builder usage
const user = userBuilder()
  .withId('user-123')
  .withName('John Doe')
  .withEmail('john@example.com')
  .withAge(30)
  .withAddress(
    addressBuilder()
      .withStreet('123 Main St')
      .withCity('San Francisco')
      .build(),
  )
  .build();

// The result is fully typed as User
const userData: User = user;
```

## Why Fluent Gen TS?

- **Type Safety First**: Full TypeScript support with strict mode and advanced
  type checking
- **Developer Experience**: IntelliSense, JSDoc comments, and type hints
  throughout
- **Complex Type Support**: Handles generics, utility types, conditional types,
  and circular references
- **Performance**: Optimized type resolution and generation for large codebases
- **Flexible Integration**: CLI for quick tasks, programmatic API for build
  tools, and plugin system for customization

## Installation

```bash
npm install -D fluent-gen-ts
# or
pnpm add -D fluent-gen-ts
# or
yarn add -D fluent-gen-ts
```

## Quick Start

### CLI Usage

```bash
# Initialize configuration with interactive setup (recommended)
npx fluent-gen-ts init

# Generate a single builder
npx fluent-gen-ts generate ./src/types.ts User

# Generate from configuration
npx fluent-gen-ts batch

# Scan and generate interactively
npx fluent-gen-ts scan "src/**/*.ts" --interactive
```

### Programmatic API

```typescript
import { FluentGen } from 'fluent-gen-ts';

const generator = new FluentGen({
  useDefaults: true,
  addComments: true,
});

// Generate builder code
const result = await generator.generateBuilder('./src/types.ts', 'User');

if (result.ok) {
  console.log(result.value); // Generated builder code
}
```

## Features

### 🎯 Smart Type Resolution

- Resolves complex TypeScript types including utility types (`Pick`, `Omit`,
  `Partial`, `Required`, `Readonly`)
- Handles conditional types and mapped types
- Supports template literal types
- Manages circular references automatically

### 🔧 Flexible Configuration

- Project-wide configuration with `.fluentgenrc.json`
- Per-generation options
- Custom context types for parent-child relationships
- Configurable code formatting

### 🚀 Advanced Patterns

- Nested builders for complex object hierarchies
- Generic type parameters with constraints
- Context passing between builders
- Custom default values

### 📦 Production Ready

- Result-based error handling (no exceptions)
- Clean, maintainable code architecture
- Extensive documentation and examples
- Active development and support

## Community

- [GitHub Issues](https://github.com/rafbcampos/fluent-gen-ts/issues) - Report
  bugs or request features
- [Discussions](https://github.com/rafbcampos/fluent-gen-ts/discussions) - Ask
  questions and share ideas
- [Contributing Guide](https://github.com/rafbcampos/fluent-gen-ts/blob/main/CONTRIBUTING.md) -
  Help improve Fluent Gen TS

## License

MIT © Rafael Campos
