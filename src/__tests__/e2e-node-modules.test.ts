/**
 * E2E tests for node_modules types
 * Tests builder generation for types from external packages
 */

import { describe, test, expect } from 'vitest';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import {
  createTestProject,
  createTestRunner,
  assertCommandSuccess,
  assertBuilderGenerated,
  type TestProjectConfig,
} from './test-utils.js';

describe('E2E - Node Modules', () => {
  test('generates builder for interface using Node.js built-in types', async () => {
    const projectConfig: TestProjectConfig = {
      devDependencies: {
        '@types/node': '^20.0.0',
      },
    };

    const project = createTestProject(projectConfig);

    try {
      const typeDefinitions = `
import { URL } from 'url';
import { EventEmitter } from 'events';

export interface ServerConfig {
  id: string;
  url: URL;
  buffer: Buffer;
  emitter: EventEmitter;
  environment: NodeJS.ProcessEnv;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'ServerConfig');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('serverconfig-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { URL } from "url";',
          'import { EventEmitter } from "events";',
          'import { serverConfig } from "./serverconfig-builder.js";',
          'import type { ServerConfig } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Server config with Node types',
            builderCode: `serverConfig()
  .withId("server-1")
  .withUrl(new URL("https://example.com"))
  .withBuffer(Buffer.from("hello"))
  .withEmitter(new EventEmitter())
  .withEnvironment(process.env)
  .build()`,
            expectedObject: {
              id: 'server-1',
              url: new URL('https://example.com'),
              buffer: Buffer.from('hello'),
              emitter: new EventEmitter(),
              environment: process.env,
            },
            typeName: 'ServerConfig',
            assertions: [
              '// Verify types',
              'if (!(server_config_with_node_types.url instanceof URL)) throw new Error("url is not a URL");',
              'if (!Buffer.isBuffer(server_config_with_node_types.buffer)) throw new Error("buffer is not a Buffer");',
              'if (!(server_config_with_node_types.emitter instanceof EventEmitter)) throw new Error("emitter is not an EventEmitter");',
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
  }, 15000);

  test('generates builder for interface extending Node.js types', async () => {
    const projectConfig: TestProjectConfig = {
      devDependencies: {
        '@types/node': '^20.0.0',
      },
    };

    const project = createTestProject(projectConfig);

    try {
      const typeDefinitions = `
import { Readable, Writable } from 'stream';

export interface StreamProcessor {
  id: string;
  input: Readable;
  output: Writable;
  encoding?: BufferEncoding;
  highWaterMark?: number;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'StreamProcessor');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('streamprocessor-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { Readable, Writable } from "stream";',
          'import { streamProcessor } from "./streamprocessor-builder.js";',
          'import type { StreamProcessor } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Stream processor',
            builderCode: `streamProcessor()
  .withId("processor-1")
  .withInput(new Readable())
  .withOutput(new Writable())
  .withEncoding("utf8")
  .withHighWaterMark(16384)
  .build()`,
            expectedObject: {
              id: 'processor-1',
              input: new Readable(),
              output: new Writable(),
              encoding: 'utf8',
              highWaterMark: 16384,
            },
            typeName: 'StreamProcessor',
            assertions: [
              '// Verify stream types',
              'if (!(stream_processor.input instanceof Readable)) throw new Error("input is not a Readable");',
              'if (!(stream_processor.output instanceof Writable)) throw new Error("output is not a Writable");',
              'if (stream_processor.id !== "processor-1") throw new Error("id mismatch");',
              'if (stream_processor.encoding !== "utf8") throw new Error("encoding mismatch");',
              'if (stream_processor.highWaterMark !== 16384) throw new Error("highWaterMark mismatch");',
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
  }, 15000);

  test('generates builder for type using Promise and Error types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface AsyncOperation<T> {
  id: string;
  promise: Promise<T>;
  onError?: (error: Error) => void;
  timeout?: number;
}

export type AsyncStringOperation = AsyncOperation<string>;
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'AsyncStringOperation');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('asyncstringoperation-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { asyncStringOperation } from "./asyncstringoperation-builder.js";',
          'import type { AsyncStringOperation } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Async string operation',
            builderCode: `asyncStringOperation()
  .withId("async-1")
  .withPromise(Promise.resolve("Hello async"))
  .withOnError((error) => console.error(error))
  .withTimeout(5000)
  .build()`,
            expectedObject: {
              id: 'async-1',
              promise: Promise.resolve('Hello async'),
              onError: () => undefined,
              timeout: 5000,
            },
            typeName: 'AsyncStringOperation',
            assertions: [
              '// Verify promise and function',
              'if (!(async_string_operation.promise instanceof Promise)) throw new Error("promise is not a Promise");',
              'if (typeof async_string_operation.onError !== "function") throw new Error("onError is not a function");',
              'if (async_string_operation.id !== "async-1") throw new Error("id mismatch");',
              'if (async_string_operation.timeout !== 5000) throw new Error("timeout mismatch");',
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
  }, 15000);

  test('generates builder for type using global TypeScript types', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface DOMConfig {
  element: HTMLElement;
  document: Document;
  window: Window;
  storage: Storage;
  location: Location;
}

export interface TypedArrays {
  int8: Int8Array;
  uint8: Uint8Array;
  int16: Int16Array;
  uint16: Uint16Array;
  int32: Int32Array;
  uint32: Uint32Array;
  float32: Float32Array;
  float64: Float64Array;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder for TypedArrays (simpler to test in Node)
      const result = await project.generateBuilder('types.ts', 'TypedArrays');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('typedarrays-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { typedArrays } from "./typedarrays-builder.js";',
          'import type { TypedArrays } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Typed arrays',
            builderCode: `typedArrays()
  .withInt8(new Int8Array([1, 2, 3]))
  .withUint8(new Uint8Array([255, 128, 0]))
  .withInt16(new Int16Array([1000, -1000]))
  .withUint16(new Uint16Array([65535, 32768]))
  .withInt32(new Int32Array([2147483647]))
  .withUint32(new Uint32Array([4294967295]))
  .withFloat32(new Float32Array([3.14]))
  .withFloat64(new Float64Array([Math.PI]))
  .build()`,
            expectedObject: {
              int8: new Int8Array([1, 2, 3]),
              uint8: new Uint8Array([255, 128, 0]),
              int16: new Int16Array([1000, -1000]),
              uint16: new Uint16Array([65535, 32768]),
              int32: new Int32Array([2147483647]),
              uint32: new Uint32Array([4294967295]),
              float32: new Float32Array([3.14]),
              float64: new Float64Array([Math.PI]),
            },
            typeName: 'TypedArrays',
            assertions: [
              '// Verify typed array types',
              'if (!(typed_arrays.int8 instanceof Int8Array)) throw new Error("int8 is not an Int8Array");',
              'if (!(typed_arrays.uint8 instanceof Uint8Array)) throw new Error("uint8 is not a Uint8Array");',
              'if (!(typed_arrays.float64 instanceof Float64Array)) throw new Error("float64 is not a Float64Array");',
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
  }, 15000);

  test('generates builder for type using Map and Set', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface CollectionTypes {
  stringMap: Map<string, number>;
  numberSet: Set<number>;
  weakMap?: WeakMap<object, string>;
  weakSet?: WeakSet<object>;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'CollectionTypes');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('collectiontypes-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { collectionTypes } from "./collectiontypes-builder.js";',
          'import type { CollectionTypes } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Collection types',
            builderCode: `(() => {
  const map = new Map<string, number>();
  map.set("a", 1);
  map.set("b", 2);

  const set = new Set<number>();
  set.add(10);
  set.add(20);

  const weakMap = new WeakMap<object, string>();
  const obj1 = {};
  const obj2 = {};
  weakMap.set(obj1, "first");
  weakMap.set(obj2, "second");

  const weakSet = new WeakSet<object>();
  weakSet.add(obj1);
  weakSet.add(obj2);

  return collectionTypes()
    .withStringMap(map)
    .withNumberSet(set)
    .withWeakMap(weakMap)
    .withWeakSet(weakSet)
    .build();
})()`,
            expectedObject: {
              stringMap: new Map(),
              numberSet: new Set(),
              weakMap: new WeakMap(),
              weakSet: new WeakSet(),
            },
            typeName: 'CollectionTypes',
            assertions: [
              '// Verify collection types',
              'if (!(collection_types.stringMap instanceof Map)) throw new Error("stringMap is not a Map");',
              'if (!(collection_types.numberSet instanceof Set)) throw new Error("numberSet is not a Set");',
              'if (collection_types.weakMap && !(collection_types.weakMap instanceof WeakMap)) throw new Error("weakMap is not a WeakMap");',
              'if (collection_types.weakSet && !(collection_types.weakSet instanceof WeakSet)) throw new Error("weakSet is not a WeakSet");',
              '// Verify Map contents',
              'if (collection_types.stringMap.get("a") !== 1) throw new Error("Map value for a is incorrect");',
              'if (collection_types.stringMap.get("b") !== 2) throw new Error("Map value for b is incorrect");',
              '// Verify Set contents',
              'if (!collection_types.numberSet.has(10)) throw new Error("Set does not contain 10");',
              'if (!collection_types.numberSet.has(20)) throw new Error("Set does not contain 20");',
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
  }, 15000);

  test('generates builder for type with RegExp and Date', async () => {
    const project = createTestProject();

    try {
      const typeDefinitions = `
export interface ValidationRule {
  name: string;
  pattern: RegExp;
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date | null;
}
`;

      project.writeFile('types.ts', typeDefinitions);

      // Generate builder
      const result = await project.generateBuilder('types.ts', 'ValidationRule');
      const builderCode = assertBuilderGenerated(result);
      project.writeFile('validationrule-builder.ts', builderCode);

      // Create test runner
      const testRunnerCode = createTestRunner({
        imports: [
          'import { validationRule } from "./validationrule-builder.js";',
          'import type { ValidationRule } from "./types.js";',
        ],
        testCases: [
          {
            name: 'Validation rule with RegExp and Date',
            builderCode: `validationRule()
  .withName("email")
  .withPattern(/^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$/)
  .withCreatedAt(new Date("2023-01-01"))
  .withUpdatedAt(new Date("2023-06-01"))
  .withExpiresAt(new Date("2024-01-01"))
  .build()`,
            expectedObject: {
              name: 'email',
              pattern: /^[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}$/,
              createdAt: new Date('2023-01-01'),
              updatedAt: new Date('2023-06-01'),
              expiresAt: new Date('2024-01-01'),
            },
            typeName: 'ValidationRule',
            assertions: [
              '// Verify RegExp',
              'if (!(validation_rule_with_regexp_and_date.pattern instanceof RegExp)) throw new Error("pattern is not a RegExp");',
              '// Test the regex pattern',
              'if (!validation_rule_with_regexp_and_date.pattern.test("test@example.com")) throw new Error("RegExp does not match valid email");',
              'if (validation_rule_with_regexp_and_date.pattern.test("invalid-email")) throw new Error("RegExp matches invalid email");',
              '// Verify dates',
              'if (!(validation_rule_with_regexp_and_date.createdAt instanceof Date)) throw new Error("createdAt is not a Date");',
              'if (validation_rule_with_regexp_and_date.createdAt.getUTCFullYear() !== 2023) throw new Error("createdAt year is incorrect");',
            ],
          },
          {
            name: 'Validation rule with null expiry',
            builderCode: `validationRule()
  .withName("username")
  .withPattern(/^[a-zA-Z0-9_]{3,20}$/)
  .withCreatedAt(new Date("2023-01-01"))
  .withExpiresAt(null)
  .build()`,
            expectedObject: {
              name: 'username',
              pattern: /^[a-zA-Z0-9_]{3,20}$/,
              createdAt: new Date('2023-01-01'),
              expiresAt: null,
            },
            typeName: 'ValidationRule',
            assertions: [
              '// Verify null expiry',
              'if (validation_rule_with_null_expiry.expiresAt !== null) throw new Error("expiresAt should be null");',
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
  }, 15000);
});
