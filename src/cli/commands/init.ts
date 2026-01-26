import { defineCommand } from "citty";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import consola from "consola";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Template: src/index.ts (Server entry)
// ============================================================================
const serverTemplate = `import index from "./index.html";
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

console.log(\`Server: http://localhost:\${server.port}\`);
console.log(\`API: http://localhost:\${server.port}/api\`);
`;

// ============================================================================
// Template: src/index.html
// ============================================================================
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="./index.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./frontend.tsx"></script>
</body>
</html>
`;

// ============================================================================
// Template: src/index.css (TailwindCSS)
// ============================================================================
const cssTemplate = `@import "tailwindcss";
`;

// ============================================================================
// Template: src/frontend.tsx (React entry)
// ============================================================================
const frontendTemplate = `import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
`;

// ============================================================================
// Template: src/App.tsx
// ============================================================================
const appTemplate = `import { Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./routes/home";
import { About } from "./routes/about";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}
`;

// ============================================================================
// Template: src/components/Layout.tsx
// ============================================================================
const layoutTemplate = `import { Link, Outlet } from "react-router";

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-semibold text-gray-900">
              My App
            </Link>
            <div className="flex gap-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900">
                Home
              </Link>
              <Link to="/about" className="text-gray-600 hover:text-gray-900">
                About
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
`;

// ============================================================================
// Template: src/routes/home.tsx
// ============================================================================
const homeRouteTemplate = `import { useState, useEffect } from "react";

interface HealthStatus {
  status: string;
  name: string;
  env: string;
}

export function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/health")
      .then(res => res.json())
      .then(setHealth)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
        <p className="mt-2 text-gray-600">
          Your full-stack Bun + React app is running.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Health</h2>
        {health ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-gray-500">Status:</span>{" "}
              <span className="text-green-600 font-medium">{health.status}</span>
            </p>
            <p>
              <span className="text-gray-500">API Name:</span>{" "}
              <span className="font-medium">{health.name}</span>
            </p>
            <p>
              <span className="text-gray-500">Environment:</span>{" "}
              <span className="font-medium">{health.env}</span>
            </p>
          </div>
        ) : (
          <p className="text-gray-500">Loading...</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="/api" className="text-blue-600 hover:underline">
              /api
            </a>
            <span className="text-gray-500"> - API introspection</span>
          </li>
          <li>
            <a href="/health" className="text-blue-600 hover:underline">
              /health
            </a>
            <span className="text-gray-500"> - Health check endpoint</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
`;

// ============================================================================
// Template: src/routes/about.tsx
// ============================================================================
const aboutRouteTemplate = `export function About() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">About</h1>
        <p className="mt-2 text-gray-600">
          This is an example route to demonstrate React Router.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Stack</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li><strong>Runtime:</strong> Bun</li>
          <li><strong>Frontend:</strong> React 19 + React Router 7</li>
          <li><strong>Styling:</strong> TailwindCSS 4</li>
          <li><strong>API:</strong> Ontology (ont-run)</li>
        </ul>
      </div>
    </div>
  );
}
`;

// ============================================================================
// Template: build.ts (Production build script)
// ============================================================================
const buildTemplate = `import { $ } from "bun";

console.log("Building for production...");

