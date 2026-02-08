package ontology

import (
	"fmt"
	"reflect"
	"regexp"
)

// Schema is the interface that all schema types must implement.
type Schema interface {
	// Validate checks if data conforms to this schema.
	Validate(data any) error
	// JSONSchema returns the JSON Schema representation.
	JSONSchema() map[string]any
	// TypeName returns the name of this schema type for error messages.
	TypeName() string
}

// ObjectSchema represents an object with named properties.
type ObjectSchema struct {
	properties map[string]Schema
	required   []string
}

// Object creates a new object schema with the given properties.
// All properties are required by default.
func Object(props map[string]Schema) *ObjectSchema {
	required := make([]string, 0, len(props))
	for name := range props {
		required = append(required, name)
	}
	return &ObjectSchema{
		properties: props,
		required:   required,
	}
}

// Optional marks specific properties as optional.
func (o *ObjectSchema) Optional(names ...string) *ObjectSchema {
	optionalSet := make(map[string]bool)
	for _, name := range names {
		optionalSet[name] = true
	}
	newRequired := make([]string, 0)
	for _, name := range o.required {
		if !optionalSet[name] {
			newRequired = append(newRequired, name)
		}
	}
	o.required = newRequired
	return o
}

// Properties returns the schema's properties.
func (o *ObjectSchema) Properties() map[string]Schema {
	return o.properties
}

// Required returns the required property names.
func (o *ObjectSchema) Required() []string {
	return o.required
}

func (o *ObjectSchema) TypeName() string {
	return "object"
}

func (o *ObjectSchema) Validate(data any) error {
	val := reflect.ValueOf(data)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	// Handle map[string]any
	if val.Kind() == reflect.Map {
		return o.validateMap(val)
	}

	// Handle struct
	if val.Kind() == reflect.Struct {
		return o.validateStruct(val)
	}

	return fmt.Errorf("expected object, got %v", val.Kind())
}

func (o *ObjectSchema) validateMap(val reflect.Value) error {
	mapData := val.Interface().(map[string]any)

	// Check required fields
	for _, reqName := range o.required {
		if _, ok := mapData[reqName]; !ok {
			return fmt.Errorf("required field '%s' is missing", reqName)
		}
	}

	// Validate each property
	for propName, propSchema := range o.properties {
		if propVal, ok := mapData[propName]; ok {
			if err := propSchema.Validate(propVal); err != nil {
				return fmt.Errorf("field '%s': %w", propName, err)
			}
		}
	}

	return nil
}

func (o *ObjectSchema) validateStruct(val reflect.Value) error {
	typ := val.Type()

	// Build a map of JSON tag names to field indices
	fieldMap := make(map[string]int)
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		jsonTag := field.Tag.Get("json")
		if jsonTag == "" || jsonTag == "-" {
			fieldMap[field.Name] = i
		} else {
			// Handle "name,omitempty" format
			name := jsonTag
			for j := 0; j < len(jsonTag); j++ {
				if jsonTag[j] == ',' {
					name = jsonTag[:j]
					break
				}
			}
			fieldMap[name] = i
		}
	}

	// Validate each property
	for propName, propSchema := range o.properties {
		fieldIdx, ok := fieldMap[propName]
		if !ok {
			// Try capitalized version
			fieldIdx, ok = fieldMap[capitalize(propName)]
		}

		if !ok {
			if contains(o.required, propName) {
				return fmt.Errorf("required field '%s' is missing", propName)
			}
			continue
		}

		fieldVal := val.Field(fieldIdx)
		if err := propSchema.Validate(fieldVal.Interface()); err != nil {
			return fmt.Errorf("field '%s': %w", propName, err)
		}
	}

	return nil
}

func (o *ObjectSchema) JSONSchema() map[string]any {
	props := make(map[string]any)
	for name, schema := range o.properties {
		props[name] = schema.JSONSchema()
	}

	result := map[string]any{
		"type":       "object",
		"properties": props,
	}

	if len(o.required) > 0 {
		result["required"] = o.required
	}

	return result
}

// StringSchema represents a string value with optional constraints.
type StringSchema struct {
	format    string
	minLength *int
	maxLength *int
	pattern   *regexp.Regexp
	enum      []string
}

