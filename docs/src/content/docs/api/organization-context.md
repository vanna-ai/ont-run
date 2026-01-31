---
title: organizationContext
description: API reference for the organizationContext helper function
---

`organizationContext` marks a field in your function inputs as injected from the auth result's organization identity. These fields are hidden from API callers but available in resolvers for multi-tenant applications.

## Signature

```typescript
function organizationContext<T extends z.ZodType>(schema: T): T
```

## Parameters

### `schema`

**Type:** `z.ZodType`
**Required:** Yes

A Zod schema defining the shape of the organization context data.

## Usage

### 1. Return organization from auth

Your auth function must return organization identity:

```typescript
defineOntology({
  auth: async (req) => {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('org_id');
    
    if (!orgId) {
      return { groups: ['public'] };
    }
    
    const user = await validateToken(req);
    const org = await db.organizations.findById(orgId);
    
    // Verify user membership in organization
    const isMember = await db.organizationMembers.exists({ 
      userId: user.id, 
      orgId 
    });
    
    if (!isMember) {
      throw new Error('Not a member of this organization');
    }
    
    return {
      groups: ['member'],
      organization: { id: org.id, name: org.name, plan: org.plan },
    };
  },
  // ...
});
```

### 2. Declare organizationContext in inputs

Mark fields that should be injected:

```typescript
import { organizationContext, z } from 'ont-run';
import createProject from './resolvers/createProject.js';

functions: {
  createProject: {
    description: 'Create a project in the organization',
    access: ['member'],
    entities: ['Project'],
    inputs: z.object({
      name: z.string(),
      description: z.string().optional(),
      // This field is injected, not provided by caller
      currentOrg: organizationContext(z.object({
        id: z.string(),
        name: z.string(),
        plan: z.string(),
      })),
    }),
    resolver: createProject,
  },
}
```

### 3. Use in resolver

The resolver receives the typed organization data:

```typescript
// resolvers/createProject.ts
export default async function createProject(
  ctx: ResolverContext,
  args: {
    name: string;
    description?: string;
    currentOrg: { id: string; name: string; plan: string };
  }
) {
  // args.currentOrg is automatically populated
  return db.projects.create({
    name: args.name,
    description: args.description,
    organizationId: args.currentOrg.id,
  });
}
```

## Behavior

### Hidden from callers

Fields marked with `organizationContext()` are stripped from:
- REST API schemas
- MCP tool definitions
- OpenAPI documentation

Callers never see or provide these fields.

### Injected at runtime

Before validation, the framework merges `auth().organization` into the request args:

```typescript
// Caller sends:
{ "name": "My Project", "description": "A new project" }

// Framework injects organization:
{ 
  "name": "My Project", 
  "description": "A new project",
  "currentOrg": { "id": "org_123", "name": "Acme Corp", "plan": "enterprise" } 
}

// Resolver receives the merged object
```

### Startup validation

At server startup, ont-run validates that functions using `organizationContext()` will receive organization data. If your auth function doesn't return an `organization` field, you'll get an error:

```
Error: The following functions use organizationContext() but auth() does not return an organization object:
  createProject, listProjects

To fix this, update your auth function to return an AuthResult:
  auth: async (req) => {
    const orgId = new URL(req.url).searchParams.get('org_id');
    return {
      groups: ['member'],
      organization: { id: orgId, name: '...' }  // Add organization data here
    };
  }
```

### Review UI

The review UI shows an "Org Context" badge on functions that use `organizationContext()`, making it visible during security review.

## Example: Multi-tenant data isolation

A common pattern for multi-tenant applications is using organization context to ensure data isolation:

```typescript
import listProjects from './resolvers/listProjects.js';
import updateProject from './resolvers/updateProject.js';

functions: {
  listProjects: {
    description: 'List projects in the organization',
    access: ['member'],
    entities: ['Project'],
    inputs: z.object({
      currentOrg: organizationContext(z.object({ id: z.string() })),
    }),
    resolver: listProjects,
  },
  
  updateProject: {
    description: 'Update a project',
    access: ['member'],
    entities: ['Project'],
    inputs: z.object({
      projectId: z.string(),
      name: z.string(),
      currentOrg: organizationContext(z.object({ id: z.string() })),
    }),
    resolver: updateProject,
  },
}
```

```typescript
// resolvers/listProjects.ts
export default async function listProjects(
  ctx: ResolverContext,
  args: { currentOrg: { id: string } }
) {
  // Automatically filtered to organization
  return db.projects.findMany({
    where: { organizationId: args.currentOrg.id }
  });
}
```

```typescript
// resolvers/updateProject.ts
export default async function updateProject(
  ctx: ResolverContext,
  args: { projectId: string; name: string; currentOrg: { id: string } }
) {
  const project = await db.projects.findById(args.projectId);
  
  // Ensure project belongs to the organization
  if (project.organizationId !== args.currentOrg.id) {
    throw new Error('Project not found in this organization');
  }
  
  return db.projects.update(args.projectId, { name: args.name });
}
```

## Combining with userContext

For applications that need both user and organization context, you can use both:

```typescript
inputs: z.object({
  projectId: z.string(),
  currentUser: userContext(z.object({ id: z.string() })),
  currentOrg: organizationContext(z.object({ id: z.string() })),
})
```

The resolver will receive both injected contexts:

```typescript
export default async function resolver(
  ctx: ResolverContext,
  args: { 
    projectId: string; 
    currentUser: { id: string };
    currentOrg: { id: string };
  }
) {
  // Both currentUser and currentOrg are available
}
```

## Typical auth patterns

### Query parameter-based

```typescript
auth: async (req) => {
  const url = new URL(req.url);
  const orgId = url.searchParams.get('org_id');
  
  if (!orgId) return { groups: ['public'] };
  
  const user = await verifyToken(req);
  await verifyOrgMembership(user.id, orgId);
  
  const org = await db.organizations.findById(orgId);
  return {
    groups: ['member'],
    organization: { id: org.id, name: org.name },
  };
}
```

### Header-based

```typescript
auth: async (req) => {
  const orgId = req.headers.get('X-Organization-ID');
  
  if (!orgId) return { groups: ['public'] };
  
  const user = await verifyToken(req);
  await verifyOrgMembership(user.id, orgId);
  
  const org = await db.organizations.findById(orgId);
  return {
    groups: ['member'],
    organization: { id: org.id, name: org.name },
  };
}
```

### Subdomain-based

```typescript
auth: async (req) => {
  const url = new URL(req.url);
  const subdomain = url.hostname.split('.')[0];
  
  const org = await db.organizations.findBySubdomain(subdomain);
  if (!org) return { groups: ['public'] };
  
  const user = await verifyToken(req);
  await verifyOrgMembership(user.id, org.id);
  
  return {
    groups: ['member'],
    organization: { id: org.id, name: org.name },
  };
}
```
