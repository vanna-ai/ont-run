# ont-run

**Vibe code with confidence.**

A web framework designed for the era of coding agents. You define the ontology—what operations exist and who can perform them. AI writes the implementation.

Supports both **TypeScript** and **Go** backends.



https://github.com/user-attachments/assets/93fbf862-aca3-422d-8f0c-1fc1e4510d88



<details>
<summary><b>TypeScript Example</b></summary>

```typescript
// ontology.config.ts
import { defineOntology, z } from 'ont-run';
import getTicket from './resolvers/getTicket.js';
import assignTicket from './resolvers/assignTicket.js';

export default defineOntology({
  name: 'support-desk',

  accessGroups: {
    public: { description: 'Unauthenticated users' },
    support: { description: 'Support agents' },
    admin: { description: 'Administrators' },
  },

  functions: {
    getTicket: {
      description: 'Get ticket details',
      access: ['support', 'admin'],
      entities: ['Ticket'],
      inputs: z.object({ ticketId: z.string().uuid() }),
      resolver: getTicket,
    },
    assignTicket: {
      description: 'Assign ticket to an agent',
      access: ['admin'],  // If AI tries to add 'public' here, review is triggered
      entities: ['Ticket'],
      inputs: z.object({ ticketId: z.string().uuid(), assignee: z.string() }),
      resolver: assignTicket,
    },
  },
});
```

</details>

<details open>
<summary><b>Go Example</b></summary>

```go
// ontology.config.go
package main

import (
    ont "github.com/vanna-ai/ont-run/pkg/ontology"
    "myapp/resolvers"
)

func DefineOntology() *ont.Config {
    return &ont.Config{
        Name: "support-desk",

        AccessGroups: map[string]ont.AccessGroup{
            "public":  {Description: "Unauthenticated users"},
            "support": {Description: "Support agents"},
            "admin":   {Description: "Administrators"},
        },

        Functions: map[string]ont.Function{
            "getTicket": {
                Description: "Get ticket details",
                Access:      []string{"support", "admin"},
                Entities:    []string{"Ticket"},
                Inputs:      ont.Object(map[string]ont.Schema{
                    "ticketId": ont.String().UUID(),
                }),
                Resolver: resolvers.GetTicket,
            },
            "assignTicket": {
                Description: "Assign ticket to an agent",
                Access:      []string{"admin"}, // If AI tries to add "public", review is triggered
                Entities:    []string{"Ticket"},
                Inputs:      ont.Object(map[string]ont.Schema{
                    "ticketId": ont.String().UUID(),
                    "assignee": ont.String(),
                }),
                Resolver: resolvers.AssignTicket,
            },
        },
    }
}
```

</details>

## How It Works

Coding agents (Claude Code, Cursor, etc.) can edit resolver implementations freely. But changes to the ontology—functions, access groups, inputs—trigger a review that agents can't bypass. It's built into the framework.

| Layer | Contains | Who modifies |
|-------|----------|--------------|
| **Ontology** | Functions, access groups, inputs, entities | Humans only (via `ont-run review`) |
| **Implementation** | Resolver code | AI agents freely |

Your job shifts: instead of writing every line, you encode what the system can do and who can do it. You review a visual map of capabilities—not 7,000 lines of code.

## The Enforcement

If Claude tries to let `public` call `assignTicket` (currently `admin`-only):

1. The ontology config changes
2. `ont.lock` detects the mismatch
3. Server refuses to start
4. You review the visual diff and approve or reject

```
WARN  Ontology has changed:
      ~ assignTicket
        Access: [admin] -> [admin, public]

WARN  Run `npx ont-run review` to approve these changes.
```

**Why not just prompts?** The ontology is the source of truth. The framework won't run if it changes without human review.

## Installation

```bash
# TypeScript backend (default)
npx ont-run init my-api

# Go backend
npx ont-run init --go my-api
```

This creates a new project with the ont-run framework configured.

