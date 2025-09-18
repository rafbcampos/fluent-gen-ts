# Plugin System

Fluent Gen features an extensive plugin architecture that allows you to customize every aspect of the type analysis and code generation process. Plugins can hook into 11 different points in the pipeline to modify behavior, transform data, and extend functionality.

## Plugin Architecture

The plugin system follows a microkernel architecture where the core provides the basic functionality and plugins extend it:

```
┌─────────────────────────────────────────────────────┐
│                  Plugin Manager                     │
├─────────────────────────────────────────────────────┤
│  Parsing    │  Resolution │  Generation │  Transform │
│  Hooks      │  Hooks      │  Hooks      │  Hooks     │
├─────────────┼─────────────┼─────────────┼──────────┤
│             Core Fluent Gen Pipeline               │
└─────────────────────────────────────────────────────┘
```

## Plugin Interface

### Basic Plugin Structure

```typescript
interface Plugin {
  name: string;              // Unique plugin identifier
  version?: string;          // Plugin version (semantic versioning)
  description?: string;      // Plugin description
  author?: string;          // Plugin author
  hooks: PluginHooks;       // Hook implementations
  config?: PluginConfig;    // Plugin configuration
  dependencies?: string[];   // Required plugin dependencies
}

interface PluginConfig {
  [key: string]: any;
}
```

### Plugin Hooks

Fluent Gen provides 11 different hook types for maximum customization:

```typescript
interface PluginHooks {
  // Parsing hooks
  beforeParsing?: BeforeParsingHook;
  afterParsing?: AfterParsingHook;

  // Type resolution hooks
  beforeResolving?: BeforeResolvingHook;
  afterResolving?: AfterResolvingHook;

  // Code generation hooks
  beforeGeneration?: BeforeGenerationHook;
  afterGeneration?: AfterGenerationHook;

  // Property-level hooks
  beforePropertyGeneration?: BeforePropertyGenerationHook;
  afterPropertyGeneration?: AfterPropertyGenerationHook;

  // Method-level hooks
  beforeMethodGeneration?: BeforeMethodGenerationHook;
  afterMethodGeneration?: AfterMethodGenerationHook;

  // Transformation hooks
  importTransform?: ImportTransformHook;
  valueTransform?: ValueTransformHook;
}
```

## Hook Types and Usage

### Parsing Hooks

**BeforeParsingHook**: Executed before TypeScript file parsing

```typescript
type BeforeParsingHook = (
  context: ParseContext
) => ParseContext | Promise<ParseContext>;

interface ParseContext {
  filePath: string;
  content: string;
  compilerOptions: CompilerOptions;
  plugins: Plugin[];
}

// Example: Add custom compiler options
const preprocessorPlugin: Plugin = {
  name: 'typescript-preprocessor',
  hooks: {
    beforeParsing: (context) => {
      return {
        ...context,
        compilerOptions: {
          ...context.compilerOptions,
          strictNullChecks: true,
          exactOptionalPropertyTypes: true
        }
      };
    }
  }
};
```

**AfterParsingHook**: Executed after parsing completes

```typescript
type AfterParsingHook = (
  context: ParseContext,
  result: ParseResult
) => ParseResult | Promise<ParseResult>;

interface ParseResult {
  sourceFile: SourceFile;
  declarations: TypeDeclaration[];
  exports: ExportInfo[];
  imports: ImportInfo[];
}

// Example: Filter declarations
const filterPlugin: Plugin = {
  name: 'declaration-filter',
  hooks: {
    afterParsing: (context, result) => {
      return {
        ...result,
        declarations: result.declarations.filter(
          decl => !decl.name.startsWith('_') // Exclude private declarations
        )
      };
    }
  }
};
```

### Type Resolution Hooks

**BeforeResolvingHook**: Executed before type resolution

```typescript
type BeforeResolvingHook = (
  context: ResolutionContext
) => ResolutionContext | Promise<ResolutionContext>;

interface ResolutionContext {
  typeName: string;
  filePath: string;
  typeNode: TypeNode;
  scope: ResolutionScope;
  cache: TypeResolutionCache;
  plugins: Plugin[];
}

// Example: Modify resolution scope
const scopePlugin: Plugin = {
  name: 'custom-scope',
  hooks: {
    beforeResolving: (context) => {
      return {
        ...context,
        scope: {
          ...context.scope,
          followImports: true,
          maxDepth: 20
        }
      };
    }
  }
};
```

