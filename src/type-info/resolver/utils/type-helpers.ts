import { SyntaxKind } from 'ts-morph';
import type { Symbol as TsSymbol } from 'ts-morph';

export function isTypeAlias(symbol: TsSymbol): boolean {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return false;

  return declarations.some(decl => {
    return decl.getKind() === SyntaxKind.TypeAliasDeclaration;
  });
}

export function extractTypeName(params: {
  symbol: TsSymbol | undefined;
  typeText: string;
}): string {
  const { symbol, typeText } = params;
  let name = symbol?.getName();

  if (name === '__type') {
    const match = typeText.match(/\.([A-Z][a-zA-Z0-9]+)(?:<|$)/);
    if (match && match[1]) {
      name = match[1];
    }
  }

  return name ?? 'unknown';
}
