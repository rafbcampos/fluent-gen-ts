# Plugin API Quick Reference

<!-- prettier-ignore -->
::: tip Quick Lookup
This page is your quick reference. For detailed explanations, see the main guide sections.
:::

## Plugin Builder API

### Creating a Plugin

```typescript
import { createPlugin } from 'fluent-gen-ts';

const plugin = createPlugin(name: string, version: string)
  .setDescription(description: string)
  .requireImports(configurator: (manager) => manager)
  .transformPropertyMethods(configurator: (builder) => builder)
  .addMethod(configurator: (builder) => builder)
  .transformBuildMethod(configurator: (builder) => builder)
  // ... other methods
  .build();
```

### Metadata

| Method            | Parameters                      | Description             |
| ----------------- | ------------------------------- | ----------------------- |
| `createPlugin`    | `name: string, version: string` | Start building a plugin |
| `.setDescription` | `description: string`           | Set plugin description  |

### Import Management

| Method                     | Parameters                           | Description               |
| -------------------------- | ------------------------------------ | ------------------------- |
| `.requireImports`          | `configurator: (imports) => imports` | Add required imports      |
| `imports.addExternal`      | `pkg: string, names: string[]`       | Import from package       |
| `imports.addInternal`      | `path: string, names: string[]`      | Import from local file    |
| `imports.addExternalTypes` | `pkg: string, types: string[]`       | Import types from package |
| `imports.addInternalTypes` | `path: string, types: string[]`      | Import types from file    |

### Property Transformations

| Method                      | Parameters                           | Description                  |
| --------------------------- | ------------------------------------ | ---------------------------- |
| `.transformPropertyMethods` | `configurator: (builder) => builder` | Transform property methods   |
| `builder.when`              | `predicate: (ctx) => boolean`        | Condition for transformation |
| `builder.setParameter`      | `type: string \| function`           | Set parameter type           |
| `builder.setExtractor`      | `code: string`                       | Set value extraction code    |
| `builder.setValidator`      | `code: string`                       | Set validation code          |
| `builder.done`              | `()`                                 | Complete current rule        |

**Context Object (`ctx`):**

```typescript
{
  property: PropertyInfo;        // Property metadata
  propertyType: TypeInfo;        // Property type info
  type: TypeMatcherInterface;    // Type matcher
  typeName: string;              // Builder type name
  builderName: string;           // Builder class name
  originalTypeString: string;    // Original type as string
  isOptional(): boolean;         // Check if optional
  isReadonly(): boolean;         // Check if readonly
}
```

### Custom Methods

| Method                  | Parameters                             | Description          |
| ----------------------- | -------------------------------------- | -------------------- |
| `.addMethod`            | `configurator: (method) => method`     | Add custom method    |
| `method.when`           | `predicate: (ctx) => boolean`          | Condition for method |
| `method.name`           | `name: string`                         | Set method name      |
| `method.parameter`      | `name: string, type: string, options?` | Add parameter        |
| `method.returns`        | `type: string \| function`             | Set return type      |
| `method.implementation` | `code: string \| function`             | Set method body      |
| `method.jsDoc`          | `doc: string`                          | Add JSDoc comment    |

**Context Object (`ctx`):**

```typescript
{
  builderName: string;           // Builder class name
  typeName: string;              // Type being built
  properties: PropertyInfo[];    // All properties
  typeInfo: TypeInfo;            // Type information
  genericParams: string;         // Generic parameters
  genericConstraints: string;    // Generic constraints
  hasProperty(name: string): boolean;
  getProperty(name: string): PropertyInfo | undefined;
  getRequiredProperties(): PropertyInfo[];
  getOptionalProperties(): PropertyInfo[];
}
```

### Build Method Transformation

| Method                   | Parameters                               | Description             |
| ------------------------ | ---------------------------------------- | ----------------------- |
| `.transformBuildMethod`  | `configurator: (transform) => transform` | Transform build method  |
| `transform.when`         | `predicate: (ctx) => boolean`            | Condition for transform |
| `transform.insertBefore` | `marker: string, code: string`           | Insert before marker    |
| `transform.insertAfter`  | `marker: string, code: string`           | Insert after marker     |
| `transform.replace`      | `marker: string, code: string`           | Replace marker          |
| `transform.wrapMethod`   | `before: string, after: string`          | Wrap method             |

