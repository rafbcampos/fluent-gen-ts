# CLI Usage

The fluent-gen-ts CLI provides powerful commands for generating builders from
your TypeScript interfaces and types. This guide covers all available commands
and their options.

## Installation

### Global Installation

Install globally for system-wide access:

```bash
npm install -g fluent-gen-ts
# or
pnpm install -g fluent-gen-ts
# or
yarn global add fluent-gen-ts
```

Then use directly:

```bash
fluent-gen-ts generate src/types.ts User
```

### Local Installation

Install as a dev dependency and use with npx:

```bash
npm install --save-dev fluent-gen-ts
# or
pnpm add -D fluent-gen-ts
# or
yarn add -D fluent-gen-ts
```

Then use with npx:

```bash
npx fluent-gen-ts generate src/types.ts User
```

## Commands Overview

fluent-gen-ts provides four main commands:

| Command    | Alias | Description                                                   |
| ---------- | ----- | ------------------------------------------------------------- |
| `init`     | -     | Initialize configuration with interactive setup (recommended) |
| `generate` | `gen` | Generate a builder for a specific type                        |
| `batch`    | -     | Generate multiple builders from configuration                 |
| `scan`     | -     | Scan files for types and generate builders                    |

## Command: generate

Generate a builder for a specific interface or type.

### Syntax

```bash
fluent-gen-ts generate <file> <type> [options]
# or use the alias
fluent-gen-ts gen <file> <type> [options]
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
fluent-gen-ts generate src/types/user.ts User

# Generate and save to file
fluent-gen-ts generate src/types/user.ts User -o src/builders/user.builder.ts

# Use the alias
fluent-gen-ts gen src/types/user.ts User
```

#### With Options

```bash
# Generate with default values for optional properties
fluent-gen-ts generate src/types/product.ts Product --defaults

# Use custom tsconfig
fluent-gen-ts generate src/types/api.ts ApiResponse --tsconfig tsconfig.build.json

# Dry run to preview the generated code
fluent-gen-ts generate src/types/order.ts Order --dry-run

# Without JSDoc comments
fluent-gen-ts generate src/types/config.ts Config --no-comments

# With plugins
fluent-gen-ts generate src/types/user.ts User \
  --plugins ./plugins/custom-defaults.js ./plugins/custom-names.js

# Multiple options combined
fluent-gen-ts generate src/types/models.ts Customer \
  --output ./generated/customer.builder.ts \
  --defaults \
  --config .fluentgenrc.json \
  --tsconfig tsconfig.json
```

## Command: batch

Generate multiple builders based on a configuration file.

### Syntax

```bash
fluent-gen-ts batch [options]
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
fluent-gen-ts batch

# Use specific configuration file
fluent-gen-ts batch --config ./config/fluent-gen.config.json

# Dry run to see what would be generated
fluent-gen-ts batch --dry-run

# Generate in parallel for faster processing
fluent-gen-ts batch --parallel

# With custom plugins
fluent-gen-ts batch --plugins ./plugins/custom.js
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
fluent-gen-ts scan <pattern> [options]
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
fluent-gen-ts scan "src/**/*.ts"

# Scan with specific output pattern
fluent-gen-ts scan "src/**/*.ts" -o "src/builders/{type}.builder.ts"

# Scan only specific subdirectories
fluent-gen-ts scan "src/{models,types}/**/*.ts"
```

#### Interactive Mode

```bash
# Select types interactively
fluent-gen-ts scan "src/**/*.ts" --interactive

# Interactive with exclusions
fluent-gen-ts scan "src/**/*.ts" -i --exclude "**/*.test.ts" "**/*.spec.ts"
```

#### Filtered Scanning

```bash
# Only generate specific types
fluent-gen-ts scan "src/**/*.ts" --types "User,Product,Order"

# Exclude test files
fluent-gen-ts scan "src/**/*.ts" --exclude "**/*.test.ts" "**/*.spec.ts"

# Only exported types
fluent-gen-ts scan "src/**/*.ts" --ignore-private

# Dry run to see what would be found
fluent-gen-ts scan "src/**/*.ts" --dry-run
```

#### Output Patterns

The `--output` option supports placeholders:

- `{file}` - Original filename without extension
- `{type}` - Type name being generated

```bash
# Output to same directory as source
fluent-gen-ts scan "src/**/*.ts" -o "src/**/{file}.builder.ts"

# Output to centralized builders directory
fluent-gen-ts scan "src/**/*.ts" -o "src/builders/{type}.builder.ts"

# Output with custom naming
fluent-gen-ts scan "src/**/*.ts" -o "generated/{type}-builder.generated.ts"
```

## Command: init

Initialize a configuration file for your project with an interactive guided
setup. This is the recommended starting point for new projects.

### Syntax

```bash
fluent-gen-ts init [options]
```

### Options

| Option        | Description                                        |
| ------------- | -------------------------------------------------- |
| `--overwrite` | Overwrite existing configuration file if it exists |

### Interactive Setup Process

