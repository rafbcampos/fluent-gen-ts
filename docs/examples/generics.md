# Generic Type Examples

Fluent Gen provides full support for TypeScript generics, including type parameters, constraints, defaults, and complex generic relationships. This guide demonstrates how to work with generic interfaces and types.

## Basic Generic Interface

Start with a simple generic interface:

```typescript
// types.ts
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: number;
}
```

### Generate and Use Generic Builder

```bash
npx fluent-gen generate ./types.ts ApiResponse
```

```typescript
import { apiResponseBuilder } from './ApiResponse.builder';

// Using with explicit type
const userResponse = apiResponseBuilder<User>()
  .withData({
    id: '123',
    name: 'John Doe',
    email: 'john@example.com'
  })
  .withSuccess(true)
  .withMessage('User retrieved successfully')
  .withTimestamp(Date.now())();

// Using with inferred type
const stringResponse = apiResponseBuilder()
  .withData('Hello World')
  .withSuccess(true)
  .withTimestamp(Date.now())();

// Using with array type
const listResponse = apiResponseBuilder<string[]>()
  .withData(['item1', 'item2', 'item3'])
  .withSuccess(true)
  .withTimestamp(Date.now())();
```

## Multiple Type Parameters

Handle interfaces with multiple generic parameters:

```typescript
// types.ts
export interface Result<T, E = Error> {
  ok: boolean;
  value?: T;
  error?: E;
}

export interface PaginatedResponse<T, M = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  metadata?: M;
}
```

### Multiple Generic Usage

```typescript
import { resultBuilder, paginatedResponseBuilder } from './builders';

// Success result
const successResult = resultBuilder<string, never>()
  .withOk(true)
  .withValue('Operation completed')();

// Error result with custom error type
interface ValidationError {
  field: string;
  message: string;
}

const errorResult = resultBuilder<never, ValidationError>()
  .withOk(false)
  .withError({
    field: 'email',
    message: 'Email is required'
  })();

// Paginated response with metadata
interface SearchMetadata {
  query: string;
  executionTimeMs: number;
}

const searchResults = paginatedResponseBuilder<User, SearchMetadata>()
  .withData([
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' }
  ])
  .withPagination({
    page: 1,
    limit: 10,
    total: 50,
    hasNext: true,
    hasPrev: false
  })
  .withMetadata({
    query: 'active users',
    executionTimeMs: 45
  })();
```

## Generic Constraints

Work with constrained generic types:

```typescript
// types.ts
export interface Identifiable {
  id: string;
}

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export interface Repository<T extends Identifiable> {
  type: string;
  items: T[];
  findById(id: string): T | undefined;
  create(item: Omit<T, 'id'>): T;
}

export interface AuditableRepository<T extends Identifiable & Timestamped> {
  type: string;
  items: T[];
  audit: {
    createdBy: string;
    updatedBy: string;
  };
}
```

### Constrained Generic Usage

```typescript
import { repositoryBuilder, auditableRepositoryBuilder } from './builders';

// User entity that extends Identifiable
interface User extends Identifiable {
  name: string;
  email: string;
}

// Product entity that extends both constraints
interface Product extends Identifiable, Timestamped {
  name: string;
  price: number;
  category: string;
}

const userRepo = repositoryBuilder<User>()
  .withType('UserRepository')
  .withItems([
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' }
  ])
  .withFindById((id: string) => {
    return userRepo.items.find(item => item.id === id);
  })
  .withCreate((userData: Omit<User, 'id'>) => {
    const newUser = { id: generateId(), ...userData };
    userRepo.items.push(newUser);
    return newUser;
  })();

const productRepo = auditableRepositoryBuilder<Product>()
  .withType('ProductRepository')
  .withItems([
    {
      id: 'prod-1',
      name: 'Laptop',
      price: 999.99,
      category: 'Electronics',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    }
  ])
  .withAudit({
    createdBy: 'admin',
    updatedBy: 'admin'
  })();
```

## Nested Generics

Handle complex nested generic structures:

```typescript
// types.ts
export interface Container<T> {
  value: T;
  metadata: {
    type: string;
    version: number;
  };
}

export interface Service<TRequest, TResponse> {
  name: string;
  process(request: TRequest): Promise<Container<TResponse>>;
  config: {
    timeout: number;
    retries: number;
    transform?: (data: TResponse) => TResponse;
  };
}

export interface ServiceRegistry<T extends Record<string, Service<any, any>>> {
  services: T;
  defaultConfig: {
    timeout: number;
    retries: number;
  };
  getService<K extends keyof T>(name: K): T[K];
}
```

