# Examples

This section provides real-world examples of using fluent-gen-ts in various
scenarios.

## Basic Examples

### Simple User Builder

**Input Type:**

```typescript
// types/user.ts
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  isActive: boolean;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  lastLoginAt?: Date;
}
```

**Generated Builder Usage:**

```typescript
import { user } from './builders/user.builder.js';

// Create a basic user
const basicUser = user()
  .withId('user-123')
  .withUsername('johndoe')
  .withEmail('john@example.com')
  .withFirstName('John')
  .withLastName('Doe')
  .withAge(30)
  .withIsActive(true)
  .withRole('user')
  .withCreatedAt(new Date())
  .build();

// Create an admin user with conditional logic
const adminUser = user()
  .withId('admin-456')
  .withUsername('admin')
  .withEmail('admin@company.com')
  .withFirstName('Admin')
  .withLastName('User')
  .withAge(35)
  .withRole('admin')
  .withIsActive(true)
  .withCreatedAt(new Date())
  .if(u => u.peek('role') === 'admin', 'lastLoginAt', new Date())
  .build();

// Using with partial initial data
const partialUser = user({
  id: 'user-789',
  username: 'existing',
  createdAt: new Date('2023-01-01'),
})
  .withEmail('updated@example.com')
  .withFirstName('Updated')
  .withLastName('User')
  .withAge(25)
  .withRole('user')
  .withIsActive(true)
  .build();
```

### E-commerce Product Example

**Input Types:**

```typescript
// types/product.ts
export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: Category;
  tags: string[];
  inStock: boolean;
  inventory: {
    quantity: number;
    reserved: number;
    available: number;
  };
  dimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Builder Usage:**

```typescript
import { product } from './builders/product.builder.js';
import { category } from './builders/category.builder.js';

// Create a complete product with nested category
const laptop = product()
  .withId('prod-001')
  .withName('MacBook Pro 16"')
  .withDescription('High-performance laptop for professionals')
  .withPrice(2499.99)
  .withCurrency('USD')
  .withCategory(
    category()
      .withId('cat-electronics')
      .withName('Electronics')
      .withDescription('Electronic devices and gadgets'),
  )
  .withTags(['laptop', 'apple', 'professional', 'high-performance'])
  .withInStock(true)
  .withInventory({
    quantity: 50,
    reserved: 5,
    available: 45,
  })
  .withDimensions({
    length: 35.79,
    width: 24.59,
    height: 1.68,
    weight: 2.15,
  })
  .withCreatedAt(new Date())
  .withUpdatedAt(new Date())
  .build();

// Create a simple product without optional fields
const simpleProduct = product()
  .withId('prod-002')
  .withName('USB Cable')
  .withDescription('Standard USB-C cable')
  .withPrice(19.99)
  .withCurrency('USD')
  .withCategory(category().withId('cat-accessories').withName('Accessories'))
  .withTags(['cable', 'usb', 'accessory'])
  .withInStock(true)
  .withInventory({
    quantity: 100,
    reserved: 0,
    available: 100,
  })
  .withCreatedAt(new Date())
  .withUpdatedAt(new Date())
  .build();
