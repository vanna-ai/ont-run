package typescript

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/vanna-ai/ont-run/pkg/ontology"
)

func TestGenerateTypeScript(t *testing.T) {
	config := &ontology.Config{
		Name: "test",
		AccessGroups: map[string]ontology.AccessGroup{
			"admin": {Description: "Admins"},
		},
		Entities: map[string]ontology.Entity{
			"User": {Description: "A user"},
		},
		Functions: map[string]ontology.Function{
			"getUser": {
				Description: "Get a user by ID",
				Access:      []string{"admin"},
				Entities:    []string{"User"},
				Inputs: ontology.Object(map[string]ontology.Schema{
					"id": ontology.String().UUID(),
				}),
				Outputs: ontology.Object(map[string]ontology.Schema{
					"name":  ontology.String(),
					"email": ontology.String().Email(),
					"tags":  ontology.Array(ontology.String()),
				}),
			},
		},
	}

	tmpDir := t.TempDir()

	if err := GenerateTypeScript(config, tmpDir); err != nil {
		t.Fatalf("Failed to generate TypeScript: %v", err)
	}

	// Verify files exist
	typesPath := filepath.Join(tmpDir, "types.ts")
	indexPath := filepath.Join(tmpDir, "index.ts")

	if _, err := os.Stat(typesPath); err != nil {
		t.Error("types.ts should exist")
	}

	if _, err := os.Stat(indexPath); err != nil {
		t.Error("index.ts should exist")
	}

	// Verify types.ts content
	typesContent, err := os.ReadFile(typesPath)
	if err != nil {
		t.Fatalf("Failed to read types.ts: %v", err)
	}

	typesStr := string(typesContent)

	if !strings.Contains(typesStr, "export interface GetUserInput") {
		t.Error("types.ts should contain GetUserInput interface")
	}

	if !strings.Contains(typesStr, "export interface GetUserOutput") {
		t.Error("types.ts should contain GetUserOutput interface")
	}

	if !strings.Contains(typesStr, "id: string") {
		t.Error("types.ts should contain id field")
	}

	if !strings.Contains(typesStr, "tags: string[]") {
		t.Error("types.ts should contain tags array field")
	}

	// Verify index.ts content
	indexContent, err := os.ReadFile(indexPath)
	if err != nil {
		t.Fatalf("Failed to read index.ts: %v", err)
	}

	indexStr := string(indexContent)

	if !strings.Contains(indexStr, "export class OntologyClient") {
		t.Error("index.ts should contain OntologyClient class")
	}

	if !strings.Contains(indexStr, "async getUser(input: Types.GetUserInput)") {
		t.Error("index.ts should contain getUser method")
	}

	if !strings.Contains(indexStr, "import type * as Types from './types'") {
		t.Error("index.ts should import types")
	}
}

func TestGenerateTypeScriptMultipleFunctions(t *testing.T) {
	config := &ontology.Config{
		Name: "test",
		AccessGroups: map[string]ontology.AccessGroup{
			"admin":  {Description: "Admins"},
			"public": {Description: "Public"},
		},
		Entities: map[string]ontology.Entity{},
		Functions: map[string]ontology.Function{
			"healthCheck": {
				Description: "Check health",
				Access:      []string{"public"},
				Inputs:      ontology.Object(map[string]ontology.Schema{}),
				Outputs: ontology.Object(map[string]ontology.Schema{
					"status": ontology.String(),
				}),
			},
			"getUser": {
				Description: "Get user",
				Access:      []string{"admin"},
				Inputs: ontology.Object(map[string]ontology.Schema{
					"id": ontology.String(),
				}),
				Outputs: ontology.Object(map[string]ontology.Schema{
					"name": ontology.String(),
				}),
			},
			"createUser": {
				Description: "Create user",
				Access:      []string{"admin"},
				Inputs: ontology.Object(map[string]ontology.Schema{
					"name":  ontology.String(),
					"email": ontology.String().Email(),
				}),
				Outputs: ontology.Object(map[string]ontology.Schema{
					"id": ontology.String(),
				}),
			},
		},
	}

	tmpDir := t.TempDir()

	if err := GenerateTypeScript(config, tmpDir); err != nil {
		t.Fatalf("Failed to generate TypeScript: %v", err)
	}

	indexContent, err := os.ReadFile(filepath.Join(tmpDir, "index.ts"))
	if err != nil {
		t.Fatalf("Failed to read index.ts: %v", err)
	}

	indexStr := string(indexContent)

	// All methods should be present
	expectedMethods := []string{"healthCheck", "getUser", "createUser"}
	for _, method := range expectedMethods {
		if !strings.Contains(indexStr, "async "+method+"(") {
			t.Errorf("index.ts should contain %s method", method)
		}
	}
}

