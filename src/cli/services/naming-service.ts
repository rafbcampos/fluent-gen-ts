export type NamingConvention = "camelCase" | "kebab-case" | "snake_case" | "PascalCase";

export interface FileNamingConfig {
  convention: NamingConvention;
  suffix: string;
}

export class NamingService {
  private conventions: Record<NamingConvention, (str: string) => string> = {
    camelCase: this.toCamelCase,
    "kebab-case": this.toKebabCase,
    snake_case: this.toSnakeCase,
    PascalCase: this.toPascalCase,
  };

  formatFileName(typeName: string, config: FileNamingConfig): string {
    const formatter = this.conventions[config.convention];
    const formattedName = formatter(typeName);
    return `${formattedName}${config.suffix ? `.${config.suffix}` : ""}.ts`;
  }

  getFileNamePreview(config: FileNamingConfig): string {
    const example = this.formatFileName("UserProfile", config);
    return `Example: ${example}`;
  }

  getConventionChoices(): Array<{ name: string; value: NamingConvention }> {
    return [
      { name: "camelCase (userProfile.builder.ts)", value: "camelCase" },
      { name: "kebab-case (user-profile.builder.ts)", value: "kebab-case" },
      { name: "snake_case (user_profile.builder.ts)", value: "snake_case" },
      { name: "PascalCase (UserProfile.builder.ts)", value: "PascalCase" },
    ];
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
  }

  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}