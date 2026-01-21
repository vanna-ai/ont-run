# Ontology

**Define your business as an ontology. Build it with AI.**

Ontology generates REST APIs and MCP servers from a single declarative config, with built-in access control that prevents AI agents from escalating privileges.

```typescript
// ontology.config.ts
import { defineOntology, z } from 'ont-run';

export default defineOntology({
  name: 'my-api',
  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },
  auth: async (req) => {
    const token = req.headers.get('Authorization');
    return token ? ['admin'] : ['public'];
  },
  accessGroups: {
    public: { description: 'Unauthenticated users' },
    admin: { description: 'Administrators' },
  },
  entities: {
    Product: { description: 'A product in the catalog' },
  },
  functions: {
    getProduct: {
      description: 'Get product by ID',
      access: ['public', 'admin'],
      entities: ['Product'],
      inputs: z.object({ id: z.string() }),
      resolver: './resolvers/getProduct.ts',
    },
    deleteProduct: {
      description: 'Delete a product',
      access: ['admin'],  // AI cannot add 'public' here without review
      entities: ['Product'],
      inputs: z.object({ id: z.string() }),
      resolver: './resolvers/deleteProduct.ts',
    },
  },
});
```

## Why Ontology?

Your ontology isn't just an API definition—it's your business in code:

- **Entities** define what your business operates on (Users, Orders, Products)
- **Functions** define what your business can do (createOrder, processPayment)
- **Access groups** define who can do what (admin, support, public)
- **Relationships** show how concepts connect (fieldFrom, entity tags)

This is your operational DNA. The topology—the shape of what exists and who can access it—is often more valuable than the implementation code itself.

### Two Layers

| Layer | Contains | Who modifies |
|-------|----------|--------------|
| **Topology** | Entities, functions, access, relationships | Humans only (`ont-run review`) |
| **Logic** | Resolver implementations | AI agents freely |

AI can write your business logic. But only humans can change what the business *is*.

## Installation

```bash
# With Bun
bun add ont-run

# With npm
npm install ont-run
```

Ontology is **runtime-agnostic** and works with both Bun and Node.js:

```bash
# Bun
bunx ont-run start

# Node.js
npx ont-run start
```

