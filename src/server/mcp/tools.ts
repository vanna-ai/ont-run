import { z } from "zod";
import type {
  OntologyConfig,
  FunctionDefinition,
  ResolverContext,
  EnvironmentConfig,
  AuthResult,
  UiConfig,
} from "../../config/types.js";
import { getFieldFromMetadata, getUserContextFields, getOrganizationContextFields, hasUserContextMetadata, hasOrganizationContextMetadata } from "../../config/categorical.js";
import {
  isZodObject,
  isZodOptional,
  isZodNullable,
  isZodArray,
  isZodDefault,
  getObjectShape,
  getInnerSchema,
  getArrayElement,
} from "../../config/zod-utils.js";
import type { Logger } from "../resolver.js";

/**
 * Field reference info for MCP tools
 */
export interface McpFieldReference {
  /** Path to the field in the schema */
  path: string;
  /** Name of the function that provides options */
  functionName: string;
}

/**
 * MCP Tool UI metadata for MCP Apps integration
 */
export interface McpToolUiMeta {
  resourceUri: string;
  config?: UiConfig;
}

/**
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  access: string[];
  entities: string[];
  fieldReferences?: McpFieldReference[];
  /** UI configuration for MCP Apps visualization */
  ui?: McpToolUiMeta;
}

/**
 * Strip userContext fields from a JSON Schema object.
 * These fields are injected at runtime and should not be exposed to callers.
 */
function stripUserContextFromJsonSchema(
  jsonSchema: Record<string, unknown>,
  zodSchema: z.ZodType<unknown>
): Record<string, unknown> {
  // Only strip from object schemas
  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    return jsonSchema;
  }

  // Get userContext field names from the Zod schema
  const userContextFields = getUserContextFields(zodSchema);
  if (userContextFields.length === 0) {
    return jsonSchema;
  }

  // Create a new schema without userContext fields
  const properties = { ...(jsonSchema.properties as Record<string, unknown>) };
  const required = jsonSchema.required
    ? [...(jsonSchema.required as string[])]
    : undefined;

  for (const field of userContextFields) {
    delete properties[field];
    if (required) {
      const idx = required.indexOf(field);
      if (idx !== -1) {
        required.splice(idx, 1);
      }
    }
  }

  return {
    ...jsonSchema,
    properties,
    required: required && required.length > 0 ? required : undefined,
  };
}

/**
 * Strip organizationContext fields from a JSON Schema object.
 * These fields are injected at runtime and should not be exposed to callers.
 */
function stripOrganizationContextFromJsonSchema(
  jsonSchema: Record<string, unknown>,
  zodSchema: z.ZodType<unknown>
): Record<string, unknown> {
  // Only strip from object schemas
  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    return jsonSchema;
  }

  // Get organizationContext field names from the Zod schema
  const orgContextFields = getOrganizationContextFields(zodSchema);
  if (orgContextFields.length === 0) {
    return jsonSchema;
  }

  // Create a new schema without organizationContext fields
  const properties = { ...(jsonSchema.properties as Record<string, unknown>) };
  const required = jsonSchema.required
    ? [...(jsonSchema.required as string[])]
    : undefined;

  for (const field of orgContextFields) {
    delete properties[field];
    if (required) {
      const idx = required.indexOf(field);
      if (idx !== -1) {
        required.splice(idx, 1);
      }
    }
  }

  return {
    ...jsonSchema,
    properties,
    required: required && required.length > 0 ? required : undefined,
  };
}

/**
 * Recursively extract field references from a Zod schema
 */
function extractFieldReferencesForMcp(
  schema: z.ZodType<unknown>,
  path: string = ""
): McpFieldReference[] {
  const results: McpFieldReference[] = [];

  // Check if this schema has fieldFrom metadata
  const metadata = getFieldFromMetadata(schema);
  if (metadata) {
    results.push({
      path: path || "(root)",
      functionName: metadata.functionName,
    });
  }

  // Handle ZodObject - recurse into properties
  if (isZodObject(schema)) {
    const shape = getObjectShape(schema);
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        const fieldPath = path ? `${path}.${key}` : key;
        results.push(
          ...extractFieldReferencesForMcp(value as z.ZodType<unknown>, fieldPath)
        );
      }
    }
  }

  // Handle ZodOptional - unwrap
  if (isZodOptional(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldReferencesForMcp(inner as z.ZodType<unknown>, path));
    }
  }

  // Handle ZodNullable - unwrap
  if (isZodNullable(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldReferencesForMcp(inner as z.ZodType<unknown>, path));
    }
  }

  // Handle ZodArray - recurse into element
  if (isZodArray(schema)) {
    const element = getArrayElement(schema);
    if (element) {
      results.push(...extractFieldReferencesForMcp(element as z.ZodType<unknown>, `${path}[]`));
    }
  }

  // Handle ZodDefault - unwrap
  if (isZodDefault(schema)) {
    const inner = getInnerSchema(schema);
    if (inner) {
      results.push(...extractFieldReferencesForMcp(inner as z.ZodType<unknown>, path));
    }
  }

  return results;
}

