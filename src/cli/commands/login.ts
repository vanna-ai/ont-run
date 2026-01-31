import { defineCommand } from "citty";
import consola from "consola";
import open from "open";
import { loadConfig } from "../utils/config-loader.js";

const DEFAULT_HOSTED_URL = "https://ont-run.com";

/**
 * Get the cloud URL from config
 */
function getCloudUrl(cloudConfig: boolean | { url?: string } | undefined): string {
  if (typeof cloudConfig === "object" && cloudConfig.url) {
    return cloudConfig.url;
  }
  return DEFAULT_HOSTED_URL;
}

export const loginCommand = defineCommand({
  meta: {
    name: "login",
    description: "Login to ont-run.com to claim your UUID and get an API key",
  },
  args: {
    uuid: {
      type: "string",
      description: "Override UUID (uses config uuid by default)",
    },
  },
  async run({ args }) {
    try {
      // Try to load config to get UUID
      let uuid: string | undefined = args.uuid;
      let cloudUrl = DEFAULT_HOSTED_URL;

      if (!uuid) {
        try {
          const { config } = await loadConfig();
          uuid = config.uuid;
          cloudUrl = getCloudUrl(config.cloud);
        } catch {
          // Config not found, that's ok if uuid was provided as arg
        }
      }

      if (!uuid) {
        consola.error("No UUID found.");
        consola.info("Either:");
        consola.info("  1. Run `npx ont-run init` to create a project with a UUID");
        consola.info("  2. Provide a UUID with: npx ont-run login --uuid <your-uuid>");
        process.exit(1);
      }

      // Build the claim URL
      const loginUrl = `${cloudUrl}/claim?uuid=${encodeURIComponent(uuid)}`;

      consola.info(`Opening browser to claim UUID: ${uuid}`);
      consola.info(`URL: ${loginUrl}\n`);

      // Open browser
      await open(loginUrl);

      // Show instructions
      consola.box(`
After logging in on ont-run.com:

1. Generate an API key for your UUID
2. Add it to your .env file:

   ONT_API_KEY=your-api-key-here

3. Restart your dev server

Your ontology will then run in verified mode with higher limits.
      `.trim());
    } catch (error) {
      consola.error(error instanceof Error ? error.message : "Failed to open browser");
      process.exit(1);
    }
  },
});
