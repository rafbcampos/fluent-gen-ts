# CLI Usage

The fluent-gen CLI provides powerful commands for generating builders from your
TypeScript interfaces and types. This guide covers all available commands and
their options.

## Installation

### Global Installation

Install globally for system-wide access:

```bash
npm install -g fluent-gen
# or
pnpm install -g fluent-gen
# or
yarn global add fluent-gen
```

Then use directly:

```bash
fluent-gen generate src/types.ts User
```

### Local Installation

Install as a dev dependency and use with npx:

```bash
npm install --save-dev fluent-gen
# or
pnpm add -D fluent-gen
# or
yarn add -D fluent-gen
```

Then use with npx:

```bash
npx fluent-gen generate src/types.ts User
```

## Commands Overview

fluent-gen provides four main commands:

| Command    | Alias | Description                                   |
| ---------- | ----- | --------------------------------------------- |
| `generate` | `gen` | Generate a builder for a specific type        |
| `batch`    | -     | Generate multiple builders from configuration |
| `scan`     | -     | Scan files for types and generate builders    |
| `init`     | -     | Initialize a configuration file               |

## Command: generate

Generate a builder for a specific interface or type.

### Syntax

```bash
fluent-gen generate <file> <type> [options]
# or use the alias
fluent-gen gen <file> <type> [options]
```

### Arguments

- `<file>` - Path to the TypeScript file containing the interface or type
- `<type>` - Name of the interface or type to generate a builder for

### Options

| Option          | Alias | Type     | Description                                    |
| --------------- | ----- | -------- | ---------------------------------------------- |
| `--output`      | `-o`  | string   | Output file path for the generated builder     |
| `--config`      | `-c`  | string   | Path to configuration file                     |
| `--tsconfig`    | `-t`  | string   | Path to tsconfig.json                          |
| `--plugins`     | `-p`  | string[] | Path(s) to plugin files                        |
| `--defaults`    | `-d`  | boolean  | Use default values for optional properties     |
| `--dry-run`     | -     | boolean  | Preview generated code without writing files   |
| `--no-comments` | -     | boolean  | Don't include JSDoc comments in generated code |

### Examples

#### Basic Usage

```bash
# Generate and output to console
fluent-gen generate src/types/user.ts User

# Generate and save to file
fluent-gen generate src/types/user.ts User -o src/builders/user.builder.ts

# Use the alias
fluent-gen gen src/types/user.ts User
```

#### With Options

```bash
# Generate with default values for optional properties
fluent-gen generate src/types/product.ts Product --defaults

# Use custom tsconfig
fluent-gen generate src/types/api.ts ApiResponse --tsconfig tsconfig.build.json

# Dry run to preview the generated code
fluent-gen generate src/types/order.ts Order --dry-run

# Without JSDoc comments
fluent-gen generate src/types/config.ts Config --no-comments

# With plugins
fluent-gen generate src/types/user.ts User \
  --plugins ./plugins/custom-defaults.js ./plugins/custom-names.js

# Multiple options combined
fluent-gen generate src/types/models.ts Customer \
  --output ./generated/customer.builder.ts \
  --defaults \
  --config .fluentgenrc.json \
  --tsconfig tsconfig.json
```

## Command: batch

Generate multiple builders based on a configuration file.

### Syntax

```bash
fluent-gen batch [options]
```

### Options

| Option       | Alias | Type     | Description                                                              |
| ------------ | ----- | -------- | ------------------------------------------------------------------------ |
| `--config`   | `-c`  | string   | Path to configuration file (defaults to searching for .fluentgenrc.json) |
| `--plugins`  | `-p`  | string[] | Path(s) to plugin files                                                  |
| `--dry-run`  | `-d`  | boolean  | Preview what would be generated without writing files                    |
| `--parallel` | -     | boolean  | Generate builders in parallel for better performance                     |

### Examples

```bash
# Use default configuration file search
fluent-gen batch

# Use specific configuration file
fluent-gen batch --config ./config/fluent-gen.config.json

# Dry run to see what would be generated
fluent-gen batch --dry-run

# Generate in parallel for faster processing
fluent-gen batch --parallel

# With custom plugins
fluent-gen batch --plugins ./plugins/custom.js
```

### Configuration File

The batch command requires a configuration file. By default, it searches for:

- `.fluentgenrc`
- `.fluentgenrc.json`
- `.fluentgenrc.yaml`
- `.fluentgenrc.yml`
- `.fluentgenrc.js`
- `.fluentgenrc.cjs`
- `fluentgen.config.js`
- `fluentgen.config.cjs`
- `package.json` (with "fluentgen" field)

Example `.fluentgenrc.json`:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": true
  },
  "targets": [
    {
      "file": "src/types/models.ts",
      "types": ["User", "Product", "Order"],
      "outputFile": "src/builders/models.builder.ts"
    }
  ]
}
```

## Command: scan

Scan files for interfaces and types, then generate builders.

### Syntax

```bash
fluent-gen scan <pattern> [options]
```

### Arguments

- `<pattern>` - Glob pattern to match TypeScript files (e.g., "src/\*_/_.ts")

### Options

| Option             | Alias | Type     | Description                                              |
| ------------------ | ----- | -------- | -------------------------------------------------------- |
| `--output`         | `-o`  | string   | Output file pattern (use {file} and {type} placeholders) |
| `--config`         | `-c`  | string   | Path to configuration file                               |
| `--plugins`        | `-p`  | string[] | Path(s) to plugin files                                  |
| `--exclude`        | `-e`  | string[] | Glob patterns to exclude from scanning                   |
| `--types`          | `-t`  | string   | Comma-separated list of type names to include            |
| `--interactive`    | `-i`  | boolean  | Interactive mode to select types                         |
| `--dry-run`        | -     | boolean  | Preview discovered types without generating              |
| `--ignore-private` | -     | boolean  | Ignore non-exported interfaces and types                 |

### Examples

#### Basic Scanning

```bash
# Scan all TypeScript files in src directory
fluent-gen scan "src/**/*.ts"

