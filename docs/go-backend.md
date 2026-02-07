# Go Backend (Development Branch)

This document covers testing the Go backend packages from the `claude/migrate-typescript-to-go-ctdVL` branch.

## Installing from Branch

```bash
go get github.com/vanna-ai/ont-run@claude/migrate-typescript-to-go-ctdVL
```

Or in your `go.mod`:

```go
require github.com/vanna-ai/ont-run v0.0.0

replace github.com/vanna-ai/ont-run => github.com/vanna-ai/ont-run@claude/migrate-typescript-to-go-ctdVL
```

For local development, use a local replace:

```go
replace github.com/vanna-ai/ont-run => /path/to/ont-run
```

## Package Structure

```
pkg/
├── ontology/          # Core ontology types and validation
│   ├── config.go      # Config struct and Function/Entity types
│   ├── schema.go      # Zod-like schema builders (String, Number, Object, etc.)
│   ├── validator.go   # Input/output validation against schemas
│   ├── lock.go        # ont.lock file generation and verification
│   ├── hash.go        # Deterministic hashing for change detection
│   └── jsonschema.go  # JSON Schema generation from schemas
├── server/            # HTTP server with MCP support
│   └── mcp.go         # REST API + MCP endpoints + static file serving
├── codegen/
│   └── typescript/    # TypeScript SDK generator
│       └── generator.go
└── cloud/             # ont-run.com integration
    ├── client.go
    └── registration.go
```

## Quick Start: Adding Go Backend to Existing Frontend

### 1. Create the Go backend

```bash
mkdir backend && cd backend
go mod init myapp/backend
```

### 2. Create `ontology.config.go`

```go
package main

import (
    ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

func DefineOntology() *ont.Config {
    return &ont.Config{
        Name: "myapp",
        UUID: "your-uuid-here",  // For cloud registration

        AccessGroups: map[string]ont.AccessGroup{
            "public": {Description: "Unauthenticated users"},
            "user":   {Description: "Authenticated users"},
            "admin":  {Description: "Administrators"},
        },

        Entities: map[string]ont.Entity{
            "User": {Description: "User accounts"},
        },

        Functions: map[string]ont.Function{
            "healthCheck": {
                Description: "Health check endpoint",
                Access:      []string{"public"},
                Inputs:      ont.Object(map[string]ont.Schema{}),
                Outputs: ont.Object(map[string]ont.Schema{
                    "status":    ont.String(),
                    "timestamp": ont.String(),
                }),
                Resolver: func(ctx ont.Context, input any) (any, error) {
                    return map[string]any{
                        "status":    "ok",
                        "timestamp": time.Now().UTC().Format(time.RFC3339),
                    }, nil
                },
            },
            "getUser": {
                Description: "Get user by ID",
                Access:      []string{"user", "admin"},
                Entities:    []string{"User"},
                Inputs: ont.Object(map[string]ont.Schema{
                    "id": ont.String().UUID(),
                }),
                Outputs: ont.Object(map[string]ont.Schema{
                    "id":    ont.String(),
                    "name":  ont.String(),
                    "email": ont.String().Email(),
                }),
                Resolver: func(ctx ont.Context, input any) (any, error) {
                    // Your implementation here
                    return map[string]any{
                        "id":    "123",
                        "name":  "Test User",
                        "email": "test@example.com",
                    }, nil
                },
            },
        },
    }
}
```

### 3. Create `main.go`

```go
package main

import (
    "log"
    "net/http"

    ont "github.com/vanna-ai/ont-run/pkg/ontology"
    "github.com/vanna-ai/ont-run/pkg/codegen/typescript"
    "github.com/vanna-ai/ont-run/pkg/server"
)

func main() {
    ontology := DefineOntology()

    if err := ontology.Validate(); err != nil {
        log.Fatalf("Invalid ontology: %v", err)
    }

    // Generate TypeScript SDK for frontend
    if err := typescript.GenerateTypeScript(ontology, "../frontend/src/sdk"); err != nil {
        log.Fatalf("Failed to generate SDK: %v", err)
    }

    // Generate ont.lock for change tracking
    if err := ontology.WriteLock("../ont.lock"); err != nil {
        log.Fatalf("Failed to write lock: %v", err)
    }

    // Start server with auth
    log.Println("Starting server on :8080...")
    err := server.Serve(ontology, ":8080",
        server.WithLogger(ont.ConsoleLogger()),
        server.WithAuth(func(r *http.Request) (*server.AuthResult, error) {
            // Your auth logic here
            return &server.AuthResult{
                AccessGroups: []string{"public", "user", "admin"},
            }, nil
        }),
    )
    if err != nil {
        log.Fatal(err)
    }
}
```

