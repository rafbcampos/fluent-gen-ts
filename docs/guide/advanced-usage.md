# Advanced Usage

This guide covers advanced scenarios and patterns for using fluent-gen-ts
effectively in complex projects.

## Monorepo Configuration

fluent-gen-ts provides comprehensive support for monorepo setups with
intelligent dependency resolution across different package managers and
workspace configurations.

### Package Manager Support

#### pnpm Workspaces

fluent-gen-ts automatically handles pnpm's unique `.pnpm` store structure:

```json
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// fluent-gen.config.js
module.exports = {
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto', // Detects pnpm automatically
  }
}
```

The resolver will:

- Detect pnpm via `pnpm-lock.yaml`
- Resolve symlinks from `node_modules/.pnpm/` store
- Handle scoped packages correctly (`@scope/package` → `@scope+package`)

#### Yarn Workspaces

Works seamlessly with yarn's hoisting behavior:

```json
// package.json (workspace root)
{
  "private": true,
  "workspaces": ["packages/*", "apps/*"]
}

// fluent-gen.config.js
module.exports = {
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'hoisted', // Optimal for yarn
  }
}
```

#### Custom Configurations

For complex setups or non-standard layouts:

```javascript
// fluent-gen.config.js
module.exports = {
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'workspace-root',
    workspaceRoot: '/path/to/workspace/root',
    customPaths: [
      './shared-dependencies',
      '../common-packages/node_modules',
      './custom-resolution-path',
    ],
  },
};
```

### Resolution Strategies

#### Auto (Recommended)

Tries multiple strategies in order until dependencies are found:

1. Local `node_modules`
2. Hoisted dependencies (walking up tree)
3. Package manager store (pnpm `.pnpm`)
4. Workspace root

```javascript
{
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto'
  }
}
```

#### Workspace Root

Explicitly looks in workspace root first:

```javascript
{
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'workspace-root',
    workspaceRoot: './../../' // relative to config file
  }
}
```

#### Hoisted

Walks up directory tree for hoisted dependencies:

```javascript
{
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'hoisted'
  }
}
```

#### Local Only

Only checks local `node_modules` (useful for strict isolation):

```javascript
{
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'local-only'
  }
}
```

### Troubleshooting

#### Verbose Logging

Enable detailed resolution logging:

```bash
DEBUG=fluent-gen:resolution npx fluent-gen-ts generate ./src/types.ts MyType
```

Common resolution messages:

- `Package 'pkg' resolved from workspace-root at: /path/to/pkg`
- `Package 'pkg' resolved from local at: /path/to/pkg`
- `Package 'pkg' resolved from pnpm-store at: /path/to/.pnpm/pkg@version/node_modules/pkg`

#### Common Issues

**Issue**: Package not found despite being installed **Solution**: Try `auto`
strategy or check `customPaths`

**Issue**: pnpm symlinks not resolved **Solution**: Ensure
`dependencyResolutionStrategy: 'auto'` or `'pnpm-store'`

**Issue**: yarn workspaces not finding hoisted deps **Solution**: Use
`dependencyResolutionStrategy: 'hoisted'`

## Complex Type Scenarios

### Generic Types with Constraints

fluent-gen-ts handles generic types with various constraint patterns:

```typescript
// Complex generic interfaces
interface Repository<T extends Entity> {
  items: T[];
  query: QueryBuilder<T>;
  metadata: RepositoryMetadata<T>;
}

interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface QueryBuilder<T> {
  where: WhereClause<T>;
  orderBy: OrderByClause<T>;
  limit: number;
}

// Usage with generated builders
const userRepo = repository<User>()
  .withItems([
    user().withId('1').withName('Alice'),
    user().withId('2').withName('Bob'),
  ])
  .withQuery(
    queryBuilder<User>()
      .withWhere(/* complex where clause */)
      .withOrderBy(/* order specification */)
      .withLimit(10),
  )
  .build();
```

### Utility Types

Advanced TypeScript utility types are fully supported:

```typescript
// Source types
interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  profile: UserProfile;
  preferences: UserPreferences;
}

// Derived types
type PublicUser = Pick<User, 'id' | 'username' | 'profile'>;
type UserUpdate = Partial<Omit<User, 'id' | 'createdAt'>>;
type RequiredUser = Required<Pick<User, 'id' | 'username' | 'email'>>;
type UserWithoutPassword = Omit<User, 'password'>;

// Generated builders handle all variants
const publicUser = publicUser()
  .withId('123')
  .withUsername('alice')
  .withProfile(/* profile builder */)
  .build();

const update = userUpdate()
  .withEmail('newemail@example.com')
  .withProfile(/* updated profile */)
  .build();
```

