import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../utils/config-loader.js";
import {
  computeOntologyHash,
  readLockfile,
  diffOntology,
  formatDiffForConsole,
  writeLockfile,
} from "../../lockfile/index.js";
import { startBrowserServer } from "../../browser/server.js";

export const reviewCommand = defineCommand({
  meta: {
    name: "review",
    description: "Review and approve ontology changes",
  },
  args: {
    "auto-approve": {
      type: "boolean",
      description: "Automatically approve changes (for CI/scripts)",
      default: false,
    },
    "print-only": {
      type: "boolean",
      description: "Print diff and exit without prompting",
      default: false,
    },
    cloud: {
      type: "boolean",
      description: "Sync with ont Cloud for team approvals",
      default: false,
    },
  },
  async run({ args }) {
    try {
      // Check for cloud mode
      const cloudToken = process.env.ONT_CLOUD_TOKEN;
      if (args.cloud || cloudToken) {
        consola.info("");
        consola.box(
          "ont Cloud coming soon!\n\n" +
            "Team approvals, audit trails, and compliance reporting.\n\n" +
            "Sign up for early access: https://ont.dev/cloud"
        );
        process.exit(0);
      }

      // Load config
      consola.info("Loading ontology config...");
      const { config, configDir } = await loadConfig();

      // Compute current ontology snapshot
      const { ontology: newOntology, hash: newHash } = computeOntologyHash(config);

      // Load existing lockfile
      const lockfile = await readLockfile(configDir);
      const oldOntology = lockfile?.ontology || null;

      // Compute diff
      const diff = diffOntology(oldOntology, newOntology);

      // Handle print-only mode
      if (args["print-only"]) {
        if (diff.hasChanges) {
          console.log("\n" + formatDiffForConsole(diff) + "\n");
          process.exit(1);
        } else {
          consola.success("No ontology changes detected.");
          process.exit(0);
        }
      }

      // Handle auto-approve mode
      if (args["auto-approve"]) {
        if (diff.hasChanges) {
          console.log("\n" + formatDiffForConsole(diff) + "\n");
          consola.info("Auto-approving changes...");
          await writeLockfile(configDir, newOntology, newHash);
          consola.success("Changes approved. Lockfile updated.");
        } else {
          consola.success("No ontology changes detected.");
          if (!lockfile) {
            consola.info("Writing initial lockfile...");
            await writeLockfile(configDir, newOntology, newHash);
            consola.success("Created ont.lock");
          }
        }
        return;
      }

      // Handle initial lockfile creation (no previous state)
      if (!lockfile && !diff.hasChanges) {
        consola.info("Writing initial lockfile...");
        await writeLockfile(configDir, newOntology, newHash);
        consola.success("Created ont.lock");
      }

      // Print diff summary to console if there are changes
      if (diff.hasChanges) {
        console.log("\n" + formatDiffForConsole(diff) + "\n");
      }

      // Start unified browser/review UI
      consola.info(diff.hasChanges ? "Starting review UI..." : "Starting ontology browser...");
      const result = await startBrowserServer({
        config,
        diff: diff.hasChanges ? diff : null,
        configDir,
      });

      if (diff.hasChanges) {
        if (result.approved) {
          consola.success("Changes approved. Lockfile updated.");
          process.exit(0);
        } else {
          consola.warn("Changes rejected.");
          process.exit(1);
        }
      }
    } catch (error) {
      consola.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  },
});
