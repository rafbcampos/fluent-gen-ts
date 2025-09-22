import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { SetupCommonOptions } from '../types.js';
import { getCommonFileTemplate } from '../../gen/template-generator.js';

export class SetupCommonCommand {
  async execute(options: SetupCommonOptions = {}): Promise<void> {
    const outputPath = options.output || './common.ts';
    const absolutePath = path.resolve(outputPath);

    // Check if file already exists
    if (fs.existsSync(absolutePath) && !options.overwrite) {
      console.error(chalk.red(`\nFile ${outputPath} already exists.`));
      console.log(chalk.gray('Use --overwrite to replace it.'));
      process.exit(1);
    }

    try {
      // Generate the common.ts file content
      const commonContent = getCommonFileTemplate();

      // Ensure the directory exists
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(absolutePath, commonContent, 'utf-8');

      console.log(chalk.green(`\n✓ Created common utilities file: ${chalk.cyan(outputPath)}`));
      console.log(chalk.gray('\nYou can now customize this file to fit your needs.'));
      console.log(
        chalk.gray('The builder generation will automatically use this file when it exists.'),
      );

      console.log(chalk.blue('\n📝 Next steps:'));
      console.log(chalk.gray('  1. Customize the common.ts file if needed'));
      console.log(chalk.gray('  2. Generate builders - they will import from your common.ts'));
      console.log(chalk.gray('  3. All generated builders will share these utilities'));
    } catch (error) {
      console.error(chalk.red('\n✗ Failed to create common.ts file:'), error);
      process.exit(1);
    }
  }
}
