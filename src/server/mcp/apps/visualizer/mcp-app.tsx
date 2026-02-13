/**
 * Data Visualizer MCP App
 *
 * Interactive visualization for ontology function results.
 * Supports tables and charts (via Recharts) with dual Y-axis support.
 */
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Table2, Download, Settings, FileText } from "lucide-react";
import { DataTable } from "./components/DataTable";
import { DataChart } from "./components/DataChart";
import { MarkdownView } from "./components/MarkdownView";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { downloadCSV } from "./utils/csv";
import "./styles.css";

type ViewType = "chart" | "table" | "markdown";
type ChartType = "bar" | "line";

interface UiConfig {
  type?: "table" | "chart" | "markdown" | "auto";
  xAxis?: string;
  leftYAxis?: string | string[];
  rightYAxis?: string | string[];
  yAxis?: string; // deprecated
}

const APP_INFO = { name: "ont-visualizer", version: "1.0.0" };

/**
 * Extract a string value from data that may be wrapped in an object.
 * Looks for the "result" field specifically, e.g. {result: "# markdown..."}.
 */
function extractStringContent(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const record = data as Record<string, unknown>;
  if (typeof record.result === "string") return record.result;

  return null;
}

/**
 * Detect the best visualization type based on data structure.
 */
function detectVisualizationType(
  data: unknown,
  config?: UiConfig | null
): "table" | "chart" | "markdown" {
  // If config explicitly specifies a type (not "auto"), use it
  if (config?.type && config.type !== "auto") {
    if (config.type === "markdown") return "markdown";
    if (config.type === "chart") return "chart";
    return "table";
  }

  if (!data) return "table";

  // String data or object wrapping a string → table (for CSV) by default
  if (typeof data === "string" || extractStringContent(data) !== null) {
    return "table";
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "table";

    const first = data[0];
    if (typeof first !== "object" || first === null) return "table";

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

  return "table";
}

/**
 * Normalize Y-axis config to array format
 */
function normalizeYAxis(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function VisualizerApp() {
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();
  const [data, setData] = useState<unknown>(null);
  const [config, setConfig] = useState<UiConfig | null>(null);
  const [view, setView] = useState<ViewType>("chart");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart state
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xAxis, setXAxis] = useState<string>("");
  const [leftYAxes, setLeftYAxes] = useState<string[]>([]);
  const [rightYAxes, setRightYAxes] = useState<string[]>([]);

  const { app, isConnected, error: connectionError } = useApp({
    appInfo: APP_INFO,
    capabilities: {},
    onAppCreated: (app) => {
      // Handle tool input - receive UI config
      app.ontoolinput = (params) => {
        console.log("[ont-visualizer] Tool input received:", params);
        if (params.arguments?.ui) {
          setConfig(params.arguments.ui as UiConfig);
        }
      };

      // Handle tool result - receive data to visualize
      app.ontoolresult = (result) => {
        console.log("[ont-visualizer] Tool result received:", result);
        try {
          // Prefer structuredContent if available
          if (result.structuredContent) {
            const content = result.structuredContent as Record<string, unknown>;

            if (content._uiConfig) {
              setConfig(content._uiConfig as UiConfig);
            }

            const { _uiConfig, ...rest } = content;
            const actualData = rest.data !== undefined ? rest.data : rest;
            setData(actualData);
            setError(null);
            return;
          }

          // Fallback: extract text content
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

      app.ontoolcancelled = (params) => {
        console.log("[ont-visualizer] Tool cancelled:", params.reason);
        setError(`Tool cancelled: ${params.reason || "Unknown reason"}`);
      };

      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };

      app.onerror = (err) => {
        console.error("[ont-visualizer] Error:", err);
        setError(err.message);
      };
    },
  });

  // Extract field information from data
  const { stringKeys, numericKeys, allKeys } = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return { stringKeys: [], numericKeys: [], allKeys: [] };
    }

    const first = data[0];
    if (typeof first !== "object" || first === null) {
      return { stringKeys: [], numericKeys: [], allKeys: [] };
    }

    const keys = Object.keys(first);
    const stringKeys = keys.filter(
      (k) => typeof (first as Record<string, unknown>)[k] === "string"
    );
    const numericKeys = keys.filter(
      (k) => typeof (first as Record<string, unknown>)[k] === "number"
    );

    return { stringKeys, numericKeys, allKeys: keys };
  }, [data]);

  // Available fields (numeric fields not assigned to either axis)
  const availableFields = useMemo(() => {
    return numericKeys.filter(
      (k) => !leftYAxes.includes(k) && !rightYAxes.includes(k)
    );
  }, [numericKeys, leftYAxes, rightYAxes]);

  // Initialize state from config when data loads
  useEffect(() => {
    if (!data || allKeys.length === 0) return;

    // Set chart type
    if (config?.chartType && (config.chartType === "bar" || config.chartType === "line")) {
      setChartType(config.chartType);
    }

    // Set x-axis
    if (config?.xAxis && allKeys.includes(config.xAxis)) {
      setXAxis(config.xAxis);
    } else if (stringKeys[0]) {
      setXAxis(stringKeys[0]);
    } else if (allKeys[0]) {
      setXAxis(allKeys[0]);
    }

    // Set Y-axes from config (with backwards compatibility for yAxis)
    const configLeftY = normalizeYAxis(config?.leftYAxis || config?.yAxis);
    const configRightY = normalizeYAxis(config?.rightYAxis);

    // Filter to only include fields that exist and are numeric
    const validLeftY = configLeftY.filter((k) => numericKeys.includes(k));
    const validRightY = configRightY.filter((k) => numericKeys.includes(k));

    if (validLeftY.length > 0 || validRightY.length > 0) {
      setLeftYAxes(validLeftY);
      setRightYAxes(validRightY);
    } else {
      // Default: put all numeric fields on left axis
      setLeftYAxes(numericKeys);
      setRightYAxes([]);
    }

    // Set view type
    const detectedView = detectVisualizationType(data, config);
    setView(detectedView);
  }, [data, config, allKeys, stringKeys, numericKeys]);

  // Get initial host context after connection
  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext());
    }
  }, [app]);

  // Apply host styles
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

  // Handle field drag and drop
  const handleFieldMove = useCallback(
    (field: string, target: "left" | "right" | "available") => {
      // Remove from current location
      setLeftYAxes((prev) => prev.filter((f) => f !== field));
      setRightYAxes((prev) => prev.filter((f) => f !== field));

      // Add to new location
      if (target === "left") {
        setLeftYAxes((prev) => [...prev, field]);
      } else if (target === "right") {
        setRightYAxes((prev) => [...prev, field]);
      }
      // "available" just removes from axes, which we already did
    },
    []
  );

  // Handle CSV download
  const handleDownloadCSV = useCallback(() => {
    if (Array.isArray(data)) {
      downloadCSV(data, "data.csv");
    }
  }, [data]);

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
      {/* Header */}
      <div className="app-header">
        <div className="header-left">
          <button
            className={`icon-btn${view === "chart" ? " active" : ""}`}
            onClick={() => setView("chart")}
            title="Chart view"
          >
            <BarChart3 size={18} />
          </button>
          <button
            className={`icon-btn${view === "table" ? " active" : ""}`}
            onClick={() => setView("table")}
            title="Table view"
          >
            <Table2 size={18} />
          </button>
          <button
            className={`icon-btn${view === "markdown" ? " active" : ""}`}
            onClick={() => setView("markdown")}
            title="Markdown view"
          >
            <FileText size={18} />
          </button>
        </div>
        <div className="header-right">
          <button
            className="icon-btn"
            onClick={handleDownloadCSV}
            title="Download CSV"
          >
            <Download size={18} />
          </button>
          {view === "chart" && (
            <button
              className={`icon-btn${sidebarOpen ? " active" : ""}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Settings"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="app-body">
        <div className="main-content">
          {view === "table" && <DataTable data={extractStringContent(data) ?? data} />}
          {view === "markdown" && (
            <MarkdownView
              content={extractStringContent(data) ?? JSON.stringify(data, null, 2)}
            />
          )}
          {view === "chart" && (
            <DataChart
              data={data}
              config={config}
              chartType={chartType}
              xAxis={xAxis}
              leftYAxes={leftYAxes}
              rightYAxes={rightYAxes}
            />
          )}
        </div>

        {/* Settings Sidebar (chart view only) */}
        {view === "chart" && (
          <SettingsSidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            chartType={chartType}
            onChartTypeChange={setChartType}
            xAxis={xAxis}
            onXAxisChange={setXAxis}
            leftYAxes={leftYAxes}
            rightYAxes={rightYAxes}
            availableFields={availableFields}
            allFields={allKeys}
            numericFields={numericKeys}
            onFieldMove={handleFieldMove}
          />
        )}
      </div>
    </div>
  );
}

// Render the app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<VisualizerApp />);
}
