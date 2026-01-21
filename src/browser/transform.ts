import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { OntologyConfig } from "../config/types.js";
import { getFieldFromMetadata } from "../config/categorical.js";

export type NodeType = "entity" | "function" | "accessGroup";
export type EdgeType = "operates-on" | "requires-access" | "depends-on";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  metadata: {
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    resolver?: string;
    functionCount?: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    ontologyName: string;
    totalFunctions: number;
    totalEntities: number;
    totalAccessGroups: number;
  };
}

interface FieldReference {
  path: string;
  functionName: string;
}

/**
 * Recursively extract fieldFrom references from a Zod schema
 */
function extractFieldReferences(
  schema: z.ZodType<unknown>,
  path: string = ""
): FieldReference[] {
  const results: FieldReference[] = [];

  const metadata = getFieldFromMetadata(schema);
  if (metadata) {
    results.push({
      path: path || "(root)",
      functionName: metadata.functionName,
    });
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const fieldPath = path ? `${path}.${key}` : key;
      results.push(
        ...extractFieldReferences(value as z.ZodType<unknown>, fieldPath)
      );
    }
  }

  if (schema instanceof z.ZodOptional) {
    results.push(...extractFieldReferences(schema.unwrap(), path));
  }

  if (schema instanceof z.ZodNullable) {
    results.push(...extractFieldReferences(schema.unwrap(), path));
  }

  if (schema instanceof z.ZodArray) {
    results.push(...extractFieldReferences(schema.element, `${path}[]`));
  }

  if (schema instanceof z.ZodDefault) {
    results.push(...extractFieldReferences(schema._def.innerType, path));
  }

  return results;
}

/**
 * Convert Zod schema to JSON Schema safely
 */
function safeZodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> | undefined {
  try {
    const result = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
    delete result.$schema;
    return result;
  } catch {
    return { type: "unknown" };
  }
}

/**
 * Transform OntologyConfig into graph data for visualization
 */
export function transformToGraphData(config: OntologyConfig): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Track function counts for access groups and entities
  const accessGroupCounts: Record<string, number> = {};
  const entityCounts: Record<string, number> = {};

  // Initialize counts
  for (const groupName of Object.keys(config.accessGroups)) {
    accessGroupCounts[groupName] = 0;
  }
  if (config.entities) {
    for (const entityName of Object.keys(config.entities)) {
      entityCounts[entityName] = 0;
    }
  }

  // Create function nodes and count relationships
  for (const [name, fn] of Object.entries(config.functions)) {
    // Count access group usage
    for (const group of fn.access) {
      accessGroupCounts[group] = (accessGroupCounts[group] || 0) + 1;
    }

    // Count entity usage
    for (const entity of fn.entities) {
      entityCounts[entity] = (entityCounts[entity] || 0) + 1;
    }

    // Create function node
    nodes.push({
      id: `function:${name}`,
      type: "function",
      label: name,
      description: fn.description,
      metadata: {
        inputs: safeZodToJsonSchema(fn.inputs),
        outputs: fn.outputs ? safeZodToJsonSchema(fn.outputs) : undefined,
        resolver: fn.resolver,
      },
    });

    // Create edges: function -> access groups
    for (const group of fn.access) {
      edges.push({
        id: `function:${name}->accessGroup:${group}`,
        source: `function:${name}`,
        target: `accessGroup:${group}`,
        type: "requires-access",
      });
    }

    // Create edges: function -> entities
    for (const entity of fn.entities) {
      edges.push({
        id: `function:${name}->entity:${entity}`,
        source: `function:${name}`,
        target: `entity:${entity}`,
        type: "operates-on",
      });
    }

    // Create edges: function -> function (fieldFrom dependencies)
    const fieldRefs = extractFieldReferences(fn.inputs);
    for (const ref of fieldRefs) {
      edges.push({
        id: `function:${name}->function:${ref.functionName}:${ref.path}`,
        source: `function:${name}`,
        target: `function:${ref.functionName}`,
        type: "depends-on",
        label: ref.path,
      });
    }
  }

  // Create access group nodes
  for (const [name, group] of Object.entries(config.accessGroups)) {
    nodes.push({
      id: `accessGroup:${name}`,
      type: "accessGroup",
      label: name,
      description: group.description,
      metadata: {
        functionCount: accessGroupCounts[name] || 0,
      },
    });
  }

  // Create entity nodes
  if (config.entities) {
    for (const [name, entity] of Object.entries(config.entities)) {
      nodes.push({
        id: `entity:${name}`,
        type: "entity",
        label: name,
        description: entity.description,
        metadata: {
          functionCount: entityCounts[name] || 0,
        },
      });
    }
  }

  return {
    nodes,
    edges,
    meta: {
      ontologyName: config.name,
      totalFunctions: Object.keys(config.functions).length,
      totalEntities: config.entities ? Object.keys(config.entities).length : 0,
      totalAccessGroups: Object.keys(config.accessGroups).length,
    },
  };
}

