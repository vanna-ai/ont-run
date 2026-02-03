package cloud

import (
	"log"
	"sort"

	"github.com/vanna-ai/ont-run/pkg/ontology"
)

// ExtractOntologySnapshot extracts a cloud-compatible snapshot from a config.
func ExtractOntologySnapshot(config *ontology.Config) OntologySnapshot {
	// Extract sorted access group names
	accessGroups := make([]string, 0, len(config.AccessGroups))
	for name := range config.AccessGroups {
		accessGroups = append(accessGroups, name)
	}
	sort.Strings(accessGroups)

	// Extract sorted entity names
	entities := make([]string, 0, len(config.Entities))
	for name := range config.Entities {
		entities = append(entities, name)
	}
	sort.Strings(entities)

	// Extract functions
	functions := make(map[string]FunctionShape)
	for name, fn := range config.Functions {
		// Sort access and entities
		access := make([]string, len(fn.Access))
		copy(access, fn.Access)
		sort.Strings(access)

		fnEntities := make([]string, len(fn.Entities))
		copy(fnEntities, fn.Entities)
		sort.Strings(fnEntities)

		functions[name] = FunctionShape{
			Description:   fn.Description,
			Access:        access,
			Entities:      fnEntities,
			InputsSchema:  fn.Inputs.JSONSchema(),
			OutputsSchema: fn.Outputs.JSONSchema(),
		}
	}

	return OntologySnapshot{
		Name:         config.Name,
		AccessGroups: accessGroups,
		Entities:     entities,
		Functions:    functions,
	}
}

// RegisterWithCloud registers the ontology with ont-run.com.
// Returns the registration result or an error.
func RegisterWithCloud(uuid string, config *ontology.Config, opts ...ClientOption) (*RegistrationResult, error) {
	if uuid == "" {
		return nil, nil // No UUID means no cloud registration
	}

	client := NewClient(opts...)
	snapshot := ExtractOntologySnapshot(config)

	return client.Register(uuid, snapshot)
}

// TryRegisterWithCloud attempts to register the ontology with ont-run.com.
// This function never blocks and logs errors instead of returning them.
// It's designed to be called at server startup.
func TryRegisterWithCloud(uuid string, config *ontology.Config, opts ...ClientOption) {
	if uuid == "" {
		return // No UUID means no cloud registration
	}

	go func() {
		result, err := RegisterWithCloud(uuid, config, opts...)
		if err != nil {
			log.Printf("[cloud] Registration failed: %v", err)
			return
		}

		if result == nil {
			return
		}

		if result.Success {
			if result.Verified {
				log.Printf("[cloud] Registered successfully (verified, hash: %s)", result.Hash)
			} else {
				log.Printf("[cloud] Registered successfully (anonymous, hash: %s)", result.Hash)
			}

			if result.VersionID != "" {
				log.Printf("[cloud] New version created: %s", result.VersionID)
			}
		} else {
			if result.LimitReached {
				log.Printf("[cloud] Warning: Free tier limit reached. Run 'npx ont-run login' to upgrade.")
			} else if result.Message != "" {
				log.Printf("[cloud] Registration warning: %s", result.Message)
			}
		}
	}()
}
