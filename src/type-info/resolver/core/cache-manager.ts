import type { TypeInfo } from '../../../core/types.js';
import type { TypeResolutionCache } from '../../../core/cache.js';
import type { GenericContext } from '../../generic-context.js';

export class CacheManager {
  constructor(private readonly cache: TypeResolutionCache) {}

  generateKey(params: { typeString: string; context: GenericContext }): string {
    const { typeString, context } = params;
    const resolvedGenerics = context
      .getAllGenericParams()
      .map(param => {
        const resolved = context.getResolvedType(param.name);
        return resolved
          ? `${param.name}=${resolved.kind}:${JSON.stringify(resolved)}`
          : `${param.name}=unresolved`;
      })
      .sort()
      .join('|');

    return resolvedGenerics ? `${typeString}::${resolvedGenerics}` : typeString;
  }

  get(key: string): TypeInfo | undefined {
    return this.cache.getType(key) as TypeInfo | undefined;
  }

  set(key: string, value: TypeInfo): void {
    this.cache.setType(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}
