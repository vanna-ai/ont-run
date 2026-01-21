import { z } from "zod";

/**
 * Symbol for storing fieldFrom metadata on Zod schemas
 */
export const FIELD_FROM_METADATA = Symbol.for("ont:fieldFrom");

/**
 * Metadata stored on fieldFrom Zod schemas
 */
export interface FieldFromMetadata {
  /** Name of the function that provides options for this field */
  functionName: string;
}

/**
 * Type for a Zod string with fieldFrom metadata
 */
export type FieldFromString = z.ZodString & {
  [FIELD_FROM_METADATA]: FieldFromMetadata;
};

/**
 * Create a string field that gets its options from another function.
 *
 * The referenced function should return `{ value: string, label: string }[]`.
 * - If the function has empty inputs `z.object({})`, it's treated as **bulk** (all options fetched at once)
 * - If the function has a `query` input, it's treated as **autocomplete** (options searched)
 *
 * @param functionName - Name of the function that provides options
 *
 * @example
 * ```ts
 * defineOntology({
 *   functions: {
 *     // Bulk options source (empty inputs)
 *     getUserStatuses: {
 *       description: 'Get available user statuses',
 *       access: ['admin'],
 *       entities: [],
 *       inputs: z.object({}),
 *       outputs: z.array(z.object({ value: z.string(), label: z.string() })),
 *       resolver: './resolvers/options/userStatuses.ts',
 *     },
 *
 *     // Autocomplete source (has query input)
 *     searchTeams: {
 *       description: 'Search for teams',
 *       access: ['admin'],
 *       entities: [],
 *       inputs: z.object({ query: z.string() }),
 *       outputs: z.array(z.object({ value: z.string(), label: z.string() })),
 *       resolver: './resolvers/options/searchTeams.ts',
 *     },
 *
 *     // Function using fieldFrom
 *     createUser: {
 *       description: 'Create a user',
 *       access: ['admin'],
 *       entities: ['User'],
 *       inputs: z.object({
 *         name: z.string(),
 *         status: fieldFrom('getUserStatuses'),
 *         team: fieldFrom('searchTeams'),
 *       }),
 *       resolver: './resolvers/createUser.ts',
 *     },
 *   },
 * })
 * ```
 */
export function fieldFrom(functionName: string): FieldFromString {
  const schema = z.string() as FieldFromString;
  schema[FIELD_FROM_METADATA] = { functionName };
  return schema;
}

/**
 * Check if a Zod schema has fieldFrom metadata
 */
export function hasFieldFromMetadata(
  schema: unknown
): schema is FieldFromString {
  return (
    schema !== null &&
    typeof schema === "object" &&
    FIELD_FROM_METADATA in schema
  );
}

/**
 * Extract fieldFrom metadata from a Zod schema
 */
export function getFieldFromMetadata(
  schema: unknown
): FieldFromMetadata | null {
  if (hasFieldFromMetadata(schema)) {
    return schema[FIELD_FROM_METADATA];
  }
  return null;
}
