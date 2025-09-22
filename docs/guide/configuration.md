# Configuration

fluent-gen offers flexible configuration options through configuration files,
CLI arguments, and programmatic APIs. This guide covers all configuration
aspects to help you customize the builder generation process.

## Configuration File

fluent-gen uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for
configuration discovery. It searches for configuration in the following order:

1. `.fluentgenrc` (JSON or YAML)
2. `.fluentgenrc.json`
3. `.fluentgenrc.yaml` / `.fluentgenrc.yml`
4. `.fluentgenrc.js` / `.fluentgenrc.cjs`
5. `fluentgen.config.js` / `fluentgen.config.cjs`
6. `package.json` (in a `"fluentgen"` property)

## Quick Setup

Initialize a configuration file:

```bash
npx fluent-gen init
```

This creates a `.fluentgenrc.json` file with sensible defaults.

## Configuration Schema

### Complete Configuration Reference

```typescript
interface Config {
  // Path to TypeScript configuration file
  tsConfigPath?: string;

  // Generator configuration options
  generator?: GeneratorConfig;

  // Target files and types to generate
  targets?: Target[];

  // Glob patterns to scan for types
  patterns?: string[];

  // Patterns to exclude from scanning
  exclude?: string[];

  // Plugin file paths to load
  plugins?: string[];
}
```

### Generator Configuration

```typescript
interface GeneratorConfig {
  // Default output directory for generated builders
  outputDir?: string;

  // Generate default values for optional properties
  useDefaults?: boolean;

  // Custom context type name for builders
  contextType?: string;

  // Import path for the custom context type
  importPath?: string;

  // Include JSDoc comments in generated code
  addComments?: boolean;
}
```

### Target Configuration

```typescript
interface Target {
  // Source file path containing types
  file: string;

  // Array of type/interface names to generate (optional)
  types?: string[];

  // Custom output file for this target (optional)
  outputFile?: string;
}
```

## Configuration Examples

### Basic Configuration

A minimal configuration for most projects:

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

### Multiple Targets

Generate builders for specific types from multiple files:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/generated/builders",
    "useDefaults": true,
    "addComments": true
  },
  "targets": [
    {
      "file": "src/types/user.ts",
      "types": ["User", "UserProfile", "UserSettings"]
    },
    {
      "file": "src/types/product.ts",
      "types": ["Product", "ProductVariant"],
      "outputFile": "src/builders/product-builders.ts"
    },
    {
      "file": "src/types/api.ts",
      "types": ["ApiRequest", "ApiResponse"]
    }
  ]
}
```

### Pattern-Based Scanning

Use glob patterns to automatically find and generate builders:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": false,
    "addComments": true
  },
  "patterns": [
    "src/entities/**/*.ts",
    "src/models/**/*.interface.ts",
    "src/types/*.ts"
  ],
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/index.ts",
    "**/node_modules/**"
  ]
}
```

### With Custom Context Type

Configure builders to use a custom context type for dependency injection:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": true,
    "contextType": "BuildContext",
    "importPath": "@/contexts/build-context"
  },
  "targets": [
    {
      "file": "src/types/models.ts",
      "types": ["User", "Order"]
    }
  ]
}
```

### With Plugins

Load custom plugins to extend generation behavior:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": true
  },
  "plugins": ["./plugins/custom-defaults.js", "./plugins/validation-plugin.js"],
  "targets": [
    {
      "file": "src/types/domain.ts"
    }
  ]
}
```

## JavaScript Configuration

For dynamic configuration, use a JavaScript file:

### CommonJS Format

```javascript
// .fluentgenrc.js or fluentgen.config.js
module.exports = {
  tsConfigPath: './tsconfig.json',
  generator: {
    outputDir:
      process.env.NODE_ENV === 'test' ? './test/builders' : './src/builders',
    useDefaults: true,
    addComments: process.env.NODE_ENV !== 'production',
  },
  targets: [
    {
      file: './src/types/user.ts',
      types: ['User', 'UserProfile'],
    },
    {
      file: './src/types/product.ts',
      types: ['Product'],
    },
  ],
  exclude: ['**/*.test.ts', '**/*.spec.ts'],
  plugins: process.env.FLUENT_GEN_PLUGINS?.split(',') || [],
};
```

### Dynamic Target Resolution

```javascript
// fluentgen.config.js
const fs = require('fs');
const path = require('path');

// Dynamically find all interface files
function findInterfaceFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && item !== 'node_modules') {
      files.push(...findInterfaceFiles(fullPath));
    } else if (item.endsWith('.interface.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

module.exports = {
  tsConfigPath: './tsconfig.json',
  generator: {
    outputDir: './src/builders',
    useDefaults: true,
    addComments: true,
  },
  targets: findInterfaceFiles('./src').map(file => ({
    file,
    // Generate all exported types from each file
    types: undefined,
  })),
};
```

## Package.json Configuration

You can also configure fluent-gen in your `package.json`:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "fluentgen": {
    "tsConfigPath": "./tsconfig.json",
    "generator": {
      "outputDir": "./src/builders",
      "useDefaults": true,
      "addComments": true
    },
    "targets": [
      {
        "file": "./src/types/models.ts",
        "types": ["User", "Product", "Order"]
      }
    ],
    "exclude": ["**/*.test.ts", "**/*.spec.ts"]
  }
}
```

## Configuration Priority

Configuration sources are merged with the following priority (highest to
lowest):

1. CLI arguments
2. Environment variables
3. Configuration file
4. Default values

Example:

```bash
# CLI argument overrides config file
npx fluent-gen generate src/types.ts User --defaults

