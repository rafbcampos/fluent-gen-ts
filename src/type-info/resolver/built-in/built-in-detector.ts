import type { Type } from 'ts-morph';

export class BuiltInDetector {
  isBuiltInType(type: Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const symbolName = symbol.getName();
    if (symbolName === '__type') {
      return false;
    }

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return false;

    return declarations.some(decl => {
      const sourceFile = decl.getSourceFile();
      if (!sourceFile) return true;

      const filePath = sourceFile.getFilePath();
      return this.isBuiltInPath(filePath);
    });
  }

  isNodeJSBuiltInType(type: Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;

    const typeText = type.getText();
    if (typeText.startsWith('NodeJS.')) {
      return this.isNodeJSNamespaceType(typeText);
    }

    const symbolName = symbol.getName();
    const nodeJSTypes = [
      'EventEmitter',
      'URL',
      'URLSearchParams',
      'Buffer',
      'Readable',
      'Writable',
      'Transform',
      'Duplex',
    ];

    if (!nodeJSTypes.includes(symbolName)) return false;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return false;

    return declarations.some(decl => {
      const sourceFile = decl.getSourceFile();
      if (!sourceFile) return false;
      const filePath = sourceFile.getFilePath();
      return this.isNodeJSPath(filePath);
    });
  }

  private isBuiltInPath(filePath: string): boolean {
    return (
      filePath.includes('/typescript/lib/') ||
      filePath.includes('\\typescript\\lib\\') ||
      (filePath.endsWith('.d.ts') && filePath.includes('lib.'))
    );
  }

  private isNodeJSPath(filePath: string): boolean {
    return filePath.includes('/@types/node/') || filePath.includes('\\@types\\node\\');
  }

  private isNodeJSNamespaceType(typeText: string): boolean {
    const nodeJSNamespaceTypes = [
      'NodeJS.ProcessEnv',
      'NodeJS.Dict',
      'NodeJS.ArrayBufferView',
      'NodeJS.Process',
    ];
    return nodeJSNamespaceTypes.includes(typeText);
  }
}
