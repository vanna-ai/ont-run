/**
 * Utility functions for inspecting Zod schemas.
 * These use duck typing to work across Zod 3 and Zod 4.
 */

/**
 * Check if a value is a Zod schema (duck typing to work across bundle boundaries and Zod versions)
 */
export function isZodSchema(val: unknown): boolean {
  if (val === null || typeof val !== "object") return false;
  // Zod 4 uses _zod property
  if ("_zod" in val && "safeParse" in val) return true;
  // Zod 3 uses _def property
  if ("_def" in val && "safeParse" in val) return true;
  return false;
}

/**
 * Get the Zod type name from a schema (works with both Zod 3 and 4)
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
  // Zod 3: check _def.typeName
  if (s._def && typeof s._def === "object") {
    const def = s._def as Record<string, unknown>;
    if (typeof def.typeName === "string") return def.typeName;
  }
  return undefined;
}

/**
 * Check if schema is a ZodObject (works with both Zod 3 and 4)
 */
export function isZodObject(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodObject" || typeName === "object";
}

/**
 * Check if schema is a ZodOptional (works with both Zod 3 and 4)
 */
export function isZodOptional(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodOptional" || typeName === "optional";
}

/**
 * Check if schema is a ZodNullable (works with both Zod 3 and 4)
 */
export function isZodNullable(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodNullable" || typeName === "nullable";
}

/**
 * Check if schema is a ZodArray (works with both Zod 3 and 4)
 */
export function isZodArray(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodArray" || typeName === "array";
}

/**
 * Check if schema is a ZodDefault (works with both Zod 3 and 4)
 */
export function isZodDefault(schema: unknown): boolean {
  const typeName = getZodTypeName(schema);
  return typeName === "ZodDefault" || typeName === "default";
}

/**
 * Get the shape of a ZodObject schema (works with both Zod 3 and 4)
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
  // Zod 3: shape property directly on schema
  if (typeof s.shape === "object" && s.shape !== null) {
    return s.shape as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Get the inner schema from Optional/Nullable/Default (works with both Zod 3 and 4)
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
  // Zod 3: unwrap method or _def.innerType
  if (typeof s.unwrap === "function") {
    return (s.unwrap as () => unknown)();
  }
  if (s._def && typeof s._def === "object") {
    const def = s._def as Record<string, unknown>;
    if (def.innerType) return def.innerType;
  }
  return undefined;
}

/**
 * Get the element schema from a ZodArray (works with both Zod 3 and 4)
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
  // Zod 3: element property directly on schema
  if (s.element) return s.element;
  return undefined;
}
