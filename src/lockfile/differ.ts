import type {
  TopologySnapshot,
  TopologyDiff,
  FunctionChange,
} from "./types.js";
import { hashTopology } from "./hasher.js";

/**
 * Compare two topology snapshots and generate a diff.
 * @param oldTopology - The previous topology (from lockfile), or null if first run
 * @param newTopology - The current topology (from config)
 */
export function diffTopology(
  oldTopology: TopologySnapshot | null,
  newTopology: TopologySnapshot
): TopologyDiff {
  const newHash = hashTopology(newTopology);

  // First run - no old topology
  if (!oldTopology) {
    const functions: FunctionChange[] = Object.entries(newTopology.functions).map(
      ([name, fn]) => ({
        name,
        type: "added" as const,
        newAccess: fn.access,
        newDescription: fn.description,
      })
    );

    return {
      hasChanges: true,
      addedGroups: newTopology.accessGroups,
      removedGroups: [],
      functions,
      newTopology,
      newHash,
    };
  }

  // Compare access groups
  const oldGroupSet = new Set(oldTopology.accessGroups);
  const newGroupSet = new Set(newTopology.accessGroups);

  const addedGroups = newTopology.accessGroups.filter((g) => !oldGroupSet.has(g));
  const removedGroups = oldTopology.accessGroups.filter((g) => !newGroupSet.has(g));

  // Compare functions
  const functions: FunctionChange[] = [];
  const oldFnNames = new Set(Object.keys(oldTopology.functions));
  const newFnNames = new Set(Object.keys(newTopology.functions));

  // Added functions
  for (const name of newFnNames) {
    if (!oldFnNames.has(name)) {
      const fn = newTopology.functions[name];
      functions.push({
        name,
        type: "added",
        newAccess: fn.access,
        newDescription: fn.description,
      });
    }
  }

  // Removed functions
  for (const name of oldFnNames) {
    if (!newFnNames.has(name)) {
      const fn = oldTopology.functions[name];
      functions.push({
        name,
        type: "removed",
        oldAccess: fn.access,
        oldDescription: fn.description,
      });
    }
  }

  // Modified functions
  for (const name of newFnNames) {
    if (oldFnNames.has(name)) {
      const oldFn = oldTopology.functions[name];
      const newFn = newTopology.functions[name];

      // Check if anything changed
      const accessChanged =
        JSON.stringify(oldFn.access) !== JSON.stringify(newFn.access);
      const descriptionChanged = oldFn.description !== newFn.description;
      const inputsChanged =
        JSON.stringify(oldFn.inputsSchema) !== JSON.stringify(newFn.inputsSchema);

      if (accessChanged || descriptionChanged || inputsChanged) {
        functions.push({
          name,
          type: "modified",
          oldAccess: accessChanged ? oldFn.access : undefined,
          newAccess: accessChanged ? newFn.access : undefined,
          oldDescription: descriptionChanged ? oldFn.description : undefined,
          newDescription: descriptionChanged ? newFn.description : undefined,
          inputsChanged: inputsChanged || undefined,
        });
      }
    }
  }

  const hasChanges =
    addedGroups.length > 0 ||
    removedGroups.length > 0 ||
    functions.length > 0;

  return {
    hasChanges,
    addedGroups,
    removedGroups,
    functions,
    newTopology,
    newHash,
  };
}

/**
 * Format a diff for console output
 */
export function formatDiffForConsole(diff: TopologyDiff): string {
  if (!diff.hasChanges) {
    return "No changes detected.";
  }

  const lines: string[] = ["Topology changes detected:", ""];

  if (diff.addedGroups.length > 0) {
    lines.push("Added access groups:");
    for (const group of diff.addedGroups) {
      lines.push(`  + ${group}`);
    }
    lines.push("");
  }

  if (diff.removedGroups.length > 0) {
    lines.push("Removed access groups:");
    for (const group of diff.removedGroups) {
      lines.push(`  - ${group}`);
    }
    lines.push("");
  }

  if (diff.functions.length > 0) {
    lines.push("Function changes:");
    for (const fn of diff.functions) {
      if (fn.type === "added") {
        lines.push(`  + ${fn.name}`);
        lines.push(`    Access: [${fn.newAccess?.join(", ")}]`);
      } else if (fn.type === "removed") {
        lines.push(`  - ${fn.name}`);
      } else {
        lines.push(`  ~ ${fn.name}`);
        if (fn.oldAccess && fn.newAccess) {
          lines.push(`    Access: [${fn.oldAccess.join(", ")}] -> [${fn.newAccess.join(", ")}]`);
        }
        if (fn.inputsChanged) {
          lines.push(`    Inputs: schema changed`);
        }
      }
    }
  }

  return lines.join("\n");
}
