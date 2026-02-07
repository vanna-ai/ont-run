package resolvers

import (
	"fmt"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

// GetUserInput is the input type for the getUser function.
type GetUserInput struct {
	ID string `json:"id"`
}

// GetUserOutput is the response type for the getUser function.
type GetUserOutput struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Email string   `json:"email"`
	Tags  []string `json:"tags"` // IMPORTANT: Initialize as []string{}, not nil
}

// GetUser retrieves a user by their ID.
func GetUser(ctx ont.Context, input any) (any, error) {
	// Type assertion from map to our input type
	inputMap, ok := input.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid input type")
	}

	userID, _ := inputMap["id"].(string)

	ctx.Logger().Info("Getting user", "id", userID)

	// Example: In a real app, you'd fetch from a database
	// For demo purposes, we return a mock user
	return GetUserOutput{
		ID:    userID,
		Name:  "John Doe",
		Email: "john@example.com",
		Tags:  []string{"verified", "premium"}, // IMPORTANT: Use empty slice, not nil
	}, nil
}
