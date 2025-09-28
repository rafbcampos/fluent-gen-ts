# Advanced Usage

This guide covers advanced scenarios and patterns for using fluent-gen-ts
effectively in complex projects, including sophisticated plugin architectures,
custom naming strategies, enterprise-scale configurations, and the powerful
plugin system that enables extensive customization.

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

### Custom Builder Extensions with Plugins

The plugin system provides a more powerful way to extend builders than manual
class extension:

```typescript
// Plugin-based builder extension
import { createPlugin, primitive } from 'fluent-gen-ts';

const userExtensionsPlugin = createPlugin('user-extensions', '1.0.0')
  .setDescription('Add convenience methods for user management')

  // Add role-based convenience methods
  .addMethod(method =>
    method
      .name('asAdmin')
      .returns('this')
      .implementation(
        `
      return this
        .withRole('admin')
        .withIsActive(true)
        .pushAuxiliary('permissions', 'read')
        .pushAuxiliary('permissions', 'write')
        .pushAuxiliary('permissions', 'admin');
    `,
      )
      .jsDoc('/**\\n * Configure user as admin with full permissions\\n */'),
  )

  .addMethod(method =>
    method
      .name('asGuest')
      .returns('this')
      .implementation(
        `
      return this
        .withRole('guest')
        .withIsActive(false)
        .pushAuxiliary('permissions', 'read');
    `,
      )
      .jsDoc('/**\\n * Configure user as guest with limited permissions\\n */'),
  )

  .addMethod(method =>
    method.name('withRandomCredentials').returns('this').implementation(`
      return this
        .withId(generateId())
        .withUsername(generateUsername())
        .withEmail(generateEmail());
    `),
  )

  .addMethod(method =>
    method.name('withTestData').returns('this').implementation(`
      return this
        .withId('test-user')
        .withName('Test User')
        .withEmail('test@example.com')
        .withRole('user')
        .withIsActive(true);
    `),
  )

  // Transform build method to process stored permissions
  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // Process accumulated permissions
      const permissions = this.getAuxiliaryArray('permissions');
      if (permissions.length > 0) {
        this.withPermissions(permissions);
      }
    `,
    ),
  )

  .build();

// Usage with plugin-enhanced builders
const adminUser = user()
  .withName('Admin User')
  .asAdmin() // Added by plugin
  .build();

const testUser = user()
  .withTestData() // Added by plugin
  .build();
```

### Manual Builder Extension (Legacy Approach)

For cases where plugins aren't suitable, you can still extend builders manually:

```typescript
// Manual extension (consider using plugins instead)
class ExtendedUserBuilder extends UserBuilder {
  asAdmin(): this {
    return this.withRole('admin')
      .withIsActive(true)
      .withPermissions(['read', 'write', 'admin']);
  }

  asGuest(): this {
    return this.withRole('guest').withIsActive(false).withPermissions(['read']);
  }
}
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

// Plugin to handle parent-child relationships using the fluent API
const relationshipPlugin = createPlugin('relationship-plugin', '1.0.0')
  .setDescription('Automatically handle parent-child relationships in builders')

  // Transform property methods to auto-set parent relationships
  .transformPropertyMethods(builder =>
    builder
      .when(ctx => ctx.propertyName === 'orderId')
      .setExtractor('context?.parentId || value')
      .setValidation(
        `
      if (!value && !context?.parentId) {
        throw new Error('OrderItem must have an orderId or parent context');
      }
    `,
      )
      .done()

      .when(ctx => ctx.propertyName === 'parentId')
      .setExtractor('context?.parentId || value')
      .done(),
  )

  .build();

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

// Plugin for hierarchical structure using the fluent API
const hierarchyPlugin = createPlugin('hierarchy-plugin', '1.0.0')
  .setDescription(
    'Add hierarchical category support with automatic parent relationships',
  )

  // Add custom method for subcategory management
  .addMethod(method =>
    method
      .name('withSubcategory')
      .parameter('name', 'string')
      .parameter(
        'builderFn',
        '(builder: CategoryBuilder) => CategoryBuilder',
        'undefined',
      )
      .returns('this')
      .implementation(
        `
      const subcategory = category()
        .withName(name)
        .withParentId(this.peek('id') || '');

      const finalCategory = builderFn ? builderFn(subcategory) : subcategory;

      const currentChildren = this.peek('children') || [];
      return this.withChildren([...currentChildren, finalCategory]);
    `,
      )
      .jsDoc(
        '/**\\n * Add a subcategory with automatic parent relationship\\n */',
      ),
  )

  .build();

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

