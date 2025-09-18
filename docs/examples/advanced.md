# Advanced Patterns

This guide covers advanced TypeScript patterns and how Fluent Gen handles complex type scenarios including utility types, conditional types, template literals, and sophisticated type manipulation.

## Complex Union and Intersection Types

Fluent Gen handles sophisticated union and intersection type patterns:

```typescript
// advanced-types.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AdminCapabilities {
  canDelete: boolean;
  canModifyUsers: boolean;
  accessLevel: number;
}

export interface ModeratorCapabilities {
  canModerate: boolean;
  canBan: boolean;
  regions: string[];
}

// Complex intersection types
export interface AdminUser extends User, AdminCapabilities {
  role: 'admin';
  permissions: string[];
}

export interface ModeratorUser extends User, ModeratorCapabilities {
  role: 'moderator';
  assignedChannels: string[];
}

// Complex union with discriminated unions
export type UserRole = AdminUser | ModeratorUser | (User & { role: 'regular' });

export interface ComplexType {
  union: string | number | boolean;
  intersection: User & { metadata: Record<string, unknown> };
  array: (string | number)[];
  tuple: [string, number, boolean, ...string[]];
  literal: 'success' | 'error' | 'pending' | 42;
  nested: {
    deep: {
      value: string | {
        complex: boolean;
        nested: number[];
      };
    };
  };
}
```

### Usage with Complex Types

```typescript
import {
  adminUserBuilder,
  moderatorUserBuilder,
  complexTypeBuilder
} from './builders';

// Admin user with intersection types
const adminUser = adminUserBuilder()
  .withId('admin-123')
  .withName('Alice Admin')
  .withEmail('alice@company.com')
  .withRole('admin')
  .withCanDelete(true)
  .withCanModifyUsers(true)
  .withAccessLevel(10)
  .withPermissions(['users:read', 'users:write', 'users:delete'])();

// Moderator user
const moderatorUser = moderatorUserBuilder()
  .withId('mod-456')
  .withName('Bob Moderator')
  .withEmail('bob@company.com')
  .withRole('moderator')
  .withCanModerate(true)
  .withCanBan(false)
  .withRegions(['US', 'CA'])
  .withAssignedChannels(['general', 'support'])();

// Complex nested structure
const complexData = complexTypeBuilder()
  .withUnion('string value') // or number or boolean
  .withIntersection({
    id: 'user-789',
    name: 'John',
    email: 'john@example.com',
    metadata: {
      source: 'api',
      version: 2,
      custom: true
    }
  })
  .withArray(['string', 42, 'mixed'])
  .withTuple(['first', 100, true, 'rest1', 'rest2'])
  .withLiteral('success')
  .withNested({
    deep: {
      value: {
        complex: true,
        nested: [1, 2, 3, 4, 5]
      }
    }
  })();
```

## Template Literal Types

Handle template literal type patterns:

```typescript
// template-types.ts
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type Environment = 'dev' | 'staging' | 'prod';
export type ApiVersion = 'v1' | 'v2' | 'v3';

// Template literal types
export type ApiEndpoint = `/${ApiVersion}/${string}`;
export type EnvironmentUrl = `https://${Environment}.api.company.com`;
export type HttpHeader = `x-${string}`;

export interface ApiConfig {
  method: HttpMethod;
  endpoint: ApiEndpoint;
  baseUrl: EnvironmentUrl;
  headers: Record<HttpHeader, string>;
  version: ApiVersion;
}

// More complex template literals
export type EventType = 'user' | 'order' | 'payment';
export type EventAction = 'created' | 'updated' | 'deleted';
export type EventName = `${EventType}.${EventAction}`;

export interface Event<T extends EventName = EventName> {
  type: T;
  timestamp: Date;
  payload: T extends `user.${EventAction}`
    ? { userId: string; userData?: User }
    : T extends `order.${EventAction}`
    ? { orderId: string; orderData?: Order }
    : T extends `payment.${EventAction}`
    ? { paymentId: string; amount: number }
    : unknown;
}
```

### Template Literal Usage

```typescript
import { apiConfigBuilder, eventBuilder } from './builders';

// API configuration with template literals
const apiConfig = apiConfigBuilder()
  .withMethod('POST')
  .withEndpoint('/v2/users')
  .withBaseUrl('https://prod.api.company.com')
  .withHeaders({
    'x-api-key': 'secret-key',
    'x-correlation-id': 'req-123',
    'x-client-version': '1.0.0'
  })
  .withVersion('v2')();

// Type-safe events
const userCreatedEvent = eventBuilder<'user.created'>()
  .withType('user.created')
  .withTimestamp(new Date())
  .withPayload({
    userId: 'user-123',
    userData: {
      id: 'user-123',
      name: 'New User',
      email: 'newuser@example.com'
    }
  })();

