import { z } from "zod";

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
 * Check if a value is a Zod schema (duck typing to work across bundle boundaries)
 */
function isZodSchema(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === "object" &&
    "_def" in val &&
    "safeParse" in val &&
    typeof (val as { safeParse: unknown }).safeParse === "function"
  );
}

/**
 * Schema for function definition
 */
export const FunctionDefinitionSchema = z.object({
  description: z.string(),
  access: z.array(z.string()).min(1),
  inputs: z.custom<z.ZodType>(isZodSchema, {
    message: "inputs must be a Zod schema",
  }),
  resolver: z.string(),
});

/**
 * Schema for auth function
 */
export const AuthFunctionSchema = z
  .function()
  .args(z.custom<Request>())
  .returns(z.union([z.array(z.string()), z.promise(z.array(z.string()))]));

/**
 * Schema for the full ontology configuration
 */
export const OntologyConfigSchema = z.object({
  name: z.string().min(1),
  environments: z.record(z.string(), EnvironmentConfigSchema),
  auth: z.function(),
  accessGroups: z.record(z.string(), AccessGroupConfigSchema),
  functions: z.record(z.string(), FunctionDefinitionSchema),
});

/**
 * Validate that all function access groups exist in accessGroups
 */
export function validateAccessGroups(config: z.infer<typeof OntologyConfigSchema>): void {
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
