import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SetupCommonOptions } from '../types.js';
import { getCommonFileTemplate } from '../../gen/template-generator.js';
import { CommandUtils } from '../shared/command-utils.js';

/**
 * Command for setting up a common utilities file for fluent builders.
 *
 * This command creates a `common.ts` file containing shared utilities that can be imported
 * by generated builder files. This helps reduce code duplication when generating multiple builders.
 *
 * @example
 * ```typescript
 * const command = new SetupCommonCommand();
 * await command.execute({ output: './src/builders/common.ts' });
 * ```
 */
export class SetupCommonCommand {
  /**
   * Executes the setup-common command to create a common utilities file.
   *
   * This method performs the following operations:
   * 1. Validates the output path and applies default if none provided
   * 2. Checks for existing files and handles overwrite logic
   * 3. Generates the common utilities template content
   * 4. Creates necessary directories if they don't exist
   * 5. Writes the file to the specified location
   * 6. Provides user feedback and next steps
   *
   * @param options - Configuration options for the setup operation
   * @param options.output - Output file path (defaults to './common.ts')
   * @param options.overwrite - Whether to overwrite existing files
   *
   * @throws {Error} When path validation fails
   * @throws {Error} When file already exists and overwrite is false
   * @throws {Error} When file system operations fail
   *
   * @example
   * ```typescript
   * // Create with default settings
   * await command.execute();
   *
   * // Create with custom path
   * await command.execute({ output: './src/common.ts' });
   *
   * // Overwrite existing file
   * await command.execute({ output: './common.ts', overwrite: true });
   * ```
   */
  async execute(options: SetupCommonOptions = {}): Promise<void> {
    try {
      // Validate and normalize output path
      const { outputPath, absolutePath } = CommandUtils.validateOutputPath(
        options.output,
        './common.ts',
      );

      // Check file existence and handle overwrite logic
      CommandUtils.checkFileExistence({
        filePath: outputPath,
        overwrite: options.overwrite ?? false,
      });

      // Generate the common.ts file content
      const commonContent = getCommonFileTemplate();

      // Ensure the directory exists
      const dir = path.dirname(absolutePath);
      CommandUtils.ensureDirectoryExists(dir);

      // Write the file
      fs.writeFileSync(absolutePath, commonContent, 'utf-8');

      // Log success and next steps
      CommandUtils.logSuccess(`Created common utilities file: ${outputPath}`);
      console.log('\nYou can now customize this file to fit your needs.');
      console.log('The builder generation will automatically use this file when it exists.');

      CommandUtils.logNextSteps('📝 Next steps:', [
        'Customize the common.ts file if needed',
        'Generate builders - they will import from your common.ts',
        'All generated builders will share these utilities',
      ]);
    } catch (error) {
      CommandUtils.handleCommandError(error, 'Failed to create common.ts file');
    }
  }
}
