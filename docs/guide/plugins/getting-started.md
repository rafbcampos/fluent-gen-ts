# Getting Started with Plugins

<!-- prettier-ignore -->
::: tip What You'll Learn

- Create your first plugin in 5 minutes
- Use ready-made plugin templates
- Configure and test plugins
- Understand plugin structure
  :::

## Your First Plugin

Let's create a simple validation plugin that adds email validation to all email
properties.

### Step 1: Create the Plugin File

Create `plugins/validation.ts`:

```typescript
import { createPlugin } from 'fluent-gen-ts';

const validationPlugin = createPlugin('email-validation', '1.0.0')
  .setDescription('Validates email fields automatically')

  // Add validation to email properties
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

export default validationPlugin;
```

### Step 2: Register the Plugin

Add to your `fluentgen.config.js`:

```javascript
export default {
  plugins: ['./plugins/validation.ts'],
  targets: [{ file: './src/types.ts', types: ['User'] }],
};
```

### Step 3: Generate Builders

```bash
npx fluent-gen-ts batch
```

### Step 4: Use the Enhanced Builder

```typescript
import { user } from './builders/user.builder.js';

// ✅ Valid - passes validation
const validUser = user().withEmail('user@example.com').build();

// ❌ Throws error - validation fails
const invalidUser = user()
  .withEmail('not-an-email') // Error: Invalid email format
  .build();
```

**Congratulations!** 🎉 You've created your first plugin that automatically
validates email fields across all builders.

## Plugin Templates

Use these templates as starting points for common scenarios.

### Template 1: Simple Validation

```typescript
import { createPlugin } from 'fluent-gen-ts';

const validationPlugin = createPlugin('validation', '1.0.0')
  .setDescription('Field validation plugin')

  .transformPropertyMethods(builder =>
    builder
      // Email validation
      .when(ctx => ctx.property.name === 'email')
      .setValidator(
        'if (value && !value.includes("@")) throw new Error("Invalid email")',
      )
      .done()

      // Age validation
      .when(ctx => ctx.property.name === 'age')
      .setValidator(
        'if (value !== undefined && (value < 0 || value > 150)) throw new Error("Invalid age")',
      )
      .done(),
  )

  .build();

export default validationPlugin;
```

### Template 2: Custom Methods

```typescript
import { createPlugin } from 'fluent-gen-ts';

const customMethodsPlugin = createPlugin('custom-methods', '1.0.0')
  .setDescription('Adds utility methods to builders')

  // Add withRandomId() method
  .addMethod(method =>
    method
      .name('withRandomId')
      .parameter('prefix', 'string', { defaultValue: '"item"' })
      .returns('this')
      .implementation(
        `
      const id = \`\${prefix}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      return this.withId(id);
    `,
      )
      .jsDoc('/**\\n * Generate and set a random ID\\n */'),
  )

  // Add withTimestamps() method
  .addMethod(method =>
    method
      .name('withTimestamps')
      .returns('this')
      .implementation(
        `
      const now = new Date();
      return this.withCreatedAt(now).withUpdatedAt(now);
    `,
      )
      .jsDoc('/**\\n * Set creation and update timestamps to now\\n */'),
  )

  .build();

export default customMethodsPlugin;
```

### Template 3: Type Transformation

```typescript
import { createPlugin, primitive } from 'fluent-gen-ts';

const typeTransformPlugin = createPlugin('type-transform', '1.0.0')
  .setDescription('Transforms property types')

  .transformPropertyMethods(builder =>
    builder
      // Accept string or number for IDs
      .when(ctx => ctx.property.name.endsWith('Id'))
      .setParameter('string | number')
      .setExtractor('String(value)')
      .done()

      // Accept string or Date for date fields
      .when(
        ctx =>
          ctx.property.name.endsWith('At') ||
          ctx.property.name.endsWith('Date'),
      )
      .setParameter('Date | string')
      .setExtractor('value instanceof Date ? value : new Date(value)')
      .done(),
  )

  .build();

export default typeTransformPlugin;
```

### Template 4: Testing Utilities

```typescript
import { createPlugin } from 'fluent-gen-ts';

const testingPlugin = createPlugin('testing-utils', '1.0.0')
  .setDescription('Testing helper methods')

  .requireImports(imports => imports.addExternal('faker', ['faker']))

  .addMethod(method =>
    method.name('withFakeData').returns('this').implementation(`
      return this
        .withId(faker.string.uuid())
        .withName(faker.person.fullName())
        .withEmail(faker.internet.email())
        .withCreatedAt(new Date());
    `),
  )

  .addMethod(method =>
    method
      .name('buildMany')
      .parameter('count', 'number', { defaultValue: '5' })
      .returns('T[]').implementation(`
      return Array.from({ length: count }, () =>
        this.withFakeData().build()
      );
    `),
  )

  .build();

export default testingPlugin;
```

### Template 5: Database Integration

```typescript
import { createPlugin } from 'fluent-gen-ts';

const databasePlugin = createPlugin('database', '1.0.0')
  .setDescription('Database integration helpers')

  .requireImports(imports => imports.addExternal('uuid', ['v4 as uuidv4']))

  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // Auto-generate UUID for id
      if (!this.has('id')) {
        this.set('id', uuidv4());
      }

      // Auto-set timestamps
      const now = new Date();
      if (!this.has('createdAt')) {
        this.set('createdAt', now);
      }
      this.set('updatedAt', now);
    `,
    ),
  )

  .build();

export default databasePlugin;
```

