---
title: UI Visualization
description: Add interactive charts and tables to MCP-enabled clients like Claude Desktop
---

The UI visualization feature lets you configure how function results are displayed in MCP-enabled hosts (like Claude Desktop). Instead of raw JSON, your data automatically renders as interactive charts, tables, or other visualizations.

## Quick start

Add a `ui` config to your function definition:

```typescript
import getSalesData from './resolvers/getSalesData.js';

functions: {
  getSalesData: {
    description: 'Get sales data for visualization',
    access: ['public'],
    entities: [],
    inputs: z.object({
      region: z.string().optional(),
    }),
    outputs: z.array(z.object({
      month: z.string(),
      sales: z.number(),
      orders: z.number(),
    })),
    ui: {
      type: 'chart',
      chartType: 'bar',
      xAxis: 'month',
    },
    resolver: getSalesData,
  },
}
```

When called via MCP, the results automatically display as an interactive bar chart with months on the x-axis and numeric fields as bars.

## How it works

1. **Server**: Your function returns data (array of objects)
2. **MCP client**: Receives the result plus the `ui` config
3. **Visualizer**: The MCP client renders an interactive visualization using the config
4. **Validation**: At startup, Ontology validates that your `ui` config matches your `outputs` schema

## Configuration options

### Chart visualizations

#### `type: 'chart'`

Renders interactive Recharts visualizations. Requires:
- Outputs as **array of objects**
- At least **one numeric field** (for bars/lines)
- Optionally specify `xAxis` (categorical field)

```typescript
ui: {
  type: 'chart',
  chartType: 'bar',
  xAxis: 'month',
}
```

#### Chart types

**`chartType: 'bar'`** - Bar chart (default)
```typescript
outputs: z.array(z.object({
  category: z.string(),
  value: z.number(),
})),
ui: {
  type: 'chart',
  chartType: 'bar',
  xAxis: 'category',
}
```

**`chartType: 'line'`** - Line chart
```typescript
ui: {
  type: 'chart',
  chartType: 'line',
  xAxis: 'date',
}
```

**`chartType: 'pie'`** - Pie chart
```typescript
ui: {
  type: 'chart',
  chartType: 'pie',
  xAxis: 'label',  // Labels for pie slices
  yAxis: 'value',   // Values for slices
}
```

#### xAxis and yAxis

- **`xAxis`** (optional): Field name to use for x-axis. Must be **string or number** type. Defaults to first string field.
- **`yAxis`** (optional): Field name to use for y-axis (pie charts only). Must be **numeric**.

```typescript
outputs: z.array(z.object({
  month: z.string(),
  revenue: z.number(),
  expenses: z.number(),
})),
ui: {
  type: 'chart',
  chartType: 'bar',
  xAxis: 'month',  // Will render both revenue and expenses as bars
}
```

All numeric fields are automatically rendered unless you specify a `yAxis`.

## Validation

Ontology automatically validates your `ui` config against your `outputs` schema **at startup**. This catches configuration errors before your server runs.

### Validation checks

✓ Outputs must be an **array of objects**
```typescript
outputs: z.array(z.object({ ... }))  // ✓ valid
outputs: z.object({ ... })           // ✗ invalid
```

✓ At least **one numeric field** must exist
```typescript
outputs: z.array(z.object({
  month: z.string(),
  sales: z.number(),  // ✓ at least one number
}))
```

✓ **`xAxis` field must exist** and be string or number
```typescript
ui: {
  xAxis: 'month',  // ✓ exists and is string
  xAxis: 'id',     // ✗ doesn't exist
}
```

✓ **`yAxis` field must exist** and be numeric (when using pie charts)
```typescript
ui: {
  chartType: 'pie',
  yAxis: 'value',  // ✓ exists and is number
}
```

### Error messages

If your config is invalid, you'll see a clear error on startup:

```
Error: getSalesData: ui.xAxis 'invalidField' not found in outputs schema. 
Available: month, sales, orders
```

## Examples

### Sales dashboard with multiple metrics

