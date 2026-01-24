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

The `auth` function determines which groups a request belongs to. It can also return user identity for row-level access control.

```typescript
defineOntology({
  auth: async (req) => {
    const token = req.headers.get('Authorization');

    // No token = public only
    if (!token) {
      return { groups: ['public'] };
    }

    // Validate token and get user
    const user = await validateToken(token);
    if (!user) {
      return { groups: ['public'] };
    }

    // Build group list based on user role
    const groups = ['public', 'user'];

    if (user.role === 'support') {
      groups.push('support');
    }

    if (user.role === 'admin') {
      groups.push('support', 'admin');
    }

    // Return groups AND user identity (for row-level access)
    return {
      groups,
      user: { id: user.id, email: user.email },
    };
  },
  // ...
});
```

Key points:
- Return `{ groups: string[], user?: object }` for full functionality
- Legacy `string[]` return is still supported (groups only)
- The `user` field enables row-level access with `userContext()`
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

## Row-level access control

Group-based access controls *which functions* users can call. For *row-level* access (e.g., "users can only edit their own posts"), use `userContext()`:

```typescript
import { defineOntology, userContext, z } from 'ont-run';
import editPost from './resolvers/editPost.js';

defineOntology({
  // Auth must return user identity
  auth: async (req) => {
    const user = await validateToken(req);
    return {
      groups: user ? ['user'] : ['public'],
      user: user ? { id: user.id, email: user.email } : undefined,
    };
  },

  functions: {
    editPost: {
      description: 'Edit a post',
      access: ['user'],
      entities: ['Post'],
      inputs: z.object({
        postId: z.string(),
        title: z.string(),
        // Injected from auth - hidden from callers
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

In the resolver:

```typescript
// resolvers/editPost.ts
export default async function editPost(
  ctx: ResolverContext,
  args: { postId: string; title: string; currentUser: { id: string; email: string } }
) {
  const post = await db.posts.findById(args.postId);

  // Row-level check
  if (args.currentUser.id !== post.authorId) {
    throw new Error('Not authorized to edit this post');
  }

  return db.posts.update(args.postId, { title: args.title });
}
```

Key points about `userContext()`:
- Fields are **injected** from auth's `user` return value
- Fields are **hidden** from public API/MCP schemas
- Fields are **type-safe** in resolvers
- The review UI shows which functions use user context

## OAuth and JWT integration

The `auth` function works seamlessly with OAuth 2.0, JWT, and any authentication provider. Since you have full control over token validation, you can integrate with Auth0, Clerk, Supabase, or any identity provider.

### JWT example

```typescript
import { jwtVerify } from 'jose';

defineOntology({
  auth: async (req) => {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return { groups: ['public'] };
    }

    try {
      // Verify JWT with your public key
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: 'https://auth.example.com',
        audience: 'your-api',
      });

      // Map JWT claims to access groups
      const groups = ['public', 'user'];
      if (payload.role === 'admin') {
        groups.push('admin');
      }

      return {
        groups,
        user: { id: payload.sub, email: payload.email },
      };
    } catch {
      return { groups: ['public'] };
    }
  },
});
```

### Auth0 example

```typescript
import { auth } from 'express-oauth2-jwt-bearer';

defineOntology({
  auth: async (req) => {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return { groups: ['public'] };

    // Verify with Auth0
    const decoded = await verifyAuth0Token(token);

    // Map Auth0 permissions/scopes to groups
    const groups = ['public'];
    if (decoded.permissions?.includes('read:users')) {
      groups.push('user');
    }
    if (decoded.permissions?.includes('admin:all')) {
      groups.push('admin');
    }

    return { groups, user: { id: decoded.sub } };
  },
});
```

### MCP OAuth compatibility

This design is fully compatible with the [MCP OAuth specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization). MCP clients send `Authorization: Bearer <token>` headers, which your auth function validates. No additional configuration is needed.

### Development mode

For local development, you can use simple tokens:

```typescript
auth: async (req) => {
  const token = req.headers.get('Authorization');

  // Simple dev tokens
  if (process.env.NODE_ENV === 'development') {
    if (token === 'dev-admin') return { groups: ['admin', 'user', 'public'] };
    if (token === 'dev-user') return { groups: ['user', 'public'] };
    return { groups: ['public'] };
  }

  // Production: real JWT validation
  return validateProductionToken(req);
},
```

## Best practices

1. **Principle of least privilege**: Start with minimal access, add as needed
2. **Hierarchical groups**: Admins should include all lower groups
3. **Explicit public**: If something should be public, list `public` explicitly
4. **Separate concerns**: Use different groups for different capabilities (view vs edit)
5. **Use userContext for ownership**: Combine groups (who can call) with userContext (who owns the resource)
