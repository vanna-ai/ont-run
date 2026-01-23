---
title: Entities
description: Organize functions by the domain objects they operate on
---

Entities let you categorize functions by the domain objects they relate to. This helps with organization, documentation, and can be used by AI agents to understand your API structure.

## Defining entities

Define entities at the top level of your ontology config:

```typescript
defineOntology({
  entities: {
    User: { description: 'A user account in the system' },
    Organization: { description: 'An organization or team' },
    Project: { description: 'A project within an organization' },
  },
  // ...
});
```

Each entity has:
- **Key**: The entity name (e.g., `User`)
- **description**: A human-readable description

## Associating functions with entities

Every function **must** specify which entities it relates to via the `entities` array:

```typescript
functions: {
  getUser: {
    description: 'Get user by ID',
    access: ['admin'],
    entities: ['User'],  // Required!
    inputs: z.object({ id: z.string() }),
    resolver: './resolvers/getUser.ts',
  },

  addUserToOrganization: {
    description: 'Add a user to an organization',
    access: ['admin'],
    entities: ['User', 'Organization'],  // Multiple entities
    inputs: z.object({
      userId: z.string(),
      orgId: z.string(),
    }),
    resolver: './resolvers/addUserToOrg.ts',
  },

  healthCheck: {
    description: 'Check API health',
    access: ['public'],
    entities: [],  // Explicitly no entities
    inputs: z.object({}),
    resolver: './resolvers/healthCheck.ts',
  },
}
```

## Why entities are required

The `entities` field is required (not optional) because:

1. **Explicitness**: Forces you to think about what domain objects each function touches
2. **Documentation**: AI agents and developers can understand the API at a glance
3. **Organization**: Group related functions together
4. **Security**: Ontology changes to entity associations require human review

Use an empty array `[]` for utility functions that don't relate to any specific entity.

## Validation

ont-run validates that all entity references point to defined entities:

```typescript
// This will throw an error!
defineOntology({
  entities: {
    User: { description: 'A user' },
  },
  functions: {
    getProject: {
      entities: ['Project'],  // Error: Project not defined!
      // ...
    },
  },
});
```

Error message:
```
Function "getProject" references unknown entity "Project".
Valid entities: User
```

## Entities in the ontology

Entity associations are part of the security-critical ontology. When you change which entities a function relates to, it triggers a review:

```
Ontology changes detected:

Function changes:
  ~ getUser
    Entities: [User] -> [User, AuditLog]
```

This ensures humans are aware when functions start touching new domain areas.
