// ============================================================================
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
      className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-200 ${
        isMinimized ? "w-72 h-14" : "w-96 h-[32rem]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-white" />
          <span className="font-semibold text-white">
            {user ? `Chat (${user.groups[0]})` : "Chat"}
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
                    className={`flex items-center gap-1 ${
                      chatInfo.mcpAvailable ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        chatInfo.mcpAvailable ? "bg-green-500" : "bg-gray-400"
                      }`}
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? "bg-blue-600 text-white rounded-2xl rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md"
        } px-4 py-2`}
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
    <div className={`${config.bg} rounded-lg p-2 text-xs`}>
      <div className="flex items-center gap-1.5">
        <Wrench className={`h-3 w-3 ${config.color}`} />
        <span className={`font-medium ${config.color}`}>{tool.name}</span>
        <Icon
          className={`h-3 w-3 ml-auto ${config.color} ${isSpinning ? "animate-spin" : ""}`}
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
