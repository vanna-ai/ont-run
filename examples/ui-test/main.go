// Minimal test server with UI-enabled tools for MCP Inspector validation.
package main

import (
	"fmt"
	"log"
	"strings"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
	"github.com/vanna-ai/ont-run/pkg/server"
)

func main() {
	config := &ont.Config{
		Name:         "ui-test",
		Title:        "UI Test Server",
		Instructions: "Test server with UI-enabled tools for MCP Inspector validation.",
		AccessGroups: map[string]ont.AccessGroup{
			"public": {Description: "Everyone"},
		},
		Entities: map[string]ont.Entity{
			"Metric": {Description: "A metric data point"},
		},
		Functions: map[string]ont.Function{
			// Table: returns array of objects (auto-detected as table)
			"salesData": {
				Description: "Get sales data as a table",
				Access:      []string{"public"},
				Entities:    []string{"Metric"},
				Inputs:      ont.Object(map[string]ont.Schema{}),
				Outputs: ont.Object(map[string]ont.Schema{
					"result": ont.Array(ont.Object(map[string]ont.Schema{
						"month":   ont.String(),
						"revenue": ont.Number(),
						"units":   ont.Integer(),
					})),
				}),
				Resolver: salesDataResolver,
				UI:       &ont.UiConfig{Type: "table"},
			},
			// Chart: returns array with chart config
			"revenueChart": {
				Description: "Get revenue data as a line chart",
				Access:      []string{"public"},
				Entities:    []string{"Metric"},
				Inputs:      ont.Object(map[string]ont.Schema{}),
				Outputs: ont.Object(map[string]ont.Schema{
					"result": ont.Array(ont.Object(map[string]ont.Schema{
						"month":   ont.String(),
						"revenue": ont.Number(),
						"units":   ont.Integer(),
					})),
				}),
				Resolver: revenueChartResolver,
				UI: &ont.UiConfig{
					Type:      "chart",
					ChartType: "line",
					XAxis:     "month",
					LeftYAxis: []string{"revenue"},
					RightYAxis: []string{"units"},
				},
			},
			// Markdown: returns a string result
			"generateReport": {
				Description: "Generate a markdown report",
				Access:      []string{"public"},
				Entities:    []string{"Metric"},
				Inputs:      ont.Object(map[string]ont.Schema{}),
				Outputs: ont.Object(map[string]ont.Schema{
					"result": ont.String(),
				}),
				Resolver: markdownResolver,
				UI:       &ont.UiConfig{Type: "markdown"},
			},
			// CSV data returned as a string in the result field
			"csvExport": {
				Description: "Export data as CSV",
				Access:      []string{"public"},
				Entities:    []string{"Metric"},
				Inputs:      ont.Object(map[string]ont.Schema{}),
				Outputs: ont.Object(map[string]ont.Schema{
					"result": ont.String(),
				}),
				Resolver: csvResolver,
				UI:       &ont.UiConfig{Type: "table"},
			},
			// No UI: plain function for comparison
			"healthCheck": {
				Description: "Check server health",
				Access:      []string{"public"},
				Entities:    []string{},
				Inputs:      ont.Object(map[string]ont.Schema{}),
				Outputs: ont.Object(map[string]ont.Schema{
					"status": ont.String(),
				}),
				Resolver: func(_ ont.Context, _ any) (any, error) {
					return map[string]any{"status": "ok"}, nil
				},
			},
		},
	}

	if err := config.Validate(); err != nil {
		log.Fatalf("Invalid config: %v", err)
	}

	log.Println("Starting UI test server on :9090...")
	if err := server.Serve(config, ":9090",
		server.WithLogger(ont.ConsoleLogger()),
		server.WithVisualizerHTML(server.DefaultVisualizerHTML()),
	); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func salesDataResolver(_ ont.Context, _ any) (any, error) {
	return map[string]any{
		"result": []map[string]any{
			{"month": "Jan", "revenue": 12000.50, "units": 150},
			{"month": "Feb", "revenue": 15300.75, "units": 190},
			{"month": "Mar", "revenue": 18200.00, "units": 230},
			{"month": "Apr", "revenue": 14100.25, "units": 170},
			{"month": "May", "revenue": 21500.00, "units": 280},
		},
	}, nil
}

func revenueChartResolver(_ ont.Context, _ any) (any, error) {
	return map[string]any{
		"result": []map[string]any{
			{"month": "Jan", "revenue": 12000.50, "units": 150},
			{"month": "Feb", "revenue": 15300.75, "units": 190},
			{"month": "Mar", "revenue": 18200.00, "units": 230},
			{"month": "Apr", "revenue": 14100.25, "units": 170},
			{"month": "May", "revenue": 21500.00, "units": 280},
			{"month": "Jun", "revenue": 23800.00, "units": 310},
		},
	}, nil
}

func markdownResolver(_ ont.Context, _ any) (any, error) {
	return map[string]any{
		"result": strings.Join([]string{
			"# Monthly Revenue Report",
			"",
			"## Summary",
			"Total revenue for H1: **$105,101.50**",
			"",
			"## Highlights",
			"- Best month: **June** ($23,800)",
			"- Worst month: **January** ($12,000)",
			"- Growth rate: **98%** (Jan to Jun)",
			"",
			"## Recommendations",
			"1. Continue the upward trend with marketing campaigns",
			"2. Investigate the April dip in revenue",
			"3. Target $30,000/month by Q4",
			"",
			fmt.Sprintf("---\n*Report generated automatically*"),
		}, "\n"),
	}, nil
}

func csvResolver(_ ont.Context, _ any) (any, error) {
	return map[string]any{
		"result": "month,revenue,units\nJan,12000.50,150\nFeb,15300.75,190\nMar,18200.00,230\nApr,14100.25,170\nMay,21500.00,280\nJun,23800.00,310",
	}, nil
}
