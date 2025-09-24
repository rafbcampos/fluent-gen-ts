# Plugin System

The plugin system allows you to extend fluent-gen-ts with custom functionality,
validation, transformations, custom methods, and advanced naming strategies.
Create powerful, reusable plugins that can transform how builders are generated.

## Quick Start

Create your first plugin in under a minute:

```typescript
// my-plugin.ts
import { createPlugin } from 'fluent-gen-ts';

const plugin = createPlugin('my-awesome-plugin', '1.0.0')
  .setDescription('Adds custom validation and methods')

  // Transform property methods
  .transformPropertyMethods(builder =>
    builder
      .when(ctx => ctx.property.name === 'email')
      .setParameter('string')
      .setExtractor('String(value)')
      .setValidator(
        `
      if (value && !value.includes('@')) {
        throw new Error('Invalid email format');
      }
    `,
      )
      .done(),
  )

  // Add custom methods
  .addMethod(method =>
    method
      .name('withRandomId')
      .param('prefix', 'string', { defaultValue: '"user"' })
      .returns('this')
      .implementation(
        `
      const id = \`\${prefix}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
      return this.withId(id);
    `,
      )
      .jsDoc(
        '/**\\n * Generates and sets a random ID\\n * @param prefix - ID prefix (default: "user")\\n */',
      ),
  )

  .build();

export default plugin;
```

Add to your configuration:

```json
{
  "plugins": ["./my-plugin.ts"],
  "targets": [{ "file": "src/types.ts", "types": ["User"] }]
}
```

## Fluent Plugin Builder API

The fluent plugin builder provides a chainable, type-safe way to create plugins:

### Basic Plugin Structure

```typescript
import { createPlugin, primitive, object, union } from 'fluent-gen-ts';

const plugin = createPlugin('comprehensive-plugin', '1.0.0')
  .setDescription('A comprehensive plugin example')

  // Configure imports
  .requireImports(imports =>
    imports
      .addInternalTypes('../types.js', ['CustomType', 'ValidationRule'])
      .addExternal('lodash', ['isEmail', 'isEmpty'])
      .addExternalDefault('moment', 'moment'),
  )

  // Transform property methods with powerful matching
  .transformPropertyMethods(builder =>
    builder
      // Handle primitive types
      .when(ctx => ctx.type.isPrimitive('string'))
      .setParameter('string | CustomString')
      .setExtractor('normalizeString(value)')
      .setValidator('validateString(value)')
      .done()

      // Handle complex object types
      .when(ctx => ctx.type.matches(object('Address')))
      .setParameter('Address | FluentBuilder<Address>')
      .setExtractor('resolveAddress(value)')
      .done()

      // Handle union types
      .when(ctx => ctx.type.matches(union().containing(primitive('string'))))
      .setParameter('string | number')
      .setExtractor('String(value)')
      .done(),
  )

  // Add multiple custom methods
  .addMethod(method =>
    method.name('withValidatedEmail').param('email', 'string').returns('this')
      .implementation(`
      if (!isEmail(email)) {
        throw new Error('Invalid email format');
      }
      return this.withEmail(email);
    `),
  )

  .addMethod(method =>
    method.name('withTimestamps').returns('this').implementation(`
      const now = new Date();
      return this.withCreatedAt(now).withUpdatedAt(now);
    `),
  )

  // Transform build method
  .transformBuildMethod(transform =>
    transform
      .insertBefore(
        'return this.buildWithDefaults',
        `
      // Auto-generate ID if not provided
      if (!this.has('id')) {
        this.set('id', generateId());
      }

      // Validate required fields
      this.validateRequiredFields();
    `,
      )
      .insertAfter(
        'return this.buildWithDefaults',
        `
      // Post-build validation
      this.validateBuiltObject(result);
    `,
      ),
  )

  .build();
