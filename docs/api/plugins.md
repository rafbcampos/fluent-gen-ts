# Plugin System

Fluent Gen TS features a comprehensive plugin architecture that allows you to
customize every aspect of the type analysis and code generation process. The
plugin system provides 12 different hooks covering parsing, resolution,
generation, and transformation phases.

## Plugin Architecture

The plugin system follows a microkernel architecture where the core provides
basic functionality and plugins extend it:

```
┌─────────────────────────────────────────────────────┐
│                  PluginManager                      │
│               (Plugin Registry)                     │
├─────────────────────────────────────────────────────┤
│   Parse Hooks  │ Resolve Hooks │ Generate Hooks     │
├─────────────────────────────────────────────────────┤
│         Transform Hooks │ Custom Method Hooks      │
├─────────────────────────────────────────────────────┤
│             Core Fluent Gen Pipeline               │
└─────────────────────────────────────────────────────┘
```

## Plugin Interface

### Basic Plugin Structure

```typescript
interface Plugin {
  readonly name: string; // Unique plugin identifier
  readonly version: string; // Plugin version (semantic versioning)
  readonly imports?: PluginImports; // Import dependencies

  // Hook implementations (all optional)
  beforeParse?: (context: ParseContext) => Result<ParseContext>;
  afterParse?: (context: ParseContext, type: Type) => Result<Type>;
  beforeResolve?: (context: ResolveContext) => Result<ResolveContext>;
  afterResolve?: (
    context: ResolveContext,
    typeInfo: TypeInfo,
  ) => Result<TypeInfo>;
  beforeGenerate?: (context: GenerateContext) => Result<GenerateContext>;
  afterGenerate?: (code: string, context: GenerateContext) => Result<string>;
  transformType?: (type: Type, typeInfo: TypeInfo) => Result<TypeInfo>;
  transformProperty?: (property: PropertyInfo) => Result<PropertyInfo>;
  transformBuildMethod?: (context: BuildMethodContext) => Result<string>;
  transformPropertyMethod?: (
    context: PropertyMethodContext,
  ) => Result<PropertyMethodTransform>;
  addCustomMethods?: (
    context: BuilderContext,
  ) => Result<readonly CustomMethod[]>;
  transformValue?: (context: ValueContext) => Result<ValueTransform | null>;
}

interface PluginImports {
  readonly runtime?: readonly string[]; // Runtime imports needed
  readonly types?: readonly string[]; // Type imports needed
}
```

## PluginManager Class

The central registry for managing plugins:

### Constructor

```typescript
constructor();
```

Creates a new plugin manager instance.

### Core Methods

#### register()

Registers a plugin with the manager:

```typescript
register(plugin: Plugin): void
```

**Example:**

```typescript
import { PluginManager } from 'fluent-gen-ts';

const pluginManager = new PluginManager();

const validationPlugin: Plugin = {
  name: 'validation-plugin',
  version: '1.0.0',
  transformProperty: property => {
    // Add validation logic
    return ok(property);
  },
};

pluginManager.register(validationPlugin);
```

**Validation:**

- Plugin names must be unique
- Throws error if plugin with same name already registered
- Validates plugin structure

#### unregister()

Removes a plugin from the manager:

```typescript
unregister(name: string): boolean
```

**Returns:** `true` if plugin was found and removed, `false` otherwise

**Example:**

```typescript
const removed = pluginManager.unregister('validation-plugin');
console.log('Plugin removed:', removed);
```

#### executeHook()

Executes a specific hook across all registered plugins:

```typescript
async executeHook<K extends HookType>(
  options: ExecuteHookOptions<K>
): Promise<Result<GetHookReturnType<K>>>
```

This method is used internally by the system but can be called directly for
testing.

## Hook Types and Contexts

### HookType Enum

```typescript
enum HookType {
  BeforeParse = 'beforeParse',
  AfterParse = 'afterParse',
  BeforeResolve = 'beforeResolve',
  AfterResolve = 'afterResolve',
  BeforeGenerate = 'beforeGenerate',
  AfterGenerate = 'afterGenerate',
  TransformType = 'transformType',
  TransformProperty = 'transformProperty',
  TransformBuildMethod = 'transformBuildMethod',
  TransformPropertyMethod = 'transformPropertyMethod',
  AddCustomMethods = 'addCustomMethods',
  TransformValue = 'transformValue',
}
```

