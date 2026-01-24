---
title: Quick Start
description: Get up and running with ont-run in 5 minutes
---

## Installation

```bash
# Using bun (recommended)
bun add ont-run

# Using npm
npm install ont-run

# Using pnpm
pnpm add ont-run
```

## Create your ontology

Create an `ontology.config.ts` file in your project root:

```typescript
import { defineOntology, z } from 'ont-run';

export default defineOntology({
  name: 'my-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  auth: async (req) => {
    const token = req.headers.get('Authorization');
    if (!token) return ['public'];
    if (token === 'admin-secret') return ['admin'];
    return ['user'];
  },

  accessGroups: {
    public: { description: 'Unauthenticated users' },
    user: { description: 'Authenticated users' },
    admin: { description: 'Administrators' },
  },

  entities: {
    User: { description: 'A user account' },
  },

  functions: {
    healthCheck: {
      description: 'Check API health status',
      access: ['public', 'user', 'admin'],
      entities: [],
      inputs: z.object({}),
      outputs: z.object({ status: z.string() }),
      resolver: './resolvers/healthCheck.ts',
    },

    getUser: {
      description: 'Get user details by ID',
      access: ['user', 'admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string().uuid(),
      }),
      outputs: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }),
      resolver: './resolvers/getUser.ts',
    },
  },
});
```

## Create a resolver

Create `resolvers/healthCheck.ts`:

```typescript
import type { ResolverContext } from 'ont-run';

export default function healthCheck(ctx: ResolverContext) {
  ctx.logger.info('Health check called');
  return { status: 'ok' };
}
```

Create `resolvers/getUser.ts`:

```typescript
import type { ResolverContext } from 'ont-run';

interface GetUserArgs {
  userId: string;
}

export default async function getUser(
  ctx: ResolverContext,
  args: GetUserArgs
) {
  ctx.logger.info(`Getting user: ${args.userId}`);

  // Your database logic here
  return {
    id: args.userId,
    name: 'Example User',
    email: 'user@example.com',
  };
}
```

## Create server entry point

Create a `server.ts` file:

```typescript
import { startOnt } from 'ont-run';

await startOnt();
```

## Start the server

```bash
bun run server.ts
```

This starts:
- **REST API** at `http://localhost:3000`
- **MCP Server** for AI agent integration

Both servers are built on [Hono](https://hono.dev/), a lightweight web framework that runs on Bun and Node.js.

## Review ontology changes

When you modify your ontology (add functions, change access), you need to approve the changes:

```bash
npx ont-run review
```

This opens an interactive review UI where you can see exactly what changed and approve or reject.

## Next steps

- Learn about [Entities](../guides/entities/) for organizing your functions
- Add [Field References](../guides/field-references/) for categorical fields
- Configure [Access Control](../guides/access-control/) for fine-grained permissions