// String creates a new string schema.
func String() *StringSchema {
	return &StringSchema{}
}

// UUID constrains the string to UUID format.
func (s *StringSchema) UUID() *StringSchema {
	s.format = "uuid"
	return s
}

// Email constrains the string to email format.
func (s *StringSchema) Email() *StringSchema {
	s.format = "email"
	return s
}

// DateTime constrains the string to date-time format.
func (s *StringSchema) DateTime() *StringSchema {
	s.format = "date-time"
	return s
}

// Date constrains the string to date format.
func (s *StringSchema) Date() *StringSchema {
	s.format = "date"
	return s
}

// URI constrains the string to URI format.
func (s *StringSchema) URI() *StringSchema {
	s.format = "uri"
	return s
}

// Min sets the minimum string length.
func (s *StringSchema) Min(min int) *StringSchema {
	s.minLength = &min
	return s
}

// Max sets the maximum string length.
func (s *StringSchema) Max(max int) *StringSchema {
	s.maxLength = &max
	return s
}

// Pattern constrains the string to match a regex pattern.
func (s *StringSchema) Pattern(pattern string) *StringSchema {
	s.pattern = regexp.MustCompile(pattern)
	return s
}

// Enum constrains the string to a set of allowed values.
func (s *StringSchema) Enum(values ...string) *StringSchema {
	s.enum = values
	return s
}

// Format returns the string format constraint.
func (s *StringSchema) Format() string {
	return s.format
}

func (s *StringSchema) TypeName() string {
	return "string"
}

func (s *StringSchema) Validate(data any) error {
	str, ok := data.(string)
	if !ok {
		return fmt.Errorf("expected string, got %T", data)
	}

	if s.minLength != nil && len(str) < *s.minLength {
		return fmt.Errorf("string length %d is less than minimum %d", len(str), *s.minLength)
	}

	if s.maxLength != nil && len(str) > *s.maxLength {
		return fmt.Errorf("string length %d exceeds maximum %d", len(str), *s.maxLength)
	}

	if s.pattern != nil && !s.pattern.MatchString(str) {
		return fmt.Errorf("string does not match pattern")
	}

	if len(s.enum) > 0 {
		found := false
		for _, v := range s.enum {
			if v == str {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("string '%s' is not one of the allowed values: %v", str, s.enum)
		}
	}

	// Format validation
	if s.format != "" {
		if err := s.validateFormat(str); err != nil {
			return err
		}
	}

	return nil
}

func (s *StringSchema) validateFormat(str string) error {
	switch s.format {
	case "uuid":
		uuidPattern := regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
		if !uuidPattern.MatchString(str) {
			return fmt.Errorf("string is not a valid UUID")
		}
	case "email":
		emailPattern := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
		if !emailPattern.MatchString(str) {
			return fmt.Errorf("string is not a valid email")
		}
	case "date-time":
		// Basic ISO 8601 check
		dateTimePattern := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}`)
		if !dateTimePattern.MatchString(str) {
			return fmt.Errorf("string is not a valid date-time")
		}
	case "date":
		datePattern := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
		if !datePattern.MatchString(str) {
			return fmt.Errorf("string is not a valid date")
		}
	case "uri":
		uriPattern := regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9+.-]*:`)
		if !uriPattern.MatchString(str) {
			return fmt.Errorf("string is not a valid URI")
		}
	}
	return nil
}

func (s *StringSchema) JSONSchema() map[string]any {
	result := map[string]any{
		"type": "string",
	}

	if s.format != "" {
		result["format"] = s.format
	}
	if s.minLength != nil {
		result["minLength"] = *s.minLength
	}
	if s.maxLength != nil {
		result["maxLength"] = *s.maxLength
	}
	if s.pattern != nil {
		result["pattern"] = s.pattern.String()
	}
	if len(s.enum) > 0 {
		result["enum"] = s.enum
	}

	return result
}

// NumberSchema represents a numeric value with optional constraints.
type NumberSchema struct {
	minimum          *float64
	maximum          *float64
	exclusiveMinimum *float64
	exclusiveMaximum *float64
	multipleOf       *float64
	isInteger        bool
}

