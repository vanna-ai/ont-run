import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

/**
 * Vite configuration for building MCP Apps as single-file HTML bundles.
 *
 * This config:
 * 1. Bundles React + Recharts + app code into a single HTML file
 * 2. Inlines all CSS and JS
 * 3. Outputs to dist/apps/ directory
 *
 * Build with: bun run build:apps
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: "src/server/mcp/apps/visualizer",
  build: {
    outDir: resolve(__dirname, "dist/apps"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/server/mcp/apps/visualizer/index.html"),
      output: {
        // Ensure consistent naming
        entryFileNames: "visualizer.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
    // Optimize for single-file output
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // Inline everything
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  // Resolve paths for imports
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/server/mcp/apps/visualizer"),
    },
  },
});
