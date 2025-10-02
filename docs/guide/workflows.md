# Workflows & Integration

:::tip Real-World Patterns How to integrate fluent-gen-ts into your development
workflow, CI/CD, and toolchain. :::

## Development Workflows

### Basic Development Flow

The simplest workflow for day-to-day development.

**Setup:**

```json
// package.json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "dev": "npm run generate && npm run start:dev",
    "build": "npm run generate && tsc && node dist/index.js"
  }
}
```

**Daily Usage:**

```bash
# 1. Modify types
vim src/types/user.ts

# 2. Regenerate builders
npm run generate

# 3. Use in code
# Builders are ready in src/builders/
```

### Watch Mode Development

Auto-regenerate on type changes.

**Install dependencies:**

```bash
npm install -D chokidar-cli concurrently
```

**package.json:**

```json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "watch:types": "chokidar 'src/types/**/*.ts' -c 'npm run generate'",
    "watch:server": "nodemon src/index.ts",
    "dev": "concurrently \"npm:watch:types\" \"npm:watch:server\""
  }
}
```

**Usage:**

```bash
npm run dev
```

Now builders regenerate automatically whenever you change types!

### Git Integration

#### Option 1: Commit Generated Files (Recommended)

**Benefits:**

- Better IDE support
- Faster CI builds
- No generation needed for contributors

**Setup:**

```bash
# Generate builders
npm run generate

# Commit everything
git add src/builders/
git commit -m "feat: add user builder"
```

**.gitignore:**

```txt
# Don't ignore generated files
# !src/builders/
```

**package.json:**

```json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "precommit": "npm run generate"
  }
}
```

#### Option 2: Regenerate on Demand

**Benefits:**

- Smaller repository
- No generated file conflicts

**Setup:**

```bash
# .gitignore
src/builders/
```

**package.json:**

```json
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

Ensure builders are generated before committing.

**Install Husky:**

```bash
npm install -D husky lint-staged
npx husky init
```

**.husky/pre-commit:**

```bash
#!/bin/sh
npx lint-staged
```

**package.json:**

```json
{
  "lint-staged": {
    "src/types/**/*.ts": ["npm run generate", "git add src/builders"]
  }
}
```

**Usage:**

```bash
# Edit types
vim src/types/user.ts

# Commit (automatically generates builders)
git add src/types/user.ts
git commit -m "Update user types"
# Builders generated and added automatically!
```

## CI/CD Integration

### GitHub Actions

Complete CI/CD pipeline with builder generation.

**.github/workflows/ci.yml:**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate builders
        run: npx fluent-gen-ts batch

      - name: Check for uncommitted changes
        run: |
          git diff --exit-code src/builders || \
          (echo "❌ Builders are out of sync! Run 'npm run generate' locally." && exit 1)

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

### GitLab CI

**.gitlab-ci.yml:**

```yaml
stages:
  - generate
  - test
  - build
  - deploy

variables:
  NODE_VERSION: '18'

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .npm/

before_script:
  - npm ci --cache .npm --prefer-offline

generate:builders:
  stage: generate
  script:
    - npx fluent-gen-ts batch
    - git diff --exit-code src/builders || (echo "Builders out of sync!" && exit
      1)
  artifacts:
    paths:
      - src/builders/
    expire_in: 1 hour

test:
  stage: test
  needs: [generate:builders]
  script:
    - npm test
    - npx tsc --noEmit

build:
  stage: build
  needs: [generate:builders]
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

deploy:production:
  stage: deploy
  needs: [build]
  only:
    - main
  script:
    - npm run deploy
```

### CircleCI

**.circleci/config.yml:**

```yaml
version: 2.1

orbs:
  node: circleci/node@5.0

jobs:
  build-and-test:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - node/install-packages

      - run:
          name: Generate builders
          command: npx fluent-gen-ts batch

      - run:
          name: Check builders are up to date
          command: |
            git diff --exit-code src/builders || \
            (echo "Builders out of sync!" && exit 1)

      - run:
          name: Type check
          command: npx tsc --noEmit

      - run:
          name: Run tests
          command: npm test

      - run:
          name: Build
          command: npm run build

      - store_artifacts:
          path: dist/

