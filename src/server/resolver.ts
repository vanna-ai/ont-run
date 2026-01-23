import { join, dirname, isAbsolute } from "path";
import { existsSync } from "fs";
import type { ResolverFunction, ResolverContext, OntologyConfig } from "../config/types.js";

/**
 * Cache of loaded resolvers to avoid re-importing
 */
const resolverCache = new Map<string, ResolverFunction>();

/**
 * Load a resolver from a file path.
 * The path is relative to the config file location.
 *
 * @param resolverPath - Path to the resolver file (relative to configDir)
 * @param configDir - Directory containing the ontology.config.ts
 */
export async function loadResolver(
  resolverPath: string,
  configDir: string
): Promise<ResolverFunction> {
  // Resolve the full path
  const fullPath = isAbsolute(resolverPath)
    ? resolverPath
    : join(configDir, resolverPath);

  // Check cache
  if (resolverCache.has(fullPath)) {
    return resolverCache.get(fullPath)!;
  }

  try {
    // Dynamic import the resolver
    const module = await import(fullPath);

    // Expect default export to be the resolver function
    const resolver = module.default;

    if (typeof resolver !== "function") {
      throw new Error(
        `Resolver at ${resolverPath} must export a default function`
      );
    }

    // Cache and return
    resolverCache.set(fullPath, resolver);
    return resolver;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`Resolver not found: ${resolverPath}`);
    }
    throw error;
  }
}

/**
 * Clear the resolver cache (useful for hot reloading)
 */
export function clearResolverCache(): void {
  resolverCache.clear();
}

/**
 * Check which resolvers are missing and return their paths
 */
export function findMissingResolvers(
  config: OntologyConfig,
  configDir: string
): string[] {
  const missing: string[] = [];

  for (const [name, fn] of Object.entries(config.functions)) {
    const fullPath = isAbsolute(fn.resolver)
      ? fn.resolver
      : join(configDir, fn.resolver);

    if (!existsSync(fullPath)) {
      missing.push(fn.resolver);
    }
  }

  return missing;
}

/**
 * Logger type returned by createLogger
 */
export type Logger = ReturnType<typeof createLogger>;

/**
 * Create a logger for a resolver context
 */
export function createLogger(debug: boolean = false) {
  return {
    info: (message: string, ...args: unknown[]) => {
      console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`[ERROR] ${message}`, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[DEBUG] ${message}`, ...args);
      }
    },
  };
}
