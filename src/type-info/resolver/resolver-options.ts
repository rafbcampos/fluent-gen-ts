import type { Project } from 'ts-morph';
import type { TypeResolutionCache } from '../../core/cache.js';
import type { PluginManager } from '../../core/plugin/index.js';

export interface ResolverOptions {
  readonly maxDepth?: number;
  readonly cache?: TypeResolutionCache;
  readonly pluginManager?: PluginManager;
  readonly expandUtilityTypes?: boolean;
  readonly resolveMappedTypes?: boolean;
  readonly resolveConditionalTypes?: boolean;
  readonly resolveTemplateLiterals?: boolean;
  readonly project?: Project;
}