# Scan with specific output pattern
fluent-gen scan "src/**/*.ts" -o "src/builders/{type}.builder.ts"

# Scan only specific subdirectories
fluent-gen scan "src/{models,types}/**/*.ts"
```

#### Interactive Mode

```bash
# Select types interactively
fluent-gen scan "src/**/*.ts" --interactive

# Interactive with exclusions
fluent-gen scan "src/**/*.ts" -i --exclude "**/*.test.ts" "**/*.spec.ts"
```

#### Filtered Scanning

```bash
# Only generate specific types
fluent-gen scan "src/**/*.ts" --types "User,Product,Order"

# Exclude test files
fluent-gen scan "src/**/*.ts" --exclude "**/*.test.ts" "**/*.spec.ts"

# Only exported types
fluent-gen scan "src/**/*.ts" --ignore-private

# Dry run to see what would be found
fluent-gen scan "src/**/*.ts" --dry-run
```

#### Output Patterns

The `--output` option supports placeholders:

- `{file}` - Original filename without extension
- `{type}` - Type name being generated

```bash
# Output to same directory as source
fluent-gen scan "src/**/*.ts" -o "src/**/{file}.builder.ts"

# Output to centralized builders directory
fluent-gen scan "src/**/*.ts" -o "src/builders/{type}.builder.ts"

# Output with custom naming
fluent-gen scan "src/**/*.ts" -o "generated/{type}-builder.generated.ts"
```

## Command: init

Initialize a configuration file for your project.

### Syntax

```bash
fluent-gen init [options]
```

### Options

| Option        | Description                                        |
| ------------- | -------------------------------------------------- |
| `--overwrite` | Overwrite existing configuration file if it exists |

### Examples

```bash
# Create a new configuration file
fluent-gen init

# Overwrite existing configuration
fluent-gen init --overwrite
```

### Generated Configuration

The `init` command creates a `.fluentgenrc.json` file with a starter
configuration:

```json
{
  "tsConfigPath": "./tsconfig.json",
  "generator": {
    "outputDir": "./src/generated/builders",
    "useDefaults": false,
    "addComments": true,
    "contextType": null,
    "importPath": null
  },
  "targets": [],
  "patterns": [],
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
  "plugins": []
}
```

You can then customize this file for your project's needs.

## Global Options

These options are available for all commands:

| Option      | Description                       |
| ----------- | --------------------------------- |
| `--help`    | Display help for the command      |
| `--version` | Display the version of fluent-gen |

```bash
# Get help for any command
fluent-gen --help
fluent-gen generate --help
fluent-gen batch --help

# Check version
fluent-gen --version
```

## Exit Codes

fluent-gen uses standard exit codes:

- `0` - Success
- `1` - Error occurred during execution

## Environment Variables

You can set environment variables to configure fluent-gen behavior:

```bash
# Set TypeScript config path
FLUENT_GEN_TSCONFIG=./tsconfig.build.json fluent-gen generate src/types.ts User

# Enable debug output
DEBUG=fluent-gen:* fluent-gen generate src/types.ts User
```

## Tips and Best Practices

### Project Setup

1. **Install locally**: Install fluent-gen as a dev dependency for consistent
   versions across team members.

2. **Use configuration file**: Create a `.fluentgenrc.json` for consistent
   settings across commands.

3. **Add to npm scripts**: Add common commands to your `package.json`:

```json
{
  "scripts": {
    "generate:builders": "fluent-gen batch",
    "generate:single": "fluent-gen generate",
    "scan:types": "fluent-gen scan 'src/**/*.ts' --interactive"
  }
}
```

### Performance

1. **Use batch generation**: For multiple types, use `batch` command instead of
   multiple `generate` calls.

2. **Enable parallel processing**: Use `--parallel` flag with batch command for
   faster generation.

3. **Exclude unnecessary files**: Use `--exclude` patterns to skip test files
   and other non-relevant files.

### Organization

1. **Consistent output structure**: Use a dedicated `builders` or `generated`
   directory.

2. **Naming conventions**: Use consistent naming like `{type}.builder.ts`.

3. **Version control**: Consider adding generated builders to `.gitignore` if
   regenerating frequently.

## Common Issues

### Type Not Found

If a type cannot be found:

- Ensure the type is exported
- Check the file path is correct
- Verify the type name is exact (case-sensitive)

### Import Resolution

If imports fail to resolve:

- Check your `tsconfig.json` paths configuration
- Ensure all dependencies are installed
- Use `--tsconfig` option to specify the correct config

### Permission Errors

If you get permission errors with global installation:

- Use npx with local installation instead
- Check npm/pnpm/yarn global directory permissions
- Run with appropriate permissions (avoid using sudo if possible)

## Examples Repository

For more examples and use cases, check out the
[fluent-gen examples repository](https://github.com/rafbcampos/fluent-gen/tree/main/examples).

## Getting Help

- Run `fluent-gen --help` for command help
- Check the [API documentation](./api.md) for programmatic usage
- Report issues on [GitHub](https://github.com/rafbcampos/fluent-gen/issues)
- Ask questions in
  [Discussions](https://github.com/rafbcampos/fluent-gen/discussions)
