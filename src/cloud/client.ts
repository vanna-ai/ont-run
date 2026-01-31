import type { OntologySnapshot } from "../lockfile/types.js";

const DEFAULT_HOSTED_URL = "https://ont-run.com";

/**
 * Response from the register endpoint
 */
export interface RegisterResponse {
  success: boolean;
  hash: string;
  versionId?: string;
  limitReached?: boolean;
  message?: string;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Parameters for chat endpoint
 */
export interface ChatParams {
  uuid: string;
  messages: ChatMessage[];
  /** Optional context about current state */
  context?: Record<string, unknown>;
}

/**
 * Response from chat endpoint
 */
export interface ChatResponse {
  success: boolean;
  message?: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }>;
  limitReached?: boolean;
}

/**
 * Version history entry
 */
export interface VersionEntry {
  id: string;
  hash: string;
  createdAt: string;
  verified: boolean;
  status: "pending" | "approved" | "rejected";
}

/**
 * Response from versions endpoint
 */
export interface VersionsResponse {
  success: boolean;
  versions: VersionEntry[];
}

/**
 * Review action parameters
 */
export interface ReviewParams {
  uuid: string;
  versionId: string;
  action: "approve" | "reject";
  comment?: string;
}

/**
 * Response from review endpoint
 */
export interface ReviewResponse {
  success: boolean;
  message?: string;
}

/**
 * Options for CloudClient
 */
export interface CloudClientOptions {
  /** Override the hosted URL (for testing) */
  baseUrl?: string;
  /** API key for verified access */
  apiKey?: string;
}

/**
 * Client for communicating with ont-run.com hosted services.
 *
 * Handles:
 * - Registering ontology with the cloud
 * - AI chat with tool execution
 * - Version history retrieval
 * - Version approval/rejection
 *
 * @example
 * ```ts
 * const client = new CloudClient();
 *
 * // Register ontology
 * const result = await client.register({
 *   uuid: config.uuid,
 *   ontology,
 *   hash,
 * });
 *
 * // Chat with AI agent
 * const chatResult = await client.chat({
 *   uuid: config.uuid,
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export class CloudClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(options?: CloudClientOptions) {
    this.baseUrl = options?.baseUrl || DEFAULT_HOSTED_URL;
    this.apiKey = options?.apiKey || process.env.ONT_API_KEY;
  }

  /**
   * Get headers for requests, including API key if available
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-ONT-API-KEY"] = this.apiKey;
    }

    return headers;
  }

  /**
   * Register ontology with the cloud service.
   * This is called on server startup to sync the ontology.
   */
  async register(params: {
    uuid: string;
    ontology: OntologySnapshot;
    hash: string;
  }): Promise<RegisterResponse> {
    const response = await fetch(`${this.baseUrl}/api/agent/register`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        uuid: params.uuid,
        ontologyDef: params.ontology,
        hash: params.hash,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Registration failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Send a chat message to the AI agent.
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/agent/chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get version history for a UUID.
   */
  async versions(uuid: string): Promise<VersionsResponse> {
    const response = await fetch(`${this.baseUrl}/api/agent/versions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ uuid }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch versions: ${error}`);
    }

    return response.json();
  }

  /**
   * Approve or reject a version.
   */
  async review(params: ReviewParams): Promise<ReviewResponse> {
    const response = await fetch(`${this.baseUrl}/api/agent/review`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Review failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Check if the client has an API key configured.
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get the base URL for the cloud service.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
