// Package server provides HTTP and MCP server implementations for ontology APIs.
package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"reflect"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/vanna-ai/ont-run/pkg/cloud"
	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

// Server is the main server that handles both REST API and MCP protocol.
type Server struct {
	config   *ont.Config
	logger   ont.Logger
	authFunc AuthFunc
	staticFS http.FileSystem
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

// WithStaticFS sets the static file system for serving frontend assets.
// In production, pass an embed.FS wrapped with http.FS() to serve embedded files.
func WithStaticFS(fs http.FileSystem) ServerOption {
	return func(s *Server) {
		s.staticFS = fs
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

	// MCP endpoint using official SDK
	mcpHandler := s.createMCPHandler()
	mux.Handle("/mcp", mcpHandler)

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Static file serving (for production builds with embedded frontend)
	if s.staticFS != nil {
		mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Try to serve the actual file first
			if path != "/" {
				// Check if file exists in static FS
				if f, err := s.staticFS.Open(path); err == nil {
					f.Close()
					http.FileServer(s.staticFS).ServeHTTP(w, r)
					return
				}
			}

			// Serve index.html for root and SPA routes
			f, err := s.staticFS.Open("/index.html")
			if err != nil {
				http.Error(w, "index.html not found", http.StatusInternalServerError)
				return
			}
			defer f.Close()

			stat, err := f.Stat()
			if err != nil {
				http.Error(w, "Failed to stat index.html", http.StatusInternalServerError)
				return
			}

			// Serve index.html
			http.ServeContent(w, r, "index.html", stat.ModTime(), f.(io.ReadSeeker))
		}))
	}

	return mux
}

// Serve starts the server on the given address.
func (s *Server) Serve(addr string) error {
	// Cloud registration (if enabled)
	if s.config.Cloud && s.config.UUID != "" {
		cloud.TryRegisterWithCloud(s.config.UUID, s.config)
	}

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

// contextKey is a type for context keys in this package.
type contextKey string

// httpRequestKey is used to store the real *http.Request in the context.
const httpRequestKey contextKey = "httpRequest"

// createMCPHandler creates an MCP handler using the official SDK.
func (s *Server) createMCPHandler() http.Handler {
	// Create MCP server
	mcpServer := mcp.NewServer(&mcp.Implementation{
		Name:    s.config.Name,
		Version: "1.0.0",
	}, nil)

	// Add tools for each function
	for name, fn := range s.config.Functions {
		toolName := name
		funcDef := fn

		// Create tool with JSON Schema
		tool := &mcp.Tool{
			Name:         toolName,
			Description:  funcDef.Description,
			InputSchema:  funcDef.Inputs.JSONSchema(),
			OutputSchema: funcDef.Outputs.JSONSchema(),
		}

		// Add the tool with a handler
		mcp.AddTool(mcpServer, tool, s.createMCPToolHandler(toolName, funcDef))
	}

	// Create HTTP handler using StreamableHTTP transport
	handler := mcp.NewStreamableHTTPHandler(func(r *http.Request) *mcp.Server {
		return mcpServer
	}, nil)

	// Wrap to inject the real HTTP request into context so tool handlers can access it
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), httpRequestKey, r)
		handler.ServeHTTP(w, r.WithContext(ctx))
	})
}

// createMCPToolHandler creates an MCP tool handler for a given function.
func (s *Server) createMCPToolHandler(name string, fn ont.Function) func(context.Context, *mcp.CallToolRequest, map[string]any) (*mcp.CallToolResult, any, error) {
	return func(ctx context.Context, req *mcp.CallToolRequest, args map[string]any) (*mcp.CallToolResult, any, error) {
		// Extract real HTTP request from context (injected by createMCPHandler wrapper)
		httpReq, _ := ctx.Value(httpRequestKey).(*http.Request)
		if httpReq == nil {
			httpReq = &http.Request{Header: http.Header{}}
		}

		// Authenticate
		authResult, err := s.authFunc(httpReq)
		if err != nil {
			return nil, nil, fmt.Errorf("authentication failed: %v", err)
		}

		// Check access
		if !fn.CheckAccess(authResult.AccessGroups) {
			return nil, nil, fmt.Errorf("access denied")
		}

		// Validate input
		if err := fn.ValidateInput(args); err != nil {
			return nil, nil, fmt.Errorf("invalid input: %v", err)
		}

		// Call resolver
		resolverCtx := ont.NewContext(httpReq, s.logger, authResult.AccessGroups, authResult.UserContext)
		output, err := fn.Resolver(resolverCtx, args)
		if err != nil {
			return nil, nil, err
		}

		// Validate output
		if err := fn.ValidateOutput(output); err != nil {
			s.logger.Error("Output validation failed", "function", name, "error", err)
		}

		// Initialize nil slices
		output = ont.InitializeNilSlices(output)

		// Return result as text content
		outputJSON, err := json.Marshal(output)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to marshal output: %v", err)
		}

		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: string(outputJSON)},
			},
		}, output, nil
	}
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