// Number creates a new number schema.
func Number() *NumberSchema {
	return &NumberSchema{}
}

// Integer creates a new integer schema.
func Integer() *NumberSchema {
	return &NumberSchema{isInteger: true}
}

// Min sets the minimum value.
func (n *NumberSchema) Min(min float64) *NumberSchema {
	n.minimum = &min
	return n
}

// Max sets the maximum value.
func (n *NumberSchema) Max(max float64) *NumberSchema {
	n.maximum = &max
	return n
}

// ExclusiveMin sets an exclusive minimum value.
func (n *NumberSchema) ExclusiveMin(min float64) *NumberSchema {
	n.exclusiveMinimum = &min
	return n
}

// ExclusiveMax sets an exclusive maximum value.
func (n *NumberSchema) ExclusiveMax(max float64) *NumberSchema {
	n.exclusiveMaximum = &max
	return n
}

// MultipleOf constrains the number to be a multiple of the given value.
func (n *NumberSchema) MultipleOf(val float64) *NumberSchema {
	n.multipleOf = &val
	return n
}

// Positive constrains the number to be positive (> 0).
func (n *NumberSchema) Positive() *NumberSchema {
	zero := 0.0
	n.exclusiveMinimum = &zero
	return n
}

// Negative constrains the number to be negative (< 0).
func (n *NumberSchema) Negative() *NumberSchema {
	zero := 0.0
	n.exclusiveMaximum = &zero
	return n
}

// NonNegative constrains the number to be non-negative (>= 0).
func (n *NumberSchema) NonNegative() *NumberSchema {
	zero := 0.0
	n.minimum = &zero
	return n
}

func (n *NumberSchema) TypeName() string {
	if n.isInteger {
		return "integer"
	}
	return "number"
}

func (n *NumberSchema) Validate(data any) error {
	var num float64

	switch v := data.(type) {
	case float64:
		num = v
	case float32:
		num = float64(v)
	case int:
		num = float64(v)
	case int64:
		num = float64(v)
	case int32:
		num = float64(v)
	default:
		return fmt.Errorf("expected number, got %T", data)
	}

	if n.isInteger {
		if num != float64(int64(num)) {
			return fmt.Errorf("expected integer, got %v", num)
		}
	}

	if n.minimum != nil && num < *n.minimum {
		return fmt.Errorf("number %v is less than minimum %v", num, *n.minimum)
	}

	if n.maximum != nil && num > *n.maximum {
		return fmt.Errorf("number %v exceeds maximum %v", num, *n.maximum)
	}

	if n.exclusiveMinimum != nil && num <= *n.exclusiveMinimum {
		return fmt.Errorf("number %v must be greater than %v", num, *n.exclusiveMinimum)
	}

	if n.exclusiveMaximum != nil && num >= *n.exclusiveMaximum {
		return fmt.Errorf("number %v must be less than %v", num, *n.exclusiveMaximum)
	}

	if n.multipleOf != nil && num != 0 {
		remainder := num / *n.multipleOf
		if remainder != float64(int64(remainder)) {
			return fmt.Errorf("number %v is not a multiple of %v", num, *n.multipleOf)
		}
	}

	return nil
}

func (n *NumberSchema) JSONSchema() map[string]any {
	var result map[string]any
	if n.isInteger {
		result = map[string]any{"type": "integer"}
	} else {
		result = map[string]any{"type": "number"}
	}

	if n.minimum != nil {
		result["minimum"] = *n.minimum
	}
	if n.maximum != nil {
		result["maximum"] = *n.maximum
	}
	if n.exclusiveMinimum != nil {
		result["exclusiveMinimum"] = *n.exclusiveMinimum
	}
	if n.exclusiveMaximum != nil {
		result["exclusiveMaximum"] = *n.exclusiveMaximum
	}
	if n.multipleOf != nil {
		result["multipleOf"] = *n.multipleOf
	}

	return result
}

// BooleanSchema represents a boolean value.
type BooleanSchema struct{}

// Boolean creates a new boolean schema.
func Boolean() *BooleanSchema {
	return &BooleanSchema{}
}

