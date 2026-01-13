/**
 * Ontology - Ontology-first backends with human-approved AI access & edits
 *
 * @example
 * ```ts
 * import { defineOntology } from 'ont-run';
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
 *   functions: {
 *     hello: {
 *       description: 'Say hello',
 *       access: ['public'],
 *       inputs: z.object({ name: z.string() }),
 *       resolver: './resolvers/hello.ts',
 *     },
 *   },
 * });
 * ```
 */

// Main API
export { defineOntology } from "./config/define.js";

// Types
export type {
  OntologyConfig,
  FunctionDefinition,
  AccessGroupConfig,
  EnvironmentConfig,
  AuthFunction,
  ResolverContext,
  ResolverFunction,
} from "./config/types.js";

// Re-export Zod for convenience
export { z } from "zod";
