import { defineCommand } from "citty";
import consola from "consola";
import { findConfigFile } from "../utils/config-loader.js";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";

export const generateSdkCommand = defineCommand({
  meta: {
    name: "generate-sdk",
    description: "Generate TypeScript SDK from ontology configuration",
  },
  args: {
    output: {
      type: "string",
      description: "Output file path for the generated SDK (default: ./src/generated/api.ts)",
      alias: "o",
    },
    "react-hooks": {
      type: "boolean",
      description: "Include React Query hooks in the generated SDK",
      default: false,
    },
    "base-url": {
      type: "string",
      description: "Base URL for API calls (default: /api)",
      default: "/api",
    },
    "no-middleware": {
      type: "boolean",
      description: "Exclude request/response interceptor support",
      default: false,
    },
  },
  async run({ args }) {
    try {
      // Find config file
      const configPath = findConfigFile();
      if (!configPath) {
        consola.error("Could not find ontology.config.ts in current directory or parent directories");
        process.exit(1);
      }

      // Provide instructions for users to run the SDK generator
      consola.info("To generate TypeScript SDK from your ontology:");
      consola.info("");
      consola.info("Create a script (e.g. scripts/generate-sdk.ts):");
      consola.info("");
      consola.box(
`import { generateSdk } from 'ont-run';
import config from '../ontology.config.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const sdkCode = generateSdk({
  config,
  includeReactHooks: ${args["react-hooks"]},
  baseUrl: '${args["base-url"]}',
  includeMiddleware: ${!args["no-middleware"]},
});

const outputPath = '${args.output || './src/generated/api.ts'}';
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sdkCode, 'utf-8');
console.log('✓ SDK generated at', outputPath);`
      );
      consola.info("");
      consola.info("Then run:");
      consola.info(`  npx tsx scripts/generate-sdk.ts`);
      consola.info("");
      consola.info("Or add to package.json scripts:");
      consola.info(`  "generate-sdk": "tsx scripts/generate-sdk.ts"`);

    } catch (error) {
      consola.error("Error:", error);
      process.exit(1);
    }
  },
});

