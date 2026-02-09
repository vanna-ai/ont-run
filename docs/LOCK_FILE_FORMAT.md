# Lock File Format Standardization

## Overview

This document describes the standardized lock file format for ont-run and explains the changes made to achieve cross-language compatibility.

## Problem

The Go and TypeScript implementations were generating lock files in different formats:

### Go Format (Old)
```json
{
  "version": "1.0",
  "name": "my-ontology",
  "hash": "abc123...",
  "generatedAt": "2024-01-01T00:00:00Z",
  "accessGroups": {
    "admin": "hash1",
    "user": "hash2"
  },
  "entities": {
    "User": "hash3"
  },
  "functions": {
    "getUser": "hash4"
  }
}
```

### TypeScript Format (Current Standard)
```json
{
  "version": 1,
  "hash": "abc123def456789a",
  "approvedAt": "2024-01-01T00:00:00.000Z",
  "ontology": {
    "name": "my-ontology",
    "accessGroups": ["admin", "user"],
    "entities": ["User"],
    "functions": {
      "getUser": {
        "description": "Get a user by ID",
        "access": ["admin"],
        "entities": ["User"],
        "inputsSchema": { ... },
        "outputsSchema": { ... }
      }
    }
  }
}
```

## Solution

We created an official JSON schema at `schemas/lockfile.schema.json` that defines the standard format, based on the TypeScript implementation. All language implementations must now generate lock files that conform to this schema.

## Key Changes

### 1. Version Field
- **Old (Go):** String `"1.0"`
- **New (Standard):** Number `1`
- **Rationale:** Easier version comparison

### 2. Timestamp Field
- **Old (Go):** `generatedAt`
- **New (Standard):** `approvedAt`
- **Rationale:** Emphasizes that this is a human approval checkpoint, not an automated snapshot

### 3. Structure
- **Old (Go):** Flat structure with component hashes
- **New (Standard):** Nested `ontology` object with complete snapshots
- **Rationale:** Enables meaningful diffs and cross-language verification without parsing source code

### 4. Function Representation
- **Old (Go):** Name → Hash mapping
- **New (Standard):** Name → Full function shape with:
  - Description
  - Access control lists
  - Entities
  - JSON Schema for inputs/outputs
  - Field references
  - Context usage flags

### 5. Hash Length
- **Old (Go):** Full 64-character SHA256 hash
- **New (Standard):** First 16 characters only
- **Rationale:** Matches TypeScript implementation, sufficient for collision detection in practice

## Benefits

1. **Cross-Language Compatibility:** Any implementation can generate and read lock files
2. **Better Diffs:** Full snapshots enable detailed change descriptions
3. **Visual Review:** Browser UIs can display meaningful changes without source code access
4. **Future-Proof:** Adding Python or other language support will be straightforward
5. **Validation:** Lock files can be validated against the schema

## Migration

### For Go Users

If you have existing `ont.lock` files from the Go implementation, they will be regenerated in the new format the next time you run the ontology review process. The old format will not be compatible.

**Action Required:**
1. Delete your existing `ont.lock` file
2. Run your ontology review process to generate a new lock file in the standard format

### For TypeScript Users

No action required. The TypeScript implementation already uses the standard format.

### For New Implementations

Implement lock file generation according to the JSON schema at `schemas/lockfile.schema.json`. See `schemas/README.md` for detailed requirements.

## Implementation Notes

### Go Implementation

The Go implementation now:
- Uses `int` for version
- Uses `time.Time` with JSON encoding for `approvedAt`
- Generates full `OntologySnapshot` with all function details
- Converts Go schema types to JSON Schema using existing `JSONSchema()` methods
- Truncates hash to 16 characters

Key files:
- `pkg/ontology/lock.go` - Lock file structures and generation
- `pkg/ontology/hash.go` - Hash generation (updated to 16 chars)

### TypeScript Implementation

The TypeScript implementation already follows the standard. No changes were required.

Key files:
- `src/lockfile/types.ts` - Type definitions
- `src/lockfile/index.ts` - Lock file operations
- `src/lockfile/hasher.ts` - Snapshot extraction and hashing

## Validation

You can validate lock files against the schema using:

```bash
# Using ajv-cli (Node.js)
npm install -g ajv-cli ajv-formats
ajv validate -s schemas/lockfile.schema.json -d ont.lock --strict=false

# Using Python (when available)
pip install check-jsonschema
check-jsonschema --schemafile schemas/lockfile.schema.json ont.lock
```

## References

- JSON Schema: `schemas/lockfile.schema.json`
- Schema Documentation: `schemas/README.md`
- Go Implementation: `pkg/ontology/lock.go`
- TypeScript Implementation: `src/lockfile/`
