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
      .addExternal('validator', ['isEmail', 'isURL', 'isLength'])
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
      .addExternal('prisma', ['PrismaClient'])
      .addExternal('uuid', ['v4 as uuidv4']),
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

  .requireImports(imports => imports.addExternal('faker', ['faker']))

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

## Complete API Reference

### Core Plugin Builder Functions

#### `createPlugin(name: string, version: string): PluginBuilder`

Creates a new plugin builder instance.

```typescript
const plugin = createPlugin('my-plugin', '1.0.0')
  .setDescription('Plugin description')
  .build();
```

#### PluginBuilder Methods

##### `.setDescription(description: string): this`

Sets a human-readable description for the plugin.

##### `.requireImports(configurator: (manager: ImportManager) => ImportManager): this`

Configures import requirements using the fluent ImportManager API.

##### `.transformPropertyMethods(configurator: (builder: PropertyMethodTransformBuilder) => PropertyMethodTransformBuilder): this`

Defines how property methods should be transformed.

##### `.addMethod(configurator: (builder: CustomMethodBuilder) => CustomMethodBuilder): this`

Adds custom methods to generated builders.

##### `.transformValues(configurator: (builder: ValueTransformBuilder) => ValueTransformBuilder): this`

Defines value transformations for build process.

##### `.transformBuildMethod(configurator: (builder: BuildMethodTransformBuilder) => BuildMethodTransformBuilder): this`

Modifies the build method implementation.

##### Lifecycle Hooks

- `.beforeParse(hook: (context: ParseContext) => Result<ParseContext>): this`
- `.afterParse(hook: (context: ParseContext, type: Type) => Result<Type>): this`
- `.beforeResolve(hook: (context: ResolveContext) => Result<ResolveContext>): this`
- `.afterResolve(hook: (context: ResolveContext, typeInfo: TypeInfo) => Result<TypeInfo>): this`
- `.beforeGenerate(hook: (context: GenerateContext) => Result<GenerateContext>): this`
- `.afterGenerate(hook: (code: string, context: GenerateContext) => Result<string>): this`
- `.transformType(hook: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>): this`
- `.transformProperty(hook: (property: PropertyInfo) => Result<PropertyInfo>): this`
- `.transformImports(hook: (context: ImportTransformContext) => Result<ImportTransformContext>): this`

### Type Matcher Functions

All type matcher functions for creating powerful type-based conditions:

#### `primitive(...names: string[]): TypeMatcher`

Matches primitive types. If no names provided, matches any primitive.

```typescript
// Match specific primitives
.when(ctx => ctx.type.matches(primitive('string', 'number')))

// Match any primitive
.when(ctx => ctx.type.matches(primitive()))
```

#### `object(name?: string): ObjectTypeMatcher`

Matches object types with fluent API for further refinement.

```typescript
// Match any object
.when(ctx => ctx.type.matches(object()))

// Match specific object
.when(ctx => ctx.type.matches(object('User')))

// Match object with specific properties
.when(ctx => ctx.type.matches(
  object('User')
    .withProperty('email', primitive('string'))
    .withProperty('age', primitive('number'))
))

// Match object with generic parameters
.when(ctx => ctx.type.matches(object('Response').withGeneric('T')))
```

#### `array(): ArrayTypeMatcher`

Matches array types with element type matching.

```typescript
// Match any array
.when(ctx => ctx.type.matches(array()))

// Match array of specific type
.when(ctx => ctx.type.matches(array().of(primitive('string'))))
.when(ctx => ctx.type.matches(array().of(object('User'))))
```

#### `union(): UnionTypeMatcher`

Matches union types with flexible containment checking.

```typescript
// Match union containing specific type
.when(ctx => ctx.type.matches(union().containing(primitive('string'))))

// Match exact union
.when(ctx => ctx.type.matches(union().exact(
  primitive('string'),
  primitive('number')
)))
```

#### `intersection(): IntersectionTypeMatcher`

Matches intersection types.

```typescript
// Match intersection including specific type
.when(ctx => ctx.type.matches(intersection().including(object('User'))))

// Match exact intersection
.when(ctx => ctx.type.matches(intersection().exact(
  object('User'),
  object('Timestamped')
)))
```

#### `reference(name?: string): TypeMatcher`

Matches type references.

```typescript
// Match any reference
.when(ctx => ctx.type.matches(reference()))

// Match specific reference
.when(ctx => ctx.type.matches(reference('MyType')))
```

#### `generic(name?: string): TypeMatcher`

Matches generic types.

