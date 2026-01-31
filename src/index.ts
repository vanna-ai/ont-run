/**
 * Ontology - Ontology-first backends with human-approved AI access & edits
 *
 * @example
 * ```ts
 * import { defineOntology, fieldFrom } from 'ont-run';
 * import { z } from 'zod';
 * import { hello } from './resolvers/hello.js';
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
 *       resolver: hello,  // Direct function reference for type safety
 *     },
 *   },
 * });
 * ```
 */

// Main API
export { defineOntology, defineFunction } from "./config/define.js";
export { fieldFrom, userContext, organizationContext } from "./config/categorical.js";
export { startOnt } from "./server/start.js";
export type { StartOntOptions, StartOntResult } from "./server/start.js";

// Server utilities for custom server setup
export { createApiApp } from "./server/api/index.js";
export type { ApiServerOptions } from "./server/api/index.js";
export { createMcpApp } from "./server/mcp/index.js";
export type { CreateMcpAppOptions } from "./server/mcp/index.js";
export { loadConfig, findConfigFile } from "./cli/utils/config-loader.js";
export { launchReviewInBackground } from "./browser/launch.js";
export type { LaunchReviewOptions } from "./browser/launch.js";

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
  UiConfig,
} from "./config/types.js";

// Re-export Zod for convenience
export { z } from "zod";
