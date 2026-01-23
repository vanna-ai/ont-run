import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { OntologyConfig, ResolverContext, EnvironmentConfig, AuthResult } from "../../config/types.js";
import { createLogger } from "../resolver.js";

/**
 * Normalize auth function result to AuthResult format.
 * Supports both legacy string[] format and new AuthResult object.
 */
export function normalizeAuthResult(result: string[] | AuthResult): AuthResult {
  if (Array.isArray(result)) {
    return { groups: result };
  }
  return result;
}

/**
 * Context variables added by middleware
 */
export interface OntologyVariables {
  resolverContext: ResolverContext;
  accessGroups: string[];
  authResult: AuthResult;
}

/**
 * Create auth middleware that calls the user's auth function
 * and sets the access groups on the context
 */
export function createAuthMiddleware(config: OntologyConfig) {
  return createMiddleware<{ Variables: OntologyVariables }>(
    async (c: Context<{ Variables: OntologyVariables }>, next: Next) => {
      try {
        // Call user's auth function and normalize result
        const rawResult = await config.auth(c.req.raw);
        const authResult = normalizeAuthResult(rawResult);
        c.set("authResult", authResult);
        c.set("accessGroups", authResult.groups);
        await next();
      } catch (error) {
        return c.json(
          {
            error: "Authentication failed",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          401
        );
      }
    }
  );
}

/**
 * Create context middleware that builds the ResolverContext
 */
export function createContextMiddleware(
  env: string,
  envConfig: EnvironmentConfig
) {
  const logger = createLogger(envConfig.debug);

  return createMiddleware<{ Variables: OntologyVariables }>(
    async (c: Context<{ Variables: OntologyVariables }>, next: Next) => {
      const accessGroups = c.get("accessGroups") || [];

      const resolverContext: ResolverContext = {
        env,
        envConfig,
        logger,
        accessGroups,
      };

      c.set("resolverContext", resolverContext);
      await next();
    }
  );
}

/**
 * Create access control middleware for a specific function
 */
export function createAccessControlMiddleware(requiredAccess: string[]) {
  return createMiddleware<{ Variables: OntologyVariables }>(
    async (c: Context<{ Variables: OntologyVariables }>, next: Next) => {
      const accessGroups = c.get("accessGroups") || [];

      // Check if user has at least one of the required access groups
      const hasAccess = requiredAccess.some((group) =>
        accessGroups.includes(group)
      );

      if (!hasAccess) {
        return c.json(
          {
            error: "Access denied",
            message: `This function requires one of: ${requiredAccess.join(", ")}`,
            yourGroups: accessGroups,
          },
          403
        );
      }

      await next();
    }
  );
}

/**
 * Error handling middleware
 */
export function errorHandler() {
  return createMiddleware(async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      console.error("Request error:", error);

      const status = (error as { status?: number }).status || 500;
      const message =
        error instanceof Error ? error.message : "Internal server error";

      return c.json(
        {
          error: "Request failed",
          message,
        },
        status as ContentfulStatusCode
      );
    }
  });
}
