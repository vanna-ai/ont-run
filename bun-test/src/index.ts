import { serve } from "bun";
import index from "./index.html";
import { handleLogin, handleLogout, handleMe } from "./auth/routes";
import { handleChat } from "./chat/handler";

const server = serve({
  routes: {
    // Auth routes
    "/api/auth/login": {
      POST: handleLogin,
    },
    "/api/auth/logout": {
      POST: handleLogout,
    },
    "/api/auth/me": {
      GET: handleMe,
    },

    // Chat route (SSE streaming)
    "/api/chat": {
      POST: handleChat,
    },

    // API routes
    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