/**
 * Search nodes by label or description
 */
export function searchNodes(
  graphData: GraphData,
  query: string
): Array<{ id: string; type: NodeType; label: string; matchType: "label" | "description" }> {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ id: string; type: NodeType; label: string; matchType: "label" | "description" }> = [];

  for (const node of graphData.nodes) {
    if (node.label.toLowerCase().includes(lowerQuery)) {
      results.push({ id: node.id, type: node.type, label: node.label, matchType: "label" });
    } else if (node.description.toLowerCase().includes(lowerQuery)) {
      results.push({ id: node.id, type: node.type, label: node.label, matchType: "description" });
    }
  }

  return results;
}

/**
 * Get detailed node information including connections
 */
export function getNodeDetails(
  graphData: GraphData,
  nodeId: string
): {
  node: GraphNode | null;
  connections: {
    accessGroups: string[];
    entities: string[];
    dependsOn: Array<{ functionName: string; path: string }>;
    dependedOnBy: string[];
    functions: Array<{
      name: string;
      description: string;
      inputs?: Record<string, unknown>;
      outputs?: Record<string, unknown>;
    }>;
  };
} {
  const node = graphData.nodes.find((n) => n.id === nodeId) || null;

  const connections = {
    accessGroups: [] as string[],
    entities: [] as string[],
    dependsOn: [] as Array<{ functionName: string; path: string }>,
    dependedOnBy: [] as string[],
    functions: [] as Array<{
      name: string;
      description: string;
      inputs?: Record<string, unknown>;
      outputs?: Record<string, unknown>;
    }>,
  };

  if (!node) return { node, connections };

  for (const edge of graphData.edges) {
    if (edge.source === nodeId) {
      if (edge.type === "requires-access") {
        connections.accessGroups.push(edge.target.replace("accessGroup:", ""));
      } else if (edge.type === "operates-on") {
        connections.entities.push(edge.target.replace("entity:", ""));
      } else if (edge.type === "depends-on") {
        connections.dependsOn.push({
          functionName: edge.target.replace("function:", ""),
          path: edge.label || "",
        });
      }
    }

    if (edge.target === nodeId) {
      if (edge.type === "depends-on") {
        connections.dependedOnBy.push(edge.source.replace("function:", ""));
      } else if (edge.type === "requires-access" && node.type === "accessGroup") {
        const funcName = edge.source.replace("function:", "");
        const funcNode = graphData.nodes.find((n) => n.id === edge.source);
        if (funcNode) {
          connections.functions.push({
            name: funcName,
            description: funcNode.description,
            inputs: funcNode.metadata.inputs,
            outputs: funcNode.metadata.outputs,
          });
        }
      } else if (edge.type === "operates-on" && node.type === "entity") {
        const funcName = edge.source.replace("function:", "");
        const funcNode = graphData.nodes.find((n) => n.id === edge.source);
        if (funcNode) {
          connections.functions.push({
            name: funcName,
            description: funcNode.description,
            inputs: funcNode.metadata.inputs,
            outputs: funcNode.metadata.outputs,
          });
        }
      }
    }
  }

  return { node, connections };
}