```

### Type Matching System

The plugin system provides powerful type matching capabilities:

```typescript
.transformPropertyMethods(builder => builder
  // Primitive type matching
  .when(ctx => ctx.type.isPrimitive('string'))
  .when(ctx => ctx.type.isPrimitive('number'))
  .when(ctx => ctx.type.isPrimitive('boolean'))

  // Object type matching
  .when(ctx => ctx.type.matches(object('User')))
  .when(ctx => ctx.type.matches(object().withProperty('email', primitive('string'))))

  // Union type matching
  .when(ctx => ctx.type.matches(union().containing(primitive('string'))))
  .when(ctx => ctx.type.matches(union(['admin', 'user', 'guest'])))

  // Array type matching
  .when(ctx => ctx.type.matches(array(primitive('string'))))
  .when(ctx => ctx.type.matches(array(object('Item'))))

  // Generic type matching
  .when(ctx => ctx.type.matches(generic('Promise', [primitive('string')])))
  .when(ctx => ctx.type.matches(generic('Array', [object('User')])))

  // Complex conditional matching
  .when(ctx =>
    ctx.property.name === 'email' &&
    ctx.type.isPrimitive('string') &&
    ctx.builderName === 'UserBuilder'
  )

  // Property name patterns
  .when(ctx => ctx.property.name.endsWith('Id'))
  .when(ctx => ctx.property.name.startsWith('is'))
  .when(ctx => /^[A-Z]/.test(ctx.property.name))
)
```

### Import Management

Plugins can intelligently manage imports:

```typescript
.requireImports(imports => imports
  // Internal type imports (relative paths)
  .addInternalTypes('../types.js', ['CustomType', 'ValidationRule'])
  .addInternalTypes('./utils.js', ['helper', 'validator'])

  // External library imports
  .addExternal('lodash', ['isEmail', 'isEmpty', 'isString'])
  .addExternalDefault('moment', 'moment')
  .addExternal('uuid', ['v4 as generateId'])

  // External dependencies
  .addExternalDefault('axios', 'axios')
  .addExternal('zod', ['z'])
)
```

### Auxiliary Data Storage

Plugins can store and retrieve auxiliary data for advanced functionality:

```typescript
// Store templates and deferred functions
.addMethod(method => method
  .name('withTemplate')
  .param('template', '(ctx: BaseBuildContext) => string')
  .returns('this')
  .implementation(`
    // Store template function in auxiliary data
    return this.pushAuxiliary('templates', template);
  `)
)

// Process auxiliary data during build
.transformBuildMethod(transform => transform
  .insertBefore('return this.buildWithDefaults', `
    // Process stored templates
    const templates = this.getAuxiliaryArray('templates');
    if (templates.length > 0 && context) {
      for (const template of templates) {
        try {
          const result = template(context);
          // Use template result
          this.processTemplateResult(result);
        } catch (error) {
          console.warn('Template execution failed:', error);
        }
      }
    }
  `)
)
```

## Advanced Plugin Examples

### Comprehensive Validation Plugin

```typescript
import { createPlugin, primitive, object, array } from 'fluent-gen-ts';

const validationPlugin = createPlugin('advanced-validation', '1.0.0')
  .setDescription('Advanced validation with custom rules and error messages')

  .requireImports(imports =>
    imports
      .addExternalLibrary('validator', ['isEmail', 'isURL', 'isLength'])
      .addInternalTypes('./validation-rules.js', ['ValidationRule']),
  )

  .transformPropertyMethods(builder =>
    builder
      // Email validation
      .when(
        ctx =>
          ctx.property.name === 'email' || ctx.property.name.endsWith('Email'),
      )
      .setValidator(
        `
      if (value && !isEmail(value)) {
        throw new ValidationError(\`Invalid email format for \${property.name}\`, {
          field: '${ctx.property.name}',
          value,
          rule: 'email'
        });
      }
    `,
      )
      .done()

      // URL validation
      .when(ctx => ctx.property.name.endsWith('Url'))
      .setValidator(
        `
      if (value && !isURL(value)) {
        throw new ValidationError('Invalid URL format', {
          field: '${ctx.property.name}',
          value,
          rule: 'url'
        });
      }
    `,
      )
      .done()

      // String length validation
      .when(ctx => ctx.type.isPrimitive('string'))
      .setValidator(
        `
      if (value && !isLength(value, { min: 1, max: 255 })) {
        throw new ValidationError('String length must be between 1-255 characters', {
          field: '${ctx.property.name}',
          value,
          rule: 'length'
        });
      }
    `,
      )
      .done()

      // Array validation
      .when(ctx => ctx.type.isArray())
      .setValidator(
        `
      if (value && !Array.isArray(value)) {
        throw new ValidationError('Expected array value', {
          field: '${ctx.property.name}',
          value,
          rule: 'array'
        });
      }
      if (value && value.length === 0) {
        console.warn(\`Empty array provided for \${property.name}\`);
      }
    `,
      )
      .done()

      // Numeric range validation
      .when(
        ctx =>
          ctx.type.isPrimitive('number') &&
          (ctx.property.name === 'age' || ctx.property.name === 'price'),
      )
      .setValidator(
        `
      const min = ${ctx.property.name === 'age' ? '0' : '0.01'};
      const max = ${ctx.property.name === 'age' ? '150' : 'Infinity'};
      if (value !== undefined && (value < min || value > max)) {
        throw new ValidationError(\`\${property.name} must be between \${min} and \${max}\`, {
          field: '${ctx.property.name}',
          value,
          rule: 'range',
          min,
          max
        });
      }
    `,
      )
      .done(),
  )

  .addMethod(method =>
    method
      .name('validate')
      .returns('ValidationResult')
      .implementation(
        `
      const errors = [];
      const warnings = [];

      // Validate all current values
      try {
        const built = this.build();
        // Additional cross-field validation
        this.validateCrossFields(built, errors, warnings);
      } catch (error) {
        errors.push(error);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    `,
      )
      .jsDoc(
        '/**\\n * Validates the current builder state\\n * @returns Validation result with errors and warnings\\n */',
      ),
  )

  .addMethod(method =>
    method
      .name('validateAndBuild')
      .returns('T')
      .implementation(
        `
      const validation = this.validate();
      if (!validation.isValid) {
        throw new ValidationError('Validation failed', {
          errors: validation.errors
        });
      }
      return this.build();
    `,
      )
      .jsDoc(
        '/**\\n * Validates and builds the object, throwing on validation failure\\n */',
      ),
  )

  .build();

