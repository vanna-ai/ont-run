import { OntologyConfigSchema, validateAccessGroups } from "./schema.js";
import type {
  OntologyConfig,
  FunctionDefinition,
  AccessGroupConfig,
  EnvironmentConfig,
  AuthFunction,
} from "./types.js";

/**
 * Define an Ontology configuration with full type inference.
 *
 * @example
 * ```ts
 * import { defineOntology } from 'ont-run';
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
 *   functions: {
 *     getUser: {
 *       description: 'Get a user by ID',
 *       access: ['public', 'admin'],
 *       inputs: z.object({ id: z.string() }),
 *       resolver: './resolvers/getUser.ts',
 *     },
 *   },
 * });
 * ```
 */
export function defineOntology<
  TGroups extends string,
  TFunctions extends Record<string, FunctionDefinition<TGroups>>,
>(config: {
  name: string;
  environments: Record<string, EnvironmentConfig>;
  auth: AuthFunction;
  accessGroups: Record<TGroups, AccessGroupConfig>;
  functions: TFunctions;
}): OntologyConfig<TGroups, TFunctions> {
  // Validate the config structure
  const parsed = OntologyConfigSchema.parse(config);

  // Validate that all access groups referenced in functions exist
  validateAccessGroups(parsed);

  return config as OntologyConfig<TGroups, TFunctions>;
}
