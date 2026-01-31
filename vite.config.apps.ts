import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

/**
 * Vite configuration for building apps as single-file HTML bundles.
 *
 * This config:
 * 1. Bundles React + dependencies + app code into a single HTML file
 * 2. Inlines all CSS and JS
 * 3. Outputs to dist/apps/ directory
 *
 * Build with: npm run build:apps
 */

// Get the app name from the APP environment variable
const appName = process.env.APP || "visualizer";

// Map app names to their directories
const appPaths: Record<string, string> = {
  visualizer: "src/server/mcp/apps/visualizer",
  "browser-app": "src/browser/browser-app",
};

const appPath = appPaths[appName];
if (!appPath) {
  throw new Error(`Unknown app: ${appName}. Available apps: ${Object.keys(appPaths).join(", ")}`);
}

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: appPath,
  build: {
    outDir: resolve(__dirname, "dist/apps"),
    emptyOutDir: false, // Don't empty when building multiple apps
    rollupOptions: {
      input: resolve(__dirname, appPath, "index.html"),
      output: {
        // Ensure consistent naming
        entryFileNames: `${appName}.js`,
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
      "@": resolve(__dirname, appPath),
    },
  },
});
