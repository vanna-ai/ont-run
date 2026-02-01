---
title: SDK Generation
description: Automatically generate type-safe TypeScript SDKs from your Ontology
---

# SDK Generation

ont-run can automatically generate type-safe TypeScript SDKs from your Ontology configuration, ensuring your frontend and backend stay perfectly in sync.

## Overview

The generated SDK includes:

- **Type exports** - TypeScript interfaces for each function's input and output
- **API client class** - Type-safe fetch wrapper for all your functions
- **React Query hooks** - Optional hooks for easy React integration

## The Core Value

**Your Ontology is your single source of truth** → Types flow automatically to frontend → Change a schema, TypeScript catches every affected component.

## Quick Start

When you initialize a new project with `npx ont-run init`, it includes everything you need:

```bash
npm run generate-sdk
```

This creates `src/generated/api.ts` with your complete SDK.

## Manual Setup

If you're adding SDK generation to an existing project:

### 1. Create the generation script

Create `scripts/generate-sdk.ts`:

```typescript
import { generateSdk } from 'ont-run';
import config from '../ontology.config.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const sdkCode = generateSdk({
  config,
  includeReactHooks: true,
  baseUrl: '/api',
  includeMiddleware: true,
});

const outputPath = './src/generated/api.ts';
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sdkCode, 'utf-8');

console.log('✓ SDK generated at', outputPath);
```

### 2. Add npm script

In `package.json`:

```json
{
  "scripts": {
    "generate-sdk": "tsx scripts/generate-sdk.ts"
  }
}
```

### 3. Generate the SDK

```bash
npm run generate-sdk
```

## Usage

### Vanilla TypeScript/JavaScript

```typescript
import { api } from './generated/api';

// Call your functions with full type safety
const user = await api.getUser({ userId: '123' });

// TypeScript knows the exact shape of the response
console.log(user.id);    // ✅ Works
console.log(user.name);  // ✅ Works
console.log(user.xyz);   // ❌ Type error - property doesn't exist!
```

### React Components

```typescript
import { apiHooks } from './generated/api';

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = apiHooks.useGetUser({ userId });
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
      {/* TypeScript provides full autocomplete here! */}
      <Badge>{data.role}</Badge>
    </div>
  );
}
```

### Mutations

For non-readonly functions (mutations), the SDK generates `useMutation` hooks:

```typescript
function DeleteUserButton({ userId }: { userId: string }) {
  const deleteUser = apiHooks.useDeleteUser();
  
  return (
    <button
      onClick={() => deleteUser.mutate({ 
        userId, 
        reason: 'User requested deletion' 
      })}
      disabled={deleteUser.isPending}
    >
      {deleteUser.isPending ? 'Deleting...' : 'Delete User'}
    </button>
  );
}
```

## Real-World Example

Here's what happens when you update your backend schema:

### 1. Add a field to your Ontology

```typescript
// ontology.config.ts
getUser: {
  description: 'Get user by ID',
  inputs: z.object({ userId: z.string() }),
  outputs: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(), // ← ADD THIS
  }),
  // ...
}
```

### 2. Regenerate the SDK

```bash
npm run generate-sdk
```

### 3. TypeScript catches all usage sites

```typescript
function UserCard({ userId }: Props) {
  const { data } = apiHooks.useGetUser({ userId });
  
  return (
    <div>
      <h2>{data.name}</h2>
      <p>{data.email}</p>
      {/* TypeScript now knows about role - full autocomplete! */}
      <Badge>{data.role}</Badge>
    </div>
  );
}
```

**No more:**
- ❌ Manual type duplication
- ❌ Runtime mismatches between frontend expectations and backend reality
- ❌ Hunting through code to find what broke when a schema changes

## Configuration Options

The `generateSdk` function accepts these options:

```typescript
generateSdk({
  config: OntologyConfig,     // Your ontology configuration
  includeReactHooks: boolean, // Generate React Query hooks (default: false)
  baseUrl: string,            // Base URL for API calls (default: '/api')
  includeMiddleware: boolean, // Include interceptor support (default: true)
})
```

### includeReactHooks

When `true`, generates React Query hooks using `@tanstack/react-query`:

