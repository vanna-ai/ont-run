package main

import (
	"log"
	"os"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
	"github.com/vanna-ai/ont-run/pkg/codegen/typescript"
	"github.com/vanna-ai/ont-run/pkg/server"
)

func main() {
	// Load ontology definition
	ontology := DefineOntology()

	// Validate configuration
	if err := ontology.Validate(); err != nil {
		log.Fatalf("Invalid ontology: %v", err)
	}

	// Development mode: auto-generate lock and SDK
	if os.Getenv("NODE_ENV") != "production" {
		log.Println("Generating ont.lock...")
		if err := ontology.WriteLock("../ont.lock"); err != nil {
			log.Fatalf("Failed to generate lock: %v", err)
		}

		log.Println("Generating TypeScript SDK...")
		if err := typescript.GenerateTypeScript(ontology, "../frontend/src/sdk"); err != nil {
			log.Fatalf("Failed to generate SDK: %v", err)
		}
	} else {
		// Production mode: verify lock
		log.Println("Verifying ont.lock...")
		if err := ontology.VerifyLock("../ont.lock"); err != nil {
			log.Fatalf("Ontology verification failed: %v", err)
		}
	}

	// Start server
	log.Println("Starting server on :8080...")
	if err := server.Serve(ontology, ":8080", server.WithLogger(ont.ConsoleLogger())); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