workflows:
  build-test-deploy:
    jobs:
      - build-and-test
```

### Jenkins

**Jenkinsfile:**

```groovy
pipeline {
    agent {
        docker {
            image 'node:18'
        }
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Generate Builders') {
            steps {
                sh 'npx fluent-gen-ts batch'
                sh 'git diff --exit-code src/builders || (echo "Builders out of sync!" && exit 1)'
            }
        }

        stage('Type Check') {
            steps {
                sh 'npx tsc --noEmit'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Archive') {
            steps {
                archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
            }
        }
    }
}
```

## Testing Integration

### Vitest

**vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

**vitest.setup.ts:**

```typescript
import { execSync } from 'child_process';

// Generate builders before tests
beforeAll(() => {
  console.log('Generating builders...');
  execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
});
```

**package.json:**

```json
{
  "scripts": {
    "test": "npm run generate && vitest run",
    "test:watch": "vitest watch"
  }
}
```

### Jest

**jest.config.js:**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: './jest.global-setup.js',
};
```

**jest.global-setup.js:**

```javascript
const { execSync } = require('child_process');

module.exports = async () => {
  console.log('Generating builders for tests...');
  execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
};
```

### Playwright E2E Tests

**tests/fixtures/builders.ts:**

```typescript
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

**tests/e2e/checkout.spec.ts:**

```typescript
import { test, expect } from '@playwright/test';
import { testUser, testProduct } from '../fixtures/builders';

test('user can checkout', async ({ page }) => {
  const user = testUser();
  const product = testProduct();

  // Setup test data
  await setupUser(user);
  await setupProduct(product);

  // Run test
  await page.goto('/checkout');
  // ... test logic
});
```

## Build Tool Integration

### Vite

**vite.config.ts:**

```typescript
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

export default defineConfig({
  plugins: [
    {
      name: 'fluent-gen',
      buildStart() {
        console.log('Generating builders...');
        execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
      },
    },
  ],
});
```

### Webpack

**webpack.config.js:**

```javascript
const { execSync } = require('child_process');

class FluentGenPlugin {
  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync(
      'FluentGenPlugin',
      (params, callback) => {
        console.log('Generating builders...');
        execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
        callback();
      },
    );
  }
}

module.exports = {
  // ... other config
  plugins: [new FluentGenPlugin()],
};
```

### esbuild

**build.js:**

```javascript
const { execSync } = require('child_process');
const esbuild = require('esbuild');

// Generate builders first
console.log('Generating builders...');
execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });

// Then build
esbuild
  .build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: 'dist/bundle.js',
  })
  .catch(() => process.exit(1));
```

**package.json:**

```json
{
  "scripts": {
    "build": "node build.js"
  }
}
```

### Rollup

**rollup.config.js:**

```javascript
import { execSync } from 'child_process';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'es',
  },
  plugins: [
    {
      name: 'fluent-gen',
      buildStart() {
        console.log('Generating builders...');
        execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
      },
    },
  ],
};
```

## Framework-Specific Workflows

### Next.js

**package.json:**

```json
{
  "scripts": {
    "dev": "npm run generate && next dev",
    "build": "npm run generate && next build",
    "generate": "fluent-gen-ts batch"
  }
}
```

**next.config.js:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      const { execSync } = require('child_process');
      execSync('npx fluent-gen-ts batch', { stdio: 'inherit' });
    }
    return config;
  },
};

module.exports = nextConfig;
```

### NestJS

**package.json:**

```json
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

**nodemon.json:**

```json
{
  "watch": ["src"],
  "ext": "ts",
  "ignore": ["src/builders"],
  "exec": "npm run generate && ts-node src/index.ts"
}
```

**package.json:**

```json
{
  "scripts": {
    "dev": "nodemon",
    "generate": "fluent-gen-ts batch"
  }
}
```

## Monorepo Workflows

### Turborepo

**turbo.json:**

```json
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