### Mapped Types

Custom mapped types work seamlessly:

```typescript
// Custom mapped types
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Conditional types
type NonNullable<T> = T extends null | undefined ? never : T;
type Flatten<T> = T extends Array<infer U> ? U : T;

// All work with fluent-gen-ts
const readonlyUser = readonlyUser().withId('123').withName('Alice').build(); // Results in readonly properties
```

## Advanced Builder Patterns

### Builder Composition

Compose complex objects using multiple builders:

```typescript
interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: Author;
  tags: Tag[];
  comments: Comment[];
  publishedAt?: Date;
  metadata: PostMetadata;
}

// Complex composition with nested builders
const post = blogPost()
  .withId('post-1')
  .withTitle('Advanced TypeScript Patterns')
  .withContent('...')
  .withAuthor(
    author()
      .withId('author-1')
      .withName('Jane Developer')
      .withBio('TypeScript enthusiast'),
  )
  .withTags([
    tag().withName('typescript').withColor('#3178c6'),
    tag().withName('patterns').withColor('#ff6b6b'),
    tag().withName('advanced').withColor('#4ecdc4'),
  ])
  .withComments([
    comment()
      .withAuthor('commenter1')
      .withContent('Great post!')
      .withCreatedAt(new Date()),
    comment()
      .withAuthor('commenter2')
      .withContent('Very helpful, thanks!')
      .withCreatedAt(new Date()),
  ])
  .withMetadata(postMetadata().withViews(0).withLikes(0).withShares(0))
  .build();
```

### Conditional Builder Logic

Use builder utilities for complex conditional logic:

```typescript
const user = user()
  .withId('123')
  .withName('Alice')
  // Conditional email based on environment
  .if(b => process.env.NODE_ENV === 'test', 'email', 'test@example.com')
  .if(
    b => process.env.NODE_ENV !== 'test',
    'email',
    () => generateRandomEmail(),
  )
  // Set role based on conditions
  .ifElse(b => b.peek('email')?.includes('admin'), 'role', 'admin', 'user')
  // Conditional profile based on role
  .if(
    b => b.peek('role') === 'admin',
    'profile',
    adminProfile()
      .withPermissions(['read', 'write', 'admin'])
      .withAccessLevel('full'),
  )
  .if(
    b => b.peek('role') === 'user',
    'profile',
    userProfile().withPermissions(['read']).withAccessLevel('limited'),
  )
  .build();
```

### Custom Builder Extensions

Extend generated builders with domain-specific functionality:

```typescript
// Extend the generated UserBuilder
class ExtendedUserBuilder extends UserBuilder {
  // Add convenience methods
  asAdmin(): this {
    return this.withRole('admin')
      .withIsActive(true)
      .withPermissions(['read', 'write', 'admin']);
  }

  asGuest(): this {
    return this.withRole('guest').withIsActive(false).withPermissions(['read']);
  }

  withRandomCredentials(): this {
    return this.withId(generateId())
      .withUsername(generateUsername())
      .withEmail(generateEmail());
  }

  withTestData(): this {
    return this.withId('test-user')
      .withName('Test User')
      .withEmail('test@example.com')
      .withRole('user')
      .withIsActive(true);
  }
}

// Factory function for extended builder
export function extendedUser(initial?: Partial<User>): ExtendedUserBuilder {
  return new ExtendedUserBuilder(initial);
}

// Usage
const adminUser = extendedUser().withName('Admin User').asAdmin().build();

const testUser = extendedUser().withTestData().build();
```

## Context and Relationships

### Parent-Child Relationships

Use context to maintain relationships between builders:

```typescript
interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
}

interface OrderItem {
  id: string;
  orderId: string; // Relationship to parent
  productId: string;
  quantity: number;
  price: number;
}

// Custom plugin to handle relationships
const relationshipPlugin: Plugin = {
  name: 'relationship-plugin',
  version: '1.0.0',

  transformValue(context) {
    // Auto-set orderId from parent context
    if (
      context.property === 'orderId' &&
      context.valueVariable === 'undefined'
    ) {
      return ok({
        condition: 'context?.parentId',
        transform: 'context.parentId',
      });
    }

    return ok(null);
  },
};

// Usage with automatic relationship handling
const order = order()
  .withId('order-123')
  .withCustomerId('customer-456')
  .withItems([
    orderItem().withProductId('product-1').withQuantity(2).withPrice(29.99),
    // orderId automatically set from parent context
    orderItem().withProductId('product-2').withQuantity(1).withPrice(59.99),
  ])
  .build();
```

