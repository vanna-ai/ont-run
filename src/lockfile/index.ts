import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import type { Lockfile, TopologySnapshot } from "./types.js";

export { extractTopology, hashTopology, computeTopologyHash } from "./hasher.js";
export { diffTopology, formatDiffForConsole } from "./differ.js";
export type {
  Lockfile,
  TopologySnapshot,
  TopologyDiff,
  FunctionChange,
  FunctionTopology,
} from "./types.js";

const LOCKFILE_NAME = "ont.lock";
const LOCKFILE_VERSION = 1;

/**
 * Get the lockfile path for a given config directory
 */
export function getLockfilePath(configDir: string): string {
  return join(configDir, LOCKFILE_NAME);
}

/**
 * Check if a lockfile exists
 */
export function lockfileExists(configDir: string): boolean {
  return existsSync(getLockfilePath(configDir));
}

/**
 * Read the lockfile from disk
 * @returns The lockfile contents, or null if it doesn't exist
 */
export async function readLockfile(configDir: string): Promise<Lockfile | null> {
  const path = getLockfilePath(configDir);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = await readFile(path, "utf-8");
    const lockfile = JSON.parse(content) as Lockfile;

    // Validate version
    if (lockfile.version !== LOCKFILE_VERSION) {
      throw new Error(
        `Lockfile version mismatch. Expected ${LOCKFILE_VERSION}, got ${lockfile.version}`
      );
    }

    return lockfile;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse lockfile: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Write a lockfile to disk
 */
export async function writeLockfile(
  configDir: string,
  topology: TopologySnapshot,
  hash: string
): Promise<void> {
  const lockfile: Lockfile = {
    version: LOCKFILE_VERSION,
    hash,
    approvedAt: new Date().toISOString(),
    topology,
  };

  const path = getLockfilePath(configDir);
  const content = JSON.stringify(lockfile, null, 2);

  await writeFile(path, content, "utf-8");
}

/**
 * Check if the current topology matches the lockfile
 * @returns { match: true } if hashes match, or { match: false, lockfile, currentHash } if not
 */
export async function checkLockfile(
  configDir: string,
  currentHash: string
): Promise<
  | { match: true; lockfile: Lockfile }
  | { match: false; lockfile: Lockfile | null; currentHash: string }
> {
  const lockfile = await readLockfile(configDir);

  if (!lockfile) {
    return { match: false, lockfile: null, currentHash };
  }

  if (lockfile.hash === currentHash) {
    return { match: true, lockfile };
  }

  return { match: false, lockfile, currentHash };
}
