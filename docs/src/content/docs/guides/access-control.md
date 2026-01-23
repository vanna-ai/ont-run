---
title: Access Control
description: Control who can call which functions
---

ont-run uses a group-based access control system. You define access groups, then specify which groups can call each function.

## Defining access groups

Define access groups at the top level of your ontology:

```typescript
defineOntology({
  accessGroups: {
    public: { description: 'Unauthenticated users' },
    user: { description: 'Authenticated users' },
    support: { description: 'Support agents' },
    admin: { description: 'Administrators' },
  },
  // ...
});
```

## The auth function

The `auth` function determines which groups a request belongs to:

```typescript
defineOntology({
  auth: async (req) => {
    const token = req.headers.get('Authorization');

    // No token = public only
    if (!token) {
      return ['public'];
    }

    // Validate token and get user
    const user = await validateToken(token);
    if (!user) {
      return ['public'];
    }

    // Build group list based on user role
    const groups = ['public', 'user'];

    if (user.role === 'support') {
      groups.push('support');
    }

    if (user.role === 'admin') {
      groups.push('support', 'admin');
    }

    return groups;
  },
  // ...
});
```

Key points:
- Return an **array** of group names
- Users can belong to multiple groups
- The function receives the raw `Request` object

## Assigning access to functions

Each function specifies which groups can call it:

```typescript
functions: {
  // Anyone can call this
  healthCheck: {
    access: ['public', 'user', 'admin'],
    // ...
  },

  // Only authenticated users
  getMyProfile: {
    access: ['user', 'admin'],
    // ...
  },

  // Only support and admin
  lookupUser: {
    access: ['support', 'admin'],
    // ...
  },

  // Only admin
  deleteUser: {
    access: ['admin'],
    // ...
  },
}
```

A user can call a function if they have **any** of the listed groups.

## How access is enforced

Access is checked at two levels:

### 1. MCP tool visibility

When an AI agent connects, it only sees tools it has access to:

```typescript
// User with groups: ['public', 'user']
// Sees: healthCheck, getMyProfile
// Does NOT see: lookupUser, deleteUser
```

### 2. Runtime validation

When a function is called (via API or MCP), access is checked again:

```typescript
// Even if someone tries to call deleteUser directly:
// "Access denied to tool 'deleteUser'. Requires: admin"
```

## Access in resolvers

Resolvers receive the current user's groups via context:

```typescript
export default function getUser(
  ctx: ResolverContext,
  args: { userId: string }
) {
  // Check if user is admin
  if (ctx.accessGroups.includes('admin')) {
    // Return full user data
    return getFullUserData(args.userId);
  }

  // Regular users get limited data
  return getLimitedUserData(args.userId);
}
```

## Validation

ont-run validates that all access group references exist:

```typescript
functions: {
  getUser: {
    access: ['superadmin'],  // Error: group not defined!
    // ...
  },
}
```

Error message:
```
Function "getUser" references unknown access group "superadmin".
Valid groups: public, user, support, admin
```

## Security

Access lists are part of the security-critical ontology. Changes require human review:

```
Ontology changes detected:

Function changes:
  ~ deleteUser
    Access: [admin] -> [support, admin]
```

This prevents AI agents from escalating privileges by modifying access lists.

## Best practices

1. **Principle of least privilege**: Start with minimal access, add as needed
2. **Hierarchical groups**: Admins should include all lower groups
3. **Explicit public**: If something should be public, list `public` explicitly
4. **Separate concerns**: Use different groups for different capabilities (view vs edit)