## Plugin Structure

Every plugin follows this structure:

```typescript
import { createPlugin } from 'fluent-gen-ts';

const myPlugin = createPlugin('plugin-name', '1.0.0')
  // 1. Metadata
  .setDescription('What this plugin does')

  // 2. Imports (optional)
  .requireImports(imports => imports
    .addExternal('package-name', ['export1', 'export2'])
    .addInternalTypes('../types.js', ['Type1'])
  )

  // 3. Property Transformations (optional)
  .transformPropertyMethods(builder => builder
    .when(ctx => /* condition */)
    .setParameter('new-type')
    .setExtractor('conversion-code')
    .setValidator('validation-code')
    .done()
  )

  // 4. Custom Methods (optional)
  .addMethod(method => method
    .name('methodName')
    .parameter('param', 'type')
    .returns('this')
    .implementation('method-body')
  )

  // 5. Build Method Transformation (optional)
  .transformBuildMethod(transform =>
    transform.insertBefore('marker', 'code-to-insert')
  )

  // 6. Build plugin
  .build();

export default myPlugin;
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

### Plugin Execution Order

Plugins execute in the order they're listed. Order matters when plugins modify
the same properties:

```javascript
export default {
  plugins: [
    './plugins/type-transform.ts', // Runs first
    './plugins/validation.ts', // Runs second
    './plugins/custom-methods.ts', // Runs third
  ],
};
```

## Testing Your Plugin

### Manual Testing

```bash
# Generate builders with your plugin
npx fluent-gen-ts batch

# Check the generated code
cat ./src/builders/user.builder.ts
```

### Unit Testing

```typescript
// plugins/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest';
import validationPlugin from '../validation.js';

describe('Validation Plugin', () => {
  it('should have correct metadata', () => {
    expect(validationPlugin.name).toBe('email-validation');
    expect(validationPlugin.version).toBe('1.0.0');
  });

  it('should export transformPropertyMethod', () => {
    expect(validationPlugin.transformPropertyMethod).toBeDefined();
  });
});
```

### Integration Testing

```typescript
// __tests__/plugin-integration.test.ts
import { user } from '../builders/user.builder.js';

describe('Email Validation Plugin', () => {
  it('should accept valid email', () => {
    expect(() => {
      user().withEmail('valid@example.com').build();
    }).not.toThrow();
  });

  it('should reject invalid email', () => {
    expect(() => {
      user().withEmail('invalid-email').build();
    }).toThrow('Invalid email format');
  });
});
```

## Common Patterns

### Pattern 1: Property Name Matching

```typescript
.transformPropertyMethods(builder => builder
  // Match exact name
  .when(ctx => ctx.property.name === 'email')

  // Match suffix
  .when(ctx => ctx.property.name.endsWith('Id'))

  // Match prefix
  .when(ctx => ctx.property.name.startsWith('is'))

  // Match pattern
  .when(ctx => /^[A-Z]/.test(ctx.property.name))
)
```

### Pattern 2: Type-Based Matching

```typescript
import { primitive, object } from 'fluent-gen-ts';

.transformPropertyMethods(builder => builder
  // Match primitive type
  .when(ctx => ctx.type.isPrimitive('string'))

  // Match object type
  .when(ctx => ctx.type.matches(object('User')))

  // Match array
  .when(ctx => ctx.type.isArray())

  // Combined conditions
  .when(ctx =>
    ctx.property.name === 'email' &&
    ctx.type.isPrimitive('string')
  )
)
```

### Pattern 3: Conditional Logic

```typescript
.addMethod(method => method
  .name('withConditionalValue')
  .parameter('condition', 'boolean')
  .parameter('value', 'T')
  .returns('this')
  .implementation(`
    if (condition) {
      return this.withSomeProperty(value);
    }
    return this;
  `)
)
```

## Troubleshooting

### Plugin Not Loading

**Problem:** Plugin doesn't seem to be applied.

**Solution:**

1. Check the plugin path in config is correct
2. Ensure plugin exports `default`
3. Verify plugin builds without errors
4. Check console output for errors

```bash
# Run with verbose output
npx fluent-gen-ts batch --verbose
```

### Type Errors in Generated Code

**Problem:** Generated builders have TypeScript errors.

**Solution:**

1. Check `setParameter()` returns valid TypeScript types
2. Ensure imported types exist
3. Verify `setExtractor()` code is syntactically correct

### Validation Not Working

**Problem:** Validation code doesn't execute.

**Solution:**

1. Ensure `.done()` is called after transformations
2. Check the `when()` condition matches your properties
3. Verify `setValidator()` code is correct

## Next Steps

<div class="next-steps">

### 📘 API Reference

Complete API documentation: **[API Reference →](/guide/plugins/api-reference)**

### 🔧 Advanced Examples

Explore more plugin patterns: **[Cookbook →](/guide/plugins/cookbook)**

### 📚 Ready-to-Use Plugins

Browse the cookbook: **[Cookbook →](/guide/plugins/cookbook)**

### ⚡ Critical Patterns

Learn best practices: **[Best Practices →](/guide/plugins/best-practices)**

</div>

## Related Resources

- [Plugin API Reference](/guide/plugins/api-reference) - Complete API
- [Core Concepts](/guide/core-concepts#plugin-architecture) - Architecture
  overview
- [Examples](/examples/) - Real-world examples

<style scoped>
.next-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
</style>
