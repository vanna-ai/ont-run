/**
 * Snapshot of a function's topology (what matters for security review)
 */
export interface FunctionTopology {
  /** Description of the function */
  description: string;
  /** Sorted list of access groups */
  access: string[];
  /** JSON Schema representation of the input schema */
  inputsSchema: Record<string, unknown>;
}

/**
 * Complete topology snapshot of the ontology
 */
export interface TopologySnapshot {
  /** Name of the ontology */
  name: string;
  /** Sorted list of access group names */
  accessGroups: string[];
  /** Function topologies keyed by name */
  functions: Record<string, FunctionTopology>;
}

/**
 * The ont.lock file structure
 */
export interface Lockfile {
  /** Lockfile format version */
  version: number;
  /** SHA256 hash of the topology */
  hash: string;
  /** When this was approved */
  approvedAt: string;
  /** The full topology snapshot */
  topology: TopologySnapshot;
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
}

/**
 * Diff between old and new topology
 */
export interface TopologyDiff {
  /** Whether there are any changes */
  hasChanges: boolean;
  /** Added access groups */
  addedGroups: string[];
  /** Removed access groups */
  removedGroups: string[];
  /** Function changes */
  functions: FunctionChange[];
  /** The new topology (for writing to lockfile on approve) */
  newTopology: TopologySnapshot;
  /** The new hash */
  newHash: string;
}
