# Plugin System

The plugin system allows you to extend fluent-gen-ts with custom functionality,
validation, transformations, and custom methods. Create powerful, reusable
plugins that transform how builders are generated.

## Why Use Plugins?

Plugins solve the problem of repetitive manual builder customization. Instead of
extending every generated builder individually, plugins apply transformations
**during generation** automatically.

**Without Plugins:**

```typescript
// Manual approach - repetitive for every builder
class UserBuilder extends GeneratedUserBuilder {
  withValidatedEmail(email: string): this {
    if (!isEmail(email)) throw new Error('Invalid email');
    return this.withEmail(email);
  }
}
```

**With Plugins:**

```typescript
// Automatic, reusable, type-safe
const validationPlugin = createPlugin('validation', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when(ctx => ctx.property.name === 'email')
      .setValidator('if (!isEmail(value)) throw new Error("Invalid email")')
      .done(),
  )
  .build();

// Applied to ALL builders automatically!
```

## Quick Start

Create your first plugin in under a minute:

```typescript
// my-plugin.ts
import { createPlugin } from 'fluent-gen-ts';

const plugin = createPlugin('my-awesome-plugin', '1.0.0')
  .setDescription('Adds email validation')

  .transformPropertyMethods(builder =>
    builder
      .when(ctx => ctx.property.name === 'email')
      .setValidator(
        `
        if (value && !value.includes('@')) {
          throw new Error('Invalid email format');
        }
      `,
      )
      .done(),
  )

  .build();

export default plugin;
```

Add to your configuration:

```javascript
// fluentgen.config.js
export default {
  plugins: ['./my-plugin.ts'],
  targets: [{ file: 'src/types.ts', types: ['User'] }],
};
```

Run generation:

```bash
npx fluent-gen-ts batch
```

Now all email properties are automatically validated!

## When to Use Plugins

### ✅ Perfect For:

- **Validation** - Email, URL, phone number validation across all builders
- **Type Transformations** - Accept `string | Date` for date fields,
  auto-convert IDs
- **Custom Methods** - Add `.withFakeData()`, `.asAdmin()`, `.withTimestamps()`
- **Import Management** - Automatically add required dependencies
- **Build Hooks** - Insert logic before/after object creation
- **Testing Utilities** - Add `.buildMany()`, `.asTestDouble()` methods

### ❌ Not Needed For:

- **One-off customization** - Just extend the builder manually
- **Simple property defaults** - Use builder's initial values
- **Runtime behavior** - Plugins work at **generation time** only

## Core Capabilities

### 1. Property Method Transformations

Modify how `withProperty()` methods work:

```typescript
.transformPropertyMethods(builder =>
  builder
    .when(ctx => ctx.property.name === 'age')
    .setParameter('number | string')      // Accept string too
    .setExtractor('Number(value)')         // Convert to number
    .setValidator('if (value < 0) throw new Error("Age must be positive")')
    .done()
)
```

### 2. Custom Methods

Add new methods to builders:

```typescript
.addMethod(method =>
  method
    .name('withTimestamps')
    .returns('this')
    .implementation(`
      return this
        .withCreatedAt(new Date())
        .withUpdatedAt(new Date());
    `)
)
```

### 3. Build Hooks

Insert logic before/after build:

```typescript
.transformBuildMethod(transform =>
  transform.insertBefore('return this.buildWithDefaults', `
    // Auto-generate ID if missing
    if (!this.has('id')) {
      this.set('id', generateUUID());
    }
  `)
)
```

### 4. Type Matching

Match types with powerful matchers:

```typescript
import { primitive, object, array, union } from 'fluent-gen-ts';

.when(ctx => ctx.type.isPrimitive('string'))
.when(ctx => ctx.type.matches(object('User')))
.when(ctx => ctx.type.matches(array().of(primitive('string'))))
.when(ctx => ctx.type.matches(union().containing(primitive('null'))))
```

### 5. Deep Type Transformations

Transform types recursively at any depth:

```typescript
.when(ctx => ctx.type.containsDeep(primitive('string')))
.setParameter(ctx =>
  ctx.type
    .transformDeep()
    .replace(primitive('string'), 'string | TaggedValue<string>')
    .toString()
)
```

## Plugin Examples

### Email Validation

```typescript
const emailValidation = createPlugin('email-validation', '1.0.0')
  .requireImports(imports => imports.addExternal('validator', ['isEmail']))
  .transformPropertyMethods(builder =>
    builder
      .when(ctx => ctx.property.name === 'email')
      .setValidator(
        'if (value && !isEmail(value)) throw new Error("Invalid email")',
      )
      .done(),
  )
  .build();
```

### Testing Helper

```typescript
const testingPlugin = createPlugin('testing', '1.0.0')
  .requireImports(imports => imports.addExternal('faker', ['faker']))
  .addMethod(method =>
    method.name('withFakeData').returns('this').implementation(`
        if (this.has('email')) this.withEmail(faker.internet.email());
        if (this.has('name')) this.withName(faker.person.fullName());
        return this;
      `),
  )
  .build();
```

### Auto UUID

```typescript
const autoUUID = createPlugin('auto-uuid', '1.0.0')
  .requireImports(imports => imports.addExternal('uuid', ['v4 as uuidv4']))
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      if (!this.has('id')) {
        this.set('id', uuidv4());
      }
    `,
    ),
  )
  .build();
```

## Configuration

### Single Plugin

```javascript
// fluentgen.config.js
export default {
  plugins: ['./plugins/validation.ts'],
  targets: [{ file: './src/types.ts', types: ['User'] }],
};
```

### Multiple Plugins

```javascript
export default {
  plugins: [
    './plugins/validation.ts',
    './plugins/testing.ts',
    './plugins/database.ts',
  ],
  targets: [{ file: './src/types.ts', types: ['User', 'Product'] }],
};
```

**Note:** Plugins execute in order. Order matters when plugins modify the same
properties!

## Learn More

<div class="vp-doc">

### 🚀 Getting Started

**Step-by-step tutorial** - Create your first plugin with detailed explanations

[Get Started →](/guide/plugins/getting-started)

### 📖 Plugin System Overview

**Comprehensive guide** - Architecture, capabilities, and when to use plugins

[Read Overview →](/guide/plugins/)

### 🔍 API Reference

**Quick lookup** - All plugin API methods, type matchers, and context objects

[API Reference →](/guide/plugins/api-reference)

### 📚 Cookbook

**20+ Ready-to-Use Plugins** - Copy-paste solutions for validation, testing,
database, API transforms

[Browse Recipes →](/guide/plugins/cookbook)

### ⚡ Best Practices

**Critical patterns** - Rule ordering, error handling, testing, and common
pitfalls

[Best Practices →](/guide/plugins/best-practices)

</div>

## Related Documentation

- [Advanced Usage](/guide/advanced-usage) - Complex scenarios and patterns
- [CLI Commands](/guide/cli-commands) - Command-line plugin configuration
- [Configuration](/guide/configuration) - Config file setup
- [Examples](/examples/) - Real-world usage examples

---

The plugin system is designed to be both powerful and approachable. Start with
simple transformations and gradually build up to complex, feature-rich plugins
that can be shared across teams and projects.
