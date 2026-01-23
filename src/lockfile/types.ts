/**
 * A field that references another function for its options
 */
export interface FieldReference {
  /** Path to the field in the schema, e.g., "status" or "filters.country" */
  path: string;
  /** Name of the function that provides options for this field */
  functionName: string;
}

/**
 * Snapshot of a function's shape (what matters for security review)
 */
export interface FunctionShape {
  /** Description of the function */
  description: string;
  /** Sorted list of access groups */
  access: string[];
  /** Sorted list of entities this function relates to */
  entities: string[];
  /** JSON Schema representation of the input schema */
  inputsSchema: Record<string, unknown>;
  /** JSON Schema representation of the output schema */
  outputsSchema?: Record<string, unknown>;
  /** Fields that reference other functions for their options */
  fieldReferences?: FieldReference[];
  /** Whether this function uses userContext() for row-level access control */
  usesUserContext?: boolean;
}

/**
 * Complete snapshot of the ontology
 */
export interface OntologySnapshot {
  /** Name of the ontology */
  name: string;
  /** Sorted list of access group names */
  accessGroups: string[];
  /** Sorted list of entity names */
  entities?: string[];
  /** Function shapes keyed by name */
  functions: Record<string, FunctionShape>;
}

/**
 * The ont.lock file structure
 */
export interface Lockfile {
  /** Lockfile format version */
  version: number;
  /** SHA256 hash of the ontology */
  hash: string;
  /** When this was approved */
  approvedAt: string;
  /** The full ontology snapshot */
  ontology: OntologySnapshot;
}

/**
 * A single change in a function
 */
export interface FunctionChange {
  name: string;
  type: "added" | "removed" | "modified";
  oldAccess?: string[];
  newAccess?: string[];
  oldDescription?: string;
  newDescription?: string;
  inputsChanged?: boolean;
  outputsChanged?: boolean;
  entitiesChanged?: boolean;
  oldEntities?: string[];
  newEntities?: string[];
  fieldReferencesChanged?: boolean;
  userContextChanged?: boolean;
  usesUserContext?: boolean;
}

/**
 * Diff between old and new ontology
 */
export interface OntologyDiff {
  /** Whether there are any changes */
  hasChanges: boolean;
  /** Added access groups */
  addedGroups: string[];
  /** Removed access groups */
  removedGroups: string[];
  /** Added entities */
  addedEntities: string[];
  /** Removed entities */
  removedEntities: string[];
  /** Function changes */
  functions: FunctionChange[];
  /** The new ontology (for writing to lockfile on approve) */
  newOntology: OntologySnapshot;
  /** The new hash */
  newHash: string;
}
