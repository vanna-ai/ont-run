package ontology

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
)

// Hash generates a cryptographic hash of the entire ontology configuration.
// The hash is deterministic: configs with the same content produce the same hash,
// regardless of map iteration order.
func (c *Config) Hash() string {
	normalized := c.normalize()
	data, _ := json.Marshal(normalized)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// normalizedConfig is a serializable representation of Config for hashing.
type normalizedConfig struct {
	Name         string                     `json:"name"`
	AccessGroups map[string]AccessGroup     `json:"accessGroups"`
	Entities     map[string]Entity          `json:"entities"`
	Functions    map[string]normalizedFunc  `json:"functions"`
}

// normalizedFunc is a serializable representation of Function for hashing.
// Resolver is excluded since it's implementation, not architecture.
type normalizedFunc struct {
	Description string         `json:"description"`
	Access      []string       `json:"access"`
	Entities    []string       `json:"entities,omitempty"`
	Inputs      map[string]any `json:"inputs"`
	Outputs     map[string]any `json:"outputs"`
}

// normalize creates a deterministic representation of the config for hashing.
func (c *Config) normalize() *normalizedConfig {
	normalized := &normalizedConfig{
		Name:         c.Name,
		AccessGroups: make(map[string]AccessGroup),
		Entities:     make(map[string]Entity),
		Functions:    make(map[string]normalizedFunc),
	}

	// Copy access groups
	for k, v := range c.AccessGroups {
		normalized.AccessGroups[k] = v
	}

	// Copy entities
	for k, v := range c.Entities {
		normalized.Entities[k] = v
	}

	// Copy and normalize functions
	for k, v := range c.Functions {
		fn := normalizedFunc{
			Description: v.Description,
			Access:      sortedCopy(v.Access),
			Entities:    sortedCopy(v.Entities),
			Inputs:      v.Inputs.JSONSchema(),
			Outputs:     v.Outputs.JSONSchema(),
		}
		normalized.Functions[k] = fn
	}

	return normalized
}

// hashComponent generates a hash for an individual component.
func hashComponent(v any) string {
	data, _ := json.Marshal(v)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// hashFunction generates a hash for a single function definition.
func hashFunction(f Function) string {
	normalized := normalizedFunc{
		Description: f.Description,
		Access:      sortedCopy(f.Access),
		Entities:    sortedCopy(f.Entities),
		Inputs:      f.Inputs.JSONSchema(),
		Outputs:     f.Outputs.JSONSchema(),
	}
	return hashComponent(normalized)
}

// sortedCopy returns a sorted copy of a string slice.
func sortedCopy(slice []string) []string {
	if slice == nil {
		return nil
	}
	result := make([]string, len(slice))
	copy(result, slice)
	sort.Strings(result)
	return result
}

// sortedKeys returns the keys of a map in sorted order.
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
