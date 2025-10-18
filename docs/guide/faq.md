# Frequently Asked Questions

## General

### What is fluent-gen-ts?

A code generator that creates type-safe fluent builders from TypeScript
interfaces and types, eliminating boilerplate and reducing testing complexity.

### Why use builders instead of plain objects?

**Benefits:**

- **Type safety** - Catch errors at compile time
- **Discoverability** - IDE autocomplete shows available methods
- **Testability** - Easier to create test data
- **Maintainability** - Interface changes automatically update builders
- **Readability** - Fluent API is self-documenting

### What's the difference between `generate` and `batch` commands?

**`generate`** - Single builder, one-off usage:

```bash
npx fluent-gen-ts generate ./types.ts User
```

**`batch`** - Multiple builders from config file:

```bash
npx fluent-gen-ts batch  # Uses fluentgen.config.js
```

Use `batch` for projects with multiple types. Use `generate` for quick
prototyping or single builders.

### Do I commit generated files to Git?

**Recommended: Yes**

**Pros:**

- Better IDE support (no generation needed)
- Faster CI builds
- Historical tracking of changes
- Works without fluent-gen-ts installed

**Cons:**

- Larger repository size
- Merge conflicts (rare)

**Alternative: No (regenerate on demand)**

Add to `.gitignore`:

```txt
/src/builders/
```

Add to `package.json`:

```json
{
  "scripts": {
    "prebuild": "fluent-gen-ts batch",
    "pretest": "fluent-gen-ts batch"
  }
}
```

### Does fluent-gen-ts have runtime dependencies?

**No.** Generated builders are standalone TypeScript code with zero runtime
dependencies. You can:

- Copy generated files to other projects
- Remove fluent-gen-ts after generation
- Use builders without installing anything

The tool is only needed during code generation.

## Usage

### How do I handle nested objects?

Nested builders are automatically generated:

```typescript
interface User {
  name: string;
  address: Address;
}

interface Address {
  street: string;
  city: string;
}

// Usage - nested builders are auto-imported
const user1 = user()
  .withName('Alice')
  .withAddress(address().withStreet('123 Main St').withCity('NYC'))
  .build();
```

### Can I extend generated builders?

Yes, but **plugins are recommended** for reusable logic:

**Option 1: Plugins (Recommended)**

```typescript
const plugin = createPlugin('my-plugin', '1.0.0')
  .addMethod(method =>
    method
      .name('asAdmin')
      .returns('this')
      .implementation('return this.withRole("admin")'),
  )
  .build();
```

**Option 2: Manual Extension (One-off)**

```typescript
class CustomUserBuilder extends UserBuilder {
  asAdmin(): this {
    return this.withRole('admin').withIsActive(true);
  }
}
```

### How do I handle optional vs required fields?

Optional fields in TypeScript remain optional in builders:

```typescript
interface User {
  id: string; // Required
  email?: string; // Optional
}

// Both valid:
user().withId('123').build();
user().withId('123').withEmail('test@example.com').build();
```

### Can I set multiple properties at once?

Yes, pass initial data to the builder:

```typescript
const baseUser = {
  createdAt: new Date(),
  isActive: true,
};

const user1 = user(baseUser).withId('123').withName('Alice').build();
```

### How do I handle arrays?

Arrays work automatically:

```typescript
interface Team {
  members: User[];
}

// Usage
const team = team()
  .withMembers([
    user().withName('Alice').build(),
    user().withName('Bob').build(),
  ])
  .build();
```

### How do I handle union types?

Union types accept any of the union members:

```typescript
interface Config {
  value: string | number;
}

// Both valid:
config().withValue('text').build();
config().withValue(123).build();
```

### Can I use conditional logic in builders?

Yes, use `.if()` or chain conditionally:

```typescript
// Option 1: .if() method
user()
  .withName('Alice')
  .if(someCondition, 'email', 'alice@example.com')
  .build();

// Option 2: Conditional chaining
let builder = user().withName('Alice');
if (someCondition) {
  builder = builder.withEmail('alice@example.com');
}
const result = builder.build();
```

## Configuration

### How are builders organized in the output directory?

Generated builders are created as separate files in the configured output
directory:

```
src/builders/
  ├── user.builder.ts
  ├── product.builder.ts
  ├── order.builder.ts
  └── common.ts
```

