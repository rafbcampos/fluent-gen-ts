/**
 * E2E tests for complex type structures
 * Tests builder generation for nested, circular, and complex type compositions
 */

import { describe, test, expect } from 'vitest';
import {
  createTestProject,
  createTestRunner,
  assertCommandSuccess,
  assertBuilderGenerated,
} from './test-utils.js';

describe('E2E - Complex Structures', () => {
  test('generates builder for deeply nested interfaces', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Address {
  street: string;
  city: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Company {
  name: string;
  address: Address;
  departments: {
    name: string;
    manager: {
      id: string;
      name: string;
      contact: {
        email: string;
        phone?: string;
      };
    };
    employees: Array<{
      id: string;
      name: string;
      role: string;
    }>;
  }[];
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'Company');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('company-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { company } from "./company-builder.js";',
          'import type { Company } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Deeply nested company structure',
            builderCode: `company()
  .withName("Tech Corp")
  .withAddress({
    street: "123 Tech Street",
    city: "San Francisco",
    country: "USA",
    coordinates: {
      latitude: 37.7749,
      longitude: -122.4194
    }
  })
  .withDepartments([
    {
      name: "Engineering",
      manager: {
        id: "mgr-1",
        name: "Alice Manager",
        contact: {
          email: "alice@techcorp.com",
          phone: "+1-555-0100"
        }
      },
      employees: [
        { id: "emp-1", name: "Bob Developer", role: "Senior Engineer" },
        { id: "emp-2", name: "Carol Coder", role: "Junior Engineer" }
      ]
    },
    {
      name: "Marketing",
      manager: {
        id: "mgr-2",
        name: "David Director",
        contact: {
          email: "david@techcorp.com"
        }
      },
      employees: [
        { id: "emp-3", name: "Eve Marketer", role: "Marketing Lead" }
      ]
    }
  ])
  .build()`,
            expectedObject: {
              name: 'Tech Corp',
              address: {
                street: '123 Tech Street',
                city: 'San Francisco',
                country: 'USA',
                coordinates: {
                  latitude: 37.7749,
                  longitude: -122.4194,
                },
              },
              departments: [
                {
                  name: 'Engineering',
                  manager: {
                    id: 'mgr-1',
                    name: 'Alice Manager',
                    contact: {
                      email: 'alice@techcorp.com',
                      phone: '+1-555-0100',
                    },
                  },
                  employees: [
                    { id: 'emp-1', name: 'Bob Developer', role: 'Senior Engineer' },
                    { id: 'emp-2', name: 'Carol Coder', role: 'Junior Engineer' },
                  ],
                },
                {
                  name: 'Marketing',
                  manager: {
                    id: 'mgr-2',
                    name: 'David Director',
                    contact: {
                      email: 'david@techcorp.com',
                    },
                  },
                  employees: [{ id: 'emp-3', name: 'Eve Marketer', role: 'Marketing Lead' }],
                },
              ],
            },
            typeName: 'Company',
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

  test('generates builder for circular reference types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface TreeNode {
  id: string;
  value: string;
  parent?: TreeNode;
  children: TreeNode[];
  metadata?: {
    level: number;
    path: string;
  };
}

export interface LinkedListNode {
  value: number;
  next?: LinkedListNode;
  previous?: LinkedListNode;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const treeResult = await project.generateBuilder('types.ts', 'TreeNode');
      const treeBuilder = assertBuilderGenerated(treeResult);
      project.writeFile('treenode-builder.ts', treeBuilder);

      const listResult = await project.generateBuilder('types.ts', 'LinkedListNode');
      const listBuilder = assertBuilderGenerated(listResult);
      project.writeFile('linkedlistnode-builder.ts', listBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { treeNode } from "./treenode-builder.js";',
          'import { linkedListNode } from "./linkedlistnode-builder.js";',
          'import type { TreeNode, LinkedListNode } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Tree with circular parent reference',
            builderCode: `(() => {
  const root: TreeNode = {
    id: "root",
    value: "Root Node",
    children: []
  };

  const child1: TreeNode = {
    id: "child1",
    value: "Child 1",
    parent: root,
    children: [],
    metadata: { level: 1, path: "/root/child1" }
  };

  const child2: TreeNode = {
    id: "child2",
    value: "Child 2",
    parent: root,
    children: [],
    metadata: { level: 1, path: "/root/child2" }
  };

  root.children = [child1, child2];

  return treeNode()
    .withId("root")
    .withValue("Root Node")
    .withChildren([child1, child2])
    .build();
})()`,
            expectedObject: {
              id: 'root',
              value: 'Root Node',
              children: [
                {
                  id: 'child1',
                  value: 'Child 1',
                  children: [],
                  metadata: { level: 1, path: '/root/child1' },
                },
                {
                  id: 'child2',
                  value: 'Child 2',
                  children: [],
                  metadata: { level: 1, path: '/root/child2' },
                },
              ],
            },
            typeName: 'TreeNode',
            assertions: [
              '// Verify tree structure',
              'if (tree_with_circular_parent_reference.children.length !== 2) throw new Error("Should have 2 children");',
              'if (tree_with_circular_parent_reference.children[0]?.id !== "child1") throw new Error("First child id incorrect");',
              'if (tree_with_circular_parent_reference.children[1]?.id !== "child2") throw new Error("Second child id incorrect");',
            ],
          },
          {
            name: 'Linked list node',
            builderCode: `(() => {
  const node1 = linkedListNode()
    .withValue(10)
    .build();

  const node2 = linkedListNode()
    .withValue(20)
    .withPrevious(node1)
    .build();

  node1.next = node2;

  return node1;
})()`,
            expectedObject: {
              value: 10,
              next: null,
            },
            typeName: 'LinkedListNode',
            assertions: [
              '// Verify linked list',
              'if (!linked_list_node.next) throw new Error("Should have next node");',
              'if (linked_list_node.next?.value !== 20) throw new Error("Next node value incorrect");',
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

  test('generates builder for union and intersection types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Timestamped {
  createdAt: Date;
  updatedAt?: Date;
}

export interface Identifiable {
  id: string;
  uuid?: string;
}

export interface Named {
  name: string;
  displayName?: string;
}

// Intersection type
export type Entity = Identifiable & Named & Timestamped;

// Union types
export type Status = "pending" | "approved" | "rejected";
export type Priority = 1 | 2 | 3 | 4 | 5;

export interface Task extends Entity {
  description: string;
  status: Status;
  priority: Priority;
  assignee: string | { id: string; name: string };
  tags: string[] | Set<string>;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const entityResult = await project.generateBuilder('types.ts', 'Entity');
      const entityBuilder = assertBuilderGenerated(entityResult);
      project.writeFile('entity-builder.ts', entityBuilder);

      const taskResult = await project.generateBuilder('types.ts', 'Task');
      const taskBuilder = assertBuilderGenerated(taskResult);
      project.writeFile('task-builder.ts', taskBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { entity } from "./entity-builder.js";',
          'import { task } from "./task-builder.js";',
          'import type { Entity, Task } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Entity with intersection types',
            builderCode: `entity()
  .withId("entity-1")
  .withUuid("550e8400-e29b-41d4-a716-446655440000")
  .withName("Test Entity")
  .withDisplayName("Display Test Entity")
  .withCreatedAt(new Date("2023-01-01"))
  .withUpdatedAt(new Date("2023-06-01"))
  .build()`,
            expectedObject: {
              id: 'entity-1',
              uuid: '550e8400-e29b-41d4-a716-446655440000',
              name: 'Test Entity',
              displayName: 'Display Test Entity',
              createdAt: new Date('2023-01-01'),
              updatedAt: new Date('2023-06-01'),
            },
            typeName: 'Entity',
          },
          {
            name: 'Task with union types (string assignee)',
            builderCode: `task()
  .withId("task-1")
  .withName("Important Task")
  .withCreatedAt(new Date("2023-01-01"))
  .withDescription("Complete the implementation")
  .withStatus("pending")
  .withPriority(1)
  .withAssignee("john.doe@example.com")
  .withTags(["urgent", "backend", "api"])
  .build()`,
            expectedObject: {
              id: 'task-1',
              name: 'Important Task',
              createdAt: new Date('2023-01-01'),
              description: 'Complete the implementation',
              status: 'pending',
              priority: 1,
              assignee: 'john.doe@example.com',
              tags: ['urgent', 'backend', 'api'],
            },
            typeName: 'Task',
          },
          {
            name: 'Task with union types (object assignee)',
            builderCode: `task()
  .withId("task-2")
  .withName("Review PR")
  .withCreatedAt(new Date("2023-01-02"))
  .withDescription("Review pull request #123")
  .withStatus("approved")
  .withPriority(3)
  .withAssignee({ id: "user-456", name: "Jane Smith" })
  .withTags(new Set(["review", "frontend"]))
  .build()`,
            expectedObject: {
              id: 'task-2',
              name: 'Review PR',
              createdAt: new Date('2023-01-02'),
              description: 'Review pull request #123',
              status: 'approved',
              priority: 3,
              assignee: { id: 'user-456', name: 'Jane Smith' },
              tags: new Set(['review', 'frontend']),
            },
            typeName: 'Task',
            assertions: [
              '// Verify Set type for tags',
              'if (task_with_union_types_object_assignee.tags instanceof Set) {',
              '  if (!task_with_union_types_object_assignee.tags.has("review")) throw new Error("Set should contain review");',
              '  if (!task_with_union_types_object_assignee.tags.has("frontend")) throw new Error("Set should contain frontend");',
              '}',
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

  test('generates builder for mapped types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export type Flags = "feature1" | "feature2" | "feature3" | "experimental";

export type FeatureFlags = {
  [K in Flags]: boolean;
};

export type ConfigValues = {
  [K in Flags as \`config_\${K}\`]: {
    enabled: boolean;
    value?: string | number;
    metadata?: Record<string, unknown>;
  };
};

export interface Application {
  name: string;
  version: string;
  features: FeatureFlags;
  config: ConfigValues;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const flagsResult = await project.generateBuilder('types.ts', 'FeatureFlags');
      const flagsBuilder = assertBuilderGenerated(flagsResult);
      project.writeFile('featureflags-builder.ts', flagsBuilder);

      const appResult = await project.generateBuilder('types.ts', 'Application');
      const appBuilder = assertBuilderGenerated(appResult);
      project.writeFile('application-builder.ts', appBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { featureFlags } from "./featureflags-builder.js";',
          'import { application } from "./application-builder.js";',
          'import type { FeatureFlags, Application } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Feature flags mapped type',
            builderCode: `featureFlags()
  .withFeature1(true)
  .withFeature2(false)
  .withFeature3(true)
  .withExperimental(false)
  .build()`,
            expectedObject: {
              feature1: true,
              feature2: false,
              feature3: true,
              experimental: false,
            },
            typeName: 'FeatureFlags',
          },
          {
            name: 'Application with mapped types',
            builderCode: `application()
  .withName("MyApp")
  .withVersion("1.0.0")
  .withFeatures({
    feature1: true,
    feature2: true,
    feature3: false,
    experimental: true
  })
  .withConfig({
    config_feature1: {
      enabled: true,
      value: "premium",
      metadata: { tier: "gold" }
    },
    config_feature2: {
      enabled: true,
      value: 100
    },
    config_feature3: {
      enabled: false
    },
    config_experimental: {
      enabled: true,
      value: "beta",
      metadata: { releaseDate: "2024-01-01" }
    }
  })
  .build()`,
            expectedObject: {
              name: 'MyApp',
              version: '1.0.0',
              features: {
                feature1: true,
                feature2: true,
                feature3: false,
                experimental: true,
              },
              config: {
                config_feature1: {
                  enabled: true,
                  value: 'premium',
                  metadata: { tier: 'gold' },
                },
                config_feature2: {
                  enabled: true,
                  value: 100,
                },
                config_feature3: {
                  enabled: false,
                },
                config_experimental: {
                  enabled: true,
                  value: 'beta',
                  metadata: { releaseDate: '2024-01-01' },
                },
              },
            },
            typeName: 'Application',
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

  test('generates builder for conditional types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export type IsString<T> = T extends string ? true : false;
export type IsNumber<T> = T extends number ? true : false;

export interface ConditionalField<T> {
  value: T;
  isString: IsString<T>;
  isNumber: IsNumber<T>;
  formatted: T extends string ? string : T extends number ? string : never;
}

export type StringField = ConditionalField<string>;
export type NumberField = ConditionalField<number>;

export interface DataProcessor {
  id: string;
  stringData: StringField;
  numberData: NumberField;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'DataProcessor');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('dataprocessor-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { dataProcessor } from "./dataprocessor-builder.js";',
          'import type { DataProcessor } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Data processor with conditional types',
            builderCode: `dataProcessor()
  .withId("processor-1")
  .withStringData({
    value: "hello world",
    isString: true,
    isNumber: false,
    formatted: "HELLO WORLD"
  })
  .withNumberData({
    value: 42,
    isString: false,
    isNumber: true,
    formatted: "42.00"
  })
  .build()`,
            expectedObject: {
              id: 'processor-1',
              stringData: {
                value: 'hello world',
                isString: true,
                isNumber: false,
                formatted: 'HELLO WORLD',
              },
              numberData: {
                value: 42,
                isString: false,
                isNumber: true,
                formatted: '42.00',
              },
            },
            typeName: 'DataProcessor',
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

  test('generates builder for template literal types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
export type APIVersion = "v1" | "v2" | "v3";
export type Endpoint = \`/api/\${APIVersion}/\${string}\`;

export interface APIRoute {
  method: HTTPMethod;
  endpoint: Endpoint;
  headers: Record<\`x-\${string}\`, string>;
  queryParams?: Record<string, string | number>;
}

export type ColorFormat = "hex" | "rgb" | "hsl";
export type Color = \`#\${string}\` | \`rgb(\${number}, \${number}, \${number})\` | \`hsl(\${number}, \${number}%, \${number}%)\`;

export interface Theme {
  name: string;
  primary: Color;
  secondary: Color;
  background: Color;
  text: Color;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const routeResult = await project.generateBuilder('types.ts', 'APIRoute');
      const routeBuilder = assertBuilderGenerated(routeResult);
      project.writeFile('apiroute-builder.ts', routeBuilder);

      const themeResult = await project.generateBuilder('types.ts', 'Theme');
      const themeBuilder = assertBuilderGenerated(themeResult);
      project.writeFile('theme-builder.ts', themeBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { apiRoute } from "./apiroute-builder.js";',
          'import { theme } from "./theme-builder.js";',
          'import type { APIRoute, Theme } from "./types.js";',
        ],
        testCases: [
          {
            name: 'API route with template literals',
            builderCode: `apiRoute()
  .withMethod("POST")
  .withEndpoint("/api/v2/users")
  .withHeaders({
    "x-api-key": "secret-key-123",
    "x-request-id": "req-456",
    "x-client-version": "1.0.0"
  })
  .withQueryParams({
    page: 1,
    limit: 20,
    sort: "created_at"
  })
  .build()`,
            expectedObject: {
              method: 'POST',
              endpoint: '/api/v2/users',
              headers: {
                'x-api-key': 'secret-key-123',
                'x-request-id': 'req-456',
                'x-client-version': '1.0.0',
              },
              queryParams: {
                page: 1,
                limit: 20,
                sort: 'created_at',
              },
            },
            typeName: 'APIRoute',
          },
          {
            name: 'Theme with color template literals',
            builderCode: `theme()
  .withName("Dark Theme")
  .withPrimary("#007bff")
  .withSecondary("rgb(108, 117, 125)")
  .withBackground("#212529")
  .withText("hsl(0, 0%, 100%)")
  .build()`,
            expectedObject: {
              name: 'Dark Theme',
              primary: '#007bff',
              secondary: 'rgb(108, 117, 125)',
              background: '#212529',
              text: 'hsl(0, 0%, 100%)',
            },
            typeName: 'Theme',
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
