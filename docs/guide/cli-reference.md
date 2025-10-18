# CLI Reference

:::tip Quick Reference All CLI commands and options in one place. :::

## Common Commands

### Generate Single Builder

```bash
# Basic
npx fluent-gen-ts generate ./src/types.ts User

# With output directory
npx fluent-gen-ts generate ./src/types.ts User -o ./src/builders/

# All options
npx fluent-gen-ts generate ./src/types.ts User \
  --output ./src/builders/ \
  --tsconfig ./tsconfig.build.json \
  --use-defaults false \
  --add-comments false \
  --max-depth 15
```

### Batch Generation

```bash
# Use default config (fluentgen.config.js)
npx fluent-gen-ts batch

# Custom config file
npx fluent-gen-ts batch --config custom.config.js

# Dry run (preview only)
npx fluent-gen-ts batch --dry-run

# Verbose output
npx fluent-gen-ts batch --verbose
```

### Interactive Setup

```bash
# Create config interactively
npx fluent-gen-ts init

# Force overwrite existing config
npx fluent-gen-ts init --force

# Custom config path
npx fluent-gen-ts init --config my.config.js
```

### Scan for Types

```bash
# Scan files
npx fluent-gen-ts scan "src/**/*.ts"

# JSON output
npx fluent-gen-ts scan "src/**/*.ts" --json

# Include non-exported types
npx fluent-gen-ts scan "src/**/*.ts" --no-exports-only
```

### Setup Common File

```bash
# Create common.ts
npx fluent-gen-ts setup-common

# Custom output path
npx fluent-gen-ts setup-common --output ./src/builders/common.ts

# Overwrite existing
npx fluent-gen-ts setup-common --overwrite
```

## Command Reference Table

| Command        | Purpose            | Quick Example                         |
| -------------- | ------------------ | ------------------------------------- |
| `generate`     | Single builder     | `fluent-gen-ts generate file.ts Type` |
| `batch`        | Multiple builders  | `fluent-gen-ts batch`                 |
| `init`         | Interactive setup  | `fluent-gen-ts init`                  |
| `scan`         | List types         | `fluent-gen-ts scan "src/**/*.ts"`    |
| `setup-common` | Create common file | `fluent-gen-ts setup-common`          |

## Option Reference

### Global Options

```bash
-h, --help       # Show help
-V, --version    # Show version
```

### generate Options

```bash
<file>                    # TypeScript file path (required)
<typeName>                # Type name to generate (required)
-o, --output <path>       # Output file path
--tsconfig <path>         # Path to tsconfig.json
--use-defaults <boolean>  # Generate smart defaults (default: true)
--add-comments <boolean>  # Add JSDoc comments (default: true)
--max-depth <n>           # Max recursion depth (default: 10)
```

### batch Options

```bash
-c, --config <path>      # Config file path (default: fluentgen.config.js)
--dry-run                # Preview without generating
--verbose                # Show detailed output
```

### init Options

```bash
--config <path>          # Config file path (default: fluentgen.config.js)
--force                  # Overwrite existing config
```

### scan Options

```bash
<pattern>                # Glob pattern (required)
--json                   # Output as JSON
--exports-only          # Only exported types (default: true)
--no-exports-only       # Include non-exported
```

### setup-common Options

```bash
-o, --output <path>      # Output path (default: ./common.ts)
--overwrite              # Overwrite existing file
```

## Common Workflows

### Development Workflow

```bash
# 1. Setup
npx fluent-gen-ts init

# 2. Generate once
npx fluent-gen-ts batch

# 3. Add to package.json
npm pkg set scripts.generate="fluent-gen-ts batch"

# 4. Use in development
npm run generate
```

### Test Data Generation

```bash
# Scan to see available types
npx fluent-gen-ts scan "src/**/*.ts" --json > types.json

# Generate builders for testing
npx fluent-gen-ts batch --config test.config.js

# Run tests
npm test
```

### CI/CD Pipeline

```bash
# Install
npm install

# Generate builders
npx fluent-gen-ts batch

# Type check
npx tsc --noEmit

# Test
npm test

# Build
npm run build
```

## Environment Variables

Environment variables are not currently supported by the CLI. Use configuration
files or command-line flags instead.

## Exit Codes

| Code | Meaning           | Action                 |
| ---- | ----------------- | ---------------------- |
| `0`  | Success           | ✅ Continue            |
| `1`  | General error     | Check error message    |
| `2`  | Invalid arguments | Check command syntax   |
| `3`  | File not found    | Verify file path       |
| `4`  | Type not found    | Check type name/export |
| `5`  | Config error      | Validate config file   |

## Quick Debugging

### See What Will Be Generated

```bash
# Dry run with verbose output
npx fluent-gen-ts batch --dry-run --verbose
```

