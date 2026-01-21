import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../utils/config-loader.js";
import { startBrowserServer } from "../../browser/server.js";

export const browseCommand = defineCommand({
  meta: {
    name: "browse",
    description: "Open visual ontology browser",
  },
  args: {
    port: {
      type: "string",
      description: "Port to run on (default: auto-select)",
      required: false,
    },
    "no-open": {
      type: "boolean",
      description: "Do not open browser automatically",
      default: false,
    },
  },
  async run({ args }) {
    try {
      consola.info("Loading ontology config...");
      const { config } = await loadConfig();

      consola.info(`Starting browser for "${config.name}"...`);

      const port = args.port ? parseInt(args.port, 10) : undefined;

      await startBrowserServer({
        config,
        port,
        openBrowser: !args["no-open"],
      });
    } catch (error) {
      consola.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  },
});