```typescript
// Match any generic
.when(ctx => ctx.type.matches(generic()))

// Match specific generic
.when(ctx => ctx.type.matches(generic('Promise')))
```

#### `literal(value: string | number | boolean): TypeMatcher`

Matches literal types.

```typescript
.when(ctx => ctx.type.matches(literal('admin')))
.when(ctx => ctx.type.matches(literal(42)))
.when(ctx => ctx.type.matches(literal(true)))
```

#### `any(): TypeMatcher`

Matches any type.

#### `never(): TypeMatcher`

Matches never type.

#### Combinators

##### `or(...matchers: TypeMatcher[]): TypeMatcher`

Logical OR operation on matchers.

```typescript
.when(ctx => ctx.type.matches(or(
  primitive('string'),
  primitive('number')
)))
```

##### `and(...matchers: TypeMatcher[]): TypeMatcher`

Logical AND operation on matchers.

```typescript
.when(ctx => ctx.type.matches(and(
  object('User'),
  reference('Timestamped')
)))
```

##### `not(matcher: TypeMatcher): TypeMatcher`

Logical NOT operation on matcher.

```typescript
.when(ctx => ctx.type.matches(not(primitive('string'))))
```

### Import Management API

#### `ImportManager` Methods

##### `.addInternal(path: string, imports: string | string[], options?): this`

Adds internal project imports.

```typescript
.requireImports(imports => imports
  .addInternal('../types.js', ['User', 'Product'])
  .addInternal('./utils.js', 'helper')
)
```

##### `.addExternal(packageName: string, imports: string | string[], options?): this`

Adds external package imports.

```typescript
.requireImports(imports => imports
  .addExternal('lodash', ['isEmpty', 'isString'])
  .addExternal('uuid', ['v4 as generateId'])
)
```

##### `.addInternalDefault(path: string, defaultName: string): this`

Adds default import from internal file.

```typescript
.requireImports(imports => imports
  .addInternalDefault('./config.js', 'config')
)
```

##### `.addExternalDefault(packageName: string, defaultName: string): this`

Adds default import from external package.

```typescript
.requireImports(imports => imports
  .addExternalDefault('moment', 'moment')
)
```

##### `.addInternalTypes(path: string, types: string | string[]): this`

Adds type-only imports from internal file.

```typescript
.requireImports(imports => imports
  .addInternalTypes('../types.js', ['User', 'Product'])
)
```

##### `.addExternalTypes(packageName: string, types: string | string[]): this`

Adds type-only imports from external package.

```typescript
.requireImports(imports => imports
  .addExternalTypes('@types/node', ['Buffer'])
)
```

### Transform Builder APIs

#### PropertyMethodTransformBuilder

##### `.when(predicate: (context: PropertyMethodContext) => boolean): this`

Starts a new transformation rule with a condition.

##### `.setParameter(type: string | ((original: string) => string)): this`

Sets the parameter type for the method.

##### `.setExtractor(code: string): this`

Sets the value extraction code.

##### `.setValidator(code: string): this`

Sets validation code that runs before assignment.

##### `.done(): this`

Completes the current transformation rule.

#### ValueTransformBuilder

##### `.when(predicate: (context: ValueContext) => boolean): this`

Starts a new value transformation rule.

##### `.setTransform(code: string): this`

Sets the transformation code.

##### `.wrap(wrapper: string): this`

Wraps the value with a function call.

##### `.done(): this`

Completes the current transformation rule.

#### BuildMethodTransformBuilder

##### `.insertBefore(marker: string | RegExp, code: string | ((context: BuildMethodContext) => string)): this`

Inserts code before a marker in the build method.

##### `.insertAfter(marker: string | RegExp, code: string | ((context: BuildMethodContext) => string)): this`

Inserts code after a marker in the build method.

##### `.replace(pattern: string | RegExp, replacement: string | ((match: string, context: BuildMethodContext) => string)): this`

Replaces matched pattern with new code.

##### `.wrapMethod(before: string | ((context: BuildMethodContext) => string), after: string | ((match: string, context: BuildMethodContext) => string)): this`

Wraps the entire method with before and after code.

#### CustomMethodBuilder

##### `.name(name: string): this`

Sets the method name.

##### `.param(name: string, type: string, options?: { optional?: boolean; defaultValue?: string }): this`

Adds a parameter to the method.

##### `.parameters(params: MethodParameter[]): this`

Sets all parameters at once.

##### `.returns(type: string | ((context: BuilderContext) => string)): this`

Sets the return type.

##### `.implementation(code: string | ((context: BuilderContext) => string)): this`

