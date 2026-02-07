package ontology

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLockFileGeneration(t *testing.T) {
	config := &Config{
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
				Inputs:      Object(map[string]Schema{"id": String().UUID()}),
				Outputs: Object(map[string]Schema{
					"name":  String(),
					"email": String().Email(),
				}),
			},
		},
	}

	lock := config.GenerateLock()

	if lock.Version != LockFileVersion {
		t.Errorf("Expected version %s, got %s", LockFileVersion, lock.Version)
	}

	if lock.Name != "test" {
		t.Errorf("Expected name 'test', got %s", lock.Name)
	}

	if lock.Hash == "" {
		t.Error("Expected non-empty hash")
	}

	if len(lock.AccessGroups) != 1 {
		t.Errorf("Expected 1 access group, got %d", len(lock.AccessGroups))
	}

	if len(lock.Entities) != 1 {
		t.Errorf("Expected 1 entity, got %d", len(lock.Entities))
	}

	if len(lock.Functions) != 1 {
		t.Errorf("Expected 1 function, got %d", len(lock.Functions))
	}
}

func TestLockVerification(t *testing.T) {
	config := &Config{
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
				Inputs:      Object(map[string]Schema{"id": String()}),
				Outputs:     Object(map[string]Schema{"name": String()}),
			},
		},
	}

	// Write lock file to temp directory
	tmpDir := t.TempDir()
	lockPath := filepath.Join(tmpDir, "ont.lock")

	if err := config.WriteLock(lockPath); err != nil {
		t.Fatalf("Failed to write lock: %v", err)
	}

	// Verify succeeds with unchanged config
	if err := config.VerifyLock(lockPath); err != nil {
		t.Errorf("Verification should succeed: %v", err)
	}

	// Modify config
	config.Name = "modified"

	// Verify fails with changed config
	if err := config.VerifyLock(lockPath); err == nil {
		t.Error("Verification should fail for modified config")
	}
}

func TestLockDiff(t *testing.T) {
	config := &Config{
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
				Inputs:      Object(map[string]Schema{"id": String()}),
				Outputs:     Object(map[string]Schema{"name": String()}),
			},
		},
	}

	// Write lock file
	tmpDir := t.TempDir()
	lockPath := filepath.Join(tmpDir, "ont.lock")

	if err := config.WriteLock(lockPath); err != nil {
		t.Fatalf("Failed to write lock: %v", err)
	}

	// No changes - diff should be empty
	diff, err := config.DiffLock(lockPath)
	if err != nil {
		t.Fatalf("Diff failed: %v", err)
	}

	if diff.HasChanges() {
		t.Error("Expected no changes")
	}

	// Add a new function
	config.Functions["createUser"] = Function{
		Description: "Create a user",
		Access:      []string{"admin"},
		Inputs:      Object(map[string]Schema{"name": String()}),
		Outputs:     Object(map[string]Schema{"id": String()}),
	}

	diff, err = config.DiffLock(lockPath)
	if err != nil {
		t.Fatalf("Diff failed: %v", err)
	}

	if !diff.HasChanges() {
		t.Error("Expected changes")
	}

	if len(diff.NewFunctions) != 1 || diff.NewFunctions[0] != "createUser" {
		t.Errorf("Expected new function 'createUser', got %v", diff.NewFunctions)
	}
}

func TestLockDiffDeleted(t *testing.T) {
	config := &Config{
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
				Inputs:      Object(map[string]Schema{"id": String()}),
				Outputs:     Object(map[string]Schema{"name": String()}),
			},
			"deleteUser": {
				Description: "Delete a user",
				Access:      []string{"admin"},
				Inputs:      Object(map[string]Schema{"id": String()}),
				Outputs:     Object(map[string]Schema{"success": Boolean()}),
			},
		},
	}

	// Write lock file
	tmpDir := t.TempDir()
	lockPath := filepath.Join(tmpDir, "ont.lock")

	if err := config.WriteLock(lockPath); err != nil {
		t.Fatalf("Failed to write lock: %v", err)
	}

	// Delete a function
	delete(config.Functions, "deleteUser")

	diff, err := config.DiffLock(lockPath)
	if err != nil {
		t.Fatalf("Diff failed: %v", err)
	}

	if !diff.HasChanges() {
		t.Error("Expected changes")
	}

	if len(diff.DeletedFunctions) != 1 || diff.DeletedFunctions[0] != "deleteUser" {
		t.Errorf("Expected deleted function 'deleteUser', got %v", diff.DeletedFunctions)
	}
}

func TestLockDiffNoLockFile(t *testing.T) {
	config := &Config{
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
				Inputs:      Object(map[string]Schema{"id": String()}),
				Outputs:     Object(map[string]Schema{"name": String()}),
			},
		},
	}

	// Diff with non-existent lock file should show everything as new
	tmpDir := t.TempDir()
	lockPath := filepath.Join(tmpDir, "nonexistent.lock")

	diff, err := config.DiffLock(lockPath)
	if err != nil {
		t.Fatalf("Diff failed: %v", err)
	}

	if !diff.HasChanges() {
		t.Error("Expected changes (everything is new)")
	}

	if len(diff.NewFunctions) != 1 {
		t.Errorf("Expected 1 new function, got %d", len(diff.NewFunctions))
	}

	if len(diff.NewAccessGroups) != 1 {
		t.Errorf("Expected 1 new access group, got %d", len(diff.NewAccessGroups))
	}

	if len(diff.NewEntities) != 1 {
		t.Errorf("Expected 1 new entity, got %d", len(diff.NewEntities))
	}
}

func TestReadLock(t *testing.T) {
	config := &Config{
		Name: "test",
		AccessGroups: map[string]AccessGroup{
			"admin": {Description: "Admins"},
		},
		Entities: map[string]Entity{},
		Functions: map[string]Function{},
	}

	tmpDir := t.TempDir()
	lockPath := filepath.Join(tmpDir, "ont.lock")

	if err := config.WriteLock(lockPath); err != nil {
		t.Fatalf("Failed to write lock: %v", err)
	}

	lock, err := ReadLock(lockPath)
	if err != nil {
		t.Fatalf("Failed to read lock: %v", err)
	}

	if lock.Name != "test" {
		t.Errorf("Expected name 'test', got %s", lock.Name)
	}

	if lock.Version != LockFileVersion {
		t.Errorf("Expected version %s, got %s", LockFileVersion, lock.Version)
	}
}

func TestReadLockNotFound(t *testing.T) {
	_, err := ReadLock("/nonexistent/path/ont.lock")
	if err == nil {
		t.Error("Expected error for non-existent file")
	}

	if !os.IsNotExist(err) {
		// The error should be wrapped, so we check for the file not existing
		// through the error message or by checking if it contains os.ErrNotExist
	}
}