### Hierarchical Data Structures

Build tree-like structures with context:

```typescript
interface Category {
  id: string;
  name: string;
  parentId?: string;
  children: Category[];
  products: Product[];
}

// Plugin for hierarchical structure
const hierarchyPlugin: Plugin = {
  name: 'hierarchy-plugin',
  version: '1.0.0',

  addCustomMethods(context) {
    if (context.typeName === 'Category') {
      return ok([
        {
          name: 'withSubcategory',
          signature:
            'withSubcategory(name: string, builderFn?: (builder: CategoryBuilder) => CategoryBuilder): this',
          implementation: `
  withSubcategory(name: string, builderFn?: (builder: CategoryBuilder) => CategoryBuilder): this {
    const subcategory = category()
      .withName(name)
      .withParentId(this.peek('id') || '');

    const finalCategory = builderFn ? builderFn(subcategory) : subcategory;

    const currentChildren = this.peek('children') || [];
    return this.withChildren([...currentChildren, finalCategory]);
  }`,
          jsDoc: `/**
   * Add a subcategory with automatic parent relationship
   */`,
        },
      ]);
    }
    return ok([]);
  },
};

// Usage
const electronics = category()
  .withId('electronics')
  .withName('Electronics')
  .withSubcategory('Computers', cat =>
    cat.withSubcategory('Laptops', laptop =>
      laptop.withProducts([
        product().withName('MacBook Pro'),
        product().withName('ThinkPad'),
      ]),
    ),
  )
  .withSubcategory('Phones')
  .build();
```

## Performance Optimization

### Lazy Evaluation

Optimize large object creation with lazy evaluation:

```typescript
class LazyUserBuilder extends UserBuilder {
  private lazyInitializers = new Map<string, () => any>();

  withLazyProfile(initializer: () => UserProfile): this {
    this.lazyInitializers.set('profile', initializer);
    return this;
  }

  withLazyPermissions(initializer: () => Permission[]): this {
    this.lazyInitializers.set('permissions', initializer);
    return this;
  }

  build(context?: BaseBuildContext): User {
    // Evaluate lazy properties
    for (const [key, initializer] of this.lazyInitializers) {
      if (!this.has(key as keyof User)) {
        this.set(key as keyof User, initializer());
      }
    }

    return super.build(context);
  }
}

// Usage for expensive operations
const user = lazyUser()
  .withId('123')
  .withName('Alice')
  .withLazyProfile(() => {
    // Expensive profile calculation
    return calculateUserProfile(userId);
  })
  .withLazyPermissions(() => {
    // Database lookup
    return fetchUserPermissions(userId);
  })
  .build(); // Lazy properties evaluated only when needed
```

### Memoization

Cache expensive builder operations:

```typescript
const memoizedBuilders = new Map<string, any>();

function memoizedProduct(key: string, builderFn: () => Product): Product {
  if (!memoizedBuilders.has(key)) {
    memoizedBuilders.set(key, builderFn());
  }
  return memoizedBuilders.get(key);
}

// Usage
const expensiveProduct = memoizedProduct('premium-laptop', () =>
  product()
    .withId('laptop-1')
    .withName('Premium Laptop')
    .withPrice(calculateComplexPricing())
    .withSpecifications(generateDetailedSpecs())
    .build(),
);
```

## Testing Patterns

### Test Data Factories

Create reusable test data factories:

```typescript
// test/factories/user-factory.ts
export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return user()
      .withId(faker.string.uuid())
      .withName(faker.person.fullName())
      .withEmail(faker.internet.email())
      .withRole('user')
      .withIsActive(true)
      .withCreatedAt(new Date())
      .build({
        ...overrides
      });
  }

  static admin(overrides: Partial<User> = {}): User {
    return this.create({
      role: 'admin',
      permissions: ['read', 'write', 'admin'],
      ...overrides
    });
  }

  static inactive(overrides: Partial<User> = {}): User {
    return this.create({
      isActive: false,
      deactivatedAt: new Date(),
      ...overrides
    });
  }

  static withProfile(profileData: Partial<UserProfile> = {}): User {
    return this.create({
      profile: userProfile()
        .withBio(faker.lorem.paragraph())
        .withAvatar(faker.image.avatar())
        ...profileData
        .build()
    });
  }
}

// Usage in tests
describe('UserService', () => {
  it('should create admin user', () => {
    const admin = UserFactory.admin({
      name: 'Test Admin'
    });

    expect(admin.role).toBe('admin');
    expect(admin.name).toBe('Test Admin');
  });

  it('should handle user with profile', () => {
    const user = UserFactory.withProfile({
      bio: 'Custom bio'
    });

    expect(user.profile.bio).toBe('Custom bio');
  });
});
```

