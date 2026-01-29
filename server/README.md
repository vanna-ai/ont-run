# Go Backend Server

This is the high-performance HTTP API server for ont-run, written in Go.

## Architecture

The Go backend provides:
- Fast HTTP routing and middleware using Gin framework
- Authentication and access control enforcement
- Bridge to TypeScript resolvers for business logic execution

## How It Works

1. **Config Loading**: On startup, the server:
   - Looks for `.ont/config.json` (cached config export)
   - If not found, runs `scripts/export-config.ts` to generate it from `ontology.config.ts`
   - Loads the config containing functions, access groups, and metadata

2. **Request Handling**: For each API request:
   - Authenticates the request (currently mock auth, can be extended)
   - Checks access control based on function requirements
   - Parses and validates input

3. **Resolver Execution**: To execute TypeScript resolvers:
   - Creates a bridge script that imports the resolver
   - Passes the context and arguments as JSON
   - Executes via `bun eval` or `node --input-type=module`
   - Returns the result as JSON

## Building

```bash
go build -o ont-server main.go
```

Or from the root directory:
```bash
bun run build:go
```

## Running

```bash
# Set environment variables
export PORT=3000
export ONT_ENV=dev

# Run the server
./ont-server
```

The server will:
- Load/export the ontology config
- Start HTTP server on specified port
- Display available functions and endpoints

## Environment Variables

- `PORT` - HTTP port (default: 3000)
- `ONT_ENV` - Environment name (default: "dev")

## Endpoints

- `GET /health` - Health check endpoint
- `GET /api` - List available functions for the authenticated user
- `POST /api/{function}` - Execute a specific function

## Future Improvements

- Implement actual auth function bridge (currently uses mock auth)
- Add caching for resolver executions
- Support WebSocket/SSE for streaming responses
- Add metrics and monitoring
- Optimize resolver bridge for better performance
