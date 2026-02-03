// Package ontology provides the core types and functionality for defining,
// validating, and serving ontology-first APIs.
package ontology

import (
	"fmt"
	"net/http"
)

// Config represents the complete ontology configuration.
type Config struct {
	Name         string                 `json:"name" validate:"required"`
	UUID         string                 `json:"uuid,omitempty"`  // Unique identifier for cloud registration
	Cloud        bool                   `json:"cloud,omitempty"` // Enable cloud registration
	AccessGroups map[string]AccessGroup `json:"accessGroups" validate:"required"`
	Entities     map[string]Entity      `json:"entities" validate:"required"`
	Functions    map[string]Function    `json:"functions" validate:"required"`
}

// AccessGroup defines a group of users with specific permissions.
type AccessGroup struct {
	Description string `json:"description" validate:"required"`
}

// Entity represents a domain object in the ontology.
type Entity struct {
	Description string `json:"description" validate:"required"`
}

// Function represents an API function in the ontology.
type Function struct {
	Description string       `json:"description" validate:"required"`
	Access      []string     `json:"access" validate:"required,min=1"`
	Entities    []string     `json:"entities,omitempty"`
	Inputs      Schema       `json:"inputs" validate:"required"`
	Outputs     Schema       `json:"outputs" validate:"required"`
	Resolver    ResolverFunc `json:"-"` // Excluded from serialization
}

// ResolverFunc is the function signature for resolving API calls.
type ResolverFunc func(ctx Context, input any) (any, error)

// Context provides contextual information for resolver functions.
type Context interface {
	// Request returns the underlying HTTP request.
	Request() *http.Request

	// Logger returns a logger for the current request.
	Logger() Logger

	// AccessGroups returns the access groups for the current user.
	AccessGroups() []string

	// UserContext returns user-specific context data.
	UserContext() map[string]any
}

// Logger provides structured logging capabilities.
type Logger interface {
	Info(msg string, keysAndValues ...any)
	Error(msg string, keysAndValues ...any)
	Debug(msg string, keysAndValues ...any)
	Warn(msg string, keysAndValues ...any)
}

// requestContext is the default implementation of Context.
type requestContext struct {
	request      *http.Request
	logger       Logger
	accessGroups []string
	userContext  map[string]any
}

func (c *requestContext) Request() *http.Request {
	return c.request
}

func (c *requestContext) Logger() Logger {
	return c.logger
}

func (c *requestContext) AccessGroups() []string {
	return c.accessGroups
}

func (c *requestContext) UserContext() map[string]any {
	return c.userContext
}

// NewContext creates a new request context.
func NewContext(r *http.Request, logger Logger, accessGroups []string, userContext map[string]any) Context {
	return &requestContext{
		request:      r,
		logger:       logger,
		accessGroups: accessGroups,
		userContext:  userContext,
	}
}

// defaultLogger is a basic logger implementation.
type defaultLogger struct{}

func (l *defaultLogger) Info(msg string, keysAndValues ...any)  {}
func (l *defaultLogger) Error(msg string, keysAndValues ...any) {}
func (l *defaultLogger) Debug(msg string, keysAndValues ...any) {}
func (l *defaultLogger) Warn(msg string, keysAndValues ...any)  {}

// DefaultLogger returns a no-op logger.
func DefaultLogger() Logger {
	return &defaultLogger{}
}

// ConsoleLogger returns a logger that logs to stdout.
func ConsoleLogger() Logger {
	return &consoleLogger{}
}

type consoleLogger struct{}

func (l *consoleLogger) Info(msg string, keysAndValues ...any) {
	println("[INFO]", msg, formatKeyValues(keysAndValues))
}

func (l *consoleLogger) Error(msg string, keysAndValues ...any) {
	println("[ERROR]", msg, formatKeyValues(keysAndValues))
}

func (l *consoleLogger) Debug(msg string, keysAndValues ...any) {
	println("[DEBUG]", msg, formatKeyValues(keysAndValues))
}

func (l *consoleLogger) Warn(msg string, keysAndValues ...any) {
	println("[WARN]", msg, formatKeyValues(keysAndValues))
}

func formatKeyValues(keysAndValues []any) string {
	if len(keysAndValues) == 0 {
		return ""
	}
	result := ""
	for i := 0; i < len(keysAndValues); i += 2 {
		key := keysAndValues[i]
		val := ""
		if i+1 < len(keysAndValues) {
			val = fmt.Sprintf("%v", keysAndValues[i+1])
		}
		result += fmt.Sprintf(" %v=%s", key, val)
	}
	return result
}
