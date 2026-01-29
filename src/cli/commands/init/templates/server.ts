// ============================================================================
// Server Templates
// ============================================================================

export const serverTemplate = `import { createApiApp, createMcpApp, loadConfig } from "ont-run";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { config, configDir, configPath } = await loadConfig();
const env = process.env.NODE_ENV === "production" ? "prod" : "dev";

const api = createApiApp({ config, configDir, configPath, env });
const mcp = await createMcpApp({ config, env });

// In production, serve static files
if (process.env.NODE_ENV === "production") {
  // Serve static files from dist/client
  api.use("/*", serveStatic({ root: "./dist/client" }));
  
  // Fallback to index.html for client-side routing (SPA)
  api.get("/*", (c) => {
    try {
      const html = readFileSync(join(__dirname, "..", "dist", "client", "index.html"), "utf-8");
      return c.html(html);
    } catch (error) {
      return c.text("index.html not found. Run 'npm run build' first.", 404);
    }
  });
}

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: (req) => {
    const url = new URL(req.url);
    
    // Route API requests
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      return api.fetch(req);
    }
    
    // Route MCP requests
    if (url.pathname === "/mcp") {
      return mcp.fetch(req);
    }
    
    // In development, Vite handles frontend
    // In production, serve static files
    if (process.env.NODE_ENV === "production") {
      return api.fetch(req);
    }
    
    // In dev, return helpful message (Vite serves the frontend)
    return new Response("Frontend is served by Vite dev server", { status: 404 });
  },
  port,
});

console.log(\`Server: http://localhost:\${port}\`);
console.log(\`API: http://localhost:\${port}/api\`);
console.log(\`MCP: http://localhost:\${port}/mcp\`);
if (process.env.NODE_ENV !== "production") {
  console.log(\`Frontend: Run 'npm run dev' to start Vite dev server\`);
}
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
