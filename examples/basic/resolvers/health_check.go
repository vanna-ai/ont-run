package resolvers

import (
	"time"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

// HealthCheckOutput is the response type for the healthCheck function.
type HealthCheckOutput struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

// HealthCheck returns the health status of the server.
func HealthCheck(ctx ont.Context, input any) (any, error) {
	ctx.Logger().Info("Health check requested")

	return HealthCheckOutput{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}, nil
}
