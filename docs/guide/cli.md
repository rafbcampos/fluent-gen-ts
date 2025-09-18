# CLI Usage

The Fluent Gen CLI provides powerful commands for generating builders from your TypeScript interfaces. This guide covers all available commands and their options.

## Installation

Install globally for system-wide access:

```bash
npm install -g fluent-gen
```

Or use locally with npx:

```bash
npx fluent-gen --help
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `generate` | Generate a single builder from a file and type |
| `batch` | Generate multiple builders from configuration |
| `scan` | Scan files for interfaces and generate builders |
| `init` | Initialize a configuration file |

## generate

Generate a builder for a specific interface or type.

### Syntax

```bash
fluent-gen generate <file> <type> [options]
```

### Parameters

- `<file>` - Path to TypeScript file containing the interface
- `<type>` - Name of the interface or type to generate a builder for

### Options

| Option | Alias | Type | Description |
|--------|-------|------|-------------|
| `--output` | `-o` | string | Output directory for generated files |
| `--no-defaults` | | boolean | Disable default value generation |
| `--no-comments` | | boolean | Disable JSDoc comment preservation |
| `--context-type` | | string | Custom context type name |
| `--import-path` | | string | Import path for context type |
| `--indent-size` | | number | Number of spaces for indentation |
| `--use-tabs` | | boolean | Use tabs instead of spaces |
| `--tsconfig` | | string | Path to TypeScript configuration file |

### Examples

#### Basic Usage

```bash
# Generate a User builder
fluent-gen generate ./src/types.ts User

# Generate with custom output directory
fluent-gen generate ./src/models/user.ts User --output ./src/builders

# Generate without default values
fluent-gen generate ./src/types.ts Product --no-defaults
```

#### Advanced Usage

```bash
# Custom context type
fluent-gen generate ./src/types.ts Order \
  --context-type "BuildContext" \
  --import-path "../context"

# Custom formatting
fluent-gen generate ./src/types.ts Config \
  --indent-size 4 \
  --use-tabs

# Multiple options
fluent-gen generate ./src/api/types.ts ApiResponse \
  --output ./generated/builders \
  --no-comments \
  --tsconfig ./tsconfig.build.json
```

#### Generated Output

```bash
$ fluent-gen generate ./src/types.ts User
✓ Generating builder for User
✓ Generated: ./src/User.builder.ts
```

## batch

Generate multiple builders based on configuration file.

### Syntax

```bash
fluent-gen batch [options]
```

### Options

| Option | Alias | Type | Description |
|--------|-------|------|-------------|
| `--config` | `-c` | string | Path to configuration file |
| `--watch` | `-w` | boolean | Watch for changes and regenerate |
| `--dry-run` | | boolean | Show what would be generated without writing files |
| `--parallel` | | boolean | Generate builders in parallel |
| `--output` | `-o` | string | Override output directory |
| `--verbose` | `-v` | boolean | Show detailed output |

### Examples

#### Basic Batch Generation

```bash
# Generate from default config (.fluentgenrc.json)
fluent-gen batch

# Use custom config file
fluent-gen batch --config ./custom.config.json

# Show detailed output
fluent-gen batch --verbose
```

#### Watch Mode

```bash
# Watch for changes and regenerate
fluent-gen batch --watch

# Watch with custom config
fluent-gen batch --config ./dev.config.json --watch
```

#### Advanced Options

```bash
# Dry run to preview changes
fluent-gen batch --dry-run

# Parallel generation for performance
fluent-gen batch --parallel

# Override output directory
fluent-gen batch --output ./dist/builders
```

#### Sample Output

```bash
$ fluent-gen batch --verbose
✓ Loading configuration from .fluentgenrc.json
✓ Found 5 targets to generate
✓ Generating User builder from ./src/models/user.ts
✓ Generating Product builder from ./src/models/product.ts
✓ Generating Order builder from ./src/models/order.ts
✓ Generating Payment builder from ./src/models/payment.ts
✓ Generating Customer builder from ./src/models/customer.ts
✓ Generated 5 builders in 1.2s
```

## scan

Scan files matching a pattern and generate builders for discovered interfaces.

### Syntax

```bash
fluent-gen scan <pattern> [options]
```

### Parameters

- `<pattern>` - Glob pattern to match TypeScript files

### Options

| Option | Alias | Type | Description |
|--------|-------|------|-------------|
| `--exclude` | `-e` | string | Patterns to exclude from scanning |
| `--output` | `-o` | string | Output directory for generated files |
| `--types` | `-t` | string | Comma-separated list of type names to include |
| `--ignore-private` | | boolean | Ignore non-exported interfaces |
| `--recursive` | `-r` | boolean | Scan directories recursively |
| `--dry-run` | | boolean | Show discovered types without generating |

### Examples

#### Basic Scanning

```bash
# Scan all TypeScript files in src/
fluent-gen scan "src/**/*.ts"

# Scan specific directory
fluent-gen scan "src/models/*.ts"

# Scan with exclusions
fluent-gen scan "src/**/*.ts" --exclude "**/*.test.ts,**/*.spec.ts"
```

#### Filtered Scanning

```bash
# Only generate specific types
fluent-gen scan "src/**/*.ts" --types "User,Product,Order"

# Ignore private interfaces
fluent-gen scan "src/**/*.ts" --ignore-private