func TestGenerateTypeScriptComplexTypes(t *testing.T) {
	config := &ontology.Config{
		Name: "test",
		AccessGroups: map[string]ontology.AccessGroup{
			"admin": {Description: "Admins"},
		},
		Entities: map[string]ontology.Entity{},
		Functions: map[string]ontology.Function{
			"complexFunction": {
				Description: "A function with complex types",
				Access:      []string{"admin"},
				Inputs: ontology.Object(map[string]ontology.Schema{
					"count":    ontology.Integer(),
					"optional": ontology.Nullable(ontology.String()),
				}),
				Outputs: ontology.Object(map[string]ontology.Schema{
					"items": ontology.Array(ontology.Object(map[string]ontology.Schema{
						"id":   ontology.String(),
						"name": ontology.String(),
					})),
					"total":   ontology.Integer(),
					"success": ontology.Boolean(),
				}),
			},
		},
	}

	tmpDir := t.TempDir()

	if err := GenerateTypeScript(config, tmpDir); err != nil {
		t.Fatalf("Failed to generate TypeScript: %v", err)
	}

	typesContent, err := os.ReadFile(filepath.Join(tmpDir, "types.ts"))
	if err != nil {
		t.Fatalf("Failed to read types.ts: %v", err)
	}

	typesStr := string(typesContent)

	// Check for complex output type
	if !strings.Contains(typesStr, "ComplexFunctionOutput") {
		t.Error("types.ts should contain ComplexFunctionOutput interface")
	}

	if !strings.Contains(typesStr, "total: number") {
		t.Error("types.ts should contain total field as number")
	}

	if !strings.Contains(typesStr, "success: boolean") {
		t.Error("types.ts should contain success field as boolean")
	}
}

func TestGenerateTypeScriptDeterministic(t *testing.T) {
	config := &ontology.Config{
		Name: "test",
		AccessGroups: map[string]ontology.AccessGroup{
			"admin": {Description: "Admins"},
		},
		Entities: map[string]ontology.Entity{},
		Functions: map[string]ontology.Function{
			"zFunction": {
				Description: "Z function",
				Access:      []string{"admin"},
				Inputs:      ontology.Object(map[string]ontology.Schema{}),
				Outputs:     ontology.Object(map[string]ontology.Schema{"z": ontology.String()}),
			},
			"aFunction": {
				Description: "A function",
				Access:      []string{"admin"},
				Inputs:      ontology.Object(map[string]ontology.Schema{}),
				Outputs:     ontology.Object(map[string]ontology.Schema{"a": ontology.String()}),
			},
			"mFunction": {
				Description: "M function",
				Access:      []string{"admin"},
				Inputs:      ontology.Object(map[string]ontology.Schema{}),
				Outputs:     ontology.Object(map[string]ontology.Schema{"m": ontology.String()}),
			},
		},
	}

	tmpDir1 := t.TempDir()
	tmpDir2 := t.TempDir()

	// Generate twice
	if err := GenerateTypeScript(config, tmpDir1); err != nil {
		t.Fatalf("Failed to generate TypeScript (1): %v", err)
	}

	if err := GenerateTypeScript(config, tmpDir2); err != nil {
		t.Fatalf("Failed to generate TypeScript (2): %v", err)
	}

	// Compare outputs
	types1, _ := os.ReadFile(filepath.Join(tmpDir1, "types.ts"))
	types2, _ := os.ReadFile(filepath.Join(tmpDir2, "types.ts"))

	if string(types1) != string(types2) {
		t.Error("Generated types.ts should be identical")
	}

	index1, _ := os.ReadFile(filepath.Join(tmpDir1, "index.ts"))
	index2, _ := os.ReadFile(filepath.Join(tmpDir2, "index.ts"))

	if string(index1) != string(index2) {
		t.Error("Generated index.ts should be identical")
	}

	// Check that functions are in alphabetical order
	indexStr := string(index1)
	aPos := strings.Index(indexStr, "async aFunction")
	mPos := strings.Index(indexStr, "async mFunction")
	zPos := strings.Index(indexStr, "async zFunction")

	if aPos == -1 || mPos == -1 || zPos == -1 {
		t.Error("All functions should be present")
	}

	if !(aPos < mPos && mPos < zPos) {
		t.Error("Functions should be in alphabetical order")
	}
}
