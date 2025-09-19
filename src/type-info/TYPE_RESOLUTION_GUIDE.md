# Type Resolution Guide

## Overview

This guide explains how TypeScript resolves types and when our custom resolvers are needed for the fluent builder generation system.

## Key Understanding: TypeScript Does Most of the Work

**Important**: TypeScript's compiler already resolves most conditional and mapped types to their final form. Our resolvers should primarily rely on TypeScript's built-in resolution and only handle special cases.

## When TypeScript Resolves Types (Most Cases)

### Conditional Types

TypeScript automatically resolves conditional types when the condition is known:

```typescript
// TypeScript resolves these automatically:
type IsString<T> = T extends string ? true : false;
type Test = IsString<string>; // Resolved to: true

type GetUser<T> = T extends "admin" ? AdminUser : BasicUser;
type User = GetUser<"user">; // Resolved to: BasicUser
```

In these cases, when we call `type.getProperties()`, we already get the resolved properties.

### Mapped Types

TypeScript automatically expands mapped types when the input type is known:

```typescript
// TypeScript expands these automatically:
type Readonly<T> = { readonly [K in keyof T]: T[K] };
type ReadonlyUser = Readonly<User>; // Expanded to object with readonly properties

type Pick<T, K> = { [P in K]: T[P] };
type BasicUser = Pick<User, "id" | "name">; // Filtered to just id and name
```

Again, `type.getProperties()` returns the already-expanded properties.

## When Our Resolvers Are Needed (Special Cases)

### 1. Index Signatures

Index signatures don't create properties but define a pattern for dynamic keys:

```typescript
interface Dictionary {
  [key: string]: string; // No properties, just an index signature
}
```

**MappedTypeResolver** handles these by:

- Detecting index signatures via `type.getStringIndexType()` or `type.getNumberIndexType()`
- Returning an object with `indexSignature` metadata

### 2. Unresolved Generic Types

When types depend on unresolved generic parameters:

```typescript
interface Container<T> {
  data: Partial<T>; // Can't be resolved until T is known
  isArray: IsArray<T>; // Conditional that depends on T
}
```

**Our resolvers handle these by**:

- Detecting unresolved generics (type text contains angle brackets, no properties)
- Returning `TypeKind.Generic` to indicate deferred resolution

## Implementation Strategy

### ConditionalTypeResolver

```typescript
async resolveConditionalType(type: Type, ...) {
  // Most conditional types are already resolved
  if (!this.isUnresolvedConditionalType(type)) {
    return ok(null);  // Let normal resolution handle it
  }

  // Only handle unresolved generics
  return ok({ kind: TypeKind.Generic, name: type.getText() });
}
```

### MappedTypeResolver

```typescript
async resolveMappedType(type: Type, ...) {
  // Handle index signatures
  if (this.hasIndexSignature(type)) {
    return this.expandIndexSignatureType(type, ...);
  }

  // Handle unresolved generic mapped types
  if (this.isUnresolvedMappedType(type)) {
    return ok({ kind: TypeKind.Generic, name: type.getText() });
  }

  // TypeScript has already expanded this
  return ok(null);
}
```

## For Builders

When generating fluent builders:

1. **Resolved Types**: Use the properties directly from TypeScript
2. **Index Signatures**: Generate dynamic setter methods or a generic `set(key, value)` method
3. **Unresolved Generics**: Defer resolution until the generic is instantiated

## Testing Guidelines

### DO Test

- Index signature handling
- Unresolved generic detection
- That resolved types return `null` (letting TypeScript handle them)

### DON'T Test

- Re-implementing TypeScript's type resolution
- Parsing conditional type syntax
- Evaluating type conditions manually

## Common Pitfalls to Avoid

1. **Don't parse type text**: Avoid regex patterns like `/T extends .* \? .* : .*/`
2. **Don't re-implement TypeScript**: If TypeScript resolved it, use the result
3. **Don't over-engineer**: Most types are already resolved
4. **Trust TypeScript**: When `type.getProperties()` returns properties, they're correct

## Summary

- **95% of cases**: TypeScript has already done the work
- **5% of cases**: Index signatures and unresolved generics need special handling
- **Goal**: Generate builders for the final, resolved object shape
- **Strategy**: Rely on TypeScript, handle only what it doesn't resolve

