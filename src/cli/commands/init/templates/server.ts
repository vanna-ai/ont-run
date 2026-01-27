// ============================================================================
// Server Templates
// ============================================================================

export const serverTemplate = `import { createApiApp, createMcpApp, loadConfig } from "ont-run";

const { config, configDir, configPath } = await loadConfig();
const env = process.env.NODE_ENV === "production" ? "prod" : "dev";

const api = createApiApp({ config, configDir, configPath, env });
const mcp = await createMcpApp({ config, env });

// Read index.html for SPA fallback
const indexHtml = await Bun.file(import.meta.dir + "/index.html").text();

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  // Serve static files from src directory in development
  static: {
    "/index.css": new Response(await Bun.file(import.meta.dir + "/index.css").bytes(), {
      headers: { "Content-Type": "text/css" },
    }),
  },
  // Use fetch handler to properly route all HTTP methods
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health") {
      return api.fetch(req);
    }

    // API routes (all methods)
    if (url.pathname.startsWith("/api")) {
      return api.fetch(req);
    }

    // MCP endpoint (all methods - POST for JSON-RPC, GET for SSE)
    if (url.pathname === "/mcp") {
      return mcp.fetch(req);
    }

    // Check if requesting a static file that exists
    if (url.pathname !== "/" && !url.pathname.includes("..")) {
      const filePath = import.meta.dir + url.pathname;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    // Frontend - serve index.html for all other routes (React Router SPA)
    return new Response(indexHtml, {
      headers: { "Content-Type": "text/html" },
    });
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(\`Server: http://localhost:\${server.port}\`);
console.log(\`API: http://localhost:\${server.port}/api\`);
console.log(\`MCP: http://localhost:\${server.port}/mcp\`);
`;

export const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./index.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./frontend.tsx"></script>
</body>
</html>
`;
