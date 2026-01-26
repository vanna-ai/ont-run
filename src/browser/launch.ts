import type { OntologyConfig } from "../config/types.js";
import type { OntologyDiff } from "../lockfile/types.js";

export interface LaunchReviewOptions {
  config: OntologyConfig;
  diff: OntologyDiff;
  configDir: string;
  configPath?: string;
}

/**
 * Launch the review UI in the background (non-blocking).
 *
 * This is a fire-and-forget function that starts the browser server
 * and opens the review UI without blocking the caller. Useful for
 * auto-launching the review UI when ontology changes are detected
 * in dev mode.
 *
 * @example
 * ```ts
 * // Auto-launch review UI when changes are detected
 * if (diff.hasChanges && isDev) {
 *   launchReviewInBackground({ config, diff, configDir });
 * }
 * ```
 */
export async function launchReviewInBackground(options: LaunchReviewOptions): Promise<void> {
  const { config, diff, configDir, configPath } = options;

  try {
    // Dynamic import to avoid bundling browser UI code when not needed
    const { startBrowserServer } = await import("./server.js");

    // Start browser server in background mode (resolves immediately)
    await startBrowserServer({
      config,
      diff,
      configDir,
      configPath,
      background: true,
      openBrowser: true,
    });
  } catch (error) {
    // Fire-and-forget: log errors but don't crash the server
    console.error("Failed to launch review UI:", error instanceof Error ? error.message : error);
  }
}
