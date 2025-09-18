# Configuration

Fluent Gen offers flexible configuration options through configuration files, CLI arguments, and programmatic APIs. This guide covers all configuration aspects.

## Configuration File

Fluent Gen uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration discovery. It searches for configuration in the following order:

1. `.fluentgenrc.json`
2. `.fluentgenrc.yaml` / `.fluentgenrc.yml`
3. `.fluentgenrc.js` / `.fluentgenrc.cjs`
4. `fluentgen.config.js` / `fluentgen.config.cjs` / `fluentgen.config.mjs`
5. `fluent-gen` property in `package.json`

## Quick Setup

Initialize a configuration file:

```bash
npx fluent-gen init
```

This creates a `.fluentgenrc.json` file with defaults:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": true
  }
}
```

## Configuration Schema

### Complete Configuration Reference

```typescript
interface Config {
  // Path to TypeScript configuration file
  tsConfigPath?: string;

  // Generator options
  generator?: GeneratorConfig;

  // Target files and types to generate
  targets?: Target[];

  // File patterns to scan
  patterns?: string[];

  // Patterns to exclude from scanning
  exclude?: string[];

  // Plugin paths to load
  plugins?: string[];

  // Watch mode options
  watch?: WatchConfig;
}
```

### Generator Configuration

```typescript
interface GeneratorConfig {
  // Output directory for generated builders
  outputDir?: string;

  // Generate default values for properties
  useDefaults?: boolean;

  // Custom context type for builders
  contextType?: string;

  // Custom import path for context type
  importPath?: string;

  // Indentation size (spaces)
  indentSize?: number;

  // Use tabs instead of spaces
  useTab?: boolean;

  // Add JSDoc comments to generated code
  addComments?: boolean;

  // Custom file extension for builders
  fileExtension?: string;

  // Template for builder file names
  fileNameTemplate?: string;

  // Skip type checking on generated code
  skipTypeCheck?: boolean;
}
```

### Target Configuration

```typescript
interface Target {
  // Source file path
  file: string;

  // Type/interface names to generate
  types: string[];

  // Override output directory for this target
  outputDir?: string;

  // Override generator config for this target
  generator?: Partial<GeneratorConfig>;
}
```

### Watch Configuration

```typescript
interface WatchConfig {
  // Enable watch mode
  enabled?: boolean;

  // Debounce delay in milliseconds
  debounce?: number;

  // Clear console on change
  clearConsole?: boolean;

  // Ignore patterns for watching
  ignore?: string[];
}
```

## Configuration Examples

### Basic Configuration

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./generated/builders",
    "useDefaults": true,
    "addComments": true
  }
}
```

### Multiple Targets

```json
{
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true
  },
  "targets": [
    {
      "file": "./src/models/user.ts",
      "types": ["User", "UserProfile", "UserSettings"]
    },
    {
      "file": "./src/models/product.ts",
      "types": ["Product", "ProductVariant"],
      "outputDir": "./src/builders/products"
    }
  ]
}
```

### Pattern-Based Generation

```json
{
  "generator": {
    "outputDir": "./src/builders"
  },
  "patterns": [
    "src/entities/**/*.ts",
    "src/models/**/*.ts"
  ],
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/index.ts"
  ]
}
```

### Custom Context Type

```json
{
  "generator": {
    "outputDir": "./src/builders",
    "contextType": "BuildContext",
    "importPath": "../context",
    "useDefaults": true
  }
}
```

### Watch Mode Configuration

```json
{
  "generator": {
    "outputDir": "./src/builders"
  },
  "watch": {
    "enabled": true,
    "debounce": 500,
    "clearConsole": true,
    "ignore": [
      "**/node_modules/**",
      "**/*.test.ts"
    ]
  },
  "patterns": ["src/**/*.ts"]
}
```

### Plugin Configuration

```json
{
  "generator": {
    "outputDir": "./src/builders"
  },
  "plugins": [
    "./plugins/custom-defaults.js",
    "./plugins/validation.js",
    "@company/fluent-gen-plugin"
  ]
}
```

## JavaScript Configuration

For dynamic configuration, use a JavaScript file:

```javascript
// fluentgen.config.js
module.exports = {
  tsConfigPath: './tsconfig.json',
  generator: {
    outputDir: process.env.NODE_ENV === 'test'
      ? './test/builders'
      : './src/builders',
    useDefaults: true,
    addComments: process.env.NODE_ENV !== 'production'
  },
  targets: [
    {
      file: './src/types.ts',
      types: require('./src/types').exportedTypes
    }
  ],
  plugins: process.env.FLUENT_GEN_PLUGINS?.split(',') || []
};
```

### ESM Configuration

```javascript
// fluentgen.config.mjs
export default {
  tsConfigPath: './tsconfig.json',
  generator: {
    outputDir: './src/builders',
    useDefaults: true
  },
  async targets() {
    // Dynamic target resolution
    const files = await glob('src/**/*.interface.ts');
    return files.map(file => ({
      file,
      types: ['*'] // Generate all exports
    }));
  }
};
```

## Package.json Configuration

```json
{
  "name": "my-project",
  "fluent-gen": {
    "generator": {
      "outputDir": "./src/builders",
      "useDefaults": true
    },
    "targets": [
      {
        "file": "./src/types.ts",
        "types": ["User", "Product"]
      }
    ]
  }
}
```

## Environment Variables

Fluent Gen supports environment variable overrides:

```bash
# Override output directory
FLUENT_GEN_OUTPUT_DIR=./dist/builders npx fluent-gen batch

# Override TypeScript config
FLUENT_GEN_TS_CONFIG=./tsconfig.build.json npx fluent-gen batch

# Enable debug mode
FLUENT_GEN_DEBUG=true npx fluent-gen generate ./src/types.ts User

# Disable comments in CI
FLUENT_GEN_NO_COMMENTS=true npx fluent-gen batch
```

