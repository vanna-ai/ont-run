# Using ont-run Go Server with MCP Inspector

The ont-run Go server is now fully compatible with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), enabling you to test and debug your ontology functions interactively.

## Quick Start

1. Start your ont-run Go server:
   ```bash
   cd examples/basic
   go run .
   ```

2. In another terminal, launch the MCP Inspector:
   ```bash
   npx @modelcontextprotocol/inspector
   ```

3. In the Inspector UI (opens at http://localhost:6274):
   - Select "Streamable HTTP" as the transport type
   - Enter your server URL: `http://localhost:8080/mcp`
   - Click "Connect"

## What Changed

The Go MCP server has been updated to use the official [MCP Go SDK](https://github.com/modelcontextprotocol/go-sdk), which implements:

- **JSON-RPC 2.0 Protocol**: All MCP communication now uses the standard JSON-RPC 2.0 format
- **Streamable HTTP Transport**: Single `/mcp` endpoint that handles both POST (requests) and GET (SSE streaming)
- **Session Management**: Proper session lifecycle with `Mcp-Session-Id` headers
- **Protocol Compliance**: Full compatibility with MCP spec version 2024-11-05+

## Protocol Flow

The inspector follows this sequence:

1. **Initialize**: POST `/mcp` with `initialize` method
   - Returns session ID in `Mcp-Session-Id` header
   - Negotiates protocol version and capabilities

2. **Initialized Notification**: POST `/mcp` with `notifications/initialized` method
   - Must include `Mcp-Session-Id` header from step 1
   - Signals client is ready

3. **List Tools**: POST `/mcp` with `tools/list` method
   - Returns all available ontology functions as MCP tools
   - Filtered by user's access groups

4. **Call Tool**: POST `/mcp` with `tools/call` method
   - Executes ontology function
   - Returns result as both text and structured content

## Example with curl

```bash
# 1. Initialize (save the session ID from Mcp-Session-Id header)
curl -i -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

# 2. Send initialized notification (use session ID from above)
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "notifications/initialized"
  }'

# 3. List tools
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# 4. Call a tool
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "healthCheck",
      "arguments": {}
    }
  }'
```

## Backwards Compatibility

The REST API endpoints (`/api/{functionName}`) remain unchanged and continue to work as before. The MCP endpoint is an additional interface that follows the Model Context Protocol specification.

## See Also

- [MCP Specification](https://modelcontextprotocol.io/specification/latest)
- [MCP Go SDK](https://github.com/modelcontextprotocol/go-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
