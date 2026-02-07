package resolvers

import (
	"fmt"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

// ListUsersInput is the input type for the listUsers function.
type ListUsersInput struct {
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
}

// UserSummary represents a user in the list.
type UserSummary struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// ListUsersOutput is the response type for the listUsers function.
type ListUsersOutput struct {
	Users []UserSummary `json:"users"` // IMPORTANT: Initialize as empty slice, not nil
	Total int           `json:"total"`
	Page  int           `json:"page"`
}

// ListUsers retrieves a paginated list of users.
func ListUsers(ctx ont.Context, input any) (any, error) {
	// Type assertion from map to our input type
	inputMap, ok := input.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid input type")
	}

	page := 1
	pageSize := 10

	if p, ok := inputMap["page"].(float64); ok {
		page = int(p)
	}
	if ps, ok := inputMap["pageSize"].(float64); ok {
		pageSize = int(ps)
	}

	ctx.Logger().Info("Listing users", "page", page, "pageSize", pageSize)

	// Example: In a real app, you'd fetch from a database with pagination
	// For demo purposes, we return mock users
	users := []UserSummary{
		{ID: "1", Name: "John Doe", Email: "john@example.com"},
		{ID: "2", Name: "Jane Smith", Email: "jane@example.com"},
		{ID: "3", Name: "Bob Wilson", Email: "bob@example.com"},
	}

	// Simulate pagination
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > len(users) {
		start = len(users)
	}
	if end > len(users) {
		end = len(users)
	}

	return ListUsersOutput{
		Users: users[start:end], // This creates a slice, never nil
		Total: len(users),
		Page:  page,
	}, nil
}