The `init` command provides a comprehensive interactive experience:

1. **File Discovery** 📂
   - Prompts for glob patterns to find TypeScript files
   - Supports multiple patterns (e.g., `src/**/*.ts`, `lib/**/*.ts`)
   - Automatically scans the specified directories

2. **Interface Scanning** 🔍
   - Automatically detects all interfaces and types in your codebase
   - Shows count of discovered files and interfaces
   - Handles nested directories and complex project structures

3. **Type Selection** ✅
   - Interactive checkbox list of all discovered types
   - Use space to select/deselect, arrows to navigate
   - Shows file location for each type
   - Option to select all or specific types

4. **Output Configuration** 📁
   - Set output directory for generated builders
   - Choose naming convention (e.g., `{type}.builder`, `{type}-builder`)
   - Preview how files will be named

5. **Plugin Configuration** 🔌 (Optional)
   - Option to configure custom plugins
   - Add plugin paths for extended functionality

6. **Configuration Preview** 📝
   - Shows the complete configuration before saving
   - Allows review and confirmation
   - Option to cancel if adjustments are needed

7. **Immediate Generation** 🏗️
   - Option to run batch generation immediately
   - Generates all builders for selected types
   - Shows progress and results

### Examples

```bash
# Start interactive configuration setup
fluent-gen-ts init

# Overwrite existing configuration
fluent-gen-ts init --overwrite
```

### Interactive Session Example

```
$ npx fluent-gen-ts init

🚀 Welcome to fluent-gen configuration setup!

📂 Step 1: Discover TypeScript files
? Enter glob patterns to find TypeScript files: src/**/*.ts, lib/**/*.ts

🔍 Step 2: Scanning for interfaces...
✔ Found 15 files with 32 interfaces

✅ Step 3: Select interfaces
? Select interfaces to generate builders for:
 ◉ User (src/types/user.ts)
 ◉ Product (src/types/product.ts)
 ◯ InternalConfig (src/config/internal.ts)
 ◉ Order (src/types/order.ts)
 ◉ Customer (src/types/customer.ts)

📁 Step 4: Configure output
? Output directory: ./src/builders
? File naming convention:
  ❯ {type}.builder (e.g., User.builder.ts)
    {type}-builder (e.g., User-builder.ts)
    {type}Builder (e.g., UserBuilder.ts)

Preview: User → ./src/builders/User.builder.ts

🔌 Step 5: Configure plugins (optional)
? Do you want to configure plugins? No

📝 Configuration Preview:
{
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": true
  },
  "targets": [
    {
      "file": "src/types/user.ts",
      "types": ["User"],
      "outputFile": "./src/builders/User.builder.ts"
    },
    {
      "file": "src/types/product.ts",
      "types": ["Product"],
      "outputFile": "./src/builders/Product.builder.ts"
    }
  ],
  "patterns": ["src/**/*.ts", "lib/**/*.ts"]
}

? Save this configuration? Yes
✓ Configuration file created: .fluentgenrc.json

? Would you like to generate builders now? Yes
🏗️  Generating builders...
✓ Generated User.builder.ts
✓ Generated Product.builder.ts
✓ Generated Order.builder.ts
✓ Generated Customer.builder.ts

✨ Setup complete! 4 builders generated.
```

### Generated Configuration

The `init` command creates a `.fluentgenrc.json` file tailored to your
selections:

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
fluent-gen-ts --help
fluent-gen-ts generate --help
fluent-gen-ts batch --help

# Check version
fluent-gen-ts --version
```

## Exit Codes

fluent-gen-ts uses standard exit codes:

- `0` - Success
- `1` - Error occurred during execution

## Environment Variables

You can set environment variables to configure fluent-gen-ts behavior:

```bash
# Set TypeScript config path
FLUENT_GEN_TSCONFIG=./tsconfig.build.json fluent-gen-ts generate src/types.ts User

# Enable debug output
DEBUG=fluent-gen:* fluent-gen-ts generate src/types.ts User
```

## Tips and Best Practices

### Project Setup

1. **Install locally**: Install fluent-gen-ts as a dev dependency for consistent
   versions across team members.

2. **Use configuration file**: Create a `.fluentgenrc.json` for consistent
   settings across commands.

3. **Add to npm scripts**: Add common commands to your `package.json`:

```json
{
  "scripts": {
    "generate:init": "fluent-gen-ts init",
    "generate:builders": "fluent-gen-ts batch",
    "generate:single": "fluent-gen-ts generate",
    "scan:types": "fluent-gen-ts scan 'src/**/*.ts' --interactive"
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
[fluent-gen-ts examples repository](https://github.com/rafbcampos/fluent-gen-ts/tree/main/examples).

## Getting Help

- Run `fluent-gen-ts --help` for command help
- Check the [API documentation](./api.md) for programmatic usage
- Report issues on [GitHub](https://github.com/rafbcampos/fluent-gen-ts/issues)
- Ask questions in
  [Discussions](https://github.com/rafbcampos/fluent-gen-ts/discussions)