Sets the method implementation code.

##### `.jsDoc(doc: string): this`

Sets JSDoc documentation for the method.

### Context Objects and Utilities

#### PropertyMethodContext

Provides information about the property being transformed:

- `property: PropertyInfo` - The property information
- `propertyType: TypeInfo` - Type information for the property
- `typeName: string` - Name of the containing type
- `typeInfo: TypeInfo` - Information about the containing type
- `builderName: string` - Name of the generated builder
- `originalTypeString: string` - Original TypeScript type string
- `type: TypeMatcherInterface` - Type utilities for matching

**Helper Methods:**

- `hasGeneric(name: string): boolean` - Check if type has specific generic
- `getGenericConstraint(name: string): string | undefined` - Get generic
  constraint
- `isOptional(): boolean` - Check if property is optional
- `isReadonly(): boolean` - Check if property is readonly
- `getPropertyPath(): string[]` - Get property path for nested properties
- `getMethodName(): string` - Get the generated method name

#### BuilderContext

Provides information about the builder being generated:

- `typeName: string` - Name of the type
- `typeInfo: TypeInfo` - Type information
- `builderName: string` - Builder class name
- `genericParams: string` - Generic parameters string
- `genericConstraints: string` - Generic constraints string
- `properties: readonly PropertyInfo[]` - All properties

**Helper Methods:**

- `hasProperty(name: string): boolean` - Check if builder has property
- `getProperty(name: string): PropertyInfo | undefined` - Get property by name
- `getRequiredProperties(): readonly PropertyInfo[]` - Get required properties
- `getOptionalProperties(): readonly PropertyInfo[]` - Get optional properties

#### ValueContext

Provides information during value transformation:

- `property: string` - Property name
- `valueVariable: string` - Name of the value variable
- `type: TypeInfo` - Type information
- `isOptional: boolean` - Whether property is optional
- `typeChecker: TypeMatcherInterface` - Type matching utilities

#### BuildMethodContext

Provides information during build method transformation:

- `typeName: string` - Type name
- `typeInfo: TypeInfo` - Type information
- `builderName: string` - Builder name
- `genericParams: string` - Generic parameters
- `genericConstraints: string` - Generic constraints
- `buildMethodCode: string` - Current build method code
- `properties: readonly PropertyInfo[]` - All properties
- `options: GeneratorOptions` - Generator options
- `resolvedType: ResolvedType` - Resolved type information

## Additional Practical Examples

### React Component Props Plugin

A plugin for generating builders for React component props with proper types and
defaults:

```typescript
import { createPlugin, primitive, object, union } from 'fluent-gen-ts';

const reactPropsPlugin = createPlugin('react-component-props', '1.0.0')
  .setDescription('Enhanced React component props builders')

  .requireImports(imports =>
    imports
      .addExternalTypes('react', ['ReactNode', 'CSSProperties'])
      .addExternal('clsx', ['clsx']),
  )

  .transformPropertyMethods(builder =>
    builder
      // Handle className prop with clsx support
      .when(ctx => ctx.property.name === 'className')
      .setParameter('string | string[] | Record<string, boolean>')
      .setExtractor(
        'typeof value === "object" && !Array.isArray(value) ? clsx(value) : Array.isArray(value) ? clsx(value) : value',
      )
      .done()

      // Handle style prop with better typing
      .when(ctx => ctx.property.name === 'style')
      .setParameter(
        'CSSProperties | ((current: CSSProperties) => CSSProperties)',
      )
      .setExtractor(
        'typeof value === "function" ? value(this.get("style") || {}) : { ...this.get("style"), ...value }',
      )
      .done()

      // Handle children with flexible types
      .when(ctx => ctx.property.name === 'children')
      .setParameter('ReactNode | ((props: Partial<T>) => ReactNode)')
      .setExtractor(
        'typeof value === "function" ? value(this.buildPartial()) : value',
      )
      .done()

      // Handle event handlers with proper typing
      .when(
        ctx =>
          ctx.property.name.startsWith('on') &&
          ctx.type.isPrimitive('function'),
      )
      .setParameter(
        `${ctx.originalTypeString} | ((event: any, props: Partial<T>) => void)`,
      )
      .setExtractor(
        'typeof value === "function" && value.length > 1 ? (e) => value(e, this.buildPartial()) : value',
      )
      .done(),
  )

  .addMethod(method =>
    method
      .name('withConditionalProps')
      .param('condition', 'boolean | (() => boolean)')
      .param('props', 'Partial<T> | ((current: Partial<T>) => Partial<T>)')
      .returns('this')
      .implementation(
        `
      const shouldApply = typeof condition === 'function' ? condition() : condition;
      if (shouldApply) {
        const propsToApply = typeof props === 'function' ? props(this.buildPartial()) : props;
        return this.merge(propsToApply);
      }
      return this;
    `,
      )
      .jsDoc('/**\\n * Conditionally applies props based on a condition\\n */'),
  )

  .addMethod(method =>
    method
      .name('withVariant')
      .param('variant', 'string')
      .param('variantMap', 'Record<string, Partial<T>>')
      .returns('this')
      .implementation(
        `
      const variantProps = variantMap[variant];
      if (variantProps) {
        return this.merge(variantProps);
      }
      return this;
    `,
      )
      .jsDoc('/**\\n * Applies props based on a variant mapping\\n */'),
  )

  .build();
```

