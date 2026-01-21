---
title: Field References
description: String fields that get their options from other functions
---

Field references let you create string fields that get their allowed values from another function. This is useful for categorical fields like status, priority, or any field where users should select from a predefined list.

## The concept

Instead of hardcoding options or using a separate "categorical" concept, **options are just functions**. A function that returns `{ value, label }[]` can be referenced by string fields in other functions.

## Basic example

```typescript
import { defineOntology, fieldFrom, z } from 'ont';

export default defineOntology({
  // ...
  functions: {
    // This function provides options
    getUserStatuses: {
      description: 'Get available user statuses',
      access: ['admin'],
      entities: [],
      inputs: z.object({}),  // Empty inputs = fetch all at once
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: './resolvers/options/userStatuses.ts',
    },

    // This function uses those options
    updateUser: {
      description: 'Update a user',
      access: ['admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string(),
        status: fieldFrom('getUserStatuses'),  // References the function
      }),
      resolver: './resolvers/updateUser.ts',
    },
  },
});
```

The resolver for `getUserStatuses`:

```typescript
import type { ResolverContext, FieldOption } from 'ont';

export default function getUserStatuses(
  ctx: ResolverContext
): FieldOption[] {
  return [
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'pending', label: 'Pending Verification' },
  ];
}
```

## Bulk vs Autocomplete

The type of options loading is inferred from the source function's inputs:

### Bulk (empty inputs)

All options are fetched at once. Good for small, static lists.

```typescript
getUserStatuses: {
  inputs: z.object({}),  // Empty = bulk
  // ...
}
```

### Autocomplete (has `query` input)

Options are searched with a query. Good for large or dynamic lists.

```typescript
searchUsers: {
  description: 'Search for users',
  access: ['admin'],
  entities: ['User'],
  inputs: z.object({
    query: z.string(),  // Has query = autocomplete
  }),
  outputs: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })),
  resolver: './resolvers/options/searchUsers.ts',
},

assignTicket: {
  // ...
  inputs: z.object({
    ticketId: z.string(),
    assignee: fieldFrom('searchUsers'),  // Will use autocomplete
  }),
},
```

The autocomplete resolver receives the query:

```typescript
export default async function searchUsers(
  ctx: ResolverContext,
  args: { query: string }
): Promise<FieldOption[]> {
  const users = await db.users.search(args.query, { limit: 10 });
  return users.map(user => ({
    value: user.id,
    label: `${user.name} (${user.email})`,
  }));
}
```

## Benefits of this approach

1. **Unified model**: Options sources are just functions with the same access control
2. **Callable directly**: You can call `getUserStatuses` via the API directly
3. **Discoverable**: AI agents can see which fields have options and where they come from
4. **Type-safe**: The `FieldOption` type ensures consistent return format

## Validation

ont validates that `fieldFrom()` references existing functions:

```typescript
inputs: z.object({
  status: fieldFrom('nonExistent'),  // Error!
})
```

Error message:
```
Function "updateUser" field "status" references unknown function "nonExistent" via fieldFrom().
Valid functions: getUserStatuses, updateUser, ...
```

## In the ontology

Field references are tracked in the ontology and shown in MCP tool metadata:

```json
{
  "name": "updateUser",
  "inputSchema": { ... },
  "fieldReferences": [
    { "path": "status", "functionName": "getUserStatuses" }
  ]
}
```

This lets AI agents know they can fetch options from `getUserStatuses` before calling `updateUser`.
