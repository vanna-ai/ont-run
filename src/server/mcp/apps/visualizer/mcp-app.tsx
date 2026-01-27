/**
 * Data Visualizer MCP App
 *
 * Interactive visualization for ontology function results.
 * Supports tables, charts (via Recharts), and JSON tree views.
 */
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "./components/DataTable";
import { DataChart } from "./components/DataChart";
import { JsonView } from "./components/JsonView";
import "./styles.css";

type ViewType = "auto" | "table" | "chart" | "json";

interface UiConfig {
  type?: "table" | "chart" | "json" | "auto";
  chartType?: "line" | "bar" | "pie";
  xAxis?: string;
  yAxis?: string;
}

const APP_INFO = { name: "ont-visualizer", version: "1.0.0" };

/**
 * Detect the best visualization type based on data structure.
 */
function detectVisualizationType(data: unknown): "table" | "chart" | "json" {
  if (!data) return "json";

  if (Array.isArray(data)) {
    if (data.length === 0) return "json";

    const first = data[0];
    if (typeof first !== "object" || first === null) return "json";

    // Check if it's tabular data with numeric values
    const keys = Object.keys(first);
    const hasNumericValues = keys.some(
      (k) => typeof (first as Record<string, unknown>)[k] === "number"
    );

    if (hasNumericValues && data.length > 1) {
      return "chart";
    }

    return "table";
  }

  return "json";
}

function VisualizerApp() {
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();
  const [data, setData] = useState<unknown>(null);
  const [config, setConfig] = useState<UiConfig | null>(null);
  const [view, setView] = useState<ViewType>("auto");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { app, isConnected, error: connectionError } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (app) => {
      // Handle tool input - receive UI config
      app.ontoolinput = (params) => {
        console.log("[ont-visualizer] Tool input received:", params);
        // UI config might be in the tool metadata
        if (params.arguments?.ui) {
          setConfig(params.arguments.ui as UiConfig);
        }
      };

      // Handle tool result - receive data to visualize
      app.ontoolresult = (result) => {
        console.log("[ont-visualizer] Tool result received:", result);
        try {
          // Extract text content from the result
          const textContent = result.content?.find(
            (c): c is { type: "text"; text: string } => c.type === "text"
          );
          if (textContent) {
            const parsed = JSON.parse(textContent.text);
            setData(parsed);
            setError(null);
          }
        } catch (e) {
          setError(
            `Failed to parse result: ${e instanceof Error ? e.message : "Unknown error"}`
          );
        }
      };

      // Handle tool cancellation
      app.ontoolcancelled = (params) => {
        console.log("[ont-visualizer] Tool cancelled:", params.reason);
        setError(`Tool cancelled: ${params.reason || "Unknown reason"}`);
      };

      // Handle host context changes
      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };

      // Handle errors
      app.onerror = (err) => {
        console.error("[ont-visualizer] Error:", err);
        setError(err.message);
      };
    },
  });

  // Get initial host context after connection
  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext());
    }
  }, [app]);

  // Apply host styles (theme, CSS variables, fonts)
  useHostStyles(app, hostContext);

  // Apply safe area insets
  useEffect(() => {
    if (hostContext?.safeAreaInsets && containerRef.current) {
      const { top, right, bottom, left } = hostContext.safeAreaInsets;
      containerRef.current.style.paddingTop = `${top}px`;
      containerRef.current.style.paddingRight = `${right}px`;
      containerRef.current.style.paddingBottom = `${bottom}px`;
      containerRef.current.style.paddingLeft = `${left}px`;
    }
  }, [hostContext?.safeAreaInsets]);

  // Auto-detect view type
  const autoView = detectVisualizationType(data);
  const activeView = view === "auto" ? autoView : view;

  // Show connection error
  if (connectionError) {
    return (
      <div className="container" ref={containerRef}>
        <div className="error">Connection error: {connectionError.message}</div>
      </div>
    );
  }

  // Show connecting state
  if (!isConnected) {
    return (
      <div className="container" ref={containerRef}>
        <div className="loading">Connecting...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="container" ref={containerRef}>
        <div className="error">{error}</div>
      </div>
    );
  }

  // Show waiting state
  if (!data) {
    return (
      <div className="container" ref={containerRef}>
        <div className="loading">Waiting for data...</div>
      </div>
    );
  }

  return (
    <div className="container" ref={containerRef}>
      <div className="view-switcher">
        {(["auto", "table", "chart", "json"] as const).map((v) => (
          <button
            key={v}
            className={`view-btn${view === v ? " active" : ""}`}
            onClick={() => setView(v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
            {v === "auto" ? ` (${autoView})` : ""}
          </button>
        ))}
      </div>

      {activeView === "table" && <DataTable data={data} />}
      {activeView === "chart" && <DataChart data={data} config={config} />}
      {activeView === "json" && (
        <div className="json-container">
          <JsonView data={data} />
        </div>
      )}
    </div>
  );
}

// Render the app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<VisualizerApp />);
}
