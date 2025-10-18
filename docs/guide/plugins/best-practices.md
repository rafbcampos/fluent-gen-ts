# Plugin Best Practices

<!-- prettier-ignore -->
::: tip What You'll Learn

- **CRITICAL:** Rule ordering (prevents bugs!)
- Testing strategies for plugins
- Performance optimization
- Error handling patterns
- Plugin distribution
  :::

## 🚨 CRITICAL: Rule Ordering Matters {#rule-ordering}

<!-- prettier-ignore -->
::: danger Rule Execution Order
**The first matching rule wins!** Plugin transformation rules execute **top-to-bottom**, and execution stops at the **first match**.

This is the **#1 source of plugin bugs**. Always put **specific rules before generic rules**.
:::

### The Problem

When using deep type matching with `containsDeep()`, generic rules can match
before specific ones:

```typescript
// ❌ WRONG - Generic rule matches first, blocks specific rule
.transformPropertyMethods(builder => builder
  // This generic rule matches ANY type containing strings (including AssetWrapper)
  .when(ctx => ctx.type.containsDeep(primitive('string')))
  .setParameter(ctx => ctx.type.transformDeep()
    .replace(primitive('string'), 'string | TaggedValue<string>')
    .toString()
  )
  .done()

  // This specific rule NEVER executes because AssetWrapper contains strings!
  .when(ctx => ctx.type.containsDeep(object('AssetWrapper')))
  .setParameter(ctx => ctx.originalTypeString.replace(/AssetWrapper/g, 'Asset'))
  .done()
)
```

**Why this fails:**

- `AssetWrapper` contains string properties deep in its structure
- The generic `containsDeep(primitive('string'))` rule matches first
- Plugin stops evaluating rules after first match
- Your `AssetWrapper` transformation never runs

### The Solution

**Always place specific rules before generic ones:**

```typescript
// ✅ CORRECT - Specific rules first, generic rules last
.transformPropertyMethods(builder => builder
  // 1. SPECIFIC transformations FIRST
  .when(ctx => ctx.type.containsDeep(object('AssetWrapper')))
  .setParameter(ctx => ctx.originalTypeString.replace(/AssetWrapper/g, 'Asset'))
  .done()

  .when(ctx => ctx.type.containsDeep(array().of(object('User'))))
  .setParameter(ctx => 'Array<EnhancedUser>')
  .done()

  // 2. GENERIC transformations LAST
  .when(ctx => ctx.type.containsDeep(primitive('string')))
  .setParameter(ctx => ctx.type.transformDeep()
    .replace(primitive('string'), 'string | TaggedValue<string>')
    .toString()
  )
  .done()

  .when(ctx => ctx.type.containsDeep(primitive('number')))
  .setParameter(ctx => ctx.type.transformDeep()
    .replace(primitive('number'), 'number | TaggedValue<number>')
    .toString()
  )
  .done()
)
```

### Rule Ordering Hierarchy

Follow this order for best results:

```typescript
.transformPropertyMethods(builder => builder
  // 1. Property-specific (most specific)
  .when(ctx => ctx.property.name === 'email')
  .done()

  // 2. Type-specific
  .when(ctx => ctx.type.matches(object('AssetWrapper')))
  .done()

  // 3. Pattern-specific
  .when(ctx => ctx.property.name.endsWith('Asset'))
  .done()

  // 4. Generic type checks
  .when(ctx => ctx.type.containsDeep(primitive('string')))
  .done()

  // 5. Catch-all (most generic)
  .when(ctx => ctx.type.isPrimitive())
  .done()
)
```

### Quick Reference Table

| Specificity               | Example                                                           | Order |
| ------------------------- | ----------------------------------------------------------------- | ----- |
| **Exact property + type** | `ctx.property.name === 'email' && ctx.type.isPrimitive('string')` | 1st   |
| **Exact type**            | `ctx.type.matches(object('AssetWrapper'))`                        | 2nd   |
| **Property pattern**      | `ctx.property.name.endsWith('Id')`                                | 3rd   |
| **Deep type match**       | `ctx.type.containsDeep(object('User'))`                           | 4th   |
| **Generic deep match**    | `ctx.type.containsDeep(primitive())`                              | 5th   |
| **Broad type check**      | `ctx.type.isPrimitive()`                                          | Last  |

### Debugging Rule Order

If transformations aren't working:

```typescript
.when(ctx => {
  const matches = ctx.type.containsDeep(primitive('string'));
  console.log(`[Rule 1] Property ${ctx.property.name} matches:`, matches);
  return matches;
})
```

## Testing Strategies

### Unit Testing Plugins

Test plugin metadata and structure:

