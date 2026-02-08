# SDK Type Mapping Reference

This document explains how Zod schemas are converted to TypeScript types in the generated SDK.

## Optional vs Nullable Types

When generating TypeScript SDKs from Zod schemas, it's important to understand the difference between `optional` and `nullable`:

### Type Mappings

| Zod Schema | Generated TypeScript | Accepts | Required? |
|------------|---------------------|---------|-----------|
| `z.string().optional()` | `field?: string` | `string` or `undefined` | No |
| `z.string().nullable()` | `field: string \| null` | `string` or `null` | Yes |
| `z.string().nullable().optional()` | `field?: string \| null` | `string`, `null`, or `undefined` | No |
| `z.string().nullish()` | `field?: string \| null` | `string`, `null`, or `undefined` | No |

### TypeScript Semantics

With TypeScript's `--strictNullChecks` enabled (recommended):

- **`field?: string`** - The `?` makes the property optional, meaning:
  - The property can be omitted from the object
  - The property can be explicitly set to `undefined`
  - The property **cannot** be set to `null` (TypeScript error)

- **`field: string | null`** - The property is required but can be null:
  - The property must be present in the object
  - The property can be set to a string or `null`
  - The property **cannot** be `undefined` (TypeScript error)

- **`field?: string | null`** - The property is optional and can be null:
  - The property can be omitted from the object
  - The property can be set to a string, `null`, or `undefined`

## Examples

### Example 1: Optional Field

```typescript
// Schema
z.object({
  title: z.string(),
  description: z.string().optional(),
})

// Generated Type
{
  title: string;
  description?: string;
}

// Valid values
{ title: "Hello" }
{ title: "Hello", description: undefined }
{ title: "Hello", description: "World" }

// Invalid values
{ title: "Hello", description: null }  // TypeScript error
```

### Example 2: Nullable Field

```typescript
// Schema
z.object({
  title: z.string(),
  assignee: z.string().nullable(),
})

// Generated Type
{
  title: string;
  assignee: string | null;
}

// Valid values
{ title: "Task", assignee: "John" }
{ title: "Task", assignee: null }

// Invalid values
{ title: "Task" }  // TypeScript error - property required
{ title: "Task", assignee: undefined }  // TypeScript error
```

### Example 3: Nullable and Optional Field

```typescript
// Schema
z.object({
  title: z.string(),
  assignee: z.string().nullable().optional(),
})

// Equivalent to
z.object({
  title: z.string(),
  assignee: z.string().nullish(),
})

// Generated Type
{
  title: string;
  assignee?: string | null;
}

// Valid values
{ title: "Task" }
{ title: "Task", assignee: undefined }
{ title: "Task", assignee: null }
{ title: "Task", assignee: "John" }
```

## Common Pitfalls

### Pitfall 1: Expecting `optional()` to accept `null`

```typescript
// ❌ WRONG: Expecting this to accept null
const schema = z.object({
  field: z.string().optional()
});

// This will fail Zod validation AND TypeScript checking:
const data = { field: null };  // Error!

// ✅ CORRECT: Use nullable() or nullish()
const schema = z.object({
  field: z.string().nullish()  // or .nullable().optional()
});
```

### Pitfall 2: Confusing optional with nullable

```typescript
// ❌ WRONG: Using nullable() when you mean optional()
const schema = z.object({
  description: z.string().nullable()  // Field is REQUIRED but can be null
});

// This is valid:
{ description: null }

// But this is NOT valid (field is required):
{}  // Error! Missing required field

// ✅ CORRECT: Use optional() if the field can be omitted
const schema = z.object({
  description: z.string().optional()  // Field can be omitted
});
```

## Best Practices

1. **Use `.optional()` for truly optional fields** that can be omitted
2. **Use `.nullable()` for required fields** that can explicitly be set to null
3. **Use `.nullish()` or `.nullable().optional()`** for fields that can be omitted OR null
4. **Always enable `--strictNullChecks`** in your TypeScript configuration
5. **Match your Zod schema to your intent** - don't use nullable when you mean optional

## Regenerating the SDK

If you change your Zod schemas, remember to regenerate your SDK:

```bash
npx ont-run generate-sdk
```

Or create a script to automate SDK generation as part of your build process.
