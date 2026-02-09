#!/bin/bash
# Validate ont.lock file against the JSON schema

set -e

# Check if ont.lock exists
if [ ! -f "ont.lock" ]; then
    echo "Error: ont.lock file not found in current directory"
    exit 1
fi

# Check if ajv-cli is installed
if ! command -v ajv &> /dev/null; then
    echo "Installing ajv-cli for JSON schema validation..."
    npm install -g ajv-cli ajv-formats
fi

# Validate the lock file
echo "Validating ont.lock against schema..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ajv validate \
    -s "$REPO_ROOT/schemas/lockfile.schema.json" \
    -d "ont.lock" \
    --strict=false

echo "✓ Lock file is valid!"