**Context Object (`ctx`):**

```typescript
{
  buildMethodCode: string;       // Current build method code
  builderName: string;           // Builder class name
  typeName: string;              // Type being built
  properties: PropertyInfo[];    // All properties
  options: GeneratorOptions;     // Generator options
  resolvedType: ResolvedType;    // Resolved type info
}
```

**Common markers:**

- `'return this.buildWithDefaults'` - Before final return
- `'const result ='` - After build completes
- `'return {'` - Start of return statement

## Type Matcher API

Import matchers:

```typescript
import {
  primitive,
  object,
  array,
  union,
  intersection,
  reference,
  generic,
  literal,
} from 'fluent-gen-ts';
```

### Primitive Types

```typescript
primitive(...names: string[])

// Examples:
primitive('string')
primitive('number', 'string')  // Match multiple
```

### Object Types

```typescript
object(name?: string)
  .withGeneric(name?: string)
  .withProperty(name: string, type?: TypeMatcher)
  .withProperties(...names: string[])

// Examples:
object('User')
object().withProperty('email', primitive('string'))
object('User').withGeneric()
```

### Array Types

```typescript
array().of(matcher: TypeMatcher)

// Examples:
array()
array().of(primitive('string'))
array().of(object('User'))
```

### Union Types

```typescript
union()
  .containing(matcher: TypeMatcher)
  .exact(...matchers: TypeMatcher[])

// Examples:
union().containing(primitive('null'))
union().exact(primitive('string'), primitive('number'))
```

### Intersection Types

```typescript
intersection()
  .including(matcher: TypeMatcher)
  .exact(...matchers: TypeMatcher[])
```

### Other Matchers

```typescript
reference(name?: string)     // Type reference
generic(name?: string)       // Generic type
literal(value: any)          // Literal value
any()                        // Any type
never()                      // Never type

// Logical operators
or(...matchers)              // Match any
and(...matchers)             // Match all
not(matcher)                 // Negate match
```

## Type Checker (Context)

Available on `ctx.type`:

| Method                   | Returns                   | Description           |
| ------------------------ | ------------------------- | --------------------- |
| `.isPrimitive(...names)` | `boolean`                 | Match primitive types |
| `.isObject(name?)`       | `ObjectTypeMatcher`       | Match object types    |
| `.isArray()`             | `ArrayTypeMatcher`        | Match arrays          |
| `.isUnion()`             | `UnionTypeMatcher`        | Match unions          |
| `.isIntersection()`      | `IntersectionTypeMatcher` | Match intersections   |
| `.isReference(name?)`    | `boolean`                 | Match type references |
| `.isGeneric(name?)`      | `boolean`                 | Match generic types   |
| `.matches(matcher)`      | `boolean`                 | Match any matcher     |
| `.toString()`            | `string`                  | Type as string        |

## Deep Type Transformations

### Transform Deep

```typescript
transformTypeDeep(typeInfo: TypeInfo, transformer: TypeTransformer)

// Transformer interface:
{
  onPrimitive?: (type) => string | TypeInfo | null;
  onObject?: (type) => string | TypeInfo | null;
  onArray?: (type) => string | TypeInfo | null;
  onUnion?: (type) => string | TypeInfo | null;
  // ... etc
}
```

### TypeDeepTransformer (Fluent API)

```typescript
new TypeDeepTransformer(typeInfo)
  .replace(matcher: TypeMatcher, replacement: string | function)
  .replaceIf(predicate: function, replacement: string | function)
  .hasMatch(matcher: TypeMatcher): boolean
  .findMatches(matcher: TypeMatcher): TypeInfo[]
  .toString(): string

// Example:
ctx.type.transformDeep()
  .replace(primitive('string'), 'string | TaggedValue<string>')
  .toString()
```

### Utility Functions

```typescript
typeInfoToString(typeInfo: TypeInfo): string
containsTypeDeep(typeInfo: TypeInfo, matcher: TypeMatcher): boolean
findTypesDeep(typeInfo: TypeInfo, matcher: TypeMatcher): TypeInfo[]
```

## Lifecycle Hooks

