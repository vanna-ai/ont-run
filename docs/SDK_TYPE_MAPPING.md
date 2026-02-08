# SDK Type Mapping Reference

This document explains how schemas are converted to TypeScript types in the generated SDK for both TypeScript (Zod) and Go backends.

## Optional vs Nullable Types

When generating TypeScript SDKs from schemas, it's important to understand the difference between `optional` and `nullable`:

### TypeScript (Zod) Type Mappings

| Zod Schema | Generated TypeScript | Accepts | Required? |
|------------|---------------------|---------|-----------|
| `z.string().optional()` | `field?: string` | `string` or `undefined` | No |
| `z.string().nullable()` | `field: string \| null` | `string` or `null` | Yes |
| `z.string().nullable().optional()` | `field?: string \| null` | `string`, `null`, or `undefined` | No |
| `z.string().nullish()` | `field?: string \| null` | `string`, `null`, or `undefined` | No |

### Go Schema Type Mappings

| Go Schema | Generated TypeScript | Go Type | Accepts |
|-----------|---------------------|---------|---------|
| `ont.String()` in Object | `field: string` | `string` | `string` (required) |
| `ont.String()` in Object + `.Optional("field")` | `field?: string` | `*string` or use `omitempty` tag | `string` or `undefined` |
| `ont.Nullable(ont.String())` | `field: string \| null` | `*string` | `string` or `null` (required) |
| `ont.Nullable(ont.String())` + `.Optional("field")` | `field?: string \| null` | `*string` with `omitempty` | `string`, `null`, or `undefined` |

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

#### TypeScript (Zod)

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

#### Go

```go
// Schema
ont.Object(map[string]ont.Schema{
  "title":       ont.String(),
  "description": ont.String(),
}).Optional("description")

// Generated Type (same as TypeScript)
{
  title: string;
  description?: string;
}

// Go struct
type Input struct {
  Title       string  `json:"title"`
  Description *string `json:"description,omitempty"`
}

// Valid values
Input{Title: "Hello"}
Input{Title: "Hello", Description: nil}
Input{Title: "Hello", Description: ptr("World")}

// Invalid values
Input{Title: "Hello", Description: ptr("")}  // Wrong: null is not the same as empty string
```

### Example 2: Nullable Field

#### TypeScript (Zod)

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

#### Go

```go
// Schema
ont.Object(map[string]ont.Schema{
  "title":    ont.String(),
  "assignee": ont.Nullable(ont.String()),
})

// Generated Type (same as TypeScript)
{
  title: string;
  assignee: string | null;
}

// Go struct
type Input struct {
  Title    string  `json:"title"`
  Assignee *string `json:"assignee"`  // No omitempty - field is required
}

// Valid values
Input{Title: "Task", Assignee: ptr("John")}
Input{Title: "Task", Assignee: nil}  // nil becomes null in JSON

// Invalid - missing required field
Input{Title: "Task"}  // Validation error if assignee is missing from JSON
```

### Example 3: Nullable and Optional Field

#### TypeScript (Zod)

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

#### Go

```go
// Schema
ont.Object(map[string]ont.Schema{
  "title":    ont.String(),
  "assignee": ont.Nullable(ont.String()),
}).Optional("assignee")

// Generated Type (same as TypeScript)
{
  title: string;
  assignee?: string | null;
}

// Go struct
type Input struct {
  Title    string  `json:"title"`
  Assignee *string `json:"assignee,omitempty"`  // Both nullable AND optional
}

// Valid values
Input{Title: "Task"}
Input{Title: "Task", Assignee: nil}
Input{Title: "Task", Assignee: ptr("John")}
```

## Common Pitfalls

### Pitfall 1: Expecting `optional()` to accept `null`

#### TypeScript (Zod)

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

#### Go

```go
// ❌ WRONG: Expecting Optional to accept null
schema := ont.Object(map[string]ont.Schema{
  "field": ont.String(),
}).Optional("field")

// This will fail validation:
data := map[string]any{"field": nil}  // Error!

// ✅ CORRECT: Use Nullable with Optional
schema := ont.Object(map[string]ont.Schema{
  "field": ont.Nullable(ont.String()),
}).Optional("field")
```

### Pitfall 2: Confusing optional with nullable

#### TypeScript (Zod)

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

#### Go

```go
// ❌ WRONG: Using Nullable when you mean Optional
schema := ont.Object(map[string]ont.Schema{
  "description": ont.Nullable(ont.String()),  // Field is REQUIRED but can be null
})

// This is valid:
map[string]any{"description": nil}

// But this is NOT valid (field is required):
map[string]any{}  // Error! Missing required field

// ✅ CORRECT: Use Optional if the field can be omitted
schema := ont.Object(map[string]ont.Schema{
  "description": ont.String(),
}).Optional("description")
```

## Best Practices

### TypeScript (Zod)

1. **Use `.optional()` for truly optional fields** that can be omitted
2. **Use `.nullable()` for required fields** that can explicitly be set to null
3. **Use `.nullish()` or `.nullable().optional()`** for fields that can be omitted OR null
4. **Always enable `--strictNullChecks`** in your TypeScript configuration
5. **Match your Zod schema to your intent** - don't use nullable when you mean optional

### Go

1. **Use `.Optional("fieldName")` for optional fields** that can be omitted
2. **Use `ont.Nullable(schema)` for nullable fields** that can be null but are required
3. **Combine both** for fields that can be omitted OR null: `ont.Nullable(ont.String())` + `.Optional("fieldName")`
4. **Use pointer types in Go structs** (`*string`) for nullable/optional fields
5. **Use `omitempty` tag** for optional fields in JSON serialization

**Helper function for creating pointers:**

```go
// Helper to create string pointers
func ptr(s string) *string {
  return &s
}

// Usage
Input{Description: ptr("Hello")}
```
5. **Use `omitempty` tag** for optional fields in JSON serialization

## Regenerating the SDK

### TypeScript Backend

If you change your Zod schemas, remember to regenerate your SDK:

```bash
npx ont-run generate-sdk
```

### Go Backend

If you change your Go schemas, regenerate the SDK:

```go
import "github.com/vanna-ai/ont-run/pkg/codegen/typescript"

// In your main.go or build script
if err := typescript.GenerateTypeScript(ontology, "./frontend/src/sdk"); err != nil {
  log.Fatal(err)
}
```

Or create a script to automate SDK generation as part of your build process.
