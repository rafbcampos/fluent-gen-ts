import type {
  BatchOptions,
  GenerateOptions,
  InitOptions,
  ScanOptions,
  SetupCommonOptions,
} from './types.js';
import { GenerateCommand } from './commands/generate-command.js';
import { BatchCommand } from './commands/batch-command.js';
import { ScanCommand } from './commands/scan-command.js';
import { InitCommand } from './commands/init-command.js';
import { SetupCommonCommand } from './commands/setup-common-command.js';

export class Commands {
  private generateCommand = new GenerateCommand();
  private batchCommand = new BatchCommand();
  private scanCommand = new ScanCommand();
  private initCommand = new InitCommand();
  private setupCommonCommand = new SetupCommonCommand();

  async generate(file: string, typeName: string, options: GenerateOptions = {}): Promise<void> {
    return this.generateCommand.execute(file, typeName, options);
  }

  async batch(options: BatchOptions = {}): Promise<void> {
    return this.batchCommand.execute(options);
  }

  async scan(pattern: string, options: ScanOptions = {}): Promise<void> {
    return this.scanCommand.execute(pattern, options);
  }

  async init(options: InitOptions = {}): Promise<void> {
    return this.initCommand.execute(options);
  }

  async setupCommon(options: SetupCommonOptions = {}): Promise<void> {
    return this.setupCommonCommand.execute(options);
  }
}
