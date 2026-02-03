// Package server provides HTTP and MCP server implementations for ontology APIs.
package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"reflect"
	"sort"
	"strings"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

// Server is the main server that handles both REST API and MCP protocol.
type Server struct {
	config   *ont.Config
	logger   ont.Logger
	authFunc AuthFunc
}

// AuthFunc is a function that authenticates a request and returns access groups.
type AuthFunc func(r *http.Request) (*AuthResult, error)

// AuthResult contains the result of authentication.
type AuthResult struct {
	AccessGroups []string
	UserContext  map[string]any
}

// ServerOption configures the server.
type ServerOption func(*Server)

// WithLogger sets the logger for the server.
func WithLogger(logger ont.Logger) ServerOption {
	return func(s *Server) {
		s.logger = logger
	}
}

// WithAuth sets the authentication function.
func WithAuth(authFunc AuthFunc) ServerOption {
	return func(s *Server) {
		s.authFunc = authFunc
	}
}

// New creates a new server with the given configuration.
func New(config *ont.Config, opts ...ServerOption) *Server {
	s := &Server{
		config: config,
		logger: ont.DefaultLogger(),
		authFunc: func(r *http.Request) (*AuthResult, error) {
			// Default: allow all access groups
			groups := make([]string, 0, len(config.AccessGroups))
			for name := range config.AccessGroups {
				groups = append(groups, name)
			}
			return &AuthResult{AccessGroups: groups}, nil
		},
	}

	for _, opt := range opts {
		opt(s)
	}

	return s
}

// Handler returns an http.Handler that serves the API.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Register API endpoints for each function
	for name, fn := range s.config.Functions {
		funcName := name // capture for closure
		funcDef := fn
		mux.HandleFunc("/api/"+funcName, s.handleFunction(funcName, funcDef))
	}

	// MCP endpoints
	mux.HandleFunc("/mcp", s.handleMCP)
	mux.HandleFunc("/mcp/tools", s.handleMCPTools)
	mux.HandleFunc("/mcp/call/", s.handleMCPCall)

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	return mux
}

// Serve starts the server on the given address.
func (s *Server) Serve(addr string) error {
	log.Printf("Starting server on %s", addr)
	return http.ListenAndServe(addr, s.Handler())
}

func (s *Server) handleFunction(name string, fn ont.Function) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Only allow POST
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Authenticate
		authResult, err := s.authFunc(r)
		if err != nil {
			http.Error(w, fmt.Sprintf("Authentication failed: %v", err), http.StatusUnauthorized)
			return
		}

		// Check access
		if !fn.CheckAccess(authResult.AccessGroups) {
			http.Error(w, "Access denied", http.StatusForbidden)
			return
		}

		// Parse input
		var input map[string]any
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
			return
		}

		// Validate input
		if err := fn.ValidateInput(input); err != nil {
			http.Error(w, fmt.Sprintf("Invalid input: %v", err), http.StatusBadRequest)
			return
		}

		// Call resolver
		ctx := ont.NewContext(r, s.logger, authResult.AccessGroups, authResult.UserContext)
		output, err := fn.Resolver(ctx, input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Validate output
		if err := fn.ValidateOutput(output); err != nil {
			s.logger.Error("Output validation failed", "function", name, "error", err)
			// In development, you might want to return this error
			// In production, just log it and continue
		}

		// Initialize nil slices to prevent JSON null
		output = ont.InitializeNilSlices(output)

		// Send response
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(output); err != nil {
			s.logger.Error("Failed to encode response", "error", err)
		}
	}
}

// MCPToolsResponse is the response for the /mcp/tools endpoint.
type MCPToolsResponse struct {
	Tools []MCPTool `json:"tools"`
}

// MCPTool represents a tool in the MCP protocol.
type MCPTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

func (s *Server) handleMCP(w http.ResponseWriter, r *http.Request) {
	// MCP server info
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"name":        s.config.Name,
		"version":     "1.0",
		"description": fmt.Sprintf("%s Ontology API", s.config.Name),
		"endpoints": map[string]string{
			"tools": "/mcp/tools",
			"call":  "/mcp/call/{toolName}",
		},
	})
}

func (s *Server) handleMCPTools(w http.ResponseWriter, r *http.Request) {
	// Authenticate to filter tools by access
	authResult, err := s.authFunc(r)
	if err != nil {
		http.Error(w, fmt.Sprintf("Authentication failed: %v", err), http.StatusUnauthorized)
		return
	}

	tools := make([]MCPTool, 0)

	// Get sorted function names for deterministic output
	funcNames := make([]string, 0, len(s.config.Functions))
	for name := range s.config.Functions {
		funcNames = append(funcNames, name)
	}
	sort.Strings(funcNames)

	for _, name := range funcNames {
		fn := s.config.Functions[name]

		// Only include tools the user has access to
		if !fn.CheckAccess(authResult.AccessGroups) {
			continue
		}

		tools = append(tools, MCPTool{
			Name:        name,
			Description: fn.Description,
			InputSchema: fn.Inputs.JSONSchema(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(MCPToolsResponse{Tools: tools})
}

func (s *Server) handleMCPCall(w http.ResponseWriter, r *http.Request) {
	// Extract tool name from path
	path := r.URL.Path
	prefix := "/mcp/call/"
	if !strings.HasPrefix(path, prefix) {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	toolName := path[len(prefix):]

	// Find function
	fn, ok := s.config.Functions[toolName]
	if !ok {
		http.Error(w, fmt.Sprintf("Tool not found: %s", toolName), http.StatusNotFound)
		return
	}

	// Use the function handler
	s.handleFunction(toolName, fn)(w, r)
}

// Serve is a convenience function to create and start a server.
func Serve(config *ont.Config, addr string, opts ...ServerOption) error {
	server := New(config, opts...)
	return server.Serve(addr)
}

// initializeNilSlicesInMap recursively initializes nil slices in a map.
// This is needed when the output is a map[string]any from JSON unmarshaling.
func initializeNilSlicesInMap(m map[string]any) {
	for k, v := range m {
		if v == nil {
			continue
		}
		val := reflect.ValueOf(v)
		if val.Kind() == reflect.Slice && val.IsNil() {
			// This shouldn't happen for map[string]any since nil becomes nil, not typed nil
			continue
		}
		if nested, ok := v.(map[string]any); ok {
			initializeNilSlicesInMap(nested)
		}
		if arr, ok := v.([]any); ok {
			for _, item := range arr {
				if nested, ok := item.(map[string]any); ok {
					initializeNilSlicesInMap(nested)
				}
			}
		}
		m[k] = v
	}
}
