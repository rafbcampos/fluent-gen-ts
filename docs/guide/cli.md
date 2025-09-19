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
| `--output` | `-o` | string | Output file path |
| `--config` | `-c` | string | Path to configuration file |
| `--tsconfig` | `-t` | string | Path to tsconfig.json |
| `--plugins` | `-p` | string[] | Path(s) to plugin files |
| `--defaults` | `-d` | boolean | Use default values for optional properties |
| `--dry-run` | | boolean | Preview what would be generated without writing files |
| `--no-comments` | | boolean | Don't include JSDoc comments in generated code |

### Examples

#### Basic Usage

```bash
# Generate a User builder
fluent-gen generate ./src/types.ts User

# Generate with custom output file
fluent-gen generate ./src/models/user.ts User --output ./src/builders/user.builder.ts

# Generate with default values enabled
fluent-gen generate ./src/types.ts Product --defaults
```

#### Advanced Usage

```bash
# With plugins
fluent-gen generate ./src/types.ts Order \
  --plugins ./plugins/custom-plugin.js

# Dry run to preview generated code
fluent-gen generate ./src/types.ts Config \
  --dry-run

# Multiple options
fluent-gen generate ./src/api/types.ts ApiResponse \
  --output ./generated/builders/api-response.builder.ts \
  --no-comments \
  --tsconfig ./tsconfig.build.json \
  --config ./fluent-gen.config.js
```

#### Generated Output

```bash
$ fluent-gen generate ./src/types.ts User
- Loading configuration...
✔ ✓ Generation complete
[Generated builder code output would appear here]
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
| `--plugins` | `-p` | string[] | Path(s) to plugin files |
| `--dry-run` | `-d` | boolean | Dry run without writing files |
| `--parallel` | | boolean | Generate builders in parallel |

### Examples

#### Basic Batch Generation

```bash
# Generate from default config (.fluentgenrc.json)
fluent-gen batch

# Use custom config file
fluent-gen batch --config ./custom.config.json

# With plugins
fluent-gen batch --plugins ./plugins/my-plugin.js
```

#### Advanced Options

```bash
# Dry run to preview changes
fluent-gen batch --dry-run

# Parallel generation for performance
fluent-gen batch --parallel

# Multiple plugins
fluent-gen batch --plugins ./plugins/plugin1.js ./plugins/plugin2.js

# Custom config with parallel processing
fluent-gen batch --config ./build.config.json --parallel
```

#### Sample Output

```bash
$ fluent-gen batch
- Loading configuration...
✔ ✓ Batch generation complete: 5 succeeded, 0 failed
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
| `--output` | `-o` | string | Output file pattern (use {file} and {type} placeholders) |
| `--config` | `-c` | string | Path to configuration file |
| `--plugins` | `-p` | string[] | Path(s) to plugin files |
| `--exclude` | `-e` | string[] | Patterns to exclude from scanning |
| `--types` | `-t` | string | Comma-separated list of type names to include |
| `--interactive` | `-i` | boolean | Interactive mode to select types |
| `--dry-run` | | boolean | Preview discovered types without generating |
| `--ignore-private` | | boolean | Ignore non-exported interfaces |

### Examples

#### Basic Scanning

```bash
# Scan all TypeScript files in src/
fluent-gen scan "src/**/*.ts"

# Scan specific directory
fluent-gen scan "src/models/*.ts"

# Scan with exclusions
fluent-gen scan "src/**/*.ts" --exclude "**/*.test.ts" "**/*.spec.ts"
```

#### Filtered Scanning

```bash
# Only generate specific types
fluent-gen scan "src/**/*.ts" --types "User,Product,Order"

# Interactive mode to select types
fluent-gen scan "src/**/*.ts" --interactive

# Preview discovered types
fluent-gen scan "src/**/*.ts" --dry-run

# With custom output pattern
fluent-gen scan "src/**/*.ts" --output "./builders/{type}.builder.ts"
```

#### Sample Output

```bash
$ fluent-gen scan "src/models/*.ts" --dry-run
- Scanning for files matching src/models/*.ts...
✔ Found 1 file(s)
- Scanning src/models/user.ts...
✔   ✓ Found 3 type(s) in src/models/user.ts
    - User
    - UserProfile
    - UserSettings

✓ Dry-run complete. Found 3 type(s):
  User (src/models/user.ts)
  UserProfile (src/models/user.ts)
  UserSettings (src/models/user.ts)
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
| `--format` | `-f` | string | Configuration format (json, yaml, js) (default: "json") |
| `--interactive` | `-i` | boolean | Interactive configuration setup (default: true) |
| `--template` | | string | Use a configuration template (basic, advanced, monorepo) |
| `--overwrite` | | boolean | Overwrite existing configuration |

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

# Available templates: basic, advanced, monorepo
fluent-gen init --template advanced --format js
```

#### Interactive Mode

```bash
$ fluent-gen init --interactive
🚀 Welcome to fluent-gen configuration setup!

? How would you like to set up your configuration?
  ❯ 🎯 Quick setup (recommended defaults)
    ⚙️  Custom setup (configure everything)
    📋 Start from template

✓ Configuration file created: .fluentgenrc.json

📚 Next steps:

  1. Generate a single builder:
     fluent-gen generate <file> <type>

  For more information:
     fluent-gen --help
```

## Global Options

These options are available for all commands:

| Option | Alias | Type | Description |
|--------|-------|------|-------------|
| `--help` | `-h` | boolean | Show help information |
| `--version` | `-V` | boolean | Show version number |

### Examples

```bash
# Show help for specific command
fluent-gen generate --help

# Show version
fluent-gen --version

# Show general help
fluent-gen --help
```

## Exit Codes

The CLI uses standard exit codes:

- `0` - Success
- `1` - General error

## Integration with Build Tools

### npm Scripts

```json
{
  "scripts": {
    "gen": "fluent-gen batch",
    "gen:parallel": "fluent-gen batch --parallel",
    "gen:user": "fluent-gen generate ./src/types.ts User",
    "gen:dry-run": "fluent-gen batch --dry-run",
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
      - run: npx fluent-gen batch

      # Check if generated files are up to date
      - run: git diff --exit-code
```

### Makefile Integration

```makefile
# Makefile
.PHONY: gen gen-watch gen-clean

gen:
	npx fluent-gen batch

gen-parallel:
	npx fluent-gen batch --parallel

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

### Configuration Optimization

Optimize your configuration for better performance:

```json
{
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": false
  },
  "exclude": [
    "**/node_modules/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
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
- Verify the interface exists and is exported

## Next Steps

- [Learn programmatic API usage](./api.md)
- [Explore configuration options](./configuration.md)
- [See practical examples](../examples/basic.md)
- [Create custom plugins](../api/plugins.md)