```

## Advanced Examples

### Nested Data Structures

**Input Types:**

```typescript
// types/blog.ts
export interface Author {
  id: string;
  name: string;
  email: string;
  bio?: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  content: string;
  author: Author;
  createdAt: Date;
  updatedAt?: Date;
  likes: number;
  replies: Comment[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: Author;
  tags: string[];
  categories: string[];
  comments: Comment[];
  publishedAt?: Date;
  updatedAt: Date;
  meta: {
    views: number;
    likes: number;
    shares: number;
  };
}
```

**Builder Usage with Deep Nesting:**

```typescript
import { blogPost } from './builders/blog-post.builder.js';
import { author } from './builders/author.builder.js';
import { comment } from './builders/comment.builder.js';

// Create a complete blog post with nested comments
const post = blogPost()
  .withId('post-001')
  .withTitle('Advanced TypeScript Patterns')
  .withSlug('advanced-typescript-patterns')
  .withContent('Full article content here...')
  .withExcerpt('Learn advanced TypeScript patterns...')
  .withAuthor(
    author()
      .withId('author-001')
      .withName('Jane Developer')
      .withEmail('jane@example.com')
      .withBio('Senior TypeScript developer')
      .withAvatar('https://example.com/avatar.jpg'),
  )
  .withTags(['typescript', 'patterns', 'advanced'])
  .withCategories(['Programming', 'TypeScript'])
  .withComments([
    comment()
      .withId('comment-001')
      .withContent('Great article! Very helpful.')
      .withAuthor(
        author()
          .withId('commenter-001')
          .withName('Code Reader')
          .withEmail('reader@example.com'),
      )
      .withCreatedAt(new Date())
      .withLikes(5)
      .withReplies([
        comment()
          .withId('reply-001')
          .withContent('I agree, excellent examples!')
          .withAuthor(
            author()
              .withId('commenter-002')
              .withName('Another Reader')
              .withEmail('another@example.com'),
          )
          .withCreatedAt(new Date())
          .withLikes(2)
          .withReplies([]),
      ]),
    comment()
      .withId('comment-002')
      .withContent('Could you elaborate on the factory pattern?')
      .withAuthor(
        author()
          .withId('commenter-003')
          .withName('Curious Developer')
          .withEmail('curious@example.com'),
      )
      .withCreatedAt(new Date())
      .withLikes(3)
      .withReplies([]),
  ])
  .withUpdatedAt(new Date())
  .withMeta({
    views: 1250,
    likes: 89,
    shares: 23,
  })
  .build();
```

### API Response Structures

**Input Types:**

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: Date;
  requestId: string;
  metadata?: {
    version: string;
    processingTime: number;
    cached: boolean;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}
```

**Builder Usage for API Mocking:**

```typescript
import { apiResponse } from './builders/api-response.builder.js';
import { paginatedResponse } from './builders/paginated-response.builder.js';
import { errorResponse } from './builders/error-response.builder.js';

// Success response with data
const userListResponse = apiResponse<PaginatedResponse<User>>()
  .withData(
    paginatedResponse<User>()
      .withItems([
        user().withId('1').withName('Alice').build(),
        user().withId('2').withName('Bob').build(),
        user().withId('3').withName('Charlie').build(),
      ])
      .withPagination({
        page: 1,
        pageSize: 10,
        total: 45,
        totalPages: 5,
        hasNext: true,
        hasPrevious: false,
      }),
  )
  .withStatus(200)
  .withMessage('Users retrieved successfully')
  .withTimestamp(new Date())
  .withRequestId('req-12345')
  .withMetadata({
    version: '1.0.0',
    processingTime: 125,
    cached: false,
  })
  .build();

// Error response
const notFoundResponse = apiResponse<null>()
  .withData(null)
  .withStatus(404)
  .withMessage('User not found')
  .withTimestamp(new Date())
  .withRequestId('req-67890')
  .build();

// Complex error with details
const validationErrorResponse = apiResponse<ErrorResponse>()
  .withData(
    errorResponse()
      .withCode('VALIDATION_ERROR')
      .withMessage('Invalid input data')
      .withDetails({
        field: 'email',
        error: 'Invalid email format',
        value: 'invalid-email',
      })
      .withTimestamp(new Date()),
  )
  .withStatus(400)
  .withMessage('Validation failed')
  .withTimestamp(new Date())
  .withRequestId('req-11111')
  .build();
```

## Testing Examples

### Unit Test Data Creation

```typescript
// tests/user.test.ts
import { describe, it, expect } from 'vitest';
import { user } from '../builders/user.builder.js';
import { UserService } from '../services/user.service.js';

describe('UserService', () => {
  it('should create a new user', async () => {
    // Arrange
    const userData = user()
      .withUsername('testuser')
      .withEmail('test@example.com')
      .withFirstName('Test')
      .withLastName('User')
      .withAge(25)
      .withRole('user')
      .withIsActive(true)
      .withCreatedAt(new Date())
      .build();

    const userService = new UserService();

    // Act
    const result = await userService.createUser(userData);

    // Assert
    expect(result.username).toBe('testuser');
    expect(result.email).toBe('test@example.com');
    expect(result.isActive).toBe(true);
  });

  it('should handle admin user creation', async () => {
    const adminData = user()
      .withUsername('admin')
      .withEmail('admin@company.com')
      .withRole('admin')
      .withIsActive(true)
      // Use conditional logic for admin-specific setup
      .if(u => u.peek('role') === 'admin', 'lastLoginAt', new Date())
      .build();

    const userService = new UserService();
    const result = await userService.createUser(adminData);

    expect(result.role).toBe('admin');
    expect(result.lastLoginAt).toBeDefined();
  });
});
```

### Integration Test Data

```typescript
// tests/integration/order.integration.test.ts
import { order } from '../builders/order.builder.js';
import { orderItem } from '../builders/order-item.builder.js';
import { customer } from '../builders/customer.builder.js';
import { product } from '../builders/product.builder.js';

describe('Order Integration Tests', () => {
  it('should process a complete order', async () => {
    // Create test customer
    const testCustomer = customer()
      .withId('customer-test')
      .withName('Test Customer')
      .withEmail('customer@test.com')
      .withAddress({
        street: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'Test Country',
      })
      .build();

    // Create test products
    const laptop = product()
      .withId('prod-laptop')
      .withName('Test Laptop')
      .withPrice(999.99)
      .build();

    const mouse = product()
      .withId('prod-mouse')
      .withName('Test Mouse')
      .withPrice(29.99)
      .build();

    // Create order with items
    const testOrder = order()
      .withId('order-test')
      .withCustomer(testCustomer)
      .withItems([
        orderItem().withProduct(laptop).withQuantity(1).withPrice(laptop.price),
        orderItem().withProduct(mouse).withQuantity(2).withPrice(mouse.price),
      ])
      .withStatus('pending')
      .withCreatedAt(new Date())
      .build();

    // Process the order
    const orderService = new OrderService();
    const result = await orderService.processOrder(testOrder);

    expect(result.status).toBe('processed');
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(1059.97); // 999.99 + (29.99 * 2)
  });
});
```

## Real-World Scenarios

### Configuration Objects

**Input Types:**

```typescript
// types/config.ts
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
    idle: number;
  };
}

export interface CacheConfig {
  type: 'redis' | 'memory' | 'memcached';
  host?: string;
  port?: number;
  ttl: number;
  maxSize?: number;
}

export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  port: number;
  host: string;
  database: DatabaseConfig;
  cache: CacheConfig;
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    outputs: ('console' | 'file' | 'syslog')[];
  };
  features: {
    enableAuth: boolean;
    enableCors: boolean;
    enableMetrics: boolean;
    enableSwagger: boolean;
  };
}
```

**Configuration Builder Usage:**

```typescript
import { appConfig } from './builders/app-config.builder.js';
import { databaseConfig } from './builders/database-config.builder.js';
import { cacheConfig } from './builders/cache-config.builder.js';

// Development configuration
const devConfig = appConfig()
  .withEnv('development')
  .withPort(3000)
  .withHost('localhost')
  .withDatabase(
    databaseConfig()
      .withHost('localhost')
      .withPort(5432)
      .withDatabase('app_dev')
      .withUsername('dev_user')
      .withPassword('dev_password')
      .withSsl(false)
      .withPool({
        min: 2,
        max: 10,
        idle: 30000,
      }),
  )
  .withCache(cacheConfig().withType('memory').withTtl(300).withMaxSize(1000))
  .withLogging({
    level: 'debug',
    format: 'text',
    outputs: ['console'],
  })
  .withFeatures({
    enableAuth: true,
    enableCors: true,
    enableMetrics: false,
    enableSwagger: true,
  })
  .build();

// Production configuration
const prodConfig = appConfig()
  .withEnv('production')
  .withPort(8080)
  .withHost('0.0.0.0')
  .withDatabase(
    databaseConfig()
      .withHost(process.env.DB_HOST!)
      .withPort(parseInt(process.env.DB_PORT!))
      .withDatabase(process.env.DB_NAME!)
      .withUsername(process.env.DB_USER!)
      .withPassword(process.env.DB_PASSWORD!)
      .withSsl(true)
      .withPool({
        min: 5,
        max: 50,
        idle: 60000,
      }),
  )
  .withCache(
    cacheConfig()
      .withType('redis')
      .withHost(process.env.REDIS_HOST!)
      .withPort(parseInt(process.env.REDIS_PORT!))
      .withTtl(3600),
  )
  .withLogging({
    level: 'info',
    format: 'json',
    outputs: ['console', 'file'],
  })
  .withFeatures({
    enableAuth: true,
    enableCors: false,
    enableMetrics: true,
    enableSwagger: false,
  })
  .build();
```

### State Management

**Input Types:**

```typescript
// types/state.ts
export interface LoadingState {
  isLoading: boolean;
  operation?: string;
  progress?: number;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface UserState {
  currentUser?: User;
  isAuthenticated: boolean;
  permissions: string[];
  preferences: UserPreferences;
}

export interface AppState {
  loading: LoadingState;
  error: ErrorState;
  user: UserState;
  router: {
    currentRoute: string;
    previousRoute?: string;
    params: Record<string, string>;
  };
  ui: {
    theme: 'light' | 'dark';
    sidebar: {
      isOpen: boolean;
      width: number;
    };
    notifications: Notification[];
  };
}
```

**State Builder Usage:**

```typescript
import { appState } from './builders/app-state.builder.js';
import { userState } from './builders/user-state.builder.js';
import { loadingState } from './builders/loading-state.builder.js';

// Initial application state
const initialState = appState()
  .withLoading(loadingState().withIsLoading(false))
  .withError({
    hasError: false,
  })
  .withUser(
    userState().withIsAuthenticated(false).withPermissions([]).withPreferences({
      theme: 'light',
      language: 'en',
      notifications: true,
    }),
  )
  .withRouter({
    currentRoute: '/',
    params: {},
  })
  .withUi({
    theme: 'light',
    sidebar: {
      isOpen: false,
      width: 250,
    },
    notifications: [],
  })
  .build();

// Loading state
const loadingAppState = appState(initialState)
  .withLoading(
    loadingState()
      .withIsLoading(true)
      .withOperation('Fetching user data')
      .withProgress(45),
  )
  .build();

// Authenticated state
const authenticatedState = appState(initialState)
  .withUser(
    userState()
      .withCurrentUser(
        user()
          .withId('user-123')
          .withName('John Doe')
          .withEmail('john@example.com'),
      )
      .withIsAuthenticated(true)
      .withPermissions(['read', 'write'])
      .withPreferences({
        theme: 'dark',
        language: 'en',
        notifications: true,
      }),
  )
  .withUi({
    theme: 'dark',
    sidebar: {
      isOpen: true,
      width: 300,
    },
    notifications: [],
  })
  .build();
```

## Tips and Best Practices

### 1. Use Factories for Common Patterns

```typescript
// factories/user-factory.ts
export class UserFactory {
  static admin(overrides?: Partial<User>): User {
    return user()
      .withRole('admin')
      .withIsActive(true)
      .withPermissions(['read', 'write', 'admin'])
      .withCreatedAt(new Date())
      ...Object.entries(overrides || {}).reduce(
        (builder, [key, value]) => builder.set(key as keyof User, value),
        user()
      )
      .build();
  }

  static guest(): User {
    return user()
      .withRole('guest')
      .withIsActive(false)
      .withPermissions(['read'])
      .withCreatedAt(new Date())
      .build();
  }
}
```

### 2. Leverage Conditional Logic

```typescript
const user = user()
  .withUsername('testuser')
  .withEmail('test@example.com')
  // Set admin privileges conditionally
  .if(u => process.env.NODE_ENV === 'test', 'role', 'admin')
  .ifElse(
    u => u.peek('role') === 'admin',
    'permissions',
    ['read', 'write', 'admin'],
    ['read'],
  )
  .build();
```

### 3. Use Partial Initial Data

```typescript
// Start with common base data
const baseUser = {
  createdAt: new Date(),
  isActive: true,
  role: 'user' as const,
};

const specificUser = user(baseUser)
  .withId('specific-123')
  .withUsername('specific')
  .withEmail('specific@example.com')
  .build();
```

### 4. Builder Composition Patterns

```typescript
// Compose complex objects step by step
const order = order()
  .withCustomer(createTestCustomer())
  .withItems(createTestItems())
  .withShipping(createShippingInfo())
  .withPayment(createPaymentInfo())
  .build();

function createTestCustomer() {
  return customer().withName('Test Customer').withEmail('test@example.com');
}

function createTestItems() {
  return [
    orderItem().withProduct(createLaptop()).withQuantity(1),
    orderItem().withProduct(createMouse()).withQuantity(2),
  ];
}
```

These examples demonstrate the flexibility and power of fluent-gen-ts for
creating type-safe, maintainable object builders in real-world scenarios.
