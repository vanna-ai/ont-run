package ontology

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"
)

// LockFile represents the ont.lock file structure.
type LockFile struct {
	Version      string            `json:"version"`
	Name         string            `json:"name"`
	Hash         string            `json:"hash"`
	GeneratedAt  time.Time         `json:"generatedAt"`
	AccessGroups map[string]string `json:"accessGroups"` // name -> hash
	Entities     map[string]string `json:"entities"`     // name -> hash
	Functions    map[string]string `json:"functions"`    // name -> hash
}

// LockFileVersion is the current lock file format version.
const LockFileVersion = "1.0"

// GenerateLock creates a lock file with cryptographic hashes.
func (c *Config) GenerateLock() *LockFile {
	lock := &LockFile{
		Version:      LockFileVersion,
		Name:         c.Name,
		Hash:         c.Hash(),
		GeneratedAt:  time.Now().UTC(),
		AccessGroups: make(map[string]string),
		Entities:     make(map[string]string),
		Functions:    make(map[string]string),
	}

	// Hash individual access groups
	for name, group := range c.AccessGroups {
		lock.AccessGroups[name] = hashComponent(group)
	}

	// Hash individual entities
	for name, entity := range c.Entities {
		lock.Entities[name] = hashComponent(entity)
	}

	// Hash individual functions
	for name, fn := range c.Functions {
		lock.Functions[name] = hashFunction(fn)
	}

	return lock
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

	// Compare access groups
	for name, group := range c.AccessGroups {
		currentHash := hashComponent(group)
		if lockHash, exists := lock.AccessGroups[name]; !exists {
			diff.NewAccessGroups = append(diff.NewAccessGroups, name)
		} else if currentHash != lockHash {
			diff.ModifiedAccessGroups = append(diff.ModifiedAccessGroups, name)
		}
	}
	for name := range lock.AccessGroups {
		if _, exists := c.AccessGroups[name]; !exists {
			diff.DeletedAccessGroups = append(diff.DeletedAccessGroups, name)
		}
	}

	// Compare entities
	for name, entity := range c.Entities {
		currentHash := hashComponent(entity)
		if lockHash, exists := lock.Entities[name]; !exists {
			diff.NewEntities = append(diff.NewEntities, name)
		} else if currentHash != lockHash {
			diff.ModifiedEntities = append(diff.ModifiedEntities, name)
		}
	}
	for name := range lock.Entities {
		if _, exists := c.Entities[name]; !exists {
			diff.DeletedEntities = append(diff.DeletedEntities, name)
		}
	}

	// Compare functions
	for name, fn := range c.Functions {
		currentHash := hashFunction(fn)
		if lockHash, exists := lock.Functions[name]; !exists {
			diff.NewFunctions = append(diff.NewFunctions, name)
		} else if currentHash != lockHash {
			diff.ModifiedFunctions = append(diff.ModifiedFunctions, name)
		}
	}
	for name := range lock.Functions {
		if _, exists := c.Functions[name]; !exists {
			diff.DeletedFunctions = append(diff.DeletedFunctions, name)
		}
	}

	return diff, nil
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