const orderUpdatedEvent = eventBuilder<'order.updated'>()
  .withType('order.updated')
  .withTimestamp(new Date())
  .withPayload({
    orderId: 'order-456',
    orderData: {
      id: 'order-456',
      customerId: 'customer-789',
      total: 99.99
    }
  })();
```

## Recursive and Circular Types

Fluent Gen handles recursive and circular type references:

```typescript
// recursive-types.ts
export interface TreeNode<T = any> {
  id: string;
  value: T;
  children: TreeNode<T>[];
  parent?: TreeNode<T>;
  metadata: {
    depth: number;
    isLeaf: boolean;
  };
}

export interface MenuItem {
  id: string;
  label: string;
  url?: string;
  icon?: string;
  children: MenuItem[];
  permissions: string[];
}

export interface Organization {
  id: string;
  name: string;
  parentOrg?: Organization;
  childOrgs: Organization[];
  employees: Employee[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  manager?: Employee;
  reports: Employee[];
  organization: Organization;
}
```

### Recursive Type Usage

```typescript
import {
  treeNodeBuilder,
  menuItemBuilder,
  organizationBuilder,
  employeeBuilder
} from './builders';

// Build a tree structure
const rootNode = treeNodeBuilder<string>()
  .withId('root')
  .withValue('Root Node')
  .withChildren([
    treeNodeBuilder<string>()
      .withId('child-1')
      .withValue('Child 1')
      .withChildren([
        treeNodeBuilder<string>()
          .withId('grandchild-1')
          .withValue('Grandchild 1')
          .withChildren([])
          .withMetadata({ depth: 2, isLeaf: true })()
      ])
      .withMetadata({ depth: 1, isLeaf: false })(),

    treeNodeBuilder<string>()
      .withId('child-2')
      .withValue('Child 2')
      .withChildren([])
      .withMetadata({ depth: 1, isLeaf: true })()
  ])
  .withMetadata({ depth: 0, isLeaf: false })();

// Navigation menu with nested items
const navigationMenu = menuItemBuilder()
  .withId('main-nav')
  .withLabel('Main Navigation')
  .withChildren([
    menuItemBuilder()
      .withId('dashboard')
      .withLabel('Dashboard')
      .withUrl('/dashboard')
      .withIcon('dashboard')
      .withChildren([])
      .withPermissions(['dashboard:read'])(),

    menuItemBuilder()
      .withId('users')
      .withLabel('Users')
      .withIcon('users')
      .withChildren([
        menuItemBuilder()
          .withId('user-list')
          .withLabel('User List')
          .withUrl('/users')
          .withChildren([])
          .withPermissions(['users:read'])(),

        menuItemBuilder()
          .withId('user-create')
          .withLabel('Create User')
          .withUrl('/users/create')
          .withChildren([])
          .withPermissions(['users:write'])()
      ])
      .withPermissions(['users:read'])()
  ])
  .withPermissions([])();
```

## Advanced Conditional Types

Complex conditional type patterns:

```typescript
// conditional-types.ts
export type Flatten<T> = T extends (infer U)[] ? U : T;
export type NonNullable<T> = T extends null | undefined ? never : T;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ApiMethod<
  TPath extends string,
  TMethod extends string,
  TRequest = void,
  TResponse = unknown
> {
  path: TPath;
  method: TMethod;
  request: TMethod extends 'GET' | 'DELETE' ? void : TRequest;
  response: TResponse;
  config: {
    timeout: number;
    retries: number;
    cache: TMethod extends 'GET' ? boolean : false;
  };
}

// Conditional response types
export type ApiResponse<T> = T extends string
  ? { message: T; type: 'text' }
  : T extends number
  ? { value: T; type: 'numeric' }
  : T extends boolean
  ? { flag: T; type: 'boolean' }
  : T extends any[]
  ? { items: T; count: number; type: 'array' }
  : { data: T; type: 'object' };

export interface ConditionalEndpoint<TData> {
  path: string;
  response: ApiResponse<TData>;
  metadata: {
    cached: boolean;
    lastFetch?: Date;
  };
}
```

### Conditional Type Usage

```typescript
import { apiMethodBuilder, conditionalEndpointBuilder } from './builders';

// GET method (no request body)
const getUserMethod = apiMethodBuilder<'/users/{id}', 'GET', void, User>()
  .withPath('/users/{id}')
  .withMethod('GET')
  .withRequest(undefined) // void for GET
  .withResponse({
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com'
  })
  .withConfig({
    timeout: 5000,
    retries: 3,
    cache: true // allowed for GET
  })();

// POST method (with request body)
const createUserMethod = apiMethodBuilder<'/users', 'POST', CreateUserRequest, User>()
  .withPath('/users')
  .withMethod('POST')
  .withRequest({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'secure123'
  })
  .withResponse({
    id: 'user-456',
    name: 'Jane Doe',
    email: 'jane@example.com'
  })
  .withConfig({
    timeout: 10000,
    retries: 2,
    cache: false // false for non-GET
  })();

// Different response types trigger different API response shapes
const stringEndpoint = conditionalEndpointBuilder<string>()
  .withPath('/api/message')
  .withResponse({
    message: 'Hello World',
    type: 'text'
  })
  .withMetadata({
    cached: false
  })();

const arrayEndpoint = conditionalEndpointBuilder<User[]>()
  .withPath('/api/users')
  .withResponse({
    items: [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' }
    ],
    count: 2,
    type: 'array'
  })
  .withMetadata({
    cached: true,
    lastFetch: new Date()
  })();
```

## Mapped Type Patterns

Advanced mapped type scenarios:

```typescript
// mapped-types.ts
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  settings?: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
}