// Build frontend assets
const result = await Bun.build({
  entrypoints: ["./src/frontend.tsx"],
  outdir: "./dist",
  minify: true,
  sourcemap: "external",
  plugins: [
    // @ts-ignore - bun-plugin-tailwind types
    (await import("bun-plugin-tailwind")).default,
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy HTML and update paths for production
const html = await Bun.file("./src/index.html").text();
const prodHtml = html
  .replace('./index.css', '/index.css')
  .replace('./frontend.tsx', '/frontend.js');
await Bun.write("./dist/index.html", prodHtml);

console.log("Build complete! Output in ./dist");
`;

// ============================================================================
// Template: bunfig.toml
// ============================================================================
const bunfigTemplate = `[serve.static]
plugins = ["bun-plugin-tailwind"]
`;

// ============================================================================
// Template: tsconfig.json
// ============================================================================
const tsconfigTemplate = `{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false,
    "types": ["bun"]
  }
}
`;

// ============================================================================
// Template: ontology.config.ts
// ============================================================================
const configTemplate = `import { defineOntology, userContext } from 'ont-run';
import { z } from 'zod';

// Import resolver functions - TypeScript enforces return types match outputs
import healthCheck from './resolvers/healthCheck.js';
import getUser from './resolvers/getUser.js';
import deleteUser from './resolvers/deleteUser.js';

export default defineOntology({
  name: 'my-api',

  environments: {
    dev: { debug: true },
    prod: { debug: false },
  },

  // Pluggable auth - customize this for your use case
  // Return { groups, user } for row-level access control
  auth: async (req) => {
    const token = req.headers.get('Authorization');
    // Return access groups and optional user data
    // This is where you'd verify JWTs, API keys, etc.
    if (!token) return { groups: ['public'] };
    if (token === 'admin-secret') {
      return {
        groups: ['admin', 'support', 'public'],
        user: { id: 'admin-1', email: 'admin@example.com' },
      };
    }
    return {
      groups: ['support', 'public'],
      user: { id: 'user-1', email: 'user@example.com' },
    };
  },

  accessGroups: {
    public: { description: 'Unauthenticated users' },
    support: { description: 'Support agents' },
    admin: { description: 'Administrators' },
  },

  entities: {
    User: { description: 'A user account' },
  },

  functions: {
    // Example: Public function
    healthCheck: {
      description: 'Check API health status',
      access: ['public', 'support', 'admin'],
      entities: [],
      inputs: z.object({}),
      resolver: healthCheck,
    },

    // Example: Restricted function with row-level access
    getUser: {
      description: 'Get user details by ID',
      access: ['support', 'admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string().uuid(),
        // currentUser is injected from auth - not visible to API callers
        currentUser: userContext(z.object({
          id: z.string(),
          email: z.string(),
        })),
      }),
      resolver: getUser,
    },

    // Example: Admin-only function
    deleteUser: {
      description: 'Delete a user account',
      access: ['admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string().uuid(),
        reason: z.string().optional(),
      }),
      resolver: deleteUser,
    },
  },
});
`;

// ============================================================================
// Template: resolvers/healthCheck.ts
// ============================================================================
const healthCheckResolver = `import type { ResolverContext } from 'ont-run';

export default async function healthCheck(ctx: ResolverContext) {
  ctx.logger.info('Health check called');

  return {
    status: 'ok',
    env: ctx.env,
    timestamp: new Date().toISOString(),
  };
}
`;

// ============================================================================
// Template: resolvers/getUser.ts
// ============================================================================
const getUserResolver = `import type { ResolverContext } from 'ont-run';

interface GetUserArgs {
  userId: string;
  currentUser: {
    id: string;
    email: string;
  };
}

