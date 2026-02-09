# Lock File Format Examples

This directory contains example lock files demonstrating the standard format.

## Go-Generated Lock File

```json
{
  "version": 1,
  "hash": "21987274be9ec86c",
  "approvedAt": "2026-02-09T11:12:08.070Z",
  "ontology": {
    "name": "test-ontology",
    "accessGroups": [
      "admin",
      "user"
    ],
    "entities": [
      "Post",
      "User"
    ],
    "functions": {
      "getUser": {
        "description": "Get a user by ID",
        "access": [
          "admin",
          "user"
        ],
        "entities": [
          "User"
        ],
        "inputsSchema": {
          "properties": {
            "id": {
              "format": "uuid",
              "type": "string"
            }
          },
          "required": [
            "id"
          ],
          "type": "object"
        },
        "outputsSchema": {
          "properties": {
            "email": {
              "format": "email",
              "type": "string"
            },
            "name": {
              "type": "string"
            }
          },
          "required": [
            "name",
            "email"
          ],
          "type": "object"
        }
      }
    }
  }
}
```

## TypeScript-Generated Lock File

```json
{
  "version": 1,
  "hash": "f79c14c09c073dd1",
  "approvedAt": "2026-02-09T11:15:28.315Z",
  "ontology": {
    "name": "test-ontology",
    "accessGroups": [
      "admin",
      "user"
    ],
    "entities": [
      "Post",
      "User"
    ],
    "functions": {
      "getUser": {
        "description": "Get a user by ID",
        "access": [
          "admin",
          "user"
        ],
        "entities": [
          "User"
        ],
        "inputsSchema": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            }
          },
          "required": [
            "id"
          ],
          "additionalProperties": false
        },
        "outputsSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "email": {
              "type": "string",
              "format": "email",
              "pattern": "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
            }
          },
          "required": [
            "name",
            "email"
          ],
          "additionalProperties": false
        }
      }
    }
  }
}
```

## Key Observations

### Similarities (Standard Format)
Both implementations produce:
- `version` as number (1)
- `hash` as 16-character hex string
- `approvedAt` as ISO 8601 timestamp
- Nested `ontology` object
- Sorted `accessGroups` and `entities` arrays
- Function shapes with full JSON Schema

### Minor Differences (Implementation Details)
- **TypeScript** includes `pattern` and `additionalProperties` in JSON Schema (more strict)
- **Go** uses simpler JSON Schema without patterns (more permissive)
- **Hash values** differ because they hash different ontologies (expected)

### Cross-Language Compatibility
Both formats are valid against `schemas/lockfile.schema.json` and can be:
- Read by either implementation
- Compared for diffs
- Reviewed in browser UIs
- Validated programmatically

## Validation

```bash
# Validate against schema
ajv validate -s schemas/lockfile.schema.json -d ont.lock --strict=false

# Or use the helper script
scripts/validate-lockfile.sh
```
