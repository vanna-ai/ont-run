// ============================================================================
// Chat Templates
// ============================================================================

// -----------------------------------------------------------------------------
// Auth Session Management
// -----------------------------------------------------------------------------
export const authSessionTemplate = `// ============================================================================
// Session Management
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  groups: string[];
}

export interface Session {
  id: string;
  user: User;
  createdAt: number;
  expiresAt: number;
}

// In-memory session store (use Redis/DB in production)
const sessions = new Map<string, Session>();

// Session TTL: 24 hours
const SESSION_TTL = 24 * 60 * 60 * 1000;

// Demo users with different access levels
export const DEMO_USERS: Record<string, { password: string; user: Omit<User, "id"> }> = {
  "admin@example.com": {
    password: "admin123",
    user: {
      email: "admin@example.com",
      name: "Admin User",
      groups: ["admin", "support", "public"],
    },
  },
  "support@example.com": {
    password: "support123",
    user: {
      email: "support@example.com",
      name: "Support User",
      groups: ["support", "public"],
    },
  },
  "user@example.com": {
    password: "user123",
    user: {
      email: "user@example.com",
      name: "Public User",
      groups: ["public"],
    },
  },
};

// Generate a random session ID
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Create a new session for a user
export function createSession(user: Omit<User, "id">): Session {
  const sessionId = generateSessionId();
  const now = Date.now();

  const session: Session = {
    id: sessionId,
    user: {
      ...user,
      id: generateSessionId().slice(0, 16),
    },
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  };

  sessions.set(sessionId, session);
  return session;
}

// Get a session by ID
export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check if expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

// Delete a session
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

// Parse session ID from cookie header
export function getSessionIdFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  return cookies["session"] || null;
}

// Create Set-Cookie header value
export function createSessionCookie(sessionId: string, maxAge?: number): string {
  const parts = [\`session=\${sessionId}\`, "Path=/", "HttpOnly", "SameSite=Lax"];

  if (maxAge !== undefined) {
    parts.push(\`Max-Age=\${maxAge}\`);
  } else {
    parts.push(\`Max-Age=\${SESSION_TTL / 1000}\`);
  }

  // In production, add Secure flag
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

// Create expired cookie to clear session
export function createExpiredSessionCookie(): string {
  return createSessionCookie("", 0);
}

// Get user from request (utility function)
export function getUserFromRequest(req: Request): User | null {
  const cookieHeader = req.headers.get("cookie");
  const sessionId = getSessionIdFromCookies(cookieHeader);
  if (!sessionId) return null;

  const session = getSession(sessionId);
  return session?.user || null;
}
`;

// -----------------------------------------------------------------------------
// Auth Routes
// -----------------------------------------------------------------------------
export const authRoutesTemplate = `// ============================================================================
// Auth Routes
// ============================================================================

import {
  DEMO_USERS,
  createSession,
  createSessionCookie,
  createExpiredSessionCookie,
  getSessionIdFromCookies,
  getSession,
  deleteSession,
} from "./session";

// POST /api/auth/login
export async function handleLogin(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const demoUser = DEMO_USERS[email];
    if (!demoUser || demoUser.password !== password) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const session = createSession(demoUser.user);

    return new Response(
      JSON.stringify({
        user: session.user,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": createSessionCookie(session.id),
        },
      }
    );
  } catch (error) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}

// POST /api/auth/logout
export async function handleLogout(req: Request): Promise<Response> {
  const cookieHeader = req.headers.get("cookie");
  const sessionId = getSessionIdFromCookies(cookieHeader);

  if (sessionId) {
    deleteSession(sessionId);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": createExpiredSessionCookie(),
    },
  });
}

// GET /api/auth/me
export async function handleMe(req: Request): Promise<Response> {
  const cookieHeader = req.headers.get("cookie");
  const sessionId = getSessionIdFromCookies(cookieHeader);

  if (!sessionId) {
    return Response.json({ user: null }, { status: 200 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": createExpiredSessionCookie(),
      },
    });
  }

  return Response.json({ user: session.user }, { status: 200 });
}
`;

// -----------------------------------------------------------------------------
// MCP Client
// -----------------------------------------------------------------------------
export const mcpClientTemplate = `// ============================================================================
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
    const response = await fetch(\`\${MCP_SERVER_URL}/mcp\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${encodeUserAuth(user)}\`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    if (!response.ok) {
      console.error(\`MCP server error: \${response.status}\`);
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
    const response = await fetch(\`\${MCP_SERVER_URL}/mcp\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${encodeUserAuth(user)}\`,
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
        content: [{ type: "text", text: \`MCP server error: \${response.status}\` }],
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
      content: [{ type: "text", text: \`Failed to call tool: \${error}\` }],
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
    const response = await fetch(\`\${MCP_SERVER_URL}/health\`, {
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
    description: tool.description || \`Tool: \${tool.name}\`,
    input_schema: tool.inputSchema,
  }));
}
`;