### API Response Transform Plugin

A plugin for transforming API responses with validation and normalization:

```typescript
import { createPlugin, object, array, primitive, union } from 'fluent-gen-ts';

const apiTransformPlugin = createPlugin('api-response-transform', '2.0.0')
  .setDescription('Transform and validate API responses')

  .requireImports(imports =>
    imports
      .addExternal('zod', ['z'])
      .addExternal('date-fns', ['parseISO', 'isValid'])
      .addInternalTypes('../api/types.js', ['ApiResponse', 'ApiError']),
  )

  .transformPropertyMethods(builder =>
    builder
      // Transform date strings to Date objects
      .when(
        ctx =>
          (ctx.property.name.includes('date') ||
            ctx.property.name.includes('Date') ||
            ctx.property.name.includes('time') ||
            ctx.property.name.includes('Time')) &&
          ctx.type.isPrimitive('string'),
      )
      .setParameter('string | Date')
      .setExtractor(
        `
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const parsed = parseISO(value);
        if (!isValid(parsed)) {
          throw new Error(\`Invalid date format: \${value}\`);
        }
        return parsed;
      }
      return value;
    `,
      )
      .done()

      // Transform API IDs to ensure string format
      .when(
        ctx => ctx.property.name.endsWith('Id') || ctx.property.name === 'id',
      )
      .setParameter('string | number')
      .setExtractor('String(value)')
      .setValidator(
        `
      if (!value || String(value).trim() === '') {
        throw new Error(\`ID cannot be empty: \${property.name}\`);
      }
    `,
      )
      .done()

      // Handle nested API responses
      .when(ctx => ctx.type.matches(object().withProperty('data')))
      .setParameter(
        `${ctx.originalTypeString} | ApiResponse<${ctx.originalTypeString}>`,
      )
      .setExtractor(
        `
      if ('data' in value && 'success' in value) {
        // It's an API response wrapper
        if (!value.success) {
          throw new Error(\`API Error: \${value.error?.message || 'Unknown error'}\`);
        }
        return value.data;
      }
      return value;
    `,
      )
      .done()

      // Transform array responses with validation
      .when(ctx => ctx.type.isArray())
      .setValidator(
        `
      if (value && !Array.isArray(value)) {
        throw new Error(\`Expected array for \${property.name}, got \${typeof value}\`);
      }
    `,
      )
      .done(),
  )

  .addMethod(method =>
    method
      .name('withApiValidation')
      .param('schema', 'z.ZodSchema<T>')
      .returns('this')
      .implementation(
        `
      try {
        const current = this.buildPartial();
        schema.parse(current);
        return this;
      } catch (error) {
        throw new Error(\`API validation failed: \${error.message}\`);
      }
    `,
      )
      .jsDoc(
        '/**\\n * Validates the current builder state against a Zod schema\\n */',
      ),
  )

  .addMethod(method =>
    method
      .name('withApiDefaults')
      .param('apiVersion', 'string', { defaultValue: '"v1"' })
      .returns('this').implementation(`
      const defaults = {
        apiVersion,
        timestamp: new Date(),
        version: 1,
        ...this.buildPartial()
      };
      return this.merge(defaults);
    `),
  )

  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // API Response validation
      const result = this.buildWithDefaults();

      // Log API response for debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('API Response Built:', result);
      }

      // Ensure required API fields are present
      if (!result.id && this.has('id')) {
        throw new Error('API response missing required ID');
      }
    `,
    ),
  )

  .build();
```

### Form Validation Plugin

A comprehensive plugin for form builders with validation and error handling:

