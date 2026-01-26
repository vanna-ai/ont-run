// ============================================================================
// Chat Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  groups: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolUses?: ToolUse[];
}

export interface ToolUse {
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  status: "pending" | "running" | "done" | "error";
}

export interface ChatInfo {
  mcpAvailable: boolean;
  toolCount: number;
  userGroups: string[];
}

export type SSEEvent =
  | { type: "info"; data: ChatInfo }
  | { type: "text"; data: { text: string } }
  | { type: "tool_start"; data: { name: string } }
  | { type: "tool_execute"; data: { name: string; input: Record<string, unknown> } }
  | { type: "tool_result"; data: { name: string; result: string; isError?: boolean } }
  | { type: "done"; data: Record<string, never> }
  | { type: "error"; data: { message: string } };
