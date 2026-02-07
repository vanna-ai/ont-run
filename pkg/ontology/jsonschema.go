package ontology

import (
	"encoding/json"
)

// OntologyJSONSchema generates a JSON Schema for the entire ontology.
func (c *Config) OntologyJSONSchema() ([]byte, error) {
	schema := map[string]any{
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"$id":                  "https://ont-run.com/schemas/" + c.Name,
		"title":                c.Name + " Ontology",
		"type":                 "object",
		"additionalProperties": false,
		"properties": map[string]any{
			"name": map[string]any{
				"type":        "string",
				"description": "The name of this ontology",
			},
			"accessGroups": c.accessGroupsSchema(),
			"entities":     c.entitiesSchema(),
			"functions":    c.functionsSchema(),
		},
		"required": []string{"name", "accessGroups", "entities", "functions"},
	}

	return json.MarshalIndent(schema, "", "  ")
}

func (c *Config) accessGroupsSchema() map[string]any {
	props := make(map[string]any)
	for name, group := range c.AccessGroups {
		props[name] = map[string]any{
			"type": "object",
			"properties": map[string]any{
				"description": map[string]any{
					"type":  "string",
					"const": group.Description,
				},
			},
			"required": []string{"description"},
		}
	}

	return map[string]any{
		"type":        "object",
		"description": "Access groups define authorization levels",
		"properties":  props,
		"required":    sortedKeys(c.AccessGroups),
	}
}

func (c *Config) entitiesSchema() map[string]any {
	props := make(map[string]any)
	for name, entity := range c.Entities {
		props[name] = map[string]any{
			"type": "object",
			"properties": map[string]any{
				"description": map[string]any{
					"type":  "string",
					"const": entity.Description,
				},
			},
			"required": []string{"description"},
		}
	}

	return map[string]any{
		"type":        "object",
		"description": "Entities represent domain objects",
		"properties":  props,
		"required":    sortedKeys(c.Entities),
	}
}

func (c *Config) functionsSchema() map[string]any {
	props := make(map[string]any)
	for name, fn := range c.Functions {
		props[name] = map[string]any{
			"type":        "object",
			"description": fn.Description,
			"properties": map[string]any{
				"description": map[string]any{
					"type":  "string",
					"const": fn.Description,
				},
				"access": map[string]any{
					"type":  "array",
					"items": map[string]any{"type": "string"},
					"enum":  []any{fn.Access},
				},
				"entities": map[string]any{
					"type":  "array",
					"items": map[string]any{"type": "string"},
				},
				"inputs":  fn.Inputs.JSONSchema(),
				"outputs": fn.Outputs.JSONSchema(),
			},
			"required": []string{"description", "access", "inputs", "outputs"},
		}
	}

	return map[string]any{
		"type":        "object",
		"description": "Functions define the API endpoints",
		"properties":  props,
		"required":    sortedKeys(c.Functions),
	}
}

// FunctionInputSchema generates JSON Schema for a function's inputs.
func (f *Function) FunctionInputSchema() ([]byte, error) {
	return json.MarshalIndent(f.Inputs.JSONSchema(), "", "  ")
}

// FunctionOutputSchema generates JSON Schema for a function's outputs.
func (f *Function) FunctionOutputSchema() ([]byte, error) {
	return json.MarshalIndent(f.Outputs.JSONSchema(), "", "  ")
}

// AllFunctionSchemas generates JSON Schemas for all functions in the ontology.
func (c *Config) AllFunctionSchemas() map[string]FunctionSchemas {
	result := make(map[string]FunctionSchemas)
	for name, fn := range c.Functions {
		result[name] = FunctionSchemas{
			Input:  fn.Inputs.JSONSchema(),
			Output: fn.Outputs.JSONSchema(),
		}
	}
	return result
}

// FunctionSchemas holds both input and output schemas for a function.
type FunctionSchemas struct {
	Input  map[string]any `json:"input"`
	Output map[string]any `json:"output"`
}