## Quick Start

### TypeScript Backend

```bash
npx ont-run init my-api
cd my-api
npm run review     # Approve initial ontology
npm run dev        # Start dev server at http://localhost:3000
```

### Go Backend

```bash
npx ont-run init --go my-api
cd my-api/backend
go run .           # Starts server, generates ont.lock and TypeScript SDK
```

The Go server automatically:
- Generates `ont.lock` on startup (dev mode)
- Generates TypeScript SDK to `frontend/src/sdk/`
- Verifies `ont.lock` in production (`NODE_ENV=production`)

## Writing Resolvers

Resolvers are where AI writes the implementation:

<details>
<summary><b>TypeScript Resolver</b></summary>

```typescript
// resolvers/assignTicket.ts
import type { ResolverContext } from 'ont-run';

export default async function assignTicket(
  ctx: ResolverContext,
  args: { ticketId: string; assignee: string }
) {
  // AI can modify this freely—no review required
  const ticket = await db.tickets.update({
    where: { id: args.ticketId },
    data: { assigneeId: args.assignee },
  });

  return { id: ticket.id, assignedTo: args.assignee };
}
```

</details>

<details open>
<summary><b>Go Resolver</b></summary>

```go
// resolvers/assign_ticket.go
package resolvers

import (
    ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

func AssignTicket(ctx ont.Context, input any) (any, error) {
    args := input.(map[string]any)
    ticketID := args["ticketId"].(string)
    assignee := args["assignee"].(string)

    // AI can modify this freely—no review required
    ticket, err := db.Tickets.Update(ticketID, map[string]any{
        "assigneeId": assignee,
    })
    if err != nil {
        return nil, err
    }

    return map[string]any{
        "id":         ticket.ID,
        "assignedTo": assignee,
    }, nil
}
```

</details>

The resolver context provides:
- `ctx.Request()` — HTTP request
- `ctx.Logger()` — Logger instance
- `ctx.AccessGroups()` — Access groups for the request
- `ctx.UserContext()` — User-specific context data

## TypeScript SDK Generation

ont-run automatically generates type-safe TypeScript SDKs from your ontology, ensuring your frontend and backend stay perfectly in sync.

```bash
npm run generate-sdk
```

This creates `src/generated/api.ts` with:
- **Type-safe interfaces** for all function inputs and outputs
- **API client** with methods for each function
- **React Query hooks** for easy React integration

### Usage Example

```typescript
import { api, apiHooks } from './generated/api';

// Vanilla TypeScript - fully typed!
const user = await api.getUser({ userId: '123' });
console.log(user.name); // TypeScript knows this exists

// React component with hooks
function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading } = apiHooks.useGetUser({ userId });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
      <Badge>{data.role}</Badge> {/* TypeScript validates this! */}
    </div>
  );
}
```

**What This Enables:**
- ✅ Single source of truth - Your ontology defines the API contract
- ✅ Type safety - Changes to backend schemas are caught at compile time
- ✅ No manual sync - Regenerate SDK when schemas change
- ✅ IntelliSense - Full autocomplete in your IDE

When you add a field to your ontology's output schema, TypeScript immediately knows about it in your frontend code. No more runtime mismatches or hunting through code to find what broke.

## Configuration Reference

```typescript
import { defineOntology, z } from 'ont-run';
import getUser from './resolvers/getUser.js';

export default defineOntology({
  name: 'my-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  // Auth returns access groups (and optional user identity)
  auth: async (req: Request) => {
    const token = req.headers.get('Authorization');
    if (!token) return { groups: ['public'] };

    const user = await verifyToken(token);
    return {
      groups: user.isAdmin ? ['admin', 'user', 'public'] : ['user', 'public'],
      user: { id: user.id, email: user.email },  // Optional: for row-level access
    };
  },

  accessGroups: {
    public: { description: 'Unauthenticated users' },
    user: { description: 'Authenticated users' },
    admin: { description: 'Administrators' },
  },

  entities: {
    User: { description: 'A user account' },
    Ticket: { description: 'A support ticket' },
  },

  functions: {
    getUser: {
      description: 'Get user by ID',
      access: ['user', 'admin'],
      entities: ['User'],
      inputs: z.object({ userId: z.string().uuid() }),
      resolver: getUser,
    },
  },
});
```

