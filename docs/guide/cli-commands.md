# CLI Commands

fluent-gen-ts provides a comprehensive CLI for generating builders and managing
configurations.

## Global Options

All commands support these global options:

| Option          | Description              |
| --------------- | ------------------------ |
| `-h, --help`    | Display help for command |
| `-V, --version` | Display version number   |

## `init` - Interactive Setup

Initialize a new fluent-gen-ts configuration interactively.

```bash
npx fluent-gen-ts init [options]
```

### Options

| Option            | Description                      | Default               |
| ----------------- | -------------------------------- | --------------------- |
| `--config <path>` | Configuration file path          | `fluentgen.config.js` |
| `--force`         | Overwrite existing configuration | `false`               |

### Interactive Flow

1. **Input Patterns**: Specify TypeScript file patterns
   - Example: `src/**/*.ts`
   - Multiple patterns: `src/**/*.ts,lib/**/*.ts`

2. **Interface Selection**: Choose interfaces/types to generate
   - Select individual types
   - Select all option available

3. **Output Configuration**:
   - Output directory (e.g., `./src/builders/`)
   - File naming convention (kebab, camel, pascal, snake)
   - File suffix (e.g., `builder` for `user.builder.ts`)

4. **Monorepo Configuration**: Optional workspace dependency setup
   - Enable monorepo support
   - Choose dependency resolution strategy
   - Set workspace root path (if needed)
   - Configure custom dependency paths

5. **Plugin Configuration**: Optional plugin paths

6. **Save & Generate**: Save config and optionally run generation

### Example

```bash
npx fluent-gen-ts init --config custom.config.js
```

## `generate` - Generate Single Builder

Generate a builder for a specific type.

```bash
npx fluent-gen-ts generate <file> <typeName> [options]
```

### Arguments

| Argument   | Description                | Required |
| ---------- | -------------------------- | -------- |
| `file`     | Path to TypeScript file    | Yes      |
| `typeName` | Name of the type/interface | Yes      |

### Options

| Option                | Description             | Default                         |
| --------------------- | ----------------------- | ------------------------------- |
| `-o, --output <path>` | Output file path        | `./generated/<type>.builder.ts` |
| `--tsconfig <path>`   | Path to tsconfig.json   | Auto-detected                   |
| `--use-defaults`      | Generate smart defaults | `true`                          |
| `--add-comments`      | Add JSDoc comments      | `true`                          |
| `--max-depth <n>`     | Max recursion depth     | `10`                            |

### Examples

```bash
# Basic generation
npx fluent-gen-ts generate ./src/types.ts User

# Specify output
npx fluent-gen-ts generate ./src/types.ts User --output ./src/builders/

# Custom tsconfig
npx fluent-gen-ts generate ./src/types.ts User --tsconfig tsconfig.build.json

# Without defaults
npx fluent-gen-ts generate ./src/types.ts User --no-use-defaults
```

## `batch` - Batch Generation

Generate multiple builders based on configuration file.

```bash
npx fluent-gen-ts batch [options]
```

### Options

| Option                | Description                      | Default               |
| --------------------- | -------------------------------- | --------------------- |
| `-c, --config <path>` | Configuration file path          | `fluentgen.config.js` |
| `--dry-run`           | Preview without generating files | `false`               |
| `--verbose`           | Show detailed output             | `false`               |

### Configuration File

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  types: [
    { file: './src/user.ts', types: ['User', 'Profile'] },
    { file: './src/product.ts', types: ['Product'] },
  ],
  output: {
    dir: './generated/builders',
    mode: 'batch', // or 'single'
  },
  generator: {
    useDefaults: true,
    addComments: true,
    maxDepth: 10,
  },
  tsConfigPath: './tsconfig.json',
  plugins: ['./plugins/validation.js'],
};
```

### Examples

```bash
# Use default config
npx fluent-gen-ts batch

# Custom config file
npx fluent-gen-ts batch --config custom.config.js

# Dry run to preview
npx fluent-gen-ts batch --dry-run

# Verbose output
npx fluent-gen-ts batch --verbose
```

## `scan` - Scan for Types

Scan files and display found types without generating.

```bash
npx fluent-gen-ts scan <pattern> [options]
```

### Arguments

| Argument  | Description            | Required |
| --------- | ---------------------- | -------- |
| `pattern` | Glob pattern for files | Yes      |

### Options

| Option           | Description              | Default |
| ---------------- | ------------------------ | ------- |
| `--json`         | Output as JSON           | `false` |
| `--exports-only` | Only show exported types | `true`  |

### Examples

```bash
# Scan all TypeScript files
npx fluent-gen-ts scan "src/**/*.ts"