### Nested Generic Usage

```typescript
import { serviceBuilder, serviceRegistryBuilder } from './builders';

// Define request/response types
interface CreateUserRequest {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a service
const userService = serviceBuilder<CreateUserRequest, UserResponse>()
  .withName('UserService')
  .withProcess(async (request: CreateUserRequest) => {
    const user: UserResponse = {
      id: generateId(),
      name: request.name,
      email: request.email,
      createdAt: new Date()
    };

    return {
      value: user,
      metadata: {
        type: 'UserResponse',
        version: 1
      }
    };
  })
  .withConfig({
    timeout: 5000,
    retries: 3,
    transform: (user: UserResponse) => ({
      ...user,
      name: user.name.trim()
    })
  })();

// Service registry with multiple services
const registry = serviceRegistryBuilder()
  .withServices({
    userService,
    // Could add more services here
  })
  .withDefaultConfig({
    timeout: 10000,
    retries: 2
  })
  .withGetService((name) => {
    return registry.services[name];
  })();
```

## Utility Type Integration

Fluent Gen resolves utility types like `Pick`, `Omit`, `Partial`, etc.:

```typescript
// types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'guest';
  profile: {
    bio: string;
    avatar?: string;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

// Utility type interfaces
export interface CreateUserRequest extends Omit<User, 'id' | 'createdAt' | 'updatedAt'> {}

export interface UpdateUserRequest extends Partial<Pick<User, 'name' | 'email' | 'profile'>> {}

export interface UserResponse extends Omit<User, 'password'> {}

export interface PublicUser extends Pick<User, 'id' | 'name' | 'profile'> {}
```

### Utility Type Builder Usage

```typescript
import {
  createUserRequestBuilder,
  updateUserRequestBuilder,
  userResponseBuilder,
  publicUserBuilder
} from './builders';

// Create user request (excludes id, timestamps)
const createRequest = createUserRequestBuilder()
  .withName('John Doe')
  .withEmail('john@example.com')
  .withPassword('securePassword123')
  .withRole('user')
  .withProfile({
    bio: 'Software developer',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  })();

// Update request (partial fields only)
const updateRequest = updateUserRequestBuilder()
  .withName('John Smith')
  .withProfile({
    bio: 'Senior Software Developer',
    avatar: 'https://example.com/avatar.jpg'
  })();

// User response (excludes password)
const userResponse = userResponseBuilder()
  .withId('user-123')
  .withName('John Smith')
  .withEmail('john@example.com')
  .withRole('user')
  .withProfile({
    bio: 'Senior Software Developer',
    avatar: 'https://example.com/avatar.jpg',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  })
  .withCreatedAt(new Date('2024-01-01'))
  .withUpdatedAt(new Date())();

// Public user view (id, name, profile only)
const publicUser = publicUserBuilder()
  .withId('user-123')
  .withName('John Smith')
  .withProfile({
    bio: 'Senior Software Developer',
    avatar: 'https://example.com/avatar.jpg',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  })();
```

## Conditional Types

Advanced conditional type patterns:

```typescript
// types.ts
export type ApiResponseData<T> = T extends string
  ? { message: T }
  : T extends number
  ? { value: T }
  : T extends boolean
  ? { flag: T }
  : { data: T };

export interface ConditionalResponse<T> {
  success: boolean;
  result: ApiResponseData<T>;
  timestamp: number;
}

// More complex conditional type
export type EventPayload<TType extends string> = TType extends 'user.created'
  ? { userId: string; email: string }
  : TType extends 'user.updated'
  ? { userId: string; changes: Record<string, any> }
  : TType extends 'user.deleted'
  ? { userId: string; deletedAt: Date }
  : never;

export interface Event<TType extends string = string> {
  id: string;
  type: TType;
  payload: EventPayload<TType>;
  timestamp: Date;
  source: string;
}
```

### Conditional Type Usage

