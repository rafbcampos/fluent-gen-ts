import { beforeEach, describe, expect, it } from 'vitest';
import inquirer from 'inquirer';
import { InteractiveService } from '../interactive-service.js';
import type { DiscoveredInterface } from '../discovery-service.js';

type SeparatorInstance = InstanceType<typeof inquirer.Separator>;

describe('InteractiveService', () => {
  let service: InteractiveService;

  beforeEach(() => {
    service = new InteractiveService();
  });

  describe('groupInterfacesByFile', () => {
    it('should handle empty interfaces array', () => {
      const result = (service as any).groupInterfacesByFile([]);
      expect(result).toEqual([]);
    });

    it('should group interfaces by file correctly', () => {
      const interfaces: DiscoveredInterface[] = [
        {
          name: 'Interface1',
          file: 'file1.ts',
          displayName: 'file1.ts:Interface1',
        },
        {
          name: 'Interface2',
          file: 'file1.ts',
          displayName: 'file1.ts:Interface2',
        },
        {
          name: 'Interface3',
          file: 'file2.ts',
          displayName: 'file2.ts:Interface3',
        },
      ];

      const result = (service as any).groupInterfacesByFile(interfaces);

      // Verify the structure is correct and doesn't cause runtime errors
      expect(result.length).toBeGreaterThan(0);

      // Check that file separators are included
      const separators = result.filter(
        (
          item: SeparatorInstance | { name: string; value: DiscoveredInterface },
        ): item is SeparatorInstance => item instanceof inquirer.Separator,
      );
      expect(separators.length).toBeGreaterThan(0);

      // Check that interface choices are included
      const choices = result.filter(
        (
          item: SeparatorInstance | { name: string; value: DiscoveredInterface },
        ): item is { name: string; value: DiscoveredInterface } =>
          !(item instanceof inquirer.Separator) && 'name' in item && 'value' in item,
      );
      expect(choices.length).toBe(3); // Three interfaces
    });

    it('should handle interfaces with duplicate file names', () => {
      const interfaces: DiscoveredInterface[] = [
        {
          name: 'Interface1',
          file: 'same-file.ts',
          displayName: 'same-file.ts:Interface1',
        },
        {
          name: 'Interface2',
          file: 'same-file.ts',
          displayName: 'same-file.ts:Interface2',
        },
      ];

      // This should not throw an error even with the non-null assertion
      const result = (service as any).groupInterfacesByFile(interfaces);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('askInterfaceSelection', () => {
    it('should throw error when no interfaces provided', async () => {
      await expect(service.askInterfaceSelection([])).rejects.toThrow(
        'No interfaces found in the specified files.',
      );
    });
  });
});
