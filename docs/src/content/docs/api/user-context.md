---
title: userContext
description: API reference for the userContext helper function
---

`userContext` marks a field in your function inputs as injected from the auth result's user identity. These fields are hidden from API callers but available in resolvers.

## Signature

```typescript
function userContext<T extends z.ZodType>(schema: T): T
```

## Parameters

### `schema`

**Type:** `z.ZodType`
**Required:** Yes

A Zod schema defining the shape of the user context data.

## Usage

### 1. Return user from auth

Your auth function must return user identity:

```typescript
defineOntology({
  auth: async (req) => {
    const user = await validateToken(req);
    return {
      groups: ['user'],
      user: { id: user.id, email: user.email, name: user.name },
    };
  },
  // ...
});
```

### 2. Declare userContext in inputs

Mark fields that should be injected:

```typescript
import { userContext, z } from 'ont-run';

functions: {
  editProfile: {
    description: 'Edit user profile',
    access: ['user'],
    entities: ['User'],
    inputs: z.object({
      name: z.string(),
      bio: z.string().optional(),
      // This field is injected, not provided by caller
      currentUser: userContext(z.object({
        id: z.string(),
        email: z.string(),
      })),
    }),
    resolver: './resolvers/editProfile.ts',
  },
}
```

### 3. Use in resolver

The resolver receives the typed user data:

```typescript
// resolvers/editProfile.ts
export default async function editProfile(
  ctx: ResolverContext,
  args: {
    name: string;
    bio?: string;
    currentUser: { id: string; email: string };
  }
) {
  // args.currentUser is automatically populated
  return db.users.update(args.currentUser.id, {
    name: args.name,
    bio: args.bio,
  });
}
```

## Behavior

### Hidden from callers

Fields marked with `userContext()` are stripped from:
- REST API schemas
- MCP tool definitions
- OpenAPI documentation

Callers never see or provide these fields.

### Injected at runtime

Before validation, the framework merges `auth().user` into the request args:

```typescript
// Caller sends:
{ "name": "Alice", "bio": "Hello" }

// Framework injects user:
{ "name": "Alice", "bio": "Hello", "currentUser": { "id": "123", "email": "alice@example.com" } }

// Resolver receives the merged object
```

### Startup validation

At server startup, ont-run validates that functions using `userContext()` will receive user data. If your auth function doesn't return a `user` field, you'll get an error:

```
Error: The following functions use userContext() but auth() does not return a user object:
  editProfile, deleteAccount

To fix this, update your auth function to return an AuthResult:
  auth: async (req) => {
    return {
      groups: ['user'],
      user: { id: '...', email: '...' }  // Add user data here
    };
  }
```

### Review UI

The review UI shows a "User Context" badge on functions that use `userContext()`, making it visible during security review.

## Example: Row-level access

A common pattern is combining group access with row-level ownership:

```typescript
functions: {
  deletePost: {
    description: 'Delete a post',
    access: ['user', 'admin'],  // Who can call
    entities: ['Post'],
    inputs: z.object({
      postId: z.string(),
      currentUser: userContext(z.object({ id: z.string() })),
    }),
    resolver: './resolvers/deletePost.ts',
  },
}
```

```typescript
// resolvers/deletePost.ts
export default async function deletePost(
  ctx: ResolverContext,
  args: { postId: string; currentUser: { id: string } }
) {
  const post = await db.posts.findById(args.postId);

  // Admins can delete any post, users only their own
  const isAdmin = ctx.accessGroups.includes('admin');
  const isOwner = args.currentUser.id === post.authorId;

  if (!isAdmin && !isOwner) {
    throw new Error('Not authorized to delete this post');
  }

  return db.posts.delete(args.postId);
}
```

## Multiple userContext fields

You can have multiple `userContext()` fields, but they all receive the same `auth().user` object:

```typescript
inputs: z.object({
  userId: userContext(z.object({ id: z.string() })),
  userEmail: userContext(z.object({ email: z.string() })),
})
// Both receive the full auth().user object
```

Usually, a single field with the full user shape is cleaner.
