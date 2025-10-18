# Workflows & Integration

Integrate fluent-gen-ts into your development workflow, CI/CD pipeline, and
toolchain.

## Development Workflows

### Basic Development

The simplest workflow for day-to-day development:

```json
// package.json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "dev": "npm run generate && npm run start:dev",
    "build": "npm run generate && npm run build:app"
  }
}
```

**Usage:**

```bash
# 1. Modify types
vim src/types/user.ts

# 2. Regenerate builders
npm run generate

# 3. Continue development
```

### Watch Mode

Auto-regenerate builders when types change:

```bash
# Install dependencies
npm install -D chokidar-cli concurrently
```

```json
// package.json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "watch:types": "chokidar 'src/types/**/*.ts' -c 'npm run generate'",
    "watch:server": "nodemon src/index.ts",
    "dev": "concurrently \"npm:watch:types\" \"npm:watch:server\""
  }
}
```

Now builders regenerate automatically!

## Git Integration

### Option 1: Commit Generated Files (Recommended)

**Benefits:**

- Better IDE support
- Faster CI builds
- Contributors don't need to generate

**Setup:**

```bash
# .gitignore - DO NOT ignore builders
# !src/builders/
```

```json
// package.json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "precommit": "npm run generate"
  }
}
```

### Option 2: Generate on Demand

**Benefits:**

- Smaller repository
- No merge conflicts in generated files

**Setup:**

```bash
# .gitignore
src/builders/
```

```json
// package.json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "postinstall": "npm run generate",
    "prebuild": "npm run generate",
    "pretest": "npm run generate"
  }
}
```

### Pre-commit Hooks

Ensure builders are up-to-date before committing:

```bash
npm install -D husky lint-staged
npx husky init
```

```bash
# .husky/pre-commit
#!/bin/sh
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "src/types/**/*.ts": ["npm run generate", "git add src/builders"]
  }
}
```

## CI/CD Integration

### GitHub Actions

Complete CI/CD pipeline with builder generation and validation:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate builders
        run: npx fluent-gen-ts batch

      - name: Check builders are up-to-date
        run: |
          git diff --exit-code src/builders || \
          (echo "❌ Builders out of sync! Run 'npm run generate' locally." && exit 1)

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
```

### Other CI Platforms

The pattern is the same for all CI platforms:

1. Install dependencies
2. Generate builders with `npx fluent-gen-ts batch`
3. Verify they're up-to-date (if committing them)
4. Run tests and build

**GitLab CI example:**

```yaml
# .gitlab-ci.yml
test:
  script:
    - npm ci
    - npx fluent-gen-ts batch
    - git diff --exit-code src/builders || exit 1
    - npm test
```

**CircleCI example:**

```yaml
# .circleci/config.yml
jobs:
  build-and-test:
    steps:
      - checkout
      - run: npm ci
      - run: npx fluent-gen-ts batch
      - run: npm test
```

## Testing Integration

### Vitest

Generate builders before running tests:

```typescript
// vitest.setup.ts
import { execSync } from 'child_process';

beforeAll(() => {
  execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
});
```

```json
// package.json
{
  "scripts": {
    "test": "npm run generate && vitest run",
    "test:watch": "vitest watch"
  }
}
```

### Jest

```javascript
// jest.global-setup.js
const { execSync } = require('child_process');

module.exports = async () => {
  execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
};
```

```javascript
// jest.config.js
module.exports = {
  globalSetup: './jest.global-setup.js',
};
```

### Test Fixtures

Use builders to create reusable test data:

```typescript
// tests/fixtures/builders.ts
import { user } from '../../src/builders/user.builder.js';
import { product } from '../../src/builders/product.builder.js';

export const testUser = () =>
  user()
    .withEmail('test@example.com')
    .withName('Test User')
    .withIsActive(true)
    .build();

export const testProduct = () =>
  product().withName('Test Product').withPrice(99.99).withInStock(true).build();
```

## Build Tool Integration

### Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

export default defineConfig({
  plugins: [
    {
      name: 'fluent-gen',
      buildStart() {
        execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
      },
    },
  ],
});
```

