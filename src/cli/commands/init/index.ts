import { defineCommand } from "citty";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { spawn } from "child_process";
import { join, isAbsolute } from "path";
import { randomUUID } from "crypto";
import consola from "consola";

import {
  configTemplate,
  buildTemplate,
  tsconfigTemplate,
  serverTemplate,
  htmlTemplate,
  cssTemplate,
  frontendTemplate,
  appTemplate,
  layoutTemplate,
  vannaButtonTemplate,
  vannaCardTemplate,
  statsCardTemplate,
  homeRouteTemplate,
  dashboardRouteTemplate,
  aboutRouteTemplate,
  healthCheckResolver,
  getUserResolver,
  deleteUserResolver,
  getSalesDataResolver,
  skillTemplate,
  gitignoreTemplate,
  generateSdkScriptTemplate,
  readmeSdkSectionTemplate,
} from "./templates/index.js";

/**
 * Check if a directory is empty (excluding dotfiles)
 */
function isDirectoryEmpty(dir: string): boolean {
  const entries = readdirSync(dir);
  const nonDotEntries = entries.filter(entry => !entry.startsWith('.'));
  return nonDotEntries.length === 0;
}

/**
 * Run a command with inherited stdio, returns promise of exit code
 */
function runCommand(command: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: "inherit",
    });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new full-stack Ontology project with React + Vite + Hono",
  },
  args: {
    dir: {
      type: "positional",
      description: "Directory to initialize (default: current directory)",
      default: ".",
    },
  },
  async run({ args }) {
    const targetDir = args.dir === "." 
      ? process.cwd() 
      : isAbsolute(args.dir) 
        ? args.dir 
        : join(process.cwd(), args.dir);

    consola.info(`Initializing full-stack Ontology project in ${targetDir}`);

    // Create directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Check if directory is empty (excluding dotfiles)
    if (existsSync(targetDir) && !isDirectoryEmpty(targetDir)) {
      consola.error(
        "Directory is not empty. Please initialize in an empty directory:\n\n" +
        "  npx ont-run init my-project"
      );
      process.exit(1);
    }

    // Create directory structure
    const dirs = [
      "src",
      "src/routes",
      "src/components",
      "resolvers",
      "scripts",
      ".claude/skills/ont-run",
    ];

    for (const dir of dirs) {
      const dirPath = join(targetDir, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }

    // Write all files
    const files: Array<[string, string]> = [
      // Root files
      [".gitignore", gitignoreTemplate],
      ["ontology.config.ts", configTemplate],
      ["vite.config.ts", buildTemplate],
      ["tsconfig.json", tsconfigTemplate],
      ["README.md", readmeSdkSectionTemplate],

      // src/ files
      ["src/index.ts", serverTemplate],
      ["src/index.html", htmlTemplate],
      ["src/index.css", cssTemplate],
      ["src/frontend.tsx", frontendTemplate],
      ["src/App.tsx", appTemplate],

      // src/components/
      ["src/components/Layout.tsx", layoutTemplate],
      ["src/components/VannaButton.tsx", vannaButtonTemplate],
      ["src/components/VannaCard.tsx", vannaCardTemplate],
      ["src/components/StatsCard.tsx", statsCardTemplate],

      // src/routes/
      ["src/routes/home.tsx", homeRouteTemplate],
      ["src/routes/dashboard.tsx", dashboardRouteTemplate],
      ["src/routes/about.tsx", aboutRouteTemplate],

      // resolvers/
      ["resolvers/healthCheck.ts", healthCheckResolver],
      ["resolvers/getUser.ts", getUserResolver],
      ["resolvers/deleteUser.ts", deleteUserResolver],
      ["resolvers/getSalesData.ts", getSalesDataResolver],

      // scripts/
      ["scripts/generate-sdk.ts", generateSdkScriptTemplate],

      // .claude/skills/
      [".claude/skills/ont-run/SKILL.md", skillTemplate],
    ];

    // Generate a UUID for this project
    const projectUuid = randomUUID();

    for (const [filePath, content] of files) {
      // Replace UUID placeholder in config template
      const finalContent = filePath === "ontology.config.ts"
        ? content.replace("{{UUID}}", projectUuid)
        : content;
      writeFileSync(join(targetDir, filePath), finalContent);
    }

    consola.success("Created project files");

    // Write/update package.json
    const packageJsonPath = join(targetDir, "package.json");
    let packageJson: Record<string, unknown> = {};

    if (existsSync(packageJsonPath)) {
      try {
        packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      } catch {
        // If parsing fails, start fresh
      }
    }

    // Set package.json values
    packageJson.type = "module";
    packageJson.scripts = {
      ...(packageJson.scripts as Record<string, string> || {}),
      dev: "concurrently \"npm run dev:server\" \"npm run dev:vite\"",
      "dev:server": "tsx watch src/index.ts",
      "dev:vite": "vite",
      build: "vite build",
      start: "NODE_ENV=production tsx src/index.ts",
      preview: "vite preview",
      review: "npx ont-run review",
      typecheck: "tsc --noEmit",
      "generate-sdk": "tsx scripts/generate-sdk.ts",
    };
    packageJson.dependencies = {
      ...(packageJson.dependencies as Record<string, string> || {}),
      "@hono/node-server": "^1.19.8",
      hono: "^4.6.0",
      "ont-run": "latest",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "react-router-dom": "^7.0.0",
      zod: "^4.0.0",
      "lucide-react": "^0.511.0",
      recharts: "^2.15.3",
    };
    packageJson.devDependencies = {
      ...(packageJson.devDependencies as Record<string, string> || {}),
      "@types/node": "^20.0.0",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "@vitejs/plugin-react": "^5.1.0",
      "@tailwindcss/vite": "^4.1.11",
      concurrently: "^9.0.0",
      tailwindcss: "^4.1.11",
      tsx: "^4.0.0",
      typescript: "^5.5.0",
      vite: "^7.3.0",
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    consola.success("Updated package.json");

    // Run npm install
    console.log("\n");
    consola.info("Installing dependencies with npm...");
    const installSuccess = await runCommand("npm", ["install"], targetDir);

    if (installSuccess) {
      consola.success("Dependencies installed!");
    } else {
      consola.warn("Failed to install dependencies. Please run 'npm install' manually.");
    }

    // Instructions
    console.log("\n");
    consola.box(
      "Full-stack Ontology project initialized!\n\n" +
        "Next steps:\n" +
        "  1. cd " + (args.dir === "." ? "." : args.dir) + "\n" +
        "  2. Run `npm run review` to approve the initial ontology\n" +
        "  3. Run `npm run dev` to start the dev server\n\n" +
        "Your app will be available at http://localhost:5173\n" +
        "API endpoints at http://localhost:5173/api\n" +
        "MCP server at http://localhost:5173/mcp"
    );
  },
});