**AfterResolvingHook**: Executed after type resolution

```typescript
type AfterResolvingHook = (
  context: ResolutionContext,
  typeInfo: TypeInfo
) => TypeInfo | Promise<TypeInfo>;

// Example: Add metadata to resolved types
const metadataPlugin: Plugin = {
  name: 'type-metadata',
  hooks: {
    afterResolving: (context, typeInfo) => {
      return {
        ...typeInfo,
        metadata: {
          resolvedAt: new Date(),
          resolvedFrom: context.filePath,
          plugin: 'type-metadata'
        }
      };
    }
  }
};
```

### Code Generation Hooks

**BeforeGenerationHook**: Executed before code generation

```typescript
type BeforeGenerationHook = (
  context: GenerationContext
) => GenerationContext | Promise<GenerationContext>;

interface GenerationContext {
  typeName: string;
  typeInfo: TypeInfo;
  config: GeneratorConfig;
  imports: ImportInfo[];
  plugins: Plugin[];
  outputPath?: string;
}

// Example: Modify generation configuration
const configPlugin: Plugin = {
  name: 'custom-config',
  hooks: {
    beforeGeneration: (context) => {
      return {
        ...context,
        config: {
          ...context.config,
          addComments: true,
          indentSize: 4
        }
      };
    }
  }
};
```

**AfterGenerationHook**: Executed after code generation

```typescript
type AfterGenerationHook = (
  context: GenerationContext,
  code: string
) => string | Promise<string>;

// Example: Add custom header
const headerPlugin: Plugin = {
  name: 'file-header',
  hooks: {
    afterGeneration: (context, code) => {
      const header = `/**
 * Generated builder for ${context.typeName}
 * Created: ${new Date().toISOString()}
 * Generator: Fluent Gen
 */

`;
      return header + code;
    }
  }
};
```

### Property-Level Hooks

**BeforePropertyGenerationHook**: Executed before generating each property method

```typescript
type BeforePropertyGenerationHook = (
  context: PropertyContext,
  property: PropertyInfo
) => PropertyInfo | Promise<PropertyInfo>;

interface PropertyContext {
  typeName: string;
  propertyName: string;
  parentContext: GenerationContext;
  depth: number;
}

// Example: Add validation to properties
const validationPlugin: Plugin = {
  name: 'property-validation',
  hooks: {
    beforePropertyGeneration: (context, property) => {
      if (property.type.kind === 'primitive' && property.type.name === 'string') {
        return {
          ...property,
          validators: ['required', 'string'],
          jsDoc: property.jsDoc + '\n@validation required, string'
        };
      }
      return property;
    }
  }
};
```

**AfterPropertyGenerationHook**: Executed after generating each property method

```typescript
type AfterPropertyGenerationHook = (
  context: PropertyContext,
  property: PropertyInfo,
  method: MethodDeclaration
) => MethodDeclaration | Promise<MethodDeclaration>;

// Example: Add JSDoc to methods
const jsdocPlugin: Plugin = {
  name: 'method-jsdoc',
  hooks: {
    afterPropertyGeneration: (context, property, method) => {
      const jsdoc = `/**
 * Set ${property.name} property
 * @param value The ${property.name} value
 * @returns Builder instance for chaining
 */`;

      return {
        ...method,
        jsDoc: jsdoc
      };
    }
  }
};
```

### Method-Level Hooks

**BeforeMethodGenerationHook**: Executed before generating individual methods

```typescript
type BeforeMethodGenerationHook = (
  context: MethodContext,
  methodInfo: MethodInfo
) => MethodInfo | Promise<MethodInfo>;

interface MethodContext {
  methodName: string;
  methodType: 'with' | 'build' | 'clone' | 'custom';
  propertyContext?: PropertyContext;
  generationContext: GenerationContext;
}

interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: TypeInfo;
  body?: string;
  jsDoc?: string;
}
```

