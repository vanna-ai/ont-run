import type { z } from "zod";

/**
 * UI visualization configuration for MCP Apps
 */
export interface UiConfig {
  /** Type of visualization to render */
  type?: "table" | "chart" | "json" | "auto";
  /** Chart type when type is "chart" */
  chartType?: "line" | "bar" | "pie";
  /** Field to use for x-axis in charts */
  xAxis?: string;
  /** Field to use for y-axis in charts */
  yAxis?: string;
}

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

/**
 * Definition of a function in the ontology
 */
export interface FunctionDefinition<
  TGroups extends string = string,
  TEntities extends string = string,
  TInputs extends z.ZodType = z.ZodType<unknown>,
  TOutputs extends z.ZodType = z.ZodType<unknown>,
> {
  /** Human-readable description of what this function does */
  description: string;
  /** Which access groups can call this function */
  access: TGroups[];
  /** Which entities this function relates to (use empty array [] if none) */
  entities: TEntities[];
  /** Zod schema for input validation */
  inputs: TInputs;
  /** Zod schema for output validation */
  outputs: TOutputs;
  /** Resolver function that handles this function's logic */
  resolver: ResolverFunction<z.infer<TInputs>, z.infer<TOutputs>>;
  /** Enable UI visualization via MCP Apps. Set to true for auto-detection or provide config. */
  ui?: boolean | UiConfig;
}

/**
 * Result returned by the auth function
 */
export interface AuthResult {
  /** Access groups for the current request */
  groups: string[];
  /** Optional user identity for row-level access control */
  user?: Record<string, unknown>;
}

/**
 * Auth function that determines access groups for a request.
 * Can return either:
 * - `string[]` - just group names (backwards compatible)
 * - `AuthResult` - groups plus optional user identity
 */
export type AuthFunction = (req: Request) => Promise<string[] | AuthResult> | string[] | AuthResult;

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
