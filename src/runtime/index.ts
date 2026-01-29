// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHono = { fetch: (request: Request, ...args: any[]) => Response | Promise<Response> };

/**
 * Check if we're running in Bun
 */
export function isBun(): boolean {
  return typeof (globalThis as any).Bun !== "undefined";
}

/**
 * Check if we're running in Node.js
 */
export function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null &&
    !isBun()
  );
}

/**
 * Get the current runtime name
 */
export function getRuntime(): "bun" | "node" | "unknown" {
  if (isBun()) return "bun";
  if (isNode()) return "node";
  return "unknown";
}

export interface ServerHandle {
  port: number;
  stop: () => void | Promise<void>;
}

/**
 * Start an HTTP server using the appropriate runtime
 */
export async function serve(
  app: AnyHono,
  port: number
): Promise<ServerHandle> {
  if (isBun()) {
    // Bun runtime - use Bun.serve
    const BunGlobal = (globalThis as any).Bun;
    const server = BunGlobal.serve({
      port,
      fetch: app.fetch,
      // Disable idle timeout for SSE/streaming connections
      idleTimeout: 0,
    });
    return {
      port: server.port ?? port,
      stop: () => server.stop(),
    };
  }

  // Node.js
  const { serve: nodeServe } = await import("@hono/node-server");

  return new Promise((resolve) => {
    const server = nodeServe({
      fetch: app.fetch,
      port,
    }, (info) => {
      resolve({
        port: info.port,
        stop: () => {
          server.close();
        },
      });
    });
  });
}

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(startPort: number = 3456): Promise<number> {
  if (isBun()) {
    // Bun runtime - use Bun.serve
    const BunGlobal = (globalThis as any).Bun;
    for (let port = startPort; port < startPort + 100; port++) {
      try {
        const server = BunGlobal.serve({
          port,
          fetch: () => new Response("test"),
        });
        server.stop();
        return port;
      } catch {
        // Port in use, try next
      }
    }
    throw new Error("Could not find available port");
  }

  // Node.js - use net module to check port availability
  const net = await import("net");

  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port >= startPort + 100) {
        reject(new Error("Could not find available port"));
        return;
      }

      const server = net.createServer();
      server.listen(port, () => {
        server.close(() => resolve(port));
      });
      server.on("error", () => tryPort(port + 1));
    };

    tryPort(startPort);
  });
}
