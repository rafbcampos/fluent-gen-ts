---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Fluent Gen"
  text: "Type-safe fluent builders"
  tagline: Generate fluent builders from TypeScript interfaces with zero runtime overhead
  image:
    src: /logo.svg
    alt: Fluent Gen
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/rafbcampos/fluent-gen

features:
  - icon: 🔍
    title: Type Extraction
    details: Automatically extracts and resolves TypeScript types including generics, utility types, and complex nested structures
  - icon: 🏗️
    title: Fluent Builders
    details: Generates type-safe fluent builder patterns with IntelliSense support and JSDoc preservation
  - icon: ⚡
    title: Zero Runtime
    details: All generation happens at build time. No runtime dependencies or overhead in your production code
  - icon: 🔌
    title: Plugin Architecture
    details: Extensible microkernel design with 11 different hook types for customizing generation behavior
  - icon: 🎯
    title: Production Ready
    details: Strict TypeScript, comprehensive error handling with Result types, and extensive caching for performance
  - icon: 🛠️
    title: CLI & API
    details: Use via command line for quick generation or integrate programmatically into your build pipeline
---

## Quick Example

Transform your TypeScript interfaces into fluent builders:

```typescript
// Your interface
interface User {
  id: string;
  name: string;
  age?: number;
  address: {
    street: string;
    city: string;
  };
}

// Generated builder usage
const user = userBuilder()
  .withId("123")
  .withName("John Doe")
  .withAge(30)
  .withAddress(
    addressBuilder()
      .withStreet("123 Main St")
      .withCity("Anytown")
  );

// Build the final object
const userInstance: User = user();
```

## Why Fluent Gen?

- **Type Safety First**: Full TypeScript support with strict mode and advanced type checking
- **Developer Experience**: IntelliSense, JSDoc comments, and type hints throughout
- **Complex Type Support**: Handles generics, utility types, conditional types, and circular references
- **Performance**: Extensive caching and optimized type resolution for large codebases
- **Flexible Integration**: CLI for quick tasks, programmatic API for build tools, and plugin system for customization

## Installation

```bash
npm install -D fluent-gen
# or
pnpm add -D fluent-gen
# or
yarn add -D fluent-gen
```

## Quick Start

### CLI Usage

```bash
# Generate a single builder
npx fluent-gen generate ./src/types.ts User

# Batch generation from config
npx fluent-gen batch

# Scan and generate from pattern
npx fluent-gen scan "src/**/*.ts"
```

### Programmatic API

```typescript
import { FluentGen } from 'fluent-gen';

const generator = new FluentGen({
  useDefaults: true,
  addComments: true
});

// Generate builder code
const result = await generator.generateBuilder(
  './src/types.ts',
  'User'
);

if (result.ok) {
  console.log(result.value); // Generated builder code
}
```

## Features

### 🎯 Smart Type Resolution
- Resolves complex TypeScript types including utility types (`Pick`, `Omit`, `Partial`)
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
- Deferred building with parent context passing
- Custom default values and transformations

### 📦 Production Ready
- Result-based error handling (no exceptions)
- Comprehensive test coverage (90%+ threshold)
- Clean, maintainable code architecture
- Extensive documentation and examples

## Community

- [GitHub Issues](https://github.com/rafbcampos/fluent-gen/issues) - Report bugs or request features
- [Discussions](https://github.com/rafbcampos/fluent-gen/discussions) - Ask questions and share ideas
- [Contributing Guide](https://github.com/rafbcampos/fluent-gen/blob/main/CONTRIBUTING.md) - Help improve Fluent Gen

## License

MIT © Rafael Campos