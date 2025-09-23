---
layout: home

hero:
  name: 'fluent-gen-ts'
  text: 'Type-safe Fluent Builders for TypeScript'
  tagline:
    Transform your TypeScript interfaces into elegant, chainable builders with
    zero runtime dependencies
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/rafbcampos/fluent-gen-ts

features:
  - icon: 🔧
    title: Zero Dependencies
    details:
      Generated builders have no runtime dependencies. The code is
      self-contained and works in any TypeScript project.

  - icon: 🎯
    title: Type-Safe & IntelliSense-Friendly
    details:
      Full TypeScript support with complete type inference. Enjoy autocomplete
      and type checking at every step of the builder chain.

  - icon: 🚀
    title: Smart Defaults
    details:
      Automatically generates sensible defaults for required fields, ensuring
      your builders always produce valid objects.

  - icon: 🔄
    title: Nested Builder Support
    details:
      Compose complex objects with nested builders. Deferred builds enable
      context passing between parent and child builders.

  - icon: 🧩
    title: Plugin System
    details:
      Extend functionality with custom plugins for validation, custom methods,
      imports transformation, and more.

  - icon: ⚡
    title: CLI & Programmatic API
    details:
      Use the interactive CLI for quick setup or integrate directly into your
      build process with the programmatic API.
---

## Quick Example

Transform this interface:

```typescript
interface User {
  id: string;
  name: string;
  email?: string;
  role: 'admin' | 'user';
  isActive: boolean;
}
```

Into this fluent builder:

```typescript
const user = user()
  .withId('123')
  .withName('Alice')
  .withEmail('alice@example.com')
  .withRole('admin')
  .withIsActive(true)
  .build();
```

## Installation

```bash
npm install -D fluent-gen-ts
```

## Quick Start

### Interactive Setup

```bash
npx fluent-gen-ts init
```

The interactive CLI will guide you through:

- Scanning your TypeScript files
- Selecting interfaces to generate builders for
- Configuring output directory and naming conventions
- Setting up a configuration file

### Generate a Single Builder

```bash
npx fluent-gen-ts generate ./src/types.ts User --output ./src/builders/
```

### Batch Generation

```bash
npx fluent-gen-ts batch
```

## Why fluent-gen-ts?

### The Problem

Creating test data and complex object structures in TypeScript often leads to:

- Verbose object literals with repetitive property assignments
- Difficulty in creating variations of objects for testing
- No IDE support while building objects incrementally
- Manual maintenance of builder patterns

### The Solution

`fluent-gen-ts` automatically generates fluent builders that:

- Provide a chainable API for building objects step by step
- Offer full IntelliSense support at each step
- Generate valid objects with smart defaults
- Support complex scenarios like nested objects and arrays
- Require zero runtime dependencies

## Core Features

### 🎯 Complete Type Safety

Every generated builder maintains full type safety throughout the chain:

```typescript
const product = product()
  .withId('P001') // ✓ string
  .withPrice(99.99) // ✓ number
  .withInStock(true) // ✓ boolean
  .withCategories(['electronics', 'computers']) // ✓ string[]
  .build();
```

### 🔄 Nested Builders with Deferred Builds

Build complex nested structures with ease:

```typescript
const order = order()
  .withId('ORD-001')
  .withCustomer(
    customer().withName('John Doe').withAddress(
      address().withStreet('123 Main St').withCity('New York'),
      // No .build() needed - automatically handled!
    ),
  )
  .withItems([
    item().withName('Laptop').withPrice(999),
    item().withName('Mouse').withPrice(29),
  ])
  .build();
```

### 🧩 Extensible Plugin System

Create custom plugins to extend functionality:

```typescript
const validationPlugin: Plugin = {
  name: 'validation-plugin',
  version: '1.0.0',

  transformPropertyMethod(context) {
    if (context.property.name === 'email') {
      return ok({
        validate: `
          if (value && !value.includes('@')) {
            throw new Error('Invalid email format');
          }`,
      });
    }
    return ok({});
  },
};
```

### ⚙️ Flexible Generation Modes

#### Single Builder Generation

Generates self-contained builders with inlined utilities - perfect for
standalone use.

#### Batch Generation

Creates a shared `common.ts` file with utilities that all builders import -
ideal for generating multiple builders.

#### Custom Common File

Use `setup-common` to create your own customizable common utilities file.

## Learn More

- [Getting Started Guide](/guide/getting-started) - Set up your first builder
- [Core Concepts](/guide/core-concepts) - Understand the fundamentals
- [CLI Commands](/guide/cli-commands) - Master the command-line interface
- [Plugin System](/guide/plugins) - Extend with custom functionality
- [API Reference](/api/reference) - Complete API documentation
- [Examples](/examples) - Real-world usage patterns
