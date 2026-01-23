/**
 * Ontology - Ontology-first backends with human-approved AI access & edits
 *
 * @example
 * ```ts
 * import { defineOntology, fieldFrom } from 'ont-run';
 * import { z } from 'zod';
 *
 * export default defineOntology({
 *   name: 'my-api',
 *   environments: { dev: { debug: true }, prod: { debug: false } },
 *   auth: async (req) => req.headers.get('Authorization') ? ['admin'] : ['public'],
 *   accessGroups: {
 *     public: { description: 'Unauthenticated' },
 *     admin: { description: 'Administrators' },
 *   },
 *   entities: {
 *     User: { description: 'A user account' },
 *   },
 *   functions: {
 *     hello: {
 *       description: 'Say hello',
 *       access: ['public'],
 *       entities: [],
 *       inputs: z.object({ name: z.string() }),
 *       resolver: './resolvers/hello.ts',
 *     },
 *   },
 * });
 * ```
 */

// Main API
export { defineOntology } from "./config/define.js";
export { fieldFrom, userContext } from "./config/categorical.js";
export { startOnt } from "./server/start.js";
export type { StartOntOptions, StartOntResult } from "./server/start.js";

// Types
export type {
  OntologyConfig,
  FunctionDefinition,
  AccessGroupConfig,
  EnvironmentConfig,
  EntityDefinition,
  AuthFunction,
  AuthResult,
  ResolverContext,
  ResolverFunction,
  FieldOption,
} from "./config/types.js";

// Re-export Zod for convenience
export { z } from "zod";
