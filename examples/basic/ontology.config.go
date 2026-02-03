package main

import (
	ont "github.com/vanna-ai/ont-run/pkg/ontology"
	"github.com/vanna-ai/ont-run/examples/basic/resolvers"
)

func DefineOntology() *ont.Config {
	return &ont.Config{
		Name: "basic-app",

		AccessGroups: map[string]ont.AccessGroup{
			"public": {
				Description: "Unauthenticated users",
			},
			"admin": {
				Description: "Administrators with full access",
			},
		},

		Entities: map[string]ont.Entity{
			"User": {
				Description: "A user account in the system",
			},
		},

		Functions: map[string]ont.Function{
			"healthCheck": {
				Description: "Check if the server is running",
				Access:      []string{"public"},
				Entities:    []string{},
				Inputs:      ont.Object(map[string]ont.Schema{}),
				Outputs: ont.Object(map[string]ont.Schema{
					"status":    ont.String(),
					"timestamp": ont.String().DateTime(),
				}),
				Resolver: resolvers.HealthCheck,
			},
			"getUser": {
				Description: "Get user by ID",
				Access:      []string{"admin"},
				Entities:    []string{"User"},
				Inputs: ont.Object(map[string]ont.Schema{
					"id": ont.String().UUID(),
				}),
				Outputs: ont.Object(map[string]ont.Schema{
					"id":    ont.String(),
					"name":  ont.String(),
					"email": ont.String().Email(),
					"tags":  ont.Array(ont.String()), // Array - never nil
				}),
				Resolver: resolvers.GetUser,
			},
			"listUsers": {
				Description: "List all users with pagination",
				Access:      []string{"admin"},
				Entities:    []string{"User"},
				Inputs: ont.Object(map[string]ont.Schema{
					"page":     ont.Integer().Min(1),
					"pageSize": ont.Integer().Min(1).Max(100),
				}),
				Outputs: ont.Object(map[string]ont.Schema{
					"users": ont.Array(ont.Object(map[string]ont.Schema{
						"id":    ont.String(),
						"name":  ont.String(),
						"email": ont.String().Email(),
					})),
					"total": ont.Integer().NonNegative(),
					"page":  ont.Integer(),
				}),
				Resolver: resolvers.ListUsers,
			},
		},
	}
}
