import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../utils/config-loader.js";
import {
  computeTopologyHash,
  readLockfile,
  diffTopology,
  formatDiffForConsole,
  writeLockfile,
} from "../../lockfile/index.js";
import { startReviewServer } from "../../review/server.js";

export const reviewCommand = defineCommand({
  meta: {
    name: "review",
    description: "Review and approve topology changes",
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

      // Compute current topology
      const { topology: newTopology, hash: newHash } = computeTopologyHash(config);

      // Load existing lockfile
      const lockfile = await readLockfile(configDir);
      const oldTopology = lockfile?.topology || null;

      // Compute diff
      const diff = diffTopology(oldTopology, newTopology);

      if (!diff.hasChanges) {
        consola.success("No topology changes detected.");

        if (!lockfile) {
          // First time - write the lockfile
          consola.info("Writing initial lockfile...");
          await writeLockfile(configDir, newTopology, newHash);
          consola.success("Created ont.lock");
        }

        return;
      }

      // Print diff to console
      console.log("\n" + formatDiffForConsole(diff) + "\n");

      if (args["print-only"]) {
        process.exit(diff.hasChanges ? 1 : 0);
      }

      if (args["auto-approve"]) {
        consola.info("Auto-approving changes...");
        await writeLockfile(configDir, newTopology, newHash);
        consola.success("Changes approved. Lockfile updated.");
        return;
      }

      // Start review server
      consola.info("Starting review UI...");
      const result = await startReviewServer({
        diff,
        configDir,
      });

      if (result.approved) {
        consola.success("Changes approved. Lockfile updated.");
        process.exit(0);
      } else {
        consola.warn("Changes rejected.");
        process.exit(1);
      }
    } catch (error) {
      consola.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  },
});
