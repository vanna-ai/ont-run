/**
 * Cloud integration for ont-run.com hosted services.
 *
 * This module provides client-side utilities for connecting to the
 * ont-run.com cloud platform, which offers:
 * - AI agent with tool execution
 * - Version history and management
 * - Usage tracking and limits
 *
 * @example
 * ```ts
 * import { CloudClient, registerWithCloud } from 'ont-run/cloud';
 *
 * // Create a client
 * const client = new CloudClient();
 *
 * // Register your ontology on startup
 * const result = await registerWithCloud(config);
 * ```
 */

export {
  CloudClient,
  type CloudClientOptions,
  type RegisterResponse,
  type ChatParams,
  type ChatMessage,
  type ChatResponse,
  type VersionEntry,
  type VersionsResponse,
  type ReviewParams,
  type ReviewResponse,
} from "./client.js";

export {
  registerWithCloud,
  tryRegisterWithCloud,
  type RegistrationResult,
} from "./registration.js";
