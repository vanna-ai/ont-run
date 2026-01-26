// ============================================================================
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
          const lines = buffer.split("\n");
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
