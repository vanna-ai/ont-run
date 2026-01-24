import { createHash } from "crypto";
import { z } from "zod";
import type { OntologyConfig } from "../config/types.js";
import { getFieldFromMetadata, getUserContextFields } from "../config/categorical.js";
import {
  isZodObject,
  isZodOptional,
  isZodNullable,
  isZodArray,
  isZodDefault,
  getObjectShape,
  getInnerSchema,
  getArrayElement,
} from "../config/zod-utils.js";
import type {
  OntologySnapshot,
  FunctionShape,
  FieldReference,
} from "./types.js";

/**
 * Recursively extract fieldFrom references from a Zod schema
 */
function extractFieldReferences(
  schema: z.ZodType<unknown>,
  path: string = ""
): FieldReference[] {
  const results: FieldReference[] = [];

  // Check if this schema has fieldFrom metadata
  const metadata = getFieldFromMetadata(schema);
  if (metadata) {
    results.push({
      path: path || "(root)",
      functionName: metadata.functionName,
    });
  }

  // Handle ZodObject - recurse into properties
  if (isZodObject(schema)) {
    const shape = getObjectShape(schema);
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        const fieldPath = path ? `${path}.${key}` : key;
        results.push(
          ...extractFieldReferences(value as z.ZodType<unknown>, fieldPath)
        );
      }
    }
  }

  // Handle ZodOptional - unwrap
  if (isZodOptional(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldReferences(inner as z.ZodType<unknown>, path));
    }
  }

  // Handle ZodNullable - unwrap
  if (isZodNullable(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldReferences(inner as z.ZodType<unknown>, path));
    }
  }

  // Handle ZodArray - recurse into element
  if (isZodArray(schema)) {
    const element = getArrayElement(schema);
    if (element) {
      results.push(...extractFieldReferences(element as z.ZodType<unknown>, `${path}[]`));
    }
  }

  // Handle ZodDefault - unwrap
  if (isZodDefault(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldReferences(inner as z.ZodType<unknown>, path));
    }
  }

  return results;
}

/**
 * Extract the ontology snapshot from an OntologyConfig.
 * This extracts ONLY the security-relevant parts:
 * - Function names
 * - Access lists
 * - Input schemas
 * - Output schemas
 * - Descriptions
 * - Entities
 * - Field references (fieldFrom)
 *
 * It DOES NOT include:
 * - Resolver paths (so resolver code can change freely)
 * - Environment configs
 * - Auth function
 */
export function extractOntology(config: OntologyConfig): OntologySnapshot {
  const functions: Record<string, FunctionShape> = {};

  for (const [name, fn] of Object.entries(config.functions)) {
    // Convert Zod schema to JSON Schema for hashing
    // This ensures we're comparing the shape, not the Zod instance
    let inputsSchema: Record<string, unknown>;
    try {
      inputsSchema = z.toJSONSchema(fn.inputs, {
        reused: "inline",
        unrepresentable: "any",
      }) as Record<string, unknown>;
      // Remove $schema key if present
      delete inputsSchema.$schema;
    } catch {
      // If z.toJSONSchema fails, use a placeholder
      inputsSchema = { type: "unknown" };
    }

    // Convert outputs schema if present
    let outputsSchema: Record<string, unknown> | undefined;
    if (fn.outputs) {
      try {
        outputsSchema = z.toJSONSchema(fn.outputs, {
          reused: "inline",
          unrepresentable: "any",
        }) as Record<string, unknown>;
        delete outputsSchema.$schema;
      } catch {
        outputsSchema = { type: "unknown" };
      }
    }

    // Extract field references
    const fieldReferences = extractFieldReferences(fn.inputs);

    // Check if function uses userContext
    const userContextFields = getUserContextFields(fn.inputs);
    const usesUserContext = userContextFields.length > 0;

    functions[name] = {
      description: fn.description,
      // Sort access groups for consistent hashing
      access: [...fn.access].sort(),
      // Sort entities for consistent hashing
      entities: [...fn.entities].sort(),
      inputsSchema,
      outputsSchema,
      fieldReferences:
        fieldReferences.length > 0 ? fieldReferences : undefined,
      usesUserContext: usesUserContext || undefined,
    };
  }

  return {
    name: config.name,
    // Sort access groups for consistent hashing
    accessGroups: Object.keys(config.accessGroups).sort(),
    // Sort entities for consistent hashing
    entities: config.entities
      ? Object.keys(config.entities).sort()
      : undefined,
    functions,
  };
}

/**
 * Create a deterministic hash of an ontology snapshot.
 * Uses SHA256 and returns a 16-character hex string.
 */
export function hashOntology(ontology: OntologySnapshot): string {
  // Sort all keys at all levels for deterministic hashing
  const normalized = JSON.stringify(ontology, (_, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // Sort object keys
      return Object.keys(value)
        .sort()
        .reduce(
          (sorted, key) => {
            sorted[key] = value[key];
            return sorted;
          },
          {} as Record<string, unknown>
        );
    }
    return value;
  });

  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Extract ontology snapshot and compute hash in one step
 */
export function computeOntologyHash(config: OntologyConfig): {
  ontology: OntologySnapshot;
  hash: string;
} {
  const ontology = extractOntology(config);
  const hash = hashOntology(ontology);
  return { ontology, hash };
}
