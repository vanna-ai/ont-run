# Testing includeInMcpListTools Flag

This document describes how to test the new `includeInMcpListTools` boolean field that controls whether a function appears in MCP listTools responses.

## Overview

The `includeInMcpListTools` field is a required boolean on all function definitions that determines whether the function should be included in MCP listTools responses. This allows you to:

- Hide internal/helper functions from MCP clients
- Keep fieldFrom() reference functions hidden
- Provide a cleaner tool list to AI agents

## Changes Made

### TypeScript
- Added `includeInMcpListTools: boolean` to `FunctionDefinition` type in `src/config/types.ts`
- Updated `defineFunction` helper in `src/config/define.ts` to require the field
- Modified `generateMcpTools` in `src/server/mcp/tools.ts` to filter functions where `includeInMcpListTools === false`

### Go
- Added `IncludeInMcpListTools bool` and `IsReadOnly bool` to `Function` struct in `pkg/ontology/config.go`
- Updated MCP handler in `pkg/server/mcp.go` to skip functions where `IncludeInMcpListTools == false`

### Examples & Templates
- Updated all example functions in templates to include the field
- Set helper functions (getUserStatuses, searchTeams) to `false` for demonstration
- Set main functions to `true`

## Testing with MCP Inspector

### Prerequisites

1. Install the MCP Inspector:
   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. Build the ont-run package:
   ```bash
   cd /home/user/ont-run
   npm install
   npm run build
   npm run build:cli
   ```

### Option 1: Test with Go Example

1. Start the Go example server:
   ```bash
   cd /home/user/ont-run/examples/basic
   go build
   ./basic
   ```

2. The server will start on http://localhost:8080

3. Open the MCP Inspector and connect to: `http://localhost:8080/mcp`

4. Expected Results:
   - You should see 3 tools in the listTools response:
     - `healthCheck` (includeInMcpListTools: true)
     - `getUser` (includeInMcpListTools: true)
     - `listUsers` (includeInMcpListTools: true)

### Option 2: Test with New TypeScript Project

1. Create a new test project:
   ```bash
   mkdir /tmp/test-mcp-listtools
   cd /tmp/test-mcp-listtools
   /home/user/ont-run/dist/bin/ont.js init .
   npm install /home/user/ont-run
   ```

2. Modify `ontology.config.ts` to add a test function with `includeInMcpListTools: false`:
   ```typescript
   // Add this function to test filtering
   hiddenHelper: {
     description: 'Hidden helper function',
     access: ['public'],
     entities: [],
     isReadOnly: true,
     includeInMcpListTools: false,  // This should be hidden
     inputs: z.object({}),
     outputs: z.object({ data: z.string() }),
     resolver: async () => ({ data: 'hidden' }),
   },
   ```

3. Start the server:
   ```bash
   npm run dev:server
   ```

4. Connect MCP Inspector to: `http://localhost:3000/mcp`

5. Expected Results:
   - You should see 4 tools (healthCheck, getUser, deleteUser, getSalesData)
   - You should NOT see `hiddenHelper` in the list
   - The helper functions in the skills example (getUserStatuses, searchTeams) should also be hidden

## Manual Testing Without Inspector

You can also verify the implementation by checking the generated tools list:

```typescript
import { generateMcpTools } from 'ont-run/server/mcp/tools';

const config = /* your ontology config */;
const tools = generateMcpTools(config);

// Verify that tools with includeInMcpListTools: false are not in the list
console.log(tools.map(t => t.name));
```

## Use Cases

### Hiding Helper Functions

Functions used as data sources for `fieldFrom()` can be hidden:

```typescript
getUserStatuses: {
  description: 'Get available user statuses',
  access: ['admin'],
  entities: [],
  isReadOnly: true,
  includeInMcpListTools: false,  // Hidden - only used by fieldFrom()
  inputs: z.object({}),
  outputs: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })),
  resolver: getUserStatuses,
},

createUser: {
  description: 'Create a new user',
  access: ['admin'],
  entities: ['User'],
  isReadOnly: false,
  includeInMcpListTools: true,  // Visible to MCP clients
  inputs: z.object({
    name: z.string(),
    status: fieldFrom('getUserStatuses'),  // References hidden function
  }),
  resolver: createUser,
},
```

### Hiding Internal Functions

Internal functions that should only be called by other functions or the HTTP API:

```typescript
internalAuditLog: {
  description: 'Internal function for audit logging',
  access: ['admin'],
  entities: [],
  isReadOnly: false,
  includeInMcpListTools: false,  // Hidden from MCP
  inputs: z.object({ action: z.string(), userId: z.string() }),
  outputs: z.object({ logged: z.boolean() }),
  resolver: auditLog,
},
```

## Verification Checklist

- [ ] TypeScript builds without errors (`npm run build`)
- [ ] Go example builds without errors (`cd examples/basic && go build`)
- [ ] MCP Inspector connects successfully
- [ ] Functions with `includeInMcpListTools: true` appear in tool list
- [ ] Functions with `includeInMcpListTools: false` do NOT appear in tool list
- [ ] Hidden functions can still be called via HTTP API (`/api/{functionName}`)
- [ ] fieldFrom() still works with hidden functions
- [ ] All example templates include the new field

## Notes

- The field is **required** for all function definitions
- Functions with `includeInMcpListTools: false` are still accessible via HTTP API
- This only affects MCP listTools responses, not the HTTP API
- The field is validated at ontology definition time
