# Configuration Reference

:::tip Complete Reference Every configuration option explained with examples.
Use this as your single source of truth. :::

## Quick Start

Create `fluentgen.config.js` in your project root:

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  targets: [{ file: './src/types.ts', types: ['User'] }],
  output: {
    dir: './src/builders',
  },
};
```

Run:

```bash
npx fluent-gen-ts batch
```

## Complete Schema

```typescript
interface Config {
  // Required: What to generate
  targets: Target[];

  // Required: Where to output
  output: OutputConfig;

  // Optional: Generator settings
  generator?: GeneratorConfig;

  // Optional: TypeScript config
  tsConfigPath?: string;

  // Optional: Plugins
  plugins?: (string | Plugin)[];

  // Optional: Monorepo support
  monorepo?: MonorepoConfig;

  // Optional: File naming
  naming?: NamingConfig;
}
```

## targets (Required) {#targets}

Specifies which types to generate builders for.

### Schema

```typescript
interface Target {
  file: string; // Path to TypeScript file (glob supported)
  types: string[]; // Type names to generate (or ['*'] for all)
}
```

### Examples

**Single file, single type:**

```javascript
targets: [{ file: './src/types/user.ts', types: ['User'] }];
```

**Single file, multiple types:**

```javascript
targets: [
  { file: './src/types/user.ts', types: ['User', 'Profile', 'Settings'] },
];
```

**Multiple files:**

```javascript
targets: [
  { file: './src/types/user.ts', types: ['User', 'Profile'] },
  { file: './src/types/product.ts', types: ['Product', 'Category'] },
  { file: './src/types/order.ts', types: ['Order', 'OrderItem'] },
];
```

**All types from a file:**

```javascript
targets: [{ file: './src/types/models.ts', types: ['*'] }];
```

**Glob patterns:**

```javascript
targets: [{ file: './src/models/**/*.ts', types: ['*'] }];
```

:::warning Glob Performance Using globs with `types: ['*']` can be slow. Prefer
specific files and types for faster generation. :::

## output (Required) {#output}

Controls where and how builders are generated.

### Schema

```typescript
interface OutputConfig {
  dir: string; // Output directory
  mode?: 'single' | 'batch'; // Generation mode (default: 'single')
  fileName?: string; // Custom file name pattern
}
```

### mode: 'single' vs 'batch'

**single (default)** - One builder per file:

```
src/builders/
  ├── user.builder.ts        // UserBuilder
  ├── product.builder.ts     // ProductBuilder
  ├── order.builder.ts       // OrderBuilder
  └── common.ts              // Shared utilities
```

**batch** - All builders in one file:

```
src/builders/
  ├── index.ts               // All builders exported
  └── common.ts              // Shared utilities
```

### When to Use Each Mode

| Use Case                  | Recommended Mode | Reason                             |
| ------------------------- | ---------------- | ---------------------------------- |
| Small project (<10 types) | `batch`          | Simpler imports                    |
| Large project (>10 types) | `single`         | Better organization, smaller files |
| Tree-shaking important    | `single`         | Better dead code elimination       |
| Simple imports preferred  | `batch`          | One import for all builders        |
| Monorepo                  | `single`         | Easier to manage per-package       |

### Examples

**Single mode (recommended):**

```javascript
output: {
  dir: './src/builders',
  mode: 'single'
}
```

**Batch mode:**

```javascript
output: {
  dir: './src/builders',
  mode: 'batch'
}
```

**Custom directory:**

```javascript
output: {
  dir: './src/__generated__/builders';
}
```

## generator (Optional) {#generator}

Fine-tune builder generation behavior.

### Schema

```typescript
interface GeneratorConfig {
  useDefaults?: boolean; // Generate smart defaults (default: true)
  addComments?: boolean; // Add JSDoc comments (default: true)
  maxDepth?: number; // Max recursion depth 1-100 (default: 10)
  contextType?: string; // Custom context type name
}
```

### useDefaults

Generate default values for required properties.

**true (default):**

```typescript
// Generated builder includes:
static defaults = {
  id: '',
  name: '',
  age: 0,
  isActive: false
};
```

**false:**

```typescript
// No defaults generated
// User must provide all values
```

**When to disable:**

- You want explicit value setting
- Default values don't make sense for your domain
- Performance-critical (minimal builder size)

### addComments

Add JSDoc comments to generated methods.

**true (default):**

```typescript
/**
 * Set the email property
 * @param value - The email value
 */
