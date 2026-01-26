// ============================================================================
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
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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
                .join("\n");

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
  let prompt = `You are a helpful AI assistant integrated into an application.

Current user: ${user.name} (${user.email})
Access groups: ${user.groups.join(", ")}
`;

  if (!mcpAvailable) {
    prompt += `
Note: The MCP server is not available. You cannot use any tools at this time. Please let the user know if they try to use tool-dependent features.`;
  } else if (tools.length > 0) {
    prompt += `
You have access to the following tools that are filtered based on the user's access groups. Use them when appropriate to help the user.`;
  } else {
    prompt += `
Note: No tools are currently available for this user's access level.`;
  }

  return prompt;
}
