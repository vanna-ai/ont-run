import type { ResolverFunction } from "../config/types.js";

/**
 * Get a resolver function. Since resolvers are now passed directly as functions,
 * this is a simple passthrough that could be removed in the future.
 */
export function loadResolver(resolver: ResolverFunction): ResolverFunction {
  return resolver;
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
