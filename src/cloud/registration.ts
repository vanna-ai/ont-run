import consola from "consola";
import { CloudClient, type RegisterResponse } from "./client.js";
import type { OntologyConfig, CloudConfig } from "../config/types.js";
import { extractOntology, hashOntology } from "../lockfile/hasher.js";

/**
 * Result of cloud registration
 */
export interface RegistrationResult {
  success: boolean;
  hash: string;
  versionId?: string;
  limitReached?: boolean;
  verified: boolean;
  message?: string;
}

/**
 * Get the cloud URL from config
 */
function getCloudUrl(cloudConfig: CloudConfig | boolean | undefined): string | undefined {
  if (typeof cloudConfig === "object" && cloudConfig.url) {
    return cloudConfig.url;
  }
  return undefined;
}

/**
 * Register the ontology with the ont-run.com cloud service.
 *
 * This function:
 * 1. Extracts the ontology definition from config
 * 2. Computes a hash of the ontology
 * 3. Sends it to the cloud for registration
 * 4. Returns the registration result
 *
 * @param config - The ontology configuration
 * @returns Registration result with success status and hash
 *
 * @example
 * ```ts
 * const result = await registerWithCloud(config);
 * if (result.success) {
 *   console.log(`Registered with hash: ${result.hash}`);
 *   if (result.verified) {
 *     console.log('Running in verified mode');
 *   }
 * }
 * ```
 */
export async function registerWithCloud(
  config: OntologyConfig
): Promise<RegistrationResult> {
  // Ensure UUID is present
  if (!config.uuid) {
    throw new Error(
      "Cannot register with cloud: missing uuid in config. Run `ont-run init` to create a project with a UUID."
    );
  }

  // Extract ontology and compute hash
  const ontology = extractOntology(config);
  const hash = hashOntology(ontology);

  // Create client with optional custom URL
  const cloudUrl = getCloudUrl(config.cloud);
  const client = new CloudClient({
    baseUrl: cloudUrl,
  });

  // Register with cloud
  const response = await client.register({
    uuid: config.uuid,
    ontology,
    hash,
  });

  // Determine if verified based on API key presence
  const verified = client.hasApiKey();

  return {
    success: response.success,
    hash: response.hash || hash,
    versionId: response.versionId,
    limitReached: response.limitReached,
    verified,
    message: response.message,
  };
}

/**
 * Attempt cloud registration and log the result.
 * This is a fire-and-forget helper for use in server startup.
 *
 * @param config - The ontology configuration
 * @returns Promise that resolves when registration completes
 */
export async function tryRegisterWithCloud(
  config: OntologyConfig
): Promise<RegistrationResult | null> {
  try {
    const result = await registerWithCloud(config);

    if (result.success) {
      const status = result.verified ? "(verified)" : "(anonymous)";
      consola.success(`Connected to ont-run.com ${status}`);
    }

    if (result.limitReached) {
      consola.warn("Free tier limit reached. Run `npx ont-run login` to upgrade.");
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    consola.warn(`Cloud registration failed: ${message}`);
    return null;
  }
}
