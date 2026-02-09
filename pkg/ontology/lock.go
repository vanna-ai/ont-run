package ontology

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"time"
)

// FieldReference represents a field that references another function for its options.
type FieldReference struct {
	Path         string `json:"path"`
	FunctionName string `json:"functionName"`
}

// FunctionShape represents a snapshot of a function's security-relevant properties.
type FunctionShape struct {
	Description              string                 `json:"description"`
	Access                   []string               `json:"access"`
	Entities                 []string               `json:"entities"`
	InputsSchema             map[string]interface{} `json:"inputsSchema"`
	OutputsSchema            map[string]interface{} `json:"outputsSchema,omitempty"`
	FieldReferences          []FieldReference       `json:"fieldReferences,omitempty"`
	UsesUserContext          *bool                  `json:"usesUserContext,omitempty"`
	UsesOrganizationContext  *bool                  `json:"usesOrganizationContext,omitempty"`
}

// OntologySnapshot represents a complete snapshot of the ontology.
type OntologySnapshot struct {
	Name         string                    `json:"name"`
	AccessGroups []string                  `json:"accessGroups"`
	Entities     []string                  `json:"entities,omitempty"`
	Functions    map[string]FunctionShape  `json:"functions"`
}

// LockFile represents the ont.lock file structure.
// This format matches the TypeScript implementation and the official JSON schema.
type LockFile struct {
	Version    int              `json:"version"`
	Hash       string           `json:"hash"`
	ApprovedAt time.Time        `json:"approvedAt"`
	Ontology   OntologySnapshot `json:"ontology"`
}

// LockFileVersion is the current lock file format version.
const LockFileVersion = 1

// GenerateLock creates a lock file with the complete ontology snapshot.
func (c *Config) GenerateLock() *LockFile {
	snapshot := c.ExtractSnapshot()
	
	lock := &LockFile{
		Version:    LockFileVersion,
		Hash:       c.Hash(),
		ApprovedAt: time.Now().UTC(),
		Ontology:   snapshot,
	}

	return lock
}

// ExtractSnapshot creates a complete ontology snapshot.
// This extracts all security-relevant information for the lock file.
func (c *Config) ExtractSnapshot() OntologySnapshot {
	// Collect and sort access groups
	accessGroups := make([]string, 0, len(c.AccessGroups))
	for name := range c.AccessGroups {
		accessGroups = append(accessGroups, name)
	}
	sort.Strings(accessGroups)

	// Collect and sort entities
	entities := make([]string, 0, len(c.Entities))
	for name := range c.Entities {
		entities = append(entities, name)
	}
	sort.Strings(entities)

	// Extract function shapes
	functions := make(map[string]FunctionShape)
	for name, fn := range c.Functions {
		// Sort access and entities for consistent hashing
		access := sortedCopy(fn.Access)
		fnEntities := sortedCopy(fn.Entities)

		shape := FunctionShape{
			Description:   fn.Description,
			Access:        access,
			Entities:      fnEntities,
			InputsSchema:  fn.Inputs.JSONSchema(),
		}

		// Add outputs schema if present
		if fn.Outputs != nil {
			shape.OutputsSchema = fn.Outputs.JSONSchema()
		}

		functions[name] = shape
	}

	return OntologySnapshot{
		Name:         c.Name,
		AccessGroups: accessGroups,
		Entities:     entities,
		Functions:    functions,
	}
}

// WriteLock writes the lock file to disk.
func (c *Config) WriteLock(path string) error {
	lock := c.GenerateLock()

	data, err := json.MarshalIndent(lock, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal lock file: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write lock file: %w", err)
	}

	return nil
}

// ReadLock reads a lock file from disk.
func ReadLock(path string) (*LockFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read lock file: %w", err)
	}

	var lock LockFile
	if err := json.Unmarshal(data, &lock); err != nil {
		return nil, fmt.Errorf("failed to parse lock file: %w", err)
	}

	return &lock, nil
}

// VerifyLock checks if the current config matches the lock file.
func (c *Config) VerifyLock(path string) error {
	lock, err := ReadLock(path)
	if err != nil {
		return err
	}

	currentHash := c.Hash()
	if currentHash != lock.Hash {
		return fmt.Errorf("ontology hash mismatch: lock file has %s, current is %s",
			lock.Hash, currentHash)
	}

	return nil
}

// LockDiff represents changes between the current config and lock file.
type LockDiff struct {
	HashChanged    bool
	NewAccessGroups     []string
	ModifiedAccessGroups []string
	DeletedAccessGroups  []string
	NewEntities    []string
	ModifiedEntities []string
	DeletedEntities []string
	NewFunctions   []string
	ModifiedFunctions []string
	DeletedFunctions []string
}