### Context Interfaces

#### Parse Contexts

```typescript
interface ParseContext {
  readonly sourceFile: string; // Path to source file
  readonly typeName: string; // Type being parsed
}
```

#### Resolve Contexts

```typescript
interface ResolveContext {
  readonly type: Type; // ts-morph Type object
  readonly symbol?: Symbol; // TypeScript symbol
  readonly sourceFile?: string; // Source file path
  readonly typeName?: string; // Type name being resolved
}
```

#### Generate Contexts

```typescript
interface GenerateContext {
  readonly resolvedType: ResolvedType; // Complete type information
  readonly options: Record<string, unknown>; // Generation options
}
```

#### Builder Contexts

```typescript
interface BuilderContext extends BaseBuilderContext, BaseGenericsContext {
  readonly properties: readonly PropertyInfo[];
}

interface BaseBuilderContext extends BaseTypeContext {
  readonly builderName: string; // Generated builder name
}

interface BaseTypeContext {
  readonly typeName: string; // Original type name
  readonly typeInfo: TypeInfo; // Type structure
}

interface BaseGenericsContext {
  readonly genericParams: string; // Generic parameter string
  readonly genericConstraints: string; // Generic constraints
}
```

#### Method Contexts

```typescript
interface BuildMethodContext extends BaseBuilderContext, BaseGenericsContext {
  readonly buildMethodCode: string; // Generated build method
  readonly properties: readonly PropertyInfo[];
  readonly options: GeneratorOptions;
  readonly resolvedType: ResolvedType;
}

interface PropertyMethodContext extends BaseBuilderContext {
  readonly property: PropertyInfo; // Property being processed
  readonly originalType: string; // Original TypeScript type string
}
```

#### Value Contexts

```typescript
interface ValueContext {
  readonly property: string; // Property name
  readonly valueVariable: string; // Variable name for value
  readonly type: TypeInfo; // Property type
  readonly isOptional: boolean; // Whether property is optional
}
```

## Plugin Development Guide

### Basic Plugin

```typescript
import type { Plugin } from 'fluent-gen-ts';
import { ok } from 'fluent-gen-ts';

const basicPlugin: Plugin = {
  name: 'basic-example',
  version: '1.0.0',

  beforeGenerate: context => {
    console.log(`Generating builder for: ${context.resolvedType.name}`);
    return ok(context);
  },

  afterGenerate: (code, context) => {
    console.log(
      `Generated ${code.length} characters for ${context.resolvedType.name}`,
    );
    return ok(code);
  },
};
```

### Property Transformation Plugin

```typescript
const propertyTransformPlugin: Plugin = {
  name: 'property-transformer',
  version: '1.0.0',

  transformProperty: property => {
    // Add validation for required properties
    if (!property.optional && property.type.kind === TypeKind.Primitive) {
      const transformedProperty: PropertyInfo = {
        ...property,
        jsDoc: `${property.jsDoc || ''}\n@required This field is required.`,
      };
      return ok(transformedProperty);
    }

    return ok(property);
  },
};
```

### Custom Methods Plugin

```typescript
const customMethodsPlugin: Plugin = {
  name: 'custom-methods',
  version: '1.0.0',

  addCustomMethods: context => {
    const customMethods: CustomMethod[] = [
      {
        name: 'reset',
        signature: 'reset(): this',
        implementation: `
          Object.keys(this).forEach(key => {
            if (key.startsWith('_')) delete this[key];
          });
          return this;
        `,
        jsDoc: '/**\n * Resets all builder properties to undefined\n */',
      },
      {
        name: 'clone',
        signature: 'clone(): typeof this',
        implementation: `
          const cloned = Object.create(Object.getPrototypeOf(this));
          Object.assign(cloned, this);
          return cloned;
        `,
        jsDoc: '/**\n * Creates a copy of this builder\n */',
      },
    ];

    return ok(customMethods);
  },
};

interface CustomMethod {
  readonly name: string;
  readonly signature: string;
  readonly implementation: string;
  readonly jsDoc?: string;
}
```

