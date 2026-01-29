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
	Name         string                    `json:"name"`
	Functions    map[string]FunctionDef    `json:"functions"`
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
	configDir    string
)

// loadConfig loads the ontology config from exported JSON
func loadConfig() error {
	// Find config directory
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	configDir = cwd

	// Try to load from exported config.json
	configPath := filepath.Join(cwd, ".ont", "config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// If config.json doesn't exist, try to export it
		log.Println("Config JSON not found, attempting to export from ontology.config.ts...")
		if err := exportConfig(cwd); err != nil {
			log.Printf("Warning: Could not export config: %v", err)
			// Fall back to empty config
			config = &OntologyConfig{
				Name:         ontologyName,
				Functions:    make(map[string]FunctionDef),
				AccessGroups: make(map[string]AccessGroupDef),
			}
			config.AccessGroups["public"] = AccessGroupDef{Description: "Unauthenticated users"}
			log.Println("Using default config")
			return nil
		}
		// Try loading again
		configPath = filepath.Join(cwd, ".ont", "config.json")
	}

	// Load config from JSON
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config: %v", err)
	}

	config = &OntologyConfig{}
	if err := json.Unmarshal(data, config); err != nil {
		return fmt.Errorf("failed to parse config: %v", err)
	}

	if config.Name != "" {
		ontologyName = config.Name
	}

	log.Printf("Loaded ontology config: %s", ontologyName)
	return nil
}

// exportConfig exports the TypeScript config to JSON
func exportConfig(dir string) error {
	// Create .ont directory
	ontDir := filepath.Join(dir, ".ont")
	if err := os.MkdirAll(ontDir, 0755); err != nil {
		return err
	}

	// Try to find the export script - look for .mjs (compiled) first, then .ts
	scriptPath := ""
	mjsPath := filepath.Join(dir, "node_modules", "ont-run", "scripts", "export-config.mjs")
	tsPath := filepath.Join(dir, "node_modules", "ont-run", "scripts", "export-config.ts")
	
	if _, err := os.Stat(mjsPath); err == nil {
		scriptPath = mjsPath
	} else if _, err := os.Stat(tsPath); err == nil {
		scriptPath = tsPath
	} else {
		// Try relative path for development
		mjsPath = filepath.Join(dir, "..", "scripts", "export-config.mjs")
		tsPath = filepath.Join(dir, "..", "scripts", "export-config.ts")
		if _, err := os.Stat(mjsPath); err == nil {
			scriptPath = mjsPath
		} else if _, err := os.Stat(tsPath); err == nil {
			scriptPath = tsPath
		}
	}

	if scriptPath == "" {
		return fmt.Errorf("export-config script not found")
	}

	// Execute based on file extension
	var cmd *exec.Cmd
	if strings.HasSuffix(scriptPath, ".mjs") {
		cmd = exec.Command("node", scriptPath)
	} else if _, err := exec.LookPath("bun"); err == nil {
		cmd = exec.Command("bun", "run", scriptPath)
	} else {
		cmd = exec.Command("npx", "tsx", scriptPath)
	}
	cmd.Dir = dir

	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to export config: %v", err)
	}

	// Write to config.json
	configPath := filepath.Join(ontDir, "config.json")
	if err := os.WriteFile(configPath, output, 0644); err != nil {
		return err
	}

	log.Printf("Exported config to %s", configPath)
	return nil
}

// authMiddleware handles authentication and sets access groups
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// WARNING: This is a mock auth implementation for development/testing only
		// TODO: Implement actual auth function bridge to call user's auth() from config
		
		// Log warning in production mode
		if environment == "prod" {
			log.Println("WARNING: Using mock authentication in production mode!")
		}
		
		// Default to public access
		accessGroups := []string{"public"}

		// Simple token-based auth (mock - DO NOT USE IN PRODUCTION)
		token := c.GetHeader("Authorization")
		if token != "" {
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

// executeResolver calls the TypeScript resolver via bridge
func executeResolver(functionName string, args interface{}, ctx ResolverContext) (interface{}, error) {
	log.Printf("Executing resolver: %s", functionName)
	
	// Prepare bridge script that imports and executes the resolver
	argsJSON, _ := json.Marshal(args)
	ctxJSON, _ := json.Marshal(ctx)

	// Create a temporary bridge script
	bridgeScript := fmt.Sprintf(`
import { loadConfig } from 'ont-run/config';

const { config } = await loadConfig();
const fn = config.functions['%s'];
if (!fn) {
  console.error('Function not found: %s');
  process.exit(1);
}

const ctx = %s;
const args = %s;

try {
  const result = await fn.resolver(ctx, args);
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
`, functionName, functionName, string(ctxJSON), string(argsJSON))

	// Execute via bun or node
	var cmd *exec.Cmd
	if _, err := exec.LookPath("bun"); err == nil {
		cmd = exec.Command("bun", "eval", bridgeScript)
	} else {
		cmd = exec.Command("node", "--input-type=module", "-e", bridgeScript)
	}
	cmd.Dir = configDir

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("resolver execution failed: %v, output: %s", err, string(output))
	}

	var result interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse resolver output: %v, output: %s", err, string(output))
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
				log.Printf("Resolver error: %v", err)
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

	// Enable CORS with configurable origin
	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		if environment == "prod" {
			log.Println("WARNING: CORS_ORIGIN not set in production, defaulting to *")
		}
		corsOrigin = "*"
	}
	
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", corsOrigin)
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
	log.Printf("========================================")
	log.Printf("Go Backend Server")
	log.Printf("========================================")
	log.Printf("URL: http://localhost%s", addr)
	log.Printf("Environment: %s", environment)
	log.Printf("Ontology: %s", ontologyName)
	log.Printf("Functions: %d", len(config.Functions))
	log.Printf("========================================")
	
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
