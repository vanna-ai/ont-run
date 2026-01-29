import consola from "consola";
import { spawn, type ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { loadConfig } from "../cli/utils/config-loader.js";
import {
  computeOntologyHash,
  readLockfile,
  diffOntology,
  formatDiffForConsole,
  lockfileExists,
} from "../lockfile/index.js";
import { validateUserContextRequirements } from "../config/schema.js";
import { startMcpServer } from "./mcp/index.js";

export interface StartOntOptions {
  /** Port for API server (default: 3000) */
  port?: number;
  /** Port for MCP server (default: 3001) */
  mcpPort?: number;
  /** Environment to use (default: 'dev') */
  env?: string;
  /** Mode: 'development' warns on lockfile issues, 'production' fails. Defaults to 'production' unless NODE_ENV is explicitly 'development'. */
  mode?: "development" | "production";
  /** Set to true to only start the API server */
  apiOnly?: boolean;
  /** Set to true to only start the MCP server */
  mcpOnly?: boolean;
}

export interface StartOntResult {
  api?: { port: number; process: ChildProcess };
  mcp?: { port: number };
}

/**
 * Detect mode from NODE_ENV if not explicitly set.
 * Defaults to 'production' (strict) unless NODE_ENV is explicitly 'development'.
 */
function detectMode(explicit?: "development" | "production"): "development" | "production" {
  if (explicit) return explicit;
  return process.env.NODE_ENV === "development" ? "development" : "production";
}

/**
 * Start the ont API and MCP servers using Go backend.
 *
 * Automatically discovers ontology.config.ts and handles lockfile validation.
 *
 * @example
 * ```ts
 * import { startOnt } from 'ont-run';
 *
 * await startOnt({
 *   port: 3000,
 *   mcpPort: 3001,
 * });
 * ```
 */
export async function startOnt(options: StartOntOptions = {}): Promise<StartOntResult> {
  const {
    port = 3000,
    mcpPort = 3001,
    env = "dev",
    apiOnly = false,
    mcpOnly = false,
  } = options;

  const mode = detectMode(options.mode);
  const isDev = mode === "development";

  // Load config
  consola.info("Loading ontology config...");
  const { config, configDir } = await loadConfig();

  // Validate userContext requirements
  try {
    await validateUserContextRequirements(config);
  } catch (error) {
    consola.error("User context validation failed:");
    throw error;
  }

  // Check lockfile
  consola.info("Checking lockfile...");
  const { ontology, hash } = computeOntologyHash(config);

  if (!lockfileExists(configDir)) {
    const message = `No ont.lock file found.\nRun \`bun run review\` to approve the initial ontology.`;

    if (isDev) {
      consola.warn("No ont.lock file found.");
      consola.warn("Run `npx ont-run review` to approve the initial ontology.\n");
    } else {
      consola.error(message);
      throw new Error("Missing ont.lock file in production mode");
    }
  } else {
    const lockfile = await readLockfile(configDir);
    const oldOntology = lockfile?.ontology || null;
    const diff = diffOntology(oldOntology, ontology);

    if (diff.hasChanges) {
      const message = `Ontology has changed since last review.\nRun \`bun run review\` to approve the changes.`;

      if (isDev) {
        consola.warn("Ontology Lockfile mismatch detected:");
        console.log("\n" + formatDiffForConsole(diff) + "\n");
        consola.warn("Run `npx ont-run review` to approve these changes.\n");
      } else {
        consola.error(message);
        console.log("\n" + formatDiffForConsole(diff) + "\n");
        throw new Error("Ontology Lockfile mismatch in production mode");
      }
    } else {
      consola.success("Ontology Lockfile verified");
    }
  }

  const result: StartOntResult = {};

  // Start Go API server
  if (!mcpOnly) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const serverPath = join(__dirname, "..", "..", "server", "ont-server");

    consola.info("Starting Go backend server...");

    const goProcess = spawn(serverPath, [], {
      env: {
        ...process.env,
        PORT: port.toString(),
        ONT_ENV: env,
      },
      stdio: "inherit",
    });

    goProcess.on("error", (error) => {
      consola.error("Failed to start Go server:", error.message);
      consola.info("Make sure to build the Go server first:");
      consola.info("  cd server && go build -o ont-server main.go");
      throw new Error(`Failed to start Go backend: ${error.message}`);
    });

    goProcess.on("exit", (code) => {
      if (code !== 0) {
        consola.error(`Go server exited with code ${code}`);
      }
    });

    result.api = { port, process: goProcess };

    consola.success(`API server running at http://localhost:${port}`);
    consola.info(`Environment: ${env}`);
    consola.info(`Mode: ${mode}`);
    consola.info(`Functions: ${Object.keys(config.functions).length}`);
    console.log("");
    consola.info("Available endpoints:");
    for (const name of Object.keys(config.functions)) {
      console.log(`  POST /api/${name}`);
    }
    console.log("");
  }

  // Start MCP server
  if (!apiOnly) {
    const mcpServer = await startMcpServer({
      config,
      env,
      port: mcpPort,
    });
    result.mcp = mcpServer;

    consola.success(`MCP server running at http://localhost:${mcpServer.port}/mcp`);
    consola.info(`Auth: per-request (using config.auth)`);
  }

  consola.info("Press Ctrl+C to stop");

  // Handle shutdown
  process.on("SIGINT", () => {
    consola.info("Shutting down...");
    if (result.api) {
      result.api.process.kill();
      // Wait briefly for process to exit
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } else {
      process.exit(0);
    }
  });

  return result;
}