// HasChanges returns true if there are any changes.
func (d *LockDiff) HasChanges() bool {
	return d.HashChanged ||
		len(d.NewAccessGroups) > 0 || len(d.ModifiedAccessGroups) > 0 || len(d.DeletedAccessGroups) > 0 ||
		len(d.NewEntities) > 0 || len(d.ModifiedEntities) > 0 || len(d.DeletedEntities) > 0 ||
		len(d.NewFunctions) > 0 || len(d.ModifiedFunctions) > 0 || len(d.DeletedFunctions) > 0
}

// DiffLock compares the current config against a lock file and returns the differences.
func (c *Config) DiffLock(path string) (*LockDiff, error) {
	lock, err := ReadLock(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			// No lock file means everything is new
			diff := &LockDiff{HashChanged: true}
			for name := range c.AccessGroups {
				diff.NewAccessGroups = append(diff.NewAccessGroups, name)
			}
			for name := range c.Entities {
				diff.NewEntities = append(diff.NewEntities, name)
			}
			for name := range c.Functions {
				diff.NewFunctions = append(diff.NewFunctions, name)
			}
			return diff, nil
		}
		return nil, err
	}

	diff := &LockDiff{}

	// Check overall hash
	currentHash := c.Hash()
	if currentHash != lock.Hash {
		diff.HashChanged = true
	}

	// Build sets for comparison
	lockAccessGroupSet := make(map[string]bool)
	for _, name := range lock.Ontology.AccessGroups {
		lockAccessGroupSet[name] = true
	}

	lockEntitySet := make(map[string]bool)
	for _, name := range lock.Ontology.Entities {
		lockEntitySet[name] = true
	}

	// Compare access groups
	for name := range c.AccessGroups {
		if !lockAccessGroupSet[name] {
			diff.NewAccessGroups = append(diff.NewAccessGroups, name)
		}
	}
	for _, name := range lock.Ontology.AccessGroups {
		if _, exists := c.AccessGroups[name]; !exists {
			diff.DeletedAccessGroups = append(diff.DeletedAccessGroups, name)
		}
	}

	// Compare entities
	for name := range c.Entities {
		if !lockEntitySet[name] {
			diff.NewEntities = append(diff.NewEntities, name)
		}
	}
	for _, name := range lock.Ontology.Entities {
		if _, exists := c.Entities[name]; !exists {
			diff.DeletedEntities = append(diff.DeletedEntities, name)
		}
	}

	// Compare functions by comparing their shapes
	currentSnapshot := c.ExtractSnapshot()
	for name, currentShape := range currentSnapshot.Functions {
		lockShape, exists := lock.Ontology.Functions[name]
		if !exists {
			diff.NewFunctions = append(diff.NewFunctions, name)
		} else if !functionsEqual(currentShape, lockShape) {
			diff.ModifiedFunctions = append(diff.ModifiedFunctions, name)
		}
	}
	for name := range lock.Ontology.Functions {
		if _, exists := c.Functions[name]; !exists {
			diff.DeletedFunctions = append(diff.DeletedFunctions, name)
		}
	}

	return diff, nil
}

// functionsEqual compares two function shapes for equality.
func functionsEqual(a, b FunctionShape) bool {
	// Quick check: serialize and compare JSON
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}

// String returns a human-readable summary of the changes.
func (d *LockDiff) String() string {
	if !d.HasChanges() {
		return "No changes detected"
	}

	var result string

	if len(d.NewAccessGroups) > 0 {
		result += fmt.Sprintf("New access groups: %v\n", d.NewAccessGroups)
	}
	if len(d.ModifiedAccessGroups) > 0 {
		result += fmt.Sprintf("Modified access groups: %v\n", d.ModifiedAccessGroups)
	}
	if len(d.DeletedAccessGroups) > 0 {
		result += fmt.Sprintf("Deleted access groups: %v\n", d.DeletedAccessGroups)
	}

	if len(d.NewEntities) > 0 {
		result += fmt.Sprintf("New entities: %v\n", d.NewEntities)
	}
	if len(d.ModifiedEntities) > 0 {
		result += fmt.Sprintf("Modified entities: %v\n", d.ModifiedEntities)
	}
	if len(d.DeletedEntities) > 0 {
		result += fmt.Sprintf("Deleted entities: %v\n", d.DeletedEntities)
	}

	if len(d.NewFunctions) > 0 {
		result += fmt.Sprintf("New functions: %v\n", d.NewFunctions)
	}
	if len(d.ModifiedFunctions) > 0 {
		result += fmt.Sprintf("Modified functions: %v\n", d.ModifiedFunctions)
	}
	if len(d.DeletedFunctions) > 0 {
		result += fmt.Sprintf("Deleted functions: %v\n", d.DeletedFunctions)
	}

	return result
}
