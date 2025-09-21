import { glob } from 'glob';
import { TypeExtractor } from '../../type-info/index.js';
import { isOk } from '../../core/result.js';

export interface DiscoveredInterface {
  file: string;
  name: string;
  displayName: string; // file:name for display
}

export interface FileDiscoveryResult {
  files: string[];
  interfaces: DiscoveredInterface[];
}

export class DiscoveryService {
  private typeExtractor = new TypeExtractor();

  async discoverFiles(patterns: string[]): Promise<string[]> {
    const allFiles = new Set<string>();

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern.trim());
        const tsFiles = files.filter(file => file.endsWith('.ts'));
        tsFiles.forEach(file => allFiles.add(file));
      } catch (error) {
        console.warn(`Warning: Failed to process pattern "${pattern}": ${error}`);
      }
    }

    return Array.from(allFiles).sort();
  }

  async discoverInterfaces(files: string[]): Promise<DiscoveredInterface[]> {
    const interfaces: DiscoveredInterface[] = [];

    for (const file of files) {
      try {
        const result = await this.typeExtractor.scanFile(file);

        if (isOk(result)) {
          for (const interfaceName of result.value) {
            interfaces.push({
              file,
              name: interfaceName,
              displayName: `${file}:${interfaceName}`,
            });
          }
        }
      } catch (error) {
        console.warn(`Warning: Failed to scan file "${file}": ${error}`);
      }
    }

    return interfaces;
  }

  async discoverAll(patterns: string[]): Promise<FileDiscoveryResult> {
    const files = await this.discoverFiles(patterns);
    const interfaces = await this.discoverInterfaces(files);

    return { files, interfaces };
  }

  validatePatterns(patterns: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const pattern of patterns) {
      const trimmed = pattern.trim();
      if (trimmed) {
        if (trimmed.includes('.ts') || trimmed.includes('*')) {
          valid.push(trimmed);
        } else {
          invalid.push(trimmed);
        }
      }
    }

    return { valid, invalid };
  }

  parsePatterns(input: string): string[] {
    return input
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
}