### 4. Run the backend

```bash
go run .
```

## Schema API

The schema API mirrors Zod's chainable syntax:

```go
// Primitives
ont.String()                    // string
ont.Number()                    // float64
ont.Integer()                   // int
ont.Boolean()                   // bool

// With constraints
ont.String().MinLength(1).MaxLength(100)
ont.String().Email()
ont.String().UUID()
ont.String().URL()
ont.String().DateTime()
ont.String().Date()
ont.String().Regex(`^\d{3}-\d{4}$`)
ont.Number().Min(0).Max(100)
ont.Integer().Min(1)

// Complex types
ont.Object(map[string]ont.Schema{
    "name": ont.String(),
    "age":  ont.Integer(),
})
ont.Array(ont.String())         // []string
ont.Optional(ont.String())      // *string (nullable)

// Making object fields optional
ont.Object(map[string]ont.Schema{
    "required": ont.String(),
    "optional": ont.String(),
}).Optional("optional")
```

## Server Endpoints

The server automatically creates:

| Endpoint | Description |
|----------|-------------|
| `POST /api/{functionName}` | Call an ontology function |
| `GET /health` | Health check |
| `GET /mcp` | MCP server info |
| `GET /mcp/tools` | List available MCP tools |
| `POST /mcp/call/{toolName}` | Call an MCP tool |

## Generated TypeScript SDK

The SDK generator creates type-safe client code:

```typescript
// frontend/src/sdk/index.ts (auto-generated)
export class OntologyClient {
  constructor(private baseUrl: string = '') {}

  async healthCheck(input: HealthCheckInput): Promise<HealthCheckOutput> {
    const res = await fetch(`${this.baseUrl}/api/healthCheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getUser(input: GetUserInput): Promise<GetUserOutput> {
    // ...
  }
}
```

Usage in React:

```tsx
import { OntologyClient } from './sdk';

const client = new OntologyClient(); // Uses relative URLs

function MyComponent() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    client.getUser({ id: '123' }).then(setUser);
  }, []);

  return <div>{user?.name}</div>;
}
```

## Authentication

Implement `server.WithAuth` to integrate your auth system:

```go
server.WithAuth(func(r *http.Request) (*server.AuthResult, error) {
    token := r.Header.Get("Authorization")

    if token == "" {
        return &server.AuthResult{
            AccessGroups: []string{"public"},
        }, nil
    }

    // Validate JWT, API key, session, etc.
    claims, err := validateToken(token)
    if err != nil {
        return nil, err
    }

    return &server.AuthResult{
        AccessGroups: claims.Groups,
        UserContext: map[string]any{
            "userId": claims.UserID,
        },
    }, nil
})
```

Access `UserContext` in resolvers via `ctx.User()`.

## Production: Embedded Frontend

For single-binary deployment with embedded frontend:

```go
//go:embed static/*
var staticFiles embed.FS

func main() {
    // ...
    staticFS, _ := fs.Sub(staticFiles, "static")
    opts := []server.ServerOption{
        server.WithStaticFS(http.FS(staticFS)),
    }
    server.Serve(ontology, ":8080", opts...)
}
```

Build process:
1. Build frontend → `frontend/dist/`
2. Copy to `backend/static/`
3. Build Go binary: `go build -o server .`

## Testing

Run the Go tests:

```bash
cd /path/to/ont-run
go test ./pkg/...
```

## Known Limitations (Development Branch)

- Cloud registration API format may change
- No Windows testing yet
- SDK generator doesn't handle all edge cases
