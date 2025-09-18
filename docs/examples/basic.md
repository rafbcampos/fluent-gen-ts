# Basic Usage Examples

This guide provides practical examples of using Fluent Gen with common TypeScript patterns. All examples use interfaces and types from real scenarios.

## Simple Interface

Let's start with a basic user interface:

```typescript
// types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}
```

### Generate the Builder

```bash
npx fluent-gen generate ./types.ts User
```

### Generated Builder Usage

```typescript
import { userBuilder } from './User.builder';

// Create a user with all required fields
const basicUser = userBuilder()
  .withId('user-123')
  .withName('Alice Johnson')
  .withEmail('alice@example.com')();

console.log(basicUser);
// Output: { id: 'user-123', name: 'Alice Johnson', email: 'alice@example.com' }

// Create a user with optional fields
const detailedUser = userBuilder()
  .withId('user-456')
  .withName('Bob Smith')
  .withEmail('bob@example.com')
  .withAge(28)();

console.log(detailedUser);
// Output: { id: 'user-456', name: 'Bob Smith', email: 'bob@example.com', age: 28 }
```

## Type Literal

Fluent Gen also works with type literals:

```typescript
// types.ts
export type Point = {
  x: number;
  y: number;
  z?: number;
};
```

### Usage

```typescript
import { pointBuilder } from './Point.builder';

// 2D point
const point2D = pointBuilder()
  .withX(10)
  .withY(20)();

// 3D point
const point3D = pointBuilder()
  .withX(5)
  .withY(15)
  .withZ(25)();
```

## Object with JSDoc Comments

Fluent Gen preserves JSDoc comments for better developer experience:

```typescript
// types.ts
/** User Address Information */
export interface Address {
  /** Street name and number */
  street: string;
  /** City name */
  city: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
}
```

### Generated Builder Features

- Preserves JSDoc comments in generated methods
- Provides IntelliSense documentation
- Maintains type safety

```typescript
import { addressBuilder } from './Address.builder';

const address = addressBuilder()
  .withStreet('123 Main St')    // JSDoc: Street name and number
  .withCity('Anytown')          // JSDoc: City name
  .withCountry('US')();         // JSDoc: Country code (ISO 3166-1 alpha-2)
```

## Enum Integration

When your interfaces use enums:

```typescript
// types.ts
export enum Status {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

export interface UserProfile {
  userId: string;
  status: Status;
  lastLogin?: Date;
}
```

### Usage with Enums

```typescript
import { userProfileBuilder } from './UserProfile.builder';
import { Status } from './types';

const profile = userProfileBuilder()
  .withUserId('user-123')
  .withStatus(Status.Active)
  .withLastLogin(new Date())();
```

## Union Types

Fluent Gen handles union types intelligently:

```typescript
// types.ts
export interface ApiResponse {
  data: string | number | object;
  status: 'success' | 'error' | 'pending';
  code: 200 | 400 | 404 | 500;
}
```

### Usage with Union Types

```typescript
import { apiResponseBuilder } from './ApiResponse.builder';

// String data response
const stringResponse = apiResponseBuilder()
  .withData('Hello World')
  .withStatus('success')
  .withCode(200)();

// Object data response
const objectResponse = apiResponseBuilder()
  .withData({ users: [], total: 0 })
  .withStatus('success')
  .withCode(200)();

// Error response
const errorResponse = apiResponseBuilder()
  .withData('Not found')
  .withStatus('error')
  .withCode(404)();
```

## Configuration Examples

### Basic Configuration

Create `.fluentgenrc.json`:

```json
{
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": true
  },
  "targets": [
    {
      "file": "./src/types.ts",
      "types": ["User", "Address", "Point"]
    }
  ]
}
```

### Batch Generation

```bash
npx fluent-gen batch
```

This generates builders for all specified types in your configuration.

## Default Values

With `useDefaults: true`, builders provide smart defaults:

```typescript
// With defaults enabled
const userWithDefaults = userBuilder()
  .withName('John Doe')(); // id gets default "", email gets default ""

console.log(userWithDefaults);
// Output: { id: '', name: 'John Doe', email: '' }

// Override defaults as needed
const userCustom = userBuilder()
  .withId('custom-id')
  .withName('John Doe')
  .withEmail('john@example.com')();
```

## Real-World Example: Todo Application

Here's a complete example for a todo application:

### Types Definition