```typescript
import { createPlugin, primitive, object, array, union } from 'fluent-gen-ts';

const formValidationPlugin = createPlugin('form-validation', '1.5.0')
  .setDescription('Advanced form validation and error handling')

  .requireImports(imports =>
    imports
      .addExternal('yup', [
        'string',
        'number',
        'object',
        'array',
        'ValidationError',
      ])
      .addInternalTypes('./form-types.js', [
        'FormField',
        'ValidationRule',
        'FieldError',
      ]),
  )

  .transformPropertyMethods(builder =>
    builder
      // Email fields with comprehensive validation
      .when(
        ctx =>
          ctx.property.name.toLowerCase().includes('email') &&
          ctx.type.isPrimitive('string'),
      )
      .setParameter('string')
      .setValidator(
        `
      if (value) {
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new ValidationError('Please enter a valid email address');
        }
      }
    `,
      )
      .done()

      // Password fields with strength validation
      .when(
        ctx =>
          ctx.property.name.toLowerCase().includes('password') &&
          ctx.type.isPrimitive('string'),
      )
      .setValidator(
        `
      if (value) {
        if (value.length < 8) {
          throw new ValidationError('Password must be at least 8 characters long');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/.test(value)) {
          throw new ValidationError('Password must contain uppercase, lowercase, and number');
        }
      }
    `,
      )
      .done()

      // Phone number validation
      .when(
        ctx =>
          (ctx.property.name.toLowerCase().includes('phone') ||
            ctx.property.name.toLowerCase().includes('mobile')) &&
          ctx.type.isPrimitive('string'),
      )
      .setValidator(
        `
      if (value) {
        const phoneRegex = /^[\\+]?[1-9][\\d]{0,15}$/;
        const cleaned = value.replace(/[\\s\\-\\(\\)]/g, '');
        if (!phoneRegex.test(cleaned)) {
          throw new ValidationError('Please enter a valid phone number');
        }
      }
    `,
      )
      .setExtractor('value ? value.replace(/[\\s\\-\\(\\)]/g, "") : value')
      .done()

      // Required field validation
      .when(ctx => !ctx.isOptional() && ctx.type.isPrimitive('string'))
      .setValidator(
        `
      if (!value || value.trim() === '') {
        throw new ValidationError(\`\${property.name} is required\`);
      }
    `,
      )
      .done()

      // Numeric range validation
      .when(ctx => ctx.type.isPrimitive('number'))
      .setParameter('number | string')
      .setExtractor('typeof value === "string" ? parseFloat(value) : value')
      .setValidator(
        `
      if (value !== undefined && value !== null) {
        if (isNaN(value)) {
          throw new ValidationError(\`\${property.name} must be a valid number\`);
        }
      }
    `,
      )
      .done(),
  )

  .addMethod(method =>
    method
      .name('validateField')
      .param('fieldName', 'keyof T')
      .returns('{ isValid: boolean; error?: string }')
      .implementation(
        `
      try {
        const value = this.get(fieldName as string);
        // Run field-specific validation
        this.validateSingleField(fieldName as string, value);
        return { isValid: true };
      } catch (error) {
        return {
          isValid: false,
          error: error instanceof ValidationError ? error.message : String(error)
        };
      }
    `,
      )
      .jsDoc(
        '/**\\n * Validates a single field and returns validation result\\n */',
      ),
  )

  .addMethod(method =>
    method
      .name('validateAll')
      .returns('{ isValid: boolean; errors: Record<keyof T, string> }')
      .implementation(
        `
      const errors: Record<string, string> = {};
      let isValid = true;

      // Get all field names from the type
      const fields = Object.keys(this.buildPartial()) as (keyof T)[];

      for (const field of fields) {
        const validation = this.validateField(field);
        if (!validation.isValid && validation.error) {
          errors[field as string] = validation.error;
          isValid = false;
        }
      }

      return { isValid, errors };
    `,
      )
      .jsDoc(
        '/**\\n * Validates all fields and returns comprehensive validation result\\n */',
      ),
  )

  .addMethod(method =>
    method
      .name('withFieldError')
      .param('fieldName', 'keyof T')
      .param('error', 'string')
      .returns('this').implementation(`
      // Store field errors in auxiliary data
      return this.pushAuxiliary('fieldErrors', { field: fieldName, error });
    `),
  )

  .addMethod(method =>
    method.name('clearFieldError').param('fieldName', 'keyof T').returns('this')
      .implementation(`
      const errors = this.getAuxiliaryArray('fieldErrors') || [];
      const filtered = errors.filter(e => e.field !== fieldName);
      this.setAuxiliary('fieldErrors', filtered);
      return this;
    `),
  )

  .build();
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
