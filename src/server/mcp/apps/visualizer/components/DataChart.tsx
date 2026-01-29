/**
 * DataChart Component
 *
 * Renders bar or line charts with support for dual Y-axes.
 */
import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface UiConfig {
  type?: "table" | "chart" | "auto";
  chartType?: "line" | "bar";
  xAxis?: string;
  leftYAxis?: string | string[];
  rightYAxis?: string | string[];
  yAxis?: string;
}

export interface DataChartProps {
  data: unknown;
  config?: UiConfig | null;
  chartType: "bar" | "line";
  xAxis: string;
  leftYAxes: string[];
  rightYAxes: string[];
}

// Color palette for charts
const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#0088fe",
  "#00c49f",
  "#ff6b6b",
  "#4ecdc4",
];

export function DataChart({
  data,
  chartType,
  xAxis,
  leftYAxes,
  rightYAxes,
}: DataChartProps) {
  // Validation checks
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="chart-empty">No data for chart</div>;
  }

  const first = data[0];
  if (typeof first !== "object" || first === null) {
    return <div className="chart-empty">Data is not chartable</div>;
  }

  const hasLeftAxis = leftYAxes.length > 0;
  const hasRightAxis = rightYAxes.length > 0;
  const hasDualAxis = hasLeftAxis && hasRightAxis;

  if (!hasLeftAxis && !hasRightAxis) {
    return <div className="chart-empty">Select at least one Y-axis field</div>;
  }

  const ChartComponent = chartType === "line" ? LineChart : BarChart;
  const DataComponent = chartType === "line" ? Line : Bar;

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={data as Record<string, unknown>[]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxis} />

          {/* Left Y-Axis */}
          {hasLeftAxis && (
            <YAxis
              yAxisId="left"
              orientation="left"
              stroke={COLORS[0]}
              {...(!hasDualAxis && { yAxisId: "left" })}
            />
          )}

          {/* Right Y-Axis (only if we have fields for it) */}
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={COLORS[leftYAxes.length]}
            />
          )}

          <Tooltip />
          <Legend />

          {/* Left Y-Axis Data */}
          {leftYAxes.map((key, i) =>
            chartType === "line" ? (
              <Line
                key={key}
                yAxisId="left"
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ) : (
              <Bar
                key={key}
                yAxisId="left"
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
              />
            )
          )}

          {/* Right Y-Axis Data */}
          {rightYAxes.map((key, i) =>
            chartType === "line" ? (
              <Line
                key={key}
                yAxisId="right"
                type="monotone"
                dataKey={key}
                stroke={COLORS[(leftYAxes.length + i) % COLORS.length]}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4 }}
              />
            ) : (
              <Bar
                key={key}
                yAxisId="right"
                dataKey={key}
                fill={COLORS[(leftYAxes.length + i) % COLORS.length]}
              />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