| Hook                | When                   | Parameters                 | Returns           |
| ------------------- | ---------------------- | -------------------------- | ----------------- |
| `beforeParse`       | Before parsing file    | `ParseContext`             | `ParseContext`    |
| `afterParse`        | After parsing          | `ParseContext, Type`       | `Type`            |
| `beforeResolve`     | Before type resolution | `ResolveContext`           | `ResolveContext`  |
| `afterResolve`      | After resolution       | `ResolveContext, TypeInfo` | `TypeInfo`        |
| `beforeGenerate`    | Before code generation | `GenerateContext`          | `GenerateContext` |
| `transformProperty` | Per property           | `PropertyInfo`             | `PropertyInfo`    |
| `transformType`     | Per type               | `Type, TypeInfo`           | `TypeInfo`        |
| `afterGenerate`     | After generation       | `code: string, context`    | `string`          |

## TypeInfo Structure

```typescript
interface TypeInfo {
  kind: TypeKind; // Type category
  name?: string; // Type name
  properties?: PropertyInfo[]; // Object properties
  elementType?: TypeInfo; // Array element type
  types?: TypeInfo[]; // Union/Intersection types
  genericParams?: TypeInfo[]; // Generic parameters
  value?: any; // Literal value
}

enum TypeKind {
  Primitive = 'primitive',
  Object = 'object',
  Array = 'array',
  Union = 'union',
  Intersection = 'intersection',
  Reference = 'reference',
  Generic = 'generic',
  Literal = 'literal',
  Any = 'any',
  Never = 'never',
}
```

## PropertyInfo Structure

```typescript
interface PropertyInfo {
  name: string; // Property name
  type: TypeInfo; // Property type
  optional: boolean; // Is optional?
  readonly: boolean; // Is readonly?
  jsDoc?: string; // JSDoc comment
}
```

## Common Patterns

### Email Validation

```typescript
.when(ctx => ctx.property.name === 'email')
.setValidator('if (value && !isEmail(value)) throw new Error("Invalid")')
```

### Type Transformation

```typescript
.when(ctx => ctx.property.name.endsWith('Id'))
.setParameter('string | number')
.setExtractor('String(value)')
```

### Conditional Custom Method

```typescript
.addMethod(method => method
  .when(ctx => ctx.builderName === 'UserBuilder')
  .name('withFakeEmail')
  .returns('this')
  .implementation('return this.email("fake@example.com");')
)
```

### Conditional Build Hook

```typescript
.transformBuildMethod(transform =>
  transform
    .when(ctx => ctx.builderName === 'UserBuilder')
    .insertBefore('return {', 'this.validate();')
)
```

### Custom Method (unconditional)

```typescript
.addMethod(method => method
  .name('withDefaults')
  .returns('this')
  .implementation('/* set default values */')
)
```

### Deep Transform

```typescript
.when(ctx => ctx.type.containsDeep(primitive('string')))
.setParameter(ctx => ctx.type.transformDeep()
  .replace(primitive('string'), 'string | Tagged<string>')
  .toString()
)
```

## Error Handling

```typescript
import { Result, ok, err } from 'fluent-gen-ts';

// Result type
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

// Helpers
ok<T>(value: T): Result<T>
err<T>(error: Error): Result<T>
```

## Testing

```typescript
// Unit test
expect(plugin.name).toBe('my-plugin');
expect(plugin.transformPropertyMethod).toBeDefined();

// Integration test
const user = user().withEmail('test@example.com').build();
expect(user.email).toBe('test@example.com');
```

## Rule Ordering

<!-- prettier-ignore -->
::: danger CRITICAL
**First matching rule wins!** Always place specific rules before generic ones:

```typescript
.when(ctx => ctx.type.matches(object('AssetWrapper')))  // Specific FIRST
.done()
.when(ctx => ctx.type.containsDeep(primitive('string'))) // Generic LAST
```

:::

## Next Steps

- **[Getting Started](/guide/plugins/getting-started)** - Build your first
  plugin
- **[Cookbook](/guide/plugins/cookbook)** - Copy-paste recipes
- **[Best Practices](/guide/plugins/best-practices)** - Critical patterns
- **[Full API Reference](/api/reference)** - Complete API documentation

<style scoped>
table {
  font-size: 0.9em;
}

th {
  background-color: var(--vp-c-bg-soft);
}

code {
  font-size: 0.85em;
}
</style>
