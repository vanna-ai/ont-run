/**
 * Utility functions for inspecting Zod 4 schemas.
 * These use duck typing to work across bundle boundaries.
 */

/**
 * Check if a value is a Zod 3 schema (has _def but not _zod)
 */
export function isZod3Schema(val: unknown): boolean {
  if (val === null || typeof val !== "object") return false;
  // Zod 3 uses _def property without _zod
  if ("_def" in val && "safeParse" in val && !("_zod" in val)) return true;
  return false;
}

/**
 * Check if a value is a Zod schema (duck typing to work across bundle boundaries)
 */
export function isZodSchema(val: unknown): boolean {
  if (val === null || typeof val !== "object") return false;
  // Zod 4 uses _zod property
  if ("_zod" in val && "safeParse" in val) return true;
  return false;
}

/**
 * Get the Zod type name from a schema
 */
export function getZodTypeName(schema: unknown): string | undefined {
  if (!isZodSchema(schema)) return undefined;
  const s = schema as Record<string, unknown>;
  // Zod 4: check _zod.def.typeName
  if (s._zod && typeof s._zod === "object") {
    const zod = s._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (typeof def.typeName === "string") return def.typeName;
    }
  }
  return undefined;
}

/**
 * Check if schema is a ZodObject
 */
export function isZodObject(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodObject";
}

/**
 * Check if schema is a ZodOptional
 */
export function isZodOptional(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodOptional";
}

/**
 * Check if schema is a ZodNullable
 */
export function isZodNullable(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodNullable";
}

/**
 * Check if schema is a ZodArray
 */
export function isZodArray(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodArray";
}

/**
 * Check if schema is a ZodDefault
 */
export function isZodDefault(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodDefault";
}

/**
 * Get the shape of a ZodObject schema
 */
export function getObjectShape(schema: unknown): Record<string, unknown> | undefined {
  if (!isZodObject(schema)) return undefined;
  const s = schema as Record<string, unknown>;
  // Zod 4: shape is in _zod.def.shape
  if (s._zod && typeof s._zod === "object") {
    const zod = s._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.shape && typeof def.shape === "object") {
        return def.shape as Record<string, unknown>;
      }
    }
  }
  return undefined;
}

/**
 * Get the inner schema from Optional/Nullable/Default
 */
export function getInnerSchema(schema: unknown): unknown {
  const s = schema as Record<string, unknown>;
  // Zod 4: innerType is in _zod.def.innerType
  if (s._zod && typeof s._zod === "object") {
    const zod = s._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.innerType) return def.innerType;
    }
  }
  return undefined;
}

/**
 * Get the element schema from a ZodArray
 */
export function getArrayElement(schema: unknown): unknown {
  if (!isZodArray(schema)) return undefined;
  const s = schema as Record<string, unknown>;
  // Zod 4: element is in _zod.def.element
  if (s._zod && typeof s._zod === "object") {
    const zod = s._zod as Record<string, unknown>;
    if (zod.def && typeof zod.def === "object") {
      const def = zod.def as Record<string, unknown>;
      if (def.element) return def.element;
    }
  }
  return undefined;
}
