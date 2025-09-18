import { BuilderGenerator } from "./generator.js";
import type { GeneratorConfig } from "./generator.js";
import { TypeExtractor } from "../type-info/index.js";
import type { TypeExtractorOptions } from "../type-info/index.js";
import type { Result } from "../core/result.js";
import { ok, err } from "../core/result.js";
import { PluginManager } from "../core/plugin.js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface FluentGenOptions
  extends GeneratorConfig,
    TypeExtractorOptions {
  outputDir?: string;
  fileName?: string;
}

export class FluentGen {
  private readonly extractor: TypeExtractor;
  private readonly generator: BuilderGenerator;
  private readonly pluginManager: PluginManager;
  private readonly options: FluentGenOptions;

  constructor(options: FluentGenOptions = {}) {
    this.options = options;
    this.pluginManager = options.pluginManager ?? new PluginManager();

    this.extractor = new TypeExtractor({
      ...(options.tsConfigPath && { tsConfigPath: options.tsConfigPath }),
      ...(options.cache && { cache: options.cache }),
      pluginManager: this.pluginManager,
      ...(options.maxDepth && { maxDepth: options.maxDepth }),
    });

    this.generator = new BuilderGenerator(
      {
        ...(options.outputPath && { outputPath: options.outputPath }),
        ...(options.useDefaults !== undefined && {
          useDefaults: options.useDefaults,
        }),
        ...(options.contextType && { contextType: options.contextType }),
        ...(options.addComments !== undefined && {
          addComments: options.addComments,
        }),
      },
      this.pluginManager,
    );
  }

  async generateBuilder(
    filePath: string,
    typeName: string,
  ): Promise<Result<string>> {
    const extractResult = await this.extractor.extractType(filePath, typeName);
    if (!extractResult.ok) {
      return extractResult;
    }

    const generateResult = await this.generator.generate(extractResult.value);
    if (!generateResult.ok) {
      return generateResult;
    }

    return ok(generateResult.value);
  }

  clearCache(): void {
    this.generator.clearCache();
  }

  async generateMultiple(
    filePath: string,
    typeNames: string[],
  ): Promise<Result<Map<string, string>>> {
    try {
      // Set generator to multiple mode
      this.generator.setGeneratingMultiple(true);

      const results = new Map<string, string>();

      // Generate common.ts file
      results.set("common.ts", this.generator.generateCommonFile());

      // Generate each builder
      for (const typeName of typeNames) {
        const result = await this.generateBuilder(filePath, typeName);
        if (!result.ok) {
          return result;
        }
        results.set(`${typeName}.ts`, result.value);
      }

      return ok(results);
    } finally {
      // Reset generator state
      this.generator.setGeneratingMultiple(false);
      this.generator.clearCache();
    }
  }

  async generateToFile(
    filePath: string,
    typeName: string,
    outputPath?: string,
  ): Promise<Result<string>> {
    const code = await this.generateBuilder(filePath, typeName);
    if (!code.ok) {
      return code;
    }

    const output = outputPath ?? this.getOutputPath(filePath, typeName);

    try {
      const dir = path.dirname(output);
      await mkdir(dir, { recursive: true });
      await writeFile(output, code.value, "utf-8");

      return ok(output);
    } catch (error) {
      return err(new Error(`Failed to write file: ${error}`));
    }
  }

  async scanAndGenerate(pattern: string): Promise<Result<Map<string, string>>> {
    const { glob } = await import("glob");
    const files = await glob(pattern);
    const results = new Map<string, string>();

    for (const file of files) {
      const scanResult = await this.extractor.scanFile(file);
      if (!scanResult.ok) {
        continue;
      }

      for (const typeName of scanResult.value) {
        const genResult = await this.generateBuilder(file, typeName);
        if (genResult.ok) {
          const key = `${file}:${typeName}`;
          results.set(key, genResult.value);
        }
      }
    }

    return ok(results);
  }

  registerPlugin(plugin: import("../core/plugin.js").Plugin): void {
    this.pluginManager.register(plugin);
  }

  private getOutputPath(filePath: string, typeName: string): string {
    const outputDir = this.options.outputDir ?? "./generated";
    const fileName =
      this.options.fileName ?? `${typeName.toLowerCase()}.builder.ts`;

    return path.join(outputDir, fileName);
  }
}

export { BuilderGenerator } from "./generator.js";
export type { GeneratorConfig } from "./generator.js";
