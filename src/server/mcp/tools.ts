import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type {
  OntologyConfig,
  FunctionDefinition,
  ResolverContext,
  EnvironmentConfig,
  AuthResult,
} from "../../config/types.js";
import { getFieldFromMetadata, getUserContextFields, hasUserContextMetadata } from "../../config/categorical.js";
import { loadResolver, type Logger } from "../resolver.js";

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
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const fieldPath = path ? `${path}.${key}` : key;
      results.push(
        ...extractFieldReferencesForMcp(value as z.ZodType<unknown>, fieldPath)
      );
    }
  }

  // Handle ZodOptional - unwrap
  if (schema instanceof z.ZodOptional) {
    results.push(...extractFieldReferencesForMcp(schema.unwrap(), path));
  }

  // Handle ZodNullable - unwrap
  if (schema instanceof z.ZodNullable) {
    results.push(...extractFieldReferencesForMcp(schema.unwrap(), path));
  }

  // Handle ZodArray - recurse into element
  if (schema instanceof z.ZodArray) {
    results.push(...extractFieldReferencesForMcp(schema.element, `${path}[]`));
  }

  // Handle ZodDefault - unwrap
  if (schema instanceof z.ZodDefault) {
    results.push(
      ...extractFieldReferencesForMcp(schema._def.innerType, path)
    );
  }

  return results;
}

/**
 * Generate MCP tool definitions from ontology config
 */
export function generateMcpTools(config: OntologyConfig): McpTool[] {
  const tools: McpTool[] = [];

  for (const [name, fn] of Object.entries(config.functions)) {
    // Convert Zod schema to JSON Schema for MCP
    let inputSchema: Record<string, unknown>;
    try {
      inputSchema = zodToJsonSchema(fn.inputs, {
        $refStrategy: "none",
      }) as Record<string, unknown>;
      // Remove $schema key if present
      delete inputSchema.$schema;
      // Strip userContext fields - these are injected at runtime
      inputSchema = stripUserContextFromJsonSchema(inputSchema, fn.inputs);
    } catch {
      inputSchema = { type: "object", properties: {} };
    }

    // Convert output schema if present
    let outputSchema: Record<string, unknown> | undefined;
    if (fn.outputs) {
      try {
        outputSchema = zodToJsonSchema(fn.outputs, {
          $refStrategy: "none",
        }) as Record<string, unknown>;
        delete outputSchema.$schema;
      } catch {
        outputSchema = undefined;
      }
    }

    // Extract field references
    const fieldReferences = extractFieldReferencesForMcp(fn.inputs);

    tools.push({
      name,
      description: fn.description,
      inputSchema,
      outputSchema,
      access: fn.access,
      entities: fn.entities,
      fieldReferences:
        fieldReferences.length > 0 ? fieldReferences : undefined,
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
  configDir: string,
  env: string,
  envConfig: EnvironmentConfig,
  logger: Logger
) {
  // Pre-compute userContext fields for each function
  const userContextFieldsCache = new Map<string, string[]>();
  for (const [name, fn] of Object.entries(config.functions)) {
    userContextFieldsCache.set(name, getUserContextFields(fn.inputs));
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

    // Load and execute resolver
    const resolver = await loadResolver(fn.resolver, configDir);
    return resolver(resolverContext, parsed.data);
  };
}
