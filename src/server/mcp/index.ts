import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { OntologyConfig, ResolverContext, EnvironmentConfig, AuthResult } from "../../config/types.js";
import { generateMcpTools, filterToolsByAccess, createToolExecutor } from "./tools.js";
import { createLogger } from "../resolver.js";
import { serve } from "../../runtime/index.js";

/**
 * Normalize auth function result to AuthResult format.
 */
function normalizeAuthResult(result: string[] | AuthResult): AuthResult {
  if (Array.isArray(result)) {
    return { groups: result };
  }
  return result;
}

/**
 * Extract AuthResult from AuthInfo
 */
function getAuthResult(authInfo?: AuthInfo): AuthResult {
  if (!authInfo?.extra?.authResult) {
    // Fallback to legacy format
    if (authInfo?.extra?.accessGroups) {
      return { groups: authInfo.extra.accessGroups as string[] };
    }
    return { groups: [] };
  }
  return authInfo.extra.authResult as AuthResult;
}

export interface McpServerOptions {
  /** The ontology configuration */
  config: OntologyConfig;
  /** Environment to use */
  env: string;
  /** Port for the MCP HTTP server */
  port?: number;
}

/**
 * Create the MCP server instance with per-request authentication
 */
export function createMcpServer(options: McpServerOptions): Server {
  const { config, env } = options;

  // Get environment config
  const envConfig = config.environments[env];
  if (!envConfig) {
    throw new Error(
      `Unknown environment "${env}". Available: ${Object.keys(config.environments).join(", ")}`
    );
  }

  const logger = createLogger(envConfig.debug);

  // Generate all tools (filtering happens per-request)
  const allTools = generateMcpTools(config);

  // Create tool executor factory that accepts per-request access groups
  const executeToolWithAccess = createToolExecutor(config, env, envConfig, logger);

  // Create MCP server
  const server = new Server(
    {
      name: config.name,
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request - filter by per-request access groups
  server.setRequestHandler(ListToolsRequestSchema, async (_request, extra) => {
    const authResult = getAuthResult(extra.authInfo);
    const accessibleTools = filterToolsByAccess(allTools, authResult.groups);

    return {
      tools: accessibleTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle call tool request - validate access per-request
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const authResult = getAuthResult(extra.authInfo);

    try {
      const result = await executeToolWithAccess(name, args || {}, authResult);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Start the MCP server as an HTTP server with Streamable HTTP transport
 */
export async function startMcpServer(options: McpServerOptions): Promise<{ port: number }> {
  const { config, port = 3001 } = options;
  const server = createMcpServer(options);

  // Create a stateless transport
  const transport = new WebStandardStreamableHTTPServerTransport();

  // Connect server to transport
  await server.connect(transport);

  const app = new Hono();

  // Enable CORS for MCP clients
  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version", "Authorization"],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }));

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", type: "mcp" });
  });

  // MCP endpoint - handles all MCP communication with per-request auth
  app.all("/mcp", async (c) => {
    try {
      // Authenticate the request using the config's auth function
      const rawResult = await config.auth(c.req.raw);
      const authResult = normalizeAuthResult(rawResult);

      // Create AuthInfo object with full auth result in extra field
      const authInfo: AuthInfo = {
        token: c.req.header("Authorization") || "",
        clientId: "ontology-client",
        scopes: [],
        extra: {
          authResult,
          // Keep accessGroups for backwards compatibility
          accessGroups: authResult.groups,
        },
      };

      // Pass auth info to transport - this will be available in request handlers via extra.authInfo
      return transport.handleRequest(c.req.raw, { authInfo });
    } catch (error) {
      // Return 401 Unauthorized if auth fails
      return c.json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Authentication failed",
          data: error instanceof Error ? error.message : "Unknown error"
        },
        id: null
      }, 401);
    }
  });

  const httpServer = await serve(app, port);

  return { port: httpServer.port };
}

export { generateMcpTools, filterToolsByAccess } from "./tools.js";
