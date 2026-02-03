// Package typescript generates TypeScript SDK clients from ontology configurations.
package typescript

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/vanna-ai/ont-run/pkg/ontology"
)

// GenerateTypeScript generates a TypeScript SDK in the specified output directory.
func GenerateTypeScript(config *ontology.Config, outputDir string) error {
	// Create output directory
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Generate types.ts
	if err := generateTypes(config, outputDir); err != nil {
		return fmt.Errorf("failed to generate types.ts: %w", err)
	}

	// Generate index.ts (client)
	if err := generateClient(config, outputDir); err != nil {
		return fmt.Errorf("failed to generate index.ts: %w", err)
	}

	return nil
}

func generateTypes(config *ontology.Config, outputDir string) error {
	var buf bytes.Buffer

	buf.WriteString("// Auto-generated from ont.lock - do not edit manually\n\n")

	// Get sorted function names for deterministic output
	funcNames := make([]string, 0, len(config.Functions))
	for name := range config.Functions {
		funcNames = append(funcNames, name)
	}
	sort.Strings(funcNames)

	// Generate interface for each function's inputs/outputs
	for _, name := range funcNames {
		fn := config.Functions[name]

		// Generate input type
		buf.WriteString(fmt.Sprintf("export interface %sInput {\n", capitalize(name)))
		writeObjectProperties(&buf, fn.Inputs, "  ")
		buf.WriteString("}\n\n")

		// Generate output type
		buf.WriteString(fmt.Sprintf("export interface %sOutput {\n", capitalize(name)))
		writeObjectProperties(&buf, fn.Outputs, "  ")
		buf.WriteString("}\n\n")
	}

	return os.WriteFile(filepath.Join(outputDir, "types.ts"), buf.Bytes(), 0644)
}

func writeObjectProperties(buf *bytes.Buffer, schema ontology.Schema, indent string) {
	obj, ok := schema.(*ontology.ObjectSchema)
	if !ok {
		return
	}

	// Get sorted property names for deterministic output
	propNames := make([]string, 0, len(obj.Properties()))
	for name := range obj.Properties() {
		propNames = append(propNames, name)
	}
	sort.Strings(propNames)

	requiredSet := make(map[string]bool)
	for _, name := range obj.Required() {
		requiredSet[name] = true
	}

	for _, propName := range propNames {
		propSchema := obj.Properties()[propName]
		tsType := schemaToTypeScript(propSchema)
		optional := ""
		if !requiredSet[propName] {
			optional = "?"
		}

		// Add format comment if applicable
		comment := getFormatComment(propSchema)
		if comment != "" {
			buf.WriteString(fmt.Sprintf("%s%s%s: %s; // %s\n", indent, propName, optional, tsType, comment))
		} else {
			buf.WriteString(fmt.Sprintf("%s%s%s: %s;\n", indent, propName, optional, tsType))
		}
	}
}

func schemaToTypeScript(schema ontology.Schema) string {
	switch s := schema.(type) {
	case *ontology.StringSchema:
		return "string"
	case *ontology.NumberSchema:
		return "number"
	case *ontology.BooleanSchema:
		return "boolean"
	case *ontology.ArraySchema:
		itemType := schemaToTypeScript(s.ItemSchema())
		return itemType + "[]"
	case *ontology.ObjectSchema:
		// Inline object type
		var buf bytes.Buffer
		buf.WriteString("{ ")
		propNames := make([]string, 0, len(s.Properties()))
		for name := range s.Properties() {
			propNames = append(propNames, name)
		}
		sort.Strings(propNames)

		requiredSet := make(map[string]bool)
		for _, name := range s.Required() {
			requiredSet[name] = true
		}

		for i, propName := range propNames {
			propSchema := s.Properties()[propName]
			tsType := schemaToTypeScript(propSchema)
			optional := ""
			if !requiredSet[propName] {
				optional = "?"
			}
			if i > 0 {
				buf.WriteString(" ")
			}
			buf.WriteString(fmt.Sprintf("%s%s: %s;", propName, optional, tsType))
		}
		buf.WriteString(" }")
		return buf.String()
	case *ontology.NullableSchema:
		innerType := schemaToTypeScript(s.InnerSchema())
		return innerType + " | null"
	case *ontology.AnySchema:
		return "unknown"
	default:
		return "unknown"
	}
}

func getFormatComment(schema ontology.Schema) string {
	if s, ok := schema.(*ontology.StringSchema); ok {
		if s.Format() != "" {
			return s.Format() + " format"
		}
	}
	return ""
}

func generateClient(config *ontology.Config, outputDir string) error {
	var buf bytes.Buffer

	buf.WriteString("// Auto-generated from ont.lock - do not edit manually\n\n")
	buf.WriteString("import type * as Types from './types';\n\n")
	buf.WriteString("export * from './types';\n\n")

	// Generate error class
	buf.WriteString(`export class OntologyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly functionName: string
  ) {
    super(message);
    this.name = 'OntologyError';
  }
}

`)

	// Generate client class
	buf.WriteString("export class OntologyClient {\n")
	buf.WriteString("  constructor(private baseUrl: string = 'http://localhost:8080') {}\n\n")

	// Get sorted function names for deterministic output
	funcNames := make([]string, 0, len(config.Functions))
	for name := range config.Functions {
		funcNames = append(funcNames, name)
	}
	sort.Strings(funcNames)

	// Generate method for each function
	for _, name := range funcNames {
		fn := config.Functions[name]
		inputType := capitalize(name) + "Input"
		outputType := capitalize(name) + "Output"

		// JSDoc comment
		buf.WriteString(fmt.Sprintf("  /**\n"))
		buf.WriteString(fmt.Sprintf("   * %s\n", fn.Description))
		buf.WriteString(fmt.Sprintf("   */\n"))

		// Method signature
		buf.WriteString(fmt.Sprintf("  async %s(input: Types.%s): Promise<Types.%s> {\n", name, inputType, outputType))
		buf.WriteString(fmt.Sprintf("    const response = await fetch(`${this.baseUrl}/api/%s`, {\n", name))
		buf.WriteString("      method: 'POST',\n")
		buf.WriteString("      headers: { 'Content-Type': 'application/json' },\n")
		buf.WriteString("      body: JSON.stringify(input),\n")
		buf.WriteString("    });\n\n")
		buf.WriteString("    if (!response.ok) {\n")
		buf.WriteString("      const text = await response.text();\n")
		buf.WriteString(fmt.Sprintf("      throw new OntologyError(text || response.statusText, response.status, '%s');\n", name))
		buf.WriteString("    }\n\n")
		buf.WriteString("    return response.json();\n")
		buf.WriteString("  }\n\n")
	}

	buf.WriteString("}\n")

	return os.WriteFile(filepath.Join(outputDir, "index.ts"), buf.Bytes(), 0644)
}

func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
