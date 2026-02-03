import { defineCommand } from "citty";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { spawn } from "child_process";
import { join, isAbsolute, basename } from "path";
import { randomUUID } from "crypto";
import consola from "consola";

import {
  goModTemplate,
  goMainTemplate,
  goOntologyConfigTemplate,
  goHealthCheckResolverTemplate,
  goGetUserResolverTemplate,
  goDeleteUserResolverTemplate,
  goGetSalesDataResolverTemplate,
  goRootPackageJsonTemplate,
  goFrontendPackageJsonTemplate,
  goGitignoreTemplate,
  goReadmeTemplate,
  goViteConfigTemplate,
  goTsconfigTemplate,
  goIndexHtmlTemplate,
  goMainTsxTemplate,
  goIndexCssTemplate,
  goSkillTemplate,
  // Reuse frontend component templates
  layoutTemplate,
  vannaButtonTemplate,
  vannaCardTemplate,
  statsCardTemplate,
  homeRouteTemplate,
  dashboardRouteTemplate,
  aboutRouteTemplate,
  appTemplate,
} from "./init/templates/index.js";

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

/**
 * Replace template placeholders
 */
function replaceTemplateVars(content: string, projectName: string, uuid?: string): string {
  let result = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
  if (uuid) {
    result = result.replace(/\{\{UUID\}\}/g, uuid);
  }
  return result;
}

export const initGoCommand = defineCommand({
  meta: {
    name: "init-go",
    description: "Initialize a new full-stack Ontology project with Go backend + React frontend",
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

    const projectName = basename(targetDir) || "my-app";

    consola.info(`Initializing Go + React Ontology project in ${targetDir}`);

    // Create directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Check if directory is empty (excluding dotfiles)
    if (existsSync(targetDir) && !isDirectoryEmpty(targetDir)) {
      consola.error(
        "Directory is not empty. Please initialize in an empty directory:\n\n" +
        "  npx ont-run init-go my-project"
      );
      process.exit(1);
    }

    // Create directory structure
    const dirs = [
      "backend",
      "backend/resolvers",
      "frontend",
      "frontend/src",
      "frontend/src/routes",
      "frontend/src/components",
      "frontend/public",
      ".claude/skills/ont-run",
    ];

    for (const dir of dirs) {
      const dirPath = join(targetDir, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }

    // Generate a UUID for this project (used for cloud registration)
    const projectUuid = randomUUID();

    // Backend Go files
    const backendFiles: Array<[string, string]> = [
      ["backend/go.mod", replaceTemplateVars(goModTemplate, projectName)],
      ["backend/main.go", goMainTemplate],
      ["backend/ontology.config.go", replaceTemplateVars(goOntologyConfigTemplate, projectName, projectUuid)],
      ["backend/resolvers/health_check.go", goHealthCheckResolverTemplate],
      ["backend/resolvers/get_user.go", goGetUserResolverTemplate],
      ["backend/resolvers/delete_user.go", goDeleteUserResolverTemplate],
      ["backend/resolvers/get_sales_data.go", goGetSalesDataResolverTemplate],
    ];

    // Frontend files
    const frontendFiles: Array<[string, string]> = [
      ["frontend/index.html", replaceTemplateVars(goIndexHtmlTemplate, projectName)],
      ["frontend/vite.config.ts", goViteConfigTemplate],
      ["frontend/tsconfig.json", goTsconfigTemplate],
      ["frontend/src/main.tsx", goMainTsxTemplate],
      ["frontend/src/index.css", goIndexCssTemplate],
      ["frontend/src/App.tsx", appTemplate],
      // Components
      ["frontend/src/components/Layout.tsx", layoutTemplate],
      ["frontend/src/components/VannaButton.tsx", vannaButtonTemplate],
      ["frontend/src/components/VannaCard.tsx", vannaCardTemplate],
      ["frontend/src/components/StatsCard.tsx", statsCardTemplate],
      // Routes
      ["frontend/src/routes/home.tsx", homeRouteTemplate],
      ["frontend/src/routes/dashboard.tsx", dashboardRouteTemplate],
      ["frontend/src/routes/about.tsx", aboutRouteTemplate],
    ];

    // Root files
    const rootFiles: Array<[string, string]> = [
      [".gitignore", goGitignoreTemplate],
      ["README.md", replaceTemplateVars(goReadmeTemplate, projectName)],
      [".claude/skills/ont-run/SKILL.md", goSkillTemplate],
    ];

    // Write all files
    const allFiles = [...backendFiles, ...frontendFiles, ...rootFiles];
    for (const [filePath, content] of allFiles) {
      writeFileSync(join(targetDir, filePath), content);
    }

    consola.success("Created project files");

    // Write package.json files
    const rootPackageJson = goRootPackageJsonTemplate(projectName);
    writeFileSync(join(targetDir, "package.json"), JSON.stringify(rootPackageJson, null, 2));

    const frontendPackageJson = goFrontendPackageJsonTemplate(projectName);
    writeFileSync(join(targetDir, "frontend/package.json"), JSON.stringify(frontendPackageJson, null, 2));

    consola.success("Created package.json files");

    // Run npm install
    console.log("\n");
    consola.info("Installing dependencies with npm...");
    const installSuccess = await runCommand("npm", ["install"], targetDir);

    if (installSuccess) {
      consola.success("Dependencies installed!");
    } else {
      consola.warn("Failed to install dependencies. Please run 'npm install' manually.");
    }

    // Check if Go is installed
    const goInstalled = await runCommand("go", ["version"], targetDir).catch(() => false);
    if (!goInstalled) {
      consola.warn("Go is not installed. Please install Go 1.22+ to run the backend.");
    }

    // Instructions
    console.log("\n");
    consola.box(
      "Go + React Ontology project initialized!\n\n" +
        "Next steps:\n" +
        "  1. cd " + (args.dir === "." ? "." : args.dir) + "\n" +
        "  2. Run `npm run dev` to start the dev servers\n\n" +
        "Your frontend will be available at http://localhost:5173\n" +
        "API endpoints at http://localhost:8080/api\n" +
        "MCP server at http://localhost:8080/mcp\n\n" +
        "Edit backend/ontology.config.go to define your API.\n" +
        "The TypeScript SDK will auto-regenerate on restart."
    );
  },
});
