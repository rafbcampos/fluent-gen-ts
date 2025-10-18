# CLI Cheat Sheet

<!-- prettier-ignore -->
::: tip Quick Commands
Your go-to reference for common CLI operations. For detailed documentation, see
[CLI Reference](/guide/cli-reference).
:::

## Most Common Commands

```bash
# Quick single builder generation
npx fluent-gen-ts generate ./src/types.ts User

# Batch generation (uses config file)
npx fluent-gen-ts batch

# Interactive setup
npx fluent-gen-ts init

# Scan for available types
npx fluent-gen-ts scan "src/**/*.ts"
```

## Essential Workflows

### First Time Setup

```bash
# 1. Initialize config
npx fluent-gen-ts init

# 2. Generate builders
npx fluent-gen-ts batch

# 3. Add to package.json
npm pkg set scripts.generate="fluent-gen-ts batch"
```

### Daily Development

```bash
# Regenerate all builders
npm run generate

# Preview changes (dry run)
npx fluent-gen-ts batch --dry-run

# Verbose output for debugging
npx fluent-gen-ts batch --verbose
```

## Command Quick Reference

| Command        | What It Does                      | Example                               |
| -------------- | --------------------------------- | ------------------------------------- |
| `generate`     | Create a single builder           | `fluent-gen-ts generate file.ts Type` |
| `batch`        | Generate all builders from config | `fluent-gen-ts batch`                 |
| `init`         | Create config file interactively  | `fluent-gen-ts init`                  |
| `scan`         | List all available types          | `fluent-gen-ts scan "src/**/*.ts"`    |
| `setup-common` | Create common utilities file      | `fluent-gen-ts setup-common`          |

## Key Options

### For `generate` Command

```bash
-o, --output <path>       # Where to save the builder
--tsconfig <path>         # Custom tsconfig path
--use-defaults <bool>     # Smart defaults (default: true)
--add-comments <bool>     # JSDoc comments (default: true)
--max-depth <n>           # Recursion limit (default: 10)
```

### For `batch` Command

```bash
-c, --config <path>       # Config file (default: fluentgen.config.js)
--dry-run                 # Preview only, don't write files
--verbose                 # Show detailed output
```

### For `scan` Command

```bash
--json                    # Output as JSON
--exports-only           # Only exported types (default)
--no-exports-only        # Include private types
```

## Common Patterns

### Add to package.json

```json
{
  "scripts": {
    "generate": "fluent-gen-ts batch",
    "generate:watch": "chokidar 'src/types/**/*.ts' -c 'npm run generate'",
    "prebuild": "npm run generate",
    "pretest": "npm run generate"
  }
}
```

### Git Hooks

```bash
# .husky/pre-commit
#!/bin/sh
npm run generate
git add src/builders
```

### Watch for Changes

```bash
# Using nodemon
npx nodemon --watch src/types --exec 'npx fluent-gen-ts batch'

# Using chokidar
npx chokidar 'src/types/**/*.ts' -c 'npx fluent-gen-ts batch'
```

## Troubleshooting Quick Fixes

### "Type not found"

```bash
# List all available types
npx fluent-gen-ts scan "./src/types.ts"

# Make sure type is exported
export interface User { ... }
```

### "Config error"

```bash
# Validate config syntax
node -e "console.log(require('./fluentgen.config.js'))"

# Recreate config
npx fluent-gen-ts init --force
```

### "Nothing generated"

```bash
# Check what would be generated
npx fluent-gen-ts batch --dry-run --verbose

# Verify config targets
cat fluentgen.config.js
```

### Check Exit Codes

```bash
# Run and check status
npx fluent-gen-ts batch
echo $?  # 0 = success, non-zero = error
```

## CI/CD Quick Setup

### GitHub Actions

```yaml
- name: Generate builders
  run: npx fluent-gen-ts batch

- name: Verify no changes
  run: git diff --exit-code src/builders
```

### GitLab CI

```yaml
generate:
  script:
    - npm install
    - npx fluent-gen-ts batch
    - git diff --exit-code src/builders
```

## Tips & Shortcuts

### Create Alias

```bash
# Add to ~/.bashrc or ~/.zshrc
alias fgen="npx fluent-gen-ts"

# Usage
fgen batch
fgen generate ./types.ts User
```

### Quick Type Discovery

```bash
# List all type names
npx fluent-gen-ts scan "src/**/*.ts" --json | \
  jq -r '.[] | .types[] | .name' | \
  sort -u
```

### Parallel Generation (Monorepo)

```bash
# Run in all workspaces
npm run generate --workspaces

# Or manually
find packages -name 'fluentgen.config.js' \
  -execdir npx fluent-gen-ts batch \;
```

## When You Need More

- **Full CLI docs**: [CLI Reference](/guide/cli-reference)
- **Config options**: [Configuration](/guide/configuration)
- **Real examples**: [Config Recipes](/guide/config-recipes)
- **Common issues**: [Troubleshooting](/guide/troubleshooting)
