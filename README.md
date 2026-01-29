# ont-run

**Vibe code with confidence.**

A web framework designed for the era of coding agents. You define the ontology—what operations exist and who can perform them. AI writes the implementation.



https://github.com/user-attachments/assets/93fbf862-aca3-422d-8f0c-1fc1e4510d88



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
  // ...
});
```

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

WARN  Run `bunx ont-run review` to approve these changes.
```

**Why not just prompts?** The ontology is the source of truth. The framework won't run if it changes without human review.

## Architecture

ont-run uses a **Go backend** for HTTP server operations, combined with **TypeScript** for configuration and resolver logic. This hybrid approach provides:

- **Efficient API server**: Go handles all HTTP routing, middleware, and request processing
- **Flexible resolvers**: Keep your business logic in TypeScript/JavaScript
- **Type safety**: Zod schemas ensure type-safe APIs
- **Cross-runtime support**: Works with Bun, Node.js, and standalone Go deployments

The Go server communicates with TypeScript resolvers through a bridge mechanism, executing your resolver functions.

## Installation

```bash
# Using bun (recommended)
bunx ont-run init my-api

# Using npm
npx ont-run init my-api
```

This creates a new project with the ont-run framework configured.

**Note:** The Go backend server will be built automatically during installation. If you encounter issues, you can manually build it with:
```bash
cd node_modules/ont-run/server && go build -o ont-server main.go
```

## Quick Start

### 1. Initialize

```bash
bunx ont-run init my-api
# or: npx ont-run init my-api

cd my-api
```

### 2. Review the initial ontology

```bash
bunx ont-run review
# or: npx ont-run review
```

Opens a browser showing all functions and access groups. Click **Approve** to generate `ont.lock`.

### 3. Start the server

```typescript
// index.ts
import { startOnt } from 'ont-run';

await startOnt({ port: 3000 });
```

```bash
bun index.ts
```

Your API is running at `http://localhost:3000`.

## Writing Resolvers

Resolvers are where AI writes the implementation:

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

The resolver context provides:
- `ctx.env` — Current environment name
- `ctx.envConfig` — Environment configuration
- `ctx.logger` — Logger instance
- `ctx.accessGroups` — Access groups for the request

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
bunx ont-run init [dir]    # Initialize a new project (or: npx ont-run init [dir])
bunx ont-run review        # Review and approve ontology changes (or: npx ont-run review)
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