// -----------------------------------------------------------------------------
// Chat Handler
// -----------------------------------------------------------------------------
export const chatHandlerTemplate = `// ============================================================================
// Chat Handler with SSE Streaming
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { getUserFromRequest, type User } from "../auth/session";
import { listTools, callTool, toAnthropicTools, checkMCPHealth, type MCPTool } from "./mcp-client";

const anthropic = new Anthropic();

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// POST /api/chat - SSE streaming chat endpoint
export async function handleChat(req: Request): Promise<Response> {
  // Validate session
  const user = getUserFromRequest(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: "Messages array is required" }, { status: 400 });
  }

  // Check MCP server availability and get tools
  const mcpAvailable = await checkMCPHealth();
  let mcpTools: MCPTool[] = [];

  if (mcpAvailable) {
    mcpTools = await listTools(user);
  }

  // Create SSE response stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(\`event: \${event}\\ndata: \${JSON.stringify(data)}\\n\\n\`));
      };

      try {
        // Send initial info
        send("info", {
          mcpAvailable,
          toolCount: mcpTools.length,
          userGroups: user.groups,
        });

        // Build messages for Anthropic - use proper typing for tool use messages
        const anthropicMessages: Anthropic.MessageParam[] = body.messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

        // Agentic loop - continue until no more tool calls
        let continueLoop = true;
        while (continueLoop) {
          const tools = mcpTools.length > 0 ? toAnthropicTools(mcpTools) : undefined;

          // Create streaming message
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: buildSystemPrompt(user, mcpAvailable, mcpTools),
            messages: anthropicMessages,
            tools,
            stream: true,
          });

          let currentTextBlock = "";
          let toolUseBlocks: Array<{
            id: string;
            name: string;
            input: Record<string, unknown>;
          }> = [];
          let currentToolUse: { id: string; name: string; inputJson: string } | null = null;
          let stopReason: string | null = null;

          // Process stream events
          for await (const event of response) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                currentTextBlock = "";
              } else if (event.content_block.type === "tool_use") {
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  inputJson: "",
                };
                send("tool_start", { name: event.content_block.name });
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                currentTextBlock += event.delta.text;
                send("text", { text: event.delta.text });
              } else if (event.delta.type === "input_json_delta" && currentToolUse) {
                currentToolUse.inputJson += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolUse) {
                try {
                  const input = currentToolUse.inputJson
                    ? JSON.parse(currentToolUse.inputJson)
                    : {};
                  toolUseBlocks.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input,
                  });
                } catch {
                  toolUseBlocks.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input: {},
                  });
                }
                currentToolUse = null;
              }
            } else if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason;
            }
          }

          // If there are tool uses, execute them and continue the loop
          if (toolUseBlocks.length > 0 && stopReason === "tool_use") {
            // Add assistant message with tool use to history
            anthropicMessages.push({
              role: "assistant",
              content: [
                ...(currentTextBlock ? [{ type: "text" as const, text: currentTextBlock }] : []),
                ...toolUseBlocks.map((tool) => ({
                  type: "tool_use" as const,
                  id: tool.id,
                  name: tool.name,
                  input: tool.input,
                })),
              ],
            });

            // Execute each tool and collect results
            const toolResults: Array<{
              type: "tool_result";
              tool_use_id: string;
              content: string;
            }> = [];

            for (const tool of toolUseBlocks) {
              send("tool_execute", { name: tool.name, input: tool.input });

              const result = await callTool(user, tool.name, tool.input);
              const resultText = result.content
                .map((c) => c.text)
                .join("\\n");

              send("tool_result", {
                name: tool.name,
                result: resultText,
                isError: result.isError,
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: tool.id,
                content: resultText,
              });
            }

            // Add tool results to message history
            anthropicMessages.push({
              role: "user",
              content: toolResults,
            });

            // Reset for next iteration
            toolUseBlocks = [];
          } else {
            // No more tool calls, end the loop
            continueLoop = false;
          }
        }

        send("done", {});
      } catch (error) {
        console.error("Chat error:", error);
        send("error", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildSystemPrompt(user: User, mcpAvailable: boolean, tools: MCPTool[]): string {
  let prompt = \`You are a helpful AI assistant integrated into an application.

Current user: \${user.name} (\${user.email})
Access groups: \${user.groups.join(", ")}
\`;

  if (!mcpAvailable) {
    prompt += \`
Note: The MCP server is not available. You cannot use any tools at this time. Please let the user know if they try to use tool-dependent features.\`;
  } else if (tools.length > 0) {
    prompt += \`
You have access to the following tools that are filtered based on the user's access groups. Use them when appropriate to help the user.\`;
  } else {
    prompt += \`
Note: No tools are currently available for this user's access level.\`;
  }

  return prompt;
}
`;

