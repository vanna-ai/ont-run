import {
  OntologyConfigSchema,
  validateAccessGroups,
  validateEntityReferences,
  validateFieldFromReferences,
} from "./schema.js";
import type {
  OntologyConfig,
  FunctionDefinition,
  AccessGroupConfig,
  EnvironmentConfig,
  EntityDefinition,
  AuthFunction,
} from "./types.js";

/**
 * Define an Ontology configuration with full type inference.
 *
 * @example
 * ```ts
 * import { defineOntology, fieldFrom } from 'ont-run';
 * import { z } from 'zod';
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
 *       resolver: './resolvers/getUser.ts',
 *     },
 *   },
 * });
 * ```
 */
export function defineOntology<
  TGroups extends string,
  TEntities extends string,
  TFunctions extends Record<string, FunctionDefinition<TGroups, TEntities>>,
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

  return config as OntologyConfig<TGroups, TEntities, TFunctions>;
}
