# Nested Builders

Fluent Gen automatically creates nested builders for complex object structures. This enables building hierarchical data with full type safety and IntelliSense support.

## Basic Nested Structure

When your interface contains nested objects, Fluent Gen generates builders for both the parent and nested types:

```typescript
// types.ts
export interface Address {
  street: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  address: Address;
}
```

### Generate Nested Builders

```bash
npx fluent-gen generate ./types.ts User
npx fluent-gen generate ./types.ts Address
```

### Usage with Nested Builders

```typescript
import { userBuilder, addressBuilder } from './builders';

// Method 1: Using nested builder
const userWithNestedBuilder = userBuilder()
  .withId('user-123')
  .withName('Alice Johnson')
  .withEmail('alice@example.com')
  .withAddress(
    addressBuilder()
      .withStreet('123 Main St')
      .withCity('Anytown')
      .withCountry('USA')
      .withZipCode('12345')
  )();

// Method 2: Using plain object
const userWithPlainAddress = userBuilder()
  .withId('user-456')
  .withName('Bob Smith')
  .withEmail('bob@example.com')
  .withAddress({
    street: '456 Oak Ave',
    city: 'Springfield',
    country: 'USA'
  })();
```

Both methods are type-safe and produce identical results.

## Multi-Level Nesting

Fluent Gen handles deeply nested structures:

```typescript
// types.ts
export interface CompanyInfo {
  name: string;
  website?: string;
}

export interface JobTitle {
  title: string;
  department: string;
  level: 'junior' | 'mid' | 'senior' | 'lead';
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  position: JobTitle;
  company: CompanyInfo;
  address: Address;
}
```

### Multi-Level Builder Usage

```typescript
import {
  employeeBuilder,
  jobTitleBuilder,
  companyInfoBuilder,
  addressBuilder
} from './builders';

const employee = employeeBuilder()
  .withId('emp-001')
  .withName('Sarah Chen')
  .withEmail('sarah.chen@company.com')
  .withPosition(
    jobTitleBuilder()
      .withTitle('Senior Software Engineer')
      .withDepartment('Engineering')
      .withLevel('senior')
  )
  .withCompany(
    companyInfoBuilder()
      .withName('Tech Corp Inc.')
      .withWebsite('https://techcorp.com')
  )
  .withAddress(
    addressBuilder()
      .withStreet('789 Tech Blvd')
      .withCity('San Francisco')
      .withCountry('USA')
      .withZipCode('94105')
  )();
```

## Inline Object Types

Fluent Gen also handles inline object definitions:

```typescript
// types.ts
export interface Order {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    options?: {
      color?: string;
      size?: string;
      customization?: string;
    };
  }>;
  shipping: {
    method: 'standard' | 'express' | 'overnight';
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
    tracking?: string;
  };
  payment: {
    method: 'credit' | 'debit' | 'paypal';
    last4?: string;
    transactionId: string;
  };
}
```

### Usage with Inline Objects

```typescript
import { orderBuilder } from './builders';

const order = orderBuilder()
  .withId('order-001')
  .withCustomerId('customer-123')
  .withItems([
    {
      productId: 'prod-001',
      quantity: 2,
      price: 29.99,
      options: {
        color: 'blue',
        size: 'large'
      }
    },
    {
      productId: 'prod-002',
      quantity: 1,
      price: 49.99
    }
  ])
  .withShipping({
    method: 'express',
    address: {
      street: '123 Delivery St',
      city: 'Shipping City',
      state: 'CA',
      zipCode: '90210'
    },
    tracking: 'TRACK123456'
  })
  .withPayment({
    method: 'credit',
    last4: '1234',
    transactionId: 'txn_abc123'
  })();
```

## Array of Objects

When dealing with arrays of complex objects:

```typescript
// types.ts
export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  todos: TodoItem[];
  team: Array<{
    userId: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    joinedAt: Date;
  }>;
}
```

### Building Arrays with Nested Objects

