# Core Concepts

Understanding these core concepts will help you get the most out of
fluent-gen-ts.

## The Fluent Builder Pattern

The fluent builder pattern provides a chainable API for constructing objects
step by step. Each method returns the builder instance, allowing method calls to
be chained together.

```typescript
// Traditional object creation
const user = {
  id: '123',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin',
  isActive: true,
};

// With fluent builder
const user = user()
  .withId('123')
  .withName('Alice')
  .withEmail('alice@example.com')
  .withRole('admin')
  .withIsActive(true)
  .build();
```

## Builder Generation Process

fluent-gen-ts follows a three-step process:

### 1. Type Extraction

- Parses your TypeScript files using ts-morph
- Resolves type definitions including:
  - Interfaces and type aliases
  - Generic types with constraints
  - Utility types (Pick, Omit, Partial, etc.)
  - Mapped and conditional types
  - Union and intersection types

### 2. Code Generation

- Creates a builder class extending `FluentBuilderBase`
- Generates `with*` methods for each property
- Preserves JSDoc comments and type information
- Handles optional properties correctly
- Creates smart defaults for required fields

### 3. Output Writing

- In **single mode**: Inlines all utilities in the builder file
- In **batch mode**: Creates a shared `common.ts` file
- Maintains proper import statements
- Ensures ESM compatibility with `.js` extensions

## Smart Defaults

fluent-gen-ts automatically generates sensible defaults for required properties:

| Type        | Default Value       |
| ----------- | ------------------- |
| `string`    | `""` (empty string) |
| `number`    | `0`                 |
| `boolean`   | `false`             |
| `array`     | `[]`                |
| `object`    | `{}`                |
| union types | first literal value |
| `Date`      | `new Date()`        |

```typescript
interface Product {
  id: string; // default: ""
  price: number; // default: 0
  inStock: boolean; // default: false
  categories: string[]; // default: []
  status: 'draft' | 'published'; // default: 'draft'
}
```

## Nested Builders and Deferred Builds

One of the most powerful features is the ability to compose builders without
calling `.build()` on nested builders.

### How It Works

When you pass a builder (instead of a built object) as a property value, the
parent builder automatically calls `.build()` on it with the appropriate
context.

```typescript
const order = order()
  .withCustomer(
    customer().withName('John').withEmail('john@example.com'),
    // No .build() here!
  )
  .withShippingAddress(
    address().withStreet('123 Main St').withCity('New York'),
    // No .build() here either!
  )
  .build(); // Only call build once at the top level
```

### Context Passing

When builders are nested, context information flows from parent to child:

```typescript
interface BaseBuildContext {
  parentId?: string;
  parameterName?: string;
  index?: number;
  [key: string]: unknown;
}

// Parent passes context to children
const parent = parentBuilder()
  .withChild(childBuilder())
  .build({ parentId: 'parent-123' });

// Child receives context with:
// - parentId: 'parent-123'
// - parameterName: 'child'
```

This enables powerful patterns like:

- Generating deterministic IDs based on parent context
- Conditional property values based on parent state
- Maintaining relationships between nested objects

## Builder Utilities

All builders have access to these utility methods:

### Conditional Setting

```typescript
// if: Set property conditionally
const user = user()
  .if(b => !b.has('email'), 'email', 'default@example.com')
  .build();

// ifElse: Choose between two values
const product = product()
  .ifElse(b => b.peek('price') > 100, 'category', 'premium', 'standard')
  .build();
```

### Builder State Inspection

```typescript
const builder = user().withName('Alice');

// Check if a property is set
if (builder.has('email')) {
  // ...
}

// Peek at current value
const currentName = builder.peek('name'); // 'Alice'
```

## Generation Modes Explained

### Single Generation Mode

Best for standalone builders or when you need maximum portability:

```typescript
// All utilities are inlined in the generated file
const FLUENT_BUILDER_SYMBOL = Symbol.for('fluent-builder');
interface BaseBuildContext {
  /* ... */
}
interface FluentBuilder<T> {
  /* ... */
}
class FluentBuilderBase<T> {
  /* ... */
}

export class UserBuilder extends FluentBuilderBase<User> {
  // ... builder implementation
}
```

**Pros:**

- Self-contained, no dependencies
- Can be copied to other projects
- Works immediately without setup