export default validationPlugin;
```

### Custom Naming Transform Plugin

```typescript
const namingPlugin = createPlugin('advanced-naming', '1.0.0')
  .setDescription('Advanced naming transformations and conventions')

  .transformPropertyMethods(builder =>
    builder
      // Handle Asset suffix types
      .when(ctx => ctx.typeName.endsWith('Asset'))
      .setParameter(
        `${ctx.typeName.replace(/Asset$/, '')} | FluentBuilder<${ctx.typeName.replace(/Asset$/, '')}>`,
      )
      .setExtractor('{ asset: value }')
      .done()

      // Handle ID fields with custom naming
      .when(ctx => ctx.property.name.endsWith('Id'))
      .setParameter('string | number')
      .setExtractor('String(value)')
      .setValidator(
        `
      if (value && String(value).length < 1) {
        throw new Error('ID cannot be empty');
      }
    `,
      )
      .done()

      // Boolean fields with 'is' prefix
      .when(
        ctx =>
          ctx.property.name.startsWith('is') && ctx.type.isPrimitive('boolean'),
      )
      .setParameter('boolean | (() => boolean)')
      .setExtractor('typeof value === "function" ? value() : Boolean(value)')
      .done(),
  )

  .addMethod(method =>
    method.name('withNormalizedName').param('name', 'string').returns('this')
      .implementation(`
      const normalized = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      return this.withName(normalized);
    `),
  )

  .build();
```

### Database Integration Plugin

```typescript
const dbPlugin = createPlugin('database-integration', '1.0.0')
  .setDescription('Database integration with ORM support')

  .requireImports(imports =>
    imports
      .addExternalLibrary('prisma', ['PrismaClient'])
      .addExternalLibrary('uuid', ['v4 as uuidv4']),
  )

  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // Auto-generate UUID for id field
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

  .addMethod(method =>
    method
      .name('save')
      .param('prisma', 'PrismaClient')
      .returns(`Promise<${method.typeName}>`)
      .implementation(
        `
      const data = this.build();
      const tableName = '${method.typeName.toLowerCase()}';
      return prisma[tableName].create({ data });
    `,
      )
      .jsDoc('/**\\n * Saves the built object to database via Prisma\\n */'),
  )

  .addMethod(method =>
    method
      .name('saveOrUpdate')
      .param('prisma', 'PrismaClient')
      .param('where', 'object')
      .returns(`Promise<${method.typeName}>`).implementation(`
      const data = this.build();
      const tableName = '${method.typeName.toLowerCase()}';
      return prisma[tableName].upsert({
        where,
        update: data,
        create: data
      });
    `),
  )

  .build();
```

### Testing Utilities Plugin

```typescript
const testingPlugin = createPlugin('testing-utilities', '1.0.0')
  .setDescription('Enhanced testing utilities and factories')

  .requireImports(imports => imports.addExternalLibrary('faker', ['faker']))

  .addMethod(method =>
    method
      .name('withFakeData')
      .returns('this')
      .implementation(
        `
      // Generate fake data based on property names and types
      ${method.properties
        .map(prop => {
          if (prop.name === 'email')
            return `this.withEmail(faker.internet.email());`;
          if (prop.name === 'name')
            return `this.withName(faker.person.fullName());`;
          if (prop.name.includes('phone'))
            return `this.withPhone(faker.phone.number());`;
          if (prop.type.name === 'Date')
            return `this.with${prop.name.charAt(0).toUpperCase() + prop.name.slice(1)}(faker.date.recent());`;
          if (prop.type.name === 'number' && prop.name === 'age')
            return `this.withAge(faker.number.int({ min: 18, max: 80 }));`;
          return '';
        })
        .filter(Boolean)
        .join('\\n      ')}

      return this;
    `,
      )
      .jsDoc('/**\\n * Populates builder with realistic fake data\\n */'),
  )

  .addMethod(method =>
    method
      .name('buildMany')
      .param('count', 'number', { defaultValue: '5' })
      .returns(`${method.typeName}[]`).implementation(`
      return Array.from({ length: count }, () =>
        this.withFakeData().build()
      );
    `),
  )

  .addMethod(method =>
    method.name('asTestDouble').returns('this').implementation(`
      // Set test-specific values
      return this
        .withId('test-id')
        .withCreatedAt(new Date('2024-01-01'))
        .withUpdatedAt(new Date('2024-01-01'));
    `),
  )

  .build();
