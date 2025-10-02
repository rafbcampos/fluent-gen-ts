# Plugin Cookbook

:::tip What You'll Find 20+ production-ready plugins you can copy and paste.
Each recipe is tested and ready to use. :::

## Quick Index

**Jump to:**

- [Validation](#validation) - Email, URL, phone, range validation
- [Testing](#testing) - Fake data, factories, test helpers
- [Database](#database) - UUID, timestamps, persistence
- [API](#api) - Response transforms, error handling
- [Type Transformations](#type-transformations) - ID normalization, date
  handling
- [Custom Methods](#custom-methods) - Conditional methods, convenience methods,
  shortcuts
- [Build Hooks](#build-hooks) - Conditional transformations, pre/post build
  logic

## Validation {#validation}

### Email Validation

```typescript
import { createPlugin } from 'fluent-gen-ts';

const emailValidation = createPlugin('email-validation', '1.0.0')
  .requireImports(imports => imports.addExternal('validator', ['isEmail']))
  .transformPropertyMethods(builder =>
    builder
      .when(
        ctx =>
          ctx.property.name === 'email' || ctx.property.name.endsWith('Email'),
      )
      .setValidator(
        `
      if (value && !isEmail(value)) {
        throw new Error(\`Invalid email format: \${value}\`);
      }
    `,
      )
      .done(),
  )
  .build();

export default emailValidation;
```

### URL Validation

```typescript
import { createPlugin } from 'fluent-gen-ts';

const urlValidation = createPlugin('url-validation', '1.0.0')
  .requireImports(imports => imports.addExternal('validator', ['isURL']))
  .transformPropertyMethods(builder =>
    builder
      .when(
        ctx =>
          ctx.property.name.endsWith('Url') ||
          ctx.property.name.endsWith('URL') ||
          ctx.property.name === 'url',
      )
      .setValidator(
        `
      if (value && !isURL(value)) {
        throw new Error(\`Invalid URL format: \${value}\`);
      }
    `,
      )
      .done(),
  )
  .build();

export default urlValidation;
```

### Phone Number Validation

```typescript
import { createPlugin } from 'fluent-gen-ts';

const phoneValidation = createPlugin('phone-validation', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when(
        ctx =>
          ctx.property.name.includes('phone') ||
          ctx.property.name.includes('Phone') ||
          ctx.property.name.includes('mobile'),
      )
      .setParameter('string')
      .setExtractor('value ? value.replace(/[\\s\\-\\(\\)]/g, "") : value')
      .setValidator(
        `
      if (value) {
        const phoneRegex = /^[\\+]?[1-9][\\d]{0,15}$/;
        if (!phoneRegex.test(value)) {
          throw new Error(\`Invalid phone number: \${value}\`);
        }
      }
    `,
      )
      .done(),
  )
  .build();

export default phoneValidation;
```

### Range Validation

```typescript
import { createPlugin } from 'fluent-gen-ts';

const rangeValidation = createPlugin('range-validation', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      // Age validation
      .when(ctx => ctx.property.name === 'age')
      .setValidator(
        `
      if (value !== undefined && (value < 0 || value > 150)) {
        throw new Error(\`Age must be between 0 and 150, got: \${value}\`);
      }
    `,
      )
      .done()

      // Price validation
      .when(ctx => ctx.property.name === 'price')
      .setValidator(
        `
      if (value !== undefined && value < 0) {
        throw new Error(\`Price cannot be negative: \${value}\`);
      }
    `,
      )
      .done()

      // Percentage validation
      .when(
        ctx =>
          ctx.property.name.includes('percent') ||
          ctx.property.name.includes('Percent'),
      )
      .setValidator(
        `
      if (value !== undefined && (value < 0 || value > 100)) {
        throw new Error(\`Percentage must be between 0 and 100: \${value}\`);
      }
    `,
      )
      .done(),
  )
  .build();

export default rangeValidation;
```

### Comprehensive Validation Suite

```typescript
import { createPlugin } from 'fluent-gen-ts';

const validationSuite = createPlugin('validation-suite', '1.0.0')
  .requireImports(imports =>
    imports.addExternal('validator', ['isEmail', 'isURL', 'isLength']),
  )
  .transformPropertyMethods(builder =>
    builder
      // Email
      .when(ctx => ctx.property.name === 'email')
      .setValidator(
        'if (value && !isEmail(value)) throw new Error("Invalid email")',
      )
      .done()

      // URL
      .when(ctx => ctx.property.name.endsWith('Url'))
      .setValidator(
        'if (value && !isURL(value)) throw new Error("Invalid URL")',
      )
      .done()

      // String length
      .when(ctx => ctx.type.isPrimitive('string') && !ctx.isOptional())
      .setValidator(
        `
      if (!value || !isLength(value, { min: 1, max: 255 })) {
        throw new Error(\`String must be 1-255 characters: \${property.name}\`);
      }
    `,
      )
      .done()

      // Required fields
      .when(ctx => !ctx.isOptional() && ctx.type.isPrimitive('string'))
      .setValidator(
        `
      if (!value || value.trim() === '') {
        throw new Error(\`\${property.name} is required\`);
      }
    `,
      )
      .done(),
  )
  .build();

export default validationSuite;
```

## Testing {#testing}

### Fake Data Generator

```typescript
import { createPlugin } from 'fluent-gen-ts';

const fakeDataPlugin = createPlugin('fake-data', '1.0.0')
  .requireImports(imports => imports.addExternal('faker', ['faker']))
  .addMethod(method =>
    method
      .name('withFakeData')
      .returns('this')
      .implementation(
        `
      // Generate realistic fake data based on property names
      if (this.has('id')) this.withId(faker.string.uuid());
      if (this.has('email')) this.withEmail(faker.internet.email());
      if (this.has('name')) this.withName(faker.person.fullName());
      if (this.has('firstName')) this.withFirstName(faker.person.firstName());
      if (this.has('lastName')) this.withLastName(faker.person.lastName());
      if (this.has('username')) this.withUsername(faker.internet.userName());
      if (this.has('phone')) this.withPhone(faker.phone.number());
      if (this.has('address')) this.withAddress(faker.location.streetAddress());
      if (this.has('city')) this.withCity(faker.location.city());
      if (this.has('country')) this.withCountry(faker.location.country());
      if (this.has('createdAt')) this.withCreatedAt(faker.date.past());
      if (this.has('age')) this.withAge(faker.number.int({ min: 18, max: 80 }));

      return this;
    `,
      )
      .jsDoc('/**\\n * Populate builder with realistic fake data\\n */'),
  )
  .addMethod(method =>
    method
      .name('buildMany')
      .parameter('count', 'number', { defaultValue: '5' })
      .returns('T[]')
      .implementation(
        `
      return Array.from({ length: count }, () =>
        this.withFakeData().build()
      );
    `,
      )
      .jsDoc('/**\\n * Build multiple instances with fake data\\n */'),
  )
  .build();

export default fakeDataPlugin;
```

### Test Factories

```typescript
import { createPlugin } from 'fluent-gen-ts';

const testFactories = createPlugin('test-factories', '1.0.0')
  .addMethod(method =>
    method
      .name('asTestDouble')
      .returns('this')
      .implementation(
        `
      return this
        .withId('test-id-' + Date.now())
        .withCreatedAt(new Date('2024-01-01'))
        .withUpdatedAt(new Date('2024-01-01'));
    `,
      )
      .jsDoc('/**\\n * Create a test double with predictable values\\n */'),
  )
  .addMethod(method =>
    method.name('withDefaults').returns('this').implementation(`
      // Set safe default values for all required fields
      const defaults = this.constructor.defaults || {};
      Object.entries(defaults).forEach(([key, value]) => {
        if (!this.has(key)) {
          this.set(key, value);
        }
      });
      return this;
    `),
  )
  .build();

export default testFactories;
```

## Database {#database}

### Auto UUID Generation

```typescript
import { createPlugin } from 'fluent-gen-ts';

const autoUUID = createPlugin('auto-uuid', '1.0.0')
  .requireImports(imports => imports.addExternal('uuid', ['v4 as uuidv4']))
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // Auto-generate UUID for id field if not provided
      if (!this.has('id')) {
        this.set('id', uuidv4());
      }
    `,
    ),
  )
  .build();

export default autoUUID;
```

### Timestamps Plugin

```typescript
import { createPlugin } from 'fluent-gen-ts';

const timestamps = createPlugin('timestamps', '1.0.0')
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      const now = new Date();

      // Set createdAt if not set
      if (!this.has('createdAt')) {
        this.set('createdAt', now);
      }

      // Always update updatedAt
      this.set('updatedAt', now);
    `,
    ),
  )
  .addMethod(method =>
    method.name('withTimestamps').returns('this').implementation(`
      const now = new Date();
      return this.withCreatedAt(now).withUpdatedAt(now);
    `),
  )
  .build();

export default timestamps;
```

### Database Persistence

```typescript
import { createPlugin } from 'fluent-gen-ts';

const dbPersistence = createPlugin('db-persistence', '1.0.0')
  .requireImports(imports => imports.addExternal('prisma', ['PrismaClient']))
  .addMethod(method =>
    method
      .name('save')
      .parameter('prisma', 'PrismaClient')
      .returns(`Promise<T>`)
      .implementation(
        `
      const data = this.build();
      const tableName = this.constructor.name.replace('Builder', '').toLowerCase();
      return prisma[tableName].create({ data });
    `,
      )
      .jsDoc('/**\\n * Save to database via Prisma\\n */'),
  )
  .addMethod(method =>
    method
      .name('saveOrUpdate')
      .parameter('prisma', 'PrismaClient')
      .parameter('where', 'object')
      .returns(`Promise<T>`).implementation(`
      const data = this.build();
      const tableName = this.constructor.name.replace('Builder', '').toLowerCase();
      return prisma[tableName].upsert({ where, update: data, create: data });
    `),
  )
  .build();

export default dbPersistence;
```

## API {#api}

### API Response Transform

```typescript
import { createPlugin, object, primitive } from 'fluent-gen-ts';

const apiTransform = createPlugin('api-transform', '2.0.0')
  .requireImports(imports =>
    imports.addExternal('date-fns', ['parseISO', 'isValid']),
  )
  .transformPropertyMethods(builder =>
    builder
      // Transform date strings to Date objects
      .when(
        ctx =>
          (ctx.property.name.includes('date') ||
            ctx.property.name.includes('Date') ||
            ctx.property.name.includes('At')) &&
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

      // Normalize IDs to strings
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
      .done(),
  )
  .build();

export default apiTransform;
```

### Error Handling

```typescript
import { createPlugin } from 'fluent-gen-ts';

const errorHandling = createPlugin('error-handling', '1.0.0')
  .addMethod(method =>
    method
      .name('buildSafe')
      .returns('{ ok: true; value: T } | { ok: false; error: Error }')
      .implementation(
        `
      try {
        return { ok: true, value: this.build() };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
      }
    `,
      )
      .jsDoc('/**\\n * Build with error handling (Result type)\\n */'),
  )
  .build();

export default errorHandling;
```

## Type Transformations {#type-transformations}

### ID Normalization

```typescript
import { createPlugin } from 'fluent-gen-ts';

const idNormalization = createPlugin('id-normalization', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when(
        ctx => ctx.property.name.endsWith('Id') || ctx.property.name === 'id',
      )
      .setParameter('string | number')
      .setExtractor('String(value)')
      .setValidator(
        `
      if (value && String(value).length < 1) {
        throw new Error('ID cannot be empty');
      }
    `,
      )
      .done(),
  )
  .build();

export default idNormalization;
```

### Date Handling

```typescript
import { createPlugin } from 'fluent-gen-ts';

const dateHandling = createPlugin('date-handling', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when(
        ctx =>
          ctx.type.isPrimitive('Date') ||
          ctx.property.name.endsWith('At') ||
          ctx.property.name.endsWith('Date'),
      )
      .setParameter('Date | string | number')
      .setExtractor(
        `
      if (value instanceof Date) return value;
      if (typeof value === 'string' || typeof value === 'number') {
        return new Date(value);
      }
      return value;
    `,
      )
      .setValidator(
        `
      if (value && isNaN(value.getTime())) {
        throw new Error(\`Invalid date value for \${property.name}\`);
      }
    `,
      )
      .done(),
  )
  .build();

export default dateHandling;
```

### Boolean Flags

```typescript
import { createPlugin } from 'fluent-gen-ts';

const booleanFlags = createPlugin('boolean-flags', '1.0.0')
  .transformPropertyMethods(builder =>
    builder
      .when(
        ctx =>
          ctx.property.name.startsWith('is') ||
          ctx.property.name.startsWith('has') ||
          ctx.property.name.startsWith('can'),
      )
      .setParameter('boolean | (() => boolean)')
      .setExtractor('typeof value === "function" ? value() : Boolean(value)')
      .done(),
  )
  .build();

export default booleanFlags;
```

## Custom Methods {#custom-methods}

### Conditional Methods (Builder-Specific)

Add methods only for specific builders using `.when()`:

```typescript
import { createPlugin } from 'fluent-gen-ts';

const conditionalMethods = createPlugin('conditional-methods', '1.0.0')
  // Add method only to UserBuilder
  .addMethod(method =>
    method
      .when(ctx => ctx.builderName === 'UserBuilder')
      .name('asVerifiedUser')
      .returns('this')
      .implementation(
        `
      return this
        .withEmailVerified(true)
        .withStatus('active')
        .withVerifiedAt(new Date());
    `,
      )
      .jsDoc('/**\\n * Configure as verified user (UserBuilder only)\\n */'),
  )
  // Add method only to builders with an 'email' property
  .addMethod(method =>
    method
      .when(ctx => ctx.properties.some(p => p.name === 'email'))
      .name('withRandomEmail')
      .returns('this')
      .implementation(
        `
      const randomEmail = \`user\${Date.now()}@example.com\`;
      return this.withEmail(randomEmail);
    `,
      ),
  )
  // Add method to all builders (no condition)
  .addMethod(method =>
    method
      .name('clone')
      .returns('this')
      .implementation(
        'return Object.assign(Object.create(Object.getPrototypeOf(this)), this);',
      ),
  )
  .build();

export default conditionalMethods;
```

**Usage:**

```typescript
// UserBuilder gets asVerifiedUser() method
const user = new UserBuilder().asVerifiedUser().build();

// ProductBuilder doesn't have asVerifiedUser() method
const product = new ProductBuilder().build(); // No asVerifiedUser method

// All builders get clone() method
const user2 = new UserBuilder().clone();
const product2 = new ProductBuilder().clone();
```

### Role-Based Helpers

```typescript
import { createPlugin } from 'fluent-gen-ts';

const roleHelpers = createPlugin('role-helpers', '1.0.0')
  .addMethod(method =>
    method
      .name('asAdmin')
      .returns('this')
      .implementation(
        `
      return this
        .withRole('admin')
        .withIsActive(true)
        .withPermissions(['read', 'write', 'admin']);
    `,
      )
      .jsDoc('/**\\n * Configure as admin user\\n */'),
  )
  .addMethod(method =>
    method.name('asUser').returns('this').implementation(`
      return this
        .withRole('user')
        .withIsActive(true)
        .withPermissions(['read', 'write']);
    `),
  )
  .addMethod(method =>
    method.name('asGuest').returns('this').implementation(`
      return this
        .withRole('guest')
        .withIsActive(false)
        .withPermissions(['read']);
    `),
  )
  .build();

export default roleHelpers;
```

### Random ID Generation

```typescript
import { createPlugin } from 'fluent-gen-ts';

const randomId = createPlugin('random-id', '1.0.0')
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
      .jsDoc(
        '/**\\n * Generate and set a random ID\\n * @param prefix - ID prefix (default: "item")\\n */',
      ),
  )
  .build();

export default randomId;
```

### Fluent Conditionals

```typescript
import { createPlugin } from 'fluent-gen-ts';

const fluentConditionals = createPlugin('fluent-conditionals', '1.0.0')
  .addMethod(method =>
    method
      .name('when')
      .parameter('condition', 'boolean | (() => boolean)')
      .parameter('fn', '(builder: this) => this')
      .returns('this')
      .implementation(
        `
      const shouldApply = typeof condition === 'function' ? condition() : condition;
      return shouldApply ? fn(this) : this;
    `,
      )
      .jsDoc('/**\\n * Conditionally apply a transformation\\n */'),
  )
  .addMethod(method =>
    method
      .name('unless')
      .parameter('condition', 'boolean | (() => boolean)')
      .parameter('fn', '(builder: this) => this')
      .returns('this').implementation(`
      const shouldSkip = typeof condition === 'function' ? condition() : condition;
      return shouldSkip ? this : fn(this);
    `),
  )
  .build();

export default fluentConditionals;
```

## Build Hooks {#build-hooks}

### Conditional Build Transformations

Apply build transformations only for specific builders using `.when()`:

```typescript
import { createPlugin } from 'fluent-gen-ts';

const conditionalBuildHooks = createPlugin('conditional-build-hooks', '1.0.0')
  .requireImports(imports => imports.addExternal('uuid', ['v4 as uuidv4']))
  // Only validate UserBuilder
  .transformBuildMethod(transform =>
    transform
      .when(ctx => ctx.builderName === 'UserBuilder')
      .insertBefore(
        'return {',
        `
      // Validate user-specific fields
      if (!this.has('email')) {
        throw new Error('User must have email');
      }
      if (!this.has('role')) {
        this.set('role', 'user'); // Default role
      }
    `,
      ),
  )
  // Auto-generate UUID only for entities with 'id' property
  .transformBuildMethod(transform =>
    transform
      .when(ctx => ctx.properties.some(p => p.name === 'id'))
      .insertBefore(
        'return {',
        `
      if (!this.has('id')) {
        this.set('id', uuidv4());
      }
    `,
      ),
  )
  // Log builds in development (all builders)
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return {',
      `
      if (process.env.NODE_ENV === 'development') {
        console.log('Building:', this.constructor.name);
      }
    `,
    ),
  )
  .build();

export default conditionalBuildHooks;
```

**Result:**

```typescript
// UserBuilder gets email validation AND UUID AND logging
const user = new UserBuilder().build(); // Throws if no email

// ProductBuilder gets UUID AND logging (no email validation)
const product = new ProductBuilder().build(); // OK without email

// CommentBuilder (no id property) gets only logging
const comment = new CommentBuilder().build(); // No UUID, just logging
```

### Validation Before Build

```typescript
import { createPlugin } from 'fluent-gen-ts';

const preBuildValidation = createPlugin('pre-build-validation', '1.0.0')
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // Validate all required fields are set
      const required = ['id', 'name', 'email'];
      for (const field of required) {
        if (!this.has(field)) {
          throw new Error(\`Required field missing: \${field}\`);
        }
      }

      // Cross-field validation
      if (this.has('startDate') && this.has('endDate')) {
        const start = this.peek('startDate');
        const end = this.peek('endDate');
        if (start > end) {
          throw new Error('Start date must be before end date');
        }
      }
    `,
    ),
  )
  .build();

export default preBuildValidation;
```

### Logging Hook

```typescript
import { createPlugin } from 'fluent-gen-ts';

const loggingHook = createPlugin('logging-hook', '1.0.0')
  .transformBuildMethod(transform =>
    transform
      .insertBefore(
        'return this.buildWithDefaults',
        `
        // Log build operation in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Building:', this.constructor.name);
        }
      `,
      )
      .insertAfter(
        'return this.buildWithDefaults',
        `
        // Log result in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Built:', result);
        }
      `,
      ),
  )
  .build();

export default loggingHook;
```

## Combined Plugins

### Full-Stack Plugin Suite

```typescript
import { createPlugin } from 'fluent-gen-ts';

const fullStack = createPlugin('full-stack', '1.0.0')
  .requireImports(imports =>
    imports
      .addExternal('uuid', ['v4 as uuidv4'])
      .addExternal('validator', ['isEmail', 'isURL'])
      .addExternal('faker', ['faker']),
  )
  // Auto UUID
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      if (!this.has('id')) this.set('id', uuidv4());
      const now = new Date();
      if (!this.has('createdAt')) this.set('createdAt', now);
      this.set('updatedAt', now);
    `,
    ),
  )
  // Validation
  .transformPropertyMethods(builder =>
    builder
      .when(ctx => ctx.property.name === 'email')
      .setValidator(
        'if (value && !isEmail(value)) throw new Error("Invalid email")',
      )
      .done()
      .when(ctx => ctx.property.name.endsWith('Url'))
      .setValidator(
        'if (value && !isURL(value)) throw new Error("Invalid URL")',
      )
      .done(),
  )
  // Testing helpers
  .addMethod(method =>
    method.name('withFakeData').returns('this').implementation(`
      if (this.has('email')) this.withEmail(faker.internet.email());
      if (this.has('name')) this.withName(faker.person.fullName());
      return this;
    `),
  )
  .addMethod(method =>
    method
      .name('buildMany')
      .parameter('count', 'number', { defaultValue: '5' })
      .returns('T[]').implementation(`
      return Array.from({ length: count }, () => this.withFakeData().build());
    `),
  )
  .build();

export default fullStack;
```

## Usage Examples

### Using Multiple Plugins

```javascript
// fluentgen.config.js
export default {
  plugins: [
    './plugins/validation-suite.ts',
    './plugins/timestamps.ts',
    './plugins/auto-uuid.ts',
    './plugins/fake-data.ts',
  ],
  targets: [{ file: './src/types.ts', types: ['User', 'Product'] }],
};
```

### Using Generated Builders

```typescript
import { user } from './builders/user.builder.js';

// With validation plugin
const validated = user()
  .withEmail('test@example.com') // ✅ Validated automatically
  .build();

// With fake data plugin
const testUsers = user().buildMany(10); // 10 fake users

// With timestamps plugin
const timestamped = user().withName('Test').build(); // createdAt & updatedAt auto-set

// With UUID plugin
const withUUID = user().withName('Test').build(); // id auto-generated
```

## Tips

1. **Start Simple** - Begin with one plugin, test it, then add more
2. **Test Thoroughly** - Write tests for each plugin
3. **Keep Focused** - One plugin = one concern
4. **Document Well** - Add JSDoc to all methods
5. **Version Properly** - Use semantic versioning

## Next Steps

<div class="next-steps">

### ⚡ Best Practices

Critical patterns: **[Best Practices →](/guide/plugins/best-practices)**

### 🔍 API Reference

Complete API documentation: **[API Reference →](/guide/plugins/api-reference)**

### 🚀 Getting Started

Learn the basics: **[Getting Started →](/guide/plugins/getting-started)**

### 📖 API Reference

Quick lookup: **[API Reference →](/guide/plugins/api-reference)**

</div>

<style scoped>
.next-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
</style>
