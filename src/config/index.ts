export { defineOntology } from "./define.js";
export { fieldFrom, userContext } from "./categorical.js";
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
  validateUserContextRequirements,
} from "./schema.js";
