/**
 * Supported naming conventions for file names
 */
export type NamingConvention = 'camelCase' | 'kebab-case' | 'snake_case' | 'PascalCase';

/**
 * Configuration for file naming
 */
export interface FileNamingConfig {
  /** The naming convention to apply */
  convention: NamingConvention;
  /** Optional suffix to add before the file extension (e.g., 'builder', 'model') */
  suffix: string;
}

/**
 * Service for handling different naming conventions and file name formatting
 *
 * Supports conversion between naming conventions and generates appropriately
 * formatted file names with TypeScript extensions.
 *
 * @example
 * ```typescript
 * const service = new NamingService();
 * const fileName = service.formatFileName('UserProfile', {
 *   convention: 'kebab-case',
 *   suffix: 'model'
 * });
 * // Returns: 'user-profile.model.ts'
 * ```
 */
export class NamingService {
  private conventions: Record<NamingConvention, (str: string) => string> = {
    camelCase: (str: string) => this.toCamelCase(str),
    'kebab-case': (str: string) => this.toKebabCase(str),
    snake_case: (str: string) => this.toSnakeCase(str),
    PascalCase: (str: string) => this.toPascalCase(str),
  };

  /**
   * Formats a type name into a file name using the specified naming convention
   *
   * @param typeName - The type name to format (e.g., 'UserProfile')
   * @param config - Configuration specifying convention and optional suffix
   * @returns The formatted file name with .ts extension
   *
   * @example
   * ```typescript
   * formatFileName('UserProfile', { convention: 'kebab-case', suffix: 'model' })
   * // Returns: 'user-profile.model.ts'
   *
   * formatFileName('APIService', { convention: 'snake_case', suffix: '' })
   * // Returns: 'api_service.ts'
   * ```
   */
  formatFileName(typeName: string, config: FileNamingConfig): string {
    const formatter = this.conventions[config.convention];
    const formattedName = formatter(typeName);
    return `${formattedName}${config.suffix ? `.${config.suffix}` : ''}.ts`;
  }

  /**
   * Generates a preview of how 'UserProfile' would be formatted with the given config
   *
   * @param config - Configuration specifying convention and optional suffix
   * @returns A preview string showing the example formatting
   *
   * @example
   * ```typescript
   * getFileNamePreview({ convention: 'kebab-case', suffix: 'builder' })
   * // Returns: 'Example: user-profile.builder.ts'
   * ```
   */
  getFileNamePreview(config: FileNamingConfig): string {
    const example = this.formatFileName('UserProfile', config);
    return `Example: ${example}`;
  }

  /**
   * Returns available naming convention choices with examples
   *
   * Each choice includes a display name with an example and the convention value.
   * Examples are dynamically generated using actual formatting methods.
   *
   * @returns Array of naming convention choices for UI selection
   *
   * @example
   * ```typescript
   * getConventionChoices()
   * // Returns: [
   * //   { name: 'camelCase (userProfile.builder.ts)', value: 'camelCase' },
   * //   { name: 'kebab-case (user-profile.builder.ts)', value: 'kebab-case' },
   * //   ...
   * // ]
   * ```
   */
  getConventionChoices(): Array<{ name: string; value: NamingConvention }> {
    const exampleType = 'UserProfile';
    const exampleSuffix = 'builder';

    return [
      {
        name: `camelCase (${this.formatFileName(exampleType, { convention: 'camelCase', suffix: exampleSuffix })})`,
        value: 'camelCase',
      },
      {
        name: `kebab-case (${this.formatFileName(exampleType, { convention: 'kebab-case', suffix: exampleSuffix })})`,
        value: 'kebab-case',
      },
      {
        name: `snake_case (${this.formatFileName(exampleType, { convention: 'snake_case', suffix: exampleSuffix })})`,
        value: 'snake_case',
      },
      {
        name: `PascalCase (${this.formatFileName(exampleType, { convention: 'PascalCase', suffix: exampleSuffix })})`,
        value: 'PascalCase',
      },
    ];
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private toDelimitedCase(str: string, delimiter: string): string {
    return str
      .replace(/([A-Z]+)([A-Z][a-z])/g, `$1${delimiter}$2`)
      .replace(/([a-z\d])([A-Z])/g, `$1${delimiter}$2`)
      .toLowerCase()
      .replace(new RegExp(`^${delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '');
  }

  private toKebabCase(str: string): string {
    return this.toDelimitedCase(str, '-');
  }

  private toSnakeCase(str: string): string {
    return this.toDelimitedCase(str, '_');
  }

  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
