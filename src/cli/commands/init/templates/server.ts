// ============================================================================
// Server Templates
// ============================================================================

export const serverTemplate = `import index from "./index.html";
import { createApiApp, loadConfig } from "ont-run";

const { config, configDir, configPath } = await loadConfig();
const api = createApiApp({
  config,
  configDir,
  configPath,
  env: process.env.NODE_ENV === "production" ? "prod" : "dev",
});

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    "/health": req => api.fetch(req),
    "/api": req => api.fetch(req),
    "/api/*": req => api.fetch(req),
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production",
});

console.log(\`Server: http://localhost:\${server.port}\`);
console.log(\`API: http://localhost:\${server.port}/api\`);
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
