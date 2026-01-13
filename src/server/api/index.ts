import { Hono } from "hono";
import { cors } from "hono/cors";
import type { OntologyConfig } from "../../config/types.js";
import {
  createAuthMiddleware,
  createContextMiddleware,
  errorHandler,
  type OntologyVariables,
} from "./middleware.js";
import { createApiRoutes, getFunctionsInfo } from "./router.js";

export interface ApiServerOptions {
  /** The ontology configuration */
  config: OntologyConfig;
  /** Directory containing the ontology.config.ts (for resolving resolver paths) */
  configDir: string;
  /** Environment to use (e.g., 'dev', 'prod') */
  env: string;
  /** Enable CORS (default: true) */
  cors?: boolean;
}

/**
 * Create the Hono API app from an OntologyConfig
 */
export function createApiApp(options: ApiServerOptions): Hono {
  const { config, configDir, env, cors: enableCors = true } = options;

  // Get environment config
  const envConfig = config.environments[env];
  if (!envConfig) {
    throw new Error(
      `Unknown environment "${env}". Available: ${Object.keys(config.environments).join(", ")}`
    );
  }

  const app = new Hono<{ Variables: OntologyVariables }>();

  // Global middleware
  if (enableCors) {
    app.use("*", cors());
  }
  app.use("*", errorHandler());
  app.use("*", createAuthMiddleware(config));
  app.use("*", createContextMiddleware(env, envConfig));

  // Health check endpoint (no auth required, override for this route)
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      name: config.name,
      env,
    });
  });

  // Introspection endpoint - list available functions
  app.get("/api", (c) => {
    const accessGroups = c.get("accessGroups") || [];
    const allFunctions = getFunctionsInfo(config);

    // Filter to only show functions the user has access to
    const accessibleFunctions = allFunctions.filter((fn) =>
      fn.access.some((group) => accessGroups.includes(group))
    );

    return c.json({
      name: config.name,
      env,
      accessGroups,
      functions: accessibleFunctions,
    });
  });

  // Mount function routes under /api
  const apiRoutes = createApiRoutes(config, configDir);
  app.route("/api", apiRoutes);

  return app;
}

export { getFunctionsInfo } from "./router.js";