```typescript
// plugins/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest';
import validationPlugin from '../validation.js';

describe('Validation Plugin', () => {
  it('should have correct metadata', () => {
    expect(validationPlugin.name).toBe('validation');
    expect(validationPlugin.version).toBe('1.0.0');
    expect(validationPlugin.description).toBe('Validates email fields');
  });

  it('should export transformPropertyMethod hook', () => {
    expect(validationPlugin.transformPropertyMethod).toBeTypeOf('function');
  });

  it('should export required imports', () => {
    expect(validationPlugin.imports).toBeDefined();
    expect(validationPlugin.imports?.external).toContainEqual(
      expect.objectContaining({ packageName: 'validator' }),
    );
  });
});
```

### Integration Testing

Test the generated builders:

```typescript
// __tests__/validation-plugin.integration.test.ts
import { describe, it, expect } from 'vitest';
import { user } from '../builders/user.builder.js';

describe('Email Validation Plugin Integration', () => {
  it('should validate valid email', () => {
    expect(() => {
      user().withEmail('valid@example.com').build();
    }).not.toThrow();
  });

  it('should reject invalid email', () => {
    expect(() => {
      user().withEmail('invalid').build();
    }).toThrow('Invalid email format');
  });

  it('should allow optional email to be undefined', () => {
    expect(() => {
      user().build();
    }).not.toThrow();
  });
});
```

### Testing Custom Methods

```typescript
describe('Custom Methods', () => {
  it('should add withRandomId method', () => {
    const builder = user();
    expect(builder.withRandomId).toBeTypeOf('function');
  });

  it('should generate unique IDs', () => {
    const id1 = user().withRandomId().build().id;
    const id2 = user().withRandomId().build().id;
    expect(id1).not.toBe(id2);
  });

  it('should accept custom prefix', () => {
    const user1 = user().withRandomId('admin').build();
    expect(user1.id).toMatch(/^admin-/);
  });
});
```

### Testing Build Transformations

```typescript
describe('Build Method Transformations', () => {
  it('should auto-generate UUID if ID not provided', () => {
    const user1 = user().withName('Test').build();
    expect(user1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('should not override explicitly set ID', () => {
    const user1 = user().withId('custom-id').build();
    expect(user1.id).toBe('custom-id');
  });
});
```

## Error Handling

### Graceful Degradation

Always handle errors gracefully in plugins:

```typescript
.transformPropertyMethods(builder => builder
  .when(ctx => {
    try {
      return complexCondition(ctx);
    } catch (error) {
      console.warn('Plugin condition evaluation failed:', error);
      return false; // Fail safely
    }
  })
  .setValidator(`
    try {
      validateValue(value);
    } catch (error) {
      throw new ValidationError(\`Validation failed for \${property.name}: \${error.message}\`);
    }
  `)
  .done()
)
```

### Validation Best Practices

```typescript
.setValidator(`
  // 1. Check for undefined/null first
  if (value === undefined || value === null) {
    if (isRequired) {
      throw new Error('Value is required');
    }
    return; // Allow undefined for optional fields
  }

  // 2. Perform validation
  if (!isValid(value)) {
    throw new Error(\`Invalid value: \${value}\`);
  }

  // 3. Additional checks
  if (hasConflict(value)) {
    console.warn('Potential conflict detected');
  }
`)
```

### Type Safety

Ensure generated code is type-safe:

```typescript
.setParameter(ctx => {
  // Always return valid TypeScript type strings
  const baseType = ctx.originalTypeString;

  // Wrap complex types in parentheses
  if (baseType.includes('|') || baseType.includes('&')) {
    return `(${baseType}) | CustomType`;
  }

  return `${baseType} | CustomType`;
})
```

## Performance Optimization

### Avoid Expensive Operations

```typescript
// ❌ BAD - Regex on every property
.when(ctx => /^very-complex-regex.*pattern$/.test(ctx.property.name))

// ✅ GOOD - Simple checks first, complex checks only when needed
.when(ctx => {
  // Fast check first
  if (!ctx.property.name.startsWith('user')) return false;

  // Expensive check only if needed
  return /^user[A-Z]/.test(ctx.property.name);
})
```

### Cache Computations

```typescript
const validationRuleCache = new Map();

.setValidator(ctx => {
  const cacheKey = `${ctx.property.name}:${ctx.type.kind}`;

  if (validationRuleCache.has(cacheKey)) {
    return validationRuleCache.get(cacheKey);
  }

  const rule = generateValidationRule(ctx);
  validationRuleCache.set(cacheKey, rule);
  return rule;
})
```

### Minimize Transformations

```typescript
// ❌ BAD - Multiple unnecessary transformations
.when(ctx => ctx.type.isPrimitive('string'))
.setParameter('string | CustomString')
.setExtractor('processString(value)')
.setValidator('validateString(value)')
.done()

.when(ctx => ctx.type.isPrimitive('string')) // Matches again!
.setExtractor('normalizeString(value)')       // Overwrites previous
.done()

// ✅ GOOD - Single comprehensive transformation
.when(ctx => ctx.type.isPrimitive('string'))
.setParameter('string | CustomString')
.setExtractor('normalizeString(processString(value))')
.setValidator('validateString(value)')
.done()
```

## TypeScript Integration

### Full Type Safety

```typescript
import type {
  Plugin,
  PropertyMethodContext,
  CustomMethod,
} from 'fluent-gen-ts';

