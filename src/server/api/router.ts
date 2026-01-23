import { Hono } from "hono";
import type { OntologyConfig, FunctionDefinition } from "../../config/types.js";
import { loadResolver } from "../resolver.js";
import { getUserContextFields } from "../../config/categorical.js";
import {
  createAccessControlMiddleware,
  type OntologyVariables,
} from "./middleware.js";

/**
 * Create API routes from function definitions
 */
export function createApiRoutes(
  config: OntologyConfig,
  configDir: string
): Hono<{ Variables: OntologyVariables }> {
  const router = new Hono<{ Variables: OntologyVariables }>();

  // Create a route for each function
  for (const [name, fn] of Object.entries(config.functions)) {
    const path = `/${name}`;

    // Pre-compute userContext fields for this function
    const userContextFields = getUserContextFields(fn.inputs);

    router.post(
      path,
      // Access control for this specific function
      createAccessControlMiddleware(fn.access),
      // Handler
      async (c) => {
        const resolverContext = c.get("resolverContext");
        const authResult = c.get("authResult");

        // Parse and validate input
        let args: unknown;
        try {
          let body = await c.req.json();

          // Inject user context if function requires it
          if (userContextFields.length > 0 && authResult.user) {
            body = { ...body };
            for (const field of userContextFields) {
              (body as Record<string, unknown>)[field] = authResult.user;
            }
          }

          const parsed = fn.inputs.safeParse(body);

          if (!parsed.success) {
            return c.json(
              {
                error: "Validation failed",
                issues: parsed.error.issues,
              },
              400
            );
          }

          args = parsed.data;
        } catch {
          // No body or invalid JSON - try with empty object (with user context if needed)
          let emptyBody: Record<string, unknown> = {};

          // Inject user context even for empty body
          if (userContextFields.length > 0 && authResult.user) {
            for (const field of userContextFields) {
              emptyBody[field] = authResult.user;
            }
          }

          const parsed = fn.inputs.safeParse(emptyBody);
          if (!parsed.success) {
            return c.json(
              {
                error: "Validation failed",
                message: "Request body is required",
                issues: parsed.error.issues,
              },
              400
            );
          }
          args = parsed.data;
        }

        // Load and execute resolver
        try {
          const resolver = await loadResolver(fn.resolver, configDir);
          const result = await resolver(resolverContext, args);
          return c.json(result);
        } catch (error) {
          console.error(`Error in resolver ${name}:`, error);
          return c.json(
            {
              error: "Resolver failed",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            500
          );
        }
      }
    );
  }

  return router;
}

/**
 * Get info about all available functions (for introspection)
 */
export function getFunctionsInfo(
  config: OntologyConfig
): Array<{
  name: string;
  description: string;
  access: string[];
  path: string;
}> {
  return Object.entries(config.functions).map(([name, fn]) => ({
    name,
    description: fn.description,
    access: fn.access,
    path: `/api/${name}`,
  }));
}
