import { existsSync } from "fs";
import { join, dirname, resolve } from "path";
import type { OntologyConfig } from "../../config/types.js";

const CONFIG_FILENAMES = ["ontology.config.ts", "ontology.config.js"];

/**
 * Find the ontology config file in the given directory or its parents
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = resolve(startDir);

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Load the ontology config from a file
 */
export async function loadConfig(configPath?: string): Promise<{
  config: OntologyConfig;
  configDir: string;
  configPath: string;
}> {
  // Find config file if not provided
  const resolvedPath = configPath || findConfigFile();

  if (!resolvedPath) {
    throw new Error(
      "Could not find ontology.config.ts in current directory or any parent directory.\n" +
        "Run `ont init` to create a new project."
    );
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const configDir = dirname(resolvedPath);

  try {
    // Dynamic import the config
    const module = await import(resolvedPath);
    const config = module.default as OntologyConfig;

    if (!config || typeof config !== "object") {
      throw new Error(
        "Config file must export a default object created with defineOntology()"
      );
    }

    if (!config.name || !config.functions) {
      throw new Error(
        "Invalid config: missing required fields (name, functions)"
      );
    }

    return { config, configDir, configPath: resolvedPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`Failed to load config: ${resolvedPath}`);
    }
    throw error;
  }
}