### Property Method Transformation Plugin

```typescript
const propertyMethodPlugin: Plugin = {
  name: 'property-method-transformer',
  version: '1.0.0',

  transformPropertyMethod: context => {
    // Add validation for email properties
    if (context.property.name === 'email') {
      const transform: PropertyMethodTransform = {
        parameterType: 'string',
        validate: `
          if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(${context.property.name})) {
            throw new Error('Invalid email format');
          }
        `,
        extractValue: context.property.name,
      };
      return ok(transform);
    }

    return ok({});
  },
};

interface PropertyMethodTransform {
  readonly parameterType?: string; // Override parameter type
  readonly extractValue?: string; // Value extraction logic
  readonly validate?: string; // Validation code
}
```

### Value Transformation Plugin

```typescript
const valueTransformPlugin: Plugin = {
  name: 'value-transformer',
  version: '1.0.0',

  transformValue: context => {
    // Transform dates to ISO strings
    if (
      context.type.kind === TypeKind.Reference &&
      context.type.name === 'Date'
    ) {
      const transform: ValueTransform = {
        condition: `${context.valueVariable} instanceof Date`,
        transform: `${context.valueVariable}.toISOString()`,
      };
      return ok(transform);
    }

    return ok(null); // No transformation
  },
};

interface ValueTransform {
  readonly condition?: string; // When to apply transform
  readonly transform: string; // Transformation expression
}
```

### Type Transformation Plugin

```typescript
const typeTransformPlugin: Plugin = {
  name: 'type-transformer',
  version: '1.0.0',

  transformType: (type, typeInfo) => {
    // Convert string literals to branded types
    if (
      typeInfo.kind === TypeKind.Primitive &&
      typeInfo.name === 'string' &&
      typeInfo.literal
    ) {
      const brandedType: TypeInfo = {
        kind: TypeKind.Reference,
        name: `Branded<string, '${typeInfo.literal}'>`,
      };
      return ok(brandedType);
    }

    return ok(typeInfo);
  },
};
```

### Plugin with Dependencies

```typescript
const dependentPlugin: Plugin = {
  name: 'dependent-plugin',
  version: '1.0.0',
  imports: {
    runtime: ['zod'], // Runtime dependencies
    types: ['@types/uuid'], // Type dependencies
  },

  transformProperty: property => {
    // Add Zod validation for string properties
    if (
      property.type.kind === TypeKind.Primitive &&
      property.type.name === 'string'
    ) {
      const enhanced: PropertyInfo = {
        ...property,
        jsDoc: `${property.jsDoc || ''}\n@validation z.string()`,
      };
      return ok(enhanced);
    }

    return ok(property);
  },
};
```

## Plugin Registration Patterns

### With FluentGen

```typescript
import { FluentGen } from 'fluent-gen-ts';

const generator = new FluentGen();

const result = generator.registerPlugin(myPlugin);
if (!result.ok) {
  console.error('Plugin registration failed:', result.error.message);
}
```

### With PluginManager

```typescript
import { PluginManager, FluentGen } from 'fluent-gen-ts';

const pluginManager = new PluginManager();
pluginManager.register(plugin1);
pluginManager.register(plugin2);

const generator = new FluentGen({
  pluginManager,
});
```

### Dynamic Plugin Loading

```typescript
async function loadPlugin(pluginPath: string): Promise<Plugin> {
  const pluginModule = await import(pluginPath);
  return pluginModule.default || pluginModule.plugin;
}

const plugin = await loadPlugin('./my-plugin.js');
pluginManager.register(plugin);
```

## Error Handling in Plugins

### Returning Errors

```typescript
const errorHandlingPlugin: Plugin = {
  name: 'error-example',
  version: '1.0.0',

  transformProperty: property => {
    try {
      // Risky operation
      const result = riskyTransformation(property);
      return ok(result);
    } catch (error) {
      return err(new Error(`Property transformation failed: ${error.message}`));
    }
  },
};
```

### Validation