## Row-Level Access Control

The framework handles **group-based access** (user → group → function) out of the box. For **row-level ownership** (e.g., "users can only edit their own posts"), use `userContext()`:

```typescript
import { defineOntology, userContext, z } from 'ont-run';
import editPost from './resolvers/editPost.js';

export default defineOntology({
  // Auth must return user identity for userContext to work
  auth: async (req) => {
    const user = await verifyToken(req);
    return {
      groups: ['user'],
      user: { id: user.id, email: user.email },
    };
  },

  functions: {
    editPost: {
      description: 'Edit a post',
      access: ['user', 'admin'],
      entities: ['Post'],
      inputs: z.object({
        postId: z.string(),
        title: z.string(),
        // currentUser is injected at runtime, hidden from API callers
        currentUser: userContext(z.object({
          id: z.string(),
          email: z.string(),
        })),
      }),
      resolver: editPost,
    },
  },
});
```

In the resolver, you receive the typed user object:

```typescript
// resolvers/editPost.ts
export default async function editPost(
  ctx: ResolverContext,
  args: { postId: string; title: string; currentUser: { id: string; email: string } }
) {
  const post = await db.posts.findById(args.postId);

  // Row-level check: only author or admin can edit
  if (args.currentUser.id !== post.authorId && !ctx.accessGroups.includes('admin')) {
    throw new Error('Not authorized to edit this post');
  }

  return db.posts.update(args.postId, { title: args.title });
}
```

**Key points:**
- `userContext()` fields are **injected** from `auth()` result's `user` field
- They're **hidden** from public API/MCP schemas (callers don't see or provide them)
- They're **type-safe** in resolvers
- The review UI shows a badge for functions using user context

## The Lockfile

`ont.lock` is the enforcement mechanism. It contains a hash of your ontology:

**What gets hashed (requires review):**
- Function names and descriptions
- Access group assignments
- Input schemas

**What doesn't get hashed (AI can change freely):**
- Resolver implementations
- Environment configurations
- Auth function implementation

## CLI Commands

```bash
npx ont-run init [dir]       # Initialize TypeScript project
npx ont-run init --go [dir]  # Initialize Go project
npx ont-run review           # Review and approve ontology changes (TypeScript only)
```

## Go Schema API

The Go library provides a Zod-like schema API:

```go
import ont "github.com/vanna-ai/ont-run/pkg/ontology"

// Primitives
ont.String()                    // string
ont.String().UUID()             // string with UUID format
ont.String().Email()            // string with email format
ont.String().DateTime()         // string with date-time format
ont.Integer()                   // integer
ont.Integer().Min(1).Max(100)   // integer with range
ont.Number()                    // float64
ont.Boolean()                   // boolean

// Complex types
ont.Array(ont.String())         // []string
ont.Object(map[string]ont.Schema{
    "name": ont.String(),
    "age":  ont.Integer(),
})
ont.Nullable(ont.String())      // string | null
```

## API Endpoints

All functions are exposed as POST endpoints:

```bash
# Call a function
curl -X POST http://localhost:3000/api/getUser \
  -H "Authorization: your-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "123e4567-e89b-12d3-a456-426614174000"}'

# List available functions
curl http://localhost:3000/api

# Health check
curl http://localhost:3000/health
```

## The Bigger Picture

As the cost of software production trends toward the cost of compute, every business will encode itself as a software system—through autonomous agents and process orchestration.

ont-run is the enforcement layer that keeps AI agents aligned with your business rules as they automate your operations.

## License

MIT
