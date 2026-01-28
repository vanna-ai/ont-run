import { z } from "zod";
import {
  OntologyConfigSchema,
  validateAccessGroups,
  validateEntityReferences,
  validateFieldFromReferences,
} from "./schema.js";
import { validateUiConfig } from "./validate-ui.js";
import type {
  OntologyConfig,
  FunctionDefinition,
  AccessGroupConfig,
  EnvironmentConfig,
  EntityDefinition,
  AuthFunction,
  ResolverFunction,
  UiConfig,
} from "./types.js";

/**
 * Define an Ontology configuration with full type inference.
 *
 * @example
 * ```ts
 * import { defineOntology, fieldFrom } from 'ont-run';
 * import { z } from 'zod';
 * import { getUser } from './resolvers/getUser.js';
 *
 * export default defineOntology({
 *   name: 'my-api',
 *   environments: {
 *     dev: { debug: true },
 *     prod: { debug: false },
 *   },
 *   auth: async (req) => {
 *     const token = req.headers.get('Authorization');
 *     return token ? ['admin'] : ['public'];
 *   },
 *   accessGroups: {
 *     public: { description: 'Unauthenticated users' },
 *     admin: { description: 'Administrators' },
 *   },
 *   entities: {
 *     User: { description: 'A user account' },
 *   },
 *   functions: {
 *     getUser: {
 *       description: 'Get a user by ID',
 *       access: ['public', 'admin'],
 *       entities: ['User'],
 *       inputs: z.object({ id: z.string() }),
 *       resolver: getUser,  // Direct function reference for type safety
 *     },
 *   },
 * });
 * ```
 */
export function defineOntology<
  TGroups extends string,
  TEntities extends string,
  // Use `any` for input/output schema types to avoid contravariance issues with resolver functions.
  // Without this, ResolverFunction<unknown, unknown> won't accept more specific resolver types.
  TFunctions extends Record<string, FunctionDefinition<TGroups, TEntities, any, any>>,
>(config: {
  name: string;
  environments: Record<string, EnvironmentConfig>;
  auth: AuthFunction;
  accessGroups: Record<TGroups, AccessGroupConfig>;
  entities?: Record<TEntities, EntityDefinition>;
  functions: TFunctions;
}): OntologyConfig<TGroups, TEntities, TFunctions> {
  // Validate the config structure
  const parsed = OntologyConfigSchema.parse(config);

  // Validate that all access groups referenced in functions exist
  validateAccessGroups(parsed);

  // Validate that all entities referenced in functions exist
  validateEntityReferences(parsed);

  // Validate that all fieldFrom() references point to existing functions
  validateFieldFromReferences(parsed);

  // Validate UI configs are compatible with output schemas
  for (const [name, tool] of Object.entries(config.functions)) {
    validateUiConfig(name, tool);
  }

  return config as OntologyConfig<TGroups, TEntities, TFunctions>;
}

/**
 * Define a function with full type inference for resolver type safety.
 *
 * This helper ensures that the resolver function's return type matches
 * the outputs Zod schema at compile time.
 *
 * @example
 * ```ts
 * import { defineFunction, z } from 'ont-run';
 * import type { ResolverContext } from 'ont-run';
 *
 * const getUser = defineFunction({
 *   description: 'Get a user by ID',
 *   access: ['public', 'admin'] as const,
 *   entities: ['User'] as const,
 *   inputs: z.object({ id: z.string() }),
 *   outputs: z.object({ id: z.string(), name: z.string() }),
 *   resolver: async (ctx, args) => {
 *     // TypeScript knows args is { id: string }
 *     // TypeScript enforces return type is { id: string, name: string }
 *     return { id: args.id, name: 'Example User' };
 *   },
 * });
 * ```
 */
// Define a function with full type inference - outputs is always required
export function defineFunction<
  TGroups extends string,
  TEntities extends string,
  TInputs extends z.ZodType,
  TOutputs extends z.ZodType,
>(config: {
  description: string;
  access: readonly TGroups[];
  entities: readonly TEntities[];
  inputs: TInputs;
  outputs: TOutputs;
  resolver: ResolverFunction<z.infer<TInputs>, z.infer<TOutputs>>;
  /** Enable UI visualization via MCP Apps. Set to true for auto-detection or provide config. */
  ui?: boolean | UiConfig;
  /** Whether this function is read-only (query) or has side effects (mutation) */
  isReadOnly: boolean;
}): FunctionDefinition<TGroups, TEntities, TInputs, TOutputs> {
  return {
    ...config,
    access: [...config.access],
    entities: [...config.entities],
  } as FunctionDefinition<TGroups, TEntities, TInputs, TOutputs>;
}
