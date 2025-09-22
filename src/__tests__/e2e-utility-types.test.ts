/**
 * E2E tests for TypeScript utility types
 * Tests builder generation for various utility type patterns
 */

import { describe, test, expect } from 'vitest';
import {
  createTestProject,
  createInterfaceFile,
  createTestRunner,
  assertCommandSuccess,
  assertBuilderGenerated,
  assertMultipleBuildersGenerated,
  type InterfaceDefinition,
} from './test-utils.js';

describe('E2E - Utility Types', () => {
  test('generates builder for Pick utility type', async () => {
    const project = createTestProject();

    try {
      // Create interface and Pick type
      const interfaces: InterfaceDefinition[] = [
        {
          name: 'FullUser',
          properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'password', type: 'string' },
            { name: 'createdAt', type: 'Date' },
            { name: 'updatedAt', type: 'Date' },
            { name: 'role', type: '"admin" | "user"' },
            { name: 'isActive', type: 'boolean' },
          ],
        },
      ];

      const typeDefinitions = `
${createInterfaceFile(interfaces)}

export type UserProfile = Pick<FullUser, 'id' | 'name' | 'email' | 'role'>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder for Pick type
      const result = await project.generateBuilder('types.ts', 'UserProfile');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('userprofile-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { userProfile } from "./userprofile-builder.js";',
          'import type { UserProfile } from "./types.js";',
        ],
        testCases: [
          {
            name: 'User profile with Pick',
            builderCode: `userProfile()
  .withId("user-123")
  .withName("Alice Smith")
  .withEmail("alice@example.com")
  .withRole("admin")
  .build()`,
            expectedObject: {
              id: 'user-123',
              name: 'Alice Smith',
              email: 'alice@example.com',
              role: 'admin',
            },
            typeName: 'UserProfile',
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

  test('generates builder for Partial utility type', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Config {
  host: string;
  port: number;
  ssl: boolean;
  timeout: number;
  retries: number;
}

export type PartialConfig = Partial<Config>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder for Partial type
      const result = await project.generateBuilder('types.ts', 'PartialConfig');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('partialconfig-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { partialConfig } from "./partialconfig-builder.js";',
          'import type { PartialConfig } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Partial config with some properties',
            builderCode: `partialConfig()
  .withHost("localhost")
  .withPort(3000)
  .build()`,
            expectedObject: {
              host: 'localhost',
              port: 3000,
            },
            typeName: 'PartialConfig',
          },
          {
            name: 'Empty partial config',
            builderCode: `partialConfig().build()`,
            expectedObject: {},
            typeName: 'PartialConfig',
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

  test('generates builder for Required utility type', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface UserInput {
  name?: string;
  email?: string;
  age?: number;
  newsletter?: boolean;
}

export type RequiredUserInput = Required<UserInput>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder for Required type
      const result = await project.generateBuilder('types.ts', 'RequiredUserInput');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('requireduserinput-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { requiredUserInput } from "./requireduserinput-builder.js";',
          'import type { RequiredUserInput } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Required user input with all fields',
            builderCode: `requiredUserInput()
  .withName("Bob Johnson")
  .withEmail("bob@example.com")
  .withAge(35)
  .withNewsletter(true)
  .build()`,
            expectedObject: {
              name: 'Bob Johnson',
              email: 'bob@example.com',
              age: 35,
              newsletter: true,
            },
            typeName: 'RequiredUserInput',
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

  test('generates builder for Omit utility type', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Product {
  id: string;
  name: string;
  price: number;
  internalCode: string;
  secretKey: string;
  description: string;
}

export type PublicProduct = Omit<Product, 'internalCode' | 'secretKey'>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder for Omit type
      const result = await project.generateBuilder('types.ts', 'PublicProduct');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('publicproduct-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { publicProduct } from "./publicproduct-builder.js";',
          'import type { PublicProduct } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Public product without internal fields',
            builderCode: `publicProduct()
  .withId("prod-123")
  .withName("Laptop")
  .withPrice(999.99)
  .withDescription("High-performance laptop")
  .build()`,
            expectedObject: {
              id: 'prod-123',
              name: 'Laptop',
              price: 999.99,
              description: 'High-performance laptop',
            },
            typeName: 'PublicProduct',
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

  test('generates builder for Record utility type', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export type PermissionMap = Record<string, boolean>;

export type StatusCodes = Record<'success' | 'error' | 'pending', number>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate multiple builders using multiple generation mode
      const result = await project.generateMultiple('types.ts', ['PermissionMap', 'StatusCodes']);
      const builders = assertMultipleBuildersGenerated(result);

      // Write all generated files
      for (const [fileName, content] of builders) {
        project.writeFile(fileName, content);
      }

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { permissionMap } from "./PermissionMap.builder.js";',
          'import { statusCodes } from "./StatusCodes.builder.js";',
          'import type { PermissionMap, StatusCodes } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Permission map',
            builderCode: `permissionMap()
  .withAdditionalProperties({
    read: true,
    write: false,
    delete: false
  })
  .build()`,
            expectedObject: {
              read: true,
              write: false,
              delete: false,
            },
            typeName: 'PermissionMap',
          },
          {
            name: 'Status codes',
            builderCode: `statusCodes()
  .withSuccess(200)
  .withError(500)
  .withPending(102)
  .build()`,
            expectedObject: {
              success: 200,
              error: 500,
              pending: 102,
            },
            typeName: 'StatusCodes',
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

  test('generates builder for nested utility types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Employee {
  id: string;
  name: string;
  email: string;
  salary: number;
  department: string;
  manager?: string;
  startDate: Date;
  permissions: string[];
}

// Nested utility type: Partial of Pick
export type EmployeeUpdate = Partial<Pick<Employee, 'name' | 'email' | 'department' | 'manager'>>;

// Nested utility type: Required of Omit
export type EmployeeCore = Required<Omit<Employee, 'manager' | 'permissions'>>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate multiple builders using multiple generation mode
      const result = await project.generateMultiple('types.ts', ['EmployeeUpdate', 'EmployeeCore']);
      const builders = assertMultipleBuildersGenerated(result);

      // Write all generated files
      for (const [fileName, content] of builders) {
        project.writeFile(fileName, content);
      }

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { employeeUpdate } from "./EmployeeUpdate.builder.js";',
          'import { employeeCore } from "./EmployeeCore.builder.js";',
          'import type { EmployeeUpdate, EmployeeCore } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Employee partial update',
            builderCode: `employeeUpdate()
  .withEmail("newemail@company.com")
  .withDepartment("Engineering")
  .build()`,
            expectedObject: {
              email: 'newemail@company.com',
              department: 'Engineering',
            },
            typeName: 'EmployeeUpdate',
          },
          {
            name: 'Employee core data',
            builderCode: `employeeCore()
  .withId("emp-001")
  .withName("Alice Cooper")
  .withEmail("alice@company.com")
  .withSalary(75000)
  .withDepartment("Marketing")
  .withStartDate(new Date("2023-01-15"))
  .build()`,
            expectedObject: {
              id: 'emp-001',
              name: 'Alice Cooper',
              email: 'alice@company.com',
              salary: 75000,
              department: 'Marketing',
              startDate: new Date('2023-01-15'),
            },
            typeName: 'EmployeeCore',
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

  test('generates builder for interface using utility types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDetails {
  firstName: string;
  lastName: string;
  bio?: string;
  avatar?: string;
}

// Interface using utility types
export interface UserEntity extends BaseEntity {
  profile: Required<UserDetails>;
  settings: Partial<{
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  }>;
  metadata: Record<string, string | number>;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'UserEntity');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('userentity-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { userEntity } from "./userentity-builder.js";',
          'import type { UserEntity } from "./types.js";',
        ],
        testCases: [
          {
            name: 'User entity with utility type properties',
            builderCode: `userEntity()
  .withId("user-789")
  .withCreatedAt(new Date("2023-01-01"))
  .withUpdatedAt(new Date("2023-06-01"))
  .withProfile({
    firstName: "John",
    lastName: "Doe",
    bio: "Software developer",
    avatar: "avatar.jpg"
  })
  .withSettings({
    theme: "dark",
    notifications: true
  })
  .withMetadata({
    loginCount: 42,
    lastIp: "192.168.1.1"
  })
  .build()`,
            expectedObject: {
              id: 'user-789',
              createdAt: new Date('2023-01-01'),
              updatedAt: new Date('2023-06-01'),
              profile: {
                firstName: 'John',
                lastName: 'Doe',
                bio: 'Software developer',
                avatar: 'avatar.jpg',
              },
              settings: {
                theme: 'dark',
                notifications: true,
              },
              metadata: {
                loginCount: 42,
                lastIp: '192.168.1.1',
              },
            },
            typeName: 'UserEntity',
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

  test('generates builder for Readonly utility type', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Configuration {
  apiUrl: string;
  apiKey: string;
  maxRetries: number;
  debug: boolean;
}

export type ReadonlyConfiguration = Readonly<Configuration>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'ReadonlyConfiguration');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('readonlyconfiguration-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { readonlyConfiguration } from "./readonlyconfiguration-builder.js";',
          'import type { ReadonlyConfiguration } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Readonly configuration',
            builderCode: `readonlyConfiguration()
  .withApiUrl("https://api.example.com")
  .withApiKey("secret-key-123")
  .withMaxRetries(3)
  .withDebug(false)
  .build()`,
            expectedObject: {
              apiUrl: 'https://api.example.com',
              apiKey: 'secret-key-123',
              maxRetries: 3,
              debug: false,
            },
            typeName: 'ReadonlyConfiguration',
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