Configure the output directory in `fluentgen.config.js`:

```javascript
{
  generator: {
    outputDir: './src/builders';
  }
}
```

### How do I customize file naming?

Use naming strategies:

```javascript
{
  generator: {
    naming: {
      convention: 'kebab-case',  // user-builder.ts
      suffix: 'builder'
    }
  }
}
```

Available conventions:

- `camelCase` - userBuilder.ts
- `kebab-case` - user-builder.ts
- `snake_case` - user_builder.ts
- `PascalCase` - UserBuilder.ts

### How do monorepo configurations work?

fluent-gen-ts auto-detects pnpm, yarn, and npm workspaces:

```javascript
{
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto' // Recommended
  }
}
```

See [Monorepo Configuration](/guide/advanced-usage#monorepo-configuration) for
details.

### How do I configure TypeScript settings?

Point to your tsconfig:

```javascript
{
  tsConfigPath: './tsconfig.build.json',
}
```

Or via CLI:

```bash
npx fluent-gen-ts generate ./types.ts User --tsconfig ./tsconfig.build.json
```

### Can I disable defaults or comments?

Yes, via config or CLI:

```javascript
// Config
{
  generator: {
    useDefaults: false,  // No default values
    addComments: false   // No JSDoc comments
  }
}
```

```bash
# CLI
npx fluent-gen-ts generate ./types.ts User \
  --use-defaults false \
  --add-comments false
```

## Plugins

### When should I use plugins vs manual extension?

**Use Plugins When:**

- Logic applies to multiple builders
- You want to share across projects
- Need automatic application on all types
- Validation, transformation, or import management

**Use Manual Extension When:**

- One-off customization
- Specific to single builder
- Quick prototype

### Why isn't my plugin working?

Common issues:

1. **Missing `.done()`**

   ```typescript
   // ❌ Wrong
   .when(ctx => true)
   .setValidator('code')
   .when(ctx => true) // New rule, forgot .done()

   // ✅ Correct
   .when(ctx => true)
   .setValidator('code')
   .done() // Complete rule
   .when(ctx => true)
   ```

2. **Rule order** - Specific before generic

   ```typescript
   // ❌ Wrong - generic first
   .when(ctx => ctx.type.isPrimitive())      // Matches everything
   .when(ctx => ctx.property.name === 'id')  // Never reached

   // ✅ Correct - specific first
   .when(ctx => ctx.property.name === 'id')
   .when(ctx => ctx.type.isPrimitive())
   ```

3. **Incorrect import paths** - Must include `.js` for ESM

   ```typescript
   // ❌ Wrong
   .addInternalTypes('../types', ['User'])

   // ✅ Correct
   .addInternalTypes('../types.js', ['User'])
   ```

See [Best Practices](/guide/plugins/best-practices) for more.

### Can plugins access runtime values?

**No.** Plugins work at **code generation time**, not runtime.

```typescript
// ❌ Wrong - Can't access builder state during generation
.addMethod(method => method
  .implementation(`
    if (this.peek('name') === 'admin') { ... }
  `)
)

// ✅ Correct - Use parameters
.addMethod(method => method
  .parameter('name', 'string')
  .implementation(`
    if (name === 'admin') { ... }
  `)
)
```

### How do I share plugins across projects?

Publish as npm package:

```typescript
// my-plugin/index.ts
import { createPlugin } from 'fluent-gen-ts';

export default createPlugin('my-plugin', '1.0.0').addMethod(/* ... */).build();
```

```javascript
// Consumer's fluentgen.config.js
export default {
  plugins: ['my-plugin'], // From node_modules
};
```

### Can I apply plugins to specific types only?

Yes, use `.when()` conditions:

```typescript
.transformPropertyMethods(builder =>
  builder
    .when(ctx => ctx.typeName === 'User') // Only User type
    .setValidator('/* validation */')
    .done(),
);
```

## Performance

### Are builders slower than plain objects?

Minimal overhead. Builders add ~1-5% overhead compared to object literals. In
practice, this is negligible.

**Benchmarks:**

- Plain object: ~0.01ms per creation
- Builder: ~0.011ms per creation
- Difference: Unmeasurable in real apps

### Should I use builders in production code?

**Yes**, builders are production-ready:

- Type-safe
- No runtime dependencies
- Minimal overhead
- Used in enterprise applications

### How do I optimize large object trees?

Use partial initialization:

```typescript
// Instead of building everything:
const full = order()
  .withCustomer(customer().with...().with...())
  .withItems([item().with...(), ...])
  .build();

// Build parts separately:
const customer1 = customer().with...().build();
const items = [...]; // Reuse items

const order1 = order()
  .withCustomer(customer1)
  .withItems(items)
  .build();
```

### What's the bundle size impact?

Generated builders add ~2-5KB per builder (minified + gzipped). For a typical
project:

- **Single builder**: ~2KB
- **10 builders**: ~8KB (shared utilities amortize cost)
- **100 builders**: ~50KB

Use tree-shaking to eliminate unused builders in production bundles.

## Troubleshooting

### "Cannot find module" errors

Ensure ESM imports use `.js` extension:

```typescript
// ❌ Wrong
import { user } from './builders/user.builder';

// ✅ Correct
import { user } from './builders/user.builder.js';
```

### Generated code has TypeScript errors

Common causes:

1. **Circular dependencies** - Use type imports
2. **Missing dependencies** - Install required packages
3. **Wrong tsconfig** - Ensure `moduleResolution: "bundler"` or `"node16"`

Run with verbose output:

```bash
npx fluent-gen-ts batch --verbose
```

### Types are not found during generation

Check:

1. File path is correct
2. Type is exported (`export interface User` not `interface User`)
3. tsconfig.json is valid

Use scan to verify:

```bash
npx fluent-gen-ts scan "src/**/*.ts"
```

### Builder methods are missing for some properties

Common causes:

1. **Circular type references** - May require manual intervention
2. **Depth limit** - Increase `--max-depth` (default: 10)
3. **Complex mapped types** - Simplify type definition

Generate with higher depth:

```bash
npx fluent-gen-ts generate ./types.ts User --max-depth 15
```

### How do I debug generation issues?

Use verbose mode:

```bash
npx fluent-gen-ts batch --verbose
```

Or dry-run to preview:

```bash
npx fluent-gen-ts batch --dry-run
```

### Builders are out of sync with types

Regenerate after type changes:

```bash
npm run generate
```

Automate in CI:

```yaml
- run: npx fluent-gen-ts batch
- run: git diff --exit-code src/builders || exit 1
```

## Integration

### How do I integrate with testing frameworks?

```typescript
// Vitest/Jest
import { user } from '../builders/user.builder.js';

test('should create user', () => {
  const testUser = user().withId('test-id').withName('Test').build();

  expect(testUser.id).toBe('test-id');
});
```

### Can I use with Prisma/TypeORM/Drizzle?

Yes! Generate builders from your schema types:

**Prisma:**

```typescript
import type { User } from '@prisma/client';
// Generate builder for Prisma types
```

**TypeORM:**

```typescript
import { User } from './entities/user.entity.ts';
// Generate builder for entity
```

### Does it work with React/Vue/Angular?

Yes! Builders are framework-agnostic. Use them anywhere:

```typescript
// React
const [user, setUser] = useState(user().withName('Alice').build());

// Vue
const user = ref(user().withName('Bob').build());
```

### Can I use with GraphQL schemas?

Yes! Generate builders from GraphQL-generated TypeScript types:

```typescript
import type { User } from './__generated__/graphql.js';
// Generate builder for GraphQL type
```

Works with graphql-codegen, GraphQL Code Generator, and similar tools.

### How do I migrate existing tests to builders?

Incrementally replace object literals:

```typescript
// Before
const user = {
  id: '123',
  name: 'Alice',
  email: 'alice@example.com',
};

// After
const user = user()
  .withId('123')
  .withName('Alice')
  .withEmail('alice@example.com')
  .build();
```

Or use partial initialization:

```typescript
const user = user({
  id: '123',
  name: 'Alice',
  email: 'alice@example.com',
}).build();
```

## Still Have Questions?

- **[Troubleshooting Guide](/guide/troubleshooting)** - Common issues
- **[GitHub Discussions](https://github.com/rafbcampos/fluent-gen-ts/discussions)** -
  Ask the community
- **[GitHub Issues](https://github.com/rafbcampos/fluent-gen-ts/issues)** -
  Report bugs