**Cons:**

- Duplicated code when generating multiple builders
- Larger file size per builder

### Batch Generation Mode

Best when generating multiple builders:

```typescript
// common.ts - shared utilities
export const FLUENT_BUILDER_SYMBOL = Symbol.for('fluent-builder');
export interface BaseBuildContext {
  /* ... */
}
export interface FluentBuilder<T> {
  /* ... */
}
export abstract class FluentBuilderBase<T> {
  /* ... */
}

// user.builder.ts - imports from common
import { FluentBuilderBase, BaseBuildContext } from './common.js';

export class UserBuilder extends FluentBuilderBase<User> {
  // ... builder implementation
}
```

**Pros:**

- DRY - utilities defined once
- Smaller individual builder files
- Easier to maintain and update utilities

**Cons:**

- Requires the common.ts file
- Builders are not standalone

### Custom Common File

You can create your own common file with additional utilities:

```bash
npx fluent-gen-ts setup-common --output ./src/builders/common.ts
```

Then customize it:

```typescript
// Add custom utilities
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

// Extend BaseBuildContext
export interface CustomBuildContext extends BaseBuildContext {
  tenantId?: string;
  userId?: string;
}

// Use in your builders
class UserBuilder extends FluentBuilderBase<User, CustomBuildContext> {
  build(context?: CustomBuildContext): User {
    const id = generateId('user');
    return this.buildWithDefaults({ id }, context);
  }
}
```

## Type Resolution

fluent-gen-ts handles complex TypeScript types:

### Generic Types

```typescript
interface Container<T> {
  value: T;
  metadata: Record<string, unknown>;
}

// Generated builder
export function container<T>(): ContainerBuilder<T>;
```

### Utility Types

```typescript
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type PublicUser = Pick<User, 'id' | 'name'>;
type InternalUser = Omit<User, 'password'>;
```

### Mapped Types

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};
```

### Conditional Types

```typescript
type IsArray<T> = T extends Array<infer U> ? U : never;
type NonNullable<T> = T extends null | undefined ? never : T;
```

## Plugin Architecture

Plugins can hook into various stages of the generation process:

### Generation Lifecycle

1. **beforeParse** - Before parsing the TypeScript file
2. **afterParse** - After parsing, before type resolution
3. **beforeResolve** - Before resolving the type
4. **afterResolve** - After type resolution
5. **transformType** - Transform the resolved type info
6. **transformProperty** - Transform individual properties
7. **beforeGenerate** - Before generating code
8. **transformPropertyMethod** - Customize property methods
9. **addCustomMethods** - Add custom methods to builders
10. **transformBuildMethod** - Customize the build method
11. **afterGenerate** - After code generation
12. **transformImports** - Modify import statements

### Plugin Context

Each hook receives context information:

```typescript
interface PropertyMethodContext {
  property: PropertyInfo;
  propertyType: TypeInfo;
  builderName: string;
  typeName: string;

  // Helper methods
  isType(kind: TypeKind): boolean;
  isArrayType(): boolean;
  isUnionType(): boolean;
  isPrimitiveType(name?: string): boolean;
}
```

## Result Type Pattern

fluent-gen-ts uses the Result pattern instead of throwing exceptions:

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

// Usage
const result = await gen.generateBuilder(file, type);
if (result.ok) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error.message);
}
```

This provides:

- Explicit error handling
- Type-safe error propagation
- Better composability
- No unexpected exceptions

## Performance Considerations

### Caching

fluent-gen-ts includes built-in caching:

- Type resolution results are cached
- Generator state is cached during batch generation
- Clear cache when needed with `gen.clearCache()`

### Max Depth

To prevent infinite recursion with circular references:

```typescript
const gen = new FluentGen({
  maxDepth: 10, // Default max recursion depth
});
```

### Large Codebases

For large codebases:

- Use glob patterns to process files selectively
- Leverage batch generation for better performance
- Consider splitting generation into multiple configs
- Use the cache between generation runs

## Next Steps

- Learn about [Advanced Usage](./advanced-usage.md) for complex scenarios
- Explore the [Plugin System](./plugins.md) to extend functionality
- Check out [CLI Commands](./cli-commands.md) for all options
- See practical [Examples](/examples/) of real-world usage