**AfterMethodGenerationHook**: Executed after generating individual methods

```typescript
type AfterMethodGenerationHook = (
  context: MethodContext,
  methodInfo: MethodInfo,
  generatedCode: string
) => string | Promise<string>;

// Example: Add logging to methods
const loggingPlugin: Plugin = {
  name: 'method-logging',
  hooks: {
    afterMethodGeneration: (context, methodInfo, code) => {
      if (context.methodType === 'with') {
        const logStatement = `console.log('Setting ${methodInfo.name}:', value);`;
        return code.replace(
          'return new',
          `${logStatement}\n    return new`
        );
      }
      return code;
    }
  }
};
```

### Transformation Hooks

**ImportTransformHook**: Transform import statements

```typescript
type ImportTransformHook = (
  imports: ImportInfo[],
  context: GenerationContext
) => ImportInfo[] | Promise<ImportInfo[]>;

interface ImportInfo {
  module: string;
  imports: string[];
  isTypeOnly: boolean;
  alias?: string;
}

// Example: Add custom imports
const customImportsPlugin: Plugin = {
  name: 'custom-imports',
  hooks: {
    importTransform: (imports, context) => {
      return [
        ...imports,
        {
          module: '@/utils/validation',
          imports: ['validate'],
          isTypeOnly: false
        }
      ];
    }
  }
};
```

**ValueTransformHook**: Transform property values

```typescript
type ValueTransformHook = (
  value: any,
  property: PropertyInfo,
  context: PropertyContext
) => any | Promise<any>;

// Example: Transform date values
const dateTransformPlugin: Plugin = {
  name: 'date-transform',
  hooks: {
    valueTransform: (value, property, context) => {
      if (property.type.kind === 'primitive' &&
          property.type.name === 'Date' &&
          typeof value === 'string') {
        return new Date(value);
      }
      return value;
    }
  }
};
```

## Plugin Registration

### Programmatic Registration

```typescript
import { FluentGen } from 'fluent-gen';

const generator = new FluentGen();

// Register a single plugin
generator.registerPlugin({
  name: 'my-plugin',
  hooks: {
    beforeGeneration: (context) => {
      console.log('Generating for:', context.typeName);
      return context;
    }
  }
});

// Register multiple plugins
const plugins = [plugin1, plugin2, plugin3];
plugins.forEach(plugin => generator.registerPlugin(plugin));
```

### Configuration File Registration

```json
{
  "generator": {
    "outputDir": "./src/builders"
  },
  "plugins": [
    "./plugins/validation-plugin.js",
    "./plugins/logging-plugin.js",
    "@company/fluent-gen-plugin-auth",
    {
      "path": "./plugins/custom-plugin.js",
      "config": {
        "enabled": true,
        "options": {
          "strict": true
        }
      }
    }
  ]
}
```

### Dynamic Plugin Loading

```typescript
// Load plugin from file
async function loadPlugin(pluginPath: string): Promise<Plugin> {
  const pluginModule = await import(pluginPath);
  return pluginModule.default || pluginModule;
}

// Load and register
const plugin = await loadPlugin('./plugins/my-plugin.js');
generator.registerPlugin(plugin);
```

## Creating Custom Plugins

### Simple Plugin Example

```typescript
// plugins/string-transformer.js
const stringTransformerPlugin = {
  name: 'string-transformer',
  version: '1.0.0',
  description: 'Transforms string properties to include validation',

  hooks: {
    beforePropertyGeneration: (context, property) => {
      if (property.type.kind === 'primitive' && property.type.name === 'string') {
        return {
          ...property,
          jsDoc: `${property.jsDoc || ''}\n@validation String property with length validation`
        };
      }
      return property;
    },

    afterPropertyGeneration: (context, property, method) => {
      if (property.type.kind === 'primitive' && property.type.name === 'string') {
        // Add validation logic to the method
        return {
          ...method,
          body: method.body?.replace(
            'return new',
            `if (typeof value !== 'string') throw new Error('Value must be a string');
             return new`
          )
        };
      }
      return method;
    }
  }
};

module.exports = stringTransformerPlugin;
```