**package.json (root):**

```json
{
  "scripts": {
    "generate": "turbo run generate",
    "build": "turbo run build",
    "test": "turbo run test"
  }
}
```

**package.json (workspace):**

```json
{
  "scripts": {
    "generate": "fluent-gen-ts batch"
  }
}
```

### Nx

**project.json:**

```json
{
  "targets": {
    "generate": {
      "executor": "nx:run-commands",
      "options": {
        "command": "fluent-gen-ts batch",
        "cwd": "libs/data-models"
      }
    },
    "build": {
      "dependsOn": ["generate"],
      "executor": "@nrwl/js:tsc",
      "outputs": ["{options.outputPath}"]
    }
  }
}
```

### Lerna

**lerna.json:**

```json
{
  "version": "independent",
  "npmClient": "npm",
  "command": {
    "run": {
      "stream": true
    }
  }
}
```

**package.json (root):**

```json
{
  "scripts": {
    "generate": "lerna run generate",
    "build": "lerna run build",
    "test": "lerna run test"
  }
}
```

## Docker Integration

### Multi-stage Build

**Dockerfile:**

```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate builders
RUN npx fluent-gen-ts batch

# Build application
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

CMD ["node", "dist/index.js"]
```

### Development Docker

**docker-compose.yml:**

```yaml
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
    ports:
      - '3000:3000'
```

**Dockerfile.dev:**

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Generate builders on start
CMD ["sh", "-c", "npm run generate && npm run dev"]
```

## Editor Integration

### VS Code Tasks

**.vscode/tasks.json:**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Generate Builders",
      "type": "npm",
      "script": "generate",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Watch Types & Generate",
      "type": "shell",
      "command": "npm run watch:types",
      "isBackground": true,
      "problemMatcher": []
    }
  ]
}
```

**Usage:** `Cmd+Shift+P` → "Run Task" → "Generate Builders"

### VS Code Launch Config

**.vscode/launch.json:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug App (Generate First)",
      "type": "node",
      "request": "launch",
      "preLaunchTask": "Generate Builders",
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

## Best Practices

### ✅ Do

- **Commit generated files** for better IDE support
- **Generate before build** in CI/CD
- **Use watch mode** during development
- **Validate in CI** that builders are up-to-date
- **Document the workflow** for team members

### ❌ Don't

- **Manually edit** generated files (they'll be overwritten)
- **Skip generation** in CI (causes runtime errors)
- **Commit broken builders** (run generation first)
- **Mix manual and generated** builders (confusing)

## Troubleshooting Workflows

### Builders Out of Sync

**Problem:** CI fails with "builders out of sync"

**Solution:**

```bash
# Locally regenerate
npm run generate

# Check what changed
git diff src/builders

# Commit if intentional
git add src/builders
git commit -m "Update builders"
```

### Slow Generation in Watch Mode

**Problem:** Watch mode is slow

**Solution:**

```javascript
// Use debouncing
{
  "scripts": {
    "watch:types": "chokidar 'src/types/**/*.ts' --debounce=1000 -c 'npm run generate'"
  }
}
```

### Build Fails After Type Change

**Problem:** Build fails after modifying types

**Solution:**

```bash
# Always regenerate after type changes
npm run generate && npm run build
```

## Next Steps

<div class="next-steps">

### 📖 Configuration

Learn all options: **[Configuration →](/guide/configuration)**

### 🔧 CLI Cheat Sheet

Quick command reference: **[CLI Cheat Sheet →](/guide/cli-cheat-sheet)**

### 📚 Config Recipes

Copy-paste configs: **[Config Recipes →](/guide/config-recipes)**

### ❓ Troubleshooting

Common issues: **[Troubleshooting →](/guide/troubleshooting)**

</div>

<style scoped>
.next-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
</style>