export default async function getUser(ctx: ResolverContext, args: GetUserArgs) {
  ctx.logger.info(\`Getting user: \${args.userId}\`);
  ctx.logger.info(\`Requested by: \${args.currentUser.email}\`);

  // Example: Check if user can access this resource
  // Support can only view their own account
  if (!ctx.accessGroups.includes('admin') && args.userId !== args.currentUser.id) {
    throw new Error('You can only view your own account');
  }

  // This is where you'd query your database
  // Example response:
  return {
    id: args.userId,
    name: 'Example User',
    email: 'user@example.com',
    createdAt: '2025-01-01T00:00:00Z',
  };
}
`;

// ============================================================================
// Template: resolvers/deleteUser.ts
// ============================================================================
const deleteUserResolver = `import type { ResolverContext } from 'ont-run';

interface DeleteUserArgs {
  userId: string;
  reason?: string;
}

export default async function deleteUser(ctx: ResolverContext, args: DeleteUserArgs) {
  ctx.logger.warn(\`Deleting user: \${args.userId}, reason: \${args.reason || 'none'}\`);

  // This is where you'd delete from your database
  // Example response:
  return {
    success: true,
    deletedUserId: args.userId,
    deletedAt: new Date().toISOString(),
  };
}
`;

// ============================================================================
// Template: .claude/skills/init/SKILL.md (Claude Code skill)
// ============================================================================
const skillTemplate = `---
name: init
description: Initialize a new full-stack Ontology project with Bun + React. Use when setting up a new project, explaining the init command, or helping users get started with ont-run.
---

# \`bunx ont-run init\` Command

Initialize a new full-stack Ontology project with Bun + React.

## Usage

\`\`\`bash
bunx ont-run init [dir] [--force]
\`\`\`

**Arguments:**
- \`[dir]\` - Directory to initialize (default: current directory)
- \`--force\` - Overwrite existing files

## What Gets Created

\`\`\`
project/
├── ontology.config.ts    # API configuration
├── build.ts              # Production build script
├── bunfig.toml           # Bun configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
├── src/
│   ├── index.ts          # Server entry point
│   ├── index.html        # HTML template
│   ├── index.css         # TailwindCSS entry
│   ├── frontend.tsx      # React entry point
│   ├── App.tsx           # React app with routing
│   ├── components/
│   │   └── Layout.tsx    # Shared layout component
│   └── routes/
│       ├── home.tsx      # Home page
│       └── about.tsx     # About page
├── resolvers/
│   ├── healthCheck.ts    # Health check resolver
│   ├── getUser.ts        # Get user resolver (with userContext)
│   └── deleteUser.ts     # Delete user resolver
└── .claude/
    └── skills/
        └── init/
            └── SKILL.md  # This skill file
\`\`\`

## Comprehensive ontology.config.ts Example

This example demonstrates ALL configuration features:

\`\`\`typescript
import { defineOntology, userContext, fieldFrom } from 'ont-run';
import { z } from 'zod';

// Import resolver functions
import healthCheck from './resolvers/healthCheck.js';
import getUser from './resolvers/getUser.js';
import editPost from './resolvers/editPost.js';
import getUserStatuses from './resolvers/options/userStatuses.js';
import searchTeams from './resolvers/options/searchTeams.js';
import createUser from './resolvers/createUser.js';

export default defineOntology({
  name: 'example-api',

  // Environment-specific configuration
  environments: {
    dev: { debug: true, apiUrl: 'http://localhost:3000' },
    prod: { debug: false, apiUrl: 'https://api.example.com' },
  },

  // Pluggable auth - returns AuthResult with groups + optional user
  auth: async (req) => {
    const token = req.headers.get('Authorization');

    if (!token) {
      return { groups: ['public'] };
    }

    // Verify token and get user (your auth logic here)
    const user = await verifyToken(token);

    return {
      groups: user.isAdmin ? ['admin', 'user', 'public'] : ['user', 'public'],
      user: { id: user.id, email: user.email }, // For userContext()
    };
  },

  // Define access groups with descriptions
  accessGroups: {
    public: { description: 'Unauthenticated users' },
    user: { description: 'Authenticated users' },
    admin: { description: 'Administrators' },
  },

  // Define entities for categorization
  entities: {
    User: { description: 'A user account' },
    Post: { description: 'A blog post' },
    Team: { description: 'A team/organization' },
  },

  functions: {
    // ═══════════════════════════════════════════════════════════════════════
    // Basic function (inputs only, no outputs schema)
    // ═══════════════════════════════════════════════════════════════════════
    healthCheck: {
      description: 'Check API health status',
      access: ['public', 'user', 'admin'],
      entities: [],
      inputs: z.object({}),
      resolver: healthCheck,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Function with outputs schema (recommended for documentation)
    // ═══════════════════════════════════════════════════════════════════════
    getUser: {
      description: 'Get user by ID',
      access: ['user', 'admin'],
      entities: ['User'],
      inputs: z.object({
        userId: z.string().uuid(),
      }),
      outputs: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        createdAt: z.string(),
      }),
      resolver: getUser,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Function with userContext() for row-level access control
    // The currentUser field is injected from auth() and hidden from API
    // ═══════════════════════════════════════════════════════════════════════
    editPost: {
      description: 'Edit a post (users can only edit their own posts)',
      access: ['user', 'admin'],
      entities: ['Post'],
      inputs: z.object({
        postId: z.string(),
        title: z.string(),
        content: z.string(),
        // userContext() marks this field as:
        // - Injected from auth() result's user field
        // - Hidden from public API/MCP schemas
        // - Type-safe in resolver
        currentUser: userContext(z.object({
          id: z.string(),
          email: z.string(),
        })),
      }),
      resolver: editPost,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Bulk options source for fieldFrom()
    // Empty inputs = all options fetched at once (dropdown)
    // ═══════════════════════════════════════════════════════════════════════
    getUserStatuses: {
      description: 'Get available user statuses',
      access: ['admin'],
      entities: [],
      inputs: z.object({}),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: getUserStatuses,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Autocomplete options source for fieldFrom()
    // Has query input = options searched dynamically (autocomplete)
    // ═══════════════════════════════════════════════════════════════════════
    searchTeams: {
      description: 'Search teams by name',
      access: ['admin'],
      entities: ['Team'],
      inputs: z.object({
        query: z.string(),
      }),
      outputs: z.array(z.object({
        value: z.string(),
        label: z.string(),
      })),
      resolver: searchTeams,
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Function using fieldFrom() for dynamic options
    // ═══════════════════════════════════════════════════════════════════════
    createUser: {
      description: 'Create a new user',
      access: ['admin'],
      entities: ['User'],
      inputs: z.object({
        name: z.string(),
        email: z.string().email(),
        // fieldFrom() references another function for options:
        // - Bulk: getUserStatuses has empty inputs → dropdown
        // - Autocomplete: searchTeams has query input → search
        status: fieldFrom('getUserStatuses'),
        team: fieldFrom('searchTeams'),
      }),
      resolver: createUser,
    },
  },
});
\`\`\`

## ResolverContext

Every resolver receives a \`ResolverContext\` as its first argument:

\`\`\`typescript
import type { ResolverContext } from 'ont-run';

export default async function myResolver(ctx: ResolverContext, args: MyArgs) {
  // ctx.env - Current environment name ('dev', 'prod', etc.)
  ctx.logger.info(\`Running in \${ctx.env}\`);

  // ctx.envConfig - Environment-specific configuration
  if (ctx.envConfig.debug) {
    ctx.logger.debug('Debug mode enabled');
  }

  // ctx.logger - Structured logging
  ctx.logger.info('Processing request');
  ctx.logger.warn('Something might be wrong');
  ctx.logger.error('Something went wrong');
  ctx.logger.debug('Detailed info');

  // ctx.accessGroups - Groups from auth() for this request
  if (ctx.accessGroups.includes('admin')) {
    // Admin-only logic
  }

  return { /* result */ };
}
\`\`\`

## Next Steps After Init

1. **Install dependencies:**
   \`\`\`bash
   bun install
   \`\`\`

2. **Review and approve the ontology:**
   \`\`\`bash
   bun run review
   \`\`\`

3. **Start development server:**
   \`\`\`bash
   bun run dev
   \`\`\`

4. **Access your app:**
   - Frontend: http://localhost:3000
   - API: http://localhost:3000/api
   - Health: http://localhost:3000/health

5. **Build for production:**
   \`\`\`bash
   bun run build
   bun run start
   \`\`\`
`;

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
      ".claude/skills/init",
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

      // src/routes/
      ["src/routes/home.tsx", homeRouteTemplate],
      ["src/routes/about.tsx", aboutRouteTemplate],

      // resolvers/
      ["resolvers/healthCheck.ts", healthCheckResolver],
      ["resolvers/getUser.ts", getUserResolver],
      ["resolvers/deleteUser.ts", deleteUserResolver],

      // .claude/skills/
      [".claude/skills/init/SKILL.md", skillTemplate],
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
    };
    packageJson.dependencies = {
      ...(packageJson.dependencies as Record<string, string> || {}),
      "ont-run": "latest",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      "react-router": "^7.0.0",
      zod: "^4.0.0",
    };
    packageJson.devDependencies = {
      ...(packageJson.devDependencies as Record<string, string> || {}),
      "@types/bun": "latest",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      "bun-plugin-tailwind": "^0.1.2",
      tailwindcss: "^4.1.11",
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