### Webpack

```javascript
// webpack.config.js
const { execSync } = require('child_process');

class FluentGenPlugin {
  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync(
      'FluentGenPlugin',
      (params, callback) => {
        execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
        callback();
      },
    );
  }
}

module.exports = {
  plugins: [new FluentGenPlugin()],
};
```

### esbuild

```javascript
// build.js
const { execSync } = require('child_process');
const esbuild = require('esbuild');

// Generate builders first
execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });

// Then build
esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
});
```

## Framework Integration

### Next.js

```json
// package.json
{
  "scripts": {
    "dev": "npm run generate && next dev",
    "build": "npm run generate && next build",
    "generate": "fluent-gen-ts batch"
  }
}
```

### NestJS

```json
// package.json
{
  "scripts": {
    "prebuild": "npm run generate",
    "build": "nest build",
    "generate": "fluent-gen-ts batch",
    "start:dev": "npm run generate && nest start --watch"
  }
}
```

### Express

```json
// nodemon.json
{
  "watch": ["src"],
  "ext": "ts",
  "ignore": ["src/builders"],
  "exec": "npm run generate && ts-node src/index.ts"
}
```

## Monorepo Workflows

### Turborepo

```json
// turbo.json
{
  "pipeline": {
    "generate": {
      "cache": false,
      "outputs": ["src/builders/**"]
    },
    "build": {
      "dependsOn": ["generate"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["generate"]
    }
  }
}
```

```json
// package.json (workspace)
{
  "scripts": {
    "generate": "fluent-gen-ts batch"
  }
}
```

### Nx

```json
// project.json
{
  "targets": {
    "generate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "fluent-gen-ts batch"
      }
    },
    "build": {
      "dependsOn": ["generate"]
    }
  }
}
```

### pnpm Workspaces

```json
// package.json (root)
{
  "scripts": {
    "generate": "pnpm -r run generate",
    "build": "pnpm -r run build"
  }
}
```

## Docker Integration

### Multi-stage Build

```dockerfile
# Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate builders
RUN npx fluent-gen-ts batch

# Build application
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "dist/index.js"]
```

### Development with Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev
```

```dockerfile
# Dockerfile.dev
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
CMD ["sh", "-c", "npm run generate && npm run dev"]
```

## Editor Integration

### VS Code Tasks

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Generate Builders",
      "type": "npm",
      "script": "generate",
      "problemMatcher": []
    }
  ]
}
```

**Usage:** `Cmd+Shift+P` → "Run Task" → "Generate Builders"

## Best Practices

### ✅ Do

- **Commit generated files** for better IDE support and faster CI
- **Generate before build/test** in all environments
- **Use watch mode** during active development
- **Validate in CI** that builders are up-to-date
- **Document the workflow** in your team's README

### ❌ Don't

- **Manually edit** generated files (changes will be overwritten)
- **Skip generation** in CI (causes runtime errors)
- **Commit broken builders** (always test after generating)
- **Mix manual and generated** code in builder files

## Troubleshooting

### Builders Out of Sync

**Problem:** CI fails with "builders out of sync"

**Solution:**

```bash
# Regenerate locally
npm run generate

# Check what changed
git diff src/builders

# Commit updates
git add src/builders
git commit -m "Update builders"
```

### Slow Watch Mode

**Problem:** Generation is slow during development

**Solution:** Add debouncing

```json
{
  "scripts": {
    "watch:types": "chokidar 'src/types/**/*.ts' --debounce=1000 -c 'npm run generate'"
  }
}
```

### Build Fails After Type Change

**Problem:** Build errors after modifying types

**Solution:** Always regenerate after type changes

```bash
npm run generate && npm run build
```

## Related Resources

- [Configuration](/guide/configuration) - All configuration options
- [CLI Reference](/guide/cli-reference) - Command-line usage
- [Config Recipes](/guide/config-recipes) - Copy-paste configurations
- [Troubleshooting](/guide/troubleshooting) - Common issues and solutions