```typescript
getSalesData: {
  description: 'Get sales and order metrics',
  access: ['public'],
  entities: [],
  inputs: z.object({}),
  outputs: z.array(z.object({
    month: z.string(),
    sales: z.number(),
    orders: z.number(),
    avgOrderValue: z.number(),
  })),
  ui: {
    type: 'chart',
    chartType: 'bar',
    xAxis: 'month',  // All numeric fields (sales, orders, avgOrderValue) render as bars
  },
  resolver: getSalesData,
}
```

### Category breakdown

```typescript
getCategoryBreakdown: {
  description: 'Get revenue by category',
  access: ['public'],
  entities: [],
  inputs: z.object({}),
  outputs: z.array(z.object({
    category: z.string(),
    revenue: z.number(),
  })),
  ui: {
    type: 'chart',
    chartType: 'pie',
    xAxis: 'category',
    yAxis: 'revenue',
  },
  resolver: getCategoryBreakdown,
}
```

### Time series data

```typescript
getMetrics: {
  description: 'Get daily metrics over time',
  access: ['public'],
  entities: [],
  inputs: z.object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  }),
  outputs: z.array(z.object({
    date: z.string(),
    activeUsers: z.number(),
    pageViews: z.number(),
    bounceRate: z.number(),
  })),
  ui: {
    type: 'chart',
    chartType: 'line',
    xAxis: 'date',  // Renders as line chart with time on x-axis
  },
  resolver: getMetrics,
}
```

## Regular REST API usage

The `ui` config is **MCP-specific**. When calling your function via REST API, you get raw JSON:

```bash
# REST API call
curl http://localhost:3000/api/getSalesData

# Response (raw JSON)
[
  { "month": "Jan", "sales": 4000, "orders": 240 },
  { "month": "Feb", "sales": 3000, "orders": 198 }
]
```

You can still render this data however you want in your frontend using libraries like Recharts, as shown in the dashboard template.

## Disabling visualization

To disable UI visualization for a function, omit the `ui` field:

```typescript
functions: {
  internalFunction: {
    description: 'Internal function without visualization',
    access: ['admin'],
    entities: [],
    inputs: z.object({}),
    outputs: z.array(z.object({
      id: z.string(),
      data: z.string(),
    })),
    resolver: internalFunction,
    // No ui field - MCP clients get raw JSON
  },
}
```



## Adding custom visualizations

The visualization system is extensible. To add new visualization types (tables, maps, etc.), you would:

1. Add the type to `UiConfig` in `/src/config/types.ts`
2. Add validation in `/src/config/validate-ui.ts`
3. Add rendering logic in the visualizer React app at `/src/server/mcp/apps/visualizer/`
4. Rebuild with `bun run build:apps`

For advanced usage, check the source code at `/src/config/validate-ui.ts` and `/src/server/mcp/apps/visualizer/`.

## Troubleshooting

### "ui config requires outputs to be an array of objects"

Your `outputs` schema isn't an array of objects:

```typescript
// ✗ Wrong
outputs: z.object({ month: z.string(), sales: z.number() })

// ✓ Correct
outputs: z.array(z.object({ month: z.string(), sales: z.number() }))
```

### "ui.xAxis not found in outputs schema"

The field you specified for `xAxis` doesn't exist:

```typescript
outputs: z.array(z.object({
  month: z.string(),
  sales: z.number(),
})),
ui: {
  xAxis: 'date',  // ✗ Should be 'month'
}
```

### "ui requires at least one numeric field"

Your data has no numeric fields to visualize:

```typescript
// ✗ Wrong
outputs: z.array(z.object({
  name: z.string(),
  description: z.string(),
}))

// ✓ Correct
outputs: z.array(z.object({
  name: z.string(),
  value: z.number(),
}))
```

## Best practices

1. **Be explicit** - Always specify `chartType` and `xAxis` for clear visualization behavior
2. **Match your schema** - Ensure your resolver actually returns the fields you reference
3. **Test in MCP clients** - Use Claude Desktop or similar to verify your visualization looks good
4. **Document numeric meanings** - Add descriptions to help users understand what numeric fields represent
5. **Consider your data** - Choose chart types that match your data (pie for parts of a whole, line for trends, bar for comparisons)