// Mapped type variations
export interface CreateUser extends Optional<BaseUser, 'id'> {}
export interface UpdateUser extends Optional<BaseUser, keyof BaseUser> {}
export interface PublicUser extends Pick<BaseUser, 'id' | 'name' | 'avatar'> {}
export interface RequiredUser extends Required<BaseUser, 'avatar' | 'bio' | 'settings'> {}

// Form field mapping
export type FormField<T> = {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
};

export type UserForm = {
  [K in keyof BaseUser]: FormField<BaseUser[K]>;
} & {
  isValid: boolean;
  isSubmitting: boolean;
};

// Validation schema mapping
export type ValidationRule<T> = {
  required?: boolean;
  validator?: (value: T) => boolean | string;
  message?: string;
};

export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};
```

### Mapped Type Usage

```typescript
import {
  createUserBuilder,
  updateUserBuilder,
  publicUserBuilder,
  requiredUserBuilder,
  userFormBuilder,
  validationSchemaBuilder
} from './builders';

// Create user (id is optional)
const newUser = createUserBuilder()
  .withName('John Doe')
  .withEmail('john@example.com')
  .withAvatar('https://example.com/avatar.jpg')
  .withBio('Software developer')
  .withSettings({
    theme: 'dark',
    notifications: true,
    language: 'en'
  })();

// Update user (all fields optional)
const userUpdate = updateUserBuilder()
  .withName('John Smith')
  .withBio('Senior Software Developer')();

// Public user view (limited fields)
const publicProfile = publicUserBuilder()
  .withId('user-123')
  .withName('John Smith')
  .withAvatar('https://example.com/new-avatar.jpg')();

// Required user (all optional fields now required)
const completeUser = requiredUserBuilder()
  .withId('user-123')
  .withName('John Smith')
  .withEmail('john@example.com')
  .withAvatar('https://example.com/avatar.jpg') // required
  .withBio('Senior Software Developer') // required
  .withSettings({ // required
    theme: 'dark',
    notifications: true,
    language: 'en'
  })();

// Form state management
const userForm = userFormBuilder()
  .withId({
    value: 'user-123',
    touched: false,
    dirty: false
  })
  .withName({
    value: 'John',
    touched: true,
    dirty: true
  })
  .withEmail({
    value: 'john@example.com',
    touched: true,
    dirty: false
  })
  .withAvatar({
    value: undefined,
    touched: false,
    dirty: false
  })
  .withBio({
    value: undefined,
    touched: false,
    dirty: false
  })
  .withSettings({
    value: undefined,
    touched: false,
    dirty: false
  })
  .withIsValid(false)
  .withIsSubmitting(false)();

// Validation schema
const userValidation = validationSchemaBuilder<BaseUser>()
  .withId({
    required: true,
    validator: (value: string) => value.length > 0,
    message: 'ID is required'
  })
  .withName({
    required: true,
    validator: (value: string) => value.length >= 2,
    message: 'Name must be at least 2 characters'
  })
  .withEmail({
    required: true,
    validator: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Valid email is required'
  })();
```

## Plugin and Extension Patterns

Advanced patterns for extending and customizing builders:

```typescript
// extension-types.ts
export interface Plugin<T = any> {
  name: string;
  version: string;
  hooks: {
    beforeBuild?: (data: T) => T;
    afterBuild?: (result: T) => T;
    validate?: (data: T) => boolean | string;
  };
  config?: Record<string, any>;
}

export interface Extensible<T> {
  data: T;
  plugins: Plugin<T>[];
  addPlugin(plugin: Plugin<T>): void;
  removePlugin(name: string): void;
  build(): T;
}

export interface Builder<T> extends Extensible<T> {
  clone(): Builder<T>;
  merge(other: Partial<T>): Builder<T>;
  validate(): boolean;
  reset(): Builder<T>;
}

// Middleware pattern
export type Middleware<T> = (
  data: T,
  next: (data: T) => T
) => T;

