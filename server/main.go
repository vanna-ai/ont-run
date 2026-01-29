package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status string `json:"status"`
	Name   string `json:"name"`
	Env    string `json:"env"`
}

type ErrorResponse struct {
	Error   string      `json:"error"`
	Message string      `json:"message,omitempty"`
	Issues  interface{} `json:"issues,omitempty"`
}

type ApiListResponse struct {
	Name             string     `json:"name"`
	Env              string     `json:"env"`
	AccessGroups     []string   `json:"accessGroups"`
	Functions        []FuncInfo `json:"functions"`
}

type FuncInfo struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Access      []string `json:"access"`
	Path        string   `json:"path"`
}

type OntologyConfig struct {
	Name        string                    `json:"name"`
	Functions   map[string]FunctionDef    `json:"functions"`
	AccessGroups map[string]AccessGroupDef `json:"accessGroups"`
}

type FunctionDef struct {
	Description string   `json:"description"`
	Access      []string `json:"access"`
	Entities    []string `json:"entities"`
}

type AccessGroupDef struct {
	Description string `json:"description"`
}

type ResolverContext struct {
	Env          string      `json:"env"`
	EnvConfig    interface{} `json:"envConfig"`
	Logger       interface{} `json:"logger"`
	AccessGroups []string    `json:"accessGroups"`
}

var (
	config       *OntologyConfig
	ontologyName string = "ont-run"
	environment  string = "dev"
)

// loadConfig loads the ontology config by executing the TypeScript loader
func loadConfig() error {
	// Find ontology.config.ts
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}

	configPath := filepath.Join(cwd, "ontology.config.ts")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Try parent directory
		configPath = filepath.Join(cwd, "..", "ontology.config.ts")
		if _, err := os.Stat(configPath); os.IsNotExist(err) {
			return fmt.Errorf("ontology.config.ts not found")
		}
	}

	// Use bun or node to load the config
	// For simplicity, we'll use a mock config for now
	// In production, you'd want to either:
	// 1. Generate a JSON file from TS config
	// 2. Use a TS loader/evaluator
	// 3. Require users to provide JSON config
	config = &OntologyConfig{
		Name:         ontologyName,
		Functions:    make(map[string]FunctionDef),
		AccessGroups: make(map[string]AccessGroupDef),
	}

	// Add default access groups
	config.AccessGroups["public"] = AccessGroupDef{Description: "Unauthenticated users"}
	config.AccessGroups["user"] = AccessGroupDef{Description: "Authenticated users"}
	config.AccessGroups["admin"] = AccessGroupDef{Description: "Administrators"}

	log.Println("Loaded ontology config")
	return nil
}

// authMiddleware handles authentication and sets access groups
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// For now, default to public access
		// In production, this would call the user's auth function
		accessGroups := []string{"public"}

		// Check for Authorization header
		token := c.GetHeader("Authorization")
		if token != "" {
			// Simple token-based auth (mock)
			if strings.HasPrefix(token, "Bearer ") {
				accessGroups = []string{"user", "public"}
			}
			if strings.Contains(token, "admin") {
				accessGroups = []string{"admin", "user", "public"}
			}
		}

		c.Set("accessGroups", accessGroups)
		c.Next()
	}
}

// accessControlMiddleware checks if user has required access
func accessControlMiddleware(requiredAccess []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		accessGroups, exists := c.Get("accessGroups")
		if !exists {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "Access denied",
				Message: "No access groups found",
			})
			c.Abort()
			return
		}

		groups := accessGroups.([]string)
		hasAccess := false
		for _, required := range requiredAccess {
			for _, group := range groups {
				if group == required {
					hasAccess = true
					break
				}
			}
			if hasAccess {
				break
			}
		}

		if !hasAccess {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error:   "Access denied",
				Message: fmt.Sprintf("This function requires one of: %s", strings.Join(requiredAccess, ", ")),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// executeResolver calls the TypeScript resolver
func executeResolver(functionName string, args interface{}, ctx ResolverContext) (interface{}, error) {
	// For production, we need to call the TypeScript resolver
	// Options:
	// 1. Spawn Node/Bun process to execute the resolver
	// 2. Use a bridge/IPC mechanism
	// 3. Require resolvers to be rewritten in Go (not ideal)
	
	// For now, return a mock response
	log.Printf("Executing resolver: %s with args: %v", functionName, args)
	
	// Try to execute TypeScript resolver via Node/Bun
	argsJSON, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}
	
	ctxJSON, err := json.Marshal(ctx)
	if err != nil {
		return nil, err
	}

	// Create a simple bridge script
	script := fmt.Sprintf(`
		const resolver = require('./resolvers/%s.js').default;
		const args = %s;
		const ctx = %s;
		resolver(ctx, args).then(result => {
			console.log(JSON.stringify(result));
		}).catch(err => {
			console.error(err);
			process.exit(1);
		});
	`, functionName, string(argsJSON), string(ctxJSON))

	cmd := exec.Command("node", "-e", script)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("resolver execution failed: %v", err)
	}

	var result interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// setupRoutes configures all HTTP routes
func setupRoutes(router *gin.Engine) {
	// Apply auth middleware globally
	router.Use(authMiddleware())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, HealthResponse{
			Status: "ok",
			Name:   ontologyName,
			Env:    environment,
		})
	})

	// API introspection endpoint
	router.GET("/api", func(c *gin.Context) {
		accessGroups, _ := c.Get("accessGroups")
		groups := accessGroups.([]string)

		functions := []FuncInfo{}
		for name, fn := range config.Functions {
			// Check if user has access to this function
			hasAccess := false
			for _, required := range fn.Access {
				for _, group := range groups {
					if group == required {
						hasAccess = true
						break
					}
				}
			}
			if hasAccess {
				functions = append(functions, FuncInfo{
					Name:        name,
					Description: fn.Description,
					Access:      fn.Access,
					Path:        "/api/" + name,
				})
			}
		}

		c.JSON(http.StatusOK, ApiListResponse{
			Name:         ontologyName,
			Env:          environment,
			AccessGroups: groups,
			Functions:    functions,
		})
	})

	// Dynamic function routes
	api := router.Group("/api")
	for name, fn := range config.Functions {
		funcName := name
		funcDef := fn
		
		api.POST("/"+funcName, accessControlMiddleware(funcDef.Access), func(c *gin.Context) {
			// Parse request body
			var args map[string]interface{}
			if err := c.BindJSON(&args); err != nil {
				// Empty body is OK for functions with no inputs
				args = make(map[string]interface{})
			}

			// Build resolver context
			accessGroups, _ := c.Get("accessGroups")
			resolverCtx := ResolverContext{
				Env:          environment,
				EnvConfig:    nil,
				Logger:       nil,
				AccessGroups: accessGroups.([]string),
			}

			// Execute resolver
			result, err := executeResolver(funcName, args, resolverCtx)
			if err != nil {
				c.JSON(http.StatusInternalServerError, ErrorResponse{
					Error:   "Resolver failed",
					Message: err.Error(),
				})
				return
			}

			c.JSON(http.StatusOK, result)
		})
	}
}

func main() {
	// Load configuration
	if err := loadConfig(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	// Get environment
	env := os.Getenv("ONT_ENV")
	if env != "" {
		environment = env
	}

	// Setup Gin
	if environment == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Enable CORS
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		
		c.Next()
	})

	// Setup routes
	setupRoutes(router)

	// Start server
	addr := ":" + port
	log.Printf("Starting Go backend server on http://localhost%s", addr)
	log.Printf("Environment: %s", environment)
	log.Printf("Functions: %d", len(config.Functions))
	
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