const plugin = createPlugin('typed-plugin', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when((ctx: PropertyMethodContext) => {
        // Full type inference
        return ctx.property.name === 'email' && ctx.type.isPrimitive('string');
      })
      .setValidator('/* validation */')
      .done(),
  )
  .build();
```

### Type Guards

```typescript
import { TypeKind } from 'fluent-gen-ts';

.when(ctx => {
  // Type guards for runtime safety
  if (ctx.propertyType.kind !== TypeKind.Primitive) {
    return false;
  }

  return ctx.propertyType.name === 'string';
})
```

## Plugin Distribution

### Package Structure

```json
{
  "name": "@company/fluent-gen-validation",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "peerDependencies": {
    "fluent-gen-ts": ">=0.1.0"
  },
  "dependencies": {
    "validator": "^13.11.0"
  },
  "files": ["dist/", "README.md"],
  "keywords": ["fluent-gen-ts", "plugin", "validation"]
}
```

### Documentation

Include comprehensive README:

```markdown
# @company/fluent-gen-validation

Email and URL validation plugin for fluent-gen-ts.

## Installation

\`\`\`bash npm install -D @company/fluent-gen-validation \`\`\`

## Usage

\`\`\`javascript // fluentgen.config.js export default { plugins:
['@company/fluent-gen-validation'], targets: [/* ... */] }; \`\`\`

## Features

- ✅ Email validation
- ✅ URL validation
- ✅ Custom error messages

## Configuration

Supports custom configuration...
```

### Versioning

Follow semantic versioning:

- **MAJOR** - Breaking changes to plugin API
- **MINOR** - New features, backward compatible
- **PATCH** - Bug fixes

## Common Pitfalls

### Pitfall 1: Not Calling `.done()`

```typescript
// ❌ WRONG - Missing .done()
.when(ctx => ctx.property.name === 'email')
.setValidator('validation code')
// Next when() starts NEW rule!
.when(ctx => ctx.property.name === 'age')

// ✅ CORRECT
.when(ctx => ctx.property.name === 'email')
.setValidator('validation code')
.done() // Completes this rule
.when(ctx => ctx.property.name === 'age')
```

### Pitfall 2: Incorrect Import Paths

```typescript
// ❌ WRONG - Forgetting .js extension
.requireImports(imports =>
  imports.addInternalTypes('../types', ['User'])
)

// ✅ CORRECT - Include .js for ESM
.requireImports(imports =>
  imports.addInternalTypes('../types.js', ['User'])
)
```

### Pitfall 3: Side Effects in Conditions

```typescript
// ❌ WRONG - Side effects in when()
let counter = 0;
.when(ctx => {
  counter++; // Don't do this!
  return ctx.property.name === 'email';
})

// ✅ CORRECT - Pure functions only
.when(ctx => ctx.property.name === 'email')
```

### Pitfall 4: Assuming Builder State

```typescript
// ❌ WRONG - Can't access builder state during generation
.addMethod(method => method
  .name('withCustomEmail')
  .implementation(`
    // this.peek() doesn't exist at generation time!
    if (this.peek('name') === 'admin') {
      return this.withEmail('admin@company.com');
    }
  `)
)

// ✅ CORRECT - Runtime checks only
.addMethod(method => method
  .name('withCustomEmail')
  .parameter('name', 'string')
  .implementation(`
    // Use parameters instead
    if (name === 'admin') {
      return this.withEmail('admin@company.com');
    }
    return this;
  `)
)
```

## Quick Checklist

Before publishing a plugin:

- [ ] ✅ Specific rules before generic rules
- [ ] ✅ All `.when()` blocks end with `.done()`
- [ ] ✅ Import paths include `.js` extension (ESM)
- [ ] ✅ Error handling in all conditions
- [ ] ✅ Unit tests for plugin structure
- [ ] ✅ Integration tests for generated code
- [ ] ✅ Type safety verified
- [ ] ✅ Documentation complete
- [ ] ✅ README with examples
- [ ] ✅ Semantic versioning
- [ ] ✅ Peer dependency on fluent-gen-ts

## Next Steps

<div class="next-steps">

### 📚 Cookbook

Ready-to-use examples: **[Cookbook →](/guide/plugins/cookbook)**

### 🔍 API Reference

Complete API documentation: **[API Reference →](/guide/plugins/api-reference)**

### 🚀 Getting Started

Step-by-step guide: **[Getting Started →](/guide/plugins/getting-started)**

### 📖 Plugin System

Full overview: **[Plugin System →](/guide/plugins/)**

</div>

## Related Resources

- [Plugin Cookbook](/guide/plugins/cookbook)
- [API Reference](/guide/plugins/api-reference)
- [Getting Started](/guide/plugins/getting-started)

<style scoped>
.next-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
</style>
