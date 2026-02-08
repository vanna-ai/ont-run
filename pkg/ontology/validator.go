package ontology

import (
	"fmt"
	"reflect"
)

// Validate checks if the ontology configuration is valid.
// It validates required fields and semantic rules.
func (c *Config) Validate() error {
	// Validate required fields
	if c.Name == "" {
		return fmt.Errorf("config validation failed: name is required")
	}
	if c.AccessGroups == nil {
		return fmt.Errorf("config validation failed: accessGroups is required")
	}
	if c.Entities == nil {
		return fmt.Errorf("config validation failed: entities is required")
	}
	if c.Functions == nil {
		return fmt.Errorf("config validation failed: functions is required")
	}

	// Validate access groups
	for name, group := range c.AccessGroups {
		if group.Description == "" {
			return fmt.Errorf("access group '%s': description is required", name)
		}
	}

	// Validate entities
	for name, entity := range c.Entities {
		if entity.Description == "" {
			return fmt.Errorf("entity '%s': description is required", name)
		}
	}

	// Validate functions and semantic rules
	if err := c.validateSemantics(); err != nil {
		return err
	}

	return nil
}

// validateSemantics checks semantic rules that can't be expressed in struct tags.
func (c *Config) validateSemantics() error {
	// Validate each function
	for name, fn := range c.Functions {
		// Check required fields
		if fn.Description == "" {
			return fmt.Errorf("function '%s': description is required", name)
		}
		if len(fn.Access) == 0 {
			return fmt.Errorf("function '%s': at least one access group is required", name)
		}

		// Check that all access groups referenced exist
		for _, accessGroup := range fn.Access {
			if _, exists := c.AccessGroups[accessGroup]; !exists {
				return fmt.Errorf("function '%s' references unknown access group '%s'", name, accessGroup)
			}
		}

		// Check that all entities referenced exist
		for _, entity := range fn.Entities {
			if _, exists := c.Entities[entity]; !exists {
				return fmt.Errorf("function '%s' references unknown entity '%s'", name, entity)
			}
		}

		// Validate that inputs and outputs are valid schemas
		if fn.Inputs == nil {
			return fmt.Errorf("function '%s' has nil inputs schema", name)
		}
		if fn.Outputs == nil {
			return fmt.Errorf("function '%s' has nil outputs schema", name)
		}
	}

	return nil
}

// ValidateInput validates input data against a function's input schema.
func (f *Function) ValidateInput(input any) error {
	if err := f.Inputs.Validate(input); err != nil {
		return fmt.Errorf("input validation failed: %w", err)
	}
	return nil
}

// ValidateOutput validates output data against a function's output schema.
// This also checks for nil slices which would serialize to JSON null.
func (f *Function) ValidateOutput(output any) error {
	if err := f.Outputs.Validate(output); err != nil {
		return fmt.Errorf("output validation failed: %w", err)
	}
	return nil
}

// InitializeNilSlices ensures all nil slices in a struct become empty slices.
// This prevents Go's nil -> JSON null -> TypeScript runtime errors.
// It modifies the struct in place if possible.
func InitializeNilSlices(v any) any {
	return initializeNilSlicesRecursive(reflect.ValueOf(v))
}

func initializeNilSlicesRecursive(val reflect.Value) any {
	// Handle pointers
	if val.Kind() == reflect.Ptr {
		if val.IsNil() {
			return nil
		}
		elem := val.Elem()
		initializeNilSlicesRecursive(elem)
		return val.Interface()
	}

	// Handle structs
	if val.Kind() == reflect.Struct {
		for i := 0; i < val.NumField(); i++ {
			field := val.Field(i)

			if !field.CanSet() {
				continue
			}

			if field.Kind() == reflect.Slice && field.IsNil() {
				// Initialize nil slice to empty slice
				field.Set(reflect.MakeSlice(field.Type(), 0, 0))
			} else if field.Kind() == reflect.Struct {
				// Recursively handle nested structs
				initializeNilSlicesRecursive(field)
			} else if field.Kind() == reflect.Ptr && !field.IsNil() {
				// Recursively handle pointers to structs
				initializeNilSlicesRecursive(field)
			} else if field.Kind() == reflect.Slice && !field.IsNil() {
				// Check slice elements for structs
				for j := 0; j < field.Len(); j++ {
					elem := field.Index(j)
					if elem.Kind() == reflect.Struct || (elem.Kind() == reflect.Ptr && !elem.IsNil()) {
						initializeNilSlicesRecursive(elem)
					}
				}
			}
		}
	}

	return val.Interface()
}

// CheckAccess verifies that the user has access to call a function.
func (f *Function) CheckAccess(userAccessGroups []string) bool {
	if len(f.Access) == 0 {
		return true // No restrictions
	}

	for _, requiredGroup := range f.Access {
		for _, userGroup := range userAccessGroups {
			if requiredGroup == userGroup {
				return true
			}
		}
	}

	return false
}

// ValidationError represents a validation error with context.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("field '%s': %s", e.Field, e.Message)
	}
	return e.Message
}

// ValidationErrors is a collection of validation errors.
type ValidationErrors []*ValidationError

func (e ValidationErrors) Error() string {
	if len(e) == 0 {
		return "no validation errors"
	}
	if len(e) == 1 {
		return e[0].Error()
	}
	result := fmt.Sprintf("%d validation errors:\n", len(e))
	for _, err := range e {
		result += "  - " + err.Error() + "\n"
	}
	return result
}