```typescript
const validationPlugin: Plugin = {
  name: 'validator',
  version: '1.0.0',

  beforeGenerate: context => {
    if (!context.resolvedType.name) {
      return err(new Error('Type name is required'));
    }

    if (context.resolvedType.typeInfo.kind !== TypeKind.Object) {
      return err(new Error('Only object types are supported'));
    }

    return ok(context);
  },
};
```

## Plugin Execution Order

Plugins execute in registration order for each hook:

```typescript
pluginManager.register(pluginA); // Executes first
pluginManager.register(pluginB); // Executes second
pluginManager.register(pluginC); // Executes third
```

The output of one plugin becomes the input to the next:

```
Input → PluginA → PluginB → PluginC → Output
```

## Testing Plugins

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { ok } from 'fluent-gen-ts';

describe('MyPlugin', () => {
  it('should transform string properties', () => {
    const property: PropertyInfo = {
      name: 'test',
      type: { kind: TypeKind.Primitive, name: 'string' },
      optional: false,
      readonly: false,
    };

    const result = myPlugin.transformProperty!(property);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jsDoc).toContain('validation');
    }
  });
});
```

### Integration Testing

```typescript
import { PluginManager, TypeExtractor } from 'fluent-gen-ts';

describe('Plugin Integration', () => {
  it('should work with type extraction', async () => {
    const pluginManager = new PluginManager();
    pluginManager.register(myPlugin);

    const extractor = new TypeExtractor({ pluginManager });
    const result = await extractor.extractType('./test-types.ts', 'TestType');

    expect(result.ok).toBe(true);
  });
});
```

## Performance Considerations

### Efficient Plugins

```typescript
// Good: Early returns
const efficientPlugin: Plugin = {
  name: 'efficient',
  version: '1.0.0',

  transformProperty: property => {
    // Early return for non-relevant properties
    if (property.type.kind !== TypeKind.Primitive) {
      return ok(property);
    }

    // Only process what's needed
    if (property.name === 'id') {
      return ok({ ...property, readonly: true });
    }

    return ok(property);
  },
};

// Bad: Unnecessary processing
const inefficientPlugin: Plugin = {
  name: 'inefficient',
  version: '1.0.0',

  transformProperty: property => {
    // Always creates new object even when no changes needed
    const transformed = JSON.parse(JSON.stringify(property));

    if (property.name === 'id') {
      transformed.readonly = true;
    }

    return ok(transformed);
  },
};
```

### Caching in Plugins

```typescript
const cachingPlugin: Plugin = {
  name: 'caching-plugin',
  version: '1.0.0',

  transformProperty: (() => {
    const cache = new Map<string, PropertyInfo>();

    return (property: PropertyInfo) => {
      const key = `${property.name}:${property.type.kind}`;

      if (cache.has(key)) {
        return ok(cache.get(key)!);
      }

      const transformed = expensiveTransformation(property);
      cache.set(key, transformed);

      return ok(transformed);
    };
  })(),
};
```

## Best Practices

### Plugin Structure

1. **Single Responsibility**: Each plugin should have one clear purpose
2. **Immutable Transformations**: Don't modify input objects directly
3. **Error Handling**: Always return `Result<T>` types
4. **Documentation**: Include JSDoc comments
5. **Versioning**: Follow semantic versioning

### Naming Conventions

```typescript
// Good naming
const emailValidationPlugin: Plugin = {
  name: 'email-validation',
  version: '1.0.0',
  // ...
};

// Bad naming
const plugin1: Plugin = {
  name: 'p1',
  version: '1',
  // ...
};
```

### Configuration

```typescript
interface PluginConfig {
  readonly enabled: boolean;
  readonly options: Record<string, unknown>;
}

function createConfigurablePlugin(config: PluginConfig): Plugin {
  return {
    name: 'configurable-plugin',
    version: '1.0.0',

    transformProperty: property => {
      if (!config.enabled) {
        return ok(property);
      }

      // Apply transformations based on config.options
      return ok(transformWithOptions(property, config.options));
    },
  };
}
```

## Next Steps

- [Generator Functions Documentation](./generator.md) - Using plugins in
  generation
- [Type Resolution System](./resolver.md) - Plugins in type resolution
- [CLI Usage](../guide/cli.md) - Command-line plugin usage