withEmail(value: string): this {
  return this.set('email', value);
}
```

**false:**

```typescript
withEmail(value: string): this {
  return this.set('email', value);
}
```

**When to disable:**

- Minimize file size
- Comments add no value (self-documenting types)

### maxDepth

Limit nested type resolution depth.

**Default: 10**

```typescript
interface A {
  b: B;
}
interface B {
  c: C;
}
interface C {
  d: D;
}
// ... depth 10
```

**Lower for performance:**

```javascript
generator: {
  maxDepth: 5; // Stop at depth 5
}
```

**Higher for complex types:**

```javascript
generator: {
  maxDepth: 20; // Rare, only if needed
}
```

:::warning Performance Higher maxDepth = slower generation and larger files.
Only increase if you have deeply nested types. :::

### contextType

Use custom context type for builders.

```javascript
generator: {
  contextType: 'MyCustomContext';
}
```

Generated builders will use:

```typescript
build(context?: MyCustomContext): T {
  // ...
}
```

See [Custom Context](/guide/advanced-usage#custom-nested-context-generation) for
details.

### Examples

**Minimal configuration:**

```javascript
generator: {
  useDefaults: false,
  addComments: false,
  maxDepth: 5
}
```

**Maximum documentation:**

```javascript
generator: {
  useDefaults: true,
  addComments: true,
  maxDepth: 15
}
```

**Custom context:**

```javascript
generator: {
  contextType: 'TenantBuildContext';
}
```

## tsConfigPath (Optional) {#tsconfig}

Path to `tsconfig.json` for TypeScript compilation.

### Default Behavior

fluent-gen-ts auto-detects `tsconfig.json` in:

1. Project root
2. Current directory
3. Parent directories (walks up)

### When to Specify

**Custom tsconfig location:**

```javascript
tsConfigPath: './config/tsconfig.build.json';
```

**Different tsconfig for generation:**

```javascript
tsConfigPath: './tsconfig.codegen.json';
```

**Monorepo with multiple tsconfigs:**

```javascript
// packages/api/fluentgen.config.js
tsConfigPath: '../../tsconfig.base.json';
```

### Examples

```javascript
// Use build config
tsConfigPath: './tsconfig.build.json';

// Use specific config
tsConfigPath: './tsconfig.codegen.json';

// Monorepo shared config
tsConfigPath: '../../tsconfig.json';
```

## plugins (Optional) {#plugins}

Add plugins to customize generation.

### Schema

```typescript
type PluginConfig = (string | Plugin)[];
```

### File Paths (Recommended)

```javascript
plugins: [
  './plugins/validation.ts',
  './plugins/testing.ts',
  './plugins/database.ts',
];
```

Paths are relative to config file location.

### Plugin Objects

```javascript
import validationPlugin from './plugins/validation.ts';

