import { Hono } from "hono";
import { cors } from "hono/cors";
import consola from "consola";
import type { OntologyConfig } from "../../config/types.js";
import {
  createAuthMiddleware,
  createContextMiddleware,
  errorHandler,
  type OntologyVariables,
} from "./middleware.js";
import { createApiRoutes, getFunctionsInfo } from "./router.js";
import {
  computeOntologyHash,
  readLockfile,
  diffOntology,
  formatDiffForConsole,
  lockfileExists,
} from "../../lockfile/index.js";
import { launchReviewInBackground } from "../../browser/launch.js";
import { tryRegisterWithCloud } from "../../cloud/registration.js";

export interface ApiServerOptions {
  /** The ontology configuration */
  config: OntologyConfig;
  /** Environment to use (e.g., 'dev', 'prod') */
  env: string;
  /** Enable CORS (default: true) */
  cors?: boolean;
  /** Config directory for lockfile validation. If provided, validates lockfile and auto-launches review UI in dev mode. */
  configDir?: string;
  /** Path to the ontology.config.ts file (used for review UI source display) */
  configPath?: string;
}

/**
 * Create the Hono API app from an OntologyConfig
 */
export function createApiApp(options: ApiServerOptions): Hono<{ Variables: OntologyVariables }> {
  const { config, env, cors: enableCors = true, configDir, configPath } = options;

  // Get environment config
  const envConfig = config.environments[env];
  if (!envConfig) {
    throw new Error(
      `Unknown environment "${env}". Available: ${Object.keys(config.environments).join(", ")}`
    );
  }

  // Lockfile validation (only if configDir is provided)
  if (configDir) {
    const isDev = env !== "prod";
    const { ontology, hash } = computeOntologyHash(config);

    if (!lockfileExists(configDir)) {
      if (isDev) {
        consola.warn("No ont.lock file found.");
        consola.warn("Auto-launching review UI to approve the initial ontology.\n");

        // Build diff for initial ontology (all additions)
        const diff = diffOntology(null, ontology);

        // Auto-launch review UI in background
        launchReviewInBackground({ config, diff, configDir, configPath });
      } else {
        throw new Error(
          "Missing ont.lock file in production mode. Run `npx ont-run review` to approve the ontology."
        );
      }
    } else {
      // Lockfile exists - check for changes
      const lockfilePromise = readLockfile(configDir).then((lockfile) => {
        const oldOntology = lockfile?.ontology || null;
        const diff = diffOntology(oldOntology, ontology);

        if (diff.hasChanges) {
          if (isDev) {
            consola.warn("Ontology Lockfile mismatch detected:");
            console.log("\n" + formatDiffForConsole(diff) + "\n");
            consola.warn("Auto-launching review UI to approve the changes.\n");

            // Auto-launch review UI in background
            launchReviewInBackground({ config, diff, configDir, configPath });
          } else {
            console.log("\n" + formatDiffForConsole(diff) + "\n");
            throw new Error(
              "Ontology Lockfile mismatch in production mode. Run `npx ont-run review` to approve the changes."
            );
          }
        } else {
          consola.success("Ontology Lockfile verified");
        }
      });

      // Handle async lockfile check - don't block app creation but log errors
      lockfilePromise.catch((error) => {
        consola.error("Ontology Lockfile validation error:", error instanceof Error ? error.message : error);
      });
    }
  }

  // Cloud registration (if enabled)
  // Run in background - don't block server start
  if (config.cloud && config.uuid) {
    tryRegisterWithCloud(config);
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
  const apiRoutes = createApiRoutes(config);
  app.route("/api", apiRoutes);

  return app;
}

export { getFunctionsInfo } from "./router.js";
