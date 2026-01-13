import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../utils/config-loader.js";
import {
  computeTopologyHash,
  checkLockfile,
  lockfileExists,
} from "../../lockfile/index.js";
import { createApiApp } from "../../server/api/index.js";
import { startMcpServer } from "../../server/mcp/index.js";
import { serve, getRuntime } from "../../runtime/index.js";

export const startCommand = defineCommand({
  meta: {
    name: "start",
    description: "Start the API and MCP servers",
  },
  args: {
    env: {
      type: "string",
      description: "Environment to use",
      default: "dev",
    },
    port: {
      type: "string",
      description: "Port for API server",
      default: "3000",
    },
    "mcp-access": {
      type: "string",
      description: "Comma-separated access groups for MCP (default: admin)",
      default: "admin",
    },
    "api-only": {
      type: "boolean",
      description: "Only start the API server (no MCP)",
      default: false,
    },
    "mcp-only": {
      type: "boolean",
      description: "Only start the MCP server (no API)",
      default: false,
    },
  },
  async run({ args }) {
    try {
      // Load config
      consola.info("Loading ontology config...");
      const { config, configDir } = await loadConfig();

      // Check lockfile
      consola.info("Checking lockfile...");
      const { topology, hash } = computeTopologyHash(config);

      if (!lockfileExists(configDir)) {
        consola.error("No ont.lock file found.");
        consola.error("Run `ont-run review` to approve the initial topology.");
        process.exit(1);
      }

      const lockfileCheck = await checkLockfile(configDir, hash);

      if (!lockfileCheck.match) {
        consola.error("Topology has changed since last review.");
        consola.error("");
        consola.error("The ontology structure (functions, access groups, or inputs)");
        consola.error("has been modified. This requires explicit approval.");
        consola.error("");
        consola.error("Run `ont-run review` to review and approve the changes.");
        process.exit(1);
      }

      consola.success("Lockfile verified");

      const port = parseInt(args.port, 10);
      const mcpAccessGroups = args["mcp-access"].split(",").map((s) => s.trim());

      // Start API server
      if (!args["mcp-only"]) {
        const api = createApiApp({
          config,
          configDir,
          env: args.env,
        });

        const server = await serve(api, port);

        consola.success(`API server running at http://localhost:${server.port}`);
        consola.info(`Environment: ${args.env}`);
        consola.info(`Functions: ${Object.keys(config.functions).length}`);
        console.log("");
        consola.info("Available endpoints:");
        for (const name of Object.keys(config.functions)) {
          console.log(`  POST /api/${name}`);
        }
        console.log("");
      }

      // Start MCP server
      if (!args["api-only"]) {
        consola.info(`Starting MCP server with access groups: ${mcpAccessGroups.join(", ")}`);

        // MCP server runs on stdio, so it blocks
        await startMcpServer({
          config,
          configDir,
          env: args.env,
          accessGroups: mcpAccessGroups,
        });
      } else {
        // Keep the process alive for API only
        consola.info("Press Ctrl+C to stop");
        await new Promise(() => {}); // Wait forever
      }
    } catch (error) {
      consola.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  },
});
