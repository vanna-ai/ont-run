---
title: Cloud Integration
description: Connect your ontology to ont-run.com for AI agent access control
---

ont-run can integrate with [ont-run.com](https://ont-run.com) for centralized AI agent access control and ontology management.

## What Gets Sent to ont-run.com

When cloud registration is enabled, the following metadata is sent to ont-run.com:

- **Function names and descriptions** - The names and human-readable descriptions of your API functions
- **Access groups and their descriptions** - Your permission groups (e.g., "admin", "support", "public")
- **Entities and their descriptions** - Domain objects your API operates on (e.g., "User", "Order")
- **Input/output schemas** - JSON Schema representations of your function signatures

This metadata allows ont-run.com to:
- Provide AI agents with accurate information about available tools
- Enforce access control based on user permissions
- Track ontology versions and changes for approval workflows

## What is NOT Sent

The following stays local and is **never** sent to the cloud:

- **Resolver code** - Your business logic implementations
- **Environment variables** - Database URLs, API keys, secrets
- **Auth functions** - Your authentication/authorization implementations
- **Actual data** - No request/response data processed by your API is ever sent

Your sensitive code and data remain entirely on your infrastructure.

## Configuration

### Go Backend

Cloud registration is controlled by two fields in your `ontology.config.go`:

```go
func DefineOntology() *ont.Config {
    return &ont.Config{
        Name:  "my-app",
        UUID:  "your-project-uuid",  // Unique identifier for this project
        Cloud: true,                  // Enable cloud registration

        // ... rest of your ontology
    }
}
```

### TypeScript Backend

For TypeScript backends, configure in your `ontology.config.ts`:

```typescript
export default defineOntology({
  name: 'my-app',
  uuid: 'your-project-uuid',  // Unique identifier for this project
  cloud: true,                 // Enable cloud registration

  // ... rest of your ontology
});
```

## Authentication

To authenticate with ont-run.com, set the `ONT_API_KEY` environment variable:

```bash
export ONT_API_KEY=your-api-key
```

Get your API key by running:

```bash
npx ont-run login
```

This will open a browser window to authenticate and save your API key locally.

## Anonymous vs Verified Registration

### Anonymous Registration

If no API key is provided, ont-run will still register your ontology anonymously. This allows:
- Basic AI agent discovery of your API
- Local development without authentication

However, anonymous registrations:
- Cannot be claimed or managed later
- Don't support approval workflows
- Have limited visibility in the ont-run.com dashboard

### Verified Registration

With an API key, your ontology registration is verified and linked to your account. This enables:
- Full ontology management in the dashboard
- Human approval workflows for ontology changes
- Version history and rollback capabilities
- Team collaboration features

## How Registration Works

Registration happens automatically when your server starts:

1. **Server startup** - Your ont-run server starts normally
2. **Background registration** - A non-blocking request sends your ontology metadata to ont-run.com
3. **Confirmation** - The registration result is logged (success or failure doesn't block your server)

```
[INFO] Starting server on :8080...
[INFO] Registered ontology with ont-run.com (version: abc123)
```

If registration fails (e.g., network issues), your server continues running normally. Registration will be retried on the next server restart.

## Disabling Cloud Integration

To disable cloud integration entirely, set `Cloud: false` (Go) or `cloud: false` (TypeScript):

```go
// Go
Cloud: false,
```

```typescript
// TypeScript
cloud: false,
```

When disabled, your ontology operates completely locally with no external communication.
