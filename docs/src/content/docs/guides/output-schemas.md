---
title: Output Schemas
description: Define and document what your functions return
---

Output schemas let you define and document the return type of your functions using Zod schemas.

## Basic usage

Add an `outputs` field to your function definition:

```typescript
functions: {
  getUser: {
    description: 'Get user by ID',
    access: ['admin'],
    entities: ['User'],
    inputs: z.object({
      userId: z.string().uuid(),
    }),
    outputs: z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
      createdAt: z.string().datetime(),
    }),
    resolver: './resolvers/getUser.ts',
  },
}
```

## Why use output schemas?

### 1. Documentation

Output schemas are converted to JSON Schema and included in MCP tool definitions:

```json
{
  "name": "getUser",
  "inputSchema": { ... },
  "outputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "format": "uuid" },
      "name": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "createdAt": { "type": "string", "format": "date-time" }
    },
    "required": ["id", "name", "email", "createdAt"]
  }
}
```

AI agents can use this to understand what data they'll receive.

### 2. Type inference

Your resolver can use the output type for better type safety:

```typescript
import { z } from 'zod';

const outputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

type GetUserOutput = z.infer<typeof outputSchema>;

export default function getUser(ctx, args): GetUserOutput {
  // TypeScript knows the return type
  return {
    id: args.userId,
    name: 'Example',
    email: 'user@example.com',
  };
}
```

### 3. Security

Output schemas are part of the ontology hash. Changes trigger review:

```
Ontology changes detected:

Function changes:
  ~ getUser
    Outputs: schema changed
```

## Complex output types

### Arrays

```typescript
outputs: z.array(z.object({
  id: z.string(),
  name: z.string(),
}))
```

### Nested objects

```typescript
outputs: z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
  }),
  organization: z.object({
    id: z.string(),
    name: z.string(),
  }),
})
```

### Unions

```typescript
outputs: z.union([
  z.object({ success: z.literal(true), data: z.string() }),
  z.object({ success: z.literal(false), error: z.string() }),
])
```

### Optional fields

```typescript
outputs: z.object({
  id: z.string(),
  name: z.string(),
  bio: z.string().optional(),
  avatarUrl: z.string().url().nullable(),
})
```

## Field options pattern

For functions that provide options for `fieldFrom()`, use this pattern:

```typescript
outputs: z.array(z.object({
  value: z.string(),
  label: z.string(),
}))
```

This matches the `FieldOption` type that `fieldFrom()` consumers expect.

## Optional but recommended

The `outputs` field is optional — you can omit it if you don't want to document the return type:

```typescript
functions: {
  doSomething: {
    description: 'Do something',
    access: ['admin'],
    entities: [],
    inputs: z.object({ ... }),
    // No outputs defined
    resolver: './resolvers/doSomething.ts',
  },
}
```

However, defining outputs is recommended for:
- Public-facing APIs
- Functions AI agents will call
- Functions with complex return types
