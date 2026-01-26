// ============================================================================
// MCP Client
// ============================================================================

import type { User } from "../auth/session";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001";

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// Fetch available tools from MCP server for a user
export async function listTools(user: User): Promise<MCPTool[]> {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${encodeUserAuth(user)}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    if (!response.ok) {
      console.error(`MCP server error: ${response.status}`);
      return [];
    }

    const result = await response.json();

    if (result.error) {
      console.error("MCP error:", result.error);
      return [];
    }

    return result.result?.tools || [];
  } catch (error) {
    console.error("Failed to fetch MCP tools:", error);
    return [];
  }
}

// Execute a tool via MCP server
export async function callTool(
  user: User,
  toolName: string,
  args: Record<string, unknown>
): Promise<MCPToolResult> {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${encodeUserAuth(user)}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      return {
        content: [{ type: "text", text: `MCP server error: ${response.status}` }],
        isError: true,
      };
    }

    const result = await response.json();

    if (result.error) {
      return {
        content: [{ type: "text", text: result.error.message || "Unknown MCP error" }],
        isError: true,
      };
    }

    return result.result || { content: [{ type: "text", text: "No result" }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Failed to call tool: ${error}` }],
      isError: true,
    };
  }
}

// Encode user info for Authorization header
function encodeUserAuth(user: User): string {
  return Buffer.from(
    JSON.stringify({
      userId: user.id,
      email: user.email,
      groups: user.groups,
    })
  ).toString("base64");
}

// Check if MCP server is available
export async function checkMCPHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Convert MCP tools to Anthropic tool format
export function toAnthropicTools(
  mcpTools: MCPTool[]
): Array<{
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}> {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || `Tool: ${tool.name}`,
    input_schema: tool.inputSchema,
  }));
}
