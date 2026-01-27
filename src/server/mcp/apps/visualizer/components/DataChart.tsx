import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface UiConfig {
  type?: "table" | "chart" | "json" | "auto";
  chartType?: "line" | "bar" | "pie";
  xAxis?: string;
  yAxis?: string;
}

interface DataChartProps {
  data: unknown;
  config?: UiConfig | null;
}

// Color palette for charts
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe", "#00c49f"];

export function DataChart({ data, config }: DataChartProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="json-container">No data for chart</div>;
  }

  const first = data[0];
  if (typeof first !== "object" || first === null) {
    return <div className="json-container">Data is not chartable</div>;
  }

  const keys = Object.keys(first);
  const numericKeys = keys.filter(
    (k) => typeof (first as Record<string, unknown>)[k] === "number"
  );
  const categoryKey =
    keys.find((k) => typeof (first as Record<string, unknown>)[k] === "string") || keys[0];

  if (numericKeys.length === 0) {
    return <div className="json-container">No numeric data for chart</div>;
  }

  const chartType = config?.chartType || "bar";
  const xAxis = config?.xAxis || categoryKey;

  if (chartType === "pie") {
    const yAxis = config?.yAxis || numericKeys[0];
    return (
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data as Record<string, unknown>[]}
              dataKey={yAxis}
              nameKey={xAxis}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxis} />
            <YAxis />
            <Tooltip />
            <Legend />
            {numericKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: bar chart
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data as Record<string, unknown>[]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxis} />
          <YAxis />
          <Tooltip />
          <Legend />
          {numericKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