### Property-Based Testing

Use builders for property-based testing:

```typescript
import { fc } from 'fast-check';

// Arbitrary generators using builders
const arbitraryUser = fc
  .record({
    id: fc.string(),
    name: fc.string(),
    email: fc.emailAddress(),
    age: fc.integer({ min: 18, max: 100 }),
    role: fc.constantFrom('admin', 'user', 'guest'),
    isActive: fc.boolean(),
  })
  .map(data => user(data).build());

const arbitraryOrder = fc
  .record({
    id: fc.string(),
    customerId: fc.string(),
    total: fc.float({ min: 0, max: 10000 }),
    items: fc.array(arbitraryOrderItem, { minLength: 1, maxLength: 10 }),
  })
  .map(data => order(data).build());

// Property-based tests
describe('User validation', () => {
  it('should always have valid email format', () => {
    fc.assert(
      fc.property(arbitraryUser, user => {
        expect(user.email).toMatch(/@/);
      }),
    );
  });

  it('should maintain order total consistency', () => {
    fc.assert(
      fc.property(arbitraryOrder, order => {
        const calculatedTotal = order.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        expect(Math.abs(order.total - calculatedTotal)).toBeLessThan(0.01);
      }),
    );
  });
});
```

## Integration Patterns

### Database Seeding

Use builders for database seeding:

```typescript
// seeds/user-seeder.ts
export class UserSeeder {
  async seed(): Promise<void> {
    const users = [
      // Admin users
      ...Array.from({ length: 3 }, (_, i) =>
        user()
          .withId(`admin-${i + 1}`)
          .withName(`Admin ${i + 1}`)
          .withEmail(`admin${i + 1}@company.com`)
          .withRole('admin')
          .withIsActive(true)
          .build(),
      ),

      // Regular users
      ...Array.from({ length: 100 }, (_, i) =>
        user()
          .withId(`user-${i + 1}`)
          .withName(faker.person.fullName())
          .withEmail(faker.internet.email())
          .withRole('user')
          .withIsActive(faker.datatype.boolean(0.9))
          .withCreatedAt(faker.date.past({ years: 2 }))
          .build(),
      ),

      // Guest users
      ...Array.from({ length: 20 }, (_, i) =>
        user()
          .withId(`guest-${i + 1}`)
          .withName(`Guest ${i + 1}`)
          .withRole('guest')
          .withIsActive(false)
          .build(),
      ),
    ];

    await this.userRepository.insertMany(users);
  }
}
```

### API Response Mocking

Mock API responses with builders:

```typescript
// mocks/api-responses.ts
export class ApiResponseFactory {
  static success<T>(data: T): ApiResponse<T> {
    return apiResponse<T>()
      .withData(data)
      .withStatus(200)
      .withMessage('Success')
      .withTimestamp(new Date())
      .build();
  }

  static error(message: string, status: number = 500): ApiResponse<null> {
    return apiResponse<null>()
      .withData(null)
      .withStatus(status)
      .withMessage(message)
      .withTimestamp(new Date())
      .withMetadata({ error: true })
      .build();
  }

  static paginated<T>(
    items: T[],
    page: number = 1,
    pageSize: number = 10,
  ): ApiResponse<PagedResult<T>> {
    const pagedData = pagedResult<T>()
      .withItems(items.slice((page - 1) * pageSize, page * pageSize))
      .withTotal(items.length)
      .withPage(page)
      .withPageSize(pageSize)
      .build();

    return this.success(pagedData);
  }
}

// Usage in tests
const userListResponse = ApiResponseFactory.paginated(
  [UserFactory.create(), UserFactory.admin(), UserFactory.inactive()],
  1,
  20,
);
```

## Next Steps

- Explore [Plugin Development](./plugins.md) for extending functionality
- Check out [Examples](/examples/) for real-world usage patterns
- Review the [API Reference](/api/reference) for detailed API information
- See [CLI Commands](./cli-commands.md) for automation options
