package ontology

import (
	"testing"
)

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  *Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: &Config{
				Name: "test",
				AccessGroups: map[string]AccessGroup{
					"admin": {Description: "Admins"},
				},
				Entities: map[string]Entity{
					"User": {Description: "A user"},
				},
				Functions: map[string]Function{
					"getUser": {
						Description: "Get a user",
						Access:      []string{"admin"},
						Entities:    []string{"User"},
						Inputs:      Object(map[string]Schema{"id": String()}),
						Outputs:     Object(map[string]Schema{"name": String()}),
					},
				},
			},
			wantErr: false,
		},
		{
			name: "missing name",
			config: &Config{
				Name:         "",
				AccessGroups: map[string]AccessGroup{},
				Entities:     map[string]Entity{},
				Functions:    map[string]Function{},
			},
			wantErr: true,
		},
		{
			name: "function references unknown access group",
			config: &Config{
				Name: "test",
				AccessGroups: map[string]AccessGroup{
					"admin": {Description: "Admins"},
				},
				Entities: map[string]Entity{},
				Functions: map[string]Function{
					"getUser": {
						Description: "Get a user",
						Access:      []string{"nonexistent"},
						Inputs:      Object(map[string]Schema{}),
						Outputs:     Object(map[string]Schema{}),
					},
				},
			},
			wantErr: true,
		},
		{
			name: "function references unknown entity",
			config: &Config{
				Name: "test",
				AccessGroups: map[string]AccessGroup{
					"admin": {Description: "Admins"},
				},
				Entities: map[string]Entity{
					"User": {Description: "A user"},
				},
				Functions: map[string]Function{
					"getProduct": {
						Description: "Get a product",
						Access:      []string{"admin"},
						Entities:    []string{"Product"},
						Inputs:      Object(map[string]Schema{}),
						Outputs:     Object(map[string]Schema{}),
					},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestFunctionInputValidation(t *testing.T) {
	fn := Function{
		Description: "Test function",
		Access:      []string{"admin"},
		Inputs: Object(map[string]Schema{
			"name":  String().Min(1),
			"email": String().Email(),
			"age":   Integer().Min(0).Max(150),
		}),
		Outputs: Object(map[string]Schema{}),
	}

	tests := []struct {
		name    string
		input   any
		wantErr bool
	}{
		{
			name: "valid input",
			input: map[string]any{
				"name":  "John",
				"email": "john@example.com",
				"age":   30.0,
			},
			wantErr: false,
		},
		{
			name: "missing required field",
			input: map[string]any{
				"name": "John",
				"age":  30.0,
			},
			wantErr: true,
		},
		{
			name: "invalid email",
			input: map[string]any{
				"name":  "John",
				"email": "not-an-email",
				"age":   30.0,
			},
			wantErr: true,
		},
		{
			name: "age out of range",
			input: map[string]any{
				"name":  "John",
				"email": "john@example.com",
				"age":   200.0,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := fn.ValidateInput(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateInput() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestFunctionOutputValidation(t *testing.T) {
	fn := Function{
		Description: "Test function",
		Access:      []string{"admin"},
		Inputs:      Object(map[string]Schema{}),
		Outputs: Object(map[string]Schema{
			"name":  String(),
			"tags":  Array(String()),
			"score": Number().Min(0).Max(100),
		}),
	}

	tests := []struct {
		name    string
		output  any
		wantErr bool
	}{
		{
			name: "valid output",
			output: map[string]any{
				"name":  "John",
				"tags":  []any{"a", "b"},
				"score": 85.0,
			},
			wantErr: false,
		},
		{
			name: "nil array (invalid)",
			output: map[string]any{
				"name":  "John",
				"tags":  ([]any)(nil),
				"score": 85.0,
			},
			wantErr: true,
		},
		{
			name: "score out of range",
			output: map[string]any{
				"name":  "John",
				"tags":  []any{},
				"score": 150.0,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := fn.ValidateOutput(tt.output)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateOutput() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckAccess(t *testing.T) {
	tests := []struct {
		name             string
		functionAccess   []string
		userAccessGroups []string
		wantAccess       bool
	}{
		{
			name:             "user has required access",
			functionAccess:   []string{"admin"},
			userAccessGroups: []string{"admin", "user"},
			wantAccess:       true,
		},
		{
			name:             "user lacks required access",
			functionAccess:   []string{"admin"},
			userAccessGroups: []string{"user"},
			wantAccess:       false,
		},
		{
			name:             "function allows multiple groups",
			functionAccess:   []string{"admin", "support"},
			userAccessGroups: []string{"support"},
			wantAccess:       true,
		},
		{
			name:             "no access restriction",
			functionAccess:   []string{},
			userAccessGroups: []string{"user"},
			wantAccess:       true,
		},
		{
			name:             "user has no groups",
			functionAccess:   []string{"admin"},
			userAccessGroups: []string{},
			wantAccess:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fn := Function{
				Access: tt.functionAccess,
			}
			got := fn.CheckAccess(tt.userAccessGroups)
			if got != tt.wantAccess {
				t.Errorf("CheckAccess() = %v, want %v", got, tt.wantAccess)
			}
		})
	}
}

func TestInitializeNilSlices(t *testing.T) {
	type TestStruct struct {
		Name  string
		Tags  []string
		Items []int
	}

	// Create struct with nil slices
	input := &TestStruct{
		Name:  "test",
		Tags:  nil,
		Items: nil,
	}

	// Initialize nil slices
	InitializeNilSlices(input)

	// Verify slices are now empty, not nil
	if input.Tags == nil {
		t.Error("Tags should not be nil after initialization")
	}
	if len(input.Tags) != 0 {
		t.Error("Tags should be empty")
	}

	if input.Items == nil {
		t.Error("Items should not be nil after initialization")
	}
	if len(input.Items) != 0 {
		t.Error("Items should be empty")
	}
}

func TestInitializeNilSlicesNested(t *testing.T) {
	type Inner struct {
		Values []string
	}

	type Outer struct {
		Name  string
		Inner Inner
	}

	input := &Outer{
		Name: "test",
		Inner: Inner{
			Values: nil,
		},
	}

	InitializeNilSlices(input)

	if input.Inner.Values == nil {
		t.Error("Nested Values should not be nil after initialization")
	}
}
