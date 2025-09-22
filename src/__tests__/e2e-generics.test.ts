/**
 * E2E tests for generic types
 * Tests builder generation for interfaces and types with generic parameters
 */

import { describe, test, expect } from 'vitest';
import {
  createTestProject,
  createTestRunner,
  assertCommandSuccess,
  assertBuilderGenerated,
  assertMultipleBuildersGenerated,
} from './test-utils.js';

describe('E2E - Generics', () => {
  test('generates builder for basic generic interface', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Container<T> {
  id: string;
  value: T;
  timestamp: Date;
}

export type StringContainer = Container<string>;
export type NumberContainer = Container<number>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate multiple builders using multiple generation mode
      const result = await project.generateMultiple('types.ts', [
        'StringContainer',
        'NumberContainer',
      ]);
      const builders = assertMultipleBuildersGenerated(result);

      // Write all generated files
      for (const [fileName, content] of builders) {
        project.writeFile(fileName, content);
      }

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { stringContainer } from "./StringContainer.builder.js";',
          'import { numberContainer } from "./NumberContainer.builder.js";',
          'import type { StringContainer, NumberContainer } from "./types.js";',
        ],
        testCases: [
          {
            name: 'String container',
            builderCode: `stringContainer()
  .withId("container-1")
  .withValue("Hello World")
  .withTimestamp(new Date("2023-01-01"))
  .build()`,
            expectedObject: {
              id: 'container-1',
              value: 'Hello World',
              timestamp: new Date('2023-01-01'),
            },
            typeName: 'StringContainer',
          },
          {
            name: 'Number container',
            builderCode: `numberContainer()
  .withId("container-2")
  .withValue(42)
  .withTimestamp(new Date("2023-01-02"))
  .build()`,
            expectedObject: {
              id: 'container-2',
              value: 42,
              timestamp: new Date('2023-01-02'),
            },
            typeName: 'NumberContainer',
          },
        ],
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // Run all checks
      assertCommandSuccess(await project.install(), 'npm install');
      assertCommandSuccess(await project.typecheck(), 'typecheck');
      assertCommandSuccess(await project.lint(), 'lint');
      assertCommandSuccess(await project.compile(['test-runner.ts']), 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');
    } finally {
      project.cleanup();
    }
  }, 30000);

  test('generates builder for multiple generic parameters', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface KeyValuePair<K, V> {
  key: K;
  value: V;
  metadata?: Record<string, unknown>;
}

export type StringNumberPair = KeyValuePair<string, number>;
export type BooleanStringPair = KeyValuePair<boolean, string>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const snResult = await project.generateBuilder('types.ts', 'StringNumberPair');
      const snBuilder = assertBuilderGenerated(snResult);
      project.writeFile('stringnumberpair-builder.ts', snBuilder);

      const bsResult = await project.generateBuilder('types.ts', 'BooleanStringPair');
      const bsBuilder = assertBuilderGenerated(bsResult);
      project.writeFile('booleanstringpair-builder.ts', bsBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { stringNumberPair } from "./stringnumberpair-builder.js";',
          'import { booleanStringPair } from "./booleanstringpair-builder.js";',
          'import type { StringNumberPair, BooleanStringPair } from "./types.js";',
        ],
        testCases: [
          {
            name: 'String-Number pair',
            builderCode: `stringNumberPair()
  .withKey("count")
  .withValue(100)
  .withMetadata({ source: "api" })
  .build()`,
            expectedObject: {
              key: 'count',
              value: 100,
              metadata: { source: 'api' },
            },
            typeName: 'StringNumberPair',
          },
          {
            name: 'Boolean-String pair',
            builderCode: `booleanStringPair()
  .withKey(true)
  .withValue("enabled")
  .build()`,
            expectedObject: {
              key: true,
              value: 'enabled',
            },
            typeName: 'BooleanStringPair',
          },
        ],
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // Run all checks
      assertCommandSuccess(await project.install(), 'npm install');
      assertCommandSuccess(await project.typecheck(), 'typecheck');
      assertCommandSuccess(await project.lint(), 'lint');
      assertCommandSuccess(await project.compile(['test-runner.ts']), 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');
    } finally {
      project.cleanup();
    }
  }, 30000);

  test('generates builder for generic with default type', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export type DefaultResponse = ApiResponse;
export type UserResponse = ApiResponse<{ id: string; name: string }>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const defaultResult = await project.generateBuilder('types.ts', 'DefaultResponse');
      const defaultBuilder = assertBuilderGenerated(defaultResult);
      project.writeFile('defaultresponse-builder.ts', defaultBuilder);

      const userResult = await project.generateBuilder('types.ts', 'UserResponse');
      const userBuilder = assertBuilderGenerated(userResult);
      project.writeFile('userresponse-builder.ts', userBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { defaultResponse } from "./defaultresponse-builder.js";',
          'import { userResponse } from "./userresponse-builder.js";',
          'import type { DefaultResponse, UserResponse } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Default response with unknown data',
            builderCode: `defaultResponse()
  .withSuccess(true)
  .withData({ anything: "goes" })
  .withTimestamp(1234567890)
  .build()`,
            expectedObject: {
              success: true,
              data: { anything: 'goes' },
              timestamp: 1234567890,
            },
            typeName: 'DefaultResponse',
          },
          {
            name: 'User response with typed data',
            builderCode: `userResponse()
  .withSuccess(true)
  .withData({ id: "user-1", name: "Alice" })
  .withTimestamp(1234567891)
  .build()`,
            expectedObject: {
              success: true,
              data: { id: 'user-1', name: 'Alice' },
              timestamp: 1234567891,
            },
            typeName: 'UserResponse',
          },
        ],
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // Run all checks
      assertCommandSuccess(await project.install(), 'npm install');
      assertCommandSuccess(await project.typecheck(), 'typecheck');
      assertCommandSuccess(await project.lint(), 'lint');
      assertCommandSuccess(await project.compile(['test-runner.ts']), 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');
    } finally {
      project.cleanup();
    }
  }, 30000);

  test('generates builder for generic with constraints', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Entity {
  id: string;
}

export interface User extends Entity {
  name: string;
  email: string;
}

export interface Product extends Entity {
  title: string;
  price: number;
}

export interface Store<T extends Entity> {
  name: string;
  items: T[];
  getById(id: string): T | undefined;
}

export type UserStore = Store<User>;
export type ProductStore = Store<Product>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const userStoreResult = await project.generateBuilder('types.ts', 'UserStore');
      const userStoreBuilder = assertBuilderGenerated(userStoreResult);
      project.writeFile('userstore-builder.ts', userStoreBuilder);

      const productStoreResult = await project.generateBuilder('types.ts', 'ProductStore');
      const productStoreBuilder = assertBuilderGenerated(productStoreResult);
      project.writeFile('productstore-builder.ts', productStoreBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { userStore } from "./userstore-builder.js";',
          'import { productStore } from "./productstore-builder.js";',
          'import type { UserStore, ProductStore } from "./types.js";',
        ],
        testCases: [
          {
            name: 'User store with constrained type',
            builderCode: `userStore()
  .withName("User Database")
  .withItems([
    { id: "1", name: "Alice", email: "alice@example.com" },
    { id: "2", name: "Bob", email: "bob@example.com" }
  ])
  .withGetById(() => undefined)
  .build()`,
            expectedObject: {
              name: 'User Database',
              items: [
                { id: '1', name: 'Alice', email: 'alice@example.com' },
                { id: '2', name: 'Bob', email: 'bob@example.com' },
              ],
              getById: () => undefined,
            },
            typeName: 'UserStore',
            assertions: [
              '// Verify function property exists',
              'if (typeof user_store_with_constrained_type.getById !== "function") throw new Error("getById is not a function");',
            ],
          },
          {
            name: 'Product store with constrained type',
            builderCode: `productStore()
  .withName("Product Catalog")
  .withItems([
    { id: "p1", title: "Laptop", price: 999.99 },
    { id: "p2", title: "Mouse", price: 29.99 }
  ])
  .withGetById(() => undefined)
  .build()`,
            expectedObject: {
              name: 'Product Catalog',
              items: [
                { id: 'p1', title: 'Laptop', price: 999.99 },
                { id: 'p2', title: 'Mouse', price: 29.99 },
              ],
              getById: () => undefined,
            },
            typeName: 'ProductStore',
            assertions: [
              '// Verify function property exists',
              'if (typeof product_store_with_constrained_type.getById !== "function") throw new Error("getById is not a function");',
            ],
          },
        ],
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // Run all checks
      assertCommandSuccess(await project.install(), 'npm install');
      assertCommandSuccess(await project.typecheck(), 'typecheck');
      assertCommandSuccess(await project.lint(), 'lint');
      assertCommandSuccess(await project.compile(['test-runner.ts']), 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');
    } finally {
      project.cleanup();
    }
  }, 30000);

  test('generates builder for nested generics', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Result<T, E = Error> {
  success: boolean;
  value?: T;
  error?: E;
}

export interface PagedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type PagedUserResult = Result<PagedData<{ id: string; name: string }>, string>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'PagedUserResult');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('pageduserresult-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { pagedUserResult } from "./pageduserresult-builder.js";',
          'import type { PagedUserResult } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Successful paged user result',
            builderCode: `pagedUserResult()
  .withSuccess(true)
  .withValue({
    items: [
      { id: "1", name: "User One" },
      { id: "2", name: "User Two" }
    ],
    total: 50,
    page: 1,
    pageSize: 10
  })
  .build()`,
            expectedObject: {
              success: true,
              value: {
                items: [
                  { id: '1', name: 'User One' },
                  { id: '2', name: 'User Two' },
                ],
                total: 50,
                page: 1,
                pageSize: 10,
              },
            },
            typeName: 'PagedUserResult',
          },
          {
            name: 'Failed paged user result',
            builderCode: `pagedUserResult()
  .withSuccess(false)
  .withError("Database connection failed")
  .build()`,
            expectedObject: {
              success: false,
              error: 'Database connection failed',
            },
            typeName: 'PagedUserResult',
          },
        ],
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // Run all checks
      assertCommandSuccess(await project.install(), 'npm install');
      assertCommandSuccess(await project.typecheck(), 'typecheck');
      assertCommandSuccess(await project.lint(), 'lint');
      assertCommandSuccess(await project.compile(['test-runner.ts']), 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');
    } finally {
      project.cleanup();
    }
  }, 30000);

  test('generates builder for conditional generic types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export type IsArray<T> = T extends unknown[] ? true : false;
export type ArrayElement<T> = T extends (infer E)[] ? E : never;

// Helper type to omit properties with never type
type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

export type ConditionalContainer<T> = OmitNever<{
  value: T;
  isArray: IsArray<T>;
  firstElement: ArrayElement<T>;
}>;

export type StringArrayContainer = ConditionalContainer<string[]>;
export type NumberContainer = ConditionalContainer<number>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const arrayResult = await project.generateBuilder('types.ts', 'StringArrayContainer');
      const arrayBuilder = assertBuilderGenerated(arrayResult);
      project.writeFile('stringarraycontainer-builder.ts', arrayBuilder);

      const numberResult = await project.generateBuilder('types.ts', 'NumberContainer');
      const numberBuilder = assertBuilderGenerated(numberResult);
      project.writeFile('numbercontainer-builder.ts', numberBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { stringArrayContainer } from "./stringarraycontainer-builder.js";',
          'import { numberContainer } from "./numbercontainer-builder.js";',
          'import type { StringArrayContainer, NumberContainer } from "./types.js";',
        ],
        testCases: [
          {
            name: 'String array container',
            builderCode: `stringArrayContainer()
  .withValue(["hello", "world"])
  .withIsArray(true)
  .withFirstElement("hello")
  .build()`,
            expectedObject: {
              value: ['hello', 'world'],
              isArray: true,
              firstElement: 'hello',
            },
            typeName: 'StringArrayContainer',
          },
          {
            name: 'Number container',
            builderCode: `numberContainer()
  .withValue(42)
  .withIsArray(false)
  .build()`,
            expectedObject: {
              value: 42,
              isArray: false,
              // firstElement should not exist for never types
            },
            typeName: 'NumberContainer',
          },
        ],
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // Run all checks
      assertCommandSuccess(await project.install(), 'npm install');
      assertCommandSuccess(await project.typecheck(), 'typecheck');
      assertCommandSuccess(await project.lint(), 'lint');
      assertCommandSuccess(await project.compile(['test-runner.ts']), 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');
    } finally {
      project.cleanup();
    }
  }, 30000);

  test('generates builder for mapped type with generics', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

export interface UserData {
  id: string;
  name: string;
  age: number;
  email: string;
}

export type NullableUserData = Nullable<UserData>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'NullableUserData');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('nullableuserdata-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { nullableUserData } from "./nullableuserdata-builder.js";',
          'import type { NullableUserData } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Nullable user data with some nulls',
            builderCode: `nullableUserData()
  .withId("user-123")
  .withName("John Doe")
  .build()`,
            expectedObject: {
              id: 'user-123',
              name: 'John Doe',
              age: 0, // TypeScript sees this as primitive number, not nullable
              email: '', // TypeScript sees this as primitive string, not nullable
            },
            typeName: 'NullableUserData',
          },
          {
            name: 'Nullable user data with all values',
            builderCode: `nullableUserData()
  .withId("user-456")
  .withName("Jane Smith")
  .withAge(25)
  .withEmail("jane@example.com")
  .build()`,
            expectedObject: {
              id: 'user-456',
              name: 'Jane Smith',
              age: 25,
              email: 'jane@example.com',
            },
            typeName: 'NullableUserData',
          },
        ],
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // Run all checks
      assertCommandSuccess(await project.install(), 'npm install');
      assertCommandSuccess(await project.typecheck(), 'typecheck');
      assertCommandSuccess(await project.lint(), 'lint');
      assertCommandSuccess(await project.compile(['test-runner.ts']), 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');
    } finally {
      project.cleanup();
    }
  }, 30000);
});