func (b *BooleanSchema) TypeName() string {
	return "boolean"
}

func (b *BooleanSchema) Validate(data any) error {
	if _, ok := data.(bool); !ok {
		return fmt.Errorf("expected boolean, got %T", data)
	}
	return nil
}

func (b *BooleanSchema) JSONSchema() map[string]any {
	return map[string]any{"type": "boolean"}
}

// ArraySchema represents an array of items.
type ArraySchema struct {
	items    Schema
	minItems *int
	maxItems *int
}

// Array creates a new array schema with the given item schema.
func Array(items Schema) *ArraySchema {
	return &ArraySchema{items: items}
}

// MinItems sets the minimum number of items.
func (a *ArraySchema) MinItems(min int) *ArraySchema {
	a.minItems = &min
	return a
}

// MaxItems sets the maximum number of items.
func (a *ArraySchema) MaxItems(max int) *ArraySchema {
	a.maxItems = &max
	return a
}

// NonEmpty ensures the array has at least one item.
func (a *ArraySchema) NonEmpty() *ArraySchema {
	one := 1
	a.minItems = &one
	return a
}

// ItemSchema returns the schema for array items.
func (a *ArraySchema) ItemSchema() Schema {
	return a.items
}

func (a *ArraySchema) TypeName() string {
	return "array"
}

func (a *ArraySchema) Validate(data any) error {
	val := reflect.ValueOf(data)

	// Critical: nil slices are invalid (prevents JSON null)
	if val.Kind() == reflect.Slice && val.IsNil() {
		return fmt.Errorf("array cannot be nil - use empty slice []T{} instead")
	}

	if val.Kind() != reflect.Slice && val.Kind() != reflect.Array {
		return fmt.Errorf("expected array, got %v", val.Kind())
	}

	length := val.Len()

	if a.minItems != nil && length < *a.minItems {
		return fmt.Errorf("array has %d items, minimum is %d", length, *a.minItems)
	}

	if a.maxItems != nil && length > *a.maxItems {
		return fmt.Errorf("array has %d items, maximum is %d", length, *a.maxItems)
	}

	// Validate each item
	for i := 0; i < length; i++ {
		if err := a.items.Validate(val.Index(i).Interface()); err != nil {
			return fmt.Errorf("item %d: %w", i, err)
		}
	}

	return nil
}

func (a *ArraySchema) JSONSchema() map[string]any {
	result := map[string]any{
		"type":  "array",
		"items": a.items.JSONSchema(),
	}

	if a.minItems != nil {
		result["minItems"] = *a.minItems
	}
	if a.maxItems != nil {
		result["maxItems"] = *a.maxItems
	}

	return result
}

// NullableSchema wraps another schema to allow null values.
type NullableSchema struct {
	inner Schema
}

// Nullable creates a schema that allows null values.
func Nullable(schema Schema) *NullableSchema {
	return &NullableSchema{inner: schema}
}

// InnerSchema returns the wrapped schema.
func (n *NullableSchema) InnerSchema() Schema {
	return n.inner
}

func (n *NullableSchema) TypeName() string {
	return n.inner.TypeName() + " | null"
}

func (n *NullableSchema) Validate(data any) error {
	if data == nil {
		return nil
	}
	return n.inner.Validate(data)
}

func (n *NullableSchema) JSONSchema() map[string]any {
	innerSchema := n.inner.JSONSchema()
	// Use anyOf to allow null
	return map[string]any{
		"anyOf": []any{
			innerSchema,
			map[string]any{"type": "null"},
		},
	}
}

// AnySchema allows any value.
type AnySchema struct{}

// Any creates a schema that allows any value.
func Any() *AnySchema {
	return &AnySchema{}
}

func (a *AnySchema) TypeName() string {
	return "any"
}

func (a *AnySchema) Validate(data any) error {
	return nil
}

func (a *AnySchema) JSONSchema() map[string]any {
	return map[string]any{}
}

// Helper functions

func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	// Only capitalize if it's a lowercase letter
	if s[0] >= 'a' && s[0] <= 'z' {
		return string(s[0]-32) + s[1:]
	}
	return s
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
