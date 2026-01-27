import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  CompleteRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { OntologyConfig, ResolverContext, EnvironmentConfig, AuthResult } from "../../config/types.js";
import { generateMcpTools, filterToolsByAccess, createToolExecutor, type McpTool } from "./tools.js";
import { createLogger } from "../resolver.js";
import { serve } from "../../runtime/index.js";
import { visualizerHtml } from "./apps/visualizer.js";

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

export interface CreateMcpAppOptions {
  /** The ontology configuration */
  config: OntologyConfig;
  /** Environment to use */
  env: string;
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

  // Check if any tools have UI enabled
  const hasUiTools = allTools.some((tool) => tool.ui);

  // Create tool executor factory that accepts per-request access groups
  const executeToolWithAccess = createToolExecutor(config, env, envConfig, logger);

  // Create MCP server with tools and optionally resources capability
  const server = new Server(
    {
      name: config.name,
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        // Only advertise resources and completions if we have UI-enabled tools
        ...(hasUiTools ? { resources: {}, completions: {} } : {}),
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
        // Add outputSchema for MCP Apps (only if it's an object type - MCP SDK requirement)
        ...(tool.outputSchema && tool.outputSchema.type === "object" ? { outputSchema: tool.outputSchema } : {}),
        // Include UI metadata if enabled for MCP Apps integration
        ...(tool.ui ? {
          _meta: {
            ui: {
              resourceUri: tool.ui.resourceUri,
            },
          },
        } : {}),
      })),
    };
  });

  // Handle list resource templates request - only if UI tools exist
  if (hasUiTools) {
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return {
        resourceTemplates: [
          {
            uriTemplate: "ui://ont-visualizer/{name}",
            name: "Data Visualizer",
            description: "Interactive visualization for ontology function results",
            mimeType: "text/html;profile=mcp-app",
          },
        ],
      };
    });

    // Handle list resources request
    server.setRequestHandler(ListResourcesRequestSchema, async (_request, extra) => {
      const authResult = getAuthResult(extra.authInfo);
      const accessibleTools = filterToolsByAccess(allTools, authResult.groups);
      const uiTools = accessibleTools.filter((tool) => tool.ui);

      return {
        resources: uiTools.map((tool) => ({
          uri: tool.ui!.resourceUri,
          name: `${tool.name} Visualizer`,
          description: `Interactive visualization for ${tool.name}`,
          mimeType: "text/html;profile=mcp-app",
        })),
      };
    });

    // Handle read resource request - serve the visualizer HTML
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      // Check if this is a visualizer resource
      if (uri.startsWith("ui://ont-visualizer/")) {
        return {
          contents: [
            {
              uri,
              mimeType: "text/html;profile=mcp-app",
              text: visualizerHtml,
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });

    // Handle completion requests for resource templates
    server.setRequestHandler(CompleteRequestSchema, async (request, extra) => {
      const { ref, argument } = request.params;

      // Only handle resource template completions
      if (ref.type !== "ref/resource") {
        return { completion: { values: [] } };
      }

      // Check if this is the visualizer template
      if (ref.uri === "ui://ont-visualizer/{name}" && argument.name === "name") {
        const authResult = getAuthResult(extra.authInfo);
        const accessibleTools = filterToolsByAccess(allTools, authResult.groups);
        const uiTools = accessibleTools.filter((tool) => tool.ui);

        // Filter by what user has typed so far
        const prefix = argument.value.toLowerCase();
        const matches = uiTools
          .map((t) => t.name)
          .filter((name) => name.toLowerCase().startsWith(prefix));

        return {
          completion: {
            values: matches,
            total: matches.length,
          },
        };
      }

      return { completion: { values: [] } };
    });
  }

  // Handle call tool request - validate access per-request
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const authResult = getAuthResult(extra.authInfo);

    try {
      const result = await executeToolWithAccess(name, args || {}, authResult);

      // Find the tool to check if it has UI enabled
      const accessibleTools = filterToolsByAccess(allTools, authResult.groups);
      const tool = accessibleTools.find(t => t.name === name);

      // Prepare structuredContent for MCP Apps
      // structuredContent must be an object, so wrap arrays
      const structuredContent = tool?.ui
        ? (Array.isArray(result) ? { data: result } : result)
        : undefined;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        // Include structuredContent for MCP Apps to receive the data
        ...(structuredContent ? { structuredContent } : {}),
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
 * Create an MCP Hono app without starting a server.
 * Use this to mount MCP on an existing server alongside other routes.
 */
export async function createMcpApp(options: CreateMcpAppOptions): Promise<Hono> {
  const { config } = options;
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

  // MCP endpoint - handles all MCP communication with per-request auth
  // Route is "/*" because this app gets mounted at /mcp in the main server
  app.all("/*", async (c) => {
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

  return app;
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