```typescript
import { projectBuilder, todoItemBuilder } from './builders';

const project = projectBuilder()
  .withId('proj-001')
  .withName('Website Redesign')
  .withDescription('Complete overhaul of company website')
  .withTodos([
    todoItemBuilder()
      .withId('todo-001')
      .withTitle('Design mockups')
      .withCompleted(true)
      .withPriority('high')
      .withAssignee({
        id: 'user-001',
        name: 'Alice Designer',
        email: 'alice@company.com'
      })(),

    todoItemBuilder()
      .withId('todo-002')
      .withTitle('Frontend implementation')
      .withCompleted(false)
      .withPriority('medium')(),

    todoItemBuilder()
      .withId('todo-003')
      .withTitle('Backend API updates')
      .withCompleted(false)
      .withPriority('high')()
  ])
  .withTeam([
    {
      userId: 'user-001',
      role: 'owner',
      joinedAt: new Date('2024-01-01')
    },
    {
      userId: 'user-002',
      role: 'admin',
      joinedAt: new Date('2024-01-15')
    },
    {
      userId: 'user-003',
      role: 'member',
      joinedAt: new Date('2024-02-01')
    }
  ])();
```

## Context Passing

Nested builders can receive context from their parent builders:

```typescript
// types.ts
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  credentials?: {
    username: string;
    password: string;
  };
}

export interface AppConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  database: DatabaseConfig;
  services: {
    redis: {
      host: string;
      port: number;
    };
    email: {
      provider: 'sendgrid' | 'mailgun';
      apiKey: string;
    };
  };
}
```

### Builder with Context

```typescript
import { appConfigBuilder, databaseConfigBuilder } from './builders';

const config = appConfigBuilder()
  .withName('MyApp')
  .withVersion('1.0.0')
  .withEnvironment('production')
  .withDatabase(
    databaseConfigBuilder()
      .withHost('db.production.com')
      .withPort(5432)
      .withDatabase('myapp_prod')
      .withCredentials({
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!
      })
  )
  .withServices({
    redis: {
      host: 'redis.production.com',
      port: 6379
    },
    email: {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY!
    }
  })();
```

## Real-World Example: E-commerce System

Here's a comprehensive example of a nested e-commerce data structure:

```typescript
// e-commerce-types.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: {
    id: string;
    name: string;
    parentId?: string;
  };
  variants: Array<{
    id: string;
    name: string;
    price?: number;
    stock: number;
    attributes: {
      [key: string]: string;
    };
  }>;
  images: Array<{
    url: string;
    alt: string;
    isPrimary: boolean;
  }>;
}

export interface Customer {
  id: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    birthDate?: Date;
  };
  addresses: Array<{
    id: string;
    type: 'billing' | 'shipping';
    isDefault: boolean;
    address: {
      street1: string;
      street2?: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  }>;
  preferences: {
    newsletter: boolean;
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    language: string;
    currency: string;
  };
}

export interface ShoppingCart {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    addedAt: Date;
    customizations?: {
      [key: string]: string;
    };
  }>;
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
    sessionId: string;
  };
}
```

### E-commerce Builder Usage

```typescript
import {
  productBuilder,
  customerBuilder,
  shoppingCartBuilder
} from './builders';

// Create a product with variants
const product = productBuilder()
  .withId('prod-laptop-001')
  .withName('Gaming Laptop Pro')
  .withDescription('High-performance gaming laptop with RTX graphics')
  .withPrice(1299.99)
  .withCategory({
    id: 'cat-computers',
    name: 'Computers',
    parentId: 'cat-electronics'
  })
  .withVariants([
    {
      id: 'var-001',
      name: '16GB RAM / 512GB SSD',
      stock: 10,
      attributes: {
        ram: '16GB',
        storage: '512GB SSD',
        color: 'Black'
      }
    },
    {
      id: 'var-002',
      name: '32GB RAM / 1TB SSD',
      price: 1599.99,
      stock: 5,
      attributes: {
        ram: '32GB',
        storage: '1TB SSD',
        color: 'Silver'
      }
    }
  ])
  .withImages([
    {
      url: 'https://example.com/laptop-front.jpg',
      alt: 'Gaming Laptop Pro - Front View',
      isPrimary: true
    },
    {
      url: 'https://example.com/laptop-side.jpg',
      alt: 'Gaming Laptop Pro - Side View',
      isPrimary: false
    }
  ])();

// Create a customer profile
const customer = customerBuilder()
  .withId('customer-001')
  .withEmail('john.gamer@email.com')
  .withProfile({
    firstName: 'John',
    lastName: 'Gamer',
    phone: '+1-555-0123',
    birthDate: new Date('1990-05-15')
  })
  .withAddresses([
    {
      id: 'addr-001',
      type: 'billing',
      isDefault: true,
      address: {
        street1: '123 Gaming Ave',
        city: 'Tech City',
        state: 'CA',
        zipCode: '90210',
        country: 'USA'
      }
    },
    {
      id: 'addr-002',
      type: 'shipping',
      isDefault: false,
      address: {
        street1: '456 Work St',
        street2: 'Office Building, Floor 5',
        city: 'Business District',
        state: 'CA',
        zipCode: '90211',
        country: 'USA'
      }
    }
  ])
  .withPreferences({
    newsletter: true,
    notifications: {
      email: true,
      sms: false,
      push: true
    },
    language: 'en-US',
    currency: 'USD'
  })();

// Create a shopping cart
const cart = shoppingCartBuilder()
  .withId('cart-001')
  .withCustomerId(customer.id)
  .withItems([
    {
      productId: product.id,
      variantId: 'var-002',
      quantity: 1,
      addedAt: new Date(),
      customizations: {
        engraving: 'John G.',
        warranty: 'extended-3-year'
      }
    }
  ])
  .withTotals({
    subtotal: 1599.99,
    tax: 144.00,
    shipping: 29.99,
    discount: 0,
    total: 1773.98
  })
  .withMetadata({
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    sessionId: 'session-abc123'
  })();
```

