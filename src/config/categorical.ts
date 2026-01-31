import { z } from "zod";
import { isZodObject, getObjectShape } from "./zod-utils";

/**
 * Symbol for storing fieldFrom metadata on Zod schemas
 */
export const FIELD_FROM_METADATA = Symbol.for("ont:fieldFrom");

/**
 * Symbol for storing userContext metadata on Zod schemas
 */
export const USER_CONTEXT_METADATA = Symbol.for("ont:userContext");

/**
 * Symbol for storing organizationContext metadata on Zod schemas
 */
export const ORGANIZATION_CONTEXT_METADATA = Symbol.for("ont:organizationContext");

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

/**
 * Type for a Zod schema with userContext metadata
 */
export type UserContextSchema<T extends z.ZodType> = T & {
  [USER_CONTEXT_METADATA]: true;
};

/**
 * Mark a schema as user context that will be injected at runtime.
 *
 * Fields marked with `userContext()` are:
 * - **Injected**: Populated from `auth()` result's `user` field
 * - **Hidden**: Not exposed in public API/MCP schemas
 * - **Type-safe**: Resolver receives typed user object
 *
 * @param schema - Zod schema for the user context shape
 *
 * @example
 * ```ts
 * defineOntology({
 *   auth: async (req) => {
 *     const user = await verifyToken(req);
 *     return {
 *       groups: user.isAdmin ? ['admin'] : ['user'],
 *       user: { id: user.id, email: user.email }
 *     };
 *   },
 *
 *   functions: {
 *     editPost: {
 *       description: 'Edit a post',
 *       access: ['user', 'admin'],
 *       entities: ['Post'],
 *       inputs: z.object({
 *         postId: z.string(),
 *         title: z.string(),
 *         currentUser: userContext(z.object({
 *           id: z.string(),
 *           email: z.string(),
 *         })),
 *       }),
 *       resolver: './resolvers/editPost.ts',
 *     },
 *   },
 * })
 * ```
 */
export function userContext<T extends z.ZodType>(schema: T): UserContextSchema<T> {
  const marked = schema as UserContextSchema<T>;
  marked[USER_CONTEXT_METADATA] = true;
  return marked;
}

/**
 * Check if a Zod schema has userContext metadata
 */
export function hasUserContextMetadata(
  schema: unknown
): schema is UserContextSchema<z.ZodType> {
  return (
    schema !== null &&
    typeof schema === "object" &&
    USER_CONTEXT_METADATA in schema &&
    (schema as Record<symbol, unknown>)[USER_CONTEXT_METADATA] === true
  );
}

/**
 * Get all userContext field names from a Zod object schema
 *
 * Note: Uses zod-utils for bundler compatibility (instanceof fails across module boundaries)
 */
export function getUserContextFields(schema: z.ZodType): string[] {
  const fields: string[] = [];

  if (isZodObject(schema)) {
    const shape = getObjectShape(schema);
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        if (hasUserContextMetadata(value)) {
          fields.push(key);
        }
      }
    }
  }

  return fields;
}

/**
 * Type for a Zod schema with organizationContext metadata
 */
export type OrganizationContextSchema<T extends z.ZodType> = T & {
  [ORGANIZATION_CONTEXT_METADATA]: true;
};

/**
 * Mark a schema as organization context that will be injected at runtime.
 *
 * Fields marked with `organizationContext()` are:
 * - **Injected**: Populated from `auth()` result's `organization` field
 * - **Hidden**: Not exposed in public API/MCP schemas
 * - **Type-safe**: Resolver receives typed organization object
 *
 * @param schema - Zod schema for the organization context shape
 *
 * @example
 * ```ts
 * defineOntology({
 *   auth: async (req) => {
 *     const orgId = new URL(req.url).searchParams.get('org_id');
 *     if (!orgId) return { groups: ['public'] };
 *     
 *     const user = await verifyToken(req);
 *     const org = await db.organizations.findById(orgId);
 *     
 *     // Verify user membership in organization
 *     const isMember = await db.organizationMembers.exists({ userId: user.id, orgId });
 *     if (!isMember) throw new Error('Not a member of this organization');
 *     
 *     return {
 *       groups: ['member'],
 *       organization: { id: org.id, name: org.name }
 *     };
 *   },
 *
 *   functions: {
 *     createProject: {
 *       description: 'Create a project in the organization',
 *       access: ['member'],
 *       entities: ['Project'],
 *       inputs: z.object({
 *         name: z.string(),
 *         description: z.string(),
 *         currentOrg: organizationContext(z.object({
 *           id: z.string(),
 *           name: z.string(),
 *         })),
 *       }),
 *       resolver: './resolvers/createProject.ts',
 *     },
 *   },
 * })
 * ```
 */
export function organizationContext<T extends z.ZodType>(schema: T): OrganizationContextSchema<T> {
  const marked = schema as OrganizationContextSchema<T>;
  marked[ORGANIZATION_CONTEXT_METADATA] = true;
  return marked;
}

/**
 * Check if a Zod schema has organizationContext metadata
 */
export function hasOrganizationContextMetadata(
  schema: unknown
): schema is OrganizationContextSchema<z.ZodType> {
  return (
    schema !== null &&
    typeof schema === "object" &&
    ORGANIZATION_CONTEXT_METADATA in schema &&
    (schema as Record<symbol, unknown>)[ORGANIZATION_CONTEXT_METADATA] === true
  );
}

/**
 * Get all organizationContext field names from a Zod object schema
 *
 * Note: Uses zod-utils for bundler compatibility (instanceof fails across module boundaries)
 */
export function getOrganizationContextFields(schema: z.ZodType): string[] {
  const fields: string[] = [];

  if (isZodObject(schema)) {
    const shape = getObjectShape(schema);
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        if (hasOrganizationContextMetadata(value)) {
          fields.push(key);
        }
      }
    }
  }

  return fields;
}
