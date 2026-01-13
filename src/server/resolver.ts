import { join, dirname, isAbsolute } from "path";
import type { ResolverFunction, ResolverContext } from "../config/types.js";

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