export default {
  plugins: [
    validationPlugin, // Direct plugin object
    './plugins/testing.ts', // Or file path
  ],
};
```

### npm Packages

```javascript
plugins: [
  '@company/fluent-gen-validation', // From node_modules
  './plugins/custom.ts', // Local plugin
];
```

### Execution Order

Plugins execute in array order:

```javascript
plugins: [
  './plugins/type-transform.ts', // 1st
  './plugins/validation.ts', // 2nd
  './plugins/custom-methods.ts', // 3rd
];
```

:::warning Order Matters Plugin order affects transformations. Specific plugins
before generic ones! :::

### Examples

**Single plugin:**

```javascript
plugins: ['./plugins/validation.ts'];
```

**Multiple plugins:**

```javascript
plugins: [
  './plugins/validation.ts',
  './plugins/timestamps.ts',
  './plugins/uuid.ts',
];
```

**Mix of sources:**

```javascript
plugins: [
  '@company/fluent-gen-core', // npm package
  './plugins/validation.ts', // local file
  './plugins/domain-specific.ts', // local file
];
```

See [Plugin Guide](/guide/plugins/) for creating plugins.

## monorepo (Optional) {#monorepo}

Configure monorepo support for dependency resolution.

### Schema

```typescript
interface MonorepoConfig {
  enabled: boolean;
  dependencyResolutionStrategy?:
    | 'auto'
    | 'workspace-root'
    | 'hoisted'
    | 'local-only';
  workspaceRoot?: string;
  customPaths?: string[];
}
```

### enabled

Enable monorepo dependency resolution.

```javascript
monorepo: {
  enabled: true;
}
```

### dependencyResolutionStrategy

How to resolve dependencies across packages.

**'auto' (Recommended):** Tries multiple strategies automatically:

```javascript
monorepo: {
  enabled: true,
  dependencyResolutionStrategy: 'auto'
}
```

Tries in order:

1. Local `node_modules`
2. Hoisted dependencies
3. Package manager store (pnpm `.pnpm`)
4. Workspace root

**'workspace-root':** Look in workspace root first:

```javascript
monorepo: {
  enabled: true,
  dependencyResolutionStrategy: 'workspace-root',
  workspaceRoot: '../../'  // Relative to config
}
```

**'hoisted':** Walk up directory tree (good for Yarn):

```javascript
monorepo: {
  enabled: true,
  dependencyResolutionStrategy: 'hoisted'
}
```

**'local-only':** Only check local `node_modules`:

```javascript
monorepo: {
  enabled: true,
  dependencyResolutionStrategy: 'local-only'
}
```

### customPaths

Additional paths to search for dependencies:

```javascript
monorepo: {
  enabled: true,
  customPaths: [
    './shared-dependencies',
    '../common/node_modules',
    '../../packages/*/node_modules'
  ]
}
```

### Examples

**pnpm workspaces (recommended):**

```javascript
monorepo: {
  enabled: true,
  dependencyResolutionStrategy: 'auto'
}
```

**Yarn workspaces:**

```javascript
monorepo: {
  enabled: true,
  dependencyResolutionStrategy: 'hoisted'
}
```

**Custom setup:**

```javascript
monorepo: {
  enabled: true,
  dependencyResolutionStrategy: 'workspace-root',
  workspaceRoot: '../../',
  customPaths: ['./shared']
}
```

See [Monorepo Guide](/guide/advanced-usage#monorepo-configuration) for details.

## naming (Optional) {#naming}

Customize output file naming.

### Schema

```typescript
interface NamingConfig {
  convention?: 'camelCase' | 'kebab-case' | 'snake_case' | 'PascalCase';
  suffix?: string;
  transform?: string; // JavaScript function as string
}
```

### convention

Predefined naming styles.

**'camelCase':**

```javascript
naming: {
  convention: 'camelCase';
}
// UserProfile → userProfile.builder.ts
```

**'kebab-case' (recommended):**

```javascript
naming: {
  convention: 'kebab-case';
}
// UserProfile → user-profile.builder.ts
```

**'snake_case':**

```javascript
naming: {
  convention: 'snake_case';
}
// UserProfile → user_profile.builder.ts
```

**'PascalCase':**

```javascript
naming: {
  convention: 'PascalCase';
}
// UserProfile → UserProfile.builder.ts
```

### suffix

File suffix (default: 'builder'):

```javascript
naming: {
  convention: 'kebab-case',
  suffix: 'factory'
}
// UserProfile → user-profile.factory.ts
```

### transform

Custom JavaScript function for naming:

```javascript
naming: {
  transform: `(typeName) => {
    return typeName
      .replace(/DTO$/, '')
      .toLowerCase() + '.gen';
  }`;
}
// UserDTO → user.gen.ts
```

### Examples

**Standard kebab-case:**

```javascript
naming: {
  convention: 'kebab-case',
  suffix: 'builder'
}
```

**Custom suffix:**

```javascript
naming: {
  convention: 'camelCase',
  suffix: 'factory'
}
// Result: userProfile.factory.ts
```

**Custom transform:**

```javascript
naming: {
  transform: `(typeName) => {
    const base = typeName.replace(/(DTO|Model|Entity)$/, '');
    return base.toLowerCase() + '.generated';
  }`;
}
// UserDTO → user.generated.ts
```

## Complete Examples

### Minimal Config

```javascript
export default {
  targets: [{ file: './src/types.ts', types: ['User'] }],
  output: {
    dir: './src/builders',
  },
};
```

### Production Config

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  targets: [
    { file: './src/types/user.ts', types: ['User', 'Profile'] },
    { file: './src/types/product.ts', types: ['Product'] },
    { file: './src/types/order.ts', types: ['Order', 'OrderItem'] },
  ],

  output: {
    dir: './src/__generated__/builders',
    mode: 'single',
  },

  generator: {
    useDefaults: true,
    addComments: true,
    maxDepth: 10,
  },

  plugins: [
    './plugins/validation.ts',
    './plugins/timestamps.ts',
    './plugins/uuid.ts',
  ],

  tsConfigPath: './tsconfig.json',
};
```