### Custom Nested Context Generation

fluent-gen-ts uses a **deferred pattern** where nested builders are stored but
not executed until the parent's `build()` is called. This allows you to
customize how context flows from parent to child builders.

#### Understanding the Deferred Pattern

```typescript
// When you do this:
const parent = parentBuilder()
  .withChild(childBuilder()) // Child is NOT built yet, just stored
  .build(); // NOW parent builds and passes context to child

// The execution flow is:
// 1. Parent's build() is called
// 2. Parent creates context for child (using parent's data only)
// 3. Child's build() is called with that context
// 4. Child can augment context before passing to grandchildren
```

**Important**: When the parent creates context for the child, the child hasn't
been built yet! The parent can only use:

- Its own context (from its parent)
- Parameter metadata (property name, array index)
- **NOT** child builder state (that comes later)

#### Basic Example: Deterministic IDs

Generate hierarchical IDs based on the object tree structure:

```typescript
import type { BaseBuildContext, NestedContextGenerator } from 'fluent-gen-ts';

// 1. Define your custom context interface
interface MyDomainContext extends BaseBuildContext {
  nodeId?: string;
}

// 2. Create a context generator
const nodeIdGenerator: NestedContextGenerator<MyDomainContext> = ({
  parentContext,
  parameterName,
  index,
}) => {
  // Build hierarchical ID from parent
  let nodeId = parentContext.nodeId || 'root';
  nodeId += `-${parameterName}`;
  if (index !== undefined) nodeId += `-${index}`;

  return {
    ...parentContext,
    parameterName,
    ...(index !== undefined ? { index } : {}),
    nodeId,
    __nestedContextGenerator__: nodeIdGenerator, // Pass it down!
  };
};

// 3. Use it once at the root - it propagates automatically!
const workflow = workflowBuilder()
  .withName('Main Workflow')
  .withSteps([
    stepBuilder()
      .withName('Step 1')
      .withActions([
        actionBuilder().withType('http'),
        actionBuilder().withType('email'),
      ]),
    stepBuilder().withName('Step 2'),
  ])
  .build({
    nodeId: 'root',
    __nestedContextGenerator__: nodeIdGenerator,
  });

// Result IDs:
// workflow:     "root"
// steps[0]:     "root-steps-0"
// actions[0]:   "root-steps-0-actions-0"
// actions[1]:   "root-steps-0-actions-1"
// steps[1]:     "root-steps-1"
```

#### Advanced: Child-Specific Context Augmentation

Children can augment context with their own data before passing to
grandchildren:

```typescript
interface MyDomainContext extends BaseBuildContext {
  nodeId?: string;
  type?: string;
}

class ActionBuilder extends FluentBuilderBase<Action, MyDomainContext> {
  build(context?: MyDomainContext): Action {
    // Child augments context based on its OWN state
    const type = this.peek('type');
    const binding = this.peek('binding');

    let nodeId = context?.nodeId || 'root';
    if (type) {
      nodeId += `-${type}`;

      // Conditional logic based on child's state
      if (type === 'action' && binding) {
        nodeId += `-${processBinding(binding)}`;
      }
    }

    // Pass augmented context to nested builders
    const augmentedContext: MyDomainContext = {
      ...context,
      nodeId,
      type,
      __nestedContextGenerator__: context?.__nestedContextGenerator__,
    };

    return this.buildWithDefaults(ActionBuilder.defaults, augmentedContext);
  }
}
```

#### Real-World Example: Multi-Tenant Context

Track tenant information throughout the object tree:

```typescript
interface TenantContext extends BaseBuildContext {
  tenantId?: string;
  userId?: string;
  nodeId?: string;
  depth?: number;
}

const tenantContextGenerator: NestedContextGenerator<TenantContext> = ({
  parentContext,
  parameterName,
  index,
}) => {
  let nodeId = parentContext.nodeId || 'root';
  nodeId += `-${parameterName}`;
  if (index !== undefined) nodeId += `-${index}`;

  return {
    ...parentContext,
    parameterName,
    ...(index !== undefined ? { index } : {}),
    nodeId,
    // Tenant info propagates automatically
    tenantId: parentContext.tenantId,
    userId: parentContext.userId,
    depth: (parentContext.depth || 0) + 1,
    __nestedContextGenerator__: tenantContextGenerator,
  };
};

// Use in tests or domain logic
const order = orderBuilder()
  .withCustomerId('customer-123')
  .withItems([
    orderItemBuilder().withProductId('product-1'),
    orderItemBuilder().withProductId('product-2'),
  ])
  .build({
    tenantId: 'tenant-abc',
    userId: 'user-xyz',
    nodeId: 'order-root',
    depth: 0,
    __nestedContextGenerator__: tenantContextGenerator,
  });

// All nested items automatically have tenantId and userId!
```

