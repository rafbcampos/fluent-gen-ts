# Configuration Recipes

:::tip Copy-Paste Configs Real-world configuration examples for common
scenarios. Copy, customize, and use. :::

## Quick Index

**Jump to:**

- [Simple Projects](#simple-projects)
- [Monorepos](#monorepos)
- [Testing & CI/CD](#testing-cicd)
- [Multi-Environment](#multi-environment)
- [Framework Integration](#framework-integration)
- [Advanced Patterns](#advanced-patterns)

## Simple Projects {#simple-projects}

### Minimal Setup

Perfect for small projects or getting started.

```javascript
// fluentgen.config.js
export default {
  targets: [{ file: './src/types.ts', types: ['User', 'Product'] }],
  output: {
    dir: './src/builders',
  },
};
```

**Use when:**

- Small project (<10 types)
- All types in one file
- Quick prototyping

### Standard Project

Organized structure for growing projects.

```javascript
// fluentgen.config.js
export default {
  targets: [
    { file: './src/types/user.ts', types: ['User', 'Profile', 'Settings'] },
    { file: './src/types/product.ts', types: ['Product', 'Category'] },
    { file: './src/types/order.ts', types: ['Order', 'OrderItem'] },
  ],

  output: {
    dir: './src/__generated__/builders',
    mode: 'single', // One file per builder
  },

  generator: {
    useDefaults: true,
    addComments: true,
    maxDepth: 10,
  },
};
```

**Use when:**

- Types organized by domain
- Medium-sized project (10-50 types)
- Want generated files isolated

### All Types from Directory

Scan entire directory for types.

```javascript
// fluentgen.config.js
export default {
  targets: [{ file: './src/models/**/*.ts', types: ['*'] }],

  output: {
    dir: './src/builders',
    mode: 'single',
  },

  generator: {
    maxDepth: 8, // Limit for performance
  },
};
```

**Use when:**

- Consistent naming (all files have builder-worthy types)
- Want to generate for all models
- Easy to regenerate after schema changes

:::warning Performance Using `types: ['*']` with globs can be slow for large
codebases. Consider specific types instead. :::

## Monorepos {#monorepos}

### pnpm Workspaces

Configuration for pnpm monorepos.

```javascript
// packages/api/fluentgen.config.js
export default {
  targets: [{ file: './src/models/*.ts', types: ['*'] }],

  output: {
    dir: './src/builders',
    mode: 'single',
  },

  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto', // Auto-detects pnpm
  },

  plugins: [
    '@company/fluent-gen-validation', // Shared from workspace
  ],

  tsConfigPath: '../../tsconfig.base.json', // Workspace shared config
};
```

**Project structure:**

```
my-monorepo/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── packages/
    ├── api/
    │   ├── fluentgen.config.js  ← This config
    │   └── src/
    │       ├── models/
    │       └── builders/  ← Generated here
    └── shared/
```

### Yarn Workspaces

Configuration for Yarn monorepos.

```javascript
// packages/core/fluentgen.config.js
export default {
  targets: [{ file: './src/types/*.ts', types: ['*'] }],

  output: {
    dir: './src/builders',
  },

  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'hoisted', // Yarn hoists deps
  },

  tsConfigPath: './tsconfig.json',
};
```

### Nx Monorepo

Configuration for Nx monorepos.

```javascript
// libs/shared/data-models/fluentgen.config.js
export default {
  targets: [{ file: './src/lib/models/*.ts', types: ['*'] }],

  output: {
    dir: './src/lib/builders',
    mode: 'single',
  },

  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto',
    workspaceRoot: '../../../', // Point to nx workspace root
  },

  tsConfigPath: './tsconfig.lib.json', // Nx lib config
};
```

### Shared Plugin Across Packages

Share plugins across monorepo packages.

```javascript
// packages/api/fluentgen.config.js
export default {
  targets: [{ file: './src/models/*.ts', types: ['*'] }],

  output: {
    dir: './src/builders',
  },

  plugins: [
    '@workspace/fluent-plugins/validation', // Shared plugin package
    '@workspace/fluent-plugins/timestamps',
    './local-plugin.ts', // Package-specific
  ],

  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto',
  },
};
```

**Shared plugin package:**

```
packages/
└── fluent-plugins/
    ├── package.json  → { "name": "@workspace/fluent-plugins" }
    ├── validation.ts
    └── timestamps.ts
```

## Testing & CI/CD {#testing-cicd}

### Test Data Builders

Optimized for test data generation.

```javascript
// fluentgen.config.js
export default {
  targets: [{ file: './src/types/**/*.ts', types: ['*'] }],

  output: {
    dir: './src/__tests__/builders',
    mode: 'batch', // All in one file for easy imports
  },

  generator: {
    useDefaults: true, // Smart defaults for tests
    addComments: false, // Smaller files
    maxDepth: 5, // Faster generation
  },

  plugins: [
    './test-plugins/fake-data.ts', // Add faker integration
    './test-plugins/factories.ts', // Add factory methods
  ],
};
```

**package.json:**

```json
{
  "scripts": {
    "generate:test-builders": "fluent-gen-ts batch",
    "pretest": "npm run generate:test-builders"
  }
}
```

### CI/CD Integration

Configuration for continuous integration.

```javascript
// fluentgen.config.js
export default {
  targets: [{ file: './src/models/*.ts', types: ['*'] }],

  output: {
    dir: './src/builders',
    mode: 'single',
  },

  generator: {
    useDefaults: true,
    addComments: process.env.CI !== 'true', // Skip comments in CI
    maxDepth: 10,
  },
};
```

**.github/workflows/ci.yml:**

```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx fluent-gen-ts batch # Generate builders
      - run: npm test
      - run: npm run build
```

### Pre-commit Hook

Generate on code changes.

**package.json:**

```json
{
  "scripts": {
    "generate": "fluent-gen-ts batch"
  },
  "lint-staged": {
    "src/types/**/*.ts": ["npm run generate", "git add src/builders"]
  }
}
```

**.husky/pre-commit:**

```bash
#!/bin/sh
npx lint-staged
```

## Multi-Environment {#multi-environment}

### Development vs Production

Different configs for different environments.

**fluentgen.dev.js:**

```javascript
export default {
  targets: [
    { file: './src/types/**/*.ts', types: ['*'] }, // All types
  ],

  output: {
    dir: './src/builders',
    mode: 'single',
  },

  generator: {
    useDefaults: true,
    addComments: true, // Full comments
    maxDepth: 15, // Deep nesting OK
  },

  plugins: [
    './plugins/validation.ts',
    './plugins/logging.ts', // Dev logging
  ],
};
```

**fluentgen.prod.js:**

```javascript
export default {
  targets: [
    // Only production types
    { file: './src/types/user.ts', types: ['User', 'Profile'] },
    { file: './src/types/product.ts', types: ['Product'] },
  ],

  output: {
    dir: './src/builders',
    mode: 'batch', // Smaller bundle
  },

  generator: {
    useDefaults: true,
    addComments: false, // Minimize size
    maxDepth: 8, // Faster generation
  },

  plugins: [
    './plugins/validation.ts', // Only essential plugins
  ],
};
```

**package.json:**

```json
{
  "scripts": {
    "generate:dev": "fluent-gen-ts batch --config fluentgen.dev.js",
    "generate:prod": "fluent-gen-ts batch --config fluentgen.prod.js"
  }
}
```

### Multiple Output Directories

Generate to different locations for different purposes.

```javascript
// Combined config
export default {
  targets: [{ file: './src/types/api.ts', types: ['*'] }],

  output: {
    dir: process.env.OUTPUT_DIR || './src/builders',
  },
};
```

**package.json:**

```json
{
  "scripts": {
    "generate:src": "OUTPUT_DIR=./src/builders fluent-gen-ts batch",
    "generate:test": "OUTPUT_DIR=./test/fixtures fluent-gen-ts batch"
  }
}
```

## Framework Integration {#framework-integration}

### Next.js Project

Configuration for Next.js applications.

```javascript
// fluentgen.config.js
export default {
  targets: [
    { file: './types/api.ts', types: ['*'] },
    { file: './types/models.ts', types: ['*'] },
  ],

  output: {
    dir: './lib/builders', // Next.js lib directory
    mode: 'single',
  },

  generator: {
    useDefaults: true,
    addComments: true,
  },

  plugins: ['./plugins/api-validation.ts'],

  tsConfigPath: './tsconfig.json',
};
```

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

### NestJS Project

Configuration for NestJS backend.

```javascript
// fluentgen.config.js
export default {
  targets: [
    { file: './src/entities/*.entity.ts', types: ['*'] },
    { file: './src/dto/*.dto.ts', types: ['*'] },
  ],

  output: {
    dir: './src/__generated__/builders',
    mode: 'single',
  },

  naming: {
    convention: 'kebab-case',
    suffix: 'builder',
  },

  plugins: [
    './plugins/class-validator.ts', // Integrate with class-validator
  ],

  tsConfigPath: './tsconfig.build.json',
};
```

### React + TypeScript

Configuration for React applications.

```javascript
// fluentgen.config.js
export default {
  targets: [
    { file: './src/types/state.ts', types: ['*'] },
    { file: './src/types/api.ts', types: ['*'] },
  ],

  output: {
    dir: './src/utils/builders',
    mode: 'batch', // Easy imports in components
  },

  plugins: [
    './plugins/react-state.ts', // Add React-specific helpers
  ],
};
```

### Express + Prisma

Configuration for Express with Prisma.

```javascript
// fluentgen.config.js
export default {
  targets: [
    {
      file: './prisma/generated/client/index.d.ts',
      types: ['User', 'Post', 'Comment'],
    },
  ],

  output: {
    dir: './src/test-utils/builders',
    mode: 'single',
  },

  generator: {
    useDefaults: true,
    maxDepth: 5, // Prisma types can be deep
  },

  plugins: ['./plugins/prisma-integration.ts'],
};
```

## Advanced Patterns {#advanced-patterns}

### Dynamic Configuration

Load config based on environment.

```javascript
// fluentgen.config.js
const isDev = process.env.NODE_ENV !== 'production';
const isCi = process.env.CI === 'true';

export default {
  targets: isDev
    ? [{ file: './src/types/**/*.ts', types: ['*'] }] // All in dev
    : [{ file: './src/types/core.ts', types: ['User', 'Product'] }], // Limited in prod

  output: {
    dir: './src/builders',
    mode: isDev ? 'single' : 'batch',
  },

  generator: {
    useDefaults: true,
    addComments: !isCi, // Skip comments in CI
    maxDepth: isDev ? 15 : 8,
  },

  plugins: [
    './plugins/validation.ts',
    ...(isDev ? ['./plugins/logging.ts', './plugins/debug.ts'] : []),
  ],
};
```

### Multi-Package Generation

Generate for multiple independent packages.

```javascript
// scripts/generate-all.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const packages = ['packages/api', 'packages/web', 'packages/mobile'];

for (const pkg of packages) {
  console.log(`Generating builders for ${pkg}...`);
  await execAsync(`cd ${pkg} && npx fluent-gen-ts batch`);
}
```

**package.json:**

```json
{
  "scripts": {
    "generate:all": "node scripts/generate-all.js"
  }
}
```

### Conditional Plugins

Load plugins based on environment or feature flags.

```javascript
// fluentgen.config.js
const enableValidation = process.env.ENABLE_VALIDATION !== 'false';
const enableTesting = process.env.NODE_ENV === 'test';

export default {
  targets: [{ file: './src/types/*.ts', types: ['*'] }],

  output: {
    dir: './src/builders',
  },

  plugins: [
    // Always loaded
    './plugins/core.ts',

    // Conditional
    ...(enableValidation ? ['./plugins/validation.ts'] : []),
    ...(enableTesting
      ? ['./plugins/fake-data.ts', './plugins/factories.ts']
      : []),
  ],
};
```

### Watch Mode Integration

Auto-regenerate on file changes.

**package.json:**

```json
{
  "scripts": {
    "dev": "concurrently \"npm:watch:types\" \"npm:dev:server\"",
    "watch:types": "chokidar 'src/types/**/*.ts' -c 'npm run generate'",
    "generate": "fluent-gen-ts batch",
    "dev:server": "nodemon src/index.ts"
  },
  "devDependencies": {
    "chokidar-cli": "^3.0.0",
    "concurrently": "^8.0.0"
  }
}
```

### Type-Safe Config with TypeScript

Use TypeScript for config with full type checking.

```typescript
// fluentgen.config.ts
import type { Config } from 'fluent-gen-ts';

const config: Config = {
  targets: [
    { file: './src/types/user.ts', types: ['User', 'Profile'] },
    { file: './src/types/product.ts', types: ['Product'] },
  ],

  output: {
    dir: './src/builders',
    mode: 'single',
  },

  generator: {
    useDefaults: true,
    addComments: true,
    maxDepth: 10,
  },

  plugins: ['./plugins/validation.ts'],
};

export default config;
```

**tsconfig.json:**

```json
{
  "ts-node": {
    "compilerOptions": {
      "module": "CommonJS"
    }
  }
}
```

## Tips & Tricks

### Tip 1: Use TypeScript for Config

Get autocomplete and type checking:

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  // Autocomplete works here!
};
```

### Tip 2: Share Config Across Projects

Create a base config and extend it:

```javascript
// base.config.js
export const baseConfig = {
  generator: {
    useDefaults: true,
    addComments: true,
    maxDepth: 10,
  },
  plugins: ['@company/core-plugins'],
};

// fluentgen.config.js
import { baseConfig } from './base.config.js';

export default {
  ...baseConfig,
  targets: [{ file: './src/types.ts', types: ['User'] }],
  output: {
    dir: './src/builders',
  },
};
```

### Tip 3: Debug with Dry Run

Preview what will be generated:

```bash
npx fluent-gen-ts batch --dry-run --verbose
```

### Tip 4: Validate Config

Test config without generating:

```javascript
// validate-config.js
import config from './fluentgen.config.js';

console.log('Config valid:', config);
console.log('Targets:', config.targets.length);
console.log('Plugins:', config.plugins?.length || 0);
```

## Next Steps

<div class="next-steps">

### 📖 Config Reference

All options explained: **[Configuration →](/guide/configuration)**

### 🔧 CLI Commands

Learn CLI usage: **[CLI Reference →](/guide/cli-commands)**

### 🔌 Plugin Recipes

Add custom behavior: **[Plugin Cookbook →](/guide/plugins/cookbook)**

### 💡 Workflows

Integration patterns: **[Workflows →](/guide/workflows)**

</div>

<style scoped>
.next-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
</style>