### Advanced Plugin with Configuration

```typescript
// plugins/validation-plugin.ts
interface ValidationConfig {
  enableStringValidation: boolean;
  enableNumberValidation: boolean;
  throwOnInvalid: boolean;
  customValidators: Record<string, (value: any) => boolean>;
}

function createValidationPlugin(config: ValidationConfig): Plugin {
  return {
    name: 'advanced-validation',
    version: '2.1.0',
    config,

    hooks: {
      beforePropertyGeneration: (context, property) => {
        const validators: string[] = [];

        if (property.type.kind === 'primitive') {
          switch (property.type.name) {
            case 'string':
              if (config.enableStringValidation) {
                validators.push('string');
              }
              break;
            case 'number':
              if (config.enableNumberValidation) {
                validators.push('number');
              }
              break;
          }
        }

        if (validators.length > 0) {
          return {
            ...property,
            validators,
            jsDoc: `${property.jsDoc || ''}\n@validation ${validators.join(', ')}`
          };
        }

        return property;
      },

      afterMethodGeneration: (context, methodInfo, code) => {
        if (context.methodType === 'with' && context.propertyContext) {
          const property = context.propertyContext;
          const validators = (property as any).validators;

          if (validators?.length > 0) {
            const validationCode = generateValidationCode(
              validators,
              config.throwOnInvalid
            );

            return code.replace(
              'return new',
              `${validationCode}\n    return new`
            );
          }
        }

        return code;
      }
    }
  };
}

function generateValidationCode(validators: string[], throwOnInvalid: boolean): string {
  const checks = validators.map(validator => {
    switch (validator) {
      case 'string':
        return 'typeof value === "string"';
      case 'number':
        return 'typeof value === "number" && !isNaN(value)';
      default:
        return 'true';
    }
  }).join(' && ');

  const action = throwOnInvalid
    ? 'throw new Error(`Validation failed for ${methodInfo.name}`);'
    : 'console.warn(`Validation failed for ${methodInfo.name}`);';

  return `if (!(${checks})) { ${action} }`;
}

export default createValidationPlugin;
```

### Plugin with Dependencies

```typescript
// plugins/database-plugin.ts
const databasePlugin: Plugin = {
  name: 'database-integration',
  version: '1.0.0',
  dependencies: ['validation', 'logging'], // Requires these plugins

  hooks: {
    afterGeneration: async (context, code) => {
      // Add database integration methods
      const dbMethods = `

  // Database integration methods
  async save(): Promise<${context.typeName}> {
    const data = this.build();
    return await database.save('${context.typeName.toLowerCase()}', data);
  }

  static async findById(id: string): Promise<${context.typeName} | null> {
    const data = await database.findById('${context.typeName.toLowerCase()}', id);
    return data ? ${context.typeName.toLowerCase()}Builder().merge(data).build() : null;
  }`;

      return code.replace(
        /}(\s*)$/, // Replace closing brace at end
        `${dbMethods}\n}$1`
      );
    }
  }
};
```

## Built-in Plugins

Fluent Gen comes with several built-in plugins:

### ValidationPlugin

Adds runtime validation to generated builders:

```typescript
import { ValidationPlugin } from 'fluent-gen/plugins';

const generator = new FluentGen();
generator.registerPlugin(ValidationPlugin({
  enableStringValidation: true,
  enableNumberValidation: true,
  throwOnInvalid: false
}));
```

### LoggingPlugin

Adds logging to builder operations:

```typescript
import { LoggingPlugin } from 'fluent-gen/plugins';

generator.registerPlugin(LoggingPlugin({
  logLevel: 'debug',
  logMethods: ['with', 'build'],
  includeValues: true
}));
```

### ImmutabilityPlugin

Ensures immutable builder operations:

```typescript
import { ImmutabilityPlugin } from 'fluent-gen/plugins';

generator.registerPlugin(ImmutabilityPlugin({
  deepFreeze: true,
  preventMutation: true
}));
```

### SerializationPlugin

Adds serialization methods to builders:

```typescript
import { SerializationPlugin } from 'fluent-gen/plugins';

generator.registerPlugin(SerializationPlugin({
  includeToJSON: true,
  includeFromJSON: true,
  includeToYAML: false
}));
```

## Plugin Best Practices

### 1. Plugin Structure

```typescript
// Good plugin structure
const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Clear description of what the plugin does',
  author: 'Your Name <email@example.com>',

  hooks: {
    // Only implement hooks you need
    beforeGeneration: (context) => {
      // Clear, focused functionality
      return context;
    }
  },

  config: {
    // Sensible defaults
    enabled: true,
    strictMode: false
  }
};
```

### 2. Error Handling

```typescript
const robustPlugin: Plugin = {
  name: 'robust-plugin',
  hooks: {
    afterGeneration: async (context, code) => {
      try {
        // Plugin logic here
        return await processCode(code);
      } catch (error) {
        console.warn(`Plugin ${this.name} failed:`, error.message);
        // Return original code on failure
        return code;
      }
    }
  }
};
```

### 3. Configuration Validation

```typescript
function createMyPlugin(config: MyPluginConfig): Plugin {
  // Validate configuration
  if (!config.requiredOption) {
    throw new Error('requiredOption is required');
  }

  return {
    name: 'my-plugin',
    config,
    hooks: {
      // Implementation
    }
  };
}
```

### 4. Testing Plugins

```typescript
// plugin.test.ts
import { FluentGen } from 'fluent-gen';
import { myPlugin } from './my-plugin';

describe('MyPlugin', () => {
  it('should transform string properties', async () => {
    const generator = new FluentGen();
    generator.registerPlugin(myPlugin);

    const result = await generator.generateBuilder('./test-types.ts', 'TestType');

    expect(result.ok).toBe(true);
    expect(result.value).toContain('// Plugin transformation applied');
  });
});
```

## Plugin Development Tools

### Plugin Debugging

```typescript
const debugPlugin: Plugin = {
  name: 'debug-plugin',
  hooks: {
    beforeGeneration: (context) => {
      console.log('Generation context:', context);
      return context;
    },
    afterGeneration: (context, code) => {
      console.log('Generated code length:', code.length);
      return code;
    }
  }
};
```

### Plugin Performance Monitoring

```typescript
const performancePlugin: Plugin = {
  name: 'performance-monitor',
  hooks: {
    beforeGeneration: (context) => {
      console.time(`generation-${context.typeName}`);
      return context;
    },
    afterGeneration: (context, code) => {
      console.timeEnd(`generation-${context.typeName}`);
      return code;
    }
  }
};
```

### Plugin Composition

```typescript
// Combine multiple plugins
function createPluginSuite(config: PluginSuiteConfig): Plugin[] {
  return [
    ValidationPlugin(config.validation),
    LoggingPlugin(config.logging),
    SerializationPlugin(config.serialization)
  ];
}

// Usage
const plugins = createPluginSuite({
  validation: { enableStringValidation: true },
  logging: { logLevel: 'info' },
  serialization: { includeToJSON: true }
});

plugins.forEach(plugin => generator.registerPlugin(plugin));
```

## Publishing Plugins

### Package Structure

```
my-fluent-gen-plugin/
├── src/
│   ├── index.ts
│   ├── plugin.ts
│   └── types.ts
├── dist/
├── package.json
├── README.md
└── LICENSE
```

### Package.json

```json
{
  "name": "@yourorg/fluent-gen-plugin-name",
  "version": "1.0.0",
  "description": "Description of your plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["fluent-gen", "plugin", "typescript"],
  "peerDependencies": {
    "fluent-gen": "^1.0.0"
  },
  "fluent-gen": {
    "plugin": true
  }
}
```

### Plugin Registry

Plugins can be discovered and shared through:
- npm registry with `fluent-gen-plugin` keyword
- GitHub topics: `fluent-gen-plugin`
- Official plugin directory (coming soon)

## Next Steps

- [See plugin examples in GitHub](https://github.com/rafbcampos/fluent-gen/tree/main/examples/plugins)
- [Generator Functions Documentation](./generator.md)
- [Type Resolution System](./resolver.md)
- [Configuration Guide](../guide/configuration.md)