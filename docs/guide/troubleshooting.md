# Troubleshooting Guide

:::tip Quick Solutions Common issues and their fixes. Use Ctrl+F to find your
error message. :::

## Installation Issues

### Cannot find package 'fluent-gen-ts'

**Error:**

```
npm ERR! 404 Not Found - GET https://registry.npmjs.org/fluent-gen-ts
```

**Solution:**

```bash
# Ensure correct package name
npm install -D fluent-gen-ts

# Or with pnpm
pnpm add -D fluent-gen-ts

# Or with yarn
yarn add -D fluent-gen-ts
```

### Command not found: fluent-gen-ts

**Error:**

```bash
fluent-gen-ts: command not found
```

**Solution:** Use `npx`:

```bash
npx fluent-gen-ts batch
```

Or add to `package.json`:

```json
{
  "scripts": {
    "generate": "fluent-gen-ts batch"
  }
}
```

Then run:

```bash
npm run generate
```

## Generation Errors

### Type not found

**Error:**

```
Error: Type 'User' not found in file './src/types.ts'
```

**Solutions:**

1. **Verify type is exported:**

   ```typescript
   // ❌ Wrong
   interface User { ... }

   // ✅ Correct
   export interface User { ... }
   ```

2. **Check file path:**

   ```bash
   # Verify file exists
   ls -la ./src/types.ts

   # Scan to see what types are available
   npx fluent-gen-ts scan "./src/types.ts"
   ```

3. **Check type name spelling:**
   ```javascript
   // config.js
   targets: [
     { file: './src/types.ts', types: ['User'] }, // Must match exactly
   ];
   ```

### File not found

**Error:**

```
Error: File './src/types.ts' not found
```

**Solutions:**

1. **Use correct path (relative to config file):**

   ```javascript
   // If config is in root and types in src/
   targets: [
     { file: './src/types.ts', types: ['User'] }, // Correct
   ];
   ```

2. **Verify file exists:**
   ```bash
   ls -la src/types.ts
   ```

### Cannot resolve module

**Error:**

```
Error: Cannot resolve module '@prisma/client'
```

**Solutions:**

1. **Install missing dependencies:**

   ```bash
   npm install @prisma/client
   ```

2. **For monorepos, configure resolution:**

   ```javascript
   {
     monorepo: {
       enabled: true,
       dependencyResolutionStrategy: 'auto'
     }
   }
   ```

3. **Check tsconfig.json paths:**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

## Generated Code Issues

### Import errors: Cannot find module

**Error:**

```typescript
// ❌ Generated code has this:
import { User } from '../types';
// Error: Cannot find module '../types'
```

**Solution:**

Ensure ESM imports include `.js` extension. Update tsconfig:

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

The generator will output:

```typescript
// ✅ Correct:
import { User } from '../types.js';
```

### Circular dependency detected

**Error:**

```
Error: Circular dependency detected: User -> Profile -> User
```

**Solutions:**

1. **Use type imports:**

   ```typescript
   // Instead of:
   import { User } from './user.js';

   // Use:
   import type { User } from './user.js';
   ```

2. **Restructure types:**

   ```typescript
   // Split into separate files
   // user.ts
   export interface User {
     id: string;
     profile: Profile; // Reference only
   }

   // profile.ts
   export interface Profile {
     userId: string; // Use ID instead of full User
   }
   ```

### TypeScript compilation errors

**Error:**

```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Solutions:**

1. **Regenerate builders after type changes:**

   ```bash
   npx fluent-gen-ts batch
   ```

2. **Check generated code:**

   ```bash
   cat ./src/builders/user.builder.ts
   ```

3. **Verify tsconfig is correct:**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": false
     }
   }
   ```

## Plugin Issues

### Plugin not loading

**Error:**

```
Plugin './plugins/validation.ts' could not be loaded
```

**Solutions:**

1. **Verify plugin path:**

   ```javascript
   // Relative to config file
   plugins: ['./plugins/validation.ts'];
   ```

2. **Ensure plugin exports default:**

   ```typescript
   // ❌ Wrong
   export const plugin = createPlugin(...);

   // ✅ Correct
   const plugin = createPlugin(...);
   export default plugin;
   ```

3. **Check plugin builds without errors:**

   ```typescript
   const plugin = createPlugin('name', '1.0.0').setDescription('...').build(); // Must call .build()!

   export default plugin;
   ```

### Plugin transformation not applied

**Error:** Plugin code doesn't seem to run.

**Solutions:**

1. **Ensure `.done()` is called:**

   ```typescript
   // ❌ Wrong
   .when(ctx => ctx.property.name === 'email')
   .setValidator('code')
   // Missing .done()!

   // ✅ Correct
   .when(ctx => ctx.property.name === 'email')
   .setValidator('code')
   .done() // Complete the rule!
   ```

2. **Check rule order (CRITICAL):**

   ```typescript
   // ❌ Wrong - Generic rule first blocks specific rule
   .when(ctx => ctx.type.isPrimitive())      // Too generic
   .done()
   .when(ctx => ctx.property.name === 'id')  // Never reached!
   .done()

   // ✅ Correct - Specific rules first
   .when(ctx => ctx.property.name === 'id')
   .done()
   .when(ctx => ctx.type.isPrimitive())
   .done()
   ```

3. **Verify condition matches:**
   ```typescript
   // Add logging to debug
   .when(ctx => {
     const matches = ctx.property.name === 'email';
     console.log(`Property ${ctx.property.name} matches:`, matches);
     return matches;
   })
   ```

### Import errors in generated code from plugins

**Error:**