# Output as JSON
npx fluent-gen-ts scan "src/**/*.ts" --json

# Include non-exported types
npx fluent-gen-ts scan "src/**/*.ts" --no-exports-only
```

### Output Example

```
Found 12 types in 3 files:

src/models/user.ts:
  - User (interface)
  - UserProfile (interface)
  - UserRole (type)

src/models/product.ts:
  - Product (interface)
  - Category (type)
  - PriceRange (interface)
```

## `setup-common` - Create Common File

Generate a customizable common utilities file.

```bash
npx fluent-gen-ts setup-common [options]
```

### Options

| Option                | Description             | Default       |
| --------------------- | ----------------------- | ------------- |
| `-o, --output <path>` | Output file path        | `./common.ts` |
| `--overwrite`         | Overwrite existing file | `false`       |

### What It Creates

The command generates a `common.ts` file containing:

- `FLUENT_BUILDER_SYMBOL` - Builder identification symbol
- `BaseBuildContext` - Context interface
- `FluentBuilder` - Core builder interface
- `FluentBuilderBase` - Base builder class
- `isFluentBuilder` - Type guard function
- Helper functions for nested builders

### Examples

```bash
# Create in current directory
npx fluent-gen-ts setup-common

# Specify output path
npx fluent-gen-ts setup-common --output ./src/builders/common.ts

# Overwrite existing
npx fluent-gen-ts setup-common --overwrite
```

### Customizing the Common File

After generation, you can customize the common file:

```typescript
// Add custom context properties
export interface CustomBuildContext extends BaseBuildContext {
  tenantId?: string;
  userId?: string;
  timestamp?: Date;
}

// Add utility functions
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

// Extend base class
export abstract class CustomBuilderBase<T> extends FluentBuilderBase<T> {
  withTimestamp(): this {
    return this.set('createdAt', new Date());
  }
}
```

## Configuration File

The configuration file (`fluentgen.config.js`) controls batch generation:

```javascript
/** @type {import('fluent-gen-ts').Config} */
export default {
  // Files and types to process
  targets: [
    {
      file: string,     // Path to TypeScript file
      types: string[]   // Type names to generate
    }
  ],

  // Output configuration
  output: {
    dir: string,        // Output directory
    mode: 'batch' | 'single', // Generation mode
  },

  // Generator options
  generator: {
    useDefaults: boolean,  // Generate smart defaults
    addComments: boolean,  // Include JSDoc comments
    maxDepth: number,      // Max recursion depth
    contextType: string,   // Custom context type name
  },

  // TypeScript configuration
  tsConfigPath: string,    // Path to tsconfig.json

  // Plugins
  plugins: string[],       // Plugin file paths
};
```

## Environment Variables

fluent-gen-ts respects these environment variables:

| Variable            | Description              | Default               |
| ------------------- | ------------------------ | --------------------- |
| `FLUENT_GEN_CONFIG` | Default config file path | `fluentgen.config.js` |
| `FLUENT_GEN_OUTPUT` | Default output directory | `./generated`         |
| `FLUENT_GEN_DEBUG`  | Enable debug output      | `false`               |

## Exit Codes

The CLI uses standard exit codes:

| Code | Description         |
| ---- | ------------------- |
| `0`  | Success             |
| `1`  | General error       |
| `2`  | Invalid arguments   |
| `3`  | File not found      |
| `4`  | Type not found      |
| `5`  | Configuration error |

## Tips and Best Practices

### Use Configuration Files

For consistency across team members:

```javascript
// fluentgen.config.js
export default {
  targets: [
    /* ... */
  ],
  output: {
    dir: './src/__generated__/builders',
    mode: 'batch',
  },
  generator: {
    useDefaults: true,
    addComments: true,
  },
};
```

### Add to Package Scripts

```json
{
  "scripts": {
    "generate:builders": "fluent-gen-ts batch",
    "generate:builder": "fluent-gen-ts generate",
    "setup:builders": "fluent-gen-ts init"
  }
}
```

### Integrate with Build Process

```json
{
  "scripts": {
    "prebuild": "npm run generate:builders",
    "build": "tsc"
  }
}
```

### Version Control

Recommended `.gitignore` entries:

```txt
# Generated builders (if not committing)
/generated/
/src/__generated__/

# Keep config
!fluentgen.config.js
```

Or commit generated files for:

- Better IDE support
- Faster CI builds
- Historical tracking

## Next Steps

- Explore [Plugin Development](./plugins.md) to extend the CLI
- Learn about [Advanced Usage](./advanced-usage.md)
- Check the [API Reference](/api/reference) for programmatic usage
- See [Examples](/examples/) for real-world usage patterns
