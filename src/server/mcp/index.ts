import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { OntologyConfig, ResolverContext, EnvironmentConfig } from "../../config/types.js";
import { generateMcpTools, filterToolsByAccess, createToolExecutor } from "./tools.js";
import { createLogger } from "../resolver.js";

export interface McpServerOptions {
  /** The ontology configuration */
  config: OntologyConfig;
  /** Directory containing the ontology.config.ts */
  configDir: string;
  /** Environment to use */
  env: string;
  /** Access groups for this MCP session */
  accessGroups: string[];
}

/**
 * Create and start the MCP server
 */
export async function createMcpServer(options: McpServerOptions): Promise<Server> {
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
 * Start the MCP server with stdio transport
 */
export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const server = await createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export { generateMcpTools, filterToolsByAccess } from "./tools.js";