```typescript
// Generated code:
import { validator } from 'validator'; // Error: Module not found
```

**Solutions:**

1. **Install plugin dependencies:**

   ```bash
   npm install validator
   ```

2. **Check plugin imports use correct syntax:**

   ```typescript
   .requireImports(imports =>
     imports.addExternal('validator', ['isEmail']) // Named export
   )

   // Or for default export:
   .requireImports(imports =>
     imports.addExternalDefault('validator', 'validator')
   )
   ```

## Configuration Issues

### Config file not found

**Error:**

```
Error: Config file 'fluentgen.config.js' not found
```

**Solutions:**

1. **Create config file in project root:**

   ```bash
   touch fluentgen.config.js
   ```

2. **Or specify config path:**

   ```bash
   npx fluent-gen-ts batch --config custom.config.js
   ```

3. **Ensure correct export:**

   ```javascript
   // ❌ Wrong
   module.exports = { ... };

   // ✅ Correct (ESM)
   export default { ... };
   ```

### Invalid configuration

**Error:**

```
Error: Configuration validation failed
```

**Solution:**

Check config structure:

```javascript
export default {
  targets: [
    {
      file: string,        // Required
      types: string[]      // Optional
    }
  ],
  generator: {
    outputDir: string,     // Output directory
    useDefaults: boolean,
    addComments: boolean
  }
};
```

## Monorepo Issues

### Dependencies not found in monorepo

**Error:**

```
Error: Cannot find package '@workspace/shared'
```

**Solutions:**

1. **Enable monorepo support:**

   ```javascript
   {
     monorepo: {
       enabled: true,
       dependencyResolutionStrategy: 'auto'
     }
   }
   ```

2. **For pnpm, ensure pnpm-workspace.yaml exists:**

   ```yaml
   packages:
     - 'packages/*'
     - 'apps/*'
   ```

3. **For Yarn workspaces:**

   ```json
   // root package.json
   {
     "private": true,
     "workspaces": ["packages/*"]
   }
   ```

4. **Use verbose mode to debug:**
   ```bash
   npx fluent-gen-ts batch --verbose
   ```

### pnpm symlinks not resolved

**Error:**

```
Error: Cannot resolve symlinked package in node_modules/.pnpm
```

**Solution:**

```javascript
{
  monorepo: {
    enabled: true,
    dependencyResolutionStrategy: 'auto' // Auto-detects pnpm
  }
}
```

## Performance Issues

### Generation is slow

**Problem:** Generation takes too long.

**Solutions:**

1. **Use specific targets instead of patterns:**

   ```javascript
   // ❌ Slow - scans everything
   patterns: ['**/*.ts'];

   // ✅ Fast - specific files and types
   targets: [
     { file: './src/types/user.ts', types: ['User'] },
     { file: './src/types/product.ts', types: ['Product'] },
   ];
   ```

2. **Exclude unnecessary files:**

   ```javascript
   {
     patterns: ['./src/models/**/*.ts'],
     exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
   }
   ```

3. **Enable caching:** Caching is enabled by default. Clear if issues:
   ```bash
   rm -rf node_modules/.cache/fluent-gen-ts
   ```

### Large generated files

**Problem:** Generated builder files are huge.

**Solutions:**

1. **Split types into smaller interfaces:**

   ```typescript
   // Instead of one huge interface:
   interface User {
     // 50+ properties
   }

   // Split into:
   interface User {
     id: string;
     profile: UserProfile;
     settings: UserSettings;
   }
   ```

2. **Disable comments for smaller files:**

   ```javascript
   {
     generator: {
       addComments: false; // Smaller files
     }
   }
   ```

3. **Reduce complexity by splitting nested types**

## Runtime Errors

### Builder method not found

**Error:**

```typescript
user().withEmail('test'); // Error: withEmail is not a function
```

**Solutions:**

1. **Regenerate builders:**

   ```bash
   npx fluent-gen-ts batch
   ```

2. **Check TypeScript compilation:**

   ```bash
   npx tsc --noEmit
   ```

3. **Verify imports:**

   ```typescript
   // ✅ Import from generated file
   import { user } from './builders/user.builder.js';

   // ❌ Not from original type file
   import { User } from './types/user.ts';
   ```

### Validation errors not thrown

**Problem:** Plugin validation doesn't execute.

**Solution:**

Verify plugin is loaded and condition matches:

```typescript
.when(ctx => {
  console.log('Checking property:', ctx.property.name);
  return ctx.property.name === 'email';
})
.setValidator(`
  console.log('Validating:', value);
  if (!value.includes('@')) throw new Error('Invalid');
`)
.done()
```

## Getting More Help

### Enable Verbose Logging

```bash
npx fluent-gen-ts batch --verbose
```

### Check Generated Code

```bash
# View generated builder
cat ./src/builders/user.builder.ts

# Check imports
head -n 20 ./src/builders/user.builder.ts
```

### Scan for Available Types

```bash
# See what types are found
npx fluent-gen-ts scan "src/**/*.ts"

# Output as JSON for processing
npx fluent-gen-ts scan "src/**/*.ts" --json
```

## Still Stuck?

1. **Check [FAQ](/guide/faq)** - Common questions
2. **Search
   [GitHub Issues](https://github.com/rafbcampos/fluent-gen-ts/issues)**
3. **Ask in
   [Discussions](https://github.com/rafbcampos/fluent-gen-ts/discussions)**
4. **Open a
   [new issue](https://github.com/rafbcampos/fluent-gen-ts/issues/new)** with:
   - Error message
   - Config file
   - Type definition
   - Generated code (if applicable)
   - Steps to reproduce