## Testing with Nested Builders

Nested builders are particularly useful for creating complex test data:

```typescript
// product.test.ts
import { productBuilder } from '../builders';
import { ProductService } from '../services/ProductService';

describe('ProductService', () => {
  it('should create product with variants', async () => {
    const testProduct = productBuilder()
      .withId('test-product')
      .withName('Test Product')
      .withDescription('A test product')
      .withPrice(99.99)
      .withCategory({
        id: 'test-category',
        name: 'Test Category'
      })
      .withVariants([
        {
          id: 'variant-1',
          name: 'Small',
          stock: 10,
          attributes: { size: 'S' }
        },
        {
          id: 'variant-2',
          name: 'Large',
          stock: 5,
          attributes: { size: 'L' }
        }
      ])
      .withImages([])(); // Empty images for test

    const service = new ProductService();
    const result = await service.createProduct(testProduct);

    expect(result.success).toBe(true);
    expect(result.product.variants).toHaveLength(2);
  });
});
```

## Best Practices

### 1. Builder Organization

Keep related builders together:

```typescript
// builders/user/index.ts
export { userBuilder } from './User.builder';
export { addressBuilder } from './Address.builder';
export { profileBuilder } from './Profile.builder';

// builders/index.ts
export * from './user';
export * from './product';
export * from './order';
```

### 2. Factory Functions for Common Patterns

```typescript
// factories/user-factory.ts
import { userBuilder, addressBuilder } from '../builders';

export function createTestUser(overrides = {}) {
  return userBuilder()
    .withId('test-user')
    .withName('Test User')
    .withEmail('test@example.com')
    .withAddress(
      addressBuilder()
        .withStreet('123 Test St')
        .withCity('Test City')
        .withCountry('US')
    )
    .with(overrides)(); // Apply any overrides
}

export function createUSUser(name: string, email: string) {
  return userBuilder()
    .withName(name)
    .withEmail(email)
    .withAddress(
      addressBuilder()
        .withCountry('USA')
        .withZipCode('12345')
    );
}
```

### 3. Reusable Builder Patterns

```typescript
// Base configurations
const baseAddressBuilder = addressBuilder()
  .withCountry('USA');

const baseUserBuilder = userBuilder()
  .withEmail('default@example.com');

// Specific use cases
const californiaUser = baseUserBuilder
  .withAddress(
    baseAddressBuilder
      .withState('CA')
      .withCity('Los Angeles')
  );

const newYorkUser = baseUserBuilder
  .withAddress(
    baseAddressBuilder
      .withState('NY')
      .withCity('New York')
  );
```

## Next Steps

- [Learn about generic type builders](./generics.md)
- [Explore advanced patterns](./advanced.md)
- [Understand context passing](../api/overview.md#context-types)
- [Configure nested generation](../guide/configuration.md)