```bash
npm install @tanstack/react-query
```

```typescript
import { apiHooks } from './generated/api';

const { data } = apiHooks.useGetUser({ userId: '123' });
```

### baseUrl

Customize where the API client sends requests:

```typescript
generateSdk({
  config,
  baseUrl: 'https://api.example.com',
});

// Or configure per-instance:
import { ApiClient } from './generated/api';
const api = new ApiClient({ baseUrl: 'https://api.example.com' });
```

### includeMiddleware

When `true`, the API client includes request/response interceptors:

```typescript
import { ApiClient } from './generated/api';

const api = new ApiClient({
  beforeRequest: async (url, options) => {
    // Add auth token
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
    return options;
  },
  afterResponse: async (response) => {
    // Log all responses
    console.log('Response:', response.status);
    return response;
  },
});
```

## Advanced Patterns

### Custom API Instance

Create a configured instance for your app:

```typescript
// lib/api.ts
import { ApiClient } from './generated/api';

export const api = new ApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  headers: {
    'X-App-Version': '1.0.0',
  },
  beforeRequest: async (url, options) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      };
    }
    return options;
  },
});
```

### Server-Side Rendering

The SDK works in Node.js with a custom fetch implementation:

```typescript
import { ApiClient } from './generated/api';
import fetch from 'node-fetch';

const api = new ApiClient({
  baseUrl: 'http://localhost:3000/api',
  fetch: fetch as any,
});
```

### Type-Only Imports

If you just need the types without the client:

```typescript
import type { GetUserInput, GetUserOutput } from './generated/api';

function processUser(input: GetUserInput): GetUserOutput {
  // Your custom logic
}
```

## Best Practices

### 1. Regenerate on Schema Changes

Add to your workflow:

```json
{
  "scripts": {
    "dev": "npm run generate-sdk && concurrently ...",
    "build": "npm run generate-sdk && vite build"
  }
}
```

### 2. Commit Generated Files

Commit `src/generated/api.ts` to git so:
- Team members have types immediately
- CI/CD builds work without regeneration
- Diffs show exactly what changed

### 3. Use with React Query

Wrap your app with QueryClientProvider:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

## Troubleshooting

### "Module not found: ont-run"

Make sure ont-run is installed:

```bash
npm install ont-run
```

### "Cannot find module './generated/api'"

Run the generator first:

```bash
npm run generate-sdk
```

### Types Don't Match Backend

Regenerate the SDK after schema changes:

```bash
npm run generate-sdk
```

### React Query Types Issues

Install the correct version:

```bash
npm install @tanstack/react-query@latest
```

## What Gets Generated

For each function in your ontology, the SDK generates:

1. **Input Type** - `FunctionNameInput`
2. **Output Type** - `FunctionNameOutput`
3. **API Method** - `api.functionName(input)`
4. **React Hook** - `apiHooks.useFunctionName(input)` or `apiHooks.useFunctionName()` for mutations

Context fields (from `userContext()` and `organizationContext()`) are automatically excluded from input types since they're injected server-side.

## Example: Full Flow

```typescript
// 1. Define in ontology.config.ts
{
  functions: {
    createPost: {
      description: 'Create a new blog post',
      inputs: z.object({
        title: z.string(),
        content: z.string(),
        tags: z.array(z.string()),
      }),
      outputs: z.object({
        id: z.string(),
        title: z.string(),
        slug: z.string(),
        createdAt: z.string(),
      }),
      isReadOnly: false,
      // ...
    }
  }
}

// 2. Generate SDK
// $ npm run generate-sdk

// 3. Use in React component
import { apiHooks } from './generated/api';

function CreatePostForm() {
  const createPost = apiHooks.useCreatePost();
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    createPost.mutate({
      title: formData.get('title'),
      content: formData.get('content'),
      tags: ['announcement'], // ✅ TypeScript validates this!
    }, {
      onSuccess: (data) => {
        console.log('Created:', data.slug);
        navigate(`/posts/${data.id}`);
      }
    });
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

The ontology becomes your **API contract**, enforced at compile time. This is the right level of magic for the framework - enough to save real pain, not so much that it's complicated.
