import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import type { Config } from "../config.js";

export class FileService {
  async writeOutput(outputPath: string, content: string): Promise<void> {
    const dir = path.dirname(outputPath);
    await mkdir(dir, { recursive: true });
    await writeFile(outputPath, content, "utf-8");
  }

  async writeOutputBatch(outputs: Map<string, string>): Promise<void> {
    const writePromises = Array.from(outputs.entries()).map(
      ([outputPath, content]) => this.writeOutput(outputPath, content)
    );
    await Promise.all(writePromises);
  }

  fileExists(filePath: string): boolean {
    return existsSync(filePath);
  }

  resolveOutputPath(
    template: string,
    replacements: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(`{${key}}`, value);
    }
    return result;
  }

  writeConfigFile(configPath: string, config: Config, format: string): void {
    let content: string;

    switch (format) {
      case "js":
      case "cjs":
        content = `module.exports = ${JSON.stringify(config, null, 2)};\n`;
        break;
      case "yaml":
      case "yml":
        content = JSON.stringify(config, null, 2);
        break;
      default:
        content = JSON.stringify(config, null, 2);
    }

    writeFileSync(configPath, content);
  }

  getConfigFileName(format?: string): string {
    switch (format) {
      case "yaml":
        return ".fluentgenrc.yaml";
      case "yml":
        return ".fluentgenrc.yml";
      case "js":
        return "fluentgen.config.js";
      case "cjs":
        return "fluentgen.config.cjs";
      default:
        return ".fluentgenrc.json";
    }
  }

  findExistingConfig(): string | undefined {
    const configFiles = [
      ".fluentgenrc.json",
      ".fluentgenrc.yaml",
      ".fluentgenrc.yml",
      ".fluentgenrc.js",
      ".fluentgenrc.cjs",
      "fluentgen.config.js",
      "fluentgen.config.cjs",
    ];

    return configFiles.find(file => this.fileExists(file));
  }

  validateTsConfigPath(tsConfigPath: string): boolean {
    if (!tsConfigPath) return true;
    return this.fileExists(tsConfigPath);
  }

  extractTypeName(outputPath: string): string {
    const baseName = path.basename(outputPath, ".ts");
    const parts = baseName.split(".");
    return parts[0] || baseName;
  }
}