### Monorepo Config

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  targets: [{ file: './src/models/*.ts', types: ['*'] }],

  output: {
    dir: './src/builders',
    mode: 'single',
  },

  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto',
  },

  plugins: [
    '@company/fluent-gen-validation', // Shared plugin
  ],
};
```

### Custom Naming

```javascript
export default {
  targets: [{ file: './src/dtos/*.ts', types: ['*'] }],

  output: {
    dir: './src/factories',
  },

  naming: {
    convention: 'kebab-case',
    suffix: 'factory',
  },
};
```

## TypeScript Types

Enable autocomplete in your config:

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  // TypeScript autocomplete works here!
  targets: [
    /*...*/
  ],
};
```

Or use a `.ts` config file:

```typescript
import type { Config } from 'fluent-gen-ts';

const config: Config = {
  targets: [
    /*...*/
  ],
};

export default config;
```

## Environment Variables

Override config with environment variables:

| Variable            | Description          | Example            |
| ------------------- | -------------------- | ------------------ |
| `FLUENT_GEN_CONFIG` | Config file path     | `custom.config.js` |
| `FLUENT_GEN_OUTPUT` | Output directory     | `./generated`      |
| `FLUENT_GEN_DEBUG`  | Enable debug logging | `true`             |

```bash
FLUENT_GEN_OUTPUT=./dist/builders npx fluent-gen-ts batch
```

## Validation

The config is validated on load. Common errors:

**Missing required fields:**

```
Error: Configuration validation failed:
  - "targets" is required
  - "output.dir" is required
```

**Invalid values:**

```
Error: Configuration validation failed:
  - "generator.maxDepth" must be between 1 and 100
  - "output.mode" must be "single" or "batch"
```

**Invalid types:**

```
Error: Configuration validation failed:
  - "targets" must be an array
  - "plugins" must be an array of strings or plugin objects
```

## Next Steps

<div class="next-steps">

### 📚 Config Recipes

Real-world examples: **[Configuration Recipes →](/guide/config-recipes)**

### 🔧 CLI Commands

Learn CLI usage: **[CLI Reference →](/guide/cli-commands)**

### 🔌 Plugins

Extend generation: **[Plugin System →](/guide/plugins/)**

### 💡 Advanced Usage

Complex scenarios: **[Advanced Guide →](/guide/advanced-usage)**

</div>

## Related Resources

- [CLI Commands](/guide/cli-commands) - Command reference
- [Configuration Recipes](/guide/config-recipes) - Real-world configs
- [Troubleshooting](/guide/troubleshooting) - Common config issues
- [API Reference](/api/reference) - Programmatic API

<style scoped>
.next-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

h2 {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-divider);
}

table code {
  font-size: 0.9em;
}
</style>