### Supported Environment Variables

- `FLUENT_GEN_OUTPUT_DIR` - Override output directory
- `FLUENT_GEN_TS_CONFIG` - Override TypeScript config path
- `FLUENT_GEN_DEBUG` - Enable debug logging
- `FLUENT_GEN_NO_COMMENTS` - Disable JSDoc comments
- `FLUENT_GEN_NO_DEFAULTS` - Disable default value generation
- `FLUENT_GEN_INDENT_SIZE` - Override indentation size
- `FLUENT_GEN_USE_TABS` - Use tabs instead of spaces
- `FLUENT_GEN_FILE_EXTENSION` - Override file extension

## CLI Option Overrides

CLI options override configuration file settings:

```bash
# Override output directory
npx fluent-gen batch --output ./dist/builders

# Override TypeScript config
npx fluent-gen batch --tsconfig ./tsconfig.build.json

# Disable defaults
npx fluent-gen generate ./src/types.ts User --no-defaults

# Custom indentation
npx fluent-gen batch --indent-size 4 --use-tabs
```

## Generator Options

### Output Directory

Controls where generated files are placed:

```json
{
  "generator": {
    "outputDir": "./src/generated/builders"
  }
}
```

Files are generated as: `{outputDir}/{TypeName}.builder.ts`

### Use Defaults

Generates smart default values for properties:

```json
{
  "generator": {
    "useDefaults": true
  }
}
```

Default values by type:
- `string`: `""`
- `number`: `0`
- `boolean`: `false`
- Arrays: `[]`
- Objects: `{}`

### Add Comments

Preserves JSDoc comments from source:

```json
{
  "generator": {
    "addComments": true
  }
}
```

### Custom Context Type

Define a custom context type for builders:

```json
{
  "generator": {
    "contextType": "MyBuildContext",
    "importPath": "@/contexts/build-context"
  }
}
```

Generated code will use:
```typescript
import { MyBuildContext } from '@/contexts/build-context';

export interface UserBuilder extends FluentBuilder<User, MyBuildContext> {
  // ...
}
```

### File Naming

Customize generated file names:

```json
{
  "generator": {
    "fileExtension": ".generated.ts",
    "fileNameTemplate": "{type}.builder{ext}"
  }
}
```

Variables:
- `{type}` - Type name (lowercase)
- `{Type}` - Type name (original case)
- `{ext}` - File extension

### Code Formatting

Control code formatting:

```json
{
  "generator": {
    "indentSize": 2,
    "useTab": false
  }
}
```

## Advanced Configuration

### Conditional Configuration

```javascript
// fluentgen.config.js
const isDevelopment = process.env.NODE_ENV === 'development';
const isCI = process.env.CI === 'true';

module.exports = {
  generator: {
    outputDir: isDevelopment ? './dev/builders' : './src/builders',
    addComments: !isCI,
    useDefaults: true,
    skipTypeCheck: isCI
  },
  watch: {
    enabled: isDevelopment && !isCI
  }
};
```

### Multi-Environment Configuration

```javascript
// fluentgen.config.js
const configs = {
  development: {
    generator: {
      outputDir: './dev/builders',
      addComments: true,
      useDefaults: true
    }
  },
  production: {
    generator: {
      outputDir: './dist/builders',
      addComments: false,
      useDefaults: false,
      skipTypeCheck: true
    }
  },
  test: {
    generator: {
      outputDir: './test/builders',
      useDefaults: true
    }
  }
};

module.exports = configs[process.env.NODE_ENV || 'development'];
```

### Workspace Configuration

For monorepos:

```javascript
// fluentgen.config.js (root)
module.exports = {
  projects: [
    {
      name: 'app',
      root: './packages/app',
      config: {
        generator: {
          outputDir: './packages/app/src/builders'
        }
      }
    },
    {
      name: 'lib',
      root: './packages/lib',
      config: {
        generator: {
          outputDir: './packages/lib/src/builders'
        }
      }
    }
  ]
};
```

## Validation

Fluent Gen validates configuration using Zod schemas. Invalid configurations will produce clear error messages:

```
Error: Invalid configuration
  - generator.indentSize: Expected number, received string
  - targets[0].file: Required field missing
  - patterns: Expected array, received string
```

## Best Practices

### 1. Version Control

Commit your configuration file:
```bash
git add .fluentgenrc.json
```

Consider generated files:
- **Commit** if builders are stable and rarely change
- **Ignore** if generating as part of build process

### 2. Consistent Paths

Use relative paths from project root:
```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/builders"
  }
}
```

### 3. Environment-Specific Config

Use JavaScript config for environment-specific settings:
```javascript
module.exports = {
  generator: {
    outputDir: process.env.BUILD_DIR || './src/builders'
  }
};
```

### 4. Documentation

Document custom configurations:
```json
{
  "_comment": "Custom context for dependency injection",
  "generator": {
    "contextType": "DIContext",
    "importPath": "@/di/context"
  }
}
```

## Troubleshooting

### Configuration Not Found

```bash
Error: No configuration file found
```

Solution: Run `npx fluent-gen init` or create `.fluentgenrc.json` manually.

### Invalid Configuration

```bash
Error: Configuration validation failed
```

Solution: Check configuration against schema, ensure proper JSON syntax.

### Path Resolution Issues

```bash
Error: Cannot resolve path './src/types.ts'
```

Solution: Use paths relative to configuration file location.

## Next Steps

- [Learn CLI commands](./cli.md)
- [Set up programmatic usage](./api.md)
- [Create custom plugins](../api/plugins.md)
- [See configuration examples](../examples/basic.md)