# Ont-Run Lock File Schema

This directory contains the official JSON Schema standard for the `ont.lock` file format.

## Purpose

The `ont.lock` file is a security checkpoint that tracks approved changes to your ontology. It ensures that any modifications to access controls, function signatures, or entity relationships are explicitly reviewed and approved before deployment.

## Standard Format

The lock file format is defined in [`lockfile.schema.json`](./lockfile.schema.json) and follows this structure:

```json
{
  "version": 1,
  "hash": "abc123def456789a",
  "approvedAt": "2024-01-01T00:00:00.000Z",
  "ontology": {
    "name": "my-ontology",
    "accessGroups": ["admin", "user"],
    "entities": ["User", "Document"],
    "functions": {
      "getUser": {
        "description": "Get a user by ID",
        "access": ["admin", "user"],
        "entities": ["User"],
        "inputsSchema": {
          "type": "object",
          "properties": {
            "id": { "type": "string" }
          }
        },
        "outputsSchema": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "email": { "type": "string" }
          }
        }
      }
    }
  }
}
```

## Key Design Decisions

### 1. **Version as Number**
The `version` field is a number (not a string) to simplify version comparison logic across implementations.

### 2. **Complete Ontology Snapshot**
Unlike hash-only approaches, this format includes the complete ontology snapshot with:
- Full function signatures (inputs/outputs as JSON Schema)
- Access control lists
- Entity relationships
- Contextual metadata (userContext, organizationContext usage)

This enables:
- Meaningful diffs without parsing the source code
- Visual review in browser UIs
- Cross-language compatibility verification

### 3. **Sorted Arrays**
All arrays (`accessGroups`, `entities`, `access`, etc.) are sorted alphabetically to ensure deterministic hashing and consistent diffs.

### 4. **Timestamp: `approvedAt`**
Uses `approvedAt` (not `generatedAt`) to emphasize that this is a human-approval checkpoint, not just an automated snapshot.

### 5. **JSON Schema for Function Signatures**
Function inputs/outputs are represented as JSON Schema, making the format language-agnostic. Each implementation should convert its native schema format (Zod in TypeScript, schema types in Go) to JSON Schema.

## Implementation Requirements

Any language implementation (TypeScript, Go, Python, etc.) **MUST**:

1. **Generate lock files that validate against `lockfile.schema.json`**
2. **Use version 1** (currently the only supported version)
3. **Sort all arrays** (accessGroups, entities, access) alphabetically
4. **Convert native schemas to JSON Schema** for `inputsSchema` and `outputsSchema`
5. **Compute SHA256 hash** of the ontology snapshot (first 16 hex chars) for the `hash` field
6. **Use ISO 8601 format** for the `approvedAt` timestamp

## Validation

You can validate a lock file against the schema using any JSON Schema validator:

```bash
# Using ajv-cli (Node.js)
npm install -g ajv-cli
ajv validate -s schemas/lockfile.schema.json -d ont.lock

# Using check-jsonschema (Python)
pip install check-jsonschema
check-jsonschema --schemafile schemas/lockfile.schema.json ont.lock
```

## Language-Specific Notes

### TypeScript
The TypeScript implementation already uses this format. See `src/lockfile/types.ts` for the type definitions.

### Go
The Go implementation needs to be updated to match this format. Key changes:
- Use `int` for version (not string)
- Use `time.Time` with JSON formatting for `approvedAt`
- Include full ontology snapshot (not just hashes)
- Convert Go schema types to JSON Schema

## Versioning

The schema version (`version: 1`) indicates the lock file format version. This is separate from the ontology version or the ont-run tool version.

Future versions will be backward compatible where possible. Major changes will increment the version number.

## Contributing

If you're implementing ont-run in a new language:
1. Generate lock files that conform to this schema
2. Add tests to verify schema compliance
3. Submit examples in your PR

For schema changes:
1. Propose changes via GitHub issue first
2. Update this README and the schema file
3. Update all language implementations
4. Increment the version if breaking changes are made
