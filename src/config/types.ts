import type { z } from "zod";

/**
 * Configuration for an environment (dev, test, prod)
 */
export interface EnvironmentConfig {
  /** Enable debug mode */
  debug?: boolean;
  /** Any additional environment-specific settings */
  [key: string]: unknown;
}

/**
 * Configuration for an access group
 */
export interface AccessGroupConfig {
  /** Description of this access group */
  description: string;
}

/**
 * Definition of an entity in the ontology
 */
export interface EntityDefinition {
  /** Human-readable description of this entity */
  description: string;
}

/**
 * Option returned by functions used as field sources.
 * Functions referenced by `fieldFrom()` should return an array of these.
 */
export interface FieldOption {
  /** The stored value */
  value: string;
  /** Human-readable label for display */
  label: string;
}

/**
 * Definition of a function in the ontology
 */
export interface FunctionDefinition<
  TGroups extends string = string,
  TEntities extends string = string,
> {
  /** Human-readable description of what this function does */
  description: string;
  /** Which access groups can call this function */
  access: TGroups[];
  /** Which entities this function relates to (use empty array [] if none) */
  entities: TEntities[];
  /** Zod schema for input validation */
  inputs: z.ZodType<unknown>;
  /** Zod schema for output validation/documentation */
  outputs?: z.ZodType<unknown>;
  /** Path to the resolver file (relative to ontology.config.ts) */
  resolver: string;
}

/**
 * Auth function that determines access groups for a request
 */
export type AuthFunction = (req: Request) => Promise<string[]> | string[];

/**
 * The main Ontology configuration object
 */
export interface OntologyConfig<
  TGroups extends string = string,
  TEntities extends string = string,
  TFunctions extends Record<
    string,
    FunctionDefinition<TGroups, TEntities>
  > = Record<string, FunctionDefinition<TGroups, TEntities>>,
> {
  /** Name of this ontology/API */
  name: string;

  /** Environment configurations */
  environments: Record<string, EnvironmentConfig>;

  /** Pluggable auth function */
  auth: AuthFunction;

  /** Access group definitions */
  accessGroups: Record<TGroups, AccessGroupConfig>;

  /** Entity definitions for categorization */
  entities?: Record<TEntities, EntityDefinition>;

  /** Function definitions */
  functions: TFunctions;
}

/**
 * Context passed to resolvers
 */
export interface ResolverContext {
  /** Current environment name */
  env: string;
  /** Environment configuration */
  envConfig: EnvironmentConfig;
  /** Logger instance */
  logger: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
  /** Access groups for the current request */
  accessGroups: string[];
}

/**
 * Resolver function signature
 */
export type ResolverFunction<TArgs = unknown, TResult = unknown> = (
  ctx: ResolverContext,
  args: TArgs
) => Promise<TResult> | TResult;
