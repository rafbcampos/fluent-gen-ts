/**
 * E2E tests for arrays and tuples
 * Tests builder generation for collection types including mixed builders and static objects
 */

import { describe, test, expect } from 'vitest';
import {
  createTestProject,
  createTestRunner,
  assertCommandSuccess,
  assertBuilderGenerated,
} from './test-utils.js';
import { FluentGen } from '../gen/index.js';

describe('E2E - Arrays and Tuples', () => {
  test('generates builder for arrays with mixed builders and static objects', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Address {
  street: string;
  city: string;
  zipCode: string;
  country: string;
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  addresses: Address[];
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Use multiple generation mode since we need both Address and Contact builders
      const generator = new FluentGen();
      const results = await generator.generateMultiple(project.dir + '/types.ts', [
        'Address',
        'Contact',
      ]);

      if (!results.ok) {
        throw new Error(`Multiple generation failed: ${results.error.message}`);
      }

      // Write generated files
      for (const [fileName, content] of results.value) {
        project.writeFile(fileName, content);
      }

      // Create test runner with mixed builders and static objects
      const testRunnerCode = createTestRunner({
        imports: [
          'import { address } from "./Address.builder.js";',
          'import { contact } from "./Contact.builder.js";',
          'import type { Contact } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Contact with mixed address array (builders and static)',
            builderCode: `contact()
  .withName("John Doe")
  .withEmail("john@example.com")
  .withPhone("+1-555-0123")
  .withAddresses([
    // Using builder for first address
    address()
      .withStreet("123 Main St")
      .withCity("New York")
      .withZipCode("10001")
      .withCountry("USA")
      .build(),
    // Using static object for second address
    {
      street: "456 Oak Ave",
      city: "Los Angeles",
      zipCode: "90001",
      country: "USA"
    },
    // Another builder
    address()
      .withStreet("789 Pine Rd")
      .withCity("Chicago")
      .withZipCode("60601")
      .withCountry("USA")
      .build()
  ])
  .build()`,
            expectedObject: {
              name: 'John Doe',
              email: 'john@example.com',
              phone: '+1-555-0123',
              addresses: [
                {
                  street: '123 Main St',
                  city: 'New York',
                  zipCode: '10001',
                  country: 'USA',
                },
                {
                  street: '456 Oak Ave',
                  city: 'Los Angeles',
                  zipCode: '90001',
                  country: 'USA',
                },
                {
                  street: '789 Pine Rd',
                  city: 'Chicago',
                  zipCode: '60601',
                  country: 'USA',
                },
              ],
            },
            typeName: 'Contact',
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

  test('generates builder for nested arrays', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Matrix {
  name: string;
  data: number[][];
  metadata?: {
    rows: number;
    cols: number;
  };
}

export interface Tensor {
  dimensions: number[];
  values: number[][][];
  shape: readonly [number, number, number];
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders
      const generator = new FluentGen();
      const matrixResult = await generator.generateBuilder(project.dir + '/types.ts', 'Matrix');
      const matrixBuilder = assertBuilderGenerated(matrixResult);
      project.writeFile('matrix-builder.ts', matrixBuilder);

      const tensorResult = await generator.generateBuilder(project.dir + '/types.ts', 'Tensor');
      const tensorBuilder = assertBuilderGenerated(tensorResult);
      project.writeFile('tensor-builder.ts', tensorBuilder);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { matrix } from "./matrix-builder.js";',
          'import { tensor } from "./tensor-builder.js";',
          'import type { Matrix, Tensor } from "./types.js";',
        ],
        testCases: [
          {
            name: '2D Matrix',
            builderCode: `matrix()
  .withName("Identity Matrix")
  .withData([
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ])
  .withMetadata({ rows: 3, cols: 3 })
  .build()`,
            expectedObject: {
              name: 'Identity Matrix',
              data: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
              ],
              metadata: { rows: 3, cols: 3 },
            },
            typeName: 'Matrix',
          },
          {
            name: '3D Tensor',
            builderCode: `tensor()
  .withDimensions([2, 2, 2])
  .withValues([
    [[1, 2], [3, 4]],
    [[5, 6], [7, 8]]
  ])
  .withShape([2, 2, 2])
  .build()`,
            expectedObject: {
              dimensions: [2, 2, 2],
              values: [
                [
                  [1, 2],
                  [3, 4],
                ],
                [
                  [5, 6],
                  [7, 8],
                ],
              ],
              shape: [2, 2, 2],
            },
            typeName: 'Tensor',
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

  test('generates builder for tuple types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Coordinate {
  point: [number, number];
  label?: string;
}

export interface RGB {
  color: [red: number, green: number, blue: number];
  alpha?: number;
}

export interface MixedTuple {
  data: [string, number, boolean, { id: string; value: any }];
  metadata?: Record<string, unknown>;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builders using multiple generation
      const generator = new FluentGen();
      const results = await generator.generateMultiple(project.dir + '/types.ts', [
        'Coordinate',
        'RGB',
        'MixedTuple',
      ]);

      if (!results.ok) {
        throw new Error(`Multiple generation failed: ${results.error.message}`);
      }

      // Write generated files
      for (const [fileName, content] of results.value) {
        project.writeFile(fileName, content);
      }

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { coordinate } from "./Coordinate.builder.js";',
          'import { rgb } from "./RGB.builder.js";',
          'import { mixedTuple } from "./MixedTuple.builder.js";',
          'import type { Coordinate, RGB, MixedTuple } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Simple coordinate tuple',
            builderCode: `coordinate()
  .withPoint([10, 20])
  .withLabel("Point A")
  .build()`,
            expectedObject: {
              point: [10, 20],
              label: 'Point A',
            },
            typeName: 'Coordinate',
          },
          {
            name: 'Named tuple RGB',
            builderCode: `rgb()
  .withColor([255, 128, 0])
  .withAlpha(0.8)
  .build()`,
            expectedObject: {
              color: [255, 128, 0],
              alpha: 0.8,
            },
            typeName: 'RGB',
          },
          {
            name: 'Mixed type tuple',
            builderCode: `mixedTuple()
  .withData(["test", 42, true, { id: "obj-1", value: null }])
  .withMetadata({ source: "api", version: 2 })
  .build()`,
            expectedObject: {
              data: ['test', 42, true, { id: 'obj-1', value: null }],
              metadata: { source: 'api', version: 2 },
            },
            typeName: 'MixedTuple',
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

  test('generates builder for arrays of union types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface TextMessage {
  type: 'text';
  content: string;
}

export interface ImageMessage {
  type: 'image';
  url: string;
  alt?: string;
}

export interface VideoMessage {
  type: 'video';
  url: string;
  duration: number;
}

export type Message = TextMessage | ImageMessage | VideoMessage;

export interface Conversation {
  id: string;
  participants: string[];
  messages: Message[];
  tags: (string | { name: string; color: string })[];
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder for Conversation
      const generator = new FluentGen();
      const result = await generator.generateBuilder(project.dir + '/types.ts', 'Conversation');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('conversation-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { conversation } from "./conversation-builder.js";',
          'import type { Conversation } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Conversation with union type array',
            builderCode: `conversation()
  .withId("conv-123")
  .withParticipants(["alice", "bob", "charlie"])
  .withMessages([
    { type: 'text', content: 'Hello everyone!' },
    { type: 'image', url: 'https://example.com/pic.jpg', alt: 'Group photo' },
    { type: 'video', url: 'https://example.com/video.mp4', duration: 120 },
    { type: 'text', content: 'Nice video!' }
  ])
  .withTags([
    "important",
    { name: "project", color: "blue" },
    "meeting",
    { name: "urgent", color: "red" }
  ])
  .build()`,
            expectedObject: {
              id: 'conv-123',
              participants: ['alice', 'bob', 'charlie'],
              messages: [
                { type: 'text', content: 'Hello everyone!' },
                { type: 'image', url: 'https://example.com/pic.jpg', alt: 'Group photo' },
                { type: 'video', url: 'https://example.com/video.mp4', duration: 120 },
                { type: 'text', content: 'Nice video!' },
              ],
              tags: [
                'important',
                { name: 'project', color: 'blue' },
                'meeting',
                { name: 'urgent', color: 'red' },
              ],
            },
            typeName: 'Conversation',
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

  test('generates builder for readonly arrays and tuples', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface ImmutableData {
  id: string;
  values: readonly number[];
  coordinates: readonly [x: number, y: number, z: number];
  matrix: ReadonlyArray<ReadonlyArray<number>>;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const generator = new FluentGen();
      const result = await generator.generateBuilder(project.dir + '/types.ts', 'ImmutableData');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('immutabledata-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { immutableData } from "./immutabledata-builder.js";',
          'import type { ImmutableData } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Immutable data with readonly arrays',
            builderCode: `immutableData()
  .withId("immutable-1")
  .withValues([1, 2, 3, 4, 5])
  .withCoordinates([10, 20, 30])
  .withMatrix([
    [1, 0],
    [0, 1]
  ])
  .build()`,
            expectedObject: {
              id: 'immutable-1',
              values: [1, 2, 3, 4, 5],
              coordinates: [10, 20, 30],
              matrix: [
                [1, 0],
                [0, 1],
              ],
            },
            typeName: 'ImmutableData',
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

  test('generates builder for arrays with nested builders', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface Author {
  id: string;
  name: string;
  email: string;
}

export interface Comment {
  id: string;
  author: Author;
  content: string;
  likes: number;
  replies?: Comment[];
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: Author;
  comments: Comment[];
  tags: string[];
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Use multiple generation for all related types
      const generator = new FluentGen();
      const results = await generator.generateMultiple(project.dir + '/types.ts', [
        'Author',
        'Comment',
        'BlogPost',
      ]);

      if (!results.ok) {
        throw new Error(`Multiple generation failed: ${results.error.message}`);
      }

      // Write generated files
      for (const [fileName, content] of results.value) {
        project.writeFile(fileName, content);
      }

      // Create test runner with nested builders
      const testRunnerCode = createTestRunner({
        imports: [
          'import { author } from "./Author.builder.js";',
          'import { comment } from "./Comment.builder.js";',
          'import { blogPost } from "./BlogPost.builder.js";',
          'import type { BlogPost } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Blog post with nested comment builders',
            builderCode: `blogPost()
  .withId("post-1")
  .withTitle("Understanding TypeScript")
  .withContent("TypeScript is a typed superset of JavaScript...")
  .withAuthor(
    author()
      .withId("author-1")
      .withName("Jane Doe")
      .withEmail("jane@blog.com")
      .build()
  )
  .withComments([
    comment()
      .withId("comment-1")
      .withAuthor(
        author()
          .withId("author-2")
          .withName("John Reader")
          .withEmail("john@example.com")
          .build()
      )
      .withContent("Great article!")
      .withLikes(5)
      .withReplies([
        comment()
          .withId("reply-1")
          .withAuthor(
            author()
              .withId("author-1")
              .withName("Jane Doe")
              .withEmail("jane@blog.com")
              .build()
          )
          .withContent("Thank you!")
          .withLikes(2)
          .build()
      ])
      .build(),
    // Mix with static object
    {
      id: "comment-2",
      author: { id: "author-3", name: "Bob", email: "bob@example.com" },
      content: "Very helpful",
      likes: 3
    }
  ])
  .withTags(["typescript", "programming", "tutorial"])
  .build()`,
            expectedObject: {
              id: 'post-1',
              title: 'Understanding TypeScript',
              content: 'TypeScript is a typed superset of JavaScript...',
              author: {
                id: 'author-1',
                name: 'Jane Doe',
                email: 'jane@blog.com',
              },
              comments: [
                {
                  id: 'comment-1',
                  author: {
                    id: 'author-2',
                    name: 'John Reader',
                    email: 'john@example.com',
                  },
                  content: 'Great article!',
                  likes: 5,
                  replies: [
                    {
                      id: 'reply-1',
                      author: {
                        id: 'author-1',
                        name: 'Jane Doe',
                        email: 'jane@blog.com',
                      },
                      content: 'Thank you!',
                      likes: 2,
                    },
                  ],
                },
                {
                  id: 'comment-2',
                  author: { id: 'author-3', name: 'Bob', email: 'bob@example.com' },
                  content: 'Very helpful',
                  likes: 3,
                },
              ],
              tags: ['typescript', 'programming', 'tutorial'],
            },
            typeName: 'BlogPost',
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