# Even if .fluentgenrc.json has useDefaults: false
```

## Generator Options Explained

### outputDir

Specifies the default directory where generated builder files are saved.

```json
{
  "generator": {
    "outputDir": "./src/generated/builders"
  }
}
```

- Files are generated as: `{outputDir}/{TypeName}.builder.ts`
- Can be overridden per-target or via CLI

### useDefaults

Controls whether to generate default values for optional properties.

```json
{
  "generator": {
    "useDefaults": true
  }
}
```

When enabled, generates smart defaults:

- `string`: `""`
- `number`: `0`
- `boolean`: `false`
- `array`: `[]`
- `object`: `{}`
- `Date`: `new Date()`

### addComments

Preserves JSDoc comments from the source types in generated code.

```json
{
  "generator": {
    "addComments": true
  }
}
```

Example output with comments:

```typescript
/**
 * Sets the user's email address
 * @param value - Valid email address
 */
withEmail(value: string): this {
  this.email = value;
  return this;
}
```

### contextType & importPath

Define a custom context type for builders to enable dependency injection or
shared state.

```json
{
  "generator": {
    "contextType": "BuildContext",
    "importPath": "@/contexts/build-context"
  }
}
```

Generated code will include:

```typescript
import type { BuildContext } from '@/contexts/build-context';

export interface UserBuilder {
  build(context?: BuildContext): User;
}
```

## CLI Option Overrides

CLI options can override configuration file settings:

```bash
# Override output directory
npx fluent-gen generate src/types.ts User -o ./custom/output.ts

# Override TypeScript config
npx fluent-gen batch --tsconfig ./tsconfig.build.json

# Force defaults even if config says false
npx fluent-gen generate src/types.ts User --defaults

# Disable comments for this run
npx fluent-gen batch --no-comments
```

## Plugin Configuration

Plugins extend fluent-gen's functionality. They can be npm packages or local
files:

```json
{
  "plugins": ["./plugins/my-plugin.js", "@company/fluent-gen-plugin-validators"]
}
```

Plugin file structure:

```javascript
// plugins/my-plugin.js
module.exports = {
  name: 'my-custom-plugin',
  hooks: {
    afterPropertyGeneration: async context => {
      // Modify generated properties
      return { continue: true, data: context.properties };
    },
  },
};
```

## Environment-Specific Configuration

### Using Environment Variables

```javascript
// fluentgen.config.js
module.exports = {
  tsConfigPath: process.env.TS_CONFIG || './tsconfig.json',
  generator: {
    outputDir: process.env.BUILD_DIR || './src/builders',
    useDefaults: process.env.NODE_ENV !== 'production',
    addComments: process.env.NODE_ENV === 'development',
  },
};
```

### Multiple Configurations

```javascript
// fluentgen.config.js
const configs = {
  development: {
    generator: {
      outputDir: './dev/builders',
      useDefaults: true,
      addComments: true,
    },
  },
  production: {
    generator: {
      outputDir: './dist/builders',
      useDefaults: false,
      addComments: false,
    },
  },
  test: {
    generator: {
      outputDir: './test/builders',
      useDefaults: true,
      addComments: false,
    },
  },
};

module.exports = configs[process.env.NODE_ENV || 'development'];
```

## Best Practices

### 1. Commit Configuration

Always commit your configuration file to version control:

```bash
git add .fluentgenrc.json
```

### 2. Use Relative Paths

Use paths relative to the project root:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/builders"
  }
}
```

### 3. Document Custom Settings

Add comments to explain non-obvious configurations:

```javascript
// fluentgen.config.js
module.exports = {
  generator: {
    // Using custom context for dependency injection
    contextType: 'DIContext',
    importPath: '@/di/context',
  },
};
```

### 4. Separate Generated Code

Keep generated code in a dedicated directory:

```json
{
  "generator": {
    "outputDir": "./src/generated/builders"
  }
}
```

### 5. Gitignore Strategy

Consider your gitignore strategy:

```bash
# .gitignore

# Option 1: Commit generated builders (stable, rarely change)
# No entry needed

# Option 2: Ignore generated builders (regenerate on build)
src/generated/builders/
```

## Validation

fluent-gen validates configuration using Zod schemas. Invalid configurations
produce clear error messages:

```
Error: Invalid configuration
  - generator.useDefaults: Expected boolean, received string
  - targets[0].file: Required field missing
  - patterns: Expected array, received string
```

## Troubleshooting

### Configuration Not Found

```bash
Error: No configuration file found
```

**Solution**: Run `npx fluent-gen init` or create `.fluentgenrc.json` manually.

### Invalid JSON Syntax

```bash
Error: Failed to parse configuration file
```

**Solution**: Validate JSON syntax using a JSON validator or editor.

### Path Resolution Issues

```bash
Error: Cannot find file './src/types.ts'
```

**Solution**: Ensure paths are relative to the configuration file location.

### Type Not Found

```bash
Error: Type 'User' not found in file
```

**Solution**: Ensure the type is exported and the name matches exactly
(case-sensitive).

## Migration from Older Versions

If migrating from an older configuration format:

```javascript
// Old format (pre-1.0)
{
  "outputPath": "./builders",
  "includeDefaults": true
}

// New format (1.0+)
{
  "generator": {
    "outputDir": "./builders",
    "useDefaults": true
  }
}
```

## Next Steps

- [Learn CLI commands](./cli.md) - Master the command-line interface
- [Explore the API](./api.md) - Use fluent-gen programmatically
- [Create plugins](../api/plugins.md) - Extend fluent-gen functionality
- [View examples](../examples/basic.md) - See real-world configurations