```typescript
// todo-types.ts
export enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4
}

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  dueDate?: Date;
  tags: string[];
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TodoList {
  id: string;
  name: string;
  items: TodoItem[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Generate Builders

```bash
npx fluent-gen generate ./todo-types.ts TodoItem
npx fluent-gen generate ./todo-types.ts TodoList
```

### Usage in Application

```typescript
import { todoItemBuilder, todoListBuilder } from './builders';
import { Priority } from './todo-types';

// Create a todo item
const todoItem = todoItemBuilder()
  .withId('todo-1')
  .withTitle('Implement user authentication')
  .withDescription('Add login/logout functionality with JWT tokens')
  .withCompleted(false)
  .withPriority(Priority.High)
  .withDueDate(new Date('2024-03-15'))
  .withTags(['auth', 'security', 'backend'])
  .withAssignee({
    id: 'dev-1',
    name: 'Alice Johnson',
    email: 'alice@company.com'
  })();

// Create a todo list
const projectTodos = todoListBuilder()
  .withId('project-1')
  .withName('Authentication Project')
  .withItems([todoItem])
  .withCreatedAt(new Date())
  .withUpdatedAt(new Date())();

console.log('Created todo list:', projectTodos);
```

## Testing with Builders

Builders are excellent for creating test data:

```typescript
// user.test.ts
import { userBuilder, addressBuilder } from '../builders';
import { UserService } from '../services/UserService';

describe('UserService', () => {
  it('should create a user successfully', async () => {
    // Arrange
    const testUser = userBuilder()
      .withId('test-user')
      .withName('Test User')
      .withEmail('test@example.com')
      .withAge(25)();

    const userService = new UserService();

    // Act
    const result = await userService.createUser(testUser);

    // Assert
    expect(result.success).toBe(true);
    expect(result.user.id).toBe('test-user');
  });

  it('should handle users without age', async () => {
    const testUser = userBuilder()
      .withId('test-user-2')
      .withName('Another User')
      .withEmail('another@example.com')();
      // age is optional, not provided

    const userService = new UserService();
    const result = await userService.createUser(testUser);

    expect(result.user.age).toBeUndefined();
  });
});
```

## API Request Building

Create API request payloads easily:

```typescript
// api-types.ts
export interface CreateUserRequest {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  profile?: {
    bio: string;
    avatar?: string;
  };
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  profile?: {
    bio?: string;
    avatar?: string;
  };
}
```

### API Client Usage

```typescript
import { createUserRequestBuilder, updateUserRequestBuilder } from './builders';

class ApiClient {
  async createUser(userData: Partial<CreateUserRequest>) {
    const request = createUserRequestBuilder()
      .withName(userData.name || '')
      .withEmail(userData.email || '')
      .withRole(userData.role || 'user')
      .withProfile(userData.profile || { bio: '' })();

    return fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
  }

  async updateUser(userId: string, updates: UpdateUserRequest) {
    const request = updateUserRequestBuilder()
      .withName(updates.name)
      .withEmail(updates.email)
      .withProfile(updates.profile)();

    // Remove undefined fields
    const cleanRequest = Object.fromEntries(
      Object.entries(request).filter(([_, value]) => value !== undefined)
    );

    return fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanRequest)
    });
  }
}
```

## Common Patterns

### Factory Functions

Combine builders with factory functions for common scenarios:

```typescript
// user-factories.ts
import { userBuilder, addressBuilder } from './builders';

export function createTestUser(overrides: Partial<User> = {}) {
  return userBuilder()
    .withId('test-user')
    .withName('Test User')
    .withEmail('test@example.com')
    .withAge(25)
    // Apply any overrides
    { ...userBuilder()(), ...overrides };
}

export function createAdminUser() {
  return userBuilder()
    .withId('admin-user')
    .withName('Admin User')
    .withEmail('admin@example.com')
    .withAge(30)();
}

export function createUSAddress() {
  return addressBuilder()
    .withStreet('123 Main St')
    .withCity('Anytown')
    .withCountry('US')();
}
```

### Builder Composition

Reuse builders in different contexts:

```typescript
// Base builder setup
const baseUserBuilder = userBuilder()
  .withName('Default User')
  .withEmail('default@example.com');

// Specific user types
const adminUser = baseUserBuilder
  .withId('admin-1')
  .withName('Administrator')();

const guestUser = baseUserBuilder
  .withId('guest-1')
  .withName('Guest User')();
```

## Next Steps

- [Learn about nested builders](./nested.md)
- [Explore generic type examples](./generics.md)
- [See advanced pattern usage](./advanced.md)
- [Understand the configuration options](../guide/configuration.md)