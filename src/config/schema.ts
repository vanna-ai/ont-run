import { z } from "zod";
import { getFieldFromMetadata, getUserContextFields } from "./categorical.js";
import {
  isZodSchema,
  isZod3Schema,
  isZodObject,
  isZodOptional,
  isZodNullable,
  isZodArray,
  isZodDefault,
  getObjectShape,
  getInnerSchema,
  getArrayElement,
} from "./zod-utils.js";
import type { OntologyConfig } from "./types.js";

/**
 * Schema for environment configuration
 */
export const EnvironmentConfigSchema = z
  .object({
    debug: z.boolean().optional(),
  })
  .passthrough();

/**
 * Schema for access group configuration
 */
export const AccessGroupConfigSchema = z.object({
  description: z.string(),
});

/**
 * Schema for entity definition
 */
export const EntityDefinitionSchema = z.object({
  description: z.string(),
});

/**
 * Check if a value is a function
 */
function isFunction(val: unknown): val is (...args: unknown[]) => unknown {
  return typeof val === "function";
}

/**
 * Validate that a value is a Zod 4 schema, with helpful error for Zod 3
 */
function validateZodSchema(val: unknown, fieldName: string): boolean {
  if (isZodSchema(val)) return true;
  if (isZod3Schema(val)) {
    throw new Error(
      `${fieldName} appears to be a Zod 3 schema. ont-run requires Zod 4.\n` +
      `Please upgrade: bun add zod@4`
    );
  }
  return false;
}

/**
 * Schema for function definition
 */
export const FunctionDefinitionSchema = z.object({
  description: z.string(),
  access: z.array(z.string()).min(1),
  entities: z.array(z.string()),
  inputs: z.custom<z.ZodType>((val) => validateZodSchema(val, "inputs"), {
    message: "inputs must be a Zod 4 schema",
  }),
  outputs: z.custom<z.ZodType>((val) => validateZodSchema(val, "outputs"), {
    message: "outputs must be a Zod 4 schema",
  }),
  resolver: z.custom<(...args: unknown[]) => unknown>(isFunction, {
    message: "resolver must be a function",
  }),
  isReadOnly: z.boolean(),
});

/**
 * Schema for the full ontology configuration
 */
export const OntologyConfigSchema = z.object({
  name: z.string().min(1),
  environments: z.record(z.string(), EnvironmentConfigSchema),
  auth: z.custom<(req: Request) => unknown>(isFunction, {
    message: "auth must be a function",
  }),
  accessGroups: z.record(z.string(), AccessGroupConfigSchema),
  entities: z.record(z.string(), EntityDefinitionSchema).optional(),
  functions: z.record(z.string(), FunctionDefinitionSchema),
});

/**
 * Validate that all function access groups exist in accessGroups
 */
export function validateAccessGroups(
  config: z.infer<typeof OntologyConfigSchema>
): void {
  const validGroups = new Set(Object.keys(config.accessGroups));

  for (const [fnName, fn] of Object.entries(config.functions)) {
    for (const group of fn.access) {
      if (!validGroups.has(group)) {
        throw new Error(
          `Function "${fnName}" references unknown access group "${group}". ` +
            `Valid groups: ${[...validGroups].join(", ")}`
        );
      }
    }
  }
}

/**
 * Validate that all function entity references exist in entities
 */
export function validateEntityReferences(
  config: z.infer<typeof OntologyConfigSchema>
): void {
  const validEntities = config.entities
    ? new Set(Object.keys(config.entities))
    : new Set<string>();

  for (const [fnName, fn] of Object.entries(config.functions)) {
    for (const entity of fn.entities) {
      if (!validEntities.has(entity)) {
        const validList =
          validEntities.size > 0
            ? [...validEntities].join(", ")
            : "(none defined)";
        throw new Error(
          `Function "${fnName}" references unknown entity "${entity}". ` +
            `Valid entities: ${validList}`
        );
      }
    }
  }
}

/**
 * Recursively extract fieldFrom references from a Zod schema
 */
function extractFieldFromRefs(
  schema: z.ZodType<unknown>,
  path: string = ""
): Array<{ path: string; functionName: string }> {
  const results: Array<{ path: string; functionName: string }> = [];

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
          ...extractFieldFromRefs(value as z.ZodType<unknown>, fieldPath)
        );
      }
    }
  }

  // Handle ZodOptional - unwrap
  if (isZodOptional(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldFromRefs(inner as z.ZodType<unknown>, path));
    }
  }

  // Handle ZodNullable - unwrap
  if (isZodNullable(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldFromRefs(inner as z.ZodType<unknown>, path));
    }
  }

  // Handle ZodArray - recurse into element
  if (isZodArray(schema)) {
    const element = getArrayElement(schema);
    if (element) {
      results.push(...extractFieldFromRefs(element as z.ZodType<unknown>, `${path}[]`));
    }
  }

  // Handle ZodDefault - unwrap
  if (isZodDefault(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldFromRefs(inner as z.ZodType<unknown>, path));
    }
  }

  return results;
}

/**
 * Validate that all fieldFrom() references point to existing functions
 */
export function validateFieldFromReferences(
  config: z.infer<typeof OntologyConfigSchema>
): void {
  const validFunctions = new Set(Object.keys(config.functions));

  for (const [fnName, fn] of Object.entries(config.functions)) {
    const refs = extractFieldFromRefs(fn.inputs);

    for (const ref of refs) {
      if (!validFunctions.has(ref.functionName)) {
        throw new Error(
          `Function "${fnName}" field "${ref.path}" references unknown function "${ref.functionName}" via fieldFrom(). ` +
            `Valid functions: ${[...validFunctions].join(", ")}`
        );
      }
    }
  }
}

/**
 * Validate that functions using userContext() will receive user data from auth.
 * This does a runtime check by calling auth with a mock request to verify it returns
 * an AuthResult with a user field.
 *
 * @param config - The full OntologyConfig (needed for the actual auth function)
 */
export async function validateUserContextRequirements(
  config: OntologyConfig
): Promise<void> {
  // Find functions that use userContext
  const functionsWithUserContext: string[] = [];

  for (const [fnName, fn] of Object.entries(config.functions)) {
    const userContextFields = getUserContextFields(fn.inputs as z.ZodType);
    if (userContextFields.length > 0) {
      functionsWithUserContext.push(fnName);
    }
  }

  // If no functions use userContext, no validation needed
  if (functionsWithUserContext.length === 0) {
    return;
  }

  // Create a mock request to test the auth function
  const mockRequest = new Request("http://localhost/test", {
    headers: { Authorization: "test-token" },
  });

  try {
    const authResult = await config.auth(mockRequest);

    // Check if auth returns an object with user field
    const hasUserField =
      authResult !== null &&
      typeof authResult === "object" &&
      !Array.isArray(authResult) &&
      "user" in authResult;

    if (!hasUserField) {
      throw new Error(
        `The following functions use userContext() but auth() does not return a user object:\n` +
          `  ${functionsWithUserContext.join(", ")}\n\n` +
          `To fix this, update your auth function to return an AuthResult:\n` +
          `  auth: async (req) => {\n` +
          `    return {\n` +
          `      groups: ['user'],\n` +
          `      user: { id: '...', email: '...' }  // Add user data here\n` +
          `    };\n` +
          `  }`
      );
    }
  } catch (error) {
    // If auth throws, we can't validate - but that's ok, the error will surface at request time
    if (error instanceof Error && error.message.includes("userContext")) {
      throw error; // Re-throw our validation error
    }
    // Otherwise, auth function had an error with the mock request - skip validation
  }
}