// -----------------------------------------------------------------------------
// Chat Types
// -----------------------------------------------------------------------------
export const chatTypesTemplate = `// ============================================================================
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
`;

// -----------------------------------------------------------------------------
// Auth Context
// -----------------------------------------------------------------------------
export const authContextTemplate = `// ============================================================================
// Auth Context
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "../types/chat";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        const data = await response.json();
        setUser(data.user || null);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        return false;
      }

      setUser(data.user);
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
`;

// -----------------------------------------------------------------------------
// Chat Context
// -----------------------------------------------------------------------------
export const chatContextTemplate = `// ============================================================================
// Chat Context with SSE Handling
// ============================================================================

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ChatMessage, ChatInfo, ToolUse } from "../types/chat";
import { useAuth } from "./AuthContext";

interface ChatContextType {
  messages: ChatMessage[];
  isStreaming: boolean;
  chatInfo: ChatInfo | null;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || isStreaming) return;

      setError(null);
      setIsStreaming(true);

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Create assistant message placeholder
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        toolUses: [],
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Build message history for API
        const apiMessages = [...messages, userMessage].map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Chat request failed");
        }

        // Parse SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let currentToolUses: ToolUse[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEEvent(
                  eventType,
                  data,
                  assistantMessageId,
                  currentToolUses,
                  setChatInfo,
                  setMessages,
                  setError
                );
              } catch {
                // Ignore parse errors
              }
              eventType = "";
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        // Update assistant message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content || "Sorry, an error occurred." }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [user, isStreaming, messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setChatInfo(null);
    setError(null);
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, isStreaming, chatInfo, error, sendMessage, clearMessages }}
    >
      {children}
    </ChatContext.Provider>
  );
}

function handleSSEEvent(
  eventType: string,
  data: unknown,
  messageId: string,
  currentToolUses: ToolUse[],
  setChatInfo: (info: ChatInfo) => void,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setError: (error: string | null) => void
) {
  switch (eventType) {
    case "info":
      setChatInfo(data as ChatInfo);
      break;

    case "text": {
      const { text } = data as { text: string };
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: msg.content + text } : msg
        )
      );
      break;
    }

    case "tool_start": {
      const { name } = data as { name: string };
      const toolUse: ToolUse = { name, status: "pending" };
      currentToolUses.push(toolUse);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, toolUses: [...currentToolUses] } : msg
        )
      );
      break;
    }

    case "tool_execute": {
      const { name, input } = data as { name: string; input: Record<string, unknown> };
      const toolIndex = currentToolUses.findIndex(
        (t) => t.name === name && t.status === "pending"
      );
      if (toolIndex >= 0) {
        currentToolUses[toolIndex] = { name, input, status: "running" };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, toolUses: [...currentToolUses] } : msg
          )
        );
      }
      break;
    }

    case "tool_result": {
      const { name, result, isError } = data as {
        name: string;
        result: string;
        isError?: boolean;
      };
      const toolIndex = currentToolUses.findIndex(
        (t) => t.name === name && t.status === "running"
      );
      if (toolIndex >= 0) {
        const existing = currentToolUses[toolIndex]!;
        currentToolUses[toolIndex] = {
          name,
          input: existing.input,
          result,
          isError,
          status: isError ? "error" : "done",
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, toolUses: [...currentToolUses] } : msg
          )
        );
      }
      break;
    }

    case "error": {
      const { message } = data as { message: string };
      setError(message);
      break;
    }

    case "done":
      // Stream complete
      break;
  }
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
`;