# Preview discovered types
fluent-gen scan "src/**/*.ts" --dry-run
```

#### Sample Output

```bash
$ fluent-gen scan "src/models/*.ts" --dry-run
✓ Scanning src/models/*.ts
✓ Found 3 files to process:
  - src/models/user.ts (2 interfaces: User, UserProfile)
  - src/models/product.ts (1 interface: Product)
  - src/models/order.ts (3 interfaces: Order, OrderItem, OrderStatus)
✓ Total: 6 interfaces discovered
```

## init

Initialize a Fluent Gen configuration file in the current directory.

### Syntax

```bash
fluent-gen init [options]
```

### Options

| Option | Alias | Type | Description |
|--------|-------|------|-------------|
| `--format` | `-f` | string | Configuration format (json, yaml, js) |
| `--interactive` | `-i` | boolean | Interactive configuration setup |
| `--overwrite` | | boolean | Overwrite existing configuration |
| `--template` | | string | Use a configuration template |

### Examples

#### Basic Initialization

```bash
# Create .fluentgenrc.json with defaults
fluent-gen init

# Create with specific format
fluent-gen init --format yaml

# Interactive setup
fluent-gen init --interactive
```

#### Templates

```bash
# Use a specific template
fluent-gen init --template monorepo

# Available templates: basic, advanced, monorepo, testing
fluent-gen init --template advanced --format js
```

#### Interactive Mode

```bash
$ fluent-gen init --interactive
? Configuration format: JSON
? Output directory: ./src/builders
? Use default values: Yes
? Add JSDoc comments: Yes
? TypeScript config path: ./tsconfig.json
? Watch mode in development: Yes
✓ Created .fluentgenrc.json
```

## Global Options

These options are available for all commands:

| Option | Alias | Type | Description |
|--------|-------|------|-------------|
| `--help` | `-h` | boolean | Show help information |
| `--version` | `-V` | boolean | Show version number |
| `--silent` | | boolean | Suppress all output except errors |
| `--debug` | | boolean | Enable debug logging |
| `--no-color` | | boolean | Disable colored output |

### Examples

```bash
# Show help for specific command
fluent-gen generate --help

# Show version
fluent-gen --version

# Debug mode
fluent-gen batch --debug

# Silent mode for CI
fluent-gen batch --silent
```

## Environment Variables

Override CLI options with environment variables:

```bash
# Set output directory
export FLUENT_GEN_OUTPUT_DIR=./generated
fluent-gen generate ./src/types.ts User

# Enable debug mode
export FLUENT_GEN_DEBUG=true
fluent-gen batch

# Custom TypeScript config
export FLUENT_GEN_TS_CONFIG=./tsconfig.build.json
fluent-gen scan "src/**/*.ts"
```

### Available Environment Variables

- `FLUENT_GEN_OUTPUT_DIR` - Default output directory
- `FLUENT_GEN_CONFIG` - Default configuration file path
- `FLUENT_GEN_DEBUG` - Enable debug logging
- `FLUENT_GEN_SILENT` - Silent mode
- `FLUENT_GEN_NO_COLOR` - Disable colors
- `FLUENT_GEN_TS_CONFIG` - TypeScript configuration path

## Exit Codes

The CLI uses standard exit codes:

- `0` - Success
- `1` - General error
- `2` - Invalid command or arguments
- `3` - Configuration error
- `4` - TypeScript compilation error
- `5` - File system error

## Integration with Build Tools

### npm Scripts

```json
{
  "scripts": {
    "gen": "fluent-gen batch",
    "gen:watch": "fluent-gen batch --watch",
    "gen:user": "fluent-gen generate ./src/types.ts User",
    "prebuild": "npm run gen",
    "build": "tsc && npm run gen"
  }
}
```

### package.json Development Dependencies

```json
{
  "devDependencies": {
    "fluent-gen": "^1.0.0"
  },
  "scripts": {
    "postinstall": "fluent-gen batch"
  }
}
```

### CI/CD Pipeline

```yaml
# GitHub Actions
name: Generate Builders
on: [push, pull_request]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npx fluent-gen batch --silent

      # Check if generated files are up to date
      - run: git diff --exit-code
```

### Makefile Integration

```makefile
# Makefile
.PHONY: gen gen-watch gen-clean

gen:
	npx fluent-gen batch

gen-watch:
	npx fluent-gen batch --watch

gen-clean:
	rm -rf src/builders/*.builder.ts

build: gen
	npm run tsc
```

## Performance Tips

### Parallel Generation

For large projects, use parallel generation:

```bash
fluent-gen batch --parallel
```

### Targeted Generation

Generate only what you need:

```bash
# Specific types only
fluent-gen scan "src/**/*.ts" --types "User,Product"

# Exclude test files
fluent-gen scan "src/**/*.ts" --exclude "**/*.{test,spec}.ts"
```

### Watch Mode Optimization

Optimize watch mode for better performance:

```json
{
  "watch": {
    "debounce": 300,
    "ignore": [
      "**/node_modules/**",
      "**/*.test.ts",
      "**/*.spec.ts"
    ]
  }
}
```

## Troubleshooting

### Common Errors

#### Type Not Found

```bash
Error: Interface 'User' not found in ./src/types.ts
```

Solutions:
- Ensure the interface is exported
- Check spelling and case sensitivity
- Verify file path is correct

#### Output Directory Issues

```bash
Error: Cannot write to directory ./src/builders
```

Solutions:
- Check directory permissions
- Create directory manually: `mkdir -p src/builders`
- Use absolute path

#### TypeScript Compilation Errors

```bash
Error: TypeScript compilation failed
```

Solutions:
- Fix TypeScript errors in source files
- Check `tsconfig.json` configuration
- Use `--skip-type-check` for debugging

### Debug Mode

Enable debug logging for troubleshooting:

```bash
fluent-gen generate ./src/types.ts User --debug
```

This provides detailed information about:
- File resolution
- Type parsing
- Import resolution
- Code generation steps

## Next Steps

- [Learn programmatic API usage](./api.md)
- [Explore configuration options](./configuration.md)
- [See practical examples](../examples/basic.md)
- [Create custom plugins](../api/plugins.md)