export interface MiddlewareChain<T> {
  middlewares: Middleware<T>[];
  use(middleware: Middleware<T>): void;
  execute(data: T): T;
}
```

### Extension Pattern Usage

```typescript
import { pluginBuilder, extensibleBuilder, middlewareChainBuilder } from './builders';

// Create a validation plugin
const validationPlugin = pluginBuilder<User>()
  .withName('user-validation')
  .withVersion('1.0.0')
  .withHooks({
    validate: (user: User) => {
      if (!user.email.includes('@')) {
        return 'Invalid email format';
      }
      if (user.name.length < 2) {
        return 'Name too short';
      }
      return true;
    },
    beforeBuild: (user: User) => ({
      ...user,
      name: user.name.trim(),
      email: user.email.toLowerCase()
    })
  })
  .withConfig({
    strictMode: true,
    autoFormat: true
  })();

// Create an audit plugin
const auditPlugin = pluginBuilder<User>()
  .withName('user-audit')
  .withVersion('1.0.0')
  .withHooks({
    afterBuild: (user: User) => ({
      ...user,
      metadata: {
        ...user.metadata,
        buildTimestamp: new Date(),
        buildVersion: '1.0.0'
      }
    })
  })();

// Extensible builder with plugins
const extensibleUserBuilder = extensibleBuilder<User>()
  .withData({
    id: 'user-123',
    name: '  John Doe  ', // Will be trimmed by validation plugin
    email: 'JOHN@EXAMPLE.COM' // Will be lowercased
  })
  .withPlugins([validationPlugin, auditPlugin])
  .withAddPlugin((plugin) => {
    extensibleUserBuilder.plugins.push(plugin);
  })
  .withRemovePlugin((name) => {
    const index = extensibleUserBuilder.plugins.findIndex(p => p.name === name);
    if (index >= 0) {
      extensibleUserBuilder.plugins.splice(index, 1);
    }
  })
  .withBuild(() => {
    let result = extensibleUserBuilder.data;

    // Apply beforeBuild hooks
    for (const plugin of extensibleUserBuilder.plugins) {
      if (plugin.hooks.beforeBuild) {
        result = plugin.hooks.beforeBuild(result);
      }
    }

    // Validate
    for (const plugin of extensibleUserBuilder.plugins) {
      if (plugin.hooks.validate) {
        const validation = plugin.hooks.validate(result);
        if (validation !== true) {
          throw new Error(`Validation failed: ${validation}`);
        }
      }
    }

    // Apply afterBuild hooks
    for (const plugin of extensibleUserBuilder.plugins) {
      if (plugin.hooks.afterBuild) {
        result = plugin.hooks.afterBuild(result);
      }
    }

    return result;
  })();

// Middleware chain for processing
const userProcessingChain = middlewareChainBuilder<User>()
  .withMiddlewares([
    // Normalization middleware
    (user, next) => {
      const normalized = {
        ...user,
        name: user.name.trim(),
        email: user.email.toLowerCase()
      };
      return next(normalized);
    },

    // Validation middleware
    (user, next) => {
      if (!user.email.includes('@')) {
        throw new Error('Invalid email');
      }
      return next(user);
    },

    // Enrichment middleware
    (user, next) => {
      const enriched = {
        ...user,
        metadata: {
          processedAt: new Date(),
          source: 'builder'
        }
      };
      return next(enriched);
    }
  ])
  .withUse((middleware) => {
    userProcessingChain.middlewares.push(middleware);
  })
  .withExecute((user) => {
    return userProcessingChain.middlewares.reduce(
      (result, middleware, index) => {
        const next = (data: User) => {
          if (index === userProcessingChain.middlewares.length - 1) {
            return data;
          }
          return userProcessingChain.middlewares[index + 1](
            data,
            (nextData) => nextData
          );
        };
        return middleware(result, next);
      },
      user
    );
  })();
```

## Performance Optimization Patterns

Advanced patterns for optimizing builder performance:

```typescript
// performance-types.ts
export interface CachedBuilder<T> {
  cache: Map<string, T>;
  build(key?: string): T;
  invalidate(key?: string): void;
  precompute(keys: string[]): void;
}

export interface LazyBuilder<T> {
  computed: boolean;
  compute(): T;
  reset(): void;
}

export interface PooledBuilder<T> {
  pool: T[];
  poolSize: number;
  acquire(): T;
  release(item: T): void;
  drain(): void;
}
```

These advanced patterns demonstrate how Fluent Gen handles sophisticated TypeScript type scenarios while maintaining type safety and developer experience. The generated builders preserve all type information and provide IntelliSense support for even the most complex type relationships.

## Next Steps

- [Explore the complete API reference](../api/overview.md)
- [Learn about plugin development](../api/plugins.md)
- [Understand type resolution internals](../api/resolver.md)
- [Configure advanced generation options](../guide/configuration.md)