```

## Configuration and Usage

### File Naming Configuration

Configure flexible filename generation:

```json
{
  "generator": {
    "naming": {
      // Predefined conventions
      "convention": "camelCase",  // actionAsset.builder.ts
      "suffix": "builder",

      // OR custom transform function
      "transform": "(typeName) => {
        const name = typeName.replace(/Asset$/, '');
        return name.charAt(0).toLowerCase() + name.slice(1);
      }"
    }
  }
}
```

### Plugin Configuration

```json
{
  "plugins": [
    "./plugins/validation.ts",
    "./plugins/database.ts",
    "./node_modules/@company/fluent-gen-plugins/dist/index.js"
  ],
  "targets": [
    {
      "file": "src/types.ts",
      "types": ["User", "Product", "Order"],
      "outputFile": "./src/builders/{type}.builder.ts"
    }
  ]
}
```

### Programmatic Usage

```typescript
import { FluentGen, PluginManager } from 'fluent-gen-ts';
import validationPlugin from './plugins/validation.js';
import customMethodsPlugin from './plugins/custom-methods.js';

const pluginManager = new PluginManager();
pluginManager.register(validationPlugin);
pluginManager.register(customMethodsPlugin);

const gen = new FluentGen({
  pluginManager,
  naming: {
    transform: '(typeName) => typeName.replace(/DTO$/, "").toLowerCase()',
  },
});

const result = await gen.generateBuilder('./types.ts', 'UserDTO');
```

## Plugin Development Best Practices

### Error Handling

Always use Result types for proper error handling:

```typescript
.transformPropertyMethods(builder => builder
  .when(ctx => {
    try {
      return complexCondition(ctx);
    } catch (error) {
      // Handle condition evaluation errors gracefully
      return false;
    }
  })
  .setValidation(`
    try {
      validateValue(value);
    } catch (error) {
      throw new ValidationError(\`Validation failed for \${property.name}: \${error.message}\`);
    }
  `)
  .done()
)
```

### TypeScript Integration

Ensure full type safety in your plugins:

```typescript
import type {
  Plugin,
  PropertyMethodContext,
  CustomMethod,
  BuildMethodTransform,
} from 'fluent-gen-ts';

const plugin = createPlugin('typed-plugin', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when((ctx: PropertyMethodContext) => {
        // Full type safety
        return ctx.property.name === 'email' && ctx.type.isPrimitive('string');
      })
      .setValidator('/* validation code */')
      .done(),
  )
  .build();
```

### Testing Plugins

Create comprehensive tests for your plugins:

```typescript
// test/plugin.test.ts
import { describe, it, expect } from 'vitest';
import { TypeKind } from 'fluent-gen-ts';
import myPlugin from '../plugins/my-plugin.js';

describe('MyPlugin', () => {
  it('should transform email properties', () => {
    // Create a mock context
    const context = {
      property: {
        name: 'email',
        type: { kind: TypeKind.Primitive, name: 'string' },
        optional: false,
        readonly: false,
      },
      propertyType: { kind: TypeKind.Primitive, name: 'string' },
      typeName: 'User',
      typeInfo: { kind: TypeKind.Object, name: 'User', properties: [] },
      builderName: 'UserBuilder',
      originalTypeString: 'string',
      type: {
        isPrimitive: name => name === 'string',
        // ... other type matcher methods
      },
    };

    const result = myPlugin.transformPropertyMethod?.(context);

    if (result.ok) {
      expect(result.value.validate).toContain('@');
    }
  });
});
```

### Plugin Distribution

Package your plugins for reuse:

```json
{
  "name": "@mycompany/fluent-gen-validation",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "fluent-gen-ts": ">=0.1.0"
  },
  "keywords": ["fluent-gen-ts", "plugin", "validation"],
  "files": ["dist/"]
}
```

## Next Steps

- See [Advanced Usage](./advanced-usage.md) for complex scenarios
- Check [Examples](/examples/) for real-world plugin usage
- Browse the [Plugin API Reference](../api/reference.md#plugin-creation) for
  detailed interfaces
- Look at [CLI Commands](./cli-commands.md) for plugin configuration options

The plugin system is designed to be both powerful and approachable. Start with
simple transformations and gradually build up to complex, feature-rich plugins
that can be shared across teams and projects.
