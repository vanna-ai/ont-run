# Contributing to Ontology

## Local Development Setup

```bash
# Clone the repo
git clone https://github.com/your-username/ont.git
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

# Review topology
bun run ../bin/ont.ts review --auto-approve

# Start the server
bun run ../bin/ont.ts start --api-only
```

## Project Structure

```
ont/
├── bin/ont.ts              # CLI entry point
├── src/
│   ├── index.ts            # Public exports
│   ├── cli/                # CLI commands (init, start, review)
│   ├── config/             # defineOntology() and types
│   ├── lockfile/           # Hashing and diffing logic
│   ├── server/
│   │   ├── api/            # Hono REST server
│   │   └── mcp/            # MCP server
│   ├── review/             # Browser-based review UI
│   └── runtime/            # Bun/Node.js runtime detection
├── dist/                   # Built output (generated)
└── test-project/           # Local test project (gitignored)
```

## Building

```bash
# Build for Node.js distribution
bun run build         # Builds src/index.ts -> dist/index.js
bun run build:cli     # Builds bin/ont.ts -> dist/bin/ont.js

# Both are run automatically on npm publish via prepublishOnly
```

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
   bun run ../bin/ont.ts review --auto-approve
   bun run ../bin/ont.ts start --api-only --port 3000
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
