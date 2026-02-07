package ontology

import (
	"testing"
)

func TestStringSchemaValidation(t *testing.T) {
	tests := []struct {
		name    string
		schema  *StringSchema
		input   any
		wantErr bool
	}{
		{
			name:    "valid string",
			schema:  String(),
			input:   "hello",
			wantErr: false,
		},
		{
			name:    "invalid type",
			schema:  String(),
			input:   123,
			wantErr: true,
		},
		{
			name:    "valid uuid",
			schema:  String().UUID(),
			input:   "550e8400-e29b-41d4-a716-446655440000",
			wantErr: false,
		},
		{
			name:    "invalid uuid",
			schema:  String().UUID(),
			input:   "not-a-uuid",
			wantErr: true,
		},
		{
			name:    "valid email",
			schema:  String().Email(),
			input:   "test@example.com",
			wantErr: false,
		},
		{
			name:    "invalid email",
			schema:  String().Email(),
			input:   "not-an-email",
			wantErr: true,
		},
		{
			name:    "valid min length",
			schema:  String().Min(5),
			input:   "hello",
			wantErr: false,
		},
		{
			name:    "invalid min length",
			schema:  String().Min(10),
			input:   "hello",
			wantErr: true,
		},
		{
			name:    "valid max length",
			schema:  String().Max(10),
			input:   "hello",
			wantErr: false,
		},
		{
			name:    "invalid max length",
			schema:  String().Max(3),
			input:   "hello",
			wantErr: true,
		},
		{
			name:    "valid enum",
			schema:  String().Enum("a", "b", "c"),
			input:   "b",
			wantErr: false,
		},
		{
			name:    "invalid enum",
			schema:  String().Enum("a", "b", "c"),
			input:   "d",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.schema.Validate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNumberSchemaValidation(t *testing.T) {
	tests := []struct {
		name    string
		schema  *NumberSchema
		input   any
		wantErr bool
	}{
		{
			name:    "valid float64",
			schema:  Number(),
			input:   3.14,
			wantErr: false,
		},
		{
			name:    "valid int",
			schema:  Number(),
			input:   42,
			wantErr: false,
		},
		{
			name:    "invalid type",
			schema:  Number(),
			input:   "not a number",
			wantErr: true,
		},
		{
			name:    "valid integer",
			schema:  Integer(),
			input:   42,
			wantErr: false,
		},
		{
			name:    "invalid integer (float)",
			schema:  Integer(),
			input:   3.14,
			wantErr: true,
		},
		{
			name:    "valid min",
			schema:  Number().Min(10),
			input:   15.0,
			wantErr: false,
		},
		{
			name:    "invalid min",
			schema:  Number().Min(10),
			input:   5.0,
			wantErr: true,
		},
		{
			name:    "valid max",
			schema:  Number().Max(100),
			input:   50.0,
			wantErr: false,
		},
		{
			name:    "invalid max",
			schema:  Number().Max(100),
			input:   150.0,
			wantErr: true,
		},
		{
			name:    "valid positive",
			schema:  Number().Positive(),
			input:   5.0,
			wantErr: false,
		},
		{
			name:    "invalid positive (zero)",
			schema:  Number().Positive(),
			input:   0.0,
			wantErr: true,
		},
		{
			name:    "invalid positive (negative)",
			schema:  Number().Positive(),
			input:   -5.0,
			wantErr: true,
		},
		{
			name:    "valid non-negative (zero)",
			schema:  Number().NonNegative(),
			input:   0.0,
			wantErr: false,
		},
		{
			name:    "invalid non-negative (negative)",
			schema:  Number().NonNegative(),
			input:   -5.0,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.schema.Validate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestBooleanSchemaValidation(t *testing.T) {
	tests := []struct {
		name    string
		input   any
		wantErr bool
	}{
		{
			name:    "valid true",
			input:   true,
			wantErr: false,
		},
		{
			name:    "valid false",
			input:   false,
			wantErr: false,
		},
		{
			name:    "invalid string",
			input:   "true",
			wantErr: true,
		},
		{
			name:    "invalid number",
			input:   1,
			wantErr: true,
		},
	}

	schema := Boolean()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := schema.Validate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestArraySchemaValidation(t *testing.T) {
	tests := []struct {
		name    string
		schema  *ArraySchema
		input   any
		wantErr bool
	}{
		{
			name:    "valid string array",
			schema:  Array(String()),
			input:   []any{"a", "b", "c"},
			wantErr: false,
		},
		{
			name:    "empty array",
			schema:  Array(String()),
			input:   []any{},
			wantErr: false,
		},
		{
			name:    "nil array",
			schema:  Array(String()),
			input:   ([]any)(nil),
			wantErr: true, // nil slices are invalid
		},
		{
			name:    "invalid item type",
			schema:  Array(String()),
			input:   []any{"a", 123, "c"},
			wantErr: true,
		},
		{
			name:    "valid min items",
			schema:  Array(String()).MinItems(2),
			input:   []any{"a", "b", "c"},
			wantErr: false,
		},
		{
			name:    "invalid min items",
			schema:  Array(String()).MinItems(5),
			input:   []any{"a", "b"},
			wantErr: true,
		},
		{
			name:    "valid max items",
			schema:  Array(String()).MaxItems(5),
			input:   []any{"a", "b"},
			wantErr: false,
		},
		{
			name:    "invalid max items",
			schema:  Array(String()).MaxItems(2),
			input:   []any{"a", "b", "c", "d"},
			wantErr: true,
		},
		{
			name:    "valid non-empty",
			schema:  Array(String()).NonEmpty(),
			input:   []any{"a"},
			wantErr: false,
		},
		{
			name:    "invalid non-empty",
			schema:  Array(String()).NonEmpty(),
			input:   []any{},
			wantErr: true,
		},
		{
			name:    "not an array",
			schema:  Array(String()),
			input:   "not an array",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.schema.Validate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestObjectSchemaValidation(t *testing.T) {
	tests := []struct {
		name    string
		schema  *ObjectSchema
		input   any
		wantErr bool
	}{
		{
			name: "valid object",
			schema: Object(map[string]Schema{
				"name": String(),
				"age":  Number(),
			}),
			input: map[string]any{
				"name": "John",
				"age":  30.0,
			},
			wantErr: false,
		},
		{
			name: "missing required field",
			schema: Object(map[string]Schema{
				"name": String(),
				"age":  Number(),
			}),
			input: map[string]any{
				"name": "John",
			},
			wantErr: true,
		},
		{
			name: "optional field missing",
			schema: Object(map[string]Schema{
				"name": String(),
				"age":  Number(),
			}).Optional("age"),
			input: map[string]any{
				"name": "John",
			},
			wantErr: false,
		},
		{
			name: "invalid field type",
			schema: Object(map[string]Schema{
				"name": String(),
				"age":  Number(),
			}),
			input: map[string]any{
				"name": "John",
				"age":  "thirty",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.schema.Validate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNullableSchemaValidation(t *testing.T) {
	tests := []struct {
		name    string
		schema  *NullableSchema
		input   any
		wantErr bool
	}{
		{
			name:    "valid null",
			schema:  Nullable(String()),
			input:   nil,
			wantErr: false,
		},
		{
			name:    "valid string",
			schema:  Nullable(String()),
			input:   "hello",
			wantErr: false,
		},
		{
			name:    "invalid type",
			schema:  Nullable(String()),
			input:   123,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.schema.Validate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAnySchemaValidation(t *testing.T) {
	schema := Any()

	// Any schema should accept any value
	testCases := []any{
		"string",
		123,
		3.14,
		true,
		nil,
		[]any{1, 2, 3},
		map[string]any{"key": "value"},
	}

	for _, tc := range testCases {
		if err := schema.Validate(tc); err != nil {
			t.Errorf("Any() should accept %v, got error: %v", tc, err)
		}
	}
}

func TestJSONSchema(t *testing.T) {
	tests := []struct {
		name     string
		schema   Schema
		expected map[string]any
	}{
		{
			name:   "string",
			schema: String(),
			expected: map[string]any{
				"type": "string",
			},
		},
		{
			name:   "string with format",
			schema: String().UUID(),
			expected: map[string]any{
				"type":   "string",
				"format": "uuid",
			},
		},
		{
			name:   "number",
			schema: Number(),
			expected: map[string]any{
				"type": "number",
			},
		},
		{
			name:   "integer",
			schema: Integer(),
			expected: map[string]any{
				"type": "integer",
			},
		},
		{
			name:   "boolean",
			schema: Boolean(),
			expected: map[string]any{
				"type": "boolean",
			},
		},
		{
			name:   "array",
			schema: Array(String()),
			expected: map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "string"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.schema.JSONSchema()

			// Check type field
			if result["type"] != tt.expected["type"] {
				t.Errorf("Expected type %v, got %v", tt.expected["type"], result["type"])
			}

			// Check format if present
			if format, ok := tt.expected["format"]; ok {
				if result["format"] != format {
					t.Errorf("Expected format %v, got %v", format, result["format"])
				}
			}
		})
	}
}