```typescript
import { conditionalResponseBuilder, eventBuilder } from './builders';

// String response
const stringResponse = conditionalResponseBuilder<string>()
  .withSuccess(true)
  .withResult({ message: 'Operation completed' })
  .withTimestamp(Date.now())();

// Number response
const numberResponse = conditionalResponseBuilder<number>()
  .withSuccess(true)
  .withResult({ value: 42 })
  .withTimestamp(Date.now())();

// Complex object response
const objectResponse = conditionalResponseBuilder<{ users: User[] }>()
  .withSuccess(true)
  .withResult({
    data: {
      users: [
        { id: '1', name: 'Alice', email: 'alice@example.com' }
      ]
    }
  })
  .withTimestamp(Date.now())();

// Event builders with specific types
const userCreatedEvent = eventBuilder<'user.created'>()
  .withId('event-123')
  .withType('user.created')
  .withPayload({
    userId: 'user-456',
    email: 'newuser@example.com'
  })
  .withTimestamp(new Date())
  .withSource('user-service')();

const userUpdatedEvent = eventBuilder<'user.updated'>()
  .withId('event-124')
  .withType('user.updated')
  .withPayload({
    userId: 'user-456',
    changes: { name: 'Updated Name' }
  })
  .withTimestamp(new Date())
  .withSource('user-service')();
```

## Generic Builder Patterns

Common patterns for working with generic builders:

### 1. Builder Factory Functions

```typescript
// builder-factories.ts
import { apiResponseBuilder } from './builders';

export function createSuccessResponse<T>(data: T, message?: string) {
  return apiResponseBuilder<T>()
    .withData(data)
    .withSuccess(true)
    .withMessage(message || 'Success')
    .withTimestamp(Date.now());
}

export function createErrorResponse<T = never>(message: string) {
  return apiResponseBuilder<T>()
    .withSuccess(false)
    .withMessage(message)
    .withTimestamp(Date.now());
}

// Usage
const userSuccessResponse = createSuccessResponse(
  { id: '123', name: 'John' },
  'User retrieved'
)();

const errorResponse = createErrorResponse('User not found')();
```

### 2. Type-Safe Configuration

```typescript
// config-types.ts
export interface DatabaseConfig<TDialect extends 'postgres' | 'mysql' | 'sqlite'> {
  dialect: TDialect;
  connection: TDialect extends 'sqlite'
    ? { filename: string }
    : {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
      };
  pool?: {
    min: number;
    max: number;
  };
}
```

```typescript
import { databaseConfigBuilder } from './builders';

// PostgreSQL config
const pgConfig = databaseConfigBuilder<'postgres'>()
  .withDialect('postgres')
  .withConnection({
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'user',
    password: 'password'
  })
  .withPool({
    min: 2,
    max: 10
  })();

// SQLite config
const sqliteConfig = databaseConfigBuilder<'sqlite'>()
  .withDialect('sqlite')
  .withConnection({
    filename: './database.sqlite'
  })();
```

### 3. Generic Test Utilities

```typescript
// test-utils.ts
import { repositoryBuilder } from './builders';

export function createTestRepository<T extends Identifiable>(
  type: string,
  items: T[] = []
) {
  return repositoryBuilder<T>()
    .withType(type)
    .withItems(items)
    .withFindById((id: string) => items.find(item => item.id === id))
    .withCreate((data: Omit<T, 'id'>) => {
      const item = { id: generateId(), ...data } as T;
      items.push(item);
      return item;
    });
}

// Test usage
describe('UserService', () => {
  it('should work with repository', () => {
    const repo = createTestRepository<User>('UserRepository', [
      { id: '1', name: 'Test User', email: 'test@example.com' }
    ])();

    const service = new UserService(repo);
    const user = service.findById('1');

    expect(user).toBeDefined();
    expect(user?.name).toBe('Test User');
  });
});
```

## Advanced Generic Scenarios

### Mapped Types

```typescript
// types.ts
export interface FormField<T> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

export type Form<T> = {
  [K in keyof T]: FormField<T[K]>;
} & {
  isValid: boolean;
  isSubmitting: boolean;
};

export interface FormBuilder<T> {
  fields: Form<T>;
  validate(): boolean;
  submit(): Promise<void>;
}
```

### Higher-Order Types

```typescript
// types.ts
export interface AsyncState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

export interface Store<TState> {
  state: TState;
  setState(updater: (state: TState) => TState): void;
  subscribe(listener: (state: TState) => void): () => void;
}

export interface AsyncStore<T> extends Store<AsyncState<T>> {
  fetch(): Promise<void>;
  reset(): void;
}
```

## Next Steps

- [Explore advanced patterns](./advanced.md)
- [Learn about plugin development](../api/plugins.md)
- [Understand type resolution](../api/resolver.md)
- [See the complete API reference](../api/overview.md)