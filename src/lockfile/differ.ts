import type {
  OntologySnapshot,
  OntologyDiff,
  FunctionChange,
} from "./types.js";
import { hashOntology } from "./hasher.js";

/**
 * Compare two ontology snapshots and generate a diff.
 * @param oldOntology - The previous ontology (from lockfile), or null if first run
 * @param newOntology - The current ontology (from config)
 */
export function diffOntology(
  oldOntology: OntologySnapshot | null,
  newOntology: OntologySnapshot
): OntologyDiff {
  const newHash = hashOntology(newOntology);

  // First run - no old ontology
  if (!oldOntology) {
    const functions: FunctionChange[] = Object.entries(
      newOntology.functions
    ).map(([name, fn]) => ({
      name,
      type: "added" as const,
      newAccess: fn.access,
      newDescription: fn.description,
      newEntities: fn.entities,
    }));

    return {
      hasChanges: true,
      addedGroups: newOntology.accessGroups,
      removedGroups: [],
      addedEntities: newOntology.entities ?? [],
      removedEntities: [],
      functions,
      newOntology,
      newHash,
    };
  }

  // Compare access groups
  const oldGroupSet = new Set(oldOntology.accessGroups);
  const newGroupSet = new Set(newOntology.accessGroups);

  const addedGroups = newOntology.accessGroups.filter(
    (g) => !oldGroupSet.has(g)
  );
  const removedGroups = oldOntology.accessGroups.filter(
    (g) => !newGroupSet.has(g)
  );

  // Compare entities
  const oldEntitySet = new Set(oldOntology.entities ?? []);
  const newEntitySet = new Set(newOntology.entities ?? []);

  const addedEntities = (newOntology.entities ?? []).filter(
    (e) => !oldEntitySet.has(e)
  );
  const removedEntities = (oldOntology.entities ?? []).filter(
    (e) => !newEntitySet.has(e)
  );

  // Compare functions
  const functions: FunctionChange[] = [];
  const oldFnNames = new Set(Object.keys(oldOntology.functions));
  const newFnNames = new Set(Object.keys(newOntology.functions));

  // Added functions
  for (const name of newFnNames) {
    if (!oldFnNames.has(name)) {
      const fn = newOntology.functions[name];
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
      const fn = oldOntology.functions[name];
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
      const oldFn = oldOntology.functions[name];
      const newFn = newOntology.functions[name];

      // Check if anything changed
      const accessChanged =
        JSON.stringify(oldFn.access) !== JSON.stringify(newFn.access);
      const descriptionChanged = oldFn.description !== newFn.description;
      const inputsChanged =
        JSON.stringify(oldFn.inputsSchema) !==
        JSON.stringify(newFn.inputsSchema);
      const outputsChanged =
        JSON.stringify(oldFn.outputsSchema) !==
        JSON.stringify(newFn.outputsSchema);
      const entitiesChanged =
        JSON.stringify(oldFn.entities) !== JSON.stringify(newFn.entities);
      const fieldReferencesChanged =
        JSON.stringify(oldFn.fieldReferences) !==
        JSON.stringify(newFn.fieldReferences);

      if (
        accessChanged ||
        descriptionChanged ||
        inputsChanged ||
        outputsChanged ||
        entitiesChanged ||
        fieldReferencesChanged
      ) {
        functions.push({
          name,
          type: "modified",
          oldAccess: accessChanged ? oldFn.access : undefined,
          newAccess: accessChanged ? newFn.access : undefined,
          oldDescription: descriptionChanged ? oldFn.description : undefined,
          newDescription: descriptionChanged ? newFn.description : undefined,
          inputsChanged: inputsChanged || undefined,
          outputsChanged: outputsChanged || undefined,
          entitiesChanged: entitiesChanged || undefined,
          oldEntities: entitiesChanged ? oldFn.entities : undefined,
          newEntities: entitiesChanged ? newFn.entities : undefined,
          fieldReferencesChanged: fieldReferencesChanged || undefined,
        });
      }
    }
  }

  const hasChanges =
    addedGroups.length > 0 ||
    removedGroups.length > 0 ||
    addedEntities.length > 0 ||
    removedEntities.length > 0 ||
    functions.length > 0;

  return {
    hasChanges,
    addedGroups,
    removedGroups,
    addedEntities,
    removedEntities,
    functions,
    newOntology,
    newHash,
  };
}

/**
 * Format a diff for console output
 */
export function formatDiffForConsole(diff: OntologyDiff): string {
  if (!diff.hasChanges) {
    return "No changes detected.";
  }

  const lines: string[] = ["Ontology changes detected:", ""];

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

  if (diff.addedEntities.length > 0) {
    lines.push("Added entities:");
    for (const entity of diff.addedEntities) {
      lines.push(`  + ${entity}`);
    }
    lines.push("");
  }

  if (diff.removedEntities.length > 0) {
    lines.push("Removed entities:");
    for (const entity of diff.removedEntities) {
      lines.push(`  - ${entity}`);
    }
    lines.push("");
  }

  if (diff.functions.length > 0) {
    lines.push("Function changes:");
    for (const fn of diff.functions) {
      if (fn.type === "added") {
        lines.push(`  + ${fn.name}`);
        lines.push(`    Access: [${fn.newAccess?.join(", ")}]`);
        if (fn.newEntities && fn.newEntities.length > 0) {
          lines.push(`    Entities: [${fn.newEntities.join(", ")}]`);
        }
      } else if (fn.type === "removed") {
        lines.push(`  - ${fn.name}`);
      } else {
        lines.push(`  ~ ${fn.name}`);
        if (fn.oldAccess && fn.newAccess) {
          lines.push(
            `    Access: [${fn.oldAccess.join(", ")}] -> [${fn.newAccess.join(", ")}]`
          );
        }
        if (fn.oldEntities && fn.newEntities) {
          lines.push(
            `    Entities: [${fn.oldEntities.join(", ")}] -> [${fn.newEntities.join(", ")}]`
          );
        }
        if (fn.inputsChanged) {
          lines.push(`    Inputs: schema changed`);
        }
        if (fn.outputsChanged) {
          lines.push(`    Outputs: schema changed`);
        }
        if (fn.fieldReferencesChanged) {
          lines.push(`    Field references: changed`);
        }
      }
    }
  }

  return lines.join("\n");
}
