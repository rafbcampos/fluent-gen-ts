import { describe, test, expect } from 'vitest';
import {
  createTestProject,
  createInterfaceFile,
  createTestRunner,
  assertCommandSuccess,
  assertBuilderGenerated,
} from './test-utils.js';

describe('E2E - Basic', () => {
  test('generate, compile, lint, and execute builders for a given interface', async () => {
    const project = createTestProject();

    try {
      // 1. Create test interface
      const typeDefinition = createInterfaceFile([
        {
          name: 'User',
          properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string', optional: true },
            { name: 'age', type: 'number', optional: true },
            { name: 'role', type: '"admin" | "user" | "guest"' },
            { name: 'isActive', type: 'boolean' },
          ],
        },
      ]);

      project.writeFile('test-types.ts', typeDefinition);

      // 2. Generate builder
      const userResult = await project.generateBuilder('test-types.ts', 'User');
      const builderCode = assertBuilderGenerated(userResult);

      // 3. Write generated builder to file
      project.writeFile('user-builder.ts', builderCode);

      // 4. Create test runner file
      const testRunnerCode = createTestRunner({
        imports: [
          'import { user } from "./user-builder.js";',
          'import type { User } from "./test-types.js";',
        ],
        testCases: [
          {
            name: 'Basic user',
            builderCode: `user()
  .withId("123")
  .withName("John Doe")
  .withRole("admin")
  .withIsActive(true)
  .build({ parentId: "root" })`,
            expectedObject: {
              id: '123',
              name: 'John Doe',
              role: 'admin',
              isActive: true,
            },
            typeName: 'User',
          },
          {
            name: 'User with optional fields',
            builderCode: `user()
  .withId("456")
  .withName("Jane Admin")
  .withRole("user")
  .withIsActive(true)
  .withEmail("jane@example.com")
  .withAge(30)
  .build({ parentId: "root" })`,
            expectedObject: {
              id: '456',
              name: 'Jane Admin',
              role: 'user',
              isActive: true,
              email: 'jane@example.com',
              age: 30,
            },
            typeName: 'User',
          },
        ],
        setup: '// Test basic builder usage and optional fields',
      });

      project.writeFile('test-runner.ts', testRunnerCode);

      // 5. Install dependencies and run typecheck
      const installResult = await project.install();
      assertCommandSuccess(installResult, 'npm install');

      // 6. Run typecheck
      const typecheckResult = await project.typecheck();
      assertCommandSuccess(typecheckResult, 'typecheck');

      // 7. Run lint
      const lintResult = await project.lint();
      assertCommandSuccess(lintResult, 'lint');

      // 8. Compile and run the test
      const compileResult = await project.compile(['test-runner.ts']);
      assertCommandSuccess(compileResult, 'compile');

      const runResult = await project.execute('test-runner.js');
      assertCommandSuccess(runResult, 'execute');
      expect(runResult.stdout).toContain('All tests passed!');

      // 9. Verify the actual output contains expected data
      expect(runResult.stdout).toContain('"id":"123"');
      expect(runResult.stdout).toContain('"name":"John Doe"');
      expect(runResult.stdout).toContain('"role":"admin"');
      expect(runResult.stdout).toContain('"email":"jane@example.com"');
    } finally {
      project.cleanup();
    }
  }, 30000);
});