Under the hood, Ontology uses [Hono](https://hono.dev/) as its web framework for both the REST API and MCP servers.

## Quick Start

### 1. Initialize a new project

```bash
bunx ont-run init my-api
cd my-api
```

This creates:
```
my-api/
├── ontology.config.ts    # Your API definition
├── resolvers/
│   ├── healthCheck.ts    # Example resolver
│   ├── getUser.ts
│   └── deleteUser.ts
```

### 2. Review and approve the initial topology

```bash
bunx ont-run review
```

This opens a browser window showing all functions and their access groups. Click **Approve** to generate the `ont.lock` file.

### 3. Start the servers

```bash
bunx ont-run start
```

Your API is now running at `http://localhost:3000`:

```bash
# Public endpoint - works without auth
curl -X POST http://localhost:3000/api/healthCheck

# Protected endpoint - requires auth
curl -X POST http://localhost:3000/api/getUser \
  -H "Authorization: your-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "123e4567-e89b-12d3-a456-426614174000"}'
```

## Configuration Reference

### `defineOntology(config)`

The main configuration function. Returns a validated config object.

```typescript
import { defineOntology, z } from 'ont-run';

export default defineOntology({
  // Required: Name of your API
  name: 'my-api',

  // Required: Environment configurations
  environments: {
    dev: { debug: true, /* custom fields */ },
    test: { debug: false },
    prod: { debug: false },
  },

  // Required: Auth function that returns access groups for a request
  auth: async (req: Request) => {
    // Implement your auth logic here
    // Return an array of access group names
    return ['public'];
  },

  // Required: Define your access groups
  accessGroups: {
    public: { description: 'Unauthenticated users' },
    user: { description: 'Authenticated users' },
    admin: { description: 'Administrators' },
  },

  // Optional: Define entities (domain concepts)
  entities: {
    User: { description: 'A user account' },
    Order: { description: 'A customer order' },
  },

  // Required: Define your functions
  functions: {
    functionName: {
      description: 'What this function does',
      access: ['public', 'user', 'admin'],  // Who can call it
      entities: ['User'],                    // Which entities this relates to
      inputs: z.object({ /* Zod schema */ }),
      resolver: './resolvers/functionName.ts',
    },
  },
});
```

### Auth Function

The `auth` function receives the raw `Request` object and must return an array of access group names:

```typescript
auth: async (req) => {
  // Example: JWT authentication
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return ['public'];
  }

  try {
    const payload = await verifyJWT(token);

    if (payload.role === 'admin') {
      return ['admin', 'user', 'public'];
    }

    return ['user', 'public'];
  } catch {
    return ['public'];
  }
},
```

### Input Validation

Inputs are validated using [Zod](https://zod.dev/) schemas:

```typescript
import { z } from 'ont-run';  // Re-exported from zod

functions: {
  createUser: {
    description: 'Create a new user',
    access: ['admin'],
    inputs: z.object({
      email: z.string().email(),
      name: z.string().min(1).max(100),
      role: z.enum(['user', 'moderator', 'admin']).default('user'),
      metadata: z.record(z.string()).optional(),
    }),
    resolver: './resolvers/createUser.ts',
  },
}
```

### Entities

Entities categorize functions by the domain objects they relate to:

```typescript
entities: {
  User: { description: 'A user account' },
  Order: { description: 'A customer order' },
},

functions: {
  getUser: {
    entities: ['User'],
    // ...
  },
  createOrder: {
    entities: ['User', 'Order'],  // Touches multiple entities
    // ...
  },
}
```

This helps with:
- **Visual review**: See all functions that touch a concept
- **AI discovery**: Agents understand your API structure
- **Documentation**: Functions grouped by domain area

### Field References

Use `fieldFrom()` to create fields that get their options from other functions:

```typescript
import { defineOntology, fieldFrom, z } from 'ont-run';

functions: {
  // Options provider
  getUserStatuses: {
    description: 'Get available statuses',
    access: ['admin'],
    entities: [],
    inputs: z.object({}),
    outputs: z.array(z.object({ value: z.string(), label: z.string() })),
    resolver: './resolvers/getUserStatuses.ts',
  },

  // Uses those options
  updateUser: {
    description: 'Update a user',
    access: ['admin'],
    entities: ['User'],
    inputs: z.object({
      userId: z.string(),
      status: fieldFrom('getUserStatuses'),  // Options from another function
    }),
    resolver: './resolvers/updateUser.ts',
  },
}
```

Two modes:
- **Bulk**: Source function has empty inputs → all options fetched at once
- **Autocomplete**: Source function has a `query` input → options searched dynamically

## Writing Resolvers

Resolvers are async functions that receive a context and validated arguments:

```typescript
// resolvers/createUser.ts
import type { ResolverContext } from 'ont-run';

interface CreateUserArgs {
  email: string;
  name: string;
  role: 'user' | 'moderator' | 'admin';
  metadata?: Record<string, string>;
}

export default async function createUser(
  ctx: ResolverContext,
  args: CreateUserArgs
) {
  const { email, name, role, metadata } = args;

  // ctx.env - Current environment name ('dev', 'prod', etc.)
  // ctx.envConfig - Environment configuration object
  // ctx.logger - Logger with info, warn, error, debug methods
  // ctx.accessGroups - Access groups for the current request

  ctx.logger.info(`Creating user: ${email}`);

  // Your business logic here
  // Connect to databases, call external APIs, etc.

  return {
    id: 'user-123',
    email,
    name,
    role,
    createdAt: new Date().toISOString(),
  };
}
```

### Resolver Context

| Property | Type | Description |
|----------|------|-------------|
| `ctx.env` | `string` | Current environment name |
| `ctx.envConfig` | `object` | Environment configuration |
| `ctx.logger` | `Logger` | Logger instance |
| `ctx.accessGroups` | `string[]` | Access groups for current request |

## CLI Commands

### `ont-run init [dir]`

Initialize a new Ontology project.

```bash
bunx ont-run init              # Current directory
bunx ont-run init my-api       # Create my-api directory
bunx ont-run init . --force    # Overwrite existing files
```

### `ont-run review`

Review and approve topology changes.

```bash
bunx ont-run review              # Opens browser UI
bunx ont-run review --auto-approve   # Auto-approve (for CI)
bunx ont-run review --print-only     # Print diff and exit
```

### `ont-run start`

Start the API and MCP servers.

```bash
bunx ont-run start                      # Default: dev env, port 3000
bunx ont-run start --env prod           # Use production environment
bunx ont-run start --port 8080          # Custom port
bunx ont-run start --api-only           # Only start REST API
bunx ont-run start --mcp-only           # Only start MCP server
bunx ont-run start --mcp-access admin   # Set MCP access groups
```

## The Lockfile Mechanism

The `ont.lock` file is the core of Ontology's security model.

### What Gets Hashed

The lockfile contains a SHA256 hash of your **topology**:

- Function names
- Function descriptions
- Access group assignments
- Input schemas (converted to JSON Schema)

### What Doesn't Get Hashed

- Resolver file paths
- Resolver implementations
- Environment configurations
- Auth function implementation

This means AI agents can freely modify resolver logic without triggering a review.

### Example Lockfile

```json
{
  "version": 1,
  "hash": "a1b2c3d4e5f67890",
  "approvedAt": "2025-01-13T10:00:00Z",
  "topology": {
    "name": "my-api",
    "accessGroups": ["admin", "public", "user"],
    "functions": {
      "getUser": {
        "description": "Get user by ID",
        "access": ["admin", "user"],
        "inputsSchema": {
          "type": "object",
          "properties": {
            "userId": { "type": "string", "format": "uuid" }
          },
          "required": ["userId"]
        }
      }
    }
  }
}
```

### Startup Protection

When you run `ont-run start`:

1. Config is loaded and topology extracted
2. Current hash is computed
3. Hash is compared against `ont.lock`
4. If mismatch → **Startup blocked**

```
❌ ERROR  Topology has changed since last review.
❌ ERROR  The ontology structure (functions, access groups, or inputs)
❌ ERROR  has been modified. This requires explicit approval.
❌ ERROR  Run `ont-run review` to review and approve the changes.
```

## MCP Integration

Ontology automatically generates an MCP (Model Context Protocol) server alongside your REST API. The MCP server uses HTTP with SSE (Server-Sent Events) transport.

### Starting the Servers

```bash
# Start both API (port 3000) and MCP (port 3001)
bunx ont-run start

# Custom ports
bunx ont-run start --port 8000 --mcp-port 8001

# MCP only
bunx ont-run start --mcp-only --mcp-port 3001

# API only
bunx ont-run start --api-only --port 3000
```

### MCP Server Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /sse` | SSE connection for MCP protocol |
| `POST /message` | Client-to-server messages |
| `GET /health` | Health check |

### Connecting MCP Clients

The MCP server URL is: `http://localhost:3001/sse`

For MCP clients that support remote servers, configure the SSE endpoint URL.

### Access Control in MCP

The `--mcp-access` flag determines which tools are available:

```bash
# Only public tools
bunx ont-run start --mcp-access public

# Support-level tools
bunx ont-run start --mcp-access support,public

# All tools (default)
bunx ont-run start --mcp-access admin,support,public
```

## API Reference

### REST Endpoints

All functions are exposed as POST endpoints under `/api/`:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check (no auth) |
| `GET /api` | List accessible functions |
| `POST /api/{functionName}` | Call a function |

### Request Format

```bash
curl -X POST http://localhost:3000/api/createUser \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe"
  }'
```

### Response Format

**Success:**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-01-13T10:00:00Z"
}
```

**Validation Error:**
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "code": "invalid_type",
      "path": ["email"],
      "message": "Expected string, received undefined"
    }
  ]
}
```

**Access Denied:**
```json
{
  "error": "Access denied",
  "message": "This function requires one of: admin, support",
  "yourGroups": ["public"]
}
```

## Environment Variables

Ontology doesn't require any environment variables, but your resolvers can access them normally:

```typescript
// resolvers/connectDB.ts
export default async function(ctx, args) {
  const dbUrl = process.env.DATABASE_URL;
  // ...
}
```

Use different values per environment in your deployment configuration.

## Best Practices

### 1. Minimal Access Groups

Start with the minimum access needed:

```typescript
// Good: Specific access
access: ['admin'],

// Avoid: Overly permissive
access: ['public', 'user', 'admin'],
```

### 2. Descriptive Function Names

Use clear, action-oriented names:

```typescript
// Good
'createUser', 'deleteOrder', 'sendNotification'

// Avoid
'user', 'order', 'notify'
```

### 3. Validate Thoroughly

Use Zod's full validation capabilities:

```typescript
inputs: z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  role: z.enum(['user', 'admin']),
})
```

### 4. Keep Resolvers Focused

Each resolver should do one thing:

```typescript
// Good: Single responsibility
export default async function getUser(ctx, args) {
  return await db.users.findById(args.userId);
}

// Avoid: Multiple responsibilities
export default async function getUser(ctx, args) {
  const user = await db.users.findById(args.userId);
  await analytics.track('user_viewed', user.id);
  await cache.set(`user:${user.id}`, user);
  return user;
}
```

## Troubleshooting

### "Could not find ontology.config.ts"

Make sure you're in the correct directory or run `ont-run init` first.

### "No ont.lock file found"

Run `bunx ont-run review` to create the initial lockfile.

### "Topology has changed since last review"

Your config has changed. Run `bunx ont-run review` to review and approve the changes.

### "Unknown environment"

Make sure the environment you're using is defined in `environments`:

```typescript
environments: {
  dev: { debug: true },
  prod: { debug: false },
},
```

Then use: `bunx ont-run start --env dev`

## License

MIT
