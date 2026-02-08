// Package cloud provides integration with the ont-run.com cloud service.
package cloud

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"time"
)

const (
	// DefaultBaseURL is the default ont-run.com API base URL.
	DefaultBaseURL = "https://ont-run.com"

	// APIKeyEnvVar is the environment variable for the API key.
	APIKeyEnvVar = "ONT_API_KEY"

	// APIKeyHeader is the header used for authentication.
	APIKeyHeader = "X-ONT-API-KEY"
)

// Client provides methods for interacting with the ont-run.com API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// ClientOption configures the Client.
type ClientOption func(*Client)

// WithBaseURL sets a custom base URL for the API.
func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

// WithAPIKey sets the API key for authentication.
func WithAPIKey(key string) ClientOption {
	return func(c *Client) {
		c.apiKey = key
	}
}

// WithHTTPClient sets a custom HTTP client.
func WithHTTPClient(client *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = client
	}
}

// NewClient creates a new cloud client.
func NewClient(opts ...ClientOption) *Client {
	c := &Client{
		baseURL: DefaultBaseURL,
		apiKey:  os.Getenv(APIKeyEnvVar),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// HasAPIKey returns true if an API key is configured.
func (c *Client) HasAPIKey() bool {
	return c.apiKey != ""
}

// OntologySnapshot represents the ontology data sent to the cloud.
type OntologySnapshot struct {
	Name         string                   `json:"name"`
	AccessGroups []string                 `json:"accessGroups"`
	Entities     []string                 `json:"entities,omitempty"`
	Functions    map[string]FunctionShape `json:"functions"`
}

// FunctionShape represents a function definition for the cloud.
type FunctionShape struct {
	Description   string         `json:"description"`
	Access        []string       `json:"access"`
	Entities      []string       `json:"entities"`
	InputsSchema  map[string]any `json:"inputsSchema"`
	OutputsSchema map[string]any `json:"outputsSchema,omitempty"`
}

// RegisterRequest is the request body for registration.
type RegisterRequest struct {
	UUID        string           `json:"uuid"`
	OntologyDef OntologySnapshot `json:"ontologyDef"`
	Hash        string           `json:"hash"`
}

// RegisterResponse is the response from registration.
type RegisterResponse struct {
	Success      bool   `json:"success"`
	Hash         string `json:"hash"`
	VersionID    string `json:"versionId,omitempty"`
	LimitReached bool   `json:"limitReached,omitempty"`
	Message      string `json:"message,omitempty"`
}

// RegistrationResult is the result of a registration attempt.
type RegistrationResult struct {
	Success      bool
	Hash         string
	VersionID    string
	Verified     bool
	LimitReached bool
	Message      string
}

// Register sends the ontology to ont-run.com for registration.
func (c *Client) Register(uuid string, snapshot OntologySnapshot) (*RegistrationResult, error) {
	// Compute hash of the snapshot
	hash := computeSnapshotHash(snapshot)

	req := RegisterRequest{
		UUID:        uuid,
		OntologyDef: snapshot,
		Hash:        hash,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/api/agent/register", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set(APIKeyHeader, c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registration failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var registerResp RegisterResponse
	if err := json.Unmarshal(respBody, &registerResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &RegistrationResult{
		Success:      registerResp.Success,
		Hash:         registerResp.Hash,
		VersionID:    registerResp.VersionID,
		Verified:     c.HasAPIKey(),
		LimitReached: registerResp.LimitReached,
		Message:      registerResp.Message,
	}, nil
}

// ChatMessage represents a message in a chat conversation.
type ChatMessage struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

// ChatRequest is the request body for chat.
type ChatRequest struct {
	UUID     string         `json:"uuid"`
	Messages []ChatMessage  `json:"messages"`
	Context  map[string]any `json:"context,omitempty"`
}

// ToolCall represents a tool call in a chat response.
type ToolCall struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
	Result    any            `json:"result,omitempty"`
}

// ChatResponse is the response from chat.
type ChatResponse struct {
	Success      bool       `json:"success"`
	Message      string     `json:"message,omitempty"`
	ToolCalls    []ToolCall `json:"toolCalls,omitempty"`
	LimitReached bool       `json:"limitReached,omitempty"`
}

// Chat sends a chat message to the AI agent.
func (c *Client) Chat(uuid string, messages []ChatMessage, context map[string]any) (*ChatResponse, error) {
	req := ChatRequest{
		UUID:     uuid,
		Messages: messages,
		Context:  context,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/api/agent/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set(APIKeyHeader, c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("chat failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &chatResp, nil
}

// VersionEntry represents a version in the history.
type VersionEntry struct {
	ID        string `json:"id"`
	Hash      string `json:"hash"`
	CreatedAt string `json:"createdAt"`
	Verified  bool   `json:"verified"`
	Status    string `json:"status"` // "pending", "approved", "rejected"
}

// VersionsResponse is the response from versions.
type VersionsResponse struct {
	Success  bool           `json:"success"`
	Versions []VersionEntry `json:"versions"`
}

// Versions retrieves the version history for an ontology.
func (c *Client) Versions(uuid string) (*VersionsResponse, error) {
	req := map[string]string{"uuid": uuid}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/api/agent/versions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set(APIKeyHeader, c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("versions failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var versionsResp VersionsResponse
	if err := json.Unmarshal(respBody, &versionsResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &versionsResp, nil
}

// ReviewRequest is the request body for review.
type ReviewRequest struct {
	UUID      string `json:"uuid"`
	VersionID string `json:"versionId"`
	Action    string `json:"action"` // "approve" or "reject"
	Comment   string `json:"comment,omitempty"`
}

// ReviewResponse is the response from review.
type ReviewResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// Review approves or rejects a version.
func (c *Client) Review(uuid, versionID, action, comment string) (*ReviewResponse, error) {
	req := ReviewRequest{
		UUID:      uuid,
		VersionID: versionID,
		Action:    action,
		Comment:   comment,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/api/agent/review", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set(APIKeyHeader, c.apiKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("review failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var reviewResp ReviewResponse
	if err := json.Unmarshal(respBody, &reviewResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &reviewResp, nil
}

// computeSnapshotHash computes a SHA256 hash of the snapshot (first 16 hex chars).
func computeSnapshotHash(snapshot OntologySnapshot) string {
	// Sort for deterministic hashing
	sort.Strings(snapshot.AccessGroups)
	sort.Strings(snapshot.Entities)

	for name, fn := range snapshot.Functions {
		sort.Strings(fn.Access)
		sort.Strings(fn.Entities)
		snapshot.Functions[name] = fn
	}

	data, _ := json.Marshal(snapshot)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])[:16]
}
