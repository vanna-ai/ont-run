// ============================================================================
// Server Templates
// ============================================================================

export const serverTemplate = `import { createApiApp, createMcpApp, loadConfig } from "ont-run";
// HTML import - Bun's bundler will transpile TSX/CSS automatically
import index from "./index.html";

const { config, configDir, configPath } = await loadConfig();
const env = process.env.NODE_ENV === "production" ? "prod" : "dev";

const api = createApiApp({ config, configDir, configPath, env });
const mcp = await createMcpApp({ config, env });

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    // HTML route - Bun handles bundling and transpilation
    "/": index,
    // API routes (wildcard must come before SPA fallback)
    "/api/*": (req: Request) => api.fetch(req),
    // Health check
    "/health": (req: Request) => api.fetch(req),
    // MCP endpoint (POST for JSON-RPC, GET for SSE)
    "/mcp": (req: Request) => mcp.fetch(req),
    // SPA fallback - serve index.html for client-side routing
    "/*": index,
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