// -----------------------------------------------------------------------------
// Login Screen Component
// -----------------------------------------------------------------------------
export const loginScreenTemplate = `// ============================================================================
// Login Screen Component
// ============================================================================

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogIn, AlertCircle, User, Lock } from "lucide-react";

const DEMO_CREDENTIALS = [
  { email: "admin@example.com", password: "admin123", label: "Admin", groups: "admin, support, public" },
  { email: "support@example.com", password: "support123", label: "Support", groups: "support, public" },
  { email: "user@example.com", password: "user123", label: "Public", groups: "public" },
];

export function LoginScreen() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    await login(demoEmail, demoPassword);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Sign In</h3>
        <p className="text-sm text-gray-500">to access the chat</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <LogIn className="h-4 w-4" />
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="border-t pt-4 mt-4">
        <p className="text-xs text-gray-500 mb-3 text-center">Demo Accounts</p>
        <div className="space-y-2">
          {DEMO_CREDENTIALS.map((demo) => (
            <button
              key={demo.email}
              onClick={() => handleDemoLogin(demo.email, demo.password)}
              disabled={isLoading}
              className="w-full text-left p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-800">{demo.label}</span>
                <span className="text-xs text-gray-400">{demo.email}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Groups: {demo.groups}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

// -----------------------------------------------------------------------------
// Floating Chat Component
// -----------------------------------------------------------------------------
export const floatingChatTemplate = `// ============================================================================
// Floating Chat Component
// ============================================================================

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Minimize2,
  Send,
  LogOut,
  Loader2,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Bot,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { LoginScreen } from "./LoginScreen";
import type { ChatMessage, ToolUse } from "../types/chat";

export function FloatingChat() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { messages, isStreaming, chatInfo, error, sendMessage, clearMessages } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isOpen && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && user && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput("");
    await sendMessage(message);
  };

  const handleLogout = async () => {
    clearMessages();
    await logout();
  };

  if (authLoading) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        </div>
      </div>
    );
  }

  // Minimized button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105"
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={\`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-200 \${
        isMinimized ? "w-72 h-14" : "w-96 h-[32rem]"
      }\`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-white" />
          <span className="font-semibold text-white">
            {user ? \`Chat (\${user.groups[0]})\` : "Chat"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {user && (
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4 text-white" />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <Minimize2 className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Content (only visible when not minimized) */}
      {!isMinimized && (
        <>
          {!user ? (
            <LoginScreen />
          ) : (
            <>
              {/* Chat info bar */}
              {chatInfo && (
                <div className="px-3 py-1.5 bg-gray-50 border-b text-xs text-gray-500 flex items-center gap-3">
                  <span
                    className={\`flex items-center gap-1 \${
                      chatInfo.mcpAvailable ? "text-green-600" : "text-gray-400"
                    }\`}
                  >
                    <span
                      className={\`w-2 h-2 rounded-full \${
                        chatInfo.mcpAvailable ? "bg-green-500" : "bg-gray-400"
                      }\`}
                    />
                    MCP {chatInfo.mcpAvailable ? "connected" : "offline"}
                  </span>
                  {chatInfo.mcpAvailable && (
                    <span>{chatInfo.toolCount} tools available</span>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-8">
                    <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Send a message to start chatting</p>
                  </div>
                )}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {isStreaming && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="p-3 border-t bg-gray-50 rounded-b-2xl">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                    disabled={isStreaming}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isStreaming}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={\`flex \${isUser ? "justify-end" : "justify-start"}\`}>
      <div
        className={\`max-w-[85%] \${
          isUser
            ? "bg-blue-600 text-white rounded-2xl rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md"
        } px-4 py-2\`}
      >
        <div className="flex items-start gap-2">
          {!isUser && <Bot className="h-4 w-4 mt-1 flex-shrink-0 text-blue-600" />}
          <div className="flex-1 min-w-0">
            {message.content && (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            )}

            {/* Tool uses */}
            {message.toolUses && message.toolUses.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {message.toolUses.map((tool, index) => (
                  <ToolUseBadge key={index} tool={tool} />
                ))}
              </div>
            )}
          </div>
          {isUser && <UserIcon className="h-4 w-4 mt-1 flex-shrink-0" />}
        </div>
      </div>
    </div>
  );
}

function ToolUseBadge({ tool }: { tool: ToolUse }) {
  const statusConfig = {
    pending: { icon: Loader2, color: "text-gray-500", bg: "bg-gray-200" },
    running: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-100" },
    done: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
    error: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
  };

  const config = statusConfig[tool.status];
  const Icon = config.icon;
  const isSpinning = tool.status === "pending" || tool.status === "running";

  return (
    <div className={\`\${config.bg} rounded-lg p-2 text-xs\`}>
      <div className="flex items-center gap-1.5">
        <Wrench className={\`h-3 w-3 \${config.color}\`} />
        <span className={\`font-medium \${config.color}\`}>{tool.name}</span>
        <Icon
          className={\`h-3 w-3 ml-auto \${config.color} \${isSpinning ? "animate-spin" : ""}\`}
        />
      </div>
      {tool.result && (
        <div className="mt-1 text-gray-600 truncate" title={tool.result}>
          {tool.result.slice(0, 100)}
          {tool.result.length > 100 && "..."}
        </div>
      )}
    </div>
  );
}
`;
