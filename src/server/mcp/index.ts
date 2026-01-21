import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Hono } from "hono";
import type { OntologyConfig, ResolverContext } from "../../config/types.js";
import { generateMcpTools, filterToolsByAccess, createToolExecutor } from "./tools.js";
import { createLogger } from "../resolver.js";
import { serve } from "../../runtime/index.js";

export interface McpServerOptions {
  /** The ontology configuration */
  config: OntologyConfig;
  /** Directory containing the ontology.config.ts */
  configDir: string;
  /** Environment to use */
  env: string;
  /** Access groups for this MCP session */
  accessGroups: string[];
  /** Port for the MCP HTTP server */
  port?: number;
}

/**
 * Create the MCP server instance
 */
export function createMcpServer(options: McpServerOptions): Server {
  const { config, configDir, env, accessGroups } = options;

  // Get environment config
  const envConfig = config.environments[env];
  if (!envConfig) {
    throw new Error(
      `Unknown environment "${env}". Available: ${Object.keys(config.environments).join(", ")}`
    );
  }

  // Create resolver context
  const resolverContext: ResolverContext = {
    env,
    envConfig,
    logger: createLogger(envConfig.debug),
    accessGroups,
  };

  // Generate tools filtered by access
  const allTools = generateMcpTools(config);
  const accessibleTools = filterToolsByAccess(allTools, accessGroups);

  // Create tool executor
  const executeTool = createToolExecutor(config, configDir, resolverContext);

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

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: accessibleTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await executeTool(name, args || {});

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
 * Start the MCP server as an HTTP server with SSE transport
 */
export async function startMcpServer(options: McpServerOptions): Promise<{ port: number }> {
  const { port = 3001 } = options;
  const server = createMcpServer(options);

  // Track active transports
  const transports = new Map<string, SSEServerTransport>();

  const app = new Hono();

  // SSE endpoint for MCP communication
  app.get("/sse", async (c) => {
    const sessionId = crypto.randomUUID();

    // Create SSE transport
    const transport = new SSEServerTransport("/message", c.res as unknown as Response);
    transports.set(sessionId, transport);

    // Connect server to transport
    await server.connect(transport);

    // Clean up on close
    c.req.raw.signal.addEventListener("abort", () => {
      transports.delete(sessionId);
    });

    // Return the SSE response
    return transport.sseResponse;
  });

  // Message endpoint for client-to-server communication
  app.post("/message", async (c) => {
    const body = await c.req.json();

    // Find the transport (in a real app, you'd use session IDs)
    const transport = transports.values().next().value;

    if (!transport) {
      return c.json({ error: "No active session" }, 400);
    }

    await transport.handlePostMessage(body);
    return c.json({ ok: true });
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", type: "mcp" });
  });

  const httpServer = await serve(app, port);

  return { port: httpServer.port };
}

export { generateMcpTools, filterToolsByAccess } from "./tools.js";
