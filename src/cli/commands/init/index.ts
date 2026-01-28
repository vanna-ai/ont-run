import { defineCommand } from "citty";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { execSync, spawn } from "child_process";
import { join } from "path";
import consola from "consola";

// Import all templates
import {
  configTemplate,
  buildTemplate,
  bunfigTemplate,
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
 * Get the path to bun binary, checking PATH first then default install location
 */
function getBunPath(): string | null {
  // Check if bun is in PATH
  try {
    execSync("bun --version", { stdio: "ignore" });
    return "bun";
  } catch {
    // Check default installation location
    const homedir = process.env.HOME || process.env.USERPROFILE || "";
    const defaultBunPath = join(homedir, ".bun", "bin", "bun");
    if (existsSync(defaultBunPath)) {
      return defaultBunPath;
    }
    return null;
  }
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
    description: "Initialize a new full-stack Ontology project with Bun + React",
  },
  args: {
    dir: {
      type: "positional",
      description: "Directory to initialize (default: current directory)",
      default: ".",
    },
  },
  async run({ args }) {
    const targetDir = args.dir === "." ? process.cwd() : join(process.cwd(), args.dir);

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
      ["build.ts", buildTemplate],
      ["bunfig.toml", bunfigTemplate],
      ["tsconfig.json", tsconfigTemplate],

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

      // .claude/skills/
      [".claude/skills/ont-run/SKILL.md", skillTemplate],
    ];

    for (const [filePath, content] of files) {
      writeFileSync(join(targetDir, filePath), content);
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
      dev: "bun run typecheck && bun --hot src/index.ts",
      build: "bun run build.ts",
      start: "NODE_ENV=production bun src/index.ts",
      review: "bunx ont-run review",
      typecheck: "tsc --noEmit",
    };
    packageJson.dependencies = {
      ...(packageJson.dependencies as Record<string, string> || {}),
      "ont-run": "latest",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "react-router": "^7.0.0",
      zod: "^4.0.0",
      "lucide-react": "^0.511.0",
      recharts: "^2.15.3",
    };
    packageJson.devDependencies = {
      ...(packageJson.devDependencies as Record<string, string> || {}),
      "@types/bun": "latest",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "bun-plugin-tailwind": "^0.1.2",
      tailwindcss: "^4.1.11",
      typescript: "^5.5.0",
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    consola.success("Updated package.json");

    // Check for bun installation
    let bunPath = getBunPath();

    if (!bunPath) {
      console.log("\n");
      consola.warn("Bun is not installed.");

      const shouldInstall = await consola.prompt(
        "Would you like to install bun now?",
        { type: "confirm", initial: true }
      );

      if (shouldInstall) {
        consola.info("Installing bun...");
        const installed = await runCommand("bash", ["-c", "curl -fsSL https://bun.sh/install | bash"]);

        if (installed) {
          consola.success("Bun installed successfully!");
          // Check again after install (will find it at ~/.bun/bin/bun)
          bunPath = getBunPath();
        } else {
          consola.error("Failed to install bun.");
          consola.info("Install manually: curl -fsSL https://bun.sh/install | bash");
        }
      } else {
        consola.info("Install bun manually: curl -fsSL https://bun.sh/install | bash");
        consola.info("Then run: bun install");
      }
    }

    // Run bun install if bun is available
    if (bunPath) {
      console.log("\n");
      consola.info("Installing dependencies...");
      const installSuccess = await runCommand(bunPath, ["install"], targetDir);

      if (installSuccess) {
        consola.success("Dependencies installed!");
      } else {
        consola.warn("Failed to install dependencies. Please run 'bun install' manually.");
      }
    }

    // Instructions
    console.log("\n");
    if (bunPath) {
      consola.box(
        "Full-stack Ontology project initialized!\n\n" +
          "Next steps:\n" +
          "  1. Run `bun run review` to approve the initial ontology\n" +
          "  2. Run `bun run dev` to start the dev server\n\n" +
          "Your app will be available at http://localhost:3000\n" +
          "API endpoints at http://localhost:3000/api"
      );
    } else {
      consola.box(
        "Full-stack Ontology project initialized!\n\n" +
          "Next steps:\n" +
          "  1. Install bun: curl -fsSL https://bun.sh/install | bash\n" +
          "  2. Restart your terminal\n" +
          "  3. Run `bun install` to install dependencies\n" +
          "  4. Run `bun run review` to approve the initial ontology\n" +
          "  5. Run `bun run dev` to start the dev server\n\n" +
          "Your app will be available at http://localhost:3000\n" +
          "API endpoints at http://localhost:3000/api"
      );
    }
  },
});
