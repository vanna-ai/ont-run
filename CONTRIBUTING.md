# Contributing to Ontology

## Local Development Setup

```bash
# Clone the repo
git clone https://github.com/vanna-ai/ont-run.git
cd ont

# Install dependencies
bun install
```

## Running the CLI Locally

Instead of `bunx ont-run`, use `bun run bin/ont.ts`:

```bash
# Initialize a test project
bun run bin/ont.ts init test-project
cd test-project

# Review ontology
bun run ../bin/ont.ts review --auto-approve

# Start the server (uses server.ts created by init)
bun run server.ts
```

## Project Structure

```
ont/
├── bin/ont.ts              # CLI entry point
├── server/                 # Go backend
│   ├── main.go             # HTTP API server (Go)
│   └── ont-server          # Compiled Go binary (gitignored)
├── src/
│   ├── index.ts            # Public exports
│   ├── cli/                # CLI commands (init, review)
│   ├── config/             # defineOntology() and types
│   ├── lockfile/           # Hashing and diffing logic
│   ├── server/
│   │   ├── start-go.ts     # Go backend launcher
│   │   ├── api/            # (Legacy TypeScript server)
│   │   └── mcp/            # MCP server
│   ├── browser/            # Browser-based review UI
│   └── runtime/            # Runtime utilities
├── go.mod                  # Go dependencies
├── go.sum                  # Go dependency checksums
├── dist/                   # Built output (generated)
└── test-project/           # Local test project (gitignored)
```

## Building

ont-run uses a hybrid architecture with a Go backend and TypeScript configuration layer.

```bash
# Build the Go backend server
cd server
go build -o ont-server main.go

# Or use the npm/bun script (from root)
bun run build:go      # Builds the Go server

# Build TypeScript components
bun run build         # Builds src/index.ts -> dist/index.js
bun run build:cli     # Builds bin/ont.ts -> dist/bin/ont.js

# Build everything
bun run build         # Runs build:go then builds TypeScript
```

The build process:
1. **Go server** (`server/ont-server`) - The HTTP API server binary
2. **TypeScript library** (`dist/`) - Config loader, CLI, and utilities  
3. **CLI** (`dist/bin/ont.js`) - The ont-run CLI tool

All are built automatically on npm publish via `prepublishOnly`.

## Testing Changes

1. Make your changes in `src/`
2. Test with the local CLI:
   ```bash
   bun run bin/ont.ts <command>
   ```
3. For a full integration test:
   ```bash
   rm -rf test-project
   bun run bin/ont.ts init test-project
   cd test-project
   bun install
   bun run ../bin/ont.ts review --auto-approve
   bun run server.ts
   # In another terminal:
   curl -X POST http://localhost:3000/api/healthCheck
   ```

## Testing Node.js Compatibility

```bash
# Build first
bun run build && bun run build:cli

# Run with Node.js
node dist/bin/ont.js --help
```
