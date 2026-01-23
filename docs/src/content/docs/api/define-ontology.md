---
title: defineOntology
description: API reference for the defineOntology function
---

`defineOntology` is the main entry point for creating an ont-run configuration.

## Signature

```typescript
function defineOntology<
  TGroups extends string,
  TEntities extends string,
  TFunctions extends Record<string, FunctionDefinition<TGroups, TEntities>>,
>(config: OntologyConfig<TGroups, TEntities, TFunctions>): OntologyConfig
```

## Parameters

### `config`

The ontology configuration object.

#### `name`

**Type:** `string`
**Required:** Yes

The name of your ontology/API.

```typescript
name: 'my-api'
```

#### `environments`

**Type:** `Record<string, EnvironmentConfig>`
**Required:** Yes

Environment configurations (dev, staging, prod, etc.).

```typescript
environments: {
  dev: { debug: true },
  staging: { debug: true },
  prod: { debug: false },
}
```

Each environment can have:
- `debug?: boolean` — Enable debug logging
- Any additional custom properties

#### `auth`

**Type:** `(req: Request) => Promise<AuthResult | string[]> | AuthResult | string[]`
**Required:** Yes

Function that determines which access groups a request belongs to. Can also return user identity for row-level access control.

**Return types:**
- `string[]` — Just access group names (legacy, still supported)
- `AuthResult` — Groups plus optional user identity

```typescript
interface AuthResult {
  groups: string[];
  user?: Record<string, unknown>;  // For row-level access
}
```

**Examples:**

```typescript
// Simple: just groups
auth: async (req) => {
  const token = req.headers.get('Authorization');
  if (!token) return { groups: ['public'] };
  return { groups: ['user', 'admin'] };
}

// With user identity (for userContext)
auth: async (req) => {
  const token = req.headers.get('Authorization');
  if (!token) return { groups: ['public'] };

  const user = await validateToken(token);
  return {
    groups: user.isAdmin ? ['admin', 'user'] : ['user'],
    user: { id: user.id, email: user.email },
  };
}
```

#### `accessGroups`

**Type:** `Record<string, AccessGroupConfig>`
**Required:** Yes

Definitions of access groups.

```typescript
accessGroups: {
  public: { description: 'Unauthenticated users' },
  user: { description: 'Authenticated users' },
  admin: { description: 'Administrators' },
}
```

Each group has:
- `description: string` — Human-readable description

#### `entities`

**Type:** `Record<string, EntityDefinition>`
**Required:** No (but recommended)

Definitions of domain entities.

```typescript
entities: {
  User: { description: 'A user account' },
  Project: { description: 'A project' },
}
```

Each entity has:
- `description: string` — Human-readable description

#### `functions`

**Type:** `Record<string, FunctionDefinition>`
**Required:** Yes

Function definitions. See below for the FunctionDefinition type.

## FunctionDefinition

Each function in the `functions` object has these properties:

### `description`

**Type:** `string`
**Required:** Yes

Human-readable description of what the function does.

### `access`

**Type:** `string[]`
**Required:** Yes

Array of access group names that can call this function.

### `entities`

**Type:** `string[]`
**Required:** Yes

Array of entity names this function relates to. Use `[]` if none.

### `inputs`

**Type:** `z.ZodType`
**Required:** Yes

Zod schema for input validation.

### `outputs`

**Type:** `z.ZodType`
**Required:** No

Zod schema for output documentation.

### `resolver`

**Type:** `string`
**Required:** Yes

Path to the resolver file, relative to the config file.

## Example

```typescript
import { defineOntology, fieldFrom, z } from 'ont-run';

export default defineOntology({
  name: 'my-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  auth: async (req) => {
    const token = req.headers.get('Authorization');
    return token ? ['user', 'admin'] : ['public'];
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
    getUser: {
      description: 'Get user by ID',
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

## Validation

`defineOntology` validates your configuration and throws errors for:

- Missing required fields
- Invalid access group references
- Invalid entity references
- Invalid `fieldFrom()` references
- Non-Zod schemas in `inputs` or `outputs`

## Return value

Returns the validated configuration object, with full TypeScript type inference for your access groups, entities, and functions.