#### Plugin Integration

While the runtime generator lives in the context, you can use plugins to set the
context type for code generation:

```typescript
import { createPlugin } from 'fluent-gen-ts';

const myDomainPlugin = createPlugin('my-domain', '1.0.0')
  .setContextTypeName('MyDomainContext')
  .requireImports(imports =>
    imports.addInternal('./common', ['MyDomainContext', 'nodeIdGenerator']),
  )
  .build();

// In fluent-gen.config.js
module.exports = {
  plugins: [myDomainPlugin],
  // Generated builders will use MyDomainContext type
};
```

#### Best Practices

1. **Always propagate the generator**: Include `__nestedContextGenerator__` in
   returned context
2. **Handle optional index**: Use `...(index !== undefined ? { index } : {})`
   for type safety
3. **Document the deferred pattern**: Make it clear when parent vs child
   augments context
4. **Pure functions**: Generators should be pure - no side effects
5. **Type safety**: Define strict context interfaces extending
   `BaseBuildContext`
6. **Single responsibility**: Parent handles parent data, child handles child
   data

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

## Advanced Naming Strategies

fluent-gen-ts provides sophisticated filename generation with both predefined
conventions and custom transform functions.

### Predefined Conventions

Choose from built-in naming conventions:

```javascript
// fluent-gen.config.js
export default {
  generator: {
    naming: {
      // Available conventions
      convention: 'camelCase', // actionAsset.builder.ts
      // convention: 'kebab-case', // action-asset.builder.ts
      // convention: 'snake_case', // action_asset.builder.ts
      // convention: 'PascalCase', // ActionAsset.builder.ts

      suffix: 'builder', // Optional custom suffix
    },
  },
};
```

### Custom Transform Functions

For complete control over filename generation, provide a JavaScript transform
function:

```javascript
// fluent-gen.config.js
export default {
  generator: {
    naming: {
      // Custom transform function
      transform: "(typeName) => typeName.replace(/Asset$/, '').toLowerCase()",
    },
  },
};
```

### Advanced Transform Examples

```javascript
// Strip common suffixes and convert to kebab-case
transform: `(typeName) => {
  return typeName
    .replace(/(DTO|Model|Entity|Asset)$/, '')
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}`;

// Add prefix based on type name
transform: `(typeName) => {
  if (typeName.includes('User')) return 'user-' + typeName.toLowerCase();
  if (typeName.includes('Order')) return 'order-' + typeName.toLowerCase();
  return typeName.toLowerCase();
}`;

// Custom domain-specific naming
transform: `(typeName) => {
  const domainMap = {
    'ActionAsset': 'action',
    'TextAsset': 'text',
    'ImageAsset': 'image',
    'VideoAsset': 'video'
  };
  return domainMap[typeName] || typeName.toLowerCase();
}`;
```

### Plugin-Based Naming

Plugins can also influence naming through custom processing:

```typescript
const namingPlugin = createPlugin('custom-naming', '1.0.0')
  .setDescription('Custom naming logic for specific types')

  // Store naming preferences in auxiliary data
  .addMethod(method =>
    method
      .name('withCustomFileName')
      .parameter('fileName', 'string')
      .returns('this').implementation(`
      return this.setAuxiliary('customFileName', fileName);
    `),
  )

  .transformBuildMethod(transform =>
    transform.insertBefore(
      'return this.buildWithDefaults',
      `
      // Custom filename logic could be processed here
      const customName = this.getAuxiliary('customFileName');
      if (customName) {
        console.log('Custom filename requested:', customName);
      }
    `,
    ),
  )

  .build();
```

## Next Steps

- Explore [Plugin Development](./plugins.md) for extending functionality with
  the powerful plugin system
- Check out [Examples](/examples/) for real-world usage patterns
- Review the [API Reference](/api/reference) for detailed API information
- See [CLI Commands](./cli-commands.md) for automation options
