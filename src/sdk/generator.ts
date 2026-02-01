import { z } from "zod";
import type { OntologyConfig, FunctionDefinition } from "../config/types.js";
import { getUserContextFields, getOrganizationContextFields } from "../config/categorical.js";

/**
 * Options for SDK generation
 */
export interface GenerateSdkOptions {
  /** The ontology configuration */
  config: OntologyConfig;
  /** Whether to include React hooks (requires react-query or swr) */
  includeReactHooks?: boolean;
  /** Base URL for API calls (default: '/api') */
  baseUrl?: string;
  /** Whether to include fetch interceptor/middleware hooks */
  includeMiddleware?: boolean;
}

/**
 * Generate TypeScript SDK from ontology configuration
 */
export function generateSdk(options: GenerateSdkOptions): string {
  const { config, includeReactHooks = false, baseUrl = '/api', includeMiddleware = true } = options;

  const parts: string[] = [];

  // Header
  parts.push(`/**
 * Auto-generated TypeScript SDK for ${config.name}
 * Generated from ontology configuration
 * 
 * DO NOT EDIT MANUALLY - This file is auto-generated
 */
`);

  // Generate types for each function
  parts.push('// ============================================');
  parts.push('// Types');
  parts.push('// ============================================\n');

  for (const [name, fn] of Object.entries(config.functions)) {
    const typeName = pascalCase(name);
    
    // Generate input type (excluding context fields)
    const inputType = generateTypeFromSchema(fn.inputs, `${typeName}Input`);
    if (inputType) {
      parts.push(inputType);
    }

    // Generate output type
    const outputType = generateTypeFromSchema(fn.outputs, `${typeName}Output`);
    if (outputType) {
      parts.push(outputType);
    }
  }

  // Generate API client
  parts.push('\n// ============================================');
  parts.push('// API Client');
  parts.push('// ============================================\n');

  if (includeMiddleware) {
    parts.push(`export interface ApiClientOptions {
  /** Base URL for API calls */
  baseUrl?: string;
  /** Headers to include in all requests */
  headers?: Record<string, string>;
  /** Fetch implementation (for Node.js or custom environments) */
  fetch?: typeof fetch;
  /** Request interceptor */
  beforeRequest?: (url: string, options: RequestInit) => RequestInit | Promise<RequestInit>;
  /** Response interceptor */
  afterResponse?: (response: Response) => Response | Promise<Response>;
}
`);
  }

  parts.push(`export class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private fetchImpl: typeof fetch;${includeMiddleware ? `
  private beforeRequest?: (url: string, options: RequestInit) => RequestInit | Promise<RequestInit>;
  private afterResponse?: (response: Response) => Response | Promise<Response>;` : ''}

  constructor(options: ${includeMiddleware ? 'ApiClientOptions' : '{ baseUrl?: string; headers?: Record<string, string>; fetch?: typeof fetch }'} = {}) {
    this.baseUrl = options.baseUrl || '${baseUrl}';
    this.headers = options.headers || {};
    this.fetchImpl = options.fetch || fetch;${includeMiddleware ? `
    this.beforeRequest = options.beforeRequest;
    this.afterResponse = options.afterResponse;` : ''}
  }

  private async request<T>(endpoint: string, body?: unknown): Promise<T> {
    const url = \`\${this.baseUrl}/\${endpoint}\`;
    let options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    };
${includeMiddleware ? `
    // Apply request interceptor
    if (this.beforeRequest) {
      options = await this.beforeRequest(url, options);
    }
` : ''}
    const response = await this.fetchImpl(url, options);
${includeMiddleware ? `
    // Apply response interceptor
    const finalResponse = this.afterResponse 
      ? await this.afterResponse(response)
      : response;

    if (!finalResponse.ok) {
      const error = await finalResponse.json().catch(() => ({}));
      throw new Error(error.error || error.message || \`API request failed with status \${finalResponse.status}\`);
    }

    return finalResponse.json();` : `
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || \`API request failed with status \${response.status}\`);
    }

    return response.json();`}
  }
`);

  // Generate method for each function
  for (const [name, fn] of Object.entries(config.functions)) {
    const typeName = pascalCase(name);
    const hasInput = hasNonContextInputs(fn);
    
    parts.push(`
  /**
   * ${fn.description}
   * @access ${fn.access.join(', ')}
   * @entities ${fn.entities.length > 0 ? fn.entities.join(', ') : 'none'}
   */
  async ${name}(${hasInput ? `input: ${typeName}Input` : ''}): Promise<${typeName}Output> {
    return this.request<${typeName}Output>('${name}'${hasInput ? ', input' : ''});
  }`);
  }

  parts.push('\n}\n');

  // Generate default client instance
  parts.push(`// Default client instance
export const api = new ApiClient();
`);

  // Generate React hooks if requested
  if (includeReactHooks) {
    parts.push('\n// ============================================');
    parts.push('// React Hooks (requires @tanstack/react-query)');
    parts.push('// ============================================\n');

    parts.push(`import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';

/**
 * React hooks for ${config.name} API
 */
export const apiHooks = {
`);

    for (const [name, fn] of Object.entries(config.functions)) {
      const typeName = pascalCase(name);
      const hasInput = hasNonContextInputs(fn);
      // Use explicit isReadOnly value if provided, otherwise default to true
      // Note: Functions should explicitly set isReadOnly: false if they mutate data
      const isReadOnly = fn.isReadOnly !== false;

      if (isReadOnly) {
        // Use useQuery for read-only operations
        parts.push(`  /**
   * ${fn.description}
   * @access ${fn.access.join(', ')}
   */
  use${typeName}: (${hasInput ? `input: ${typeName}Input, ` : ''}options?: Omit<UseQueryOptions<${typeName}Output, Error>, 'queryKey' | 'queryFn'>) => 
    useQuery({
      queryKey: ['${name}'${hasInput ? ', input' : ''}],
      queryFn: () => api.${name}(${hasInput ? 'input' : ''}),
      ...options,
    }),
`);
      } else {
        // Use useMutation for mutations
        parts.push(`  /**
   * ${fn.description}
   * @access ${fn.access.join(', ')}
   */
  use${typeName}: (options?: UseMutationOptions<${typeName}Output, Error, ${hasInput ? `${typeName}Input` : 'void'}>) =>
    useMutation({
      mutationFn: ${hasInput ? `(input: ${typeName}Input)` : '()'} => api.${name}(${hasInput ? 'input' : ''}),
      ...options,
    }),
`);
      }
    }

    parts.push('};\n');
  }

  return parts.join('\n');
}

/**
 * Check if a function has non-context inputs
 */
function hasNonContextInputs(fn: FunctionDefinition): boolean {
  const userContextFields = getUserContextFields(fn.inputs);
  const orgContextFields = getOrganizationContextFields(fn.inputs);
  const contextFields = new Set([...userContextFields, ...orgContextFields]);

  // Check if the input schema has any fields beyond context fields
  // Use type assertion for _def since it's not in public API but is stable
  const def = (fn.inputs as any)._def;
  if (def?.typeName === 'ZodObject') {
    const shape = typeof def.shape === 'function' ? def.shape() : def.shape || {};
    const fieldNames = Object.keys(shape);
    return fieldNames.some(name => !contextFields.has(name));
  }

  return true; // Assume there are inputs if we can't introspect
}

/**
 * Generate TypeScript type from Zod schema
 */
function generateTypeFromSchema(schema: z.ZodType, typeName: string): string | null {
  try {
    // Convert Zod schema to JSON schema
    // Note: toJSONSchema is available in Zod 4+
    const toJSONSchemaFn = (schema as any).toJSONSchema;
    if (typeof toJSONSchemaFn !== 'function') {
      throw new Error('toJSONSchema method not available. Zod 4+ is required.');
    }
    
    const jsonSchema = toJSONSchemaFn.call(schema, { reused: 'inline' });
    
    if (!jsonSchema) {
      // Fallback: use generic unknown type
      return `export type ${typeName} = unknown;\n`;
    }

    // Remove context fields from input types
    if (typeName.endsWith('Input')) {
      const userContextFields = getUserContextFields(schema);
      const orgContextFields = getOrganizationContextFields(schema);
      const contextFields = new Set([...userContextFields, ...orgContextFields]);

      if (jsonSchema.type === 'object' && jsonSchema.properties) {
        const props = { ...(jsonSchema.properties as Record<string, any>) };
        const required = jsonSchema.required as string[] | undefined;

        for (const field of contextFields) {
          delete props[field];
        }

        jsonSchema.properties = props as any;
        if (required) {
          jsonSchema.required = required.filter(f => !contextFields.has(f));
        }
      }
    }

    // Generate TypeScript from JSON Schema
    const tsType = jsonSchemaToTypeScript(jsonSchema);
    return `export type ${typeName} = ${tsType};\n`;
  } catch (error) {
    console.warn(`Failed to generate type for ${typeName}:`, error);
    return `export type ${typeName} = unknown;\n`;
  }
}

/**
 * Convert JSON Schema to TypeScript type string
 */
function jsonSchemaToTypeScript(schema: any): string {
  if (!schema) return 'unknown';

  // Handle object types
  if (schema.type === 'object') {
    const props = schema.properties || {};
    const required = new Set(schema.required || []);
    
    const fields = Object.entries(props).map(([key, value]: [string, any]) => {
      const optional = !required.has(key);
      const propType = jsonSchemaToTypeScript(value);
      return `  ${key}${optional ? '?' : ''}: ${propType};`;
    });

    if (fields.length === 0) {
      return 'Record<string, unknown>';
    }

    return `{\n${fields.join('\n')}\n}`;
  }

  // Handle array types
  if (schema.type === 'array') {
    const itemType = jsonSchemaToTypeScript(schema.items || {});
    return `Array<${itemType}>`;
  }

  // Handle union types (anyOf, oneOf)
  if (schema.anyOf || schema.oneOf) {
    const options = schema.anyOf || schema.oneOf;
    return options.map((s: any) => jsonSchemaToTypeScript(s)).join(' | ');
  }

  // Handle enum types
  if (schema.enum) {
    return schema.enum.map((v: any) => JSON.stringify(v)).join(' | ');
  }

  // Handle primitive types
  switch (schema.type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    default: return 'unknown';
  }
}

/**
 * Convert string to PascalCase
 */
function pascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}
