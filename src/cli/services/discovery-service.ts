import { glob } from 'glob';
import { TypeExtractor } from '../../type-info/index.js';
import { isOk } from '../../core/result.js';
import { formatError } from '../../core/utils/error-utils.js';

/**
 * Represents a discovered TypeScript interface in a file
 */
export interface DiscoveredInterface {
  /** The file path where the interface was found */
  file: string;
  /** The name of the interface */
  name: string;
  /** Display-friendly name combining file and interface name */
  displayName: string;
}

/**
 * Result of discovering files and interfaces
 */
export interface FileDiscoveryResult {
  /** List of discovered TypeScript files */
  files: string[];
  /** List of discovered interfaces */
  interfaces: DiscoveredInterface[];
}

/**
 * Result of pattern validation
 */
export interface PatternValidationResult {
  /** Array of valid glob patterns */
  valid: string[];
  /** Array of invalid patterns that were rejected */
  invalid: string[];
}

/**
 * Service for discovering TypeScript files and extracting interface information
 * from glob patterns and file scanning
 */
export class DiscoveryService {
  private typeExtractor = new TypeExtractor();

  private logWarning(action: string, item: string, error: unknown): void {
    console.warn(`Warning: Failed to ${action} "${item}": ${formatError(error)}`);
  }

  private isTypeScriptFile(filename: string): boolean {
    // Use lastIndexOf for better performance with longer paths
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return false;

    const extension = filename.slice(lastDot);
    return extension === '.ts' || extension === '.tsx';
  }

  private trimAndFilter(items: string[]): string[] {
    return items.map(item => item.trim()).filter(item => item.length > 0);
  }

  /**
   * Discovers TypeScript files (.ts and .tsx) based on glob patterns
   *
   * @param patterns - Array of glob patterns to search for files
   * @returns Promise resolving to sorted array of unique file paths
   *
   * @example
   * ```typescript
   * const service = new DiscoveryService();
   * const files = await service.discoverFiles(['src/**\/*.ts', 'lib/**\/*.tsx']);
   * console.log(files); // ['src/component.ts', 'lib/utils.tsx']
   * ```
   */
  async discoverFiles(patterns: string[]): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern.trim());
        const tsFiles = files.filter(file => this.isTypeScriptFile(file));
        tsFiles.forEach(file => allFiles.add(file));
      } catch (error) {
        this.logWarning('process pattern', pattern, error);
      }
    }

    return Array.from(allFiles).sort();
  }

  /**
   * Extracts interface information from TypeScript files
   *
   * @param files - Array of file paths to scan for interfaces
   * @returns Promise resolving to array of discovered interfaces
   *
   * @example
   * ```typescript
   * const service = new DiscoveryService();
   * const interfaces = await service.discoverInterfaces(['src/types.ts']);
   * console.log(interfaces); // [{ file: 'src/types.ts', name: 'User', displayName: 'src/types.ts:User' }]
   * ```
   */
  async discoverInterfaces(files: string[]): Promise<DiscoveredInterface[]> {
    const scanPromises = files.map(async (file): Promise<DiscoveredInterface[]> => {
      try {
        const result = await this.typeExtractor.scanFile(file);

        if (isOk(result)) {
          return result.value.map(interfaceName => ({
            file,
            name: interfaceName,
            displayName: `${file}:${interfaceName}`,
          }));
        }
        return [];
      } catch (error) {
        this.logWarning('scan file', file, error);
        return [];
      }
    });

    const results = await Promise.all(scanPromises);
    return results.flat();
  }

  /**
   * Discovers both files and interfaces in a single operation
   *
   * @param patterns - Array of glob patterns to search for files
   * @returns Promise resolving to object containing both files and interfaces
   *
   * @example
   * ```typescript
   * const service = new DiscoveryService();
   * const result = await service.discoverAll(['src/**\/*.ts']);
   * console.log(result.files); // ['src/types.ts']
   * console.log(result.interfaces); // [{ file: 'src/types.ts', name: 'User', displayName: 'src/types.ts:User' }]
   * ```
   */
  async discoverAll(patterns: string[]): Promise<FileDiscoveryResult> {
    const files = await this.discoverFiles(patterns);
    const interfaces = await this.discoverInterfaces(files);

    return { files, interfaces };
  }

  /**
   * Validates glob patterns to ensure they can discover TypeScript files
   *
   * @param patterns - Array of glob patterns to validate
   * @returns Object containing arrays of valid and invalid patterns
   *
   * @example
   * ```typescript
   * const service = new DiscoveryService();
   * const result = service.validatePatterns(['src/**\/*.ts', 'invalid-pattern']);
   * console.log(result.valid); // ['src/**\/*.ts']
   * console.log(result.invalid); // ['invalid-pattern']
   * ```
   */
  validatePatterns(patterns: string[]): PatternValidationResult {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const pattern of patterns) {
      const trimmed = pattern.trim();
      if (trimmed) {
        if (this.isValidGlobPattern(trimmed)) {
          valid.push(trimmed);
        } else {
          invalid.push(trimmed);
        }
      }
    }

    return { valid, invalid };
  }

  private isValidGlobPattern(pattern: string): boolean {
    // Check for TypeScript/React file extensions first (most common case)
    if (pattern.includes('.ts')) {
      return true;
    }

    // Use a single loop to check for glob characters for better performance
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      switch (char) {
        case '*':
        case '?':
          return true;
        case '{':
          // Check if there's a matching closing brace
          if (pattern.indexOf('}', i) > i) return true;
          break;
        case '[':
          // Check if there's a matching closing bracket
          if (pattern.indexOf(']', i) > i) return true;
          break;
      }
    }

    return false;
  }

  /**
   * Parses comma-separated glob patterns into an array
   *
   * @param input - Comma-separated string of patterns
   * @returns Array of trimmed, non-empty patterns
   *
   * @example
   * ```typescript
   * const service = new DiscoveryService();
   * const patterns = service.parsePatterns('src/**\/*.ts, lib/**\/*.tsx, ');
   * console.log(patterns); // ['src/**\/*.ts', 'lib/**\/*.tsx']
   * ```
   */
  parsePatterns(input: string): string[] {
    return this.trimAndFilter(input.split(','));
  }
}
