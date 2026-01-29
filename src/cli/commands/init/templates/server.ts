// ============================================================================
// Server Templates
// ============================================================================

export const serverTemplate = `import { createApiApp, createMcpApp, loadConfig } from "ont-run";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const { config, configDir, configPath } = await loadConfig();
const env = process.env.NODE_ENV === "production" ? "prod" : "dev";

const api = createApiApp({ config, configDir, configPath, env });
const mcp = await createMcpApp({ config, env });

// Create a combined app
const app = new Hono();

// Mount API and health routes (api includes /health and /api/*)
// IMPORTANT: DO NOT ADD ROUTES HERE. YOU MUST EDIT ontology.config.ts
app.route("/", api);

// Mount MCP endpoint
app.all("/mcp", (c) => mcp.fetch(c.req.raw));

// In production, serve static files from dist/client
if (env === "prod") {
  const { serveStatic } = await import("@hono/node-server/serve-static");
  
  // Serve static files
  app.use("/*", serveStatic({ root: "./dist/client" }));
  
  // Fallback to index.html for client-side routing (SPA)
  app.get("*", serveStatic({ path: "./dist/client/index.html" }));
}

// Start server (both dev and prod)
const port = Number(process.env.PORT) || 3000;
console.log(\`Starting \${env} server on port \${port}...\`);

serve({
  fetch: app.fetch,
  port,
});

console.log(\`✓ Server running at http://localhost:\${port}\`);
console.log(\`✓ API: http://localhost:\${port}/api\`);
console.log(\`✓ MCP: http://localhost:\${port}/mcp\`);
if (env === "dev") {
  console.log(\`✓ Frontend: Run 'npm run dev:vite' in another terminal\`);
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
