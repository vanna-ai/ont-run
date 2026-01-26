import index from "./index.html";
import { createApiApp, loadConfig } from "ont-run";

const { config } = await loadConfig();
const api = createApiApp({ config, env: process.env.NODE_ENV === "production" ? "prod" : "dev" });

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

console.log(`Server: http://localhost:${server.port}`);
console.log(`API: http://localhost:${server.port}/api`);
