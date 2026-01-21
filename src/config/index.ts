export { defineOntology } from "./define.js";
export { fieldFrom } from "./categorical.js";
export type {
  OntologyConfig,
  FunctionDefinition,
  AccessGroupConfig,
  EnvironmentConfig,
  EntityDefinition,
  AuthFunction,
  ResolverContext,
  ResolverFunction,
  FieldOption,
} from "./types.js";
export {
  OntologyConfigSchema,
  FunctionDefinitionSchema,
  AccessGroupConfigSchema,
  EnvironmentConfigSchema,
  EntityDefinitionSchema,
  validateAccessGroups,
  validateEntityReferences,
  validateFieldFromReferences,
} from "./schema.js";
