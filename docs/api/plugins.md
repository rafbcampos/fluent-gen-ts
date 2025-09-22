# Plugin System

Fluent Gen TS features a comprehensive plugin architecture that allows you to
customize every aspect of the type analysis and code generation process. The
plugin system provides 13 different hooks covering parsing, resolution,
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
  transformImports?: (
    context: ImportTransformContext,
  ) => Result<ImportTransformContext>;
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
  TransformImports = 'transformImports',
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
  readonly propertyType: TypeInfo; // Full type information
  readonly originalTypeString: string; // Original TypeScript type string

  // Type checking helper methods
  isType(kind: TypeKind): boolean;
  hasGenericConstraint(constraintName: string): boolean;
  isArrayType(): boolean;
  isUnionType(): boolean;
  isPrimitiveType(name?: string): boolean;
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

interface ImportTransformContext {
  readonly imports: readonly string[]; // Current import statements
  readonly resolvedType: ResolvedType; // Type being generated
  readonly isGeneratingMultiple: boolean; // Multiple file generation
  readonly hasExistingCommon: boolean; // Whether common.ts exists
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

### Property Method Transformation Plugin (Enhanced)

The enhanced `PropertyMethodContext` provides full type information and helper
methods for type-safe transformations:

```typescript
const enhancedPropertyMethodPlugin: Plugin = {
  name: 'enhanced-property-method-transformer',
  version: '2.0.0',

  transformPropertyMethod: context => {
    // Use type-aware helpers for precise transformations
    if (context.isPrimitiveType('string')) {
      // Handle string types with validation
      if (context.property.name === 'email') {
        return ok({
          parameterType: 'string',
          validate: `
            if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
              throw new Error('Invalid email format');
            }
          `,
          extractValue: 'value.trim().toLowerCase()',
        });
      }

      // Handle URLs
      if (
        context.property.name.includes('url') ||
        context.property.name.includes('Url')
      ) {
        return ok({
          parameterType: 'string | URL',
          extractValue: 'typeof value === "string" ? value : value.toString()',
          validate: `
            try {
              new URL(typeof value === "string" ? value : value.toString());
            } catch {
              throw new Error('Invalid URL format');
            }
          `,
        });
      }
    }

    // Handle array types with flexible input
    if (context.isArrayType()) {
      return ok({
        parameterType: `${context.originalTypeString} | readonly (${context.originalTypeString.replace('[]', '')}[])`,
        extractValue: 'Array.isArray(value) ? [...value] : value',
        validate:
          'if (!Array.isArray(value)) throw new Error("Expected array");',
      });
    }

    // Handle union types
    if (context.isUnionType()) {
      return ok({
        parameterType: context.originalTypeString,
        validate: `// Union type validation for ${context.property.name}`,
      });
    }

    // Handle number types with string coercion
    if (context.isPrimitiveType('number')) {
      return ok({
        parameterType: 'number | string',
        extractValue: 'typeof value === "string" ? Number(value) : value',
        validate: `
          const numValue = typeof value === "string" ? Number(value) : value;
          if (isNaN(numValue)) throw new Error('Invalid number');
        `,
      });
    }

    // Handle boolean types with flexible input
    if (context.isPrimitiveType('boolean')) {
      return ok({
        parameterType: 'boolean | string | number',
        extractValue: 'Boolean(value)',
      });
    }

    // Handle types with generic constraints
    if (context.hasGenericConstraint('Serializable')) {
      return ok({
        validate: `// Ensure ${context.property.name} is serializable`,
        extractValue: 'JSON.parse(JSON.stringify(value))',
      });
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

### Type-Aware Validation Plugin

```typescript
const typeAwareValidationPlugin: Plugin = {
  name: 'type-aware-validation',
  version: '1.0.0',

  transformPropertyMethod: context => {
    const validations: string[] = [];

    // Type-specific validations using helper methods
    if (context.isPrimitiveType('string') && !context.property.optional) {
      validations.push(
        'if (!value || value.trim().length === 0) throw new Error("String cannot be empty");',
      );
    }

    if (context.isArrayType() && !context.property.optional) {
      validations.push(
        'if (!value || value.length === 0) throw new Error("Array cannot be empty");',
      );
    }

    if (context.isPrimitiveType('number')) {
      validations.push(
        'if (typeof value === "number" && (value < 0 || !Number.isFinite(value))) throw new Error("Invalid number");',
      );
    }

    // Generic constraint-based validation
    if (context.hasGenericConstraint('NonNullable')) {
      validations.push(
        'if (value == null) throw new Error("Value cannot be null or undefined");',
      );
    }

    return validations.length > 0
      ? ok({ validate: validations.join('\n') })
      : ok({});
  },
};
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

### Import Transformation Plugin

The `transformImports` hook allows plugins to manipulate, organize, and optimize
import statements:

```typescript
const importOrganizerPlugin: Plugin = {
  name: 'import-organizer',
  version: '1.0.0',

  transformImports: context => {
    const { imports } = context;

    // Separate import types
    const typeImports: string[] = [];
    const runtimeImports: string[] = [];
    const localImports: string[] = [];
    const nodeModuleImports: string[] = [];

    imports.forEach(importStatement => {
      if (importStatement.includes('import type')) {
        typeImports.push(importStatement);
      } else if (
        importStatement.includes('from "./') ||
        importStatement.includes('from "../')
      ) {
        localImports.push(importStatement);
      } else if (
        importStatement.includes('from "') &&
        !importStatement.includes('from "node:')
      ) {
        nodeModuleImports.push(importStatement);
      } else {
        runtimeImports.push(importStatement);
      }
    });

    // Sort each category alphabetically
    const organizedImports = [
      ...nodeModuleImports.sort(),
      ...runtimeImports.sort(),
      ...typeImports.sort(),
      ...localImports.sort(),
    ].filter(Boolean);

    return ok({
      ...context,
      imports: organizedImports,
    });
  },
};
```

### Import Grouping and Formatting Plugin

```typescript
const importFormatterPlugin: Plugin = {
  name: 'import-formatter',
  version: '1.0.0',

  transformImports: context => {
    const { imports, isGeneratingMultiple } = context;

    // Group imports by source
    const importGroups = new Map<string, string[]>();

    imports.forEach(importStatement => {
      const match = importStatement.match(/from ["']([^"']+)["']/);
      if (match) {
        const source = match[1];
        const category = getImportCategory(source);

        if (!importGroups.has(category)) {
          importGroups.set(category, []);
        }
        importGroups.get(category)!.push(importStatement);
      }
    });

    // Format with proper spacing and comments
    const formattedImports: string[] = [];

    // Add header comment for multiple file generation
    if (isGeneratingMultiple) {
      formattedImports.push('// External dependencies');
    }

    // Node modules first
    if (importGroups.has('external')) {
      formattedImports.push(...importGroups.get('external')!.sort());
      formattedImports.push(''); // Empty line
    }

    // Built-in Node.js modules
    if (importGroups.has('builtin')) {
      formattedImports.push('// Node.js built-ins');
      formattedImports.push(...importGroups.get('builtin')!.sort());
      formattedImports.push('');
    }

    // Type imports
    if (importGroups.has('types')) {
      formattedImports.push('// Type imports');
      formattedImports.push(...importGroups.get('types')!.sort());
      formattedImports.push('');
    }

    // Local imports last
    if (importGroups.has('local')) {
      formattedImports.push('// Local imports');
      formattedImports.push(...importGroups.get('local')!.sort());
    }

    return ok({
      ...context,
      imports: formattedImports.filter(line => line !== ''), // Remove empty trailing lines
    });
  },
};

function getImportCategory(source: string): string {
  if (
    source.startsWith('node:') ||
    ['fs', 'path', 'url', 'crypto'].includes(source)
  ) {
    return 'builtin';
  }
  if (source.startsWith('./') || source.startsWith('../')) {
    return 'local';
  }
  if (source.startsWith('@types/')) {
    return 'types';
  }
  return 'external';
}
```

### Import Optimization Plugin

```typescript
const importOptimizerPlugin: Plugin = {
  name: 'import-optimizer',
  version: '1.0.0',

  transformImports: context => {
    const { imports, hasExistingCommon } = context;

    // Remove duplicate imports
    const uniqueImports = Array.from(new Set(imports));

    // Merge imports from the same source
    const mergedImports = new Map<string, Set<string>>();

    uniqueImports.forEach(importStatement => {
      const match = importStatement.match(
        /import\s+(?:type\s+)?(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+["']([^"']+)["']/,
      );

      if (match) {
        const [, namedImports, namespaceImport, defaultImport, source] = match;

        if (!mergedImports.has(source)) {
          mergedImports.set(source, new Set());
        }

        if (namedImports) {
          namedImports.split(',').forEach(imp => {
            mergedImports.get(source)!.add(imp.trim());
          });
        } else if (namespaceImport) {
          mergedImports.get(source)!.add(`* as ${namespaceImport}`);
        } else if (defaultImport) {
          mergedImports.get(source)!.add(defaultImport);
        }
      }
    });

    // Rebuild optimized imports
    const optimizedImports: string[] = [];

    mergedImports.forEach((imports, source) => {
      const importList = Array.from(imports).sort();

      if (importList.length === 1) {
        const singleImport = importList[0];
        if (singleImport.startsWith('* as ')) {
          optimizedImports.push(`import ${singleImport} from "${source}";`);
        } else {
          optimizedImports.push(`import { ${singleImport} } from "${source}";`);
        }
      } else {
        optimizedImports.push(
          `import { ${importList.join(', ')} } from "${source}";`,
        );
      }
    });

    // Add common.ts import if needed and not present
    if (
      hasExistingCommon &&
      !optimizedImports.some(imp => imp.includes('./common'))
    ) {
      optimizedImports.unshift(`import {
  FluentBuilder,
  FluentBuilderBase,
  BaseBuildContext,
  FLUENT_BUILDER_SYMBOL,
  createInspectMethod
} from "./common.js";`);
    }

    return ok({
      ...context,
      imports: optimizedImports,
    });
  },
};
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

## Generator Configuration Enhancements

### Configurable Naming Strategy

The generator now supports custom naming strategies for factory functions:

```typescript
import { GeneratorConfig, BuilderGenerator } from 'fluent-gen-ts';

// Default naming (user -> user())
const defaultConfig: GeneratorConfig = {
  // namingStrategy not specified - uses default lowerFirst behavior
};

// Custom prefix naming (user -> createUser())
const prefixConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => `create${typeName}`,
};

// Builder suffix naming (user -> userBuilder())
const builderSuffixConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => `${typeName.toLowerCase()}Builder`,
};

// Make naming (user -> makeUser())
const makeConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => `make${typeName}`,
};

// Factory naming with verb (user -> buildUser())
const factoryConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => `build${typeName}`,
};

// Snake case naming (UserProfile -> user_profile())
const snakeCaseConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => {
    return typeName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  },
};

// Use with generator
const generator = new BuilderGenerator(prefixConfig);
// This will generate: export function createUser() instead of user()
```

### Advanced Naming Strategies

```typescript
// Domain-specific naming with type checking
const domainNamingConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => {
    // API models get different naming
    if (typeName.endsWith('Model') || typeName.endsWith('DTO')) {
      return `build${typeName.replace(/(Model|DTO)$/, '')}`;
    }

    // Entity types get create prefix
    if (typeName.endsWith('Entity')) {
      return `create${typeName.replace('Entity', '')}`;
    }

    // Configuration types get configure prefix
    if (typeName.endsWith('Config') || typeName.endsWith('Options')) {
      return `configure${typeName.replace(/(Config|Options)$/, '')}`;
    }

    // Default for other types
    return `new${typeName}`;
  },
};

// Namespace-aware naming
const namespaceConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => {
    // Extract namespace from type name
    const parts = typeName.split('.');
    if (parts.length > 1) {
      const namespace = parts[0].toLowerCase();
      const name = parts[1];
      return `${namespace}${name}`;
    }
    return typeName.charAt(0).toLowerCase() + typeName.slice(1);
  },
};

// Version-aware naming for API evolution
const versionedConfig: GeneratorConfig = {
  namingStrategy: (typeName: string) => {
    const versionMatch = typeName.match(/V(\d+)$/);
    if (versionMatch) {
      const baseType = typeName.replace(/V\d+$/, '');
      const version = versionMatch[1];
      return `create${baseType}V${version}`;
    }
    return `create${typeName}`;
  },
};
```

### Combining Naming Strategy with Plugins

```typescript
const namingWithValidationPlugin: Plugin = {
  name: 'naming-validator',
  version: '1.0.0',

  beforeGenerate: context => {
    const typeName = context.resolvedType.name;

    // Validate naming conventions
    if (!/^[A-Z]/.test(typeName)) {
      return err(
        new Error(`Type name "${typeName}" should start with uppercase`),
      );
    }

    if (typeName.length < 3) {
      return err(new Error(`Type name "${typeName}" is too short`));
    }

    return ok(context);
  },
};

// Use together
const generator = new BuilderGenerator(
  {
    namingStrategy: typeName => `build${typeName}`,
  },
  pluginManager,
);

pluginManager.register(namingWithValidationPlugin);
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
