import { z } from "zod";
import type { FunctionDefinition, UiConfig } from "./types.js";

/**
 * Extract field names and their types from a Zod schema using the _def structure
 */
function getTypeFromDef(def: any): string {
  if (!def) return "unknown";
  
  // Check the type field first
  if (def.type === "string") return "string";
  if (def.type === "number") return "number";
  if (def.type === "boolean") return "boolean";
  if (def.type === "array") return "array";
  if (def.type === "object") return "object";
  
  return "unknown";
}

/**
 * Extract field names and their types from a Zod schema
 */
function extractSchemaFields(schema: z.ZodType): {
  fields: Record<string, string>;
  isArray: boolean;
  isObject: boolean;
} {
  const rawDef = (schema as any)._def;
  
  // Check if it's an array
  if (rawDef?.type === "array") {
    const elementDef = rawDef.element || rawDef.type;
    if (elementDef && typeof elementDef === "object") {
      const elementType = getTypeFromDef(elementDef._def || elementDef);
      
      // If it's an object array, extract the fields
      if (elementType === "object") {
        const shape = elementDef._def?.shape;
        if (!shape) {
          return { fields: {}, isArray: true, isObject: false };
        }
        
        const shapeObj = typeof shape === "function" ? shape() : shape;
        const fields: Record<string, string> = {};
        
        for (const [key, fieldSchema] of Object.entries(shapeObj)) {
          const fieldDef = (fieldSchema as any)?._def || (fieldSchema as any);
          fields[key] = getTypeFromDef(fieldDef);
        }
        
        return { fields, isArray: true, isObject: true };
      }
    }
    
    return { fields: {}, isArray: true, isObject: false };
  }
  
  return { fields: {}, isArray: false, isObject: false };
}

/**
 * Validate Y-axis field(s) - can be a single string or array of strings
 */
function validateYAxisFields(
  toolName: string,
  fieldName: string,
  yAxis: string | string[] | undefined,
  fields: Record<string, string>
): void {
  if (!yAxis) return;

  const axes = Array.isArray(yAxis) ? yAxis : [yAxis];
  const availableFields = Object.keys(fields).join(", ");

  for (const field of axes) {
    const fieldType = fields[field];
    if (!fieldType) {
      throw new Error(
        `${toolName}: ui.${fieldName} '${field}' not found in outputs schema. Available: ${availableFields}`
      );
    }
    if (fieldType !== "number") {
      throw new Error(
        `${toolName}: ui.${fieldName} '${field}' must be a numeric field, got: ${fieldType}`
      );
    }
  }
}

/**
 * Validate that a function's UI config is compatible with its outputs schema
 */
export function validateUiConfig(toolName: string, tool: FunctionDefinition): void {
  if (!tool.ui || tool.ui === true) {
    // No explicit UI config or auto-detection mode - skip validation
    return;
  }

  const ui = tool.ui as UiConfig;

  // Extract schema information
  const { fields, isArray, isObject } = extractSchemaFields(tool.outputs);

  // Check: is it an array of objects?
  if (!isArray) {
    throw new Error(
      `${toolName}: ui config requires outputs to be an array of objects, got: non-array schema`
    );
  }

  if (!isObject) {
    throw new Error(
      `${toolName}: ui config requires outputs to be an array of objects, got: array of non-objects`
    );
  }

  // Check: does xAxis field exist and is it categorical (string/number)?
  if (ui.xAxis) {
    const xAxisField = fields[ui.xAxis];
    if (!xAxisField) {
      const availableFields = Object.keys(fields).join(", ");
      throw new Error(
        `${toolName}: ui.xAxis '${ui.xAxis}' not found in outputs schema. Available: ${availableFields}`
      );
    }
    if (xAxisField !== "string" && xAxisField !== "number") {
      throw new Error(
        `${toolName}: ui.xAxis '${ui.xAxis}' must be a string or number field, got: ${xAxisField}`
      );
    }
  }

  // Normalize yAxis to leftYAxis for backwards compatibility
  const leftYAxis = ui.leftYAxis || ui.yAxis;

  // Validate leftYAxis fields
  validateYAxisFields(toolName, "leftYAxis", leftYAxis, fields);

  // Validate rightYAxis fields
  validateYAxisFields(toolName, "rightYAxis", ui.rightYAxis, fields);

  // Check: are there numeric fields to visualize?
  const numericFields = Object.entries(fields)
    .filter(([_, type]) => type === "number")
    .map(([name, _]) => name);

  if (numericFields.length === 0) {
    const availableFields = Object.keys(fields).join(", ");
    throw new Error(
      `${toolName}: ui config requires at least one numeric field in outputs, found: ${availableFields}`
    );
  }
}
