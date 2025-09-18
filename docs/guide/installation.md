# Installation

This guide covers the installation and setup of Fluent Gen in your TypeScript project.

## Requirements

### Runtime Requirements

- **Node.js**: Version 18.0.0 or higher
- **TypeScript**: Version 5.0.0 or higher
- **Operating System**: Windows, macOS, or Linux

### Development Dependencies

Fluent Gen requires these peer dependencies:

- `typescript`: ^5.0.0
- `ts-morph`: ^23.0.0 (automatically installed)

## Installation Methods

### npm

```bash
npm install --save-dev fluent-gen
```

### pnpm

```bash
pnpm add -D fluent-gen
```

### yarn

```bash
yarn add --dev fluent-gen
```

### Bun

```bash
bun add -d fluent-gen
```

## Global Installation

For system-wide CLI access:

```bash
npm install -g fluent-gen
```

::: warning
Global installation is not recommended for project-specific configurations. Use local installation with `npx` instead.
:::

## Verify Installation

After installation, verify that Fluent Gen is working:

```bash
npx fluent-gen --version
```

You should see the version number:

```
fluent-gen version 1.0.0
```

## TypeScript Configuration

Fluent Gen works best with strict TypeScript settings. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Important Compiler Options

- **`strict: true`**: Enables all strict type checking options
- **`noUncheckedIndexedAccess: true`**: Ensures type safety for indexed access
- **`exactOptionalPropertyTypes: true`**: Distinguishes between `undefined` and optional properties
- **`moduleResolution: "NodeNext"`**: Required for proper ESM support

## Project Setup

### 1. Initialize Configuration

Create a Fluent Gen configuration file:

```bash
npx fluent-gen init
```

This creates a `.fluentgenrc.json` file:

```json
{
  "generator": {
    "outputDir": "./src/builders",
    "useDefaults": true,
    "addComments": true
  },
  "tsConfigPath": "./tsconfig.json"
}
```

### 2. Create Output Directory

Ensure your output directory exists:

```bash
mkdir -p src/builders
```

### 3. Add to Git Ignore (Optional)

If you're generating builders as part of your build process:

```bash
echo "src/builders/*.builder.ts" >> .gitignore
```

## Package.json Scripts

Add convenient scripts to your `package.json`:

```json
{
  "scripts": {
    "gen": "fluent-gen batch",
    "gen:watch": "fluent-gen batch --watch",
    "gen:single": "fluent-gen generate",
    "gen:scan": "fluent-gen scan './src/**/*.ts'",
    "prebuild": "npm run gen",
    "build": "tsc"
  }
}
```

### Script Descriptions

- **`gen`**: Generate all builders from configuration
- **`gen:watch`**: Watch for changes and regenerate
- **`gen:single`**: Generate a single builder (requires arguments)
- **`gen:scan`**: Scan and generate builders from a pattern
- **`prebuild`**: Automatically generate before building

## Environment Setup

### VS Code Integration

For better IntelliSense with generated files, add to `.vscode/settings.json`:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.includeCompletionsForModuleExports": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### ESLint Configuration

Exclude generated files from linting:

```javascript
// .eslintrc.js
module.exports = {
  ignorePatterns: [
    '*.builder.ts',
    'src/builders/**'
  ]
};
```

### Prettier Configuration

Exclude generated files from formatting:

```
# .prettierignore
*.builder.ts
src/builders/
```

## Build Tool Integration

### Webpack

```javascript
// webpack.config.js
const { FluentGenPlugin } = require('fluent-gen/webpack');

module.exports = {
  plugins: [
    new FluentGenPlugin({
      configPath: './.fluentgenrc.json',
      watch: process.env.NODE_ENV === 'development'
    })
  ]
};
```

### Vite

```javascript
// vite.config.ts
import { fluentGen } from 'fluent-gen/vite';

export default {
  plugins: [
    fluentGen({
      configPath: './.fluentgenrc.json'
    })
  ]
};
```

### Rollup

```javascript
// rollup.config.js
import { fluentGen } from 'fluent-gen/rollup';

export default {
  plugins: [
    fluentGen({
      configPath: './.fluentgenrc.json'
    })
  ]
};
```

## Docker Setup

If using Docker for development:

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Generate builders
RUN npm run gen

# Build application
RUN npm run build

CMD ["npm", "start"]
```

## Monorepo Setup

### With Lerna

```json
// lerna.json
{
  "packages": ["packages/*"],
  "npmClient": "npm",
  "command": {
    "run": {
      "stream": true
    }
  },
  "scripts": {
    "gen": "lerna run gen --stream"
  }
}
```

### With Nx

```json
// workspace.json
{
  "projects": {
    "my-app": {
      "targets": {
        "generate": {
          "executor": "@nrwl/workspace:run-commands",
          "options": {
            "command": "npx fluent-gen batch",
            "cwd": "apps/my-app"
          }
        }
      }
    }
  }
}
```

### With pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```json
// package.json (root)
{
  "scripts": {
    "gen": "pnpm -r run gen"
  }
}
```

## Troubleshooting Installation

### Common Issues

#### Module Not Found

```bash
Error: Cannot find module 'fluent-gen'
```

**Solution**: Ensure Fluent Gen is installed locally:
```bash
npm list fluent-gen
```

#### TypeScript Version Mismatch

```bash
Error: TypeScript version 4.x.x is not supported
```

**Solution**: Update TypeScript to version 5.0.0 or higher:
```bash
npm update typescript@^5.0.0
```

#### Permission Denied

```bash
Error: EACCES: permission denied
```

**Solution**: Fix npm permissions or use a Node version manager (nvm, fnm):
```bash
sudo npm install -g fluent-gen --unsafe-perm
```

#### ts-morph Issues

```bash
Error: Cannot resolve ts-morph
```

**Solution**: Clear cache and reinstall:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Platform-Specific Issues

#### Windows

- Use forward slashes in file paths
- Run terminal as Administrator if needed
- Consider using WSL2 for better compatibility

#### macOS

- Ensure Xcode Command Line Tools are installed
- Check file permissions in the project directory

#### Linux

- Install build-essential if compilation fails
- Check Node.js installation method (snap packages may have issues)

## Next Steps

Now that Fluent Gen is installed:

1. [Configure Fluent Gen](./configuration.md) for your project
2. [Learn the CLI commands](./cli.md)
3. [Try the examples](../examples/basic.md)
4. [Integrate with your build process](./api.md)