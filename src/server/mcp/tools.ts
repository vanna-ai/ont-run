import { zodToJsonSchema } from "zod-to-json-schema";
import type { OntologyConfig, FunctionDefinition, ResolverContext } from "../../config/types.js";
import { loadResolver } from "../resolver.js";

/**
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  access: string[];
}

/**
 * Generate MCP tool definitions from ontology config
 */
export function generateMcpTools(config: OntologyConfig): McpTool[] {
  const tools: McpTool[] = [];

  for (const [name, fn] of Object.entries(config.functions)) {
    // Convert Zod schema to JSON Schema for MCP
    let inputSchema: Record<string, unknown>;
    try {
      inputSchema = zodToJsonSchema(fn.inputs, {
        $refStrategy: "none",
      }) as Record<string, unknown>;
      // Remove $schema key if present
      delete inputSchema.$schema;
    } catch {
      inputSchema = { type: "object", properties: {} };
    }

    tools.push({
      name,
      description: fn.description,
      inputSchema,
      access: fn.access,
    });
  }

  return tools;
}

/**
 * Filter tools by access groups
 */
export function filterToolsByAccess(
  tools: McpTool[],
  accessGroups: string[]
): McpTool[] {
  return tools.filter((tool) =>
    tool.access.some((group) => accessGroups.includes(group))
  );
}

/**
 * Create a tool executor function
 */
export function createToolExecutor(
  config: OntologyConfig,
  configDir: string,
  resolverContext: ResolverContext
) {
  return async (toolName: string, args: unknown): Promise<unknown> => {
    const fn = config.functions[toolName];

    if (!fn) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Check access
    const hasAccess = fn.access.some((group) =>
      resolverContext.accessGroups.includes(group)
    );

    if (!hasAccess) {
      throw new Error(
        `Access denied to tool "${toolName}". Requires: ${fn.access.join(", ")}`
      );
    }

    // Validate input
    const parsed = fn.inputs.safeParse(args);
    if (!parsed.success) {
      throw new Error(
        `Invalid input for tool "${toolName}": ${parsed.error.message}`
      );
    }

    // Load and execute resolver
    const resolver = await loadResolver(fn.resolver, configDir);
    return resolver(resolverContext, parsed.data);
  };
}
