import { defineCommand } from "citty";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
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
  skillTemplate,
  gitignoreTemplate,
} from "./templates/index.js";

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
    force: {
      type: "boolean",
      description: "Overwrite existing files",
      default: false,
    },
  },
  async run({ args }) {
    const targetDir = args.dir === "." ? process.cwd() : join(process.cwd(), args.dir);

    consola.info(`Initializing full-stack Ontology project in ${targetDir}`);

    // Create directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Check for existing config
    const configPath = join(targetDir, "ontology.config.ts");
    if (existsSync(configPath) && !args.force) {
      consola.error("ontology.config.ts already exists. Use --force to overwrite.");
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
      dev: "bun --hot src/index.ts",
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

    // Instructions
    console.log("\n");
    consola.box(
      "Full-stack Ontology project initialized!\n\n" +
        "Next steps:\n" +
        "  1. Run `bun install` to install dependencies\n" +
        "  2. Run `bun run review` to approve the initial ontology\n" +
        "  3. Run `bun run dev` to start the dev server\n\n" +
        "Your app will be available at http://localhost:3000\n" +
        "API endpoints at http://localhost:3000/api"
    );
  },
});
