# ont-run

**Vibe code with confidence.**

A web framework designed for the era of coding agents. You define the ontology—what operations exist and who can perform them. AI writes the implementation.

```typescript
// ontology.config.ts
import { defineOntology, z } from 'ont-run';

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
      resolver: './resolvers/getTicket.ts',
    },
    assignTicket: {
      description: 'Assign ticket to an agent',
      access: ['admin'],  // If AI tries to add 'public' here, review is triggered
      entities: ['Ticket'],
      inputs: z.object({ ticketId: z.string().uuid(), assignee: z.string() }),
      resolver: './resolvers/assignTicket.ts',
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

WARN  Run `npx ont-run review` to approve these changes.
```

**Why not just prompts?** The ontology is the source of truth. The framework won't run if it changes without human review.

## Installation

```bash
npm install ont-run
# or
bun add ont-run
```

Works with both Node.js and Bun.

## Quick Start

### 1. Initialize

```bash
npx ont-run init my-api
cd my-api
```

### 2. Review the initial ontology

```bash
npx ont-run review
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

export default defineOntology({
  name: 'my-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  auth: async (req: Request) => {
    const token = req.headers.get('Authorization');
    if (!token) return ['public'];
    if (token === 'admin-secret') return ['admin', 'user', 'public'];
    return ['user', 'public'];
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
      resolver: './resolvers/getUser.ts',
    },
  },
});
```

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
npx ont-run init [dir]     # Initialize a new project
npx ont-run review         # Review and approve ontology changes
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
