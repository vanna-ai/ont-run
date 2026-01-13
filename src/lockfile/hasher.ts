import { createHash } from "crypto";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OntologyConfig } from "../config/types.js";
import type { TopologySnapshot, FunctionTopology } from "./types.js";

/**
 * Extract the topology from an OntologyConfig.
 * This extracts ONLY the security-relevant parts:
 * - Function names
 * - Access lists
 * - Input schemas
 * - Descriptions
 *
 * It DOES NOT include:
 * - Resolver paths (so resolver code can change freely)
 * - Environment configs
 * - Auth function
 */
export function extractTopology(config: OntologyConfig): TopologySnapshot {
  const functions: Record<string, FunctionTopology> = {};

  for (const [name, fn] of Object.entries(config.functions)) {
    // Convert Zod schema to JSON Schema for hashing
    // This ensures we're comparing the shape, not the Zod instance
    let inputsSchema: Record<string, unknown>;
    try {
      inputsSchema = zodToJsonSchema(fn.inputs, {
        // Remove $schema to make hashing more stable
        $refStrategy: "none",
      }) as Record<string, unknown>;
      // Remove $schema key if present
      delete inputsSchema.$schema;
    } catch {
      // If zodToJsonSchema fails, use a placeholder
      inputsSchema = { type: "unknown" };
    }

    functions[name] = {
      description: fn.description,
      // Sort access groups for consistent hashing
      access: [...fn.access].sort(),
      inputsSchema,
    };
  }

  return {
    name: config.name,
    // Sort access groups for consistent hashing
    accessGroups: Object.keys(config.accessGroups).sort(),
    functions,
  };
}

/**
 * Create a deterministic hash of a topology snapshot.
 * Uses SHA256 and returns a 16-character hex string.
 */
export function hashTopology(topology: TopologySnapshot): string {
  // Sort all keys at all levels for deterministic hashing
  const normalized = JSON.stringify(topology, (_, value) => {
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
 * Extract topology and compute hash in one step
 */
export function computeTopologyHash(config: OntologyConfig): {
  topology: TopologySnapshot;
  hash: string;
} {
  const topology = extractTopology(config);
  const hash = hashTopology(topology);
  return { topology, hash };
}