### Check Available Types

```bash
# List all types in a file
npx fluent-gen-ts scan "./src/types.ts"

# JSON format for processing
npx fluent-gen-ts scan "./src/types.ts" --json | jq '.'
```

### Verify Config

```bash
# Use Node to validate
node -e "console.log(require('./fluentgen.config.js'))"
```

### Debug Generation Issues

```bash
# Enable verbose output
npx fluent-gen-ts batch --verbose
```

## Integration Examples

### package.json Scripts

```json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "generate:watch": "chokidar 'src/types/**/*.ts' -c 'npm run generate'",
    "generate:dev": "fluent-gen-ts batch --config dev.config.js",
    "generate:prod": "fluent-gen-ts batch --config prod.config.js",
    "prebuild": "npm run generate",
    "pretest": "npm run generate"
  }
}
```

### Git Hooks (Husky)

```bash
# .husky/pre-commit
#!/bin/sh
npm run generate
git add src/builders
```

### GitHub Actions

```yaml
# .github/workflows/ci.yml
- name: Generate builders
  run: npx fluent-gen-ts batch

- name: Check for changes
  run: |
    git diff --exit-code src/builders || \
    (echo "Builders out of sync!" && exit 1)
```

### Docker

```dockerfile
# Dockerfile
FROM node:18

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Generate builders
RUN npx fluent-gen-ts batch

CMD ["npm", "start"]
```

## Tips & Tricks

### Alias for Faster Access

```bash
# Add to ~/.bashrc or ~/.zshrc
alias fgen="npx fluent-gen-ts"

# Usage
fgen batch
fgen generate ./src/types.ts User
```

### Automatic Regeneration

```bash
# Install nodemon
npm install -D nodemon

# Add to package.json
{
  "scripts": {
    "dev": "nodemon --watch src/types --exec 'npm run generate && npm start'"
  }
}
```

### Quick Type Discovery

```bash
# Find all interfaces/types
npx fluent-gen-ts scan "src/**/*.ts" --json | \
  jq -r '.[] | .types[] | .name' | \
  sort -u
```

### Batch Generate Multiple Configs

```bash
# generate-all.sh
#!/bin/bash
configs=("config1.js" "config2.js" "config3.js")

for config in "${configs[@]}"; do
  echo "Generating with $config..."
  npx fluent-gen-ts batch --config $config
done
```

## Common Patterns

### Generate on File Change

```bash
# Using watchman
watchman-make -p 'src/types/**/*.ts' -t generate

# Using chokidar
npx chokidar 'src/types/**/*.ts' -c 'npx fluent-gen-ts batch'

# Using nodemon
npx nodemon --watch src/types --exec 'npx fluent-gen-ts batch'
```

### Conditional Generation

```bash
# Only in development
if [ "$NODE_ENV" != "production" ]; then
  npx fluent-gen-ts batch
fi

# Only if types changed
if git diff --quiet src/types; then
  echo "No type changes, skipping generation"
else
  npx fluent-gen-ts batch
fi
```

### Parallel Generation (Monorepo)

```bash
# Using GNU parallel
find packages -name 'fluentgen.config.js' -execdir npx fluent-gen-ts batch \;

# Using npm workspaces
npm run generate --workspaces
```

## Keyboard Shortcuts (Interactive Mode)

When using `fluent-gen-ts init`:

| Key      | Action            |
| -------- | ----------------- |
| `↑` `↓`  | Navigate options  |
| `Space`  | Select/deselect   |
| `Enter`  | Confirm selection |
| `a`      | Select all        |
| `i`      | Invert selection  |
| `Ctrl+C` | Cancel            |

## Quick Reference by Task

### "I want to..."

| Task                             | Command                                   |
| -------------------------------- | ----------------------------------------- |
| Generate one builder             | `fluent-gen-ts generate file.ts Type`     |
| Generate all configured builders | `fluent-gen-ts batch`                     |
| Set up config interactively      | `fluent-gen-ts init`                      |
| See what types exist             | `fluent-gen-ts scan "src/**/*.ts"`        |
| Preview without generating       | `fluent-gen-ts batch --dry-run`           |
| See detailed output              | `fluent-gen-ts batch --verbose`           |
| Create common utilities          | `fluent-gen-ts setup-common`              |
| Use custom config                | `fluent-gen-ts batch -c custom.config.js` |

## Related Resources

- **[Configuration](/guide/configuration)** - All configuration options
- **[Workflows](/guide/workflows)** - Integration patterns
- **[Troubleshooting](/guide/troubleshooting)** - Common issues
- **[Getting Started](/guide/getting-started)** - Quick start guide

<style scoped>
table {
  font-size: 0.9em;
}

code {
  font-size: 0.85em;
}

pre {
  font-size: 0.85em;
}
</style>
