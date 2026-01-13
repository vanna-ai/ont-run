export { defineOntology } from "./define.js";
export type {
  OntologyConfig,
  FunctionDefinition,
  AccessGroupConfig,
  EnvironmentConfig,
  AuthFunction,
  ResolverContext,
  ResolverFunction,
} from "./types.js";
export {
  OntologyConfigSchema,
  FunctionDefinitionSchema,
  AccessGroupConfigSchema,
  EnvironmentConfigSchema,
  validateAccessGroups,
} from "./schema.js";
