---
title: fieldFrom
description: API reference for the fieldFrom function
---

`fieldFrom` creates a string field that gets its options from another function.

## Signature

```typescript
function fieldFrom(functionName: string): z.ZodString
```

## Parameters

### `functionName`

**Type:** `string`
**Required:** Yes

The name of the function that provides options for this field. The function must:
- Exist in the ontology's `functions`
- Return `{ value: string, label: string }[]`

## Return value

Returns a Zod string schema with metadata attached. The schema validates that the input is a string, while the metadata tracks which function provides options.

## Usage

```typescript
import { defineOntology, fieldFrom, z } from 'ont-run';

export default defineOntology({
  // ...
  functions: {
    // Options provider function
    getPriorities: {
      description: 'Get available priorities',
      access: ['user'],
      entities: [],
      inputs: z.object({}),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: './resolvers/options/priorities.ts',
    },

    // Function using fieldFrom
    createTicket: {
      description: 'Create a support ticket',
      access: ['user'],
      entities: ['Ticket'],
      inputs: z.object({
        title: z.string(),
        priority: fieldFrom('getPriorities'),  // Use options from getPriorities
      }),
      resolver: './resolvers/createTicket.ts',
    },
  },
});
```

## Bulk vs Autocomplete

The options loading behavior is determined by the **source function's inputs**:

### Bulk loading

If the source function has empty inputs, options are fetched all at once:

```typescript
// Source function with empty inputs = bulk
getPriorities: {
  inputs: z.object({}),  // Empty
  // ...
}
```

### Autocomplete

If the source function has a `query` input, options are searched:

```typescript
// Source function with query input = autocomplete
searchUsers: {
  inputs: z.object({
    query: z.string(),
  }),
  // ...
}
```

## FieldOption type

Source functions should return an array matching this type:

```typescript
interface FieldOption {
  value: string;  // The stored value
  label: string;  // Human-readable display label
}
```

Example resolver:

```typescript
import type { ResolverContext, FieldOption } from 'ont-run';

export default function getPriorities(
  ctx: ResolverContext
): FieldOption[] {
  return [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];
}
```

## Validation

`defineOntology` validates that all `fieldFrom()` references point to existing functions:

```typescript
// This will throw an error
inputs: z.object({
  status: fieldFrom('nonExistent'),
})
```

Error:
```
Function "createTicket" field "status" references unknown function "nonExistent" via fieldFrom().
Valid functions: getPriorities, createTicket, ...
```

## In MCP tools

Field references are exposed in MCP tool metadata:

```json
{
  "name": "createTicket",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "priority": { "type": "string" }
    }
  },
  "fieldReferences": [
    {
      "path": "priority",
      "functionName": "getPriorities"
    }
  ]
}
```

This lets AI agents discover that they should call `getPriorities` to get valid options before calling `createTicket`.

## Nested usage

`fieldFrom` can be used in nested objects:

```typescript
inputs: z.object({
  ticket: z.object({
    title: z.string(),
    priority: fieldFrom('getPriorities'),
  }),
})
```

The path in `fieldReferences` will reflect the nesting: `ticket.priority`