/**
 * Generate MCP tool definitions from ontology config
 */
export function generateMcpTools(config: OntologyConfig): McpTool[] {
  const tools: McpTool[] = [];

  for (const [name, fn] of Object.entries(config.functions)) {
    // Skip functions that should not be included in MCP listTools
    if (!fn.includeInMcpListTools) {
      continue;
    }

    // Convert Zod schema to JSON Schema for MCP
    let inputSchema: Record<string, unknown>;
    try {
      inputSchema = z.toJSONSchema(fn.inputs, {
        reused: "inline",
        unrepresentable: "any",
      }) as Record<string, unknown>;
      // Remove $schema key if present
      delete inputSchema.$schema;
      // Strip userContext fields - these are injected at runtime
      inputSchema = stripUserContextFromJsonSchema(inputSchema, fn.inputs);
      // Strip organizationContext fields - these are also injected at runtime
      inputSchema = stripOrganizationContextFromJsonSchema(inputSchema, fn.inputs);
    } catch {
      inputSchema = { type: "object", properties: {} };
    }

    // Convert output schema to JSON Schema for MCP
    let outputSchema: Record<string, unknown> | undefined;
    try {
      outputSchema = z.toJSONSchema(fn.outputs, {
        reused: "inline",
        unrepresentable: "any",
      }) as Record<string, unknown>;
      delete outputSchema.$schema;
    } catch {
      outputSchema = undefined;
    }

    // Extract field references
    const fieldReferences = extractFieldReferencesForMcp(fn.inputs);

    // Build UI metadata if ui is enabled
    let ui: McpToolUiMeta | undefined;
    if (fn.ui) {
      const uiConfig = typeof fn.ui === "boolean" ? undefined : fn.ui;
      ui = {
        resourceUri: `ui://ont-visualizer/${name}`,
        config: uiConfig,
      };
    }

    tools.push({
      name,
      description: fn.description,
      inputSchema,
      outputSchema,
      access: fn.access,
      entities: fn.entities,
      fieldReferences:
        fieldReferences.length > 0 ? fieldReferences : undefined,
      ui,
    });
  }

  return tools;
}

/**
 * Filter tools by access groups
 */
export function filterToolsByAccess(
  tools: McpTool[],
  accessGroups: string[]
): McpTool[] {
  return tools.filter((tool) =>
    tool.access.some((group) => accessGroups.includes(group))
  );
}

/**
 * Create a tool executor function that accepts per-request auth result
 */
export function createToolExecutor(
  config: OntologyConfig,
  env: string,
  envConfig: EnvironmentConfig,
  logger: Logger
) {
  // Pre-compute userContext fields for each function
  const userContextFieldsCache = new Map<string, string[]>();
  const orgContextFieldsCache = new Map<string, string[]>();
  for (const [name, fn] of Object.entries(config.functions)) {
    userContextFieldsCache.set(name, getUserContextFields(fn.inputs));
    orgContextFieldsCache.set(name, getOrganizationContextFields(fn.inputs));
  }

  return async (toolName: string, args: unknown, authResult: AuthResult): Promise<unknown> => {
    const fn = config.functions[toolName];

    if (!fn) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Check access using per-request access groups
    const hasAccess = fn.access.some((group) =>
      authResult.groups.includes(group)
    );

    if (!hasAccess) {
      throw new Error(
        `Access denied to tool "${toolName}". Requires: ${fn.access.join(", ")}`
      );
    }

    // Inject user context if function requires it
    const userContextFields = userContextFieldsCache.get(toolName) || [];
    let argsWithContext = args;
    if (userContextFields.length > 0 && authResult.user) {
      argsWithContext = { ...(args as Record<string, unknown>) };
      for (const field of userContextFields) {
        (argsWithContext as Record<string, unknown>)[field] = authResult.user;
      }
    }

    // Inject organization context if function requires it
    const orgContextFields = orgContextFieldsCache.get(toolName) || [];
    if (orgContextFields.length > 0 && authResult.organization) {
      argsWithContext = { ...(argsWithContext as Record<string, unknown>) };
      for (const field of orgContextFields) {
        (argsWithContext as Record<string, unknown>)[field] = authResult.organization;
      }
    }

    // Validate input
    const parsed = fn.inputs.safeParse(argsWithContext);
    if (!parsed.success) {
      throw new Error(
        `Invalid input for tool "${toolName}": ${parsed.error.message}`
      );
    }

    // Create resolver context with per-request access groups
    const resolverContext: ResolverContext = {
      env,
      envConfig,
      logger,
      accessGroups: authResult.groups,
    };

    // Execute resolver
    const result = await fn.resolver(resolverContext, parsed.data);

    // Validate output against schema (dev mode warning)
    const validated = fn.outputs.safeParse(result);
    if (!validated.success) {
      logger.warn(
        `Resolver "${toolName}" returned value that doesn't match outputs schema:`,
        validated.error.issues
      );
    }

    return result;
  };
}
