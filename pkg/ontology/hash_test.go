package ontology

import (
	"testing"
)

func TestHashDeterminism(t *testing.T) {
	// Create two configs with the same content but different map insertion order
	config1 := &Config{
		Name: "test",
		AccessGroups: map[string]AccessGroup{
			"admin":  {Description: "Admins"},
			"public": {Description: "Public"},
		},
		Entities: map[string]Entity{
			"User":    {Description: "A user"},
			"Product": {Description: "A product"},
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
	}

	config2 := &Config{
		Name: "test",
		AccessGroups: map[string]AccessGroup{
			"public": {Description: "Public"},
			"admin":  {Description: "Admins"},
		},
		Entities: map[string]Entity{
			"Product": {Description: "A product"},
			"User":    {Description: "A user"},
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
	}

	hash1 := config1.Hash()
	hash2 := config2.Hash()

	if hash1 != hash2 {
		t.Errorf("Expected identical hashes for configs with same content, got %s and %s", hash1, hash2)
	}
}

func TestHashChangesOnModification(t *testing.T) {
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

	hash1 := config.Hash()

	// Modify the config
	config.Name = "modified"

	hash2 := config.Hash()

	if hash1 == hash2 {
		t.Error("Expected different hashes after modification")
	}
}

func TestHashConsistency(t *testing.T) {
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

	// Hash the same config multiple times
	hash1 := config.Hash()
	hash2 := config.Hash()
	hash3 := config.Hash()

	if hash1 != hash2 || hash2 != hash3 {
		t.Errorf("Hash is not consistent: %s, %s, %s", hash1, hash2, hash3)
	}
}

func TestAccessSortingForHash(t *testing.T) {
	// Test that access groups are sorted before hashing
	config1 := &Config{
		Name: "test",
		AccessGroups: map[string]AccessGroup{
			"admin": {Description: "Admins"},
		},
		Entities: map[string]Entity{},
		Functions: map[string]Function{
			"test": {
				Description: "Test",
				Access:      []string{"admin", "public", "support"},
				Inputs:      Object(map[string]Schema{}),
				Outputs:     Object(map[string]Schema{}),
			},
		},
	}

	config2 := &Config{
		Name: "test",
		AccessGroups: map[string]AccessGroup{
			"admin": {Description: "Admins"},
		},
		Entities: map[string]Entity{},
		Functions: map[string]Function{
			"test": {
				Description: "Test",
				Access:      []string{"support", "admin", "public"},
				Inputs:      Object(map[string]Schema{}),
				Outputs:     Object(map[string]Schema{}),
			},
		},
	}

	hash1 := config1.Hash()
	hash2 := config2.Hash()

	if hash1 != hash2 {
		t.Errorf("Hashes should be equal regardless of access order: %s vs %s", hash1, hash2)
